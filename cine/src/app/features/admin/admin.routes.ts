import { Routes } from '@angular/router';
import { formGuard } from '../../guards/form-guard';

// Todas las pantallas del admin se muestran dentro del Panel (barra lateral + router-outlet)
export const ADMIN_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./panel/panel').then(m => m.Panel),
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'peliculas' },
            {
                path: 'usuarios',
                canDeactivate: [formGuard],
                loadComponent: () => import('./usuarios/usuarios').then(m => m.Usuarios),
            },
            { path: 'peliculas', loadComponent: () => import('./peliculas/peliculas').then(m => m.Peliculas) },
            {
                path: 'peliculas/nueva',
                canDeactivate: [formGuard],
                loadComponent: () => import('./pelicula-form/pelicula-form').then(m => m.PeliculaForm),
            },
            {
                path: 'peliculas/:id',
                canDeactivate: [formGuard],
                loadComponent: () => import('./pelicula-form/pelicula-form').then(m => m.PeliculaForm),
            },
            {
                path: 'funciones/nueva',
                canDeactivate: [formGuard],
                loadComponent: () => import('./funcion-form/funcion-form').then(m => m.FuncionForm),
            },
            {
                path: 'funciones/:id/editar',
                canDeactivate: [formGuard],
                loadComponent: () => import('./funcion-form/funcion-form').then(m => m.FuncionForm),
            },
            { path: 'candy/categorias', loadComponent: () => import('./candy-categorias/candy-categorias').then(m => m.CandyCategorias) },
            { path: 'candy/productos', loadComponent: () => import('./candy-productos/candy-productos').then(m => m.CandyProductos) },
            {
                path: 'candy/productos/nuevo',
                canDeactivate: [formGuard],
                loadComponent: () => import('./producto-form/producto-form').then(m => m.ProductoForm),
            },
            {
                path: 'candy/productos/:id',
                canDeactivate: [formGuard],
                loadComponent: () => import('./producto-form/producto-form').then(m => m.ProductoForm),
            },
            { path: 'combos', loadComponent: () => import('./combos/combos').then(m => m.Combos) },
            {
                path: 'combos/nuevo',
                canDeactivate: [formGuard],
                loadComponent: () => import('./combo-form/combo-form').then(m => m.ComboForm),
            },
            {
                path: 'combos/:id',
                canDeactivate: [formGuard],
                loadComponent: () => import('./combo-form/combo-form').then(m => m.ComboForm),
            },
            { path: 'salas', loadComponent: () => import('./salas/salas').then(m => m.Salas) },
            { path: 'salas/:id', loadComponent: () => import('./sala-butacas/sala-butacas').then(m => m.SalaButacas) },
            { path: 'funciones', loadComponent: () => import('./funciones/funciones').then(m => m.Funciones) },
            {
                path: 'funciones/recurrente',
                canDeactivate: [formGuard],
                loadComponent: () => import('./funcion-recurrente-form/funcion-recurrente-form').then(m => m.FuncionRecurrenteForm),
            },
            { path: 'cupones', loadComponent: () => import('./cupones/cupones').then(m => m.Cupones) },
            { path: 'recompensas', loadComponent: () => import('./recompensas/recompensas').then(m => m.Recompensas) },
            { path: 'reportes', loadComponent: () => import('./reportes/reportes').then(m => m.Reportes) },
            { path: 'actividad', loadComponent: () => import('./actividad/actividad').then(m => m.Actividad) },
        ],
    },
];
