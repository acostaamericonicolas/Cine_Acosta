import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ReservasService } from './reservas.service';
import { DatosPago, ErrorCompra, ItemCarrito, PasoError, ResultadoCompra } from '../models/compra';

@Service()
export class ComprasService {
    private supabase = inject(SupabaseService).client;
    private reservas = inject(ReservasService);

    /**
     * Llama a confirmar_compra (03_compras.sql): valida y registra todo en una transacción.
     * Si falla, lanza un ErrorCompra con el mensaje de la base y el paso donde falló (error.hint).
     */
    async confirmar(
        funcionId: number,
        butacas: string[],
        items: ItemCarrito[],
        pago: DatosPago,
        fechaNacimiento: string | null,
    ): Promise<ResultadoCompra> {
        const { data, error } = await this.supabase.rpc('confirmar_compra', {
            p_funcion_id: funcionId,
            p_token: this.reservas.token,
            p_butacas: butacas,
            p_items: items.map(i => ({ tipo: i.tipo, id: i.id, cantidad: i.cantidad })),
            p_cupon: pago.cupon,
            p_credito: pago.credito,
            p_email: pago.email,
            p_fecha_nacimiento: fechaNacimiento,
            p_medio_pago: pago.medioPago,
            p_canjes: pago.canjes.map(c => ({ tipo: c.tipo, producto_id: c.productoId, cantidad: c.cantidad })),
        });
        if (error) {
            const e: ErrorCompra = { mensaje: error.message, paso: (error.hint as PasoError) || null };
            throw e;
        }
        return data as ResultadoCompra;
    }
}
