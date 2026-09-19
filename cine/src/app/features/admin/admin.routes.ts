import { Routes } from '@angular/router';
import { cambiosGuard } from '../../core/guards/cambios.guard';

export const ADMIN_ROUTES: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'peliculas' },
    { path: 'usuarios', loadComponent: () => import('./usuarios/usuarios').then(m => m.Usuarios) },
    { path: 'peliculas', loadComponent: () => import('./peliculas/peliculas').then(m => m.Peliculas) },
    {
        path: 'peliculas/nueva',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./pelicula-form/pelicula-form').then(m => m.PeliculaForm),
    },
    {
        path: 'peliculas/:id',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./pelicula-form/pelicula-form').then(m => m.PeliculaForm),
    },
];