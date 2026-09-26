import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { CategoriaCandy, ProductoCandy } from '../../../../models/candy';
import { ComboConDetalle } from '../../../../models/combo';

export const MAX_POR_ITEM = 20;

// Clave de cada ítem en el carrito: 'producto-3', 'combo-1'
export const claveProducto = (id: number) => `producto-${id}`;
export const claveCombo = (id: number) => `combo-${id}`;

/**
 * Catálogo del candy para sumar a la compra (HU-25).
 * No guarda estado: recibe las cantidades y avisa los cambios al padre.
 */
@Component({
  selector: 'app-paso-candy',
  imports: [DecimalPipe],
  templateUrl: './paso-candy.html',
  styleUrl: './paso-candy.css',
})
export class PasoCandy {
  categorias = input.required<CategoriaCandy[]>();
  productos = input.required<ProductoCandy[]>();
  combos = input.required<ComboConDetalle[]>();
  cantidades = input.required<Record<string, number>>();
  cantidadButacas = input.required<number>();

  cambiar = output<{ clave: string; cantidad: number }>();

  readonly max = MAX_POR_ITEM;
  readonly claveProducto = claveProducto;
  readonly claveCombo = claveCombo;

  // Productos agrupados por categoría, en el orden que definió el admin. Las categorías vacías no se muestran.
  grupos = computed(() =>
    this.categorias()
      .map(c => ({ categoria: c, productos: this.productos().filter(p => p.categoria_id === c.id) }))
      .filter(g => g.productos.length > 0)
  );

  combosConEntradaElegidos = computed(() =>
    this.combos()
      .filter(c => c.incluye_entrada)
      .reduce((s, c) => s + (this.cantidades()[claveCombo(c.id)] ?? 0), 0)
  );

  cantidad(clave: string): number {
    return this.cantidades()[clave] ?? 0;
  }

  sumar(clave: string, delta: number) {
    const nueva = Math.min(MAX_POR_ITEM, Math.max(0, this.cantidad(clave) + delta));
    this.cambiar.emit({ clave, cantidad: nueva });
  }
}
