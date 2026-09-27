-- =====================================================================
-- HU-10: reseñas de clientes · HU-11: alerta de apertura de venta
-- Requiere 11_actividad.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
-- =====================================================================

-- ---------------------------------------------------------------------
-- HU-10 · Reseñas: 1 a 5 estrellas, comentario de hasta 200 caracteres,
-- una por cliente y película (constraints que ya existían). El promedio lo
-- calcula el detalle con las reseñas, así que se "recalcula" solo.
-- ---------------------------------------------------------------------

-- El usuario y el nombre a mostrar los pone la base: el cliente no puede
-- firmar con otro nombre ni a nombre de otro usuario.
create or replace function completar_resena()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.usuario_id := auth.uid();
  select nombre || ' ' || left(apellido, 1) || '.' into new.autor from perfiles where id = auth.uid();
  new.comentario := trim(coalesce(new.comentario, ''));
  if tg_op = 'UPDATE' then
    new.pelicula_id := old.pelicula_id;   -- una reseña no se mueve de película
    new.creado_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists resenas_completar on resenas;
create trigger resenas_completar
  before insert or update on resenas
  for each row execute function completar_resena();

-- Solo clientes escriben reseñas (el personal no, RF-30/33); cada uno edita o borra la suya
create or replace function es_cliente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'cliente');
$$;

drop policy if exists "cliente escribe su resena" on resenas;
create policy "cliente escribe su resena" on resenas
  for insert with check (es_cliente() and usuario_id = auth.uid());

drop policy if exists "cliente edita su resena" on resenas;
create policy "cliente edita su resena" on resenas
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "cliente borra su resena" on resenas;
create policy "cliente borra su resena" on resenas
  for delete using (usuario_id = auth.uid() or es_admin());

-- ---------------------------------------------------------------------
-- HU-11 · Alertas: el cliente pide que le avisen cuando se abre la venta
-- (preventa, o el estreno si no hay preventa). Sin mails: el aviso aparece
-- dentro de la app al iniciar sesión.
-- ---------------------------------------------------------------------
create table if not exists alertas_venta (
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pelicula_id bigint not null references peliculas (id) on delete cascade,
  creado_en timestamptz not null default now(),
  avisado_en timestamptz,          -- cuándo se le mostró el aviso
  primary key (usuario_id, pelicula_id)
);

alter table alertas_venta enable row level security;

drop policy if exists "ver mis alertas" on alertas_venta;
create policy "ver mis alertas" on alertas_venta
  for select using (usuario_id = auth.uid());

drop policy if exists "cliente crea su alerta" on alertas_venta;
create policy "cliente crea su alerta" on alertas_venta
  for insert with check (es_cliente() and usuario_id = auth.uid());

drop policy if exists "cliente borra su alerta" on alertas_venta;
create policy "cliente borra su alerta" on alertas_venta
  for delete using (usuario_id = auth.uid());

-- Devuelve las películas con alerta cuya venta ya abrió y todavía no se avisaron,
-- y las marca como avisadas (el aviso se muestra una vez).
create or replace function avisos_venta_abierta()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avisos jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  with abiertas as (
    select a.pelicula_id, p.nombre, en_preventa(p) as en_preventa, p.fecha_estreno
    from alertas_venta a
    join peliculas p on p.id = a.pelicula_id
    where a.usuario_id = auth.uid() and a.avisado_en is null and venta_abierta(p)
  ), marcadas as (
    update alertas_venta a set avisado_en = now()
    from abiertas
    where a.usuario_id = auth.uid() and a.pelicula_id = abiertas.pelicula_id
    returning a.pelicula_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('pelicula_id', ab.pelicula_id, 'nombre', ab.nombre,
                                               'en_preventa', ab.en_preventa, 'fecha_estreno', ab.fecha_estreno)), '[]'::jsonb)
  into v_avisos
  from abiertas ab
  join marcadas m on m.pelicula_id = ab.pelicula_id;

  return v_avisos;
end;
$$;
