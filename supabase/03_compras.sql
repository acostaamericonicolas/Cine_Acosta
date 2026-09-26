-- =====================================================================
-- HU-24, HU-25 y HU-26: compras, entradas, candy y confirmar_compra
-- Requiere 01_preventa.sql y 02_butacas_ocupadas.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Una compra = una función + sus entradas + su candy, con un código único.
create table if not exists compras (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  funcion_id bigint not null references funciones (id) on delete restrict,  -- no se borra una función con ventas
  usuario_id uuid references auth.users (id) on delete set null,          -- null = comprador anónimo
  email text not null,
  fecha_nacimiento date,                                                  -- la que declaró el anónimo (HU-24)
  subtotal_entradas numeric(10, 2) not null,
  subtotal_candy numeric(10, 2) not null default 0,
  descuento_combos numeric(10, 2) not null default 0,                     -- entradas cubiertas por combos
  cupon text check (cupon in ('primera_compra', 'edad')),
  cupon_porcentaje numeric(5, 2),
  descuento_cupon numeric(10, 2) not null default 0,
  credito_usado numeric(10, 2) not null default 0,
  total_pagado numeric(10, 2) not null check (total_pagado >= 0),
  medio_pago text,
  puntos_ganados int not null default 0,
  estado text not null default 'vigente' check (estado in ('vigente', 'usada', 'cancelada')),
  creado_en timestamptz not null default now()
);

create table if not exists entradas (
  id bigint generated always as identity primary key,
  compra_id bigint not null references compras (id) on delete cascade,
  funcion_id bigint not null references funciones (id) on delete restrict,
  fila text not null,
  numero int not null,
  tipo text not null check (tipo in ('general', 'accesible', 'vip')),
  precio numeric(10, 2) not null,
  usada_en timestamptz          -- la completa el empleado al validar (HU-32)
);

-- Candy de la compra. Guarda nombre y precio del momento: si después cambian, la compra no se altera.
create table if not exists compra_items (
  id bigint generated always as identity primary key,
  compra_id bigint not null references compras (id) on delete cascade,
  producto_id bigint references productos_candy (id) on delete restrict,
  combo_id bigint references combos (id) on delete restrict,
  nombre text not null,
  cantidad int not null check (cantidad between 1 and 20),
  precio_unitario numeric(10, 2) not null,
  entregado_en timestamptz,     -- la completa el empleado al entregar (HU-33)
  constraint compra_items_producto_o_combo check ((producto_id is null) <> (combo_id is null))
);

-- La butaca vendida queda ligada a su compra (para liberarla si se cancela, HU-28)
alter table butacas_ocupadas
  add column if not exists compra_id bigint references compras (id) on delete cascade;

-- ---------------------------------------------------------------------
-- RLS: cada uno ve sus compras; el admin ve todas. Nadie inserta directo:
-- solo confirmar_compra (security definer) escribe en estas tablas.
-- ---------------------------------------------------------------------
alter table compras enable row level security;
alter table entradas enable row level security;
alter table compra_items enable row level security;

drop policy if exists "ver mis compras" on compras;
create policy "ver mis compras" on compras
  for select using (usuario_id = auth.uid() or es_admin());

drop policy if exists "ver mis entradas" on entradas;
create policy "ver mis entradas" on entradas
  for select using (exists (select 1 from compras c
                            where c.id = compra_id and (c.usuario_id = auth.uid() or es_admin())));

drop policy if exists "ver mi candy" on compra_items;
create policy "ver mi candy" on compra_items
  for select using (exists (select 1 from compras c
                            where c.id = compra_id and (c.usuario_id = auth.uid() or es_admin())));

-- ---------------------------------------------------------------------
-- HU-17: una función con entradas vendidas no se puede mover de horario ni de sala.
-- (Borrarla ya lo impide la FK de compras con on delete restrict.)
-- ---------------------------------------------------------------------
create or replace function bloquear_funcion_con_ventas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.inicio, new.sala_id, new.pelicula_id) is distinct from (old.inicio, old.sala_id, old.pelicula_id)
     and exists (select 1 from compras where funcion_id = old.id and estado <> 'cancelada') then
    raise exception using message = 'No se puede modificar: la función ya tiene entradas vendidas.', hint = 'funcion';
  end if;
  return new;
end;
$$;

drop trigger if exists funciones_bloquear_con_ventas on funciones;
create trigger funciones_bloquear_con_ventas
  before update on funciones
  for each row execute function bloquear_funcion_con_ventas();

