// Lo que devuelven validar_entrada y entregar_candy (HU-32, HU-33)
export interface DatosValidacion {
    codigo: string;
    pelicula: string;
    restriccion_edad: number;
    inicio: string;
    formato: string;
    idioma: string;
    sala: string;
    butacas: string[];
    items: { nombre: string; cantidad: number }[];
}

export type ModoValidacion = 'entrada' | 'candy';

// Una función de hoy para el selector del empleado
export interface FuncionDelDia {
    id: number;
    inicio: string;
    pelicula: string;
    sala: string;
}
