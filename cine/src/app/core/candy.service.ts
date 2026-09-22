import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

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

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGEN_BYTES = 2 * 1024 * 1024;
const EXTENSIONES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

@Injectable({ providedIn: 'root' })
export class CandyService {
    private supabase = inject(SupabaseService).client;

    // --- Categorías ---
    async listarCategorias(): Promise<CategoriaCandy[]> {
        const { data, error } = await this.supabase.from('categorias_candy').select('*').order('orden');
        if (error) throw error;
        return data as CategoriaCandy[];
    }

    async crearCategoria(nombre: string, orden: number) {
        const { error } = await this.supabase.from('categorias_candy').insert({ nombre, orden });
        if (error) {
            if (error.code === '23505') throw new Error('Ya existe una categoría con ese nombre');
            throw error;
        }
    }

    async eliminarCategoria(id: number) {
        const { error } = await this.supabase.from('categorias_candy').delete().eq('id', id);
        if (error) {
            if (error.code === '23503') throw new Error('No se puede eliminar: tiene productos asociados.');
            throw error;
        }
    }

    // --- Productos ---
    async listarProductos(): Promise<ProductoCandy[]> {
        const { data, error } = await this.supabase.from('productos_candy').select('*').order('nombre');
        if (error) throw error;
        return data as ProductoCandy[];
    }

    async obtenerProducto(id: number): Promise<ProductoCandy> {
        const { data, error } = await this.supabase.from('productos_candy').select('*').eq('id', id).single();
        if (error) throw error;
        return data as ProductoCandy;
    }

    async crearProducto(p: ProductoNuevo) {
        const { error } = await this.supabase.from('productos_candy').insert(p);
        if (error) throw error;
    }

    async actualizarProducto(id: number, cambios: Partial<ProductoNuevo>) {
        const { data, error } = await this.supabase.from('productos_candy').update(cambios).eq('id', id).select();
        if (error) throw error;
        this.verificarPermiso(data);
    }

    async eliminarProducto(id: number) {
        const { data, error } = await this.supabase.from('productos_candy').delete().eq('id', id).select();
        if (error) {
            if (error.code === '23503') throw new Error('No se puede eliminar: el producto está en algún combo. Desactivalo en su lugar.');
            throw error;
        }
        this.verificarPermiso(data);
    }

    // --- Imágenes (mismo patrón que los pósters) ---
    async subirImagen(archivo: File): Promise<{ path: string; url: string }> {
        const ext = EXTENSIONES[archivo.type];
        if (!ext) throw new Error('Formato no permitido. Usá JPG, PNG o WebP.');
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await this.supabase.storage.from('candy').upload(path, archivo, { contentType: archivo.type });
        if (error) throw error;
        const { data } = this.supabase.storage.from('candy').getPublicUrl(path);
        return { path, url: data.publicUrl };
    }

    async eliminarImagen(path: string) {
        const { error } = await this.supabase.storage.from('candy').remove([path]);
        if (error) throw error;
    }

    private verificarPermiso(filas: unknown[] | null) {
        if (!filas || filas.length === 0) throw new Error('No tenés permiso para hacer este cambio');
    }
}