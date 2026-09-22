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
    {
        path: 'funciones/nueva',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./funcion-form/funcion-form').then(m => m.FuncionForm),
    },
    {
        path: 'funciones/:id/editar',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./funcion-form/funcion-form').then(m => m.FuncionForm),
    },
    { path: 'candy/categorias', loadComponent: () => import('./candy-categorias/candy-categorias').then(m => m.CandyCategorias) },
    { path: 'candy/productos', loadComponent: () => import('./candy-productos/candy-productos').then(m => m.CandyProductos) },
    {
        path: 'candy/productos/nuevo',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./producto-form/producto-form').then(m => m.ProductoForm),
    },
    {
        path: 'candy/productos/:id',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./producto-form/producto-form').then(m => m.ProductoForm),
    },
    { path: 'combos', loadComponent: () => import('./combos/combos').then(m => m.Combos) },
    {
        path: 'combos/nuevo',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./combo-form/combo-form').then(m => m.ComboForm),
    },
    {
        path: 'combos/:id',
        canDeactivate: [cambiosGuard],
        loadComponent: () => import('./combo-form/combo-form').then(m => m.ComboForm),
    },

    { path: 'salas', loadComponent: () => import('./salas/salas').then(m => m.Salas) },
    { path: 'salas/:id', loadComponent: () => import('./sala-butacas/sala-butacas').then(m => m.SalaButacas) },
    { path: 'funciones', loadComponent: () => import('./funciones/funciones').then(m => m.Funciones) },
    { path: 'funciones/nueva', loadComponent: () => import('./funcion-form/funcion-form').then(m => m.FuncionForm) },
    { path: 'funciones/recurrente', loadComponent: () => import('./funcion-recurrente-form/funcion-recurrente-form').then(m => m.FuncionRecurrenteForm) },
    { path: 'cupones', loadComponent: () => import('./cupones/cupones').then(m => m.Cupones) },
    
];