import { Service, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { ButacaOcupada } from '../models/butaca-ocupada';

const CLAVE_TOKEN = 'token-compra';

/**
 * Reserva temporal de butacas (HU-22/23).
 * La lógica está en la base (02_butacas_ocupadas.sql): acá solo se llaman
 * las funciones con rpc() y se escuchan los cambios con Supabase Realtime.
 */
@Service()
export class ReservasService {
    private supabase = inject(SupabaseService).client;

    // Identifica al navegador que reserva, con o sin sesión. Dura lo que la pestaña.
    readonly token = this.leerToken();

    private leerToken(): string {
        try {
            const guardado = sessionStorage.getItem(CLAVE_TOKEN);
            if (guardado) return guardado;
            const nuevo = crypto.randomUUID();
            sessionStorage.setItem(CLAVE_TOKEN, nuevo);
            return nuevo;
        } catch {
            return crypto.randomUUID();   // sin sessionStorage el token dura hasta recargar
        }
    }

    // La base guarda el sha256 del token; así reconocemos nuestras reservas sin exponer el token
    async hashToken(): Promise<string> {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(this.token));
        return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async listar(funcionId: number): Promise<ButacaOcupada[]> {
        const { data, error } = await this.supabase
            .from('butacas_ocupadas')
            .select('*')
            .eq('funcion_id', funcionId);
        if (error) throw error;
        return data as ButacaOcupada[];
    }

    // Devuelve la hora de vencimiento de la reserva. Si falla, el mensaje ya viene claro desde la base.
    async reservar(funcionId: number, fila: string, numero: number): Promise<string> {
        const { data, error } = await this.supabase.rpc('reservar_butaca', {
            p_funcion_id: funcionId, p_fila: fila, p_numero: numero, p_token: this.token,
        });
        if (error) throw error;
        return data as string;
    }

    async liberar(funcionId: number, fila: string, numero: number) {
        const { error } = await this.supabase.rpc('liberar_butaca', {
            p_funcion_id: funcionId, p_fila: fila, p_numero: numero, p_token: this.token,
        });
        if (error) throw error;
    }

    async liberarTodas(funcionId: number) {
        const { error } = await this.supabase.rpc('liberar_reservas', {
            p_funcion_id: funcionId, p_token: this.token,
        });
        if (error) throw error;
    }

    /**
     * Escucha las butacas que se toman o se liberan en la función.
     * Realtime no filtra los DELETE (y solo manda la clave primaria),
     * por eso se escuchan aparte y se descartan los de otras funciones.
     */
    escuchar(
        funcionId: number,
        alTomar: (b: ButacaOcupada) => void,
        alLiberar: (fila: string, numero: number) => void,
    ): RealtimeChannel {
        return this.supabase
            .channel(`butacas-funcion-${funcionId}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'butacas_ocupadas', filter: `funcion_id=eq.${funcionId}` },
                (cambio) => alTomar(cambio.new as ButacaOcupada))
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'butacas_ocupadas', filter: `funcion_id=eq.${funcionId}` },
                (cambio) => alTomar(cambio.new as ButacaOcupada))
            .on('postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'butacas_ocupadas' },
                (cambio) => {
                    const viejo = cambio.old as Partial<ButacaOcupada>;
                    if (viejo.funcion_id === funcionId && viejo.fila && viejo.numero) {
                        alLiberar(viejo.fila, viejo.numero);
                    }
                })
            .subscribe();
    }

    dejarDeEscuchar(canal: RealtimeChannel) {
        this.supabase.removeChannel(canal);
    }
}
