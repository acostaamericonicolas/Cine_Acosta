import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Combo, ComboConItems, ComboNuevo, ItemCombo } from '../models/combo';

@Service()
export class CombosService {
    private supabase = inject(SupabaseService).client;

    async listar(): Promise<Combo[]> {
        const { data, error } = await this.supabase.from('combos').select('*').order('nombre');
        if (error) throw error;
        return data as Combo[];
    }

    async listarActivos(): Promise<Combo[]> {
        const { data, error } = await this.supabase.from('combos').select('*').eq('activo', true).order('nombre');
        if (error) throw error;
        return data as Combo[];
    }

    async obtener(id: number): Promise<ComboConItems> {
        const { data: combo, error } = await this.supabase.from('combos').select('*').eq('id', id).single();
        if (error) throw error;
        const { data: items, error: errItems } = await this.supabase
            .from('combo_items').select('producto_id, cantidad').eq('combo_id', id);
        if (errItems) throw errItems;
        return { ...(combo as Combo), items: items as ItemCombo[] };
    }

    async crear(combo: ComboNuevo, items: ItemCombo[]) {
        const { data, error } = await this.supabase.from('combos').insert(combo).select().single();
        if (error) throw error;
        await this.guardarItems((data as Combo).id, items);
    }

    async actualizar(id: number, combo: Partial<ComboNuevo>, items: ItemCombo[]) {
        const { data, error } = await this.supabase.from('combos').update(combo).eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
        await this.guardarItems(id, items);
    }

    async actualizarActivo(id: number, activo: boolean) {
        const { data, error } = await this.supabase.from('combos').update({ activo }).eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
    }

    // Reemplaza todos los items del combo: se borran los anteriores y se insertan los nuevos.
    // Es más simple que calcular diferencias, y acá el volumen de datos es chico.
    private async guardarItems(comboId: number, items: ItemCombo[]) {
        const { error: errDel } = await this.supabase.from('combo_items').delete().eq('combo_id', comboId);
        if (errDel) throw errDel;
        if (items.length === 0) return;
        const { error: errIns } = await this.supabase
            .from('combo_items')
            .insert(items.map(i => ({ combo_id: comboId, producto_id: i.producto_id, cantidad: i.cantidad })));
        if (errIns) throw errIns;
    }

    async eliminar(id: number) {
        const { data, error } = await this.supabase.from('combos').delete().eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
    }
}