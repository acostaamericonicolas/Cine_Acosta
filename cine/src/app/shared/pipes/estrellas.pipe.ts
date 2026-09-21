import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'estrellas' })
export class EstrellasPipe implements PipeTransform {
    transform(valor: number | null | undefined): string {
        const n = Math.max(0, Math.min(5, Math.round(valor ?? 0)));
        return '★'.repeat(n) + '☆'.repeat(5 - n);
    }
}