import { Service, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

const CADA_MEDIA_HORA = 30 * 60 * 1000;

/**
 * Versiones nuevas de la app (PWA).
 * El service worker guarda una copia de la web para que abra rápido y sin conexión. Cuando
 * se publica una versión nueva, la descarga por detrás, pero sigue mostrando la vieja hasta
 * que se recargue. Este servicio avisa cuando la nueva ya está lista (la app muestra el aviso
 * "Hay una versión nueva — Actualizar") y recarga al tocarlo.
 * No recarga solo: podría cortar una compra a la mitad.
 */
@Service()
export class Actualizacion {
    private sw = inject(SwUpdate);

    readonly hayVersionNueva = signal(false);

    constructor() {
        // Con ng serve el service worker está apagado (app.config.ts): no hay nada que hacer
        if (!this.sw.isEnabled) return;

        this.sw.versionUpdates.subscribe(evento => {
            if (evento.type === 'VERSION_READY') this.hayVersionNueva.set(true);
        });

        // Si la copia guardada quedó rota (le faltan archivos de su versión), se recarga para traer la nueva
        this.sw.unrecoverable.subscribe(() => document.location.reload());

        // Además de al abrir la app, se buscan versiones nuevas cada media hora y al volver a la pestaña
        setInterval(() => this.buscar(), CADA_MEDIA_HORA);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') this.buscar();
        });
    }

    private buscar() {
        this.sw.checkForUpdate().catch(() => { /* sin conexión: se vuelve a intentar después */ });
    }

    async actualizar() {
        await this.sw.activateUpdate().catch(() => { /* igual se recarga */ });
        document.location.reload();
    }
}
