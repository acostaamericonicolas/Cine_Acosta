import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./features/publico/home/home').then(m => m.Home) },
    { path: 'login', loadComponent: () => import('./features/publico/login/login').then(m => m.Login) },
    { path: 'registro', loadComponent: () => import('./features/publico/registro/registro').then(m => m.Registro) },
    { path: '**', redirectTo: '' },
];