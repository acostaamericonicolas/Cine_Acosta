import { Service, inject } from '@angular/core';
import { Supabase as SupabaseService } from './supabase';
import { AvisoVenta } from '../models/alerta';

// HU-11: alertas de apertura de venta (12_resenas_alertas.sql). Sin mails: el aviso es dentro de la app.
@Service()
export class Alertas {
    private supabase = inject(SupabaseService).client;

    // Ids de las películas con alerta activa (la policy devuelve solo las del usuario)
    async misAlertas(): Promise<number[]> {
        const { data, error } = await this.supabase.from('alertas_venta').select('pelicula_id');
        if (error) throw error;
        return (data as { pelicula_id: number }[]).map(a => a.pelicula_id);
    }

    async activar(peliculaId: number) {
        const { error } = await this.supabase.from('alertas_venta').insert({ pelicula_id: peliculaId });
        if (error && error.code !== '23505') throw error;   // 23505: ya estaba activada
    }

    async desactivar(peliculaId: number) {
        const { error } = await this.supabase.from('alertas_venta').delete().eq('pelicula_id', peliculaId);
        if (error) throw error;
    }

    // Películas con alerta cuya venta ya abrió; la base las marca como avisadas (se muestran una vez)
    async avisosPendientes(): Promise<AvisoVenta[]> {
        const { data, error } = await this.supabase.rpc('avisos_venta_abierta');
        if (error) throw error;
        return data as AvisoVenta[];
    }
}
