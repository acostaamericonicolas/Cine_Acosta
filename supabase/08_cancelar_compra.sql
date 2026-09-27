-- =====================================================================
-- HU-28: cancelar una compra hasta 2 horas antes de la función
-- Requiere 07_comprobante.sql.
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin errores.
--
-- No se devuelve dinero (RF-26): lo pagado vuelve como crédito de la cuenta.
--   crédito acreditado = total pagado + crédito que se había usado
--   puntos: se devuelven los canjeados y se restan los ganados con esa compra
--   el cupón usado NO se devuelve
-- Las butacas quedan libres (Realtime avisa a los mapas abiertos) y el código deja de valer.
-- =====================================================================

alter table compras
  add column if not exists cancelada_en timestamptz,
  add column if not exists credito_devuelto numeric(10, 2);

-- En el historial del perfil, el canje de una compra cancelada figura como devuelto
alter table canjes
  add column if not exists devuelto boolean not null default false;

-- ---------------------------------------------------------------------
-- cancelar_compra: solo el dueño registrado. Todo en una transacción.
-- Errores con message para el usuario y hint = 'cancelacion'.
-- ---------------------------------------------------------------------
create or replace function cancelar_compra(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_compra compras;
  v_funcion funciones;
  v_perfil perfiles;
  v_limite timestamptz;
  v_credito numeric;
  v_neto int;            -- puntos a restar: ganados - canjeados (si es negativo, se suman)
  v_cant_entradas int;
begin
  if v_uid is null then
    raise exception using message = 'Iniciá sesión para cancelar una compra.', hint = 'cancelacion';
  end if;

  select * into v_compra from compras where codigo = upper(trim(p_codigo)) for update;
  if not found or v_compra.usuario_id is distinct from v_uid then
    raise exception using message = 'No encontramos esa compra entre las tuyas.', hint = 'cancelacion';
  end if;

  if v_compra.estado = 'cancelada' then
    raise exception using message = 'Esta compra ya está cancelada.', hint = 'cancelacion';
  end if;
  if v_compra.estado = 'usada'
     or exists (select 1 from entradas where compra_id = v_compra.id and usada_en is not null)
     or exists (select 1 from compra_items where compra_id = v_compra.id and entregado_en is not null) then
    raise exception using message = 'No se puede cancelar: ya se usó una entrada o se retiró el candy de esta compra.',
                          hint = 'cancelacion';
  end if;

  select * into v_funcion from funciones where id = v_compra.funcion_id;
  v_limite := v_funcion.inicio - interval '2 hours';
  if now() >= v_limite then
    raise exception using message = format('Solo se puede cancelar hasta 2 horas antes de la función (hasta el %s hs).',
                                           to_char(v_limite at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI')),
                          hint = 'cancelacion';
  end if;

  -- Puntos: si ya gastó los que le dio esta compra, cancelar le regalaría puntos
  select * into v_perfil from perfiles where id = v_uid for update;
  v_neto := v_compra.puntos_ganados - v_compra.puntos_canjeados;
  if v_neto > v_perfil.puntos then
    raise exception using message = format('No se puede cancelar: esta compra te dio %s puntos y ya usaste parte (te quedan %s).',
                                           v_compra.puntos_ganados, v_perfil.puntos),
                          hint = 'cancelacion';
  end if;

  v_credito := v_compra.total_pagado + v_compra.credito_usado;

  update perfiles
  set credito = credito + v_credito,
      puntos = puntos - v_neto
  where id = v_uid;

  update compras
  set estado = 'cancelada', cancelada_en = now(), credito_devuelto = v_credito
  where id = v_compra.id;

  update canjes set devuelto = true where compra_id = v_compra.id;

  -- Butacas libres para otros (Realtime manda el DELETE a los mapas abiertos)
  select count(*) into v_cant_entradas from entradas where compra_id = v_compra.id;
  delete from butacas_ocupadas where compra_id = v_compra.id;

  -- Ranking de la home: esas entradas ya no cuentan como vendidas
  update peliculas set vendidas = greatest(vendidas - v_cant_entradas, 0) where id = v_funcion.pelicula_id;

  return jsonb_build_object(
    'codigo', v_compra.codigo,
    'credito_acreditado', v_credito,
    'puntos_devueltos', v_compra.puntos_canjeados,
    'puntos_descontados', v_compra.puntos_ganados
  );
end;
$$;

-- El comprobante de una compra cancelada tiene que decirlo: obtener_comprobante ya
-- devuelve 'estado'. La validación en la puerta (HU-32) rechaza los códigos cancelados.