-- ---------------------------------------------------------------------
-- confirmar_compra: todo en una transacción. Si algo falla no queda nada a medias.
--
-- Cada error trae:
--   message → qué falló, para mostrarle al usuario tal cual
--   hint    → en qué paso: funcion, comprador, edad, reserva, candy, cupon, credito, pago
--
-- p_items: [{"tipo": "producto" | "combo", "id": 1, "cantidad": 2}, ...]
-- ---------------------------------------------------------------------
create or replace function confirmar_compra(
  p_funcion_id bigint,
  p_token uuid,
  p_butacas text[],                 -- ['J-10', 'J-11']
  p_items jsonb default '[]',
  p_cupon text default null,        -- null, 'primera_compra' o 'edad'
  p_credito numeric default 0,
  p_email text default null,        -- solo anónimos
  p_fecha_nacimiento date default null,  -- solo anónimos
  p_medio_pago text default null    -- obligatorio si queda algo por pagar
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

  -- 4. Reservas: cada butaca tiene que seguir reservada por este navegador --
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

  -- Cada combo con entrada cubre una entrada general: se descuenta su valor
  -- (si la butaca es VIP, la diferencia se sigue cobrando). Se cubren las más baratas.
  if v_combos_entrada > v_cant_butacas then
    raise exception using message = format('Elegiste %s combos que incluyen entrada, pero solo %s butacas. Sacá combos o sumá butacas.',
                                           v_combos_entrada, v_cant_butacas), hint = 'candy';
  end if;
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

  v_base := v_sub_entradas + v_sub_candy - v_desc_combos;

  -- 7. Cupón: uno por compra, solo registrados -------------------------
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

  -- 8. Crédito: solo registrados, hasta su saldo y hasta el total ------
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

  -- 9. Pago (simulado) -------------------------------------------------
  v_total := v_base - v_desc_cupon - v_credito;
  if v_total > 0 and coalesce(trim(p_medio_pago), '') = '' then
    raise exception using message = format('Faltan los datos de pago para abonar $ %s.', round(v_total, 2)), hint = 'pago';
  end if;

  -- 10. Registrar la compra --------------------------------------------
  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from compras where codigo = v_codigo);
  end loop;

  -- HU-29: 1 punto por peso efectivamente abonado, solo registrados
  if v_uid is not null then
    v_puntos := floor(v_total)::int;
    update perfiles set puntos = puntos + v_puntos where id = v_uid;
  end if;

  insert into compras (codigo, funcion_id, usuario_id, email, fecha_nacimiento,
                       subtotal_entradas, subtotal_candy, descuento_combos,
                       cupon, cupon_porcentaje, descuento_cupon, credito_usado,
                       total_pagado, medio_pago, puntos_ganados)
  values (v_codigo, p_funcion_id, v_uid, v_email, case when v_uid is null then p_fecha_nacimiento end,
          v_sub_entradas, v_sub_candy, v_desc_combos,
          p_cupon, v_pct, v_desc_cupon, v_credito,
          v_total, case when v_total > 0 then p_medio_pago end, v_puntos)
  returning id into v_compra_id;

  insert into entradas (compra_id, funcion_id, fila, numero, tipo, precio)
  select v_compra_id, p_funcion_id, fila, numero, tipo_butaca(fila, numero),
         precio_entrada(v_pelicula.id, tipo_butaca(fila, numero))
  from butacas_ocupadas
  where funcion_id = p_funcion_id and token_hash = v_hash and fila || '-' || numero = any (p_butacas);

  -- Las butacas pasan a vendidas (Realtime avisa el UPDATE a todos los mapas abiertos)
  update butacas_ocupadas
  set estado = 'vendida', vence = null, token_hash = null, compra_id = v_compra_id
  where funcion_id = p_funcion_id and token_hash = v_hash and fila || '-' || numero = any (p_butacas);

  -- Si quedó alguna otra reserva de este navegador en la función, se suelta
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

  -- Ranking de la home (HU-07)
  update peliculas set vendidas = vendidas + v_cant_butacas where id = v_pelicula.id;

  return jsonb_build_object(
    'id', v_compra_id,
    'codigo', v_codigo,
    'email', v_email,
    'subtotal_entradas', v_sub_entradas,
    'subtotal_candy', v_sub_candy,
    'descuento_combos', v_desc_combos,
    'descuento_cupon', v_desc_cupon,
    'credito_usado', v_credito,
    'total_pagado', v_total,
    'puntos_ganados', v_puntos
  );
end;
$$;
