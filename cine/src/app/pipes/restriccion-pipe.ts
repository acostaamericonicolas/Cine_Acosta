import { Pipe, PipeTransform } from '@angular/core';

/**
 * Restricción de edad de una película: 0 → "Todo público", 13 → "+13", 18 → "+18".
 * Uso: {{ pelicula.restriccion_edad | restriccion }}
 */
@Pipe({ name: 'restriccion' })
export class RestriccionPipe implements PipeTransform {
    transform(edad: number | null | undefined): string {
        return edad ? `+${edad}` : 'Todo público';
    }
}
