import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type EstadoPelicula = 'cartelera' | 'proximamente' | 'oculta';

export const ESTADOS: { valor: EstadoPelicula; texto: string }[] = [
    { valor: 'cartelera', texto: 'En cartelera' },
    { valor: 'proximamente', texto: 'Próximamente' },
    { valor: 'oculta', texto: 'Oculta' },
];

export interface Pelicula {
    id: number;
    nombre: string;
    sinopsis: string;
    duracion_min: number;
    imagen_url: string;
    generos: string[];
    restriccion_edad: 0 | 13 | 18;
    estado: EstadoPelicula;
    fecha_estreno: string;
    vendidas: number;
}

export type PeliculaNueva = Omit<Pelicula, 'id' | 'vendidas'>;

@Injectable({ providedIn: 'root' })
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
        if (error) throw error;
        this.verificarPermiso(data);
    }

    async eliminar(id: number) {
        const { data, error } = await this.supabase
            .from('peliculas')
            .delete()
            .eq('id', id)
            .select();
        if (error) throw error;
        this.verificarPermiso(data);
    }

    // Si una policy bloquea el cambio, Supabase no da error: simplemente no toca ninguna fila
    private verificarPermiso(filas: unknown[] | null) {
        if (!filas || filas.length === 0) {
            throw new Error('No tenés permiso para hacer este cambio');
        }
    }
}