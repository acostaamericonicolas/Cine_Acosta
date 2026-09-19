import { Routes } from '@angular/router';
import { adminChildGuard, adminGuard, authGuard, empleadoGuard } from './core/guards/acceso.guard';
import { cambiosGuard } from './core/guards/cambios.guard';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./features/publico/home/home').then(m => m.Home) },
    { path: 'login', loadComponent: () => import('./features/publico/login/login').then(m => m.Login) },
    {
        path: 'registro',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./features/publico/registro/registro').then(m => m.Registro),
    },
    {
        path: 'cliente',
        canActivate: [authGuard],
        loadChildren: () => import('./features/cliente/cliente.routes').then(m => m.CLIENTE_ROUTES),
    },
    {
        path: 'empleado',
        canMatch: [empleadoGuard],
        loadChildren: () => import('./features/empleado/empleado.routes').then(m => m.EMPLEADO_ROUTES),
    },
    {
        path: 'admin',
        canMatch: [adminGuard],
        canActivateChild: [adminChildGuard],
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
    },
    { path: '**', redirectTo: '' },
];