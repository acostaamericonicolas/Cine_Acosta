-- =====================================================================
-- HU-10 (cambio pedido): solo califica quien COMPRÓ una entrada para la
-- película, DESPUÉS de que terminó su función, y UNA sola vez (no se edita).
-- HU-11 (mejora): la tabla peliculas entra en Realtime para que el aviso de
-- venta abierta llegue sin recargar la página.
-- Requiere 13_reportes.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ¿Puede el usuario calificar esta película? Devuelve el motivo si no puede,
-- para mostrárselo tal cual. La usan Angular (para mostrar u ocultar el
-- formulario) y el trigger de resenas (para que no se pueda saltear).
-- ---------------------------------------------------------------------
create or replace function puede_resenar(p_pelicula_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_proximo_fin timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('puede', false, 'motivo', 'Iniciá sesión con tu cuenta de cliente para calificar.');
  end if;
  if not es_cliente() then
    return jsonb_build_object('puede', false, 'motivo', 'Solo los clientes pueden calificar películas.');
  end if;
  if exists (select 1 from resenas where pelicula_id = p_pelicula_id and usuario_id = v_uid) then
    return jsonb_build_object('puede', false, 'motivo', 'Ya calificaste esta película. La calificación es una sola vez.');
  end if;

  -- Tiene que haber comprado (compra no cancelada) una función de esta película...
  if not exists (select 1 from compras c join funciones f on f.id = c.funcion_id
                 where c.usuario_id = v_uid and c.estado <> 'cancelada' and f.pelicula_id = p_pelicula_id) then
    return jsonb_build_object('puede', false,
                              'motivo', 'Solo pueden calificar quienes compraron una entrada para esta película.');
  end if;

  -- ...y esa función ya tiene que haber terminado
  if not exists (select 1 from compras c join funciones f on f.id = c.funcion_id
                 where c.usuario_id = v_uid and c.estado <> 'cancelada' and f.pelicula_id = p_pelicula_id
                   and f.fin <= now()) then
    select min(f.fin) into v_proximo_fin
    from compras c join funciones f on f.id = c.funcion_id
    where c.usuario_id = v_uid and c.estado <> 'cancelada' and f.pelicula_id = p_pelicula_id;
    return jsonb_build_object('puede', false,
                              'motivo', format('Vas a poder calificarla cuando termine tu función (%s).', hora_ar(v_proximo_fin)));
  end if;

  return jsonb_build_object('puede', true, 'motivo', null);
end;
$$;

-- ---------------------------------------------------------------------
-- El trigger de reseñas controla la regla (mensaje claro) y completa
-- usuario y nombre a mostrar. Ya no hay edición: solo insert.
-- ---------------------------------------------------------------------
create or replace function completar_resena()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permiso jsonb := puede_resenar(new.pelicula_id);
begin
  if not (v_permiso ->> 'puede')::boolean then
    raise exception using message = v_permiso ->> 'motivo', hint = 'resena';
  end if;

  new.usuario_id := auth.uid();
  select nombre || ' ' || left(apellido, 1) || '.' into new.autor from perfiles where id = auth.uid();
  new.comentario := trim(coalesce(new.comentario, ''));
  new.creado_en := now();
  return new;
end;
$$;

drop trigger if exists resenas_completar on resenas;
create trigger resenas_completar
  before insert on resenas
  for each row execute function completar_resena();

-- Policies: insertar solo si puede; nadie edita; solo el admin borra (moderación)
drop policy if exists "cliente escribe su resena" on resenas;
create policy "cliente escribe su resena" on resenas
  for insert with check (usuario_id = auth.uid() and (puede_resenar(pelicula_id) ->> 'puede')::boolean);

drop policy if exists "cliente edita su resena" on resenas;
drop policy if exists "cliente borra su resena" on resenas;

drop policy if exists "admin borra resenas" on resenas;
create policy "admin borra resenas" on resenas
  for delete using (es_admin());

-- ---------------------------------------------------------------------
-- HU-11: Realtime sobre peliculas. Cuando el admin abre la venta (estado
-- o preventa), la app del cliente se entera al instante y consulta sus avisos.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'peliculas') then
    alter publication supabase_realtime add table peliculas;
  end if;
end;
$$;
