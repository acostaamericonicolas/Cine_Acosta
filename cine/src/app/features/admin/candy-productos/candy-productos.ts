import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CandyService, CategoriaCandy, ProductoCandy } from '../../../core/candy.service';
import { ImagenesService } from '../../../core/imagenes.service';

@Component({
  selector: 'app-candy-productos',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './candy-productos.html',
  styleUrl: './candy-productos.css',
})
export class CandyProductos {
  private service = inject(CandyService);
  private imagenes = inject(ImagenesService)

  productos = signal<ProductoCandy[]>([]);
  categorias = signal<CategoriaCandy[]>([]);
  filtroCategoria = signal<number | null>(null);
  cargando = signal(true);
  error = signal('');

  private mapaCategorias = computed(() => new Map(this.categorias().map(c => [c.id, c.nombre])));
  categoriaNombre(id: number): string {
    return this.mapaCategorias().get(id) ?? '(sin categoría)';
  }

  filtrados = computed(() => {
    const f = this.filtroCategoria();
    return f === null ? this.productos() : this.productos().filter(p => p.categoria_id === f);
  });

  constructor() { this.cargar(); }

  private async cargar() {
    try {
      const [productos, categorias] = await Promise.all([
        this.service.listarProductos(),
        this.service.listarCategorias(),
      ]);
      this.productos.set(productos);
      this.categorias.set(categorias);
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudieron cargar los productos');
    } finally {
      this.cargando.set(false);
    }
  }

  async alternarActivo(p: ProductoCandy) {
    this.error.set('');
    try {
      await this.service.actualizarProducto(p.id, { activo: !p.activo });
      this.productos.update(lista => lista.map(x => (x.id === p.id ? { ...x, activo: !p.activo } : x)));
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cambiar el estado');
    }
  }

  async eliminar(p: ProductoCandy) {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    this.error.set('');
    try {
      await this.service.eliminarProducto(p.id);
      if (p.imagen_path) await this.imagenes.eliminar('candy', p.imagen_path).catch(() => { });
      this.productos.update(lista => lista.filter(x => x.id !== p.id));
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo eliminar');
    }
  }
}