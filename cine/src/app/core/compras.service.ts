import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ReservasService } from './reservas.service';
import {
    CompraResumen, Comprobante, DatosPago, ErrorCompra, EstadoCompra, ItemCarrito, PasoError, ResultadoCancelacion, ResultadoCompra,
} from '../models/compra';

const CLAVE_MAIL = 'mail-compra-';

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

    /**
     * Comprobante de una compra (07_comprobante.sql). El dueño registrado lo ve solo con el código;
     * el invitado necesita además el mail de la compra.
     */
    async obtenerComprobante(codigo: string, email: string | null): Promise<Comprobante> {
        const { data, error } = await this.supabase.rpc('obtener_comprobante', {
            p_codigo: codigo,
            p_email: email,
        });
        if (error) throw new Error(error.message);
        const c = data as Comprobante;
        // numeric llega como número o texto según el caso: se normaliza para los pipes
        return {
            ...c,
            entradas: c.entradas.map(e => ({ ...e, precio: Number(e.precio) })),
            items: c.items.map(i => ({ ...i, precio_unitario: Number(i.precio_unitario) })),
        };
    }

    // El invitado no tiene sesión: el mail de su compra se recuerda en la pestaña para abrir el comprobante
    recordarMail(codigo: string, email: string) {
        try { sessionStorage.setItem(CLAVE_MAIL + codigo, email); } catch { /* sin sessionStorage se pide el mail */ }
    }

    mailRecordado(codigo: string): string | null {
        try { return sessionStorage.getItem(CLAVE_MAIL + codigo); } catch { return null; }
    }

    // "Mis compras" (HU-28): la policy de compras solo devuelve las del usuario.
    // La película, la sala y la cantidad de entradas se traen embebidas en la misma consulta.
    async misCompras(usuarioId: string): Promise<CompraResumen[]> {
        const { data, error } = await this.supabase
            .from('compras')
            .select(`codigo, estado, creado_en, total_pagado, credito_usado, puntos_ganados, puntos_canjeados,
                     credito_devuelto,
                     funciones(inicio, peliculas(nombre, imagen_url), salas(nombre)),
                     entradas(count)`)
            .eq('usuario_id', usuarioId)
            .order('creado_en', { ascending: false });
        if (error) throw error;

        type Fila = {
            codigo: string; estado: EstadoCompra; creado_en: string; total_pagado: number; credito_usado: number;
            puntos_ganados: number; puntos_canjeados: number; credito_devuelto: number | null;
            funciones: { inicio: string; peliculas: { nombre: string; imagen_url: string } | null; salas: { nombre: string } | null };
            entradas: { count: number }[];
        };
        return (data as unknown as Fila[]).map(f => ({
            codigo: f.codigo,
            estado: f.estado,
            creado_en: f.creado_en,
            total_pagado: Number(f.total_pagado),
            credito_usado: Number(f.credito_usado),
            puntos_ganados: f.puntos_ganados,
            puntos_canjeados: f.puntos_canjeados,
            credito_devuelto: f.credito_devuelto === null ? null : Number(f.credito_devuelto),
            // Si la película se ocultó, la policy no la devuelve: la compra se sigue mostrando igual
            pelicula: f.funciones.peliculas?.nombre ?? 'Película no disponible',
            imagen_url: f.funciones.peliculas?.imagen_url ?? null,
            inicio: f.funciones.inicio,
            sala: f.funciones.salas?.nombre ?? '',
            cantidad_entradas: f.entradas[0]?.count ?? 0,
        }));
    }

    // cancelar_compra (08_cancelar_compra.sql): si no se puede, el mensaje de la base dice por qué
    async cancelar(codigo: string): Promise<ResultadoCancelacion> {
        const { data, error } = await this.supabase.rpc('cancelar_compra', { p_codigo: codigo });
        if (error) throw new Error(error.message);
        return data as ResultadoCancelacion;
    }
}
