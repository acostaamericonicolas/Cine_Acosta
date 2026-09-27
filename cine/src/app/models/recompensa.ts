export type TipoRecompensa = 'entrada' | 'producto';

// Una fila de la vista catalogo_canjes: todo lo que se puede canjear y su costo en puntos.
// Por defecto el costo es el precio en pesos (1 peso = 1 punto); el admin puede fijar otro.
export interface ItemCanjeable {
    tipo: TipoRecompensa;
    producto_id: number | null;   // null = entrada general
    nombre: string;
    precio: number;
    puntos: number;
    personalizado: boolean;       // true = el admin fijó los puntos a mano
    activa: boolean;              // false = el admin desactivó el canje de este ítem
    recompensa_id: number | null; // fila de recompensas con la excepción, si hay
}

export interface Canje {
    id: number;
    compra_id: number | null;
    descripcion: string;
    cantidad: number;
    puntos: number;
    devuelto: boolean;    // la compra se canceló y los puntos volvieron
    creado_en: string;
}
