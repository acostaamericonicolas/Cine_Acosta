-- =====================================================================
-- Catálogo en vivo: cuando el admin cambia películas (estado cartelera /
-- próximamente / oculta), funciones, combos, productos o precios, las pantallas
-- abiertas se actualizan solas.
-- Requiere 14_resenas_compradores.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
--
-- Por qué una tabla aparte y no Realtime directo sobre peliculas:
-- Realtime respeta RLS. Si una película pasa a "oculta", el público ya no puede
-- verla y Supabase NO le manda ese cambio: la pantalla nunca se enteraría.
-- Esta tabla es pública y solo guarda un número de versión por tabla, así que
-- todos reciben el aviso ("cambió algo en peliculas") y vuelven a consultar
-- con sus propios permisos.
-- =====================================================================

create table if not exists catalogo_version (
  tabla text primary key,
  version bigint not null default 0,
  cambiado_en timestamptz not null default now()
);

alter table catalogo_version enable row level security;

drop policy if exists "ver versiones del catalogo" on catalogo_version;
create policy "ver versiones del catalogo" on catalogo_version
  for select using (true);
-- Sin policies de escritura: solo el trigger (security definer) la modifica.

create or replace function subir_version_catalogo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Cada compra actualiza peliculas.vendidas y el recálculo de duración hace
  -- "update funciones set inicio = inicio": no son cambios del catálogo.
  if tg_op = 'UPDATE' then
    if tg_table_name = 'peliculas' and (to_jsonb(new) - 'vendidas') = (to_jsonb(old) - 'vendidas') then
      return null;
    end if;
    if tg_table_name = 'funciones' and (to_jsonb(new) - 'fin' - 'libre_desde') = (to_jsonb(old) - 'fin' - 'libre_desde') then
      return null;
    end if;
  end if;

  insert into catalogo_version (tabla, version, cambiado_en)
  values (tg_table_name, 1, now())
  on conflict (tabla) do update
    set version = catalogo_version.version + 1, cambiado_en = now();
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['peliculas', 'funciones', 'combos', 'combo_items', 'productos_candy', 'precios_butaca'] loop
    execute format('drop trigger if exists %I on %I', t || '_version', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function subir_version_catalogo()',
                   t || '_version', t);
    insert into catalogo_version (tabla) values (t) on conflict (tabla) do nothing;
  end loop;

  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'catalogo_version') then
    alter publication supabase_realtime add table catalogo_version;
  end if;

  -- Los avisos de venta abierta (HU-11) ahora también usan catalogo_version.
  -- peliculas sale de Realtime: cada compra la actualiza y generaba tráfico de más.
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and tablename = 'peliculas') then
    alter publication supabase_realtime drop table peliculas;
  end if;
end;
$$;
