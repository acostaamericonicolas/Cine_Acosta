import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlSegment, UrlTree } from '@angular/router';
import { Auth as AuthService } from '../services/auth';
import { Rol } from '../models/perfil';

/**
 * A9: primero se controla que haya sesión y después el rol.
 *  1. Sin sesión → al login, recordando a dónde quería ir (volverA).
 *  2. Con sesión pero otro rol → a la home.
 * Espera a que se restaure la sesión guardada (auth.inicializada).
 */
export async function verificarRol(roles: Rol[], destino: string): Promise<boolean | UrlTree> {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.inicializada;

    const rol = auth.rol();
    if (!rol) return router.createUrlTree(['/login'], { queryParams: { volverA: destino } });
    return roles.includes(rol) ? true : router.createUrlTree(['/']);
}

// canMatch recibe los segmentos de la URL pedida: con eso se arma el volverA
const url = (segmentos: UrlSegment[]) => '/' + segmentos.map(s => s.path).join('/');

// canMatch: si no corresponde, Angular redirige SIN descargar el código lazy del área
export const adminGuard: CanMatchFn = (_ruta, segmentos) => verificarRol(['admin'], url(segmentos));
export const empleadoGuard: CanMatchFn = (_ruta, segmentos) => verificarRol(['empleado', 'admin'], url(segmentos));

// canActivate: el área de cliente (perfil, compras, puntos) es solo para clientes: el personal no compra (RF-30/33).
// Va DESPUÉS de authGuard en la ruta, así primero se controla la sesión y después el rol.
export const clienteGuard: CanActivateFn = (_ruta, estado) => verificarRol(['cliente'], estado.url);
