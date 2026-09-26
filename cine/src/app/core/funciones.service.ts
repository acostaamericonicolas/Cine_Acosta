import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SalasService } from './salas.service';
import { DatosFuncion, Funcion } from '../models/funcion';

@Service()
export class FuncionesService {
    private supabase = inject(SupabaseService).client;
    private salasService = inject(SalasService);

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

    async listarPorRango(desde: string, hasta: string): Promise<Funcion[]> {
        const { data, error } = await this.supabase
            .from('funciones')
            .select('*')
            .gte('inicio', desde)
            .lt('inicio', hasta)
            .order('inicio');
        if (error) throw error;
        return data as Funcion[];
    }

    /**
     * Prueba las salas activas en orden y devuelve la función creada en la
     * primera que no choque con otra (constraint sin_solapamiento_en_sala).
     * Si ninguna sala tiene lugar, lanza un error.
     */
    async crearConAsignacionAutomatica(datos: DatosFuncion): Promise<Funcion> {
        const salas = await this.salasService.listarActivas();
        if (salas.length === 0) throw new Error('No hay salas activas para asignar.');

        for (const sala of salas) {
            const { data, error } = await this.supabase
                .from('funciones')
                .insert({ ...datos, sala_id: sala.id })
                .select()
                .single();

            if (!error) return data as Funcion;

            // 23P01 = exclusion_violation: esta sala ya tiene algo en ese horario. Probamos la siguiente.
            if (error.code !== '23P01') throw error;
        }

        throw new Error('No hay ninguna sala libre en ese horario. Elegí otro horario.');
    }

    async obtener(id: number): Promise<Funcion> {
        const { data, error } = await this.supabase.from('funciones').select('*').eq('id', id).single();
        if (error) throw error;
        return data as Funcion;
    }

    async actualizar(id: number, datos: Partial<DatosFuncion> & { sala_id: number }): Promise<Funcion> {
        const { data, error } = await this.supabase
            .from('funciones')
            .update(datos)
            .eq('id', id)
            .select();

        if (error) {
            // 23P01 = exclusion_violation: se pisa con otra función en esa sala
            if (error.code === '23P01') {
                throw new Error('Ese horario se superpone con otra función en la sala elegida. Dejá al menos 30 minutos de margen.');
            }
            throw error;
        }
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
        return data[0] as Funcion;
    }

    async eliminar(id: number) {
        // TODO (HU-27): bloquear si la función tiene entradas vendidas, cuando exista esa tabla.
        const { data, error } = await this.supabase.from('funciones').delete().eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
    }

}