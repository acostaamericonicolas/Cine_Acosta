import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';

/**
 * Géneros compactos: muestra los primeros `visibles` como chips y el resto
 * detrás de un "+N". Al pasar el mouse, enfocar con teclado o tocar el "+N"
 * se abre un globo con la lista completa.
 *
 * El globo usa position: fixed (calculada al abrir) para que no lo recorte
 * el overflow de las tablas del admin.
 */
@Component({
  selector: 'app-lista-generos',
  templateUrl: './lista-generos.html',
  styleUrl: './lista-generos.css',
  host: {
    '(window:scroll)': 'cerrar()',
    '(window:resize)': 'cerrar()',
    '(document:keydown.escape)': 'cerrar()',
  },
})
export class ListaGeneros {
  generos = input.required<string[]>();
  visibles = input(1);

  primeros = computed(() => this.generos().slice(0, this.visibles()));
  resto = computed(() => this.generos().slice(this.visibles()));

  abierto = signal(false);
  posicion = signal({ top: 0, left: 0 });

  private boton = viewChild<ElementRef<HTMLButtonElement>>('mas');

  abrir() {
    const el = this.boton()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Debajo del "+N"; si no entra en la pantalla, se acomoda a la izquierda
    const left = Math.min(r.left, window.innerWidth - 220);
    this.posicion.set({ top: r.bottom + 6, left: Math.max(8, left) });
    this.abierto.set(true);
  }

  cerrar() {
    this.abierto.set(false);
  }
}
