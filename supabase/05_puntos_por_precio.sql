-- =====================================================================
-- HU-30 (cambio): cada ítem cuesta en puntos lo mismo que vale en pesos
-- Requiere 04_puntos.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
--
-- Como 1 peso pagado = 1 punto, por defecto todo lo que está a la venta
-- (la entrada general y cada producto activo del candy) se canjea por la
-- misma cantidad de puntos que su precio, redondeada hacia arriba.
-- La tabla recompensas pasa a guardar solo las excepciones del admin:
--   puntos = null  → usa el precio (lo que sale por defecto)
--   puntos = N     → costo fijado a mano
--   activa = false → ese ítem no se puede canjear
-- =====================================================================

alter table recompensas alter column puntos drop not null;
alter table recompensas drop constraint if exists recompensas_puntos_check;
alter table recompensas
  add constraint recompensas_puntos_check check (puntos is null or puntos > 0);

-- ---------------------------------------------------------------------
-- Catálogo de canjes: todo lo canjeable con su costo en puntos.
-- security_invoker: se aplican las policies de quien consulta (todas estas tablas son de lectura pública).
-- Si cambia un precio, el costo por defecto cambia solo.
-- ---------------------------------------------------------------------
create or replace view catalogo_canjes
with (security_invoker = true)
as
select 'entrada'::text as tipo,
       null::bigint as producto_id,
       'Entrada general'::text as nombre,
       pb.precio,
       coalesce(r.puntos, ceil(pb.precio)::int) as puntos,
       r.puntos is not null as personalizado,
       coalesce(r.activa, true) as activa,
       r.id as recompensa_id
from precios_butaca pb
left join recompensas r on r.tipo = 'entrada'
where pb.tipo = 'general'
union all
select 'producto',
       p.id,
       p.nombre,
       p.precio,
       coalesce(r.puntos, ceil(p.precio)::int),
       r.puntos is not null,
       coalesce(r.activa, true),
       r.id
from productos_candy p
left join recompensas r on r.producto_id = p.id
where p.activo;

grant select on catalogo_canjes to anon, authenticated;

