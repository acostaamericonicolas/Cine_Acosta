-- =====================================================================
-- HU-32 y HU-33: el empleado valida la entrada y entrega el candy con el código
-- Requiere 08_cancelar_compra.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
--
-- El código (o el QR, que contiene el código) sirve una sola vez para la entrada
-- y una sola vez para el candy: son independientes (HU-33).
-- Errores: message para el empleado, hint = 'validacion'.
-- =====================================================================

-- ¿El usuario logueado es empleado o admin? (el admin también puede validar)
create or replace function es_empleado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol in ('empleado', 'admin'));
$$;

-- Fecha y hora en Argentina, para los mensajes
create or replace function hora_ar(p timestamptz)
returns text
language sql
immutable
as $$
  select to_char(p at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI');
$$;

-- Datos de la compra que ve el empleado (película, función, sala, butacas, candy)
create or replace function datos_para_empleado(p_compra compras)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'codigo', p_compra.codigo,
    'pelicula', p.nombre,
    'restriccion_edad', p.restriccion_edad,
    'inicio', f.inicio,
    'formato', f.formato,
    'idioma', f.idioma,
    'sala', s.nombre,
    'butacas', coalesce((select jsonb_agg(e.fila || '-' || e.numero order by e.fila, e.numero)
                         from entradas e where e.compra_id = p_compra.id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad) order by i.id)
                       from compra_items i where i.compra_id = p_compra.id), '[]'::jsonb)
  )
  from funciones f
  join peliculas p on p.id = f.pelicula_id
  join salas s on s.id = f.sala_id
  where f.id = p_compra.funcion_id;
$$;

-- ---------------------------------------------------------------------
-- HU-32: validar la entrada en la puerta.
-- p_funcion_id: la función que controla el empleado (opcional). Si viene y el
-- código es de otra función, se rechaza.
-- Marca todas las entradas de la compra como usadas (el grupo entra junto)
-- y la compra pasa a 'usada': el código ya no sirve para entrar.
-- ---------------------------------------------------------------------
create or replace function validar_entrada(p_codigo text, p_funcion_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(trim(p_codigo));
  v_compra compras;
  v_funcion funciones;
  v_usada timestamptz;
begin
  if not es_empleado() then
    raise exception using message = 'Solo un empleado puede validar entradas.', hint = 'validacion';
  end if;

  select * into v_compra from compras where codigo = v_codigo for update;
  if not found then
    raise exception using message = format('No existe ninguna compra con el código %s. Revisá que esté bien escrito.', v_codigo),
                          hint = 'validacion';
  end if;
  if v_compra.estado = 'cancelada' then
    raise exception using message = format('La compra %s fue cancelada: el código no es válido.', v_codigo), hint = 'validacion';
  end if;

  select min(usada_en) into v_usada from entradas where compra_id = v_compra.id;
  if v_usada is not null then
    raise exception using message = format('Estas entradas ya se usaron: ingresaron el %s.', hora_ar(v_usada)), hint = 'validacion';
  end if;

  select * into v_funcion from funciones where id = v_compra.funcion_id;

  if p_funcion_id is not null and p_funcion_id <> v_funcion.id then
    raise exception using message = format('Esta entrada es para otra función: "%s" del %s en %s.',
                                           (select nombre from peliculas where id = v_funcion.pelicula_id),
                                           hora_ar(v_funcion.inicio),
                                           (select nombre from salas where id = v_funcion.sala_id)),
                          hint = 'validacion';
  end if;

  if now() > v_funcion.fin then
    raise exception using message = format('La función ya terminó (terminó el %s).', hora_ar(v_funcion.fin)), hint = 'validacion';
  end if;

  update entradas set usada_en = now() where compra_id = v_compra.id;
  update compras set estado = 'usada' where id = v_compra.id;

  return datos_para_empleado(v_compra);
end;
$$;

-- ---------------------------------------------------------------------
-- HU-33: entregar el candy. Independiente de la entrada: se puede retirar
-- antes o después de entrar, pero una sola vez.
-- ---------------------------------------------------------------------
create or replace function entregar_candy(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(trim(p_codigo));
  v_compra compras;
  v_entregado timestamptz;
begin
  if not es_empleado() then
    raise exception using message = 'Solo un empleado puede entregar el candy.', hint = 'validacion';
  end if;

  select * into v_compra from compras where codigo = v_codigo for update;
  if not found then
    raise exception using message = format('No existe ninguna compra con el código %s. Revisá que esté bien escrito.', v_codigo),
                          hint = 'validacion';
  end if;
  if v_compra.estado = 'cancelada' then
    raise exception using message = format('La compra %s fue cancelada: no hay candy para entregar.', v_codigo), hint = 'validacion';
  end if;
  if not exists (select 1 from compra_items where compra_id = v_compra.id) then
    raise exception using message = format('La compra %s no tiene candy.', v_codigo), hint = 'validacion';
  end if;

  select min(entregado_en) into v_entregado from compra_items where compra_id = v_compra.id;
  if v_entregado is not null then
    raise exception using message = format('El candy de esta compra ya se entregó el %s.', hora_ar(v_entregado)), hint = 'validacion';
  end if;

  update compra_items set entregado_en = now() where compra_id = v_compra.id;

  return datos_para_empleado(v_compra);
end;
$$;

-- El empleado elige qué función controla: las de hoy (lectura pública, no hace falta policy nueva).
