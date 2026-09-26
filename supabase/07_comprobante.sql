-- =====================================================================
-- HU-27: comprobante de la compra (y "Buscar mi compra" para invitados)
-- Requiere 06_canje_descuenta.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
--
-- El invitado no tiene sesión, así que las policies de compras no le devuelven
-- nada. Esta función le da su comprobante si conoce el código Y el mail de la compra.
-- El registrado dueño de la compra (o el admin) lo ve solo con el código.
-- =====================================================================

create or replace function obtener_comprobante(p_codigo text, p_email text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_compra compras;
  v_resultado jsonb;
begin
  select * into v_compra from compras where codigo = upper(trim(p_codigo));

  -- Mismo mensaje si el código no existe o si el mail no coincide:
  -- así nadie puede probar códigos para saber cuáles existen.
  -- (el coalesce importa: sin sesión, usuario_id = auth.uid() da null y el "not" no cortaría)
  if not found
     or not (coalesce(v_compra.usuario_id = auth.uid(), false)
             or es_admin()
             or lower(trim(coalesce(p_email, ''))) = v_compra.email) then
    raise exception using message = 'No encontramos una compra con ese código y ese mail. Revisá que estén bien escritos.',
                          hint = 'comprobante';
  end if;

  select jsonb_build_object(
    'codigo', v_compra.codigo,
    'estado', v_compra.estado,
    'email', v_compra.email,
    'creado_en', v_compra.creado_en,
    'subtotal_entradas', v_compra.subtotal_entradas,
    'subtotal_candy', v_compra.subtotal_candy,
    'descuento_combos', v_compra.descuento_combos,
    'descuento_canjes', v_compra.descuento_canjes,
    'descuento_cupon', v_compra.descuento_cupon,
    'credito_usado', v_compra.credito_usado,
    'total_pagado', v_compra.total_pagado,
    'medio_pago', v_compra.medio_pago,
    'puntos_ganados', v_compra.puntos_ganados,
    'puntos_canjeados', v_compra.puntos_canjeados,
    'pelicula', p.nombre,
    'restriccion_edad', p.restriccion_edad,
    'imagen_url', p.imagen_url,
    'duracion_min', p.duracion_min,
    'inicio', f.inicio,
    'formato', f.formato,
    'idioma', f.idioma,
    'sala', s.nombre,
    'entradas', coalesce((
      select jsonb_agg(jsonb_build_object('fila', e.fila, 'numero', e.numero, 'tipo', e.tipo,
                                          'precio', e.precio, 'usada_en', e.usada_en)
                       order by e.fila, e.numero)
      from entradas e where e.compra_id = v_compra.id), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad,
                                          'precio_unitario', i.precio_unitario, 'entregado_en', i.entregado_en)
                       order by i.id)
      from compra_items i where i.compra_id = v_compra.id), '[]'::jsonb)
  )
  into v_resultado
  from funciones f
  join peliculas p on p.id = f.pelicula_id
  join salas s on s.id = f.sala_id
  where f.id = v_compra.funcion_id;

  return v_resultado;
end;
$$;
