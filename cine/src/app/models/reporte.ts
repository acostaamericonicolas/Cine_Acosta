// HU-35: una fila por día
export interface VentaDiaria {
    fecha: string;
    compras: number;
    entradas: number;
    unidades_candy: number;
    facturado: number;
    credito_usado: number;
}

// HU-36: una barra del gráfico
export interface Barra {
    nombre: string;
    valor: number;
}
