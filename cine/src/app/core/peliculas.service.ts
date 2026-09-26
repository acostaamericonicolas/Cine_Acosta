import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Pelicula, PeliculaConVenta, PeliculaNueva } from '../models/pelicula';

@Service()
export class PeliculasService {
    private supabase = inject(SupabaseService).client;

    async listar(): Promise<Pelicula[]> {
        const { data, error } = await this.supabase
            .from('peliculas')
            .select('*')
            .order('nombre');
        if (error) throw error;
        return data as Pelicula[];
    }

    async obtener(id: number): Promise<Pelicula> {
        const { data, error } = await this.supabase
            .from('peliculas')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Pelicula;
    }

    // en_preventa y venta_abierta las calcula la base con la fecha de hoy (ver 01_preventa.sql)
    async obtenerConVenta(id: number): Promise<PeliculaConVenta> {
        const { data, error } = await this.supabase
            .from('peliculas')
            .select('*, en_preventa, venta_abierta')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as PeliculaConVenta;
    }

    async crear(pelicula: PeliculaNueva) {
        const { error } = await this.supabase.from('peliculas').insert(pelicula);
        if (error) throw error;
    }

    async actualizar(id: number, cambios: Partial<PeliculaNueva>) {
        const { data, error } = await this.supabase
            .from('peliculas')
            .update(cambios)
            .eq('id', id)
            .select();
        if (error) {
            // 23P01 = exclusion_violation: el nuevo fin de la película pisaría otra función
            if (error.code === '23P01') {
                throw new Error('No se puede cambiar la duración: alguna función programada quedaría a menos de 30 minutos de la siguiente en su sala.');
            }
            throw error;
        }
        this.verificarPermiso(data);
    }

    async eliminar(id: number) {
        const { data, error } = await this.supabase
            .from('peliculas')
            .delete()
            .eq('id', id)
            .select();
        if (error) {
            // 23503 = violación de clave foránea (la película tiene funciones asociadas)
            if (error.code === '23503') {
                throw new Error('No se puede eliminar: la película tiene funciones o reseñas asociadas. Ocultala en su lugar.');
            }
            throw error;
        }
        this.verificarPermiso(data);
    }

    // Si una policy bloquea el cambio, Supabase no da error: simplemente no toca ninguna fila
    private verificarPermiso(filas: unknown[] | null) {
        if (!filas || filas.length === 0) {
            throw new Error('No tenés permiso para hacer este cambio');
        }
    }

    // Cartelera de la home: las que hoy tienen la venta abierta, o sea las "en cartelera"
    // y las "próximamente" que ya están en preventa (venta_abierta la calcula la base).
    // Ordenadas de más a menos vendidas y, si empatan, por nombre. Funciona sin sesión
    // porque la policy de select deja ver las películas visibles.
    async listarCartelera(): Promise<PeliculaConVenta[]> {
        const { data, error } = await this.supabase
            .from('peliculas')
            .select('*, en_preventa, venta_abierta')
            .eq('venta_abierta', true)
            .order('vendidas', { ascending: false })
            .order('nombre');
        if (error) throw error;
        return data as PeliculaConVenta[];
    }
}