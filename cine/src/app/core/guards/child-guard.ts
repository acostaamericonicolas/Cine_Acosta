import { CanActivateChildFn } from '@angular/router';
import { verificarRol } from './role-guard';

// canActivateChild: se ejecuta en cada navegación dentro del panel admin
export const adminChildGuard: CanActivateChildFn = () => verificarRol(['admin']);
