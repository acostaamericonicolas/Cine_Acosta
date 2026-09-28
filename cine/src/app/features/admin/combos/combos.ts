import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Combos as CombosService } from '../../../services/combos';
import { Combo } from '../../../models/combo';
import { Imagenes as ImagenesService } from '../../../services/imagenes';
import { mensajeDeError } from '../../../shared/errores';
import { PesosPipe } from '../../../pipes/pesos-pipe';

@Component({
  selector: 'app-combos',
  imports: [RouterLink, PesosPipe],
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
      this.error.set(mensajeDeError(e, 'No se pudieron cargar los combos'));
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
      this.error.set(mensajeDeError(e, 'No se pudo cambiar el estado'));
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
      this.error.set(mensajeDeError(e, 'No se pudo eliminar'));
    }
  }
}