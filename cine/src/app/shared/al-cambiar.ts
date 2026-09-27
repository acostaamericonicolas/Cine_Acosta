import { effect, untracked } from '@angular/core';

/**
 * Ejecuta `accion` cada vez que cambia la señal `fuente`, pero NO la primera vez
 * (la pantalla ya hace su carga inicial). Se llama en el constructor de un componente.
 *
 * Uso: alCambiar(() => this.vivo.peliculas(), () => this.recargar());
 */
export function alCambiar(fuente: () => unknown, accion: () => void) {
    let primera = true;
    effect(() => {
        fuente();
        if (primera) {
            primera = false;
            return;
        }
        untracked(accion);   // lo que lea la acción no se suma como dependencia del effect
    });
}
