import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth.service';
import { Rol } from '../../models/perfil';

// Verifica que el rol del usuario esté permitido. Espera a que se restaure la sesión.
export async function verificarRol(roles: Rol[]): Promise<boolean | UrlTree> {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.inicializada;

    const rol = auth.rol();
    if (!rol) return router.createUrlTree(['/login']);
    return roles.includes(rol) ? true : router.createUrlTree(['/']);
}

// canMatch: si devuelve un UrlTree, Angular redirige sin cargar el módulo lazy
export const adminGuard: CanMatchFn = () => verificarRol(['admin']);
export const empleadoGuard: CanMatchFn = () => verificarRol(['empleado', 'admin']);
// El área de cliente (perfil, compras, puntos) es solo para clientes: el personal no compra (RF-30/33)
export const clienteGuard: CanMatchFn = () => verificarRol(['cliente']);
