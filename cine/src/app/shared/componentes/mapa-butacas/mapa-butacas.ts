import { NgClass } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Butaca, SALA, TEXTO_TIPO, TipoButaca } from '../../sala-layout';
import { EstadoButaca, TipoButacaDirective } from '../../../directivas/tipo-butaca.directive';
import { TipoButacaPipe } from '../../../pipes/tipo-butaca-pipe';


const TEXTO_ESTADO: Record<EstadoButaca, string> = {
  libre: '',
  deshabilitada: 'Deshabilitada',
  ocupada: 'Ocupada',
  seleccionada: 'Seleccionada',
};

@Component({
  selector: 'app-mapa-butacas',
  imports: [NgClass, TipoButacaDirective, TipoButacaPipe],
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.css',
})
export class MapaButacas {
  readonly sala = SALA;
  readonly tipos: TipoButaca[] = ['general', 'accesible', 'vip'];

  // Los inputs llegan como listas de ids ('J-10'); se pasan a Set para consultar rápido
  deshabilitadas = input<string[]>([]);
  ocupadas = input<string[]>([]);
  seleccionadas = input<string[]>([]);
  leyendaEstados = input(false);   // la compra muestra también ocupada y seleccionada

  private idsDeshabilitadas = computed(() => new Set(this.deshabilitadas()));
  private idsOcupadas = computed(() => new Set(this.ocupadas()));
  private idsSeleccionadas = computed(() => new Set(this.seleccionadas()));

  // El padre decide qué hacer con el clic (el admin deshabilita, el cliente selecciona)
  butacaClick = output<Butaca>();

  estado(b: Butaca): EstadoButaca {
    if (this.idsDeshabilitadas().has(b.id)) return 'deshabilitada';
    if (this.idsOcupadas().has(b.id)) return 'ocupada';
    if (this.idsSeleccionadas().has(b.id)) return 'seleccionada';
    return 'libre';
  }

  // Texto del tooltip: "J-10 · Accesible" (y el estado si no está libre)
  etiqueta(b: Butaca, e: EstadoButaca): string {
    const base = `${b.id} · ${TEXTO_TIPO[b.tipo]}`;
    return e === 'libre' ? base : `${base} · ${TEXTO_ESTADO[e]}`;
  }
}