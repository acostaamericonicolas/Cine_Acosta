import { Butaca } from '../shared/sala-layout';

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
