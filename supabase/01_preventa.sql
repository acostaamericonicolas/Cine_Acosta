-- =====================================================================
-- HU-21: preventa por película
-- Ejecutar completo en Supabase → SQL Editor.
-- =====================================================================

-- Fecha de hoy en Argentina. current_date usa la zona del servidor (UTC):
-- después de las 21 h ya devolvería el día siguiente.
create or replace function hoy_ar()
returns date
language sql stable
set search_path = public
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- Preventa: se activa por película, con un precio especial para butacas
-- generales y accesibles (la VIP suma su recargo sobre ese precio).
alter table peliculas
  add column if not exists preventa boolean not null default false,
  add column if not exists precio_preventa numeric(10, 2);

alter table peliculas
  add constraint peliculas_preventa_precio_check
  check (not preventa or (precio_preventa is not null and precio_preventa > 0));

-- ¿La película está en preventa hoy? Del día (estreno - 7) al día anterior al estreno.
-- Recibe la fila de la película: PostgREST la expone como columna calculada,
-- Angular la pide con .select('*, en_preventa, venta_abierta').
create or replace function en_preventa(p peliculas)
returns boolean
language sql stable
set search_path = public
as $$
  select p.preventa
     and hoy_ar() >= p.fecha_estreno - 7
     and hoy_ar() < p.fecha_estreno;
$$;

-- ¿Se pueden vender entradas hoy?
-- En cartelera: sí. Próximamente: desde el estreno, o desde la preventa si está activada.
create or replace function venta_abierta(p peliculas)
returns boolean
language sql stable
set search_path = public
as $$
  select p.estado = 'cartelera'
      or (p.estado = 'proximamente'
          and (hoy_ar() >= p.fecha_estreno
               or (p.preventa and hoy_ar() >= p.fecha_estreno - 7)));
$$;

-- Precio de una entrada según el tipo de butaca y la preventa.
-- La usa confirmar_compra (HU-26); Angular replica el cálculo solo para mostrarlo.
create or replace function precio_entrada(p_pelicula_id bigint, p_tipo text)
returns numeric
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_pelicula peliculas;
  v_base numeric;
  v_general numeric;
begin
  select * into v_pelicula from peliculas where id = p_pelicula_id;
  if not found then
    raise exception using message = 'La película de esta función ya no existe.', hint = 'funcion';
  end if;

  select precio into v_base from precios_butaca where tipo = p_tipo;
  if v_base is null then
    raise exception using message = format('No hay un precio cargado para butacas de tipo "%s".', p_tipo), hint = 'precio';
  end if;

  if not en_preventa(v_pelicula) then
    return v_base;
  end if;

  if p_tipo = 'vip' then
    select precio into v_general from precios_butaca where tipo = 'general';
    return v_pelicula.precio_preventa + (v_base - v_general);
  end if;
  return v_pelicula.precio_preventa;
end;
$$;
