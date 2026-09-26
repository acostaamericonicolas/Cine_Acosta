import { Precios } from '../models/sala';
import { PeliculaConVenta } from '../models/pelicula';
import { TipoButaca } from './sala-layout';

// Mismo cálculo que precio_entrada() en la base. Acá es solo para mostrar:
// el precio que se cobra lo calcula confirmar_compra en Supabase.
export function precioEntrada(tipo: TipoButaca, precios: Precios, pelicula: PeliculaConVenta): number {
    if (!pelicula.en_preventa || pelicula.precio_preventa === null) return precios[tipo];
    const preventa = Number(pelicula.precio_preventa);
    return tipo === 'vip' ? preventa + (precios.vip - precios.general) : preventa;
}
