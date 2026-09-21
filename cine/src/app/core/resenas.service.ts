import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Resena {
    id: number;
    pelicula_id: number;
    autor: string;
    estrellas: number;
    comentario: string;
    creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class ResenasService {
    private supabase = inject(SupabaseService).client;

    async listarPorPelicula(peliculaId: number): Promise<Resena[]> {
        const { data, error } = await this.supabase
            .from('resenas')
            .select('*')
            .eq('pelicula_id', peliculaId)
            .order('creado_en', { ascending: false });
        if (error) throw error;
        return data as Resena[];
    }
}