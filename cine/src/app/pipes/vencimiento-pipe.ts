import { Pipe, PipeTransform } from '@angular/core';

/**
 * Vencimiento de tarjeta: deja solo los números (hasta 4) y pone la barra
 * después del mes: "1228" → "12/28", "12/2" → "12/2", "1" → "1".
 *
 * También se usa desde código: el paso de pago la aplica al modelo del formulario
 * mientras se escribe, así la barra aparece sola (un pipe solo formatea lo que se
 * muestra; no puede cambiar lo que se tipea en un input).
 */
export function formatoVencimiento(valor: string | null | undefined): string {
    const numeros = (valor ?? '').replace(/\D/g, '').slice(0, 4);
    return numeros.length > 2 ? `${numeros.slice(0, 2)}/${numeros.slice(2)}` : numeros;
}

/**
 * Uso en un template: {{ '1228' | vencimiento }} → "12/28"
 */
@Pipe({ name: 'vencimiento' })
export class VencimientoPipe implements PipeTransform {
    transform(valor: string | null | undefined): string {
        return formatoVencimiento(valor);
    }
}
