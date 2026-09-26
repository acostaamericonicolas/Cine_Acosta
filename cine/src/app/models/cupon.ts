export interface CuponPorEdad {
    id: number;
    edad_minima: number;
    porcentaje: number;
    activo: boolean;
    vigente_desde: string;
    vigente_hasta: string;
}

export type CuponPorEdadNuevo = Omit<CuponPorEdad, 'id'>;