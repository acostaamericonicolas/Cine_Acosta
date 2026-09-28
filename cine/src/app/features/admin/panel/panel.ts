import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface Seccion {
  titulo: string;
  links: { texto: string; ruta: string }[];
}

/**
 * Marco del panel de administración: barra lateral con las secciones agrupadas
 * y, al costado, la pantalla elegida (router-outlet de las rutas hijas de /admin).
 * En celular la barra se pliega detrás de un botón.
 */
@Component({
  selector: 'app-panel',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel {
  readonly secciones: Seccion[] = [
    {
      titulo: 'Catálogo',
      links: [
        { texto: 'Películas', ruta: '/admin/peliculas' },
        { texto: 'Funciones', ruta: '/admin/funciones' },
        { texto: 'Salas', ruta: '/admin/salas' },
      ],
    },
    {
      titulo: 'Candy',
      links: [
        { texto: 'Productos', ruta: '/admin/candy/productos' },
        { texto: 'Categorías', ruta: '/admin/candy/categorias' },
        { texto: 'Combos', ruta: '/admin/combos' },
      ],
    },
    {
      titulo: 'Ventas',
      links: [
        { texto: 'Cupones', ruta: '/admin/cupones' },
        { texto: 'Puntos', ruta: '/admin/recompensas' },
      ],
    },
    {
      titulo: 'Equipo',
      links: [{ texto: 'Personal', ruta: '/admin/usuarios' }],
    },
    {
      titulo: 'Control',
      links: [
        { texto: 'Reportes', ruta: '/admin/reportes' },
        { texto: 'Actividad', ruta: '/admin/actividad' },
      ],
    },
  ];

  abierta = signal(false);   // barra plegable en celular
}
