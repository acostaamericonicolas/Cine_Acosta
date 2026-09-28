import { Service, inject } from '@angular/core';
import { Supabase as SupabaseService } from './supabase';
import { Combo, ComboConDetalle, ComboConItems, ComboNuevo, ItemCombo } from '../models/combo';
import { verificarPermiso } from '../shared/permisos';

@Service()
export class Combos {
    private supabase = inject(SupabaseService).client;

    async listar(): Promise<Combo[]> {
        const { data, error } = await this.supabase.from('combos').select('*').order('nombre');
        if (error) throw error;
        return data as Combo[];
    }

    // Para la compra: combos activos con el detalle de lo que incluyen
    async listarActivosConDetalle(): Promise<ComboConDetalle[]> {
        const { data, error } = await this.supabase
            .from('combos')
            .select('*, combo_items(cantidad, productos_candy(nombre))')
            .eq('activo', true)
            .order('precio');
        if (error) throw error;
        return (data as (Combo & { combo_items: { cantidad: number; productos_candy: { nombre: string } }[] })[])
            .map(({ combo_items, ...c }) => ({
                ...c,
                detalle: combo_items.map(i => `${i.cantidad} × ${i.productos_candy.nombre}`),
            }));
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
        verificarPermiso(data);
        await this.guardarItems(id, items);
    }

    async actualizarActivo(id: number, activo: boolean) {
        const { data, error } = await this.supabase.from('combos').update({ activo }).eq('id', id).select();
        if (error) throw error;
        verificarPermiso(data);
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
        if (error) {
            // 23503 = el combo ya se vendió (FK de compra_items)
            if (error.code === '23503') throw new Error('No se puede eliminar: el combo ya se vendió. Desactivalo en su lugar.');
            throw error;
        }
        verificarPermiso(data);
    }
}