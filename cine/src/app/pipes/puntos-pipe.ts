import { formatNumber } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

/**
 * Puntos del programa de fidelización: 1500 → "1.500 puntos" (o "1.500 pts" en versión corta).
 * Uso: {{ saldo | puntos }}   ·   {{ costo | puntos: 'corto' }}
 */
@Pipe({ name: 'puntos' })
export class PuntosPipe implements PipeTransform {
    transform(valor: number | null | undefined, formato: 'largo' | 'corto' = 'largo'): string {
        if (valor === null || valor === undefined) return '';
        const numero = formatNumber(valor, 'es-AR', '1.0-0');
        if (formato === 'corto') return `${numero} pts`;
        return `${numero} ${Math.abs(valor) === 1 ? 'punto' : 'puntos'}`;
    }
}
