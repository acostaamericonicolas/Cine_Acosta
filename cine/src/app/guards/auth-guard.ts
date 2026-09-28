import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth as AuthService } from '../services/auth';

// canActivate: solo exige sesión iniciada. Recuerda a dónde quería ir.
export const authGuard: CanActivateFn = async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.inicializada;

    return auth.logueado()
        ? true
        : router.createUrlTree(['/login'], { queryParams: { volverA: state.url } });
};
