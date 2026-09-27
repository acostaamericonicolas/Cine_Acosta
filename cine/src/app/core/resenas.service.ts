import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Resena } from '../models/resena';

@Service()
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

    // HU-10: la reseña del usuario para esa película, si ya calificó
    async miResena(peliculaId: number, usuarioId: string): Promise<Resena | null> {
        const { data, error } = await this.supabase
            .from('resenas')
            .select('*')
            .eq('pelicula_id', peliculaId)
            .eq('usuario_id', usuarioId)
            .maybeSingle();
        if (error) throw error;
        return data as Resena | null;
    }

    /**
     * HU-10: ¿puede calificar? Solo quien compró una entrada, después de que terminó
     * su función, y una sola vez. La regla está en la base (puede_resenar); si no puede,
     * devuelve el motivo para mostrarlo tal cual.
     */
    async puedeResenar(peliculaId: number): Promise<{ puede: boolean; motivo: string | null }> {
        const { data, error } = await this.supabase.rpc('puede_resenar', { p_pelicula_id: peliculaId });
        if (error) throw error;
        return data as { puede: boolean; motivo: string | null };
    }

    // Solo alta: la calificación es única y no se edita. El usuario y el nombre los completa la base.
    async publicar(peliculaId: number, estrellas: number, comentario: string) {
        const { error } = await this.supabase.from('resenas').insert({ pelicula_id: peliculaId, estrellas, comentario });
        if (error) {
            if (error.code === '23505') throw new Error('Ya calificaste esta película. La calificación es una sola vez.');
            throw new Error(error.message);   // el trigger explica el motivo (no compró, la función no terminó...)
        }
    }

    // HU-12: mis calificaciones, por película
    async misCalificaciones(usuarioId: string): Promise<Map<number, number>> {
        const { data, error } = await this.supabase
            .from('resenas')
            .select('pelicula_id, estrellas')
            .eq('usuario_id', usuarioId);
        if (error) throw error;
        return new Map((data as { pelicula_id: number; estrellas: number }[]).map(r => [r.pelicula_id, r.estrellas]));
    }
}
