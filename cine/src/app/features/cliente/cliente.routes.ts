import { Routes } from '@angular/router';

export const CLIENTE_ROUTES: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'perfil' },
    { path: 'perfil', loadComponent: () => import('./perfil/perfil').then(m => m.Perfil) },
    { path: 'compras', loadComponent: () => import('./mis-compras/mis-compras').then(m => m.MisCompras) },
];