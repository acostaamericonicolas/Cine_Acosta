import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type Formato = '2D' | '3D' | '4D' | '5D';
export type Idioma = 'castellano' | 'subtitulada';

export interface Funcion {
    id: number;
    pelicula_id: number;
    inicio: string;
    formato: Formato;
    idioma: Idioma;
}

@Injectable({ providedIn: 'root' })
export class FuncionesService {
    private supabase = inject(SupabaseService).client;

    // Solo funciones futuras, en orden cronológico
    async listarProximas(peliculaId: number): Promise<Funcion[]> {
        const { data, error } = await this.supabase
            .from('funciones')
            .select('*')
            .eq('pelicula_id', peliculaId)
            .gte('inicio', new Date().toISOString())
            .order('inicio');
        if (error) throw error;
        return data as Funcion[];
    }
}