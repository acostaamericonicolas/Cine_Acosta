export type EstadoOcupacion = 'reservada' | 'vendida';

export interface ButacaOcupada {
    funcion_id: number;
    fila: string;
    numero: number;
    estado: EstadoOcupacion;
    vence: string | null;
    token_hash: string | null;
}
