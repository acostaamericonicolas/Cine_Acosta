export type Formato = '2D' | '3D' | '4D' | '5D';
export type Idioma = 'castellano' | 'subtitulada';

export const FORMATOS: Formato[] = ['2D', '3D', '4D', '5D'];

export const IDIOMAS: { valor: Idioma; texto: string }[] = [
    { valor: 'castellano', texto: 'Castellano' },
    { valor: 'subtitulada', texto: 'Subtitulada' },
];

export interface Funcion {
    id: number;
    pelicula_id: number;
    sala_id: number;
    inicio: string;
    fin: string;
    formato: Formato;
    idioma: Idioma;
}

export interface DatosFuncion {
    pelicula_id: number;
    inicio: string;   // ISO, ya en UTC
    formato: Formato;
    idioma: Idioma;
}
