import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CuponPorEdad {
    id: number;
    edad_minima: number;
    porcentaje: number;
    activo: boolean;
    vigente_desde: string;
    vigente_hasta: string;
}

export type CuponPorEdadNuevo = Omit<CuponPorEdad, 'id'>;

@Injectable({ providedIn: 'root' })
export class CuponesService {
    private supabase = inject(SupabaseService).client;

    // --- Primera compra ---
    async obtenerPorcentajePrimeraCompra(): Promise<number> {
        const { data, error } = await this.supabase
            .from('config_cupon_primera_compra')
            .select('porcentaje')
            .eq('id', 1)
            .single();
        if (error) throw error;
        return Number((data as { porcentaje: number }).porcentaje);
    }

    async actualizarPorcentajePrimeraCompra(porcentaje: number) {
        const { data, error } = await this.supabase
            .from('config_cupon_primera_compra')
            .update({ porcentaje })
            .eq('id', 1)
            .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
    }

    // --- Por edad ---
    async listarPorEdad(): Promise<CuponPorEdad[]> {
        const { data, error } = await this.supabase
            .from('cupones_por_edad')
            .select('*')
            .order('edad_minima');
        if (error) throw error;
        return data as CuponPorEdad[];
    }

    async crearPorEdad(datos: CuponPorEdadNuevo) {
        const { error } = await this.supabase.from('cupones_por_edad').insert(datos);
        if (error) throw error;
    }

    async actualizarActivoPorEdad(id: number, activo: boolean) {
        const { data, error } = await this.supabase
            .from('cupones_por_edad')
            .update({ activo })
            .eq('id', id)
            .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
    }

    async eliminarPorEdad(id: number) {
        const { data, error } = await this.supabase.from('cupones_por_edad').delete().eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
    }
}