# Cine Acosta

Sistema web para un cine: cartelera, venta de entradas y candy, cupones, puntos, validación de entradas en la puerta y panel de administración.

Trabajo práctico de **Programación IV**.

**App publicada:** [https://cine-acosta.web.app/](https://cine-acosta.web.app/)

## Funcionalidades

| Rol | Qué puede hacer |
|---|---|
| **Visitante** | Ver cartelera, próximamente y detalle con reseñas. Comprar como invitado y buscar su compra con código + mail. |
| **Cliente** | Comprar entradas y candy, usar cupones, crédito y puntos, ver y cancelar sus compras, calificar películas vistas y activar alertas de estreno. |
| **Empleado** | Validar entradas y entregar el candy con el código o el QR. |
| **Admin** | ABM de películas, salas, funciones, candy, combos, cupones y puntos. Alta de personal, reportes, gráficos y log de actividad. |

Algunos detalles:

- **Butacas en tiempo real**: al elegir una butaca se reserva por 10 minutos y los demás la ven ocupada sin recargar.
- **Comprobante** con código único y QR, imprimible o guardable como PDF.
- **Puntos**: 1 punto por peso pagado; cada ítem cuesta en puntos lo mismo que vale en pesos.
- **Catálogo en vivo**: si el admin cambia películas, funciones o precios, las pantallas abiertas se actualizan solas.
- **PWA**: carga rápida, cartelera e imágenes en caché y comprobantes disponibles sin conexión.

## Tecnologías

- **Angular 22**: componentes standalone, signals, Signal Forms, lazy loading.
- **Supabase**: Auth, base de datos Postgres con RLS, Storage y Realtime.
- **Firebase Hosting** para publicar la app.
- **PWA**: instalable, con service worker.

## Estructura

```
cine/src/app/
├── services/      un servicio por tabla o dominio
├── guards/        sesión, rol, hijos del admin y cambios sin guardar
├── pipes/         formatos: pesos, puntos, duración, estrellas, vencimiento...
├── directivas/    tipo de butaca (atributo) y visibilidad por rol (estructural)
├── validators/    validadores reutilizables para Signal Forms
├── models/        interfaces
├── features/      una carpeta por área, con lazy loading
│   ├── publico/   home, detalle, compra, comprobante, login, registro
│   ├── cliente/   perfil, mis compras
│   ├── empleado/  validación
│   └── admin/     panel con barra lateral, ABMs, reportes, actividad
└── shared/        componentes y helpers compartidos
```

Los estilos globales (paleta, botones, formularios, tablas, impresión) están en `styles.css`; cada componente define solo su disposición.

## Decisiones técnicas

- **Un único cliente de Supabase** (`services/supabase.ts`) que comparten todos los servicios, para no tener varias sesiones compitiendo en el mismo navegador.
- **Las reglas de negocio viven en la base**: no solapamiento de funciones, reserva de butacas, confirmación de compra, cancelación y validación son funciones o constraints de Postgres. Angular muestra los mensajes que devuelve la base.
- **La seguridad está en RLS**: los guards solo controlan la navegación; aunque alguien los saltee, la base no le deja leer ni modificar lo que no le corresponde.
- **Si una policy bloquea un `update` o `delete`**, Supabase no devuelve error; por eso se verifica que haya filas afectadas (`shared/permisos.ts`).
- **Errores**: todos los mensajes pasan por `mensajeDeError()` (`shared/errores.ts`) y los códigos de Postgres se traducen a textos claros.
- **Log de actividad** con triggers en la base, así queda registrado aunque el cambio se haga fuera de la app.
- **Fechas**: los horarios se guardan en UTC y se muestran en hora de Argentina; "hoy" se calcula en hora local.

## Adaptaciones respecto del pedido original

| Pedido | Cómo se resolvió |
|---|---|
| Imagen de película por URL | Se sube a Supabase Storage, para evitar links externos rotos |
| Filas J y K accesibles | Unificadas en la fila J; la K no existe |
| Cupón para mayores de 50 | Cupones por edad mínima configurable |
| Contraseña en el registro | Se agregó porque Supabase Auth la necesita |
| PDF de la entrada | Comprobante imprimible con "Guardar como PDF" del navegador |
| Escaneo con cámara | Campo de texto: los lectores de QR USB escriben como un teclado |
| Pagos | Pago simulado con formulario validado |
| Alertas por mail | Aviso dentro de la app cuando abre la venta |
| Exportar a Excel | CSV compatible con Excel en castellano |
| Gráficos | Barras hechas con CSS |
| Asignar rol de empleado a un cliente | El admin crea cuentas nuevas de empleado o admin; nunca se convierte un cliente |
| Reseñas | Solo califica quien compró, después de su función y una sola vez |
