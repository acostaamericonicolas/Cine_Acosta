import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Actividad } from '../models/actividad';

// HU-37: el log lo escriben los triggers de la base (11_actividad.sql); acá solo se consulta
@Service()
export class ActividadService {
    private supabase = inject(SupabaseService).client;

    // desde / hasta: 'AAAA-MM-DD' en horario local. Las últimas 300 del rango, más nuevas primero.
    async listar(desde: string, hasta: string): Promise<Actividad[]> {
        const [a, m, d] = hasta.split('-').map(Number);
        const { data, error } = await this.supabase
            .from('actividad')
            .select('id, creado_en, usuario, accion, detalle, tabla')
            .gte('creado_en', new Date(`${desde}T00:00`).toISOString())
            .lt('creado_en', new Date(a, m - 1, d + 1).toISOString())
            .order('creado_en', { ascending: false })
            .limit(300);
        if (error) throw error;
        return data as Actividad[];
    }
}
