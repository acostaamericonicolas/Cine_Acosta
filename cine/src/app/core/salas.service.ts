import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TipoButaca } from '../shared/sala-layout';

export interface Sala {
    id: number;
    nombre: string;
    activa: boolean;
}

export type Precios = Record<TipoButaca, number>;

@Injectable({ providedIn: 'root' })
export class SalasService {
    private supabase = inject(SupabaseService).client;

    async listar(): Promise<Sala[]> {
        const { data, error } = await this.supabase.from('salas').select('*').order('nombre');
        if (error) throw error;
        return data as Sala[];
    }

    async obtener(id: number): Promise<Sala> {
        const { data, error } = await this.supabase.from('salas').select('*').eq('id', id).single();
        if (error) throw error;
        return data as Sala;
    }

    async crear(nombre: string) {
        const { error } = await this.supabase.from('salas').insert({ nombre });
        if (error) {
            if (error.code === '23505') throw new Error('Ya existe una sala con ese nombre');
            throw error;
        }
    }

    async cambiarActiva(id: number, activa: boolean) {
        const { data, error } = await this.supabase
            .from('salas')
            .update({ activa })
            .eq('id', id)
            .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
    }

    // --- Precios por tipo ---
    async precios(): Promise<Precios> {
        const { data, error } = await this.supabase.from('precios_butaca').select('*');
        if (error) throw error;
        const precios: Precios = { general: 0, accesible: 0, vip: 0 };
        for (const fila of data as { tipo: TipoButaca; precio: number }[]) {
            precios[fila.tipo] = Number(fila.precio);
        }
        return precios;
    }

    async guardarPrecios(precios: Precios) {
        const tipos = Object.keys(precios) as TipoButaca[];
        const resultados = await Promise.all(
            tipos.map(tipo =>
                this.supabase.from('precios_butaca').update({ precio: precios[tipo] }).eq('tipo', tipo).select()
            )
        );
        for (const { data, error } of resultados) {
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
        }
    }

    // --- Butacas deshabilitadas ---
    async deshabilitadas(salaId: number): Promise<string[]> {
        const { data, error } = await this.supabase
            .from('butacas_deshabilitadas')
            .select('fila, numero')
            .eq('sala_id', salaId);
        if (error) throw error;
        return (data as { fila: string; numero: number }[]).map(b => `${b.fila}-${b.numero}`);
    }

    async deshabilitar(salaId: number, fila: string, numero: number) {
        const { error } = await this.supabase
            .from('butacas_deshabilitadas')
            .insert({ sala_id: salaId, fila, numero });
        if (error) throw error;
    }

    async habilitar(salaId: number, fila: string, numero: number) {
        const { error } = await this.supabase
            .from('butacas_deshabilitadas')
            .delete()
            .eq('sala_id', salaId)
            .eq('fila', fila)
            .eq('numero', numero);
        if (error) throw error;
    }
}