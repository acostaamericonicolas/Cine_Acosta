import { formatNumber } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

// La app usa el locale es-AR (app.config.ts): punto de miles y coma decimal
const LOCALE = 'es-AR';

// También se usa desde código TypeScript (mensajes armados en el componente)
export function formatoPesos(valor: number | string | null | undefined): string {
    if (valor === null || valor === undefined || valor === '') return '';
    return '$ ' + formatNumber(Number(valor), LOCALE, '1.2-2');
}

/**
 * Montos en pesos: 1234.5 → "$ 1.234,50".
 * Uso: {{ precio | pesos }}
 */
@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
    transform(valor: number | string | null | undefined): string {
        return formatoPesos(valor);
    }
}
