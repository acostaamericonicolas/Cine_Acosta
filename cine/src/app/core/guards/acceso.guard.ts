import { inject } from '@angular/core';
import {
    CanActivateChildFn, CanActivateFn, CanMatchFn, Router, UrlTree,
} from '@angular/router';
import { AuthService, Rol } from '../auth.service';

// Verifica que el rol del usuario esté permitido. Espera a que se restaure la sesión.
async function verificarRol(roles: Rol[]): Promise<boolean | UrlTree> {
    const auth = inject(AuthService);   // los inject van ANTES del primer await
    const router = inject(Router);

    await auth.inicializada;

    const rol = auth.rol();
    if (!rol) return router.createUrlTree(['/login']);
    return roles.includes(rol) ? true : router.createUrlTree(['/']);
}

// canActivate: solo exige sesión iniciada. Recuerda a dónde quería ir.
export const authGuard: CanActivateFn = async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.inicializada;

    return auth.logueado()
        ? true
        : router.createUrlTree(['/login'], { queryParams: { volverA: state.url } });
};

// canMatch: si devuelve un UrlTree, Angular redirige sin cargar el módulo lazy
export const adminGuard: CanMatchFn = () => verificarRol(['admin']);
export const empleadoGuard: CanMatchFn = () => verificarRol(['empleado', 'admin']);

// canActivateChild: se ejecuta en cada navegación dentro del panel admin
export const adminChildGuard: CanActivateChildFn = () => verificarRol(['admin']);