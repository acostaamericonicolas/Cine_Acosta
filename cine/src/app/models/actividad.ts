// Una fila del log de actividad (HU-37)
export interface Actividad {
    id: number;
    creado_en: string;
    usuario: string;
    accion: string;
    detalle: string;
    tabla: string;
}
