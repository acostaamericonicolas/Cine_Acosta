import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { Butaca, SALA, TEXTO_TIPO, TipoButaca } from '../../sala-layout';

type EstadoButaca = 'libre' | 'deshabilitada' | 'ocupada' | 'seleccionada';

const TEXTO_ESTADO: Record<EstadoButaca, string> = {
  libre: '',
  deshabilitada: 'Deshabilitada',
  ocupada: 'Ocupada',
  seleccionada: 'Seleccionada',
};

@Component({
  selector: 'app-mapa-butacas',
  imports: [NgClass],
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.css',
})
export class MapaButacas {
  readonly sala = SALA;
  readonly tipos: TipoButaca[] = ['general', 'accesible', 'vip'];
  readonly textoTipo = TEXTO_TIPO;

  // Los @Input llegan como listas de ids ('J-10'); se guardan en señales como Set para consultar rápido
  private idsDeshabilitadas = signal(new Set<string>());
  private idsOcupadas = signal(new Set<string>());
  private idsSeleccionadas = signal(new Set<string>());

  @Input() set deshabilitadas(ids: string[]) { this.idsDeshabilitadas.set(new Set(ids)); }
  @Input() set ocupadas(ids: string[]) { this.idsOcupadas.set(new Set(ids)); }
  @Input() set seleccionadas(ids: string[]) { this.idsSeleccionadas.set(new Set(ids)); }

  // El padre decide qué hacer con el clic (el admin deshabilita, el cliente selecciona)
  @Output() butacaClick = new EventEmitter<Butaca>();

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