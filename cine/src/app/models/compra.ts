import { Butaca, TipoButaca } from '../shared/sala-layout';

// Lo que el cliente agregó del candy (HU-25)
export interface ItemCarrito {
    tipo: 'producto' | 'combo';
    id: number;
    nombre: string;
    precio: number;
    cantidad: number;
    incluyeEntrada: boolean;
}

export interface LineaEntrada {
    butaca: Butaca;
    precio: number;
}

export type Cupon = 'primera_compra' | 'edad';

// Lo que elige el cliente en el paso de pago
export interface CanjeElegido {
    tipo: 'entrada' | 'producto';
    productoId: number | null;
    cantidad: number;
}

export interface DatosPago {
    canjes: CanjeElegido[];
    cupon: Cupon | null;
    credito: number;
    email: string | null;
    medioPago: string | null;
}

// Lo que devuelve confirmar_compra
export interface ResultadoCompra {
    id: number;
    codigo: string;
    email: string;
    subtotal_entradas: number;
    subtotal_candy: number;
    descuento_combos: number;
    descuento_canjes: number;
    descuento_cupon: number;
    credito_usado: number;
    total_pagado: number;
    puntos_ganados: number;
    puntos_canjeados: number;
}

// Paso de la compra donde falló confirmar_compra (viene en error.hint)
export type PasoError = 'funcion' | 'comprador' | 'edad' | 'reserva' | 'butaca' | 'candy' | 'puntos' | 'cupon' | 'credito' | 'pago' | 'precio';

export interface ErrorCompra {
    mensaje: string;
    paso: PasoError | null;
}

// Lo que devuelve obtener_comprobante (HU-27)
export type EstadoCompra = 'vigente' | 'usada' | 'cancelada';

export interface Comprobante {
    codigo: string;
    estado: EstadoCompra;
    email: string;
    creado_en: string;
    subtotal_entradas: number;
    subtotal_candy: number;
    descuento_combos: number;
    descuento_canjes: number;
    descuento_cupon: number;
    credito_usado: number;
    total_pagado: number;
    medio_pago: string | null;
    puntos_ganados: number;
    puntos_canjeados: number;
    pelicula: string;
    restriccion_edad: number;
    imagen_url: string;
    duracion_min: number;
    inicio: string;
    formato: string;
    idioma: string;
    sala: string;
    entradas: { fila: string; numero: number; tipo: TipoButaca; precio: number; usada_en: string | null }[];
    items: { nombre: string; cantidad: number; precio_unitario: number; entregado_en: string | null }[];
}

// Una fila de "Mis compras" (HU-28)
export interface CompraResumen {
    codigo: string;
    estado: EstadoCompra;
    creado_en: string;
    total_pagado: number;
    credito_usado: number;
    puntos_ganados: number;
    puntos_canjeados: number;
    credito_devuelto: number | null;
    pelicula: string;
    imagen_url: string | null;
    inicio: string;
    sala: string;
    cantidad_entradas: number;
}

export interface ResultadoCancelacion {
    codigo: string;
    credito_acreditado: number;
    puntos_devueltos: number;
    puntos_descontados: number;
}
