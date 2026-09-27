import { Service, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

type Versiones = Record<string, number>;

/**
 * Catálogo en vivo (15_catalogo_en_vivo.sql).
 * Escucha con Realtime la tabla catalogo_version y expone una señal por área.
 * Cuando el admin cambia algo, la señal cambia y cada pantalla recarga lo suyo
 * (con alCambiar() de shared/al-cambiar.ts). Se crea una sola vez para toda la app.
 */
@Service()
export class CatalogoVivoService {
    private supabase = inject(SupabaseService).client;
    private versiones = signal<Versiones>({});

    private version = (tabla: string) => computed(() => this.versiones()[tabla] ?? 0);

    // Películas: estado (cartelera / próximamente / oculta), preventa, datos
    readonly peliculas = this.version('peliculas');
    readonly funciones = this.version('funciones');
    readonly precios = this.version('precios_butaca');
    // Candy: combos (activo, precio), su contenido y productos
    readonly candy = computed(() =>
        (this.versiones()['combos'] ?? 0) + (this.versiones()['combo_items'] ?? 0) + (this.versiones()['productos_candy'] ?? 0)
    );

    constructor() {
        this.supabase
            .channel('catalogo-en-vivo')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogo_version' }, (cambio) => {
                const fila = cambio.new as { tabla?: string; version?: number };
                if (fila.tabla !== undefined && fila.version !== undefined) {
                    this.versiones.update(v => ({ ...v, [fila.tabla!]: fila.version! }));
                }
            })
            .subscribe();
    }
}
