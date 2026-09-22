import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Combo, CombosService } from '../../../core/combos.service';
import { ImagenesService } from '../../../core/imagenes.service';

@Component({
  selector: 'app-combos',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './combos.html',
  styleUrl: './combos.css',
})
export class Combos {
  private service = inject(CombosService);
  private imagenes = inject(ImagenesService);

  combos = signal<Combo[]>([]);
  cargando = signal(true);
  error = signal('');

  constructor() { this.cargar(); }

  private async cargar() {
    try {
      this.combos.set(await this.service.listar());
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudieron cargar los combos');
    } finally {
      this.cargando.set(false);
    }
  }

  async alternarActivo(c: Combo) {
    this.error.set('');
    try {
      await this.service.actualizarActivo(c.id, !c.activo);
      this.combos.update(lista => lista.map(x => (x.id === c.id ? { ...x, activo: !c.activo } : x)));
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cambiar el estado');
    }
  }

  async eliminar(c: Combo) {
    if (!confirm(`¿Eliminar el combo "${c.nombre}"?`)) return;
    this.error.set('');
    try {
      await this.service.eliminar(c.id);
      if (c.imagen_path) await this.imagenes.eliminar('combos', c.imagen_path).catch(() => { }); 
      this.combos.update(lista => lista.filter(x => x.id !== c.id));
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo eliminar');
    }
  }
}