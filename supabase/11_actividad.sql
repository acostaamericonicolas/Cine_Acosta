-- =====================================================================
-- HU-37: log de actividad (RF-36)
-- Requiere 10_personal.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
--
-- Se registra con TRIGGERS (punto i acordado): así no depende de que Angular se
-- acuerde de loguear, y queda registrado aunque alguien use la API directamente.
-- Quién: auth.uid() de la sesión que hizo el cambio (null = invitado o sistema).
-- =====================================================================

create table if not exists actividad (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  usuario_id uuid,              -- null: invitado o proceso de la base
  usuario text not null,        -- "Ana Pérez (admin)" en el momento de la acción
  accion text not null,         -- "Creó una función", "Modificó un precio", "Validó una entrada"...
  detalle text not null,
  tabla text not null
);

create index if not exists actividad_creado_en on actividad (creado_en desc);

alter table actividad enable row level security;

-- Solo el admin lo consulta. Nadie inserta ni borra desde la API: solo los triggers.
drop policy if exists "admin ve la actividad" on actividad;
create policy "admin ve la actividad" on actividad
  for select using (es_admin());

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Nombre de quien hace la acción, en el momento de hacerla
create or replace function actor_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nombre || ' ' || apellido || ' (' || rol || ')' from perfiles where id = auth.uid()),
    case when auth.uid() is null then 'Invitado / sistema' else 'Usuario sin perfil' end
  );
$$;

create or replace function registrar(p_tabla text, p_accion text, p_detalle text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into actividad (usuario_id, usuario, accion, detalle, tabla)
  values (auth.uid(), actor_actual(), p_accion, p_detalle, p_tabla);
$$;

-- "Avatar · 27/09 18:00 · Sala 1"
create or replace function describir_funcion(p_funcion_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.nombre || ' · ' || hora_ar(f.inicio) || ' · ' || s.nombre
  from funciones f join peliculas p on p.id = f.pelicula_id join salas s on s.id = f.sala_id
  where f.id = p_funcion_id;
$$;

-- ---------------------------------------------------------------------
-- Trigger único: arma la acción según la tabla y la operación.
-- to_jsonb(new/old) permite leer las columnas sin importar la tabla.
-- ---------------------------------------------------------------------
create or replace function log_actividad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  verbo text := case tg_op when 'INSERT' then 'Creó' when 'UPDATE' then 'Modificó' else 'Eliminó' end;
  fila jsonb := coalesce(n, o);
begin
  case tg_table_name

  when 'peliculas' then
    -- confirmar_compra y cancelar_compra actualizan "vendidas": eso no es una acción del admin
    if tg_op = 'UPDATE' and (n - 'vendidas') = (o - 'vendidas') then return null; end if;
    perform registrar(tg_table_name, verbo || ' una película', fila ->> 'nombre');

  when 'funciones' then
    -- El recálculo por cambio de duración hace "update ... set inicio = inicio": no cuenta
    if tg_op = 'UPDATE' and (n - 'fin' - 'libre_desde') = (o - 'fin' - 'libre_desde') then return null; end if;
    -- Se describe con los datos de la fila (en un DELETE la función ya no existe en la tabla)
    perform registrar(tg_table_name, verbo || ' una función',
                      format('%s · %s · %s',
                             (select nombre from peliculas where id = (fila ->> 'pelicula_id')::bigint),
                             hora_ar((fila ->> 'inicio')::timestamptz),
                             (select nombre from salas where id = (fila ->> 'sala_id')::bigint)));

  when 'precios_butaca' then
    perform registrar(tg_table_name, 'Modificó un precio',
                      format('Butaca %s: $ %s → $ %s', n ->> 'tipo', o ->> 'precio', n ->> 'precio'));

  when 'productos_candy', 'combos' then
    if tg_op = 'UPDATE' and (n ->> 'precio') is distinct from (o ->> 'precio') then
      perform registrar(tg_table_name, 'Modificó un precio',
                        format('%s: $ %s → $ %s', n ->> 'nombre', o ->> 'precio', n ->> 'precio'));
    else
      perform registrar(tg_table_name,
                        verbo || case when tg_table_name = 'combos' then ' un combo' else ' un producto del candy' end,
                        fila ->> 'nombre');
    end if;

  when 'salas' then
    perform registrar(tg_table_name, verbo || ' una sala',
                      (fila ->> 'nombre') || case when (fila ->> 'activa')::boolean then '' else ' (inactiva)' end);

  when 'butacas_deshabilitadas' then
    perform registrar(tg_table_name,
                      case tg_op when 'INSERT' then 'Deshabilitó una butaca' else 'Habilitó una butaca' end,
                      format('%s-%s en %s', fila ->> 'fila', fila ->> 'numero',
                             (select nombre from salas where id = (fila ->> 'sala_id')::bigint)));

  when 'config_cupon_primera_compra' then
    perform registrar(tg_table_name, 'Modificó el cupón de primera compra',
                      format('%s%% → %s%%', o ->> 'porcentaje', n ->> 'porcentaje'));

  when 'cupones_por_edad' then
    perform registrar(tg_table_name, verbo || ' un cupón por edad',
                      format('Mayores de %s: %s%%, del %s al %s%s', fila ->> 'edad_minima', fila ->> 'porcentaje',
                             fila ->> 'vigente_desde', fila ->> 'vigente_hasta',
                             case when (fila ->> 'activo')::boolean then '' else ' (desactivado)' end));

  when 'recompensas' then
    perform registrar(tg_table_name, verbo || ' una recompensa en puntos',
                      format('%s: %s', coalesce((select nombre from productos_candy where id = (fila ->> 'producto_id')::bigint), 'Entrada general'),
                             coalesce((fila ->> 'puntos') || ' puntos', 'igual al precio')
                             || case when (fila ->> 'activa')::boolean then '' else ', canje desactivado' end));

  when 'perfiles' then
    if tg_op = 'INSERT' then
      perform registrar(tg_table_name,
                        case when n ->> 'rol' = 'cliente' then 'Se registró un cliente' else 'Dio de alta personal' end,
                        format('%s %s <%s> · %s', n ->> 'nombre', n ->> 'apellido', n ->> 'email', n ->> 'rol'));
    end if;

  when 'compras' then
    if tg_op = 'INSERT' then
      perform registrar(tg_table_name, 'Compra',
                        format('Código %s · %s · $ %s · %s', n ->> 'codigo',
                               describir_funcion((n ->> 'funcion_id')::bigint), n ->> 'total_pagado', n ->> 'email'));
    elsif (n ->> 'estado') is distinct from (o ->> 'estado') then
      perform registrar(tg_table_name,
                        case n ->> 'estado' when 'usada' then 'Validó una entrada' when 'cancelada' then 'Canceló una compra' else 'Cambió una compra' end,
                        format('Código %s · %s', n ->> 'codigo', describir_funcion((n ->> 'funcion_id')::bigint)));
    end if;

  when 'compra_items' then
    if tg_op = 'UPDATE' and (o ->> 'entregado_en') is null and (n ->> 'entregado_en') is not null then
      perform registrar(tg_table_name, 'Entregó candy',
                        format('%s × %s · código %s', n ->> 'cantidad', n ->> 'nombre',
                               (select codigo from compras where id = (n ->> 'compra_id')::bigint)));
    end if;

  else
    null;
  end case;

  return null;   -- trigger AFTER: el valor de retorno no se usa
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers (drop + create para poder re-ejecutar el script)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['peliculas', 'funciones', 'precios_butaca', 'productos_candy', 'combos', 'salas',
                           'butacas_deshabilitadas', 'config_cupon_primera_compra', 'cupones_por_edad',
                           'recompensas', 'perfiles', 'compras', 'compra_items'] loop
    execute format('drop trigger if exists %I on %I', t || '_log', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function log_actividad()',
                   t || '_log', t);
  end loop;
end;
$$;
