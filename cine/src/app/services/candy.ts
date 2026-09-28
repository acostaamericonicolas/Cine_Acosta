import { Service, inject } from '@angular/core';
import { Supabase as SupabaseService } from './supabase';
import { CategoriaCandy, ProductoCandy, ProductoNuevo } from '../models/candy';
import { verificarPermiso } from '../shared/permisos';

@Service()
export class Candy {
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

    // Para la compra: solo los que están a la venta
    async listarProductosActivos(): Promise<ProductoCandy[]> {
        const { data, error } = await this.supabase
            .from('productos_candy')
            .select('*')
            .eq('activo', true)
            .order('nombre');
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
        verificarPermiso(data);
    }

    async eliminarProducto(id: number) {
        const { data, error } = await this.supabase.from('productos_candy').delete().eq('id', id).select();
        if (error) {
            if (error.code === '23503') throw new Error('No se puede eliminar: el producto está en algún combo o ya se vendió. Desactivalo en su lugar.');
            throw error;
        }
        verificarPermiso(data);
    }

}