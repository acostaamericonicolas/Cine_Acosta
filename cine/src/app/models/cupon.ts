export interface CuponPorEdad {
    id: number;
    edad_minima: number;
    porcentaje: number;
    activo: boolean;
    vigente_desde: string;
    vigente_hasta: string;
}

export type CuponPorEdadNuevo = Omit<CuponPorEdad, 'id'>;

export interface CuponPrimeraCompra {
    usuario_id: string;
    porcentaje: number;
    usado: boolean;
    asignado_en: string;
}