-- ---------------------------------------------------------------------
-- confirmar_compra: mismo comportamiento que en 04_puntos.sql, pero el costo
-- de cada canje sale de catalogo_canjes.
-- p_canjes: [{"tipo": "entrada", "cantidad": 1}, {"tipo": "producto", "producto_id": 3, "cantidad": 2}]
-- ---------------------------------------------------------------------
create or replace function confirmar_compra(
  p_funcion_id bigint,
  p_token uuid,
  p_butacas text[],
  p_items jsonb default '[]',
  p_cupon text default null,
  p_credito numeric default 0,
  p_email text default null,
  p_fecha_nacimiento date default null,
  p_medio_pago text default null,
  p_canjes jsonb default '[]'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil perfiles;
  v_funcion funciones;
  v_pelicula peliculas;
  v_hash text := encode(sha256(p_token::text::bytea), 'hex');
  v_email text;
  v_nacimiento date;
  v_edad int;
  v_butaca text;
  v_cant_butacas int := coalesce(cardinality(p_butacas), 0);
  v_general numeric;
  v_sub_entradas numeric := 0;
  v_sub_candy numeric := 0;
  v_combos_entrada int := 0;
  v_desc_combos numeric := 0;
  v_canjes_entrada int := 0;
  v_desc_canjes numeric := 0;
  v_puntos_canje int := 0;
  v_base numeric;
  v_pct numeric;
  v_desc_cupon numeric := 0;
  v_credito numeric := coalesce(p_credito, 0);
  v_total numeric;
  v_puntos int := 0;
  v_item jsonb;
  v_cant int;
  v_producto productos_candy;
  v_combo combos;
  v_canjeable catalogo_canjes;
  v_compra_id bigint;
  v_codigo text;
begin
  -- 1. Función ---------------------------------------------------------
  select * into v_funcion from funciones where id = p_funcion_id;
  if not found then
    raise exception using message = 'La función ya no existe.', hint = 'funcion';
  end if;
  if v_funcion.inicio <= now() then
    raise exception using message = 'La función ya empezó: no se pueden vender entradas.', hint = 'funcion';
  end if;
  select * into v_pelicula from peliculas where id = v_funcion.pelicula_id;
  if not venta_abierta(v_pelicula) then
    raise exception using message = format('La venta de entradas para "%s" no está abierta.', v_pelicula.nombre), hint = 'funcion';
  end if;

  -- 2. Comprador -------------------------------------------------------
  if v_uid is not null then
    select * into v_perfil from perfiles where id = v_uid for update;
    v_email := v_perfil.email;
    v_nacimiento := v_perfil.fecha_nacimiento;
  else
    v_email := lower(trim(p_email));
    if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception using message = 'Ingresá un mail válido: ahí te identificamos la compra.', hint = 'comprador';
    end if;
    v_nacimiento := p_fecha_nacimiento;
  end if;

  -- 3. Edad (HU-24) ----------------------------------------------------
  if v_pelicula.restriccion_edad > 0 then
    if v_nacimiento is null then
      raise exception using message = format('Falta la fecha de nacimiento: "%s" es para mayores de %s años.',
                                             v_pelicula.nombre, v_pelicula.restriccion_edad), hint = 'edad';
    end if;
    v_edad := extract(year from age(hoy_ar(), v_nacimiento))::int;
    if v_edad < v_pelicula.restriccion_edad then
      raise exception using message = format('"%s" es para mayores de %s años y la fecha de nacimiento indica %s años.',
                                             v_pelicula.nombre, v_pelicula.restriccion_edad, v_edad), hint = 'edad';
    end if;
  end if;

  -- 4. Reservas --------------------------------------------------------
  if v_cant_butacas = 0 then
    raise exception using message = 'No elegiste ninguna butaca.', hint = 'reserva';
  end if;
  foreach v_butaca in array p_butacas loop
    perform 1 from butacas_ocupadas
    where funcion_id = p_funcion_id and fila || '-' || numero = v_butaca
      and estado = 'reservada' and token_hash = v_hash and vence > now()
    for update;
    if not found then
      raise exception using message = format('La reserva de la butaca %s venció o ya no es tuya. Volvé a elegir las butacas.', v_butaca),
                            hint = 'reserva';
    end if;
  end loop;

  -- 5. Precio de las entradas (con preventa) ---------------------------
  select sum(precio_entrada(v_pelicula.id, tipo_butaca(fila, numero))) into v_sub_entradas
  from butacas_ocupadas
  where funcion_id = p_funcion_id and token_hash = v_hash and fila || '-' || numero = any (p_butacas);
  v_general := precio_entrada(v_pelicula.id, 'general');

  -- 6. Candy (HU-25) ---------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_cant := (v_item ->> 'cantidad')::int;
    if v_cant is null or v_cant not between 1 and 20 then
      raise exception using message = 'La cantidad de cada producto tiene que ser entre 1 y 20.', hint = 'candy';
    end if;

    if v_item ->> 'tipo' = 'producto' then
      select * into v_producto from productos_candy where id = (v_item ->> 'id')::bigint;
      if not found or not v_producto.activo then
        raise exception using message = format('El producto "%s" ya no está disponible. Sacalo de tu compra.',
                                               coalesce(v_producto.nombre, 'elegido')), hint = 'candy';
      end if;
      v_sub_candy := v_sub_candy + v_producto.precio * v_cant;
    elsif v_item ->> 'tipo' = 'combo' then
      select * into v_combo from combos where id = (v_item ->> 'id')::bigint;
      if not found or not v_combo.activo then
        raise exception using message = format('El combo "%s" ya no está disponible. Sacalo de tu compra.',
                                               coalesce(v_combo.nombre, 'elegido')), hint = 'candy';
      end if;
      v_sub_candy := v_sub_candy + v_combo.precio * v_cant;
      if v_combo.incluye_entrada then
        v_combos_entrada := v_combos_entrada + v_cant;
      end if;
    else
      raise exception using message = 'Hay un producto del candy que no se reconoce.', hint = 'candy';
    end if;
  end loop;

  if v_combos_entrada > v_cant_butacas then
    raise exception using message = format('Elegiste %s combos que incluyen entrada, pero solo %s butacas. Sacá combos o sumá butacas.',
                                           v_combos_entrada, v_cant_butacas), hint = 'candy';
  end if;

  -- 7. Canje de puntos (HU-31): solo registrados, hasta su saldo -------
  for v_item in select * from jsonb_array_elements(coalesce(p_canjes, '[]'::jsonb)) loop
    if v_uid is null then
      raise exception using message = 'Los puntos son para usuarios registrados. Iniciá sesión para canjearlos.', hint = 'puntos';
    end if;
    v_cant := (v_item ->> 'cantidad')::int;
    if v_cant is null or v_cant not between 1 and 20 then
      raise exception using message = 'La cantidad de cada canje tiene que ser entre 1 y 20.', hint = 'puntos';
    end if;

    -- El costo sale del catálogo: el precio en pesos o lo que haya fijado el admin
    select * into v_canjeable from catalogo_canjes
    where tipo = v_item ->> 'tipo'
      and producto_id is not distinct from (v_item ->> 'producto_id')::bigint;
    if not found then
      raise exception using message = 'Uno de los productos elegidos para canjear ya no está a la venta.', hint = 'puntos';
    end if;
    if not v_canjeable.activa then
      raise exception using message = format('"%s" no se puede canjear con puntos.', v_canjeable.nombre), hint = 'puntos';
    end if;

    if v_canjeable.tipo = 'entrada' then
      v_canjes_entrada := v_canjes_entrada + v_cant;
    end if;
    v_puntos_canje := v_puntos_canje + v_canjeable.puntos * v_cant;
  end loop;

  if v_puntos_canje > coalesce(v_perfil.puntos, 0) then
    raise exception using message = format('Querés canjear %s puntos y tenés %s.', v_puntos_canje, coalesce(v_perfil.puntos, 0)),
                          hint = 'puntos';
  end if;
  if v_combos_entrada + v_canjes_entrada > v_cant_butacas then
    raise exception using message = format('Entre combos con entrada (%s) y entradas canjeadas (%s) cubrís %s entradas, pero elegiste %s butacas.',
                                           v_combos_entrada, v_canjes_entrada, v_combos_entrada + v_canjes_entrada, v_cant_butacas),
                          hint = 'puntos';
  end if;

  -- Combos y canjes cubren una entrada general cada uno, sobre las butacas más baratas
  -- (primero los combos, después los canjes). Si la butaca es VIP, la diferencia se cobra.
  if v_combos_entrada > 0 then
    select coalesce(sum(least(precio, v_general)), 0) into v_desc_combos
    from (
      select precio_entrada(v_pelicula.id, tipo_butaca(fila, numero)) as precio
      from butacas_ocupadas
      where funcion_id = p_funcion_id and token_hash = v_hash and fila || '-' || numero = any (p_butacas)
      order by 1
      limit v_combos_entrada
    ) cubiertas;
  end if;
  if v_canjes_entrada > 0 then
    select coalesce(sum(least(precio, v_general)), 0) into v_desc_canjes
    from (
      select precio_entrada(v_pelicula.id, tipo_butaca(fila, numero)) as precio
      from butacas_ocupadas
      where funcion_id = p_funcion_id and token_hash = v_hash and fila || '-' || numero = any (p_butacas)
      order by 1
      offset v_combos_entrada
      limit v_canjes_entrada
    ) canjeadas;
  end if;

  v_base := v_sub_entradas + v_sub_candy - v_desc_combos - v_desc_canjes;

  -- 8. Cupón: uno por compra, solo registrados -------------------------
  if p_cupon is not null then
    if v_uid is null then
      raise exception using message = 'Los cupones son para usuarios registrados. Iniciá sesión para usarlos.', hint = 'cupon';
    end if;

    if p_cupon = 'primera_compra' then
      select porcentaje into v_pct from cupones_primera_compra_usuario
      where usuario_id = v_uid and not usado
      for update;
      if v_pct is null then
        raise exception using message = 'Ya usaste tu cupón de primera compra.', hint = 'cupon';
      end if;
      update cupones_primera_compra_usuario set usado = true where usuario_id = v_uid;
    elsif p_cupon = 'edad' then
      v_edad := extract(year from age(hoy_ar(), v_perfil.fecha_nacimiento))::int;
      select max(porcentaje) into v_pct from cupones_por_edad
      where activo and hoy_ar() between vigente_desde and vigente_hasta and v_edad >= edad_minima;
      if v_pct is null then
        raise exception using message = format('No hay un cupón por edad vigente para %s años.', v_edad), hint = 'cupon';
      end if;
    else
      raise exception using message = 'El cupón elegido no existe.', hint = 'cupon';
    end if;

    v_desc_cupon := round(v_base * v_pct / 100, 2);
  end if;

  -- 9. Crédito ---------------------------------------------------------
  if v_credito < 0 then
    raise exception using message = 'El crédito a usar no puede ser negativo.', hint = 'credito';
  end if;
  if v_credito > 0 then
    if v_uid is null then
      raise exception using message = 'El crédito es para usuarios registrados. Iniciá sesión para usarlo.', hint = 'credito';
    end if;
    if v_credito > v_perfil.credito then
      raise exception using message = format('Querés usar $ %s de crédito pero tenés $ %s disponibles.',
                                             round(v_credito, 2), round(v_perfil.credito, 2)), hint = 'credito';
    end if;
    if v_credito > v_base - v_desc_cupon then
      raise exception using message = format('Querés usar $ %s de crédito pero la compra con descuentos es de $ %s.',
                                             round(v_credito, 2), round(v_base - v_desc_cupon, 2)), hint = 'credito';
    end if;
    update perfiles set credito = credito - v_credito where id = v_uid;
  end if;

  -- 10. Pago (simulado) ------------------------------------------------
  v_total := v_base - v_desc_cupon - v_credito;
  if v_total > 0 and coalesce(trim(p_medio_pago), '') = '' then
    raise exception using message = format('Faltan los datos de pago para abonar $ %s.', round(v_total, 2)), hint = 'pago';
  end if;

  -- 11. Registrar la compra --------------------------------------------
  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from compras where codigo = v_codigo);
  end loop;

  -- Puntos: se descuentan los canjeados y se suma 1 por peso efectivamente abonado (HU-29)
  if v_uid is not null then
    v_puntos := floor(v_total)::int;
    update perfiles set puntos = puntos - v_puntos_canje + v_puntos where id = v_uid;
  end if;

  insert into compras (codigo, funcion_id, usuario_id, email, fecha_nacimiento,
                       subtotal_entradas, subtotal_candy, descuento_combos, descuento_canjes,
                       cupon, cupon_porcentaje, descuento_cupon, credito_usado,
                       total_pagado, medio_pago, puntos_ganados, puntos_canjeados)
  values (v_codigo, p_funcion_id, v_uid, v_email, case when v_uid is null then p_fecha_nacimiento end,
          v_sub_entradas, v_sub_candy, v_desc_combos, v_desc_canjes,
          p_cupon, v_pct, v_desc_cupon, v_credito,
          v_total, case when v_total > 0 then p_medio_pago end, v_puntos, v_puntos_canje)
  returning id into v_compra_id;

  insert into entradas (compra_id, funcion_id, fila, numero, tipo, precio)
  select v_compra_id, p_funcion_id, fila, numero, tipo_butaca(fila, numero),
         precio_entrada(v_pelicula.id, tipo_butaca(fila, numero))
  from butacas_ocupadas
  where funcion_id = p_funcion_id and token_hash = v_hash and fila || '-' || numero = any (p_butacas);

  update butacas_ocupadas
  set estado = 'vendida', vence = null, token_hash = null, compra_id = v_compra_id
  where funcion_id = p_funcion_id and token_hash = v_hash and fila || '-' || numero = any (p_butacas);

  delete from butacas_ocupadas
  where funcion_id = p_funcion_id and estado = 'reservada' and token_hash = v_hash;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if v_item ->> 'tipo' = 'producto' then
      insert into compra_items (compra_id, producto_id, nombre, cantidad, precio_unitario)
      select v_compra_id, id, nombre, (v_item ->> 'cantidad')::int, precio
      from productos_candy where id = (v_item ->> 'id')::bigint;
    else
      insert into compra_items (compra_id, combo_id, nombre, cantidad, precio_unitario)
      select v_compra_id, id, nombre, (v_item ->> 'cantidad')::int, precio
      from combos where id = (v_item ->> 'id')::bigint;
    end if;
  end loop;

  -- Canjes: quedan en el historial; los productos canjeados se retiran en el candy a $0
  for v_item in select * from jsonb_array_elements(coalesce(p_canjes, '[]'::jsonb)) loop
    select * into v_canjeable from catalogo_canjes
    where tipo = v_item ->> 'tipo'
      and producto_id is not distinct from (v_item ->> 'producto_id')::bigint;
    v_cant := (v_item ->> 'cantidad')::int;

    if v_canjeable.tipo = 'producto' then
      insert into compra_items (compra_id, producto_id, nombre, cantidad, precio_unitario)
      values (v_compra_id, v_canjeable.producto_id, v_canjeable.nombre || ' (canje)', v_cant, 0);
    end if;

    insert into canjes (usuario_id, compra_id, recompensa_id, descripcion, cantidad, puntos)
    values (v_uid, v_compra_id, v_canjeable.recompensa_id, v_canjeable.nombre,
            v_cant, v_canjeable.puntos * v_cant);
  end loop;

  update peliculas set vendidas = vendidas + v_cant_butacas where id = v_pelicula.id;

  return jsonb_build_object(
    'id', v_compra_id,
    'codigo', v_codigo,
    'email', v_email,
    'subtotal_entradas', v_sub_entradas,
    'subtotal_candy', v_sub_candy,
    'descuento_combos', v_desc_combos,
    'descuento_canjes', v_desc_canjes,
    'descuento_cupon', v_desc_cupon,
    'credito_usado', v_credito,
    'total_pagado', v_total,
    'puntos_ganados', v_puntos,
    'puntos_canjeados', v_puntos_canje
  );
end;
$$;
