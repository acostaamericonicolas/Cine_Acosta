import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { DatosValidacion } from '../models/validacion';

/**
 * Validación en la puerta y entrega del candy (09_validacion.sql).
 * La base controla todo (código inexistente, cancelado, ya usado, otra función)
 * y devuelve el motivo exacto en el mensaje del error.
 */
@Service()
export class ValidacionService {
    private supabase = inject(SupabaseService).client;

    async validarEntrada(codigo: string, funcionId: number | null): Promise<DatosValidacion> {
        const { data, error } = await this.supabase.rpc('validar_entrada', {
            p_codigo: codigo,
            p_funcion_id: funcionId,
        });
        if (error) throw new Error(error.message);
        return data as DatosValidacion;
    }

    async entregarCandy(codigo: string): Promise<DatosValidacion> {
        const { data, error } = await this.supabase.rpc('entregar_candy', { p_codigo: codigo });
        if (error) throw new Error(error.message);
        return data as DatosValidacion;
    }
}
