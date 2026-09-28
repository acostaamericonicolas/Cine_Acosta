import { CanActivateChildFn } from '@angular/router';
import { verificarRol } from './role-guard';

// canActivateChild: se ejecuta en cada navegación dentro del panel admin (sesión primero, después rol)
export const adminChildGuard: CanActivateChildFn = (_ruta, estado) => verificarRol(['admin'], estado.url);
