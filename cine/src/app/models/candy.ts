export interface CategoriaCandy {
    id: number;
    nombre: string;
    orden: number;
}

export interface ProductoCandy {
    id: number;
    categoria_id: number;
    nombre: string;
    precio: number;
    imagen_url: string | null;
    imagen_path: string | null;
    activo: boolean;
}

export type ProductoNuevo = Omit<ProductoCandy, 'id'>;
