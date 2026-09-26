import { CanDeactivateFn } from '@angular/router';

// Cualquier componente con formulario implementa esta interfaz
export interface ConCambios {
    hayCambios(): boolean;
}

// canDeactivate: pregunta antes de salir de un formulario con cambios sin guardar
export const formGuard: CanDeactivateFn<ConCambios> = (componente) =>
    !componente.hayCambios() ||
    confirm('Tenés cambios sin guardar. ¿Querés salir igual?');
