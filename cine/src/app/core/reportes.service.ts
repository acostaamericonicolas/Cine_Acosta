import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Barra, VentaDiaria } from '../models/reporte';

// HU-35 y HU-36: los cálculos los hace la base (13_reportes.sql), solo para el admin
@Service()
export class ReportesService {
    private supabase = inject(SupabaseService).client;

    async ventas(desde: string, hasta: string): Promise<VentaDiaria[]> {
        const { data, error } = await this.supabase.rpc('reporte_ventas', { p_desde: desde, p_hasta: hasta });
        if (error) throw new Error(error.message);
        return (data as VentaDiaria[]).map(v => ({
            ...v, facturado: Number(v.facturado), credito_usado: Number(v.credito_usado),
        }));
    }

    async peliculasMasVistas(desde: string, hasta: string): Promise<Barra[]> {
        const { data, error } = await this.supabase.rpc('ranking_peliculas', { p_desde: desde, p_hasta: hasta });
        if (error) throw new Error(error.message);
        return (data as { pelicula: string; entradas: number }[]).map(r => ({ nombre: r.pelicula, valor: r.entradas }));
    }

    async candyMasVendido(desde: string, hasta: string): Promise<Barra[]> {
        const { data, error } = await this.supabase.rpc('ranking_candy', { p_desde: desde, p_hasta: hasta });
        if (error) throw new Error(error.message);
        return (data as { producto: string; unidades: number }[]).map(r => ({ nombre: r.producto, valor: r.unidades }));
    }
}
