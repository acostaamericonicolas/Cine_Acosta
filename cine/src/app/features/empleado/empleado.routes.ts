import { Routes } from '@angular/router';

export const EMPLEADO_ROUTES: Routes = [
    { path: '', loadComponent: () => import('./validacion/validacion').then(m => m.Validacion) },
];