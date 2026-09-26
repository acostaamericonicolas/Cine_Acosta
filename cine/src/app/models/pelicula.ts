export type EstadoPelicula = 'cartelera' | 'proximamente' | 'oculta';

export const ESTADOS: { valor: EstadoPelicula; texto: string }[] = [
    { valor: 'cartelera', texto: 'En cartelera' },
    { valor: 'proximamente', texto: 'Próximamente' },
    { valor: 'oculta', texto: 'Oculta' },
];

export interface Pelicula {
    id: number;
    nombre: string;
    sinopsis: string;
    duracion_min: number;
    imagen_url: string;
    imagen_path: string | null;
    generos: string[];
    restriccion_edad: 0 | 13 | 18;
    estado: EstadoPelicula;
    fecha_estreno: string;
    vendidas: number;
    preventa: boolean;
    precio_preventa: number | null;
}

// Columnas calculadas por la base (funciones en_preventa y venta_abierta)
export interface PeliculaConVenta extends Pelicula {
    en_preventa: boolean;
    venta_abierta: boolean;
}

export type PeliculaNueva = Omit<Pelicula, 'id' | 'vendidas'>;
