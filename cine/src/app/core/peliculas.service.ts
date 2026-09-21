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
    imagen_path: string | null;
    generos: string[];
    restriccion_edad: 0 | 13 | 18;
    estado: EstadoPelicula;
    fecha_estreno: string;
    vendidas: number;
}

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGEN_BYTES = 2 * 1024 * 1024; // 2 MB

const EXTENSIONES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

export type PeliculaNueva = Omit<Pelicula, 'id' | 'vendidas'>;

@Injectable({ providedIn: 'root' })
export class PeliculasService {
    private supabase = inject(SupabaseService).client;

    async subirPoster(archivo: File): Promise<{ path: string; url: string }> {
        const ext = EXTENSIONES[archivo.type];
        if (!ext) throw new Error('Formato no permitido. Usá JPG, PNG o WebP.');

        // Nombre único: evita pisar archivos y problemas con caracteres raros
        const path = `${crypto.randomUUID()}.${ext}`;

        const { error } = await this.supabase.storage
            .from('posters')
            .upload(path, archivo, { contentType: archivo.type });
        if (error) throw error;

        // Supabase arma la URL pública a partir del nombre del archivo
        const { data } = this.supabase.storage.from('posters').getPublicUrl(path);
        return { path, url: data.publicUrl };
    }

    async eliminarPoster(path: string) {
        const { error } = await this.supabase.storage.from('posters').remove([path]);
        if (error) throw error;
    }

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

    //Trae solo las películas en cartelera, ordenadas de más a menos vendidas y, si empatan, por nombre. Para quien no inició sesión ya funciona, porque la policy de select que creamos permite ver las películas visibles.

    async listarCartelera(): Promise<Pelicula[]> {
        const { data, error } = await this.supabase
            .from('peliculas')
            .select('*')
            .eq('estado', 'cartelera')
            .order('vendidas', { ascending: false })
            .order('nombre');
        if (error) throw error;
        return data as Pelicula[];
    }
}