export interface ItemCombo {
    producto_id: number;
    cantidad: number;
}

export interface Combo {
    id: number;
    nombre: string;
    precio: number;
    incluye_entrada: boolean;
    activo: boolean;
    imagen_url: string | null;
    imagen_path: string | null;
}

export interface ComboConItems extends Combo {
    items: ItemCombo[];
}

export type ComboNuevo = Omit<Combo, 'id'>;

// Combo listo para mostrar en la compra: "2 × Pochoclo grande"
export interface ComboConDetalle extends Combo {
    detalle: string[];
}
