import { Component, inject, signal } from '@angular/core';
import { claveCanje, Recompensas as RecompensasService } from '../../../services/recompensas';
import { ItemCanjeable } from '../../../models/recompensa';
import { mensajeDeError } from '../../../shared/errores';
import { PesosPipe } from '../../../pipes/pesos-pipe';

/**
 * HU-30: costo en puntos de cada recompensa.
 * Por defecto todo cuesta en puntos lo que vale en pesos (1 peso pagado = 1 punto ganado).
 * Acá el admin solo carga excepciones: otro costo, volver al precio o desactivar el canje.
 */
@Component({
  selector: 'app-recompensas',
  imports: [PesosPipe],
  templateUrl: './recompensas.html',
  styleUrl: './recompensas.css',
})
export class Recompensas {
  private service = inject(RecompensasService);

  readonly claveCanje = claveCanje;

  items = signal<ItemCanjeable[]>([]);
  cargando = signal(true);
  error = signal('');
  mensaje = signal('');
  guardando = signal<string | null>(null);   // clave del ítem que se está guardando

  // Puntos escritos en la tabla y todavía sin guardar (clave → puntos)
  edicion = signal<Record<string, number>>({});

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      this.items.set(await this.service.catalogo());
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cargar el catálogo de canjes'));
    } finally {
      this.cargando.set(false);
    }
  }

  puntosEditados(i: ItemCanjeable): number {
    return this.edicion()[claveCanje(i)] ?? i.puntos;
  }

  hayCambio(i: ItemCanjeable): boolean {
    return this.puntosEditados(i) !== i.puntos;
  }

  editarPuntos(i: ItemCanjeable, valor: string) {
    this.edicion.update(e => ({ ...e, [claveCanje(i)]: Number(valor) }));
  }

  async guardarPuntos(i: ItemCanjeable) {
    const puntos = this.puntosEditados(i);
    if (!Number.isInteger(puntos) || puntos < 1) {
      this.limpiar();
      this.error.set(`Los puntos de "${i.nombre}" tienen que ser un número entero mayor a 0.`);
      return;
    }
    await this.guardar(i, { puntos, activa: i.activa }, `"${i.nombre}" ahora cuesta ${puntos} puntos.`);
  }

  async volverAlPrecio(i: ItemCanjeable) {
    await this.guardar(i, { puntos: null, activa: i.activa }, `"${i.nombre}" vuelve a costar lo mismo que su precio.`);
  }

  async alternarActiva(i: ItemCanjeable) {
    const activa = !i.activa;
    await this.guardar(
      i,
      { puntos: i.personalizado ? i.puntos : null, activa },
      activa ? `"${i.nombre}" se puede volver a canjear.` : `"${i.nombre}" ya no se puede canjear con puntos.`,
    );
  }

  private async guardar(i: ItemCanjeable, cambios: { puntos: number | null; activa: boolean }, ok: string) {
    this.limpiar();
    this.guardando.set(claveCanje(i));
    try {
      await this.service.guardarExcepcion(i, cambios);
      // Se relee: el costo por defecto y el id de la excepción los calcula la vista
      this.items.set(await this.service.catalogo());
      this.edicion.update(e => {
        const { [claveCanje(i)]: _, ...resto } = e;
        return resto;
      });
      this.mensaje.set(ok);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo guardar'));
    } finally {
      this.guardando.set(null);
    }
  }

  private limpiar() { this.error.set(''); this.mensaje.set(''); }
}
