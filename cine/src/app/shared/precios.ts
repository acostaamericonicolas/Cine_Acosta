import { Precios } from '../models/sala';
import { PeliculaConVenta } from '../models/pelicula';
import { ItemCarrito, LineaEntrada } from '../models/compra';
import { TipoButaca } from './sala-layout';

// Mismo cálculo que precio_entrada() en la base. Acá es solo para mostrar:
// el precio que se cobra lo calcula confirmar_compra en Supabase.
export function precioEntrada(tipo: TipoButaca, precios: Precios, pelicula: PeliculaConVenta): number {
    if (!pelicula.en_preventa || pelicula.precio_preventa === null) return precios[tipo];
    const preventa = Number(pelicula.precio_preventa);
    return tipo === 'vip' ? preventa + (precios.vip - precios.general) : preventa;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export interface Totales {
    subtotalEntradas: number;
    subtotalCandy: number;
    combosConEntrada: number;
    descuentoCombos: number;
    descuentoCanjes: number;
    descuentoCupon: number;
    credito: number;
    total: number;
}

// Mismo cálculo que confirmar_compra en la base, solo para mostrar el resumen.
// El importe que se cobra lo calcula la base.
export function calcularTotales(
    entradas: LineaEntrada[],
    items: ItemCarrito[],
    precioGeneral: number,
    entradasCanjeadas: number,
    cuponPorcentaje: number | null,
    usarCredito: boolean,
    creditoDisponible: number,
): Totales {
    const subtotalEntradas = entradas.reduce((s, e) => s + e.precio, 0);
    const subtotalCandy = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

    // Cada combo con entrada y cada entrada canjeada con puntos cubren una entrada general,
    // sobre las butacas más baratas (primero los combos). Si la butaca es VIP, la diferencia se cobra.
    const combosConEntrada = items.filter(i => i.incluyeEntrada).reduce((s, i) => s + i.cantidad, 0);
    const cubre = (precios: number[]) => precios.reduce((s, p) => s + Math.min(p, precioGeneral), 0);
    const ordenadas = entradas.map(e => e.precio).sort((a, b) => a - b);
    const descuentoCombos = cubre(ordenadas.slice(0, combosConEntrada));
    const descuentoCanjes = cubre(ordenadas.slice(combosConEntrada, combosConEntrada + entradasCanjeadas));

    const base = subtotalEntradas + subtotalCandy - descuentoCombos - descuentoCanjes;
    const descuentoCupon = cuponPorcentaje ? redondear(base * cuponPorcentaje / 100) : 0;
    const credito = usarCredito ? redondear(Math.min(creditoDisponible, base - descuentoCupon)) : 0;

    return {
        subtotalEntradas, subtotalCandy, combosConEntrada, descuentoCombos, descuentoCanjes,
        descuentoCupon, credito,
        total: redondear(base - descuentoCupon - credito),
    };
}
