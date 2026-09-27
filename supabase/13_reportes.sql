-- =====================================================================
-- HU-35: reporte de facturación diaria y entradas vendidas
-- HU-36: películas más vistas y producto del candy más vendido
-- Requiere 12_resenas_alertas.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
--
-- Solo el admin. No cuentan las compras canceladas.
-- Las fechas se agrupan por día de Argentina (no UTC).
-- =====================================================================

-- Día de Argentina de un timestamptz
create or replace function dia_ar(p timestamptz)
returns date
language sql
immutable
as $$
  select (p at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

create or replace function exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_admin() then
    raise exception using message = 'Solo un administrador puede ver los reportes.', hint = 'reporte';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- HU-35: una fila por día del rango, aunque ese día no haya ventas
-- facturado = lo cobrado en pesos (total_pagado). El crédito usado se informa aparte.
-- ---------------------------------------------------------------------
create or replace function reporte_ventas(p_desde date, p_hasta date)
returns table (
  fecha date,
  compras int,
  entradas int,
  unidades_candy int,
  facturado numeric,
  credito_usado numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform exigir_admin();
  if p_hasta < p_desde then
    raise exception using message = 'La fecha "hasta" tiene que ser igual o posterior a "desde".', hint = 'reporte';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception using message = 'El rango puede ser de hasta un año.', hint = 'reporte';
  end if;

  return query
  with dias as (
    select d::date as fecha from generate_series(p_desde, p_hasta, interval '1 day') d
  ), validas as (
    select c.*, dia_ar(c.creado_en) as dia from compras c
    where c.estado <> 'cancelada' and dia_ar(c.creado_en) between p_desde and p_hasta
  )
  select dias.fecha,
         count(v.id)::int,
         coalesce(sum((select count(*) from entradas e where e.compra_id = v.id)), 0)::int,
         coalesce(sum((select sum(i.cantidad) from compra_items i where i.compra_id = v.id)), 0)::int,
         coalesce(sum(v.total_pagado), 0),
         coalesce(sum(v.credito_usado), 0)
  from dias
  left join validas v on v.dia = dias.fecha
  group by dias.fecha
  order by dias.fecha;
end;
$$;

-- ---------------------------------------------------------------------
-- HU-36: películas más vistas (entradas de funciones del período)
-- ---------------------------------------------------------------------
create or replace function ranking_peliculas(p_desde date, p_hasta date)
returns table (pelicula text, entradas int)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform exigir_admin();
  return query
  select p.nombre, count(e.id)::int
  from entradas e
  join compras c on c.id = e.compra_id and c.estado <> 'cancelada'
  join funciones f on f.id = e.funcion_id
  join peliculas p on p.id = f.pelicula_id
  where dia_ar(f.inicio) between p_desde and p_hasta
  group by p.nombre
  order by 2 desc, 1
  limit 10;
end;
$$;

-- HU-36: productos y combos del candy más vendidos (unidades, incluye canjes)
create or replace function ranking_candy(p_desde date, p_hasta date)
returns table (producto text, unidades int)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform exigir_admin();
  return query
  select regexp_replace(i.nombre, ' \(canje\)$', ''), sum(i.cantidad)::int
  from compra_items i
  join compras c on c.id = i.compra_id and c.estado <> 'cancelada'
  where dia_ar(c.creado_en) between p_desde and p_hasta
  group by 1
  order by 2 desc, 1
  limit 10;
end;
$$;
