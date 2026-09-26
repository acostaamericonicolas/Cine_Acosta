import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { adminGuard, empleadoGuard } from './core/guards/role-guard';
import { adminChildGuard } from './core/guards/child-guard';
import { formGuard } from './core/guards/form-guard';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./features/publico/home/home').then(m => m.Home) },
    { path: 'login', loadComponent: () => import('./features/publico/login/login').then(m => m.Login) },
    {
        path: 'registro',
        canDeactivate: [formGuard],
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
    {
        path: 'pelicula/:id',
        loadComponent: () => import('./features/publico/detalle-pelicula/detalle-pelicula').then(m => m.DetallePelicula),
    },
    { path: '**', redirectTo: '' },
];