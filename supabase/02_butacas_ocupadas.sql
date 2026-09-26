-- =====================================================================
-- HU-22 y HU-23: reserva temporal de butacas + Supabase Realtime
-- Requiere 01_preventa.sql (usa venta_abierta).
-- Ejecutar completo en Supabase → SQL Editor.
-- =====================================================================

-- Tipo de una butaca según el layout fijo de la sala. Es el mismo que
-- shared/sala-layout.ts en Angular; devuelve null si la butaca no existe.
create or replace function tipo_butaca(p_fila text, p_numero int)
returns text
language sql immutable
as $$
  select case
    when p_fila !~ '^[A-T]$' or p_fila = 'K' or p_numero not between 1 and 28 then null
    when p_fila = 'J' then
      case when p_numero in (2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 26, 27) then 'accesible' end
    when p_fila in ('R', 'S', 'T') then 'vip'
    else 'general'
  end;
$$;

-- Una fila por butaca tomada en una función: reservada (temporal) o vendida.
-- La clave primaria impide que la misma butaca se tome dos veces.
create table if not exists butacas_ocupadas (
  funcion_id bigint not null references funciones (id) on delete cascade,
  fila text not null,
  numero int not null,
  estado text not null default 'reservada' check (estado in ('reservada', 'vendida')),
  vence timestamptz,     -- solo las reservadas: después de esta hora quedan libres
  token_hash text,       -- sha256 del token del navegador que reservó (el token nunca se guarda)
  creado_en timestamptz not null default now(),
  primary key (funcion_id, fila, numero),
  constraint butacas_ocupadas_reserva_check
    check (estado = 'vendida' or (vence is not null and token_hash is not null))
);

alter table butacas_ocupadas enable row level security;

-- Todos (incluso sin sesión) ven qué butacas están tomadas.
-- No hay policies de insert/update/delete: solo se modifica con las funciones de abajo.
create policy "ver butacas ocupadas" on butacas_ocupadas
  for select using (true);

-- Realtime: el mapa de butacas escucha los cambios de esta tabla
alter publication supabase_realtime add table butacas_ocupadas;

-- ---------------------------------------------------------------------
-- reservar_butaca: toma una butaca por 10 minutos para el token dado.
-- Todas las butacas del mismo token vencen juntas (un solo reloj).
-- Devuelve la hora de vencimiento.
-- Errores: el mensaje es para el usuario y el hint indica qué falló.
-- ---------------------------------------------------------------------
create or replace function reservar_butaca(p_funcion_id bigint, p_fila text, p_numero int, p_token uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funcion funciones;
  v_pelicula peliculas;
  v_hash text := encode(sha256(p_token::text::bytea), 'hex');
  v_butaca text := p_fila || '-' || p_numero;
  v_cantidad int;
  v_vence timestamptz;
  v_existente butacas_ocupadas;
begin
  select * into v_funcion from funciones where id = p_funcion_id;
  if not found then
    raise exception using message = 'La función ya no existe.', hint = 'funcion';
  end if;
  if v_funcion.inicio <= now() then
    raise exception using message = 'La función ya empezó: no se pueden reservar butacas.', hint = 'funcion';
  end if;

  select * into v_pelicula from peliculas where id = v_funcion.pelicula_id;
  if not venta_abierta(v_pelicula) then
    raise exception using message = format('La venta de entradas para "%s" todavía no está abierta.', v_pelicula.nombre), hint = 'funcion';
  end if;

  if tipo_butaca(p_fila, p_numero) is null then
    raise exception using message = format('La butaca %s no existe en la sala.', v_butaca), hint = 'butaca';
  end if;
  if exists (select 1 from butacas_deshabilitadas
             where sala_id = v_funcion.sala_id and fila = p_fila and numero = p_numero) then
    raise exception using message = format('La butaca %s está fuera de servicio.', v_butaca), hint = 'butaca';
  end if;

  -- Las reservas vencidas de esta función se liberan acá (Realtime avisa el DELETE a todos)
  delete from butacas_ocupadas
  where funcion_id = p_funcion_id and estado = 'reservada' and vence <= now();

  select count(*), min(vence) into v_cantidad, v_vence
  from butacas_ocupadas
  where funcion_id = p_funcion_id and token_hash = v_hash;

  if v_cantidad >= 10 then
    raise exception using message = 'Podés reservar hasta 10 butacas por compra.', hint = 'butaca';
  end if;
  v_vence := coalesce(v_vence, now() + interval '10 minutes');

  select * into v_existente from butacas_ocupadas
  where funcion_id = p_funcion_id and fila = p_fila and numero = p_numero;
  if found then
    if v_existente.token_hash = v_hash then
      return v_vence;   -- ya era mía
    end if;
    if v_existente.estado = 'vendida' then
      raise exception using message = format('La butaca %s ya está vendida.', v_butaca), hint = 'butaca';
    end if;
    raise exception using message = format('La butaca %s la está reservando otra persona.', v_butaca), hint = 'butaca';
  end if;

  insert into butacas_ocupadas (funcion_id, fila, numero, vence, token_hash)
  values (p_funcion_id, p_fila, p_numero, v_vence, v_hash);
  return v_vence;

exception
  -- Dos personas tocaron la misma butaca al mismo tiempo: gana la primera
  when unique_violation then
    raise exception using message = format('La butaca %s la acaba de elegir otra persona.', v_butaca), hint = 'butaca';
end;
$$;

-- Suelta una butaca reservada por este token
create or replace function liberar_butaca(p_funcion_id bigint, p_fila text, p_numero int, p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from butacas_ocupadas
  where funcion_id = p_funcion_id and fila = p_fila and numero = p_numero
    and estado = 'reservada' and token_hash = encode(sha256(p_token::text::bytea), 'hex');
$$;

-- Suelta todas las butacas reservadas por este token en la función (al salir de la compra)
create or replace function liberar_reservas(p_funcion_id bigint, p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from butacas_ocupadas
  where funcion_id = p_funcion_id and estado = 'reservada'
    and token_hash = encode(sha256(p_token::text::bytea), 'hex');
$$;
