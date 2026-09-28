import { Pipe, PipeTransform } from '@angular/core';
import { TEXTO_TIPO, TipoButaca } from '../shared/sala-layout';

/**
 * Tipo de butaca: 'vip' → "VIP", 'accesible' → "Accesible", 'general' → "General".
 * Uso: {{ butaca.tipo | tipoButaca }}
 */
@Pipe({ name: 'tipoButaca' })
export class TipoButacaPipe implements PipeTransform {
    transform(valor: TipoButaca | null | undefined): string {
        return valor ? TEXTO_TIPO[valor] : '';
    }
}
