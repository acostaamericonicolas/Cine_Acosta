import { Pipe, PipeTransform } from '@angular/core';

//recibe un número y devuelve un texto, sin tocar nada más.

@Pipe({ name: 'duracion' })
export class DuracionPipe implements PipeTransform {
    transform(minutos: number | null | undefined): string {
        if (!minutos || minutos <= 0) return '';
        const h = Math.floor(minutos / 60);
        const m = minutos % 60;
        if (h === 0) return `${m} min`;
        if (m === 0) return `${h} h`;
        return `${h} h ${m} min`;
    }
}