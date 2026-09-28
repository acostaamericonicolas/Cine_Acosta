import { Pipe, PipeTransform } from '@angular/core';
import { IDIOMAS, Idioma } from '../models/funcion';

/**
 * Idioma de una función: 'castellano' → "Castellano", 'subtitulada' → "Subtitulada".
 * Uso: {{ funcion.idioma | idioma }}
 */
@Pipe({ name: 'idioma' })
export class IdiomaPipe implements PipeTransform {
    transform(valor: Idioma | string | null | undefined): string {
        return IDIOMAS.find(i => i.valor === valor)?.texto ?? (valor ?? '');
    }
}
