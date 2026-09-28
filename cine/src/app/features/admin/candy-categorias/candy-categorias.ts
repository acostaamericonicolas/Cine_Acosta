import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, min, maxLength } from '@angular/forms/signals';
import { Candy as CandyService } from '../../../services/candy';
import { CategoriaCandy } from '../../../models/candy';
import { mensajeDeError } from '../../../shared/errores';

@Component({
  selector: 'app-candy-categorias',
  imports: [FormField],
  templateUrl: './candy-categorias.html',
  styleUrl: './candy-categorias.css',
})
export class CandyCategorias {
  private service = inject(CandyService);

  categorias = signal<CategoriaCandy[]>([]);
  cargando = signal(true);
  error = signal('');
  mensaje = signal('');

  nueva = signal({ nombre: '', orden: 0 });
  f = form(this.nueva, (s) => {
    required(s.nombre, { message: 'Ingresá el nombre' });
    maxLength(s.nombre, 50, { message: 'Máximo 50 caracteres' });
    min(s.orden, 0, { message: 'No puede ser negativo' });
  });

  constructor() { this.cargar(); }

  private async cargar() {
    try {
      this.categorias.set(await this.service.listarCategorias());
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudieron cargar las categorías'));
    } finally {
      this.cargando.set(false);
    }
  }

  async agregar(event: Event) {
    event.preventDefault();
    if (this.f().invalid()) return;
    this.limpiar();
    try {
      const n = this.nueva();
      await this.service.crearCategoria(n.nombre.trim(), n.orden);
      this.nueva.set({ nombre: '', orden: 0 });
      this.categorias.set(await this.service.listarCategorias());
      this.mensaje.set('Categoría creada.');
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo crear la categoría'));
    }
  }

  async eliminar(c: CategoriaCandy) {
    if (!confirm(`¿Eliminar "${c.nombre}"?`)) return;
    this.limpiar();
    try {
      await this.service.eliminarCategoria(c.id);
      this.categorias.update(lista => lista.filter(x => x.id !== c.id));
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo eliminar'));
    }
  }

  private limpiar() { this.error.set(''); this.mensaje.set(''); }
}