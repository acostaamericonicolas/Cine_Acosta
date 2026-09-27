// HU-11: aviso de venta abierta para una película con alerta
export interface AvisoVenta {
    pelicula_id: number;
    nombre: string;
    en_preventa: boolean;
    fecha_estreno: string;
}
