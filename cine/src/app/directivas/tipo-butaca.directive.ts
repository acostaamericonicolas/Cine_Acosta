import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';
import { TipoButaca } from '../shared/sala-layout';

export type EstadoButaca = 'libre' | 'deshabilitada' | 'ocupada' | 'seleccionada';

/**
 * HU-22: directiva de atributo que le da a cada butaca el estilo de su tipo
 * (general / accesible / vip) y de su estado (libre / ocupada / seleccionada / deshabilitada).
 * Aplica las clases con Renderer2, como en el ejemplo hover-zoom de clase.
 *
 * Uso: <button [appTipoButaca]="b.tipo" [estadoButaca]="estado"></button>
 */
@Directive({
  selector: '[appTipoButaca]',
})
export class TipoButacaDirective {
  private el = inject(ElementRef);
  private render = inject(Renderer2);

  appTipoButaca = input.required<TipoButaca>();
  estadoButaca = input<EstadoButaca | null>(null);

  private clases: string[] = [];

  constructor() {
    // Cada vez que cambia el tipo o el estado se sacan las clases anteriores y se ponen las nuevas
    effect(() => {
      const estado = this.estadoButaca();
      const nuevas: string[] = estado ? [this.appTipoButaca(), estado] : [this.appTipoButaca()];
      for (const c of this.clases) this.render.removeClass(this.el.nativeElement, c);
      for (const c of nuevas) this.render.addClass(this.el.nativeElement, c);
      this.clases = nuevas;
    });
  }
}
