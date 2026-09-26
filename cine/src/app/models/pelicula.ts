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
}

export type PeliculaNueva = Omit<Pelicula, 'id' | 'vendidas'>;
