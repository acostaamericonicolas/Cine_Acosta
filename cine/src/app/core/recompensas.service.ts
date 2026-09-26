import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Canje, ItemCanjeable } from '../models/recompensa';

// Clave de un ítem canjeable: 'entrada' o 'producto-3'
export const claveCanje = (i: Pick<ItemCanjeable, 'tipo' | 'producto_id'>) =>
    i.tipo === 'entrada' ? 'entrada' : `producto-${i.producto_id}`;

/**
 * Puntos y recompensas (HU-30, HU-31).
 * El catálogo sale de la vista catalogo_canjes (05_puntos_por_precio.sql): cada ítem cuesta
 * en puntos lo que vale en pesos, salvo que el admin haya guardado una excepción en recompensas.
 */
@Service()
export class RecompensasService {
    private supabase = inject(SupabaseService).client;

    // Todo lo canjeable, con su costo (admin: incluye los desactivados)
    async catalogo(): Promise<ItemCanjeable[]> {
        const { data, error } = await this.supabase
            .from('catalogo_canjes')
            .select('*')
            .order('tipo')     // 'entrada' primero
            .order('nombre');
        if (error) throw error;
        return (data as ItemCanjeable[]).map(i => ({ ...i, precio: Number(i.precio) }));
    }

    // Lo que el cliente puede canjear hoy (compra)
    async canjeables(): Promise<ItemCanjeable[]> {
        return (await this.catalogo()).filter(i => i.activa);
    }

    // Guarda una excepción: puntos a mano (o null = volver al precio) y si se puede canjear
    async guardarExcepcion(item: ItemCanjeable, cambios: { puntos: number | null; activa: boolean }) {
        // Sin excepción real (precio por defecto y activo) no hace falta la fila
        if (cambios.puntos === null && cambios.activa) {
            if (item.recompensa_id !== null) {
                const { data, error } = await this.supabase
                    .from('recompensas')
                    .delete()
                    .eq('id', item.recompensa_id)
                    .select();
                if (error) throw error;
                if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
            }
            return;
        }

        if (item.recompensa_id !== null) {
            const { data, error } = await this.supabase
                .from('recompensas')
                .update(cambios)
                .eq('id', item.recompensa_id)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No tenés permiso para hacer este cambio');
            return;
        }

        const { error } = await this.supabase.from('recompensas').insert({
            tipo: item.tipo,
            producto_id: item.producto_id,
            ...cambios,
        });
        if (error) throw error;
    }

    // Historial del perfil (HU-05); la policy solo devuelve los del usuario
    async misCanjes(usuarioId: string): Promise<Canje[]> {
        const { data, error } = await this.supabase
            .from('canjes')
            .select('id, compra_id, descripcion, cantidad, puntos, creado_en')
            .eq('usuario_id', usuarioId)
            .order('creado_en', { ascending: false });
        if (error) throw error;
        return data as Canje[];
    }
}
