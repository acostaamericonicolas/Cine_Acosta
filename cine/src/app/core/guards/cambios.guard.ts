import { CanDeactivateFn } from '@angular/router';

// Cualquier componente con formulario implementa esta interfaz
export interface ConCambios {
    hayCambios(): boolean;
}

export const cambiosGuard: CanDeactivateFn<ConCambios> = (componente) =>
    !componente.hayCambios() ||
    confirm('Tenés cambios sin guardar. ¿Querés salir igual?');