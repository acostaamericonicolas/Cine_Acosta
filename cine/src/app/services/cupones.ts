import { Service, inject } from '@angular/core';
import { Supabase as SupabaseService } from './supabase';
import { CuponPorEdad, CuponPorEdadNuevo, CuponPrimeraCompra } from '../models/cupon';
import { verificarPermiso } from '../shared/permisos';
import { fechaLocal } from '../shared/fechas';

@Service()
export class Cupones {
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

    // La policy solo devuelve el cupón del propio usuario
    async obtenerCuponPrimeraCompra(usuarioId: string): Promise<CuponPrimeraCompra | null> {
        const { data, error } = await this.supabase
            .from('cupones_primera_compra_usuario')
            .select('*')
            .eq('usuario_id', usuarioId)
            .maybeSingle();
        if (error) throw error;
        return data as CuponPrimeraCompra | null;
    }

    async actualizarPorcentajePrimeraCompra(porcentaje: number) {
        const { data, error } = await this.supabase
            .from('config_cupon_primera_compra')
            .update({ porcentaje })
            .eq('id', 1)
            .select();
        if (error) throw error;
        verificarPermiso(data);
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

    /**
     * Cupones por edad que HOY le corresponden a alguien de esa edad: activos, dentro de
     * la vigencia y con la edad mínima alcanzada, del mayor porcentaje al menor.
     * Misma regla que usa confirmar_compra en la base. El perfil los lista; la compra usa el primero.
     */
    async vigentesParaEdad(edad: number): Promise<CuponPorEdad[]> {
        const hoy = fechaLocal();
        const { data, error } = await this.supabase
            .from('cupones_por_edad')
            .select('*')
            .eq('activo', true)
            .lte('vigente_desde', hoy)
            .gte('vigente_hasta', hoy)
            .lte('edad_minima', edad)
            .order('porcentaje', { ascending: false });
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
        verificarPermiso(data);
    }

    async eliminarPorEdad(id: number) {
        const { data, error } = await this.supabase.from('cupones_por_edad').delete().eq('id', id).select();
        if (error) throw error;
        verificarPermiso(data);
    }
}