# Cine Acosta

Sistema web para un cine: cartelera, venta de entradas y candy, cupones, validación de entradas y panel de administración.

Trabajo práctico de **Programación IV** — Angular 22 + Supabase.

---

## Índice

1. [Cómo levantar el proyecto](#1-cómo-levantar-el-proyecto)
2. [Estado de las historias de usuario](#2-estado-de-las-historias-de-usuario)
3. [Estructura y convenciones](#3-estructura-y-convenciones)
4. [Decisiones técnicas](#4-decisiones-técnicas)
5. [Decisiones funcionales por módulo](#5-decisiones-funcionales-por-módulo)
6. [Base de datos (Supabase)](#6-base-de-datos-supabase)
7. [Adaptaciones respecto del pedido original](#7-adaptaciones-respecto-del-pedido-original)

---

## 1. Cómo levantar el proyecto

```bash
cd cine
npm install
npm start          # ng serve → http://localhost:4200
```

La conexión a Supabase está en `cine/src/environments/environment.ts`:

| Variable | Valor |
|---|---|
| `supabaseUrl` | `https://igzqqxtnogghgdqlqhgf.supabase.co` |
| `supabasePublishableKey` | clave *publishable* del proyecto (es pública por diseño; lo que protege los datos son las policies RLS) |

### Scripts SQL

Los cambios de la base a partir de HU-21 están en [`supabase/`](supabase/), numerados. Se ejecutan **en orden** en Supabase → SQL Editor, cada uno completo. Todos se pueden **volver a ejecutar** sin error: usan `if not exists`, `create or replace` y `drop ... if exists` antes de crear policies, constraints y triggers.

| Script | HU | Qué agrega |
|---|---|---|
| `01_preventa.sql` | 21 | columnas de preventa, `hoy_ar()`, `en_preventa()`, `venta_abierta()`, `precio_entrada()` |
| `02_butacas_ocupadas.sql` | 22, 23 | tabla `butacas_ocupadas`, funciones de reserva y Realtime |
| `03_compras.sql` | 17, 24, 25, 26 | tablas `compras`, `entradas`, `compra_items`, función `confirmar_compra` y bloqueo de funciones con ventas |
| `04_puntos.sql` | 30, 31 | tablas `recompensas` y `canjes`; redefine `confirmar_compra` para canjear puntos |
| `05_puntos_por_precio.sql` | 30 | vista `catalogo_canjes`: cada ítem cuesta en puntos lo que vale en pesos; `recompensas` guarda solo las excepciones |
| `06_canje_descuenta.sql` | 31 | canjear un producto del carrito descuenta sus pesos (antes lo agregaba gratis) |
| `07_comprobante.sql` | 27 | función `obtener_comprobante` (dueño, admin, o invitado con código + mail) |
| `08_cancelar_compra.sql` | 28 | función `cancelar_compra`: crédito, puntos y butacas liberadas |
| `09_validacion.sql` | 32, 33 | `es_empleado()`, `validar_entrada` y `entregar_candy` |
| `10_personal.sql` | 34 | `alta_personal`; nadie cambia roles; cupón solo para clientes; el personal no compra |

Lo anterior (tablas, triggers y policies de las HU 01 a 20) se creó directamente en Supabase y está documentado en la [sección 6](#6-base-de-datos-supabase).

En Supabase → Authentication, la **confirmación de mail tiene que estar desactivada**: el registro necesita una sesión activa para insertar el perfil (ver [4.4](#44-registro-en-dos-pasos)).

---

## 2. Estado de las historias de usuario

| HU | Descripción | Estado |
|---|---|---|
| 01 | Base, rutas lazy por área, servicio único de Supabase | Hecha |
| 02 | Registro con perfil y cupón de primera compra | Hecha |
| 03 | Login / logout, sesión persistente, redirección por rol | Hecha |
| 04 | Guards `canActivate`, `canMatch`, `canActivateChild`, `canDeactivate` | Hecha |
| 06 | ABM de películas | Hecha |
| 07 | Home con top 3 más vendidas y tarjeta reutilizable | Hecha |
| 08 | Búsqueda por nombre y filtro por géneros | Hecha |
| 09 | Detalle de película con reseñas y funciones | Hecha |
| 13 | Salas, butacas y precios por tipo | Hecha |
| 14 | Alta de función con asignación automática de sala | Hecha |
| 15 | Funciones recurrentes con resumen | Hecha |
| 16 | Inputs nativos de fecha y hora | Hecha |
| 17 | Editar / eliminar funciones | Hecha (el bloqueo por entradas vendidas está en `supabase/03_compras.sql`) |
| 18 | Categorías y productos del candy | Hecha |
| 19 | Combos a precio fijo | Hecha |
| 20 | Configuración de cupones | Hecha (la aplicación en la compra se completa con HU-26) |
| 21 | Preventa por película | Hecha (requiere `supabase/01_preventa.sql`) |
| 22 | Mapa de butacas para elegir | Hecha (requiere `supabase/02_butacas_ocupadas.sql`) |
| 23 | Butacas ocupadas en tiempo real | Hecha con Supabase Realtime (requiere `supabase/02_butacas_ocupadas.sql`) |
| 24 | Control de edad | Hecha (requiere `supabase/03_compras.sql`) |
| 25 | Candy y combos en la compra | Hecha (requiere `supabase/03_compras.sql`) |
| 26 | Revisar y pagar (puntos, cupón, crédito, pago simulado) | Hecha (requiere `supabase/03_compras.sql` y `04_puntos.sql`) |
| 29 | 1 punto por peso pagado | Hecha dentro de `confirmar_compra` (movimientos: `compras.puntos_ganados` y `canjes`) |
| 30 | Costo en puntos de cada recompensa | Hecha: por defecto igual al precio, editable (requiere `supabase/04_puntos.sql` y `05_puntos_por_precio.sql`) |
| 31 | Canjear puntos | Hecha, dentro de la compra (requiere `supabase/04_puntos.sql`) |
| 05 | Perfil: puntos, crédito, cupones, historial de canjes | Hecha ("Mis películas" se llena con HU-12) |
| 28 | Mis compras y cancelación hasta 2 h antes | Hecha (requiere `supabase/08_cancelar_compra.sql`) |
| 27 | Comprobante con código único y QR, imprimible / PDF | Hecha (requiere `supabase/07_comprobante.sql`). Incluye "Buscar mi compra" para invitados. |
| 32 | Validar la entrada con el código / QR | Hecha (requiere `supabase/09_validacion.sql`) |
| 33 | Entregar el candy con el mismo código | Hecha (requiere `supabase/09_validacion.sql`) |
| 34 | Alta de personal (empleado u otro admin) | Hecha **con un cambio pedido**: el admin crea cuentas nuevas, no convierte clientes (requiere `supabase/10_personal.sql`) |
| Resto | Semanas 3 y 4 | Pendiente |

---

## 3. Estructura y convenciones

```
cine/src/app/
├── core/                  servicios (uno por tabla o dominio) y guards
│   ├── guards/            auth-guard, role-guard, child-guard, form-guard
│   └── *.service.ts
├── models/                interfaces y tipos de datos (sin lógica)
├── features/              una carpeta por área, cada una cargada con lazy loading
│   ├── publico/           home, detalle, compra, comprobante, buscar-compra, login, registro
│   ├── cliente/           perfil, mis-compras
│   ├── empleado/          validación
│   └── admin/             ABMs del panel
└── shared/                lo que usan varias áreas
    ├── componentes/       tarjeta-pelicula, mapa-butacas, codigo-qr
    ├── pipes/             duracion-pipe, estrellas-pipe
    ├── sala-layout.ts     distribución fija de butacas
    ├── fechas.ts          fecha local, edad, sumar días (ver 4.8)
    ├── precios.ts         precio de entrada con preventa (solo para mostrar)
    └── ...
```

**Por qué esta estructura.** HU-01 pide cuatro áreas (público, cliente, empleado, admin) con lazy loading. Una carpeta por área hace que cada `*.routes.ts` cargue solo sus componentes. `core/` y `shared/` evitan que un área importe cosas de otra.

**Convenciones tomadas de los ejemplos de clase (`A342-2-main`):**

| Convención | Ejemplo de referencia |
|---|---|
| Componentes standalone con archivos `nombre.ts / .html / .css` y clase sin sufijo (`Login`, `Home`) | todos |
| Servicios con `@Service()` (el decorador de Angular 22, singleton global) | `ejemploSupabase`, `guards` |
| Interfaces en `models/`, separadas del servicio | `ejemploSupabase/models`, `guards/models` |
| Un archivo por guard: `auth-guard`, `role-guard`, `child-guard`, `form-guard` | `guards` |
| Formularios con **Signal Forms** (`form`, `FormField`, `required`, `validate`…) | `ejemploSupabase` |
| Comunicación padre/hijo con `input()` / `output()` | `ejemploInputOutput` |
| Contenido proyectado con `ng-content` | `directivas` (carta-personaje) |
| Pipes propios `nombre-pipe.ts` | `pipes` |
| Rutas con `loadComponent` / `loadChildren` | `rutas`, `modulos` |
| Estado de pantalla en `signal` y derivados en `computed` | todos |

**Una diferencia a propósito con el ejemplo:** en `ejemploSupabase` cada servicio crea su propio cliente con `createClient`. Acá hay **un único `SupabaseService`** y el resto de los servicios le piden el cliente. HU-01 lo pide así y, además, varios clientes en el mismo navegador compiten por la misma sesión guardada.

**Única excepción:** `SupabaseService.crearClienteSinSesion()` crea un cliente aparte, con `persistSession: false` y su propio `storageKey`. Lo usa solo el alta de personal (HU-34): con el cliente principal, `signUp` reemplazaría la sesión del admin por la de la cuenta nueva.

---

## 4. Decisiones técnicas

### 4.1 Servicios con `async/await` y errores con `throw`

Cada método de servicio hace la consulta, y si Supabase devuelve `error` lo lanza. Los componentes usan `try / catch / finally` con tres señales: `cargando`, `error` y, si corresponde, `mensaje`. Así cada pantalla muestra carga, error y éxito de la misma manera (HU-38).

Los códigos de error de Postgres se traducen a mensajes claros en el servicio, no en el componente:

| Código | Significado | Ejemplo de mensaje |
|---|---|---|
| `23505` | valor único repetido | "Ya existe una sala con ese nombre" |
| `23503` | clave foránea (hay datos que dependen) | "No se puede eliminar: tiene funciones asociadas. Ocultala en su lugar." |
| `23P01` | constraint de exclusión (solapamiento) | "Ese horario se superpone con otra función…" |

### 4.2 Detectar cuando una policy bloquea un cambio

Si una policy RLS no permite un `update` o `delete`, Supabase **no devuelve error**: simplemente no toca ninguna fila. Por eso los `update` y `delete` terminan en `.select()` y, si vuelven 0 filas, se lanza "No tenés permiso para hacer este cambio". Sin esto, la pantalla mostraría "guardado" aunque no se haya guardado nada.

### 4.3 Sesión y guards

- `AuthService` guarda el perfil en una señal. `logueado` y `rol` son `computed` y la navbar se actualiza sola.
- Al arrancar la app, `restaurarSesion()` recupera la sesión que Supabase guarda en el navegador (HU-03: la sesión persiste al recargar). Esa promesa queda en `auth.inicializada`.
- **Los guards esperan `auth.inicializada`** antes de decidir. Si no, al recargar `/admin` el guard correría antes de que se cargue el perfil y mandaría al usuario al login.
- Los guards devuelven un `UrlTree` en vez de `false` + `router.navigate`. Así la redirección forma parte de la misma navegación y no se hace una segunda.

| Guard | Tipo | Dónde | Por qué ese tipo |
|---|---|---|---|
| `authGuard` | `canActivate` | `/cliente` | Solo pide sesión. Si no hay, manda al login con `?volverA=` para volver después. |
| `adminGuard`, `empleadoGuard` | `canMatch` | `/admin`, `/empleado` | Si no corresponde, **no se descarga el código lazy** del área. El admin también puede entrar a `/empleado`. |
| `clienteGuard` | `canMatch` | `/cliente` | Perfil, compras y puntos son **solo para clientes**. El personal no compra (HU-34). |
| `adminChildGuard` | `canActivateChild` | hijos de `/admin` | Se vuelve a verificar en cada navegación interna del panel (por ejemplo, si la sesión se cerró en otra pestaña). |
| `formGuard` | `canDeactivate` | formularios de admin y registro | Pregunta antes de salir si hay cambios sin guardar. |

Para `formGuard`, cada formulario implementa `ConCambios.hayCambios()`. Guarda un `JSON.stringify` del modelo inicial (o del que se cargó al editar) y lo compara con el actual. Así, cargar datos para editar no cuenta como "cambio", y después de guardar no se vuelve a preguntar.

El parámetro `volverA` solo se acepta si empieza con `/` y no con `//`, para que no se pueda usar el login para redirigir a otro sitio.

> Los guards solo controlan la navegación. **La seguridad real de los datos está en las policies RLS** de Supabase (ver [6.3](#63-seguridad-rls)).

### 4.4 Registro en dos pasos

1. `auth.signUp` crea el usuario en Supabase Auth (mail + contraseña; la contraseña no estaba en el pedido, pero Auth la necesita).
2. Con la sesión recién creada se hace `insert` en `perfiles` con el mismo `id`.

Por eso la confirmación de mail tiene que estar desactivada: sin sesión, la policy de `perfiles` no deja insertar. Si Supabase la pide, se muestra un mensaje que lo explica.

El `rol` **no se envía desde el cliente**: toma el valor por defecto `cliente` en la base. Así nadie puede registrarse como admin editando la petición.

### 4.5 Imágenes con Supabase Storage

El backlog proponía guardar una URL porque Storage no se vio en clase. **Se usa Storage con aprobación del docente**, porque cargar a mano una URL externa es propenso a errores (links rotos, imágenes que cambian).

- Un único `ImagenesService` para los tres buckets públicos: `posters`, `candy` y `combos`.
- Solo JPG, PNG o WebP, hasta 2 MB. Se valida antes de subir y se muestra una vista previa con `URL.createObjectURL`, que se libera al salir de la pantalla.
- El archivo se guarda con un nombre `uuid.ext` para que dos imágenes con el mismo nombre no se pisen.
- En la tabla se guardan dos columnas: `imagen_url` (para mostrar) e `imagen_path` (para poder borrar el archivo).
- **Orden al guardar:** primero se sube el archivo, después se guarda la fila.
  - Si la fila falla, se borra el archivo recién subido para no dejar huérfanos.
  - Si se reemplazó la imagen, se borra la anterior.
  - Al eliminar la entidad, se borra su imagen.
  - Los borrados de archivos son "best effort": si fallan, no se interrumpe la operación principal.

### 4.6 Signal Forms

- Los `<select>` trabajan con texto, así que los modelos de formulario guardan ids como `string` (`peliculaId: '3'`) y se convierten a número al guardar.
- Las validaciones que no vienen incluidas se hacen con `validate()`: fecha de nacimiento no futura, al menos un género, "hasta" posterior a "desde".
- Los errores se muestran solo si el campo fue `touched()`, para no llenar de rojo un formulario vacío.
- El botón de enviar queda deshabilitado mientras el formulario es inválido o se está guardando, para evitar doble envío.

### 4.7 Componentes compartidos

- **`TarjetaPelicula`** recibe la película con `input.required()` y proyecta con `<ng-content>` lo que el padre ponga adentro. La home lo usa para la insignia "Más vendida #N" sin que la tarjeta sepa nada del ranking (HU-07).
- **`MapaButacas`** no sabe quién lo usa. Recibe listas de ids (`deshabilitadas`, `ocupadas`, `seleccionadas`) y emite `butacaClick`. El admin lo usa para habilitar o deshabilitar butacas, y la compra (HU-22) lo va a usar para elegir butacas. Las listas se convierten a `Set` con `computed` para que consultar el estado de 518 butacas sea rápido.

### 4.8 Fechas y horarios

- Los horarios de las funciones se guardan como `timestamptz` (en UTC). El admin los carga en hora local, `new Date('AAAA-MM-DDTHH:mm')` los interpreta en hora local y `toISOString()` los pasa a UTC. Al mostrarlos, el `DatePipe` los vuelve a hora local.
- **"Hoy" se calcula con `fechaLocal()`** (`shared/fechas.ts`), no con `toISOString().slice(0, 10)`: esa fecha está en UTC y en Argentina, después de las 21 h, ya daría el día siguiente.
- La app registra el locale `es-AR` (`LOCALE_ID`) para que las fechas y la moneda salgan en castellano y con el formato local.

---

## 5. Decisiones funcionales por módulo

### 5.1 Películas (HU-06)

- Estados: **cartelera** (se ve en la home y se venden entradas), **próximamente** (se ve el detalle con la fecha de estreno, sin venta) y **oculta** (solo la ve el admin).
- Una película puede tener **varios géneros** (columna `text[]`). La lista de géneros es fija (`shared/generos.ts`) para que no aparezcan variantes como "Accion" y "Acción".
- Restricción de edad: 0 (apta todo público), 13 o 18.
- **No se puede eliminar una película con funciones o reseñas** (lo impide la clave foránea). El mensaje sugiere ocultarla, así no se pierde el historial.
- El estado se puede cambiar directo desde la tabla, sin entrar a editar.

### 5.2 Home, búsqueda y filtros (HU-07, HU-08)

- La home muestra las películas que **hoy tienen la venta abierta**: las "en cartelera" y las "próximamente" que ya están en preventa, con la insignia "Preventa · estreno dd/MM". La consulta filtra por la columna calculada `venta_abierta` (`.eq('venta_abierta', true)`), así la regla de fechas está solo en la base. Las "próximamente" sin preventa van a ir en la sección Próximamente (HU-11).
- La consulta ya viene ordenada por `vendidas` (de mayor a menor) y, si empatan, por nombre. Las **3 primeras con al menos una venta** llevan la insignia: si no hubo ventas, no se inventa un ranking.
- Todo el filtrado es `computed` sobre la lista ya cargada, sin volver a consultar la base.
- La búsqueda ignora mayúsculas y tildes ("amelie" encuentra "Amélie").
- **Filtro por géneros: la película tiene que tener todos los géneros elegidos** (Y). Elegir "Acción" + "Comedia" reduce los resultados en vez de ampliarlos, que es lo que se espera al combinar filtros. Solo se ofrecen los géneros que existen en la cartelera actual.
- Si no hay resultados, se muestra un mensaje y un botón para limpiar los filtros.

### 5.3 Detalle de película (HU-09)

- Si la película no existe o está oculta (la policy no la devuelve), se muestra "No encontramos la película".
- El promedio de estrellas se calcula en el cliente a partir de las reseñas cargadas.
- Se muestran 5 reseñas y un botón "Ver todas" para no alargar la página.
- Las funciones futuras se agrupan por día, con hora, formato, idioma y botón "Comprar".
- Reseñas y funciones se piden en paralelo con `Promise.allSettled`: si una falla, la otra se muestra igual.
- Si hay restricción de edad se aclara "Debe asistir un adulto" (HU-24).

### 5.4 Salas y butacas (HU-13)

**Distribución de la sala:**

- 19 filas: A–J y L–T.
- **Las filas J y K del enunciado se unificaron en una sola fila accesible, la J**. Por eso no existe la K y después de la J sigue la L.
- Cada fila tiene 3 bloques de 4 / 20 / 4 lugares, numerados del 1 al 28 de corrido.
- La fila J tiene 2 / 10 / 2 butacas accesibles (números 2–3, 10–19 y 26–27). El resto de sus lugares quedan como huecos para sillas de ruedas y acompañantes.
- Las filas R, S y T son VIP.
- Total: **518 butacas** (18 filas × 28 + 14 accesibles).

**Por qué la distribución está en el código y no en la base:** todas las salas son iguales, así que la forma se genera en `shared/sala-layout.ts`. En la base solo se guardan **las excepciones**, en `butacas_deshabilitadas`. Así no hay que crear 518 filas por sala, y agregar una sala es solo insertar su nombre.

**Otras reglas:**

- **Precios por tipo de butaca** (general, accesible, VIP), iguales para todas las salas. El precio VIP tiene que ser mayor que el general.
- Las salas **no se eliminan, se desactivan**: una sala desactivada no recibe funciones nuevas, pero las que ya tenía se siguen viendo.

### 5.5 Funciones (HU-14 a HU-17)

- **La regla de no solapamiento vive en la base**, no en Angular (ver [6.2](#62-funciones-y-no-solapamiento)). Entre el fin de una función y el inicio de la siguiente en la misma sala tiene que haber al menos 30 minutos para la limpieza y el cambio de público.
- **Asignación automática:** se intenta insertar la función en cada sala activa, en orden. Si la base responde `23P01` (solapamiento), se prueba la siguiente sala. Si ninguna tiene lugar, se muestra "No hay ninguna sala libre en ese horario".
  - Se hace así para que **dos admins cargando funciones al mismo tiempo no puedan pisarse**: si el cliente calculara los huecos, entre la consulta y el insert otro podría ocupar la sala.
- **Recurrentes:**
  - Se eligen días de la semana, hora y rango de fechas.
  - Antes de crear, se muestra cuántas funciones se van a generar.
  - Las funciones se crean **una por una, en orden**, para que cada una tenga en cuenta las anteriores.
  - Al final se muestra un resumen por fecha: la sala asignada o el motivo del fallo.
- **Edición:** el admin elige la sala a mano, y la base vuelve a validar el solapamiento.
- **Con entradas vendidas no se puede borrar ni mover** (horario, sala o película): lo impiden la FK de `compras` y el trigger `funciones_bloquear_con_ventas`. Ver [6.2.8](#628-confirmar-la-compra-hu-24-hu-25-hu-26--supabase03_comprassql).
- En los formularios no se ofrecen las películas ocultas. El listado muestra los próximos 30 días para no traer todo el historial.

### 5.6 Candy y combos (HU-18, HU-19)

- Las categorías tienen un campo `orden` para decidir en qué orden aparecen en la compra. **No se puede eliminar una categoría que tenga productos.**
- Productos con precio, categoría, imagen obligatoria y un estado `activo`. **Un producto que está en un combo no se puede eliminar**: se desactiva.
- Un combo tiene precio fijo, imagen, estado activo, un indicador de si **incluye entrada** y una lista de productos con cantidad (`combo_items`). Solo se pueden elegir productos activos.
- Al editar un combo, sus items se reemplazan: se borran todos y se insertan de nuevo. Es más simple que calcular diferencias, y un combo tiene pocos items.

### 5.7 Cupones (HU-20)

- **Primera compra:** hay un único porcentaje configurable (`config_cupon_primera_compra`, fila `id = 1`). Al registrarse, a cada usuario se le asigna un cupón **con el porcentaje vigente en ese momento** (`cupones_primera_compra_usuario`). Si después cambia el porcentaje, solo afecta a los registros siguientes.
- **Por edad:** el pedido hablaba de mayores de 50. Se generalizó a **edad mínima configurable** (50, 60, 65…), con porcentaje, fechas de vigencia y un estado activo. La edad se va a validar con la fecha de nacimiento del perfil al momento de pagar (HU-26).
- En el admin, cada cupón muestra su estado calculado: Vigente, Programado, Vencido o Desactivado.

### 5.8 Perfil (HU-05)

- Muestra lo que pide RF-05: **puntos acumulados**, **crédito disponible**, **historial de canjes** y **"Mis películas"**, más los cupones y los datos del registro.
- Al entrar se vuelve a leer el perfil (`auth.refrescarPerfil()`), porque el crédito y los puntos cambian con compras y cancelaciones y la señal tenía el valor del login.
- **Cupones:** el de primera compra (disponible o usado) y los cupones por edad que **hoy** le corresponden: activos, dentro de la vigencia y con la edad mínima alcanzada. La edad se calcula con `edad()` de `shared/fechas.ts`, que compara las fechas como texto para no caer en el corrimiento de UTC; la compra (HU-26) usa la misma función.
- **Historial de canjes** y **"Mis películas"** muestran por ahora un estado vacío: las tablas de canjes y entradas todavía no existen.
- Los datos personales son **solo de lectura**. La fecha de nacimiento no se puede cambiar porque habilita los cupones por edad; la policy de `perfiles` no permite `update` al cliente, y eso también protege `rol`, `credito` y `puntos`.

### 5.9 Preventa (HU-21)

- El admin activa la preventa en el formulario de la película y carga un **precio de preventa**. Es obligatorio si la preventa está activada; lo valida el formulario y también un `check` en la base.
- La venta abre **7 días antes del estreno**. Hasta el día anterior al estreno, las butacas generales y accesibles cuestan el precio de preventa y la VIP suma su recargo de siempre. Desde el estreno vuelve al precio normal, sin que nadie tenga que cambiar nada.
- Mientras dura, la película aparece en la home con la insignia "Preventa". El detalle muestra "La preventa abre el …" antes de que abra, y un aviso con el precio mientras dura.
- Una película en "próximamente" sin preventa abre la venta el día del estreno.
- La fecha la evalúa la base (`venta_abierta`, `en_preventa`) con la hora de Argentina, no el reloj de la PC del usuario. Ver [6.2.6](#626-preventa-hu-21--supabase01_preventasql).

### 5.10 Compra: elegir butacas en tiempo real (HU-22, HU-23)

- Ruta pública **`/comprar/:funcionId`**, a la que se llega con el botón "Comprar" del detalle. No hace falta sesión (RF-02).
- Se reutiliza **`MapaButacas`**: la compra le pasa las butacas deshabilitadas, las **ocupadas por otros** y las **seleccionadas por mí**, y activa la leyenda de estados.
- Tocar una butaca libre la **reserva por 10 minutos**, y todas vencen juntas. Volver a tocarla la libera. El resumen muestra un reloj con el tiempo que queda, el precio de cada butaca y el total.
- **Tiempo real con Supabase Realtime (aprobado por el docente):** cuando otra persona reserva, compra o libera una butaca, el mapa cambia sin recargar.
- Antes de pagar ya se ve si hay una **butaca VIP** (RF-19) y, si la película es +13 o +18, que **debe asistir un adulto** (RF-20).
- Todo el control está en la base, que devuelve mensajes claros ("La butaca J-10 la está reservando otra persona", "Podés reservar hasta 10 butacas por compra"). Ver [6.2.7](#627-reserva-de-butacas-en-tiempo-real-hu-22-hu-23--supabase02_butacas_ocupadassql).

### 5.11 Compra completa: edad, candy y pago (HU-24, HU-25, HU-26)

La compra es **una sola pantalla con pasos** (cómo comprar → edad → butacas → candy → pago → confirmación). Si fueran rutas distintas, al cambiar de ruta se destruiría el componente y se liberarían las butacas. Las reservas se sueltan solo si el usuario se va sin comprar.

- **Cómo comprar (RF-02):** si no hay sesión, el primer paso ofrece **Iniciar sesión**, **Crear cuenta** o **Seguir como invitado**. Login y registro reciben `?volverA=/comprar/:id`, y después de ingresar o registrarse vuelven a la misma compra; el link entre login y registro conserva ese parámetro. Solo se aceptan rutas internas (que empiecen con `/` y no con `//`), para que nadie pueda usar el link para mandar a otro sitio. Con sesión, este paso no aparece.
- **Edad (HU-24, RF-20):**
  - Si la película es +13 o +18, el **registrado** se controla con la fecha de su perfil: si no llega, ni siquiera ve el mapa.
  - El **anónimo** ingresa su fecha de nacimiento **antes de elegir butacas**. Si no llega a la edad, no puede seguir.
  - La base lo vuelve a controlar al confirmar.
  - Toda entrada restringida muestra "debe asistir un adulto".
  - Las películas aptas para todo público no piden la fecha.
- **Candy (HU-25):** componente `PasoCandy` (`input()` / `output()`, sin estado propio).
  - Los **combos van primero y destacados**, con la etiqueta "Incluye entrada" y el detalle ("2 × Pochoclo grande").
  - Después van los productos agrupados por categoría, en el orden del admin. Cada ítem tiene botones − / + (de 0 a 20).
  - Si hay más combos con entrada que butacas, avisa y no deja continuar.
  - Se puede seguir sin candy.
- **Pago (HU-26):** componente `PasoPago`.
  - **Desglose:** cada entrada con su tipo (la VIP resaltada), el candy, lo que cubren los combos, el cupón y el crédito.
  - **Aviso VIP** (RF-19) y aviso de adulto.
  - **Registrado:** elige **un** cupón (primera compra o por edad, el mejor vigente) y puede usar su crédito.
  - **Registrado:** arriba ve **cuántos puntos y cuánto crédito tiene**, y puede **canjear puntos** (ver 5.13).
  - **Anónimo:** ingresa su mail. Los puntos, los cupones y el crédito son solo para registrados: la fecha del anónimo es declarada y no se puede verificar.
  - **Pago simulado con tarjeta:** titular, 16 dígitos, vencimiento MM/AA no vencido y código. Se pide solo si queda algo por pagar. La tarjeta no se guarda: solo "Tarjeta terminada en 1234".
- **Confirmación:** se muestra el **código de compra**, lo pagado y los puntos ganados. El comprobante imprimible con QR es HU-27.
- **Errores:** cualquier falla de `confirmar_compra` se muestra con el paso donde ocurrió y el mensaje exacto de la base. Ver [6.2.8](#628-confirmar-la-compra-hu-24-hu-25-hu-26--supabase03_comprassql).

### 5.12 Reglas de compra acordadas

Surgieron de revisar las historias contra los requerimientos funcionales:

| Tema | Regla | HU |
|---|---|---|
| Combo con entrada | Cubre 1 entrada general; si la butaca es VIP se cobra la diferencia (**hecho**) | 19, 25 |
| Cupones | Uno por compra (primera compra **o** por edad), combinable con crédito y pago (**hecho**; solo registrados) | 26 |
| Cancelación | Se restan los puntos que dio esa compra y se devuelven los canjeados; el cupón usado no se devuelve (**hecho**) | 28 |
| Canje de puntos | Se aplica dentro de la compra: entrada o producto a $0 pagado con puntos | 31 |
| Comprador anónimo | Pantalla "Buscar mi compra" con mail + código | 26, 27 |
| Comprobante | Código único con QR (librería `qrcode`) | 27 |
| Preventa | Precio fijo por película para general y accesible; la VIP suma su recargo (**hecho**) | 21 |
| Alerta de estreno | Avisa cuando se abre la venta (preventa, o estreno si no hay) | 11 |
| Log de actividad | Con triggers en la base, no desde Angular | 37 |

### 5.13 Puntos y canjes (HU-29, HU-30, HU-31)

- **Ganar (HU-29):** 1 punto por cada peso **efectivamente pagado**, es decir, después de cupón, crédito y canjes. Solo para registrados. Lo suma `confirmar_compra`.
- **Configurar (HU-30):** como 1 peso pagado da 1 punto, **cada ítem cuesta en puntos lo mismo que vale en pesos**, redondeado hacia arriba. Eso vale para la **entrada general** (precio general) y para **cada producto activo del candy**. No hace falta cargar nada: un producto nuevo ya es canjeable, y si cambia el precio, el costo en puntos cambia solo.
  - En **Admin → Puntos** aparecen todos los ítems con su precio y sus puntos. El admin puede **fijar otro costo**, **volver al precio** o **desactivar el canje** de un ítem.
  - Solo se guardan esas excepciones. Si un ítem vuelve al precio y está activo, su fila se borra.
- **Canjear (HU-31):** canjear es **pagar con puntos en lugar de pesos**. En el paso de pago, el registrado ve su saldo y suma canjes con − / +, sin pasarse de sus puntos.
  - **Entrada:** cubre el valor de una entrada general, como un combo con entrada. Si la butaca es VIP, se paga la diferencia. Entre combos y canjes no se pueden cubrir más entradas que butacas.
  - **Producto:** solo se pueden canjear productos **que ya están en la compra**, hasta la cantidad elegida en el candy. Su precio se descuenta del total: 4 pochoclos de $ 10.000 canjeados restan $ 40.000 y cuestan 40.000 puntos. En `compra_items` queda la parte pagada en pesos y, aparte, la canjeada a $0 ("Pochoclos (canje)"). Todo se retira en el candy con el mismo código.
  - Primero se canjeaba un producto **agregándolo gratis**. Se cambió en el script 06 porque así el cliente terminaba pagando y canjeando lo mismo dos veces.
- Los canjes se descuentan en la misma transacción que la compra y quedan en `canjes`. El perfil los muestra en **Historial de canjes**.
- **Intransferibles (RF-29):** no existe ninguna función para mover puntos entre usuarios. El cliente no puede modificar `perfiles.puntos` (no hay policy de update), así que solo cambian a través de `confirmar_compra`.

### 5.14 Comprobante con QR (HU-27) y "Buscar mi compra"

- Al confirmar la compra se muestra el **código** y su **QR**, con un botón **"Ver comprobante / Guardar como PDF"**.
- **Ruta `/comprobante/:codigo`:** comprobante imprimible con:
  - película, fecha y hora, sala, formato, idioma y duración;
  - cada butaca con su tipo;
  - aviso de **"debe asistir un adulto"** si la película es +13 o +18;
  - candy (pendiente o entregado);
  - el desglose del pago, el QR y el código.

  Si la compra fue cancelada o ya se usó, lo indica arriba.
- **PDF:** "Imprimir / Guardar como PDF" usa la impresión del navegador (`window.print()`), así no hace falta una librería de PDF. Con `@media print` se ocultan la barra de navegación y los botones, y el comprobante ocupa la hoja.
- **QR:** componente compartido **`CodigoQr`** (`input()` con el código), que genera la imagen con la librería **`qrcode`** (aprobada). El QR contiene **solo el código**: el lector de la puerta lo "escribe" como un teclado en el campo de validación del empleado (HU-32). Si el QR no se pudiera generar, el código impreso alcanza.
- **Quién lo ve:**
  - **registrado:** con solo el código, desde la compra (y después desde "Mis compras", HU-28);
  - **invitado:** con **código + mail**. Justo después de comprar no se le pide: el mail queda recordado en la pestaña (`sessionStorage`);
  - **admin:** cualquiera.
- **"Buscar mi compra"** (`/mi-compra`, en el menú cuando no hay sesión): el invitado ingresa código y mail y va al comprobante. Si no coinciden, el mensaje es el mismo que si el código no existiera. Así nadie puede probar códigos para averiguar cuáles son válidos.

### 5.15 Mis compras y cancelación (HU-28)

- **"Mis compras"** (`/cliente/compras`, en el menú y desde el perfil): lista de compras con póster, función, sala, cantidad de entradas, total, código y estado. Los estados son **Vigente**, **Función pasada**, **Usada** y **Cancelada**. Cada compra tiene un link a su comprobante.
- **Cancelar:** el botón aparece solo en compras vigentes con **más de 2 horas** por delante. Dentro de las 2 horas se avisa que ya no se puede.
  - Antes de confirmar, se muestra cuánto crédito vuelve y qué pasa con los puntos.
  - **No se devuelve dinero (RF-26):** vuelve como **crédito** lo pagado más el crédito que se había usado.
  - **Puntos:** se **restan los ganados** con esa compra y se **devuelven los canjeados**. En el historial del perfil, el canje figura como "devuelto".
  - **Cupón:** si se usó uno, **no se devuelve** (punto c acordado).
  - **Butacas:** quedan libres. Los mapas abiertos lo ven al instante por Realtime.
  - **Código:** deja de valer. El comprobante muestra "Compra cancelada".
  - Las entradas dejan de contar en el ranking de la home.
- **Regla agregada:** si el cliente **ya gastó los puntos** que le dio la compra, no puede cancelarla. Si no, podría comprar, canjear esos puntos en otra compra y cancelar la primera, quedándose con puntos gratis.
- Solo el cliente registrado dueño de la compra puede cancelar (el backlog lo pide para registrados). El invitado no tiene crédito donde recibir el monto.

### 5.16 Validación en la puerta y entrega del candy (HU-32, HU-33)

- Pantalla **Validar** (`/empleado`), para empleados y también para el admin. Tiene dos modos: **Entrada** y **Candy**.
- **Un solo campo de texto** para el código. Sirve para tipearlo a mano (RF-31) y para los **lectores de QR USB**, que "escriben" el código y mandan Enter como un teclado. Por eso no hace falta acceso a la cámara. Después de cada validación, el campo se vacía y **recupera el foco**, así el empleado puede escanear el siguiente sin tocar nada.
- **Entrada (HU-32):**
  - Opcionalmente, el empleado elige **la función que controla** (lista de las funciones de hoy). Si el código es de otra función, se rechaza y el mensaje dice cuál es la correcta.
  - Si es válida, muestra la película, la función, la sala, las **butacas** (cuántas personas entran), el aviso de adulto y si tiene candy pendiente.
  - Marca **todas las entradas de la compra** como usadas, porque el grupo entra junto, y la compra pasa a "Usada". El código **ya no sirve para entrar** (RF-32).
- **Candy (HU-33):** es **independiente de la entrada**: se puede retirar antes o después de entrar, pero una sola vez. Muestra la lista de lo que hay que entregar (incluidos los canjes) y lo marca como entregado.
- **Mensajes claros** (vienen de la base):
  - "No existe ninguna compra con el código X";
  - "La compra X fue cancelada";
  - "Estas entradas ya se usaron: ingresaron el 27/09 17:42";
  - "Esta entrada es para otra función: …";
  - "La función ya terminó";
  - "El candy de esta compra ya se entregó el …";
  - "La compra no tiene candy".
- El resultado se muestra **grande, verde o rojo**, para verlo de un vistazo. Abajo quedan las **últimas 10 validaciones**.
- Una vez validada la entrada o entregado el candy, la compra no se puede cancelar (HU-28).

### 5.17 Personal y roles (HU-34, con cambio)

- **Cambio pedido respecto del backlog:** el backlog decía "el admin asigna el rol de empleado a un usuario registrado". Se cambió por **el admin da de alta cuentas nuevas** de **empleado** o de **otro admin**, en **Admin → Personal**, con nombre, apellido, fecha de nacimiento, mail y contraseña inicial.
- **Nunca se convierte a un cliente en personal**, ni al revés. Si el mail ya pertenece a alguien, el alta se rechaza: "El mail x ya pertenece a un cliente. El personal se crea con un mail nuevo…". En la base **nadie puede cambiar roles**: se quitó la policy que permitía modificar perfiles.
- **Cada rol tiene solo lo que dicen los RF:**

| Rol | Puede | No puede |
|---|---|---|
| Cliente | Comprar, perfil, mis compras, puntos, cupones, cancelar | Validar, panel de admin |
| Empleado (RF-30 a RF-32) | **Solo validar entradas y entregar candy** | Comprar, perfil de cliente, panel de admin |
| Admin (RF-33) | **Control total** del panel; también puede validar | Comprar con su cuenta |

- **Cómo se controla:**
  - **Menú:** muestra solo lo del rol.
  - **Guards:** `clienteGuard` en `/cliente`, `empleadoGuard` en `/empleado` y `adminGuard` en `/admin`.
  - **Compra:** si entra alguien del personal, se le avisa que cierre sesión o compre con una cuenta de cliente.
  - **Base:** `confirmar_compra` rechaza las cuentas que no son de cliente. Si no, el personal acumularía puntos.
- **Datos del personal:** los datos del registro de cliente (sangre, ojos, vacaciones) no aplican al personal y se guardan como "Prefiero no responder" o 0. El personal **no recibe cupón** de primera compra.

---

## 6. Base de datos (Supabase)

### 6.1 Tablas

| Tabla | Contenido | Notas |
|---|---|---|
| `perfiles` | datos del usuario, `rol`, `credito`, `puntos` | `id` = id de Supabase Auth. `rol` por defecto `cliente`. |
| `peliculas` | ficha de la película | `generos text[]`. `vendidas` es un contador que se usa para el ranking. `preventa` y `precio_preventa` (HU-21). |
| `salas` | nombre, `activa` | nombre único |
| `precios_butaca` | `tipo` (general / accesible / vip), `precio` | una fila por tipo |
| `butacas_deshabilitadas` | `sala_id`, `fila`, `numero` | solo las excepciones al layout |
| `funciones` | película, sala, `inicio`, formato, idioma | `fin` y `libre_desde` los calcula la base |
| `resenas` | `pelicula_id`, `usuario_id`, `autor`, `estrellas`, `comentario` | `autor` guarda el nombre a mostrar (ver abajo) |
| `categorias_candy` | nombre, `orden` | nombre único |
| `productos_candy` | nombre, precio, categoría, imagen, `activo` | |
| `combos` | nombre, precio, `incluye_entrada`, imagen, `activo` | |
| `combo_items` | `combo_id`, `producto_id`, `cantidad` | FK a producto: impide borrar productos en uso |
| `config_cupon_primera_compra` | `porcentaje` | una sola fila (`id = 1`) |
| `cupones_primera_compra_usuario` | cupón asignado a cada usuario | |
| `cupones_por_edad` | `edad_minima`, `porcentaje`, vigencia, `activo` | |
| `butacas_ocupadas` | `funcion_id`, `fila`, `numero`, `estado`, `vence`, `token_hash`, `compra_id` | clave primaria = función + butaca. En Realtime. |
| `compras` | `codigo`, función, usuario o mail, importes, cupón, crédito, puntos, `estado` | código único. FK a función con `on delete restrict`. |
| `entradas` | `compra_id`, butaca, `tipo`, `precio`, `usada_en` | una por butaca |
| `compra_items` | `compra_id`, producto **o** combo, `nombre`, `cantidad`, `precio_unitario`, `entregado_en` | guarda nombre y precio del momento; los canjes van a $0 |
| `recompensas` | `tipo` (entrada / producto), `producto_id`, `puntos`, `activa` | **solo excepciones**: `puntos` null = usa el precio. Una de entrada y una por producto (índices únicos parciales). |
| vista `catalogo_canjes` | todo lo canjeable: `tipo`, `producto_id`, `nombre`, `precio`, `puntos`, `personalizado`, `activa` | la arma la base; ver 6.2.9 |
| `canjes` | `usuario_id`, `compra_id`, `descripcion`, `cantidad`, `puntos` | historial del perfil |

Montos en `numeric(…, 2)` para no tener errores de redondeo con dinero.

**`resenas.autor`:** la reseña guarda el nombre a mostrar (por ejemplo "Juan P."). Así el público puede leer las reseñas sin que la tabla `perfiles`, que tiene datos personales, sea visible para todos.

### 6.2 Lógica en la base y cómo se conecta con Angular

Las reglas que no se pueden romper están **en la base**: constraints, triggers y funciones. Angular las usa, pero no depende de sí mismo para cumplirlas. Así se respetan aunque haya dos personas usando la app a la vez o alguien llame a la API directamente desde la consola.

Resumen:

| Regla | En la base | En Angular |
|---|---|---|
| Solo el admin modifica el catálogo | `es_admin()` + policies | guards + `.select()` después de `update`/`delete` |
| Cupón de primera compra al registrarse | trigger `perfiles_asignar_cupon` | `AuthService.registrar()` → `Perfil` lo muestra |
| Fin de la función y 30 min de limpieza | trigger `funciones_calcular_fin` | no lo calcula: lo lee |
| Nunca dos funciones a la vez en una sala | constraint `sin_solapamiento_en_sala` | `FuncionesService` prueba sala por sala |
| Cambiar la duración revalida las funciones | trigger `peliculas_duracion_cambia` | `PeliculasService.actualizar()` explica el `23P01` |
| Preventa y venta abierta | `en_preventa()`, `venta_abierta()`, `precio_entrada()` | `obtenerConVenta()` y `shared/precios.ts` |
| Una butaca, un solo comprador | tabla `butacas_ocupadas` + `reservar_butaca()` | `ReservasService` con `rpc()` |
| Mapa de butacas en tiempo real | publicación `supabase_realtime` | `ReservasService.escuchar()` |
| Compra atómica con errores por paso | `confirmar_compra()` | `ComprasService.confirmar()` → `PasoPago` |
| Comprobante para dueño, admin o invitado (código + mail) | `obtener_comprobante()` | `ComprasService.obtenerComprobante()` → `Comprobante` |
| Cancelar con crédito, puntos y butacas en una transacción | `cancelar_compra()` | `ComprasService.cancelar()` → `MisCompras` |
| Cada código sirve una vez para entrar y una vez para el candy | `validar_entrada()`, `entregar_candy()` | `ValidacionService` → `Validacion` |
| Alta de personal sin convertir cuentas; nadie cambia roles | `alta_personal()` + sin policy de update en `perfiles` | `PersonalService.alta()` → `Usuarios` |
| Puntos: ganar y canjear sin pasarse del saldo | `confirmar_compra()` + tabla `canjes` | `PasoPago` (canjes) y `Perfil` (historial) |
| Función con ventas no se borra ni se mueve | FK `compras.funcion_id` + trigger `funciones_bloquear_con_ventas` | `FuncionesService` traduce el `23503` |

#### 6.2.1 Permisos: `es_admin()` y policies

- **Base:** `es_admin()` es `security definer` y devuelve `true` si el perfil del usuario logueado (`auth.uid()`) tiene `rol = 'admin'`. Todas las policies de escritura del catálogo la usan (`using (es_admin())`). Es `security definer` porque un cliente no puede leer los perfiles ajenos, y la función necesita leer el suyo sin pasar por esas policies.
- **Angular:** `roleGuard` y `childGuard` esconden las pantallas de admin, pero **la seguridad real es la policy**. Cuando una policy bloquea un `update` o `delete`, Supabase no da error: no toca ninguna fila. Por eso los servicios terminan en `.select()` y, si vuelven 0 filas, lanzan "No tenés permiso para hacer este cambio" (ver [4.2](#42-detectar-cuando-una-policy-bloquea-un-cambio)).

#### 6.2.2 Registro y cupón de primera compra

- **Base:**
  - La policy `crear mi perfil` solo deja insertar el perfil propio (`auth.uid() = id`) y **con `rol = 'cliente'`, `puntos = 0` y `credito = 0`**. Nadie puede registrarse como admin ni con saldo desde la consola.
  - El trigger **`perfiles_asignar_cupon`** (`after insert` en `perfiles`) ejecuta `asignar_cupon_primera_compra()`. Esa función copia el porcentaje vigente de `config_cupon_primera_compra` a `cupones_primera_compra_usuario`. Es `security definer` porque el cliente no tiene permiso para insertar cupones: así no se puede regalar un cupón de 100%.
  - `on conflict do nothing`: si el perfil se reintenta, no se duplica el cupón.
- **Angular:** `AuthService.registrar()` hace `signUp` + `insert` en `perfiles` y nada más: el cupón aparece solo. `CuponesService.obtenerCuponPrimeraCompra()` lo lee y el perfil lo muestra (HU-05). Si el admin cambia el porcentaje en `Cupones`, solo afecta a los que se registren después, porque el valor se copia al registrarse.

#### 6.2.3 Funciones: fin calculado y no solapamiento

- **Base:**
  - El trigger **`funciones_calcular_fin`** (`before insert or update`) ejecuta `calcular_fin_funcion()`: `fin = inicio + duración de la película` y `libre_desde = fin + 30 min`. Angular nunca manda `fin`; si lo mandara, se pisa.
  - El constraint de exclusión **`sin_solapamiento_en_sala`** (`exclude using gist (sala_id with =, tstzrange(inicio, libre_desde) with &&)`) impide dos rangos que se crucen en la misma sala. Usa la extensión `btree_gist`, que es la que agrega las funciones `gbt_*` que se ven en el esquema. Si se viola, Postgres devuelve el código **`23P01`**.
- **Angular:** `FuncionesService.crearConAsignacionAutomatica()` recorre las salas activas y hace `insert` en cada una. Si vuelve `23P01`, prueba la siguiente; si ninguna acepta, muestra "No hay ninguna sala libre en ese horario". No se consulta antes si la sala está libre: la base decide, y eso evita que dos admins asignen la misma sala al mismo tiempo. Las funciones recurrentes (HU-15) usan el mismo método para cada fecha, y al editar (HU-17) el `23P01` se traduce a un mensaje.

#### 6.2.4 Cambio de duración de una película

- **Base:** el trigger **`peliculas_duracion_cambia`** (`after update` en `peliculas`) ejecuta `recalcular_funciones_pelicula()`. Si la duración cambió, hace `update funciones set inicio = inicio` en las funciones **futuras** de esa película. Ese update "vacío" dispara `funciones_calcular_fin`, que recalcula `fin` y `libre_desde`. Si el nuevo horario pisa otra función, el constraint rechaza **todo el cambio**, incluida la película.
- **Angular:** `PeliculasService.actualizar()` traduce el `23P01` a "No se puede cambiar la duración: alguna función programada quedaría a menos de 30 minutos de la siguiente en su sala".

#### 6.2.5 Constraints que respaldan los formularios

Los Signal Forms validan antes de enviar, para dar el mensaje al instante. Los mismos límites están como `check` en la base, por si alguien saltea el formulario:

| Constraint | Formulario |
|---|---|
| `peliculas_duracion_min_check` (1 a 600) | `pelicula-form`: `min(1)`, `max(600)` |
| `peliculas_restriccion_edad_check` (0, 13, 18) | select de restricción |
| `peliculas_preventa_precio_check` | `pelicula-form`: precio obligatorio si hay preventa |
| `perfiles_dias_vacaciones_check` (0 a 365) | `registro`: `min(0)`, `max(365)` |
| `resenas_estrellas_check` (1 a 5), `resenas_comentario_check` (200) | reseñas (HU-10) |
| `*_precio_check` (> 0), `*_porcentaje_check` (1 a 100) | formularios de candy, combos y cupones |
| `cupones_mayores_50_check` (hasta ≥ desde) | `cupones`: validación de rango de fechas |
| `butacas_deshabilitadas_fila_check` (A–T sin K) | el mapa solo ofrece butacas que existen |

Los `unique` y las claves foráneas se traducen en los servicios:

- **`23505`** (duplicado): "Ya existe una sala / categoría con ese nombre".
- **`23503`** (FK): no se puede borrar un producto que está en un combo (`on delete restrict`), una categoría con productos ni una película con funciones. El mensaje sugiere desactivar u ocultar en su lugar.

#### 6.2.6 Preventa (HU-21) — `supabase/01_preventa.sql`

- **Base:**
  - `hoy_ar()` devuelve la fecha de hoy en Argentina. `current_date` usa UTC y después de las 21 h daría el día siguiente; es el mismo problema que resuelve `fechaLocal()` en Angular ([4.8](#48-fechas-y-horarios)).
  - `en_preventa(pelicula)`: `true` desde `fecha_estreno - 7` hasta el día anterior al estreno, si la película tiene `preventa` activada.
  - `venta_abierta(pelicula)`: en cartelera siempre. Si está en "próximamente", desde el estreno o desde que abre la preventa.
  - `precio_entrada(pelicula_id, tipo)`: en preventa, general y accesible cuestan `precio_preventa` y la VIP suma su recargo (`vip - general`). Fuera de preventa, el precio normal de `precios_butaca`. Es la que usará `confirmar_compra`.
  - Como `en_preventa` y `venta_abierta` reciben una fila de `peliculas`, **PostgREST las expone como columnas calculadas**.
- **Angular:**
  - `PeliculasService.obtenerConVenta()` pide `.select('*, en_preventa, venta_abierta')`: la fecha la evalúa la base y no el reloj del navegador.
  - El detalle y la compra muestran "Comprar" solo si `venta_abierta`.
  - `shared/precios.ts` replica el cálculo de `precio_entrada` **solo para mostrar el precio**. El que se cobra lo calcula la base.

#### 6.2.7 Reserva de butacas en tiempo real (HU-22, HU-23) — `supabase/02_butacas_ocupadas.sql`

- **Base:**
  - **`butacas_ocupadas`**: una fila por butaca tomada en una función, con estado `reservada` (con `vence`) o `vendida`. La **clave primaria `(funcion_id, fila, numero)`** hace imposible que la misma butaca la tomen dos personas: si dos tocan a la vez, la segunda recibe un error.
  - **RLS:** todos pueden **leer** (el mapa lo ve cualquiera, sin sesión). No hay policies de escritura: solo se modifica a través de las funciones.
  - **`reservar_butaca(funcion, fila, numero, token)`** (`security definer`) valida en orden y corta en el primer problema:
    1. que la función exista y no haya empezado;
    2. que la venta esté abierta (`venta_abierta`);
    3. que la butaca exista en el layout (`tipo_butaca`) y no esté fuera de servicio (`butacas_deshabilitadas`);
    4. que no pase de 10 butacas por compra;
    5. que no esté vendida ni reservada por otro.

    Antes de reservar borra las reservas vencidas de esa función. Todas las butacas del mismo token **vencen juntas**, a los 10 minutos de la primera, para que haya un solo reloj.
  - **`liberar_butaca`** y **`liberar_reservas`** borran solo las reservas del mismo token.
  - **Token:** identifica al navegador que compra, tenga sesión o no (RF-02: se puede comprar sin registrarse). La base guarda el **`sha256` del token**, no el token. Como la tabla es pública, el hash se ve, pero sin el token original nadie puede liberar la reserva de otro.
  - **`tipo_butaca(fila, numero)`** es la misma distribución que `shared/sala-layout.ts`. Está en los dos lados porque Angular la necesita para dibujar y la base para validar y cobrar.
  - **Realtime:** `butacas_ocupadas` está en la publicación `supabase_realtime`. Realtime respeta RLS, y como el `select` es público, los visitantes sin sesión también reciben los cambios.
- **Angular:**
  - `ReservasService` crea el token con `crypto.randomUUID()` y lo guarda en `sessionStorage`, así sobrevive a un F5 pero no se comparte entre pestañas. Calcula su `sha256` con `crypto.subtle` para reconocer sus propias reservas en la tabla.
  - `reservar()`, `liberar()` y `liberarTodas()` llaman a las funciones con **`supabase.rpc()`**.
  - `escuchar()` abre un canal de Realtime con `postgres_changes`: `INSERT` y `UPDATE` filtrados por `funcion_id`, y `DELETE` sin filtro, porque Realtime no filtra los borrados y solo manda la clave primaria. Por eso se descartan a mano los de otras funciones.
  - La pantalla `Compra` primero se suscribe y después lee la tabla, para no perder cambios en el medio. Guarda las ocupadas en una señal (`Map` por `'J-10'`) y con `computed` separa **mis reservas** (hash igual al mío) de **las de otros**. Las reservas vencidas se ignoran con un reloj de 1 s, aunque la fila siga en la base hasta que alguien reserve y la limpie.
  - Al salir de la pantalla se llama `liberarTodas()`; si el navegador se cierra, las reservas vencen solas.

**Mensajes de error.** Las funciones lanzan `raise exception using message = '...', hint = '...'`:

- `message` es el texto para el usuario y dice qué falló y dónde, por ejemplo "La butaca J-10 ya está vendida" o "La venta de entradas para "X" todavía no está abierta".
- `hint` indica el paso: `funcion`, `butaca` o `precio`. `confirmar_compra` va a sumar `edad`, `cupon`, `credito` y `pago`.

Supabase devuelve los dos en el `error` de `rpc()`: Angular muestra `error.message` tal cual y puede usar `error.hint` para marcar la parte de la pantalla que falló.

#### 6.2.8 Confirmar la compra (HU-24, HU-25, HU-26) — `supabase/03_compras.sql`

- **Tablas:**
  - `compras`: una por compra, con un **código único** de 10 caracteres, el desglose de importes y el estado (`vigente`, `usada` o `cancelada`).
  - `entradas`: una por butaca, con el precio cobrado.
  - `compra_items`: el candy, con el nombre y el precio del momento, para que un cambio de precio posterior no altere compras viejas.
  - `butacas_ocupadas.compra_id` liga la butaca vendida con su compra, para poder liberarla si se cancela (HU-28).
- **RLS:** cada uno ve sus compras y el admin ve todas. **No hay policies de insert:** solo `confirmar_compra` escribe en estas tablas.
- **`confirmar_compra(...)`** (`security definer`) hace todo en **una sola transacción**: si cualquier paso falla, Postgres deshace todo y no queda nada a medias (ni cupón marcado, ni crédito descontado, ni butacas vendidas). Valida en este orden, y cada error lleva su `hint`:

| # | Paso (`hint`) | Qué controla | Ejemplo de mensaje |
|---|---|---|---|
| 1 | `funcion` | que exista, que no haya empezado y que la venta esté abierta | "La función ya empezó: no se pueden vender entradas." |
| 2 | `comprador` | registrado: mail del perfil; anónimo: mail válido | "Ingresá un mail válido: ahí te identificamos la compra." |
| 3 | `edad` | edad contra la restricción (perfil o fecha declarada) | ""X" es para mayores de 18 años y la fecha de nacimiento indica 15 años." |
| 4 | `reserva` | cada butaca sigue reservada por este navegador y no venció | "La reserva de la butaca J-10 venció o ya no es tuya. Volvé a elegir las butacas." |
| 5 | — | precio de cada entrada con `precio_entrada` (incluye preventa) | — |
| 6 | `candy` | productos y combos activos, cantidades de 1 a 20, no más combos con entrada que butacas | "Elegiste 3 combos que incluyen entrada, pero solo 2 butacas." |
| 7 | `puntos` | solo registrados; recompensas activas; no pasarse del saldo; combos + entradas canjeadas ≤ butacas | "Querés canjear 800 puntos y tenés 500." |
| 8 | `cupon` | uno solo; primera compra sin usar, o por edad vigente | "Ya usaste tu cupón de primera compra." |
| 9 | `credito` | solo registrados; hasta su saldo y hasta el total | "Querés usar $ 500 de crédito pero tenés $ 200 disponibles." |
| 10 | `pago` | si queda algo por pagar, que haya medio de pago | "Faltan los datos de pago para abonar $ 3500." |

  Si pasa todo:
  - crea la compra y las entradas;
  - pasa las butacas a `vendida`, y Realtime lo avisa a todos los mapas abiertos;
  - marca el cupón como usado y descuenta el crédito;
  - suma **1 punto por peso pagado** (HU-29, solo registrados);
  - suma las entradas a `peliculas.vendidas` para el ranking de la home.

  Devuelve el código y los importes finales.
- **Combos con entrada:** cada uno descuenta el valor de una entrada general, aplicado sobre las butacas más baratas. Si la butaca es VIP, la diferencia se sigue cobrando.
- **Trigger nuevo `funciones_bloquear_con_ventas`** (`before update` en `funciones`): si la función tiene compras no canceladas, no deja cambiarle el horario, la sala ni la película. Borrarla ya lo impide la FK `compras.funcion_id` con `on delete restrict`. Esto completa HU-17.
- **Angular:**
  - `ComprasService.confirmar()` llama a `rpc('confirmar_compra', …)`. Si falla, lanza un `ErrorCompra` con `mensaje` (el `message` de la base) y `paso` (el `hint`).
  - `PasoPago` lo muestra en un recuadro "No se pudo confirmar la compra — Cupón" con el mensaje exacto. Según el paso, ofrece un botón para volver: a las butacas si la reserva venció, o al candy si un producto se dio de baja.
  - Los totales que se ven antes de confirmar salen de `calcularTotales()` (`shared/precios.ts`), que replica la cuenta de la base **solo para mostrar**. Lo que se cobra es lo que devuelve `confirmar_compra`, y eso es lo que muestra la pantalla final.
  - `FuncionesService.eliminar()`, `CombosService.eliminar()` y `CandyService.eliminarProducto()` traducen el `23503` de las nuevas FK: no se borra lo que ya se vendió, se desactiva.

#### 6.2.9 Puntos y recompensas (HU-30, HU-31) — `supabase/04_puntos.sql` y `05_puntos_por_precio.sql`

- **Base:**
  - **Vista `catalogo_canjes`** (script 05): une el precio general de `precios_butaca` y los productos activos del candy con sus excepciones en `recompensas` (`left join`).
    - **Costo:** `coalesce(recompensas.puntos, ceil(precio))`, es decir, lo que fijó el admin o el precio en pesos redondeado hacia arriba.
    - **Otras columnas:** `personalizado` indica si hay costo fijado a mano, y `activa` si el ítem se puede canjear.
    - Es `security_invoker`, así que respeta las policies de quien consulta. Las tres tablas son de lectura pública.
    - Como el costo se calcula al consultar, un producto nuevo o un cambio de precio se reflejan sin tocar nada.
  - `recompensas` guarda **solo las excepciones**: `puntos` null significa "usa el precio" y `activa = false` desactiva el canje. Tiene un `check` de entrada/producto y dos **índices únicos parciales**: uno permite una sola fila de entrada y el otro una por producto.
  - RLS: todos pueden leer las recompensas y solo el admin las escribe.
  - `canjes`: cada usuario ve los suyos y nadie los inserta directo.
  - `confirmar_compra` se **redefine** con un parámetro más, `p_canjes`. Primero se hace `drop` de la versión anterior: si no, Postgres tendría dos funciones con el mismo nombre y distintos parámetros, y `rpc()` podría llamar a la equivocada.
  - El paso nuevo (`hint = 'puntos'`) valida el ítem y el saldo. Desde el script 05, el costo lo toma **de la vista `catalogo_canjes`**, la misma que ve el cliente. Después descuenta los puntos canjeados, suma los ganados en el mismo `update` y registra cada canje. `p_canjes` identifica el ítem por tipo: `{"tipo": "entrada"}` o `{"tipo": "producto", "producto_id": 3}`. Desde el script 06, un producto canjeado tiene que estar en `p_items` con al menos esa cantidad (si no, error "Querés canjear 4 × "Pochoclos" pero en la compra hay 2"). Su precio suma a `descuento_canjes`, junto con las entradas cubiertas.
- **Angular:**
  - `RecompensasService.catalogo()` lee la vista `catalogo_canjes` como si fuera una tabla, y `canjeables()` se queda con las activas.
  - `guardarExcepcion()` inserta, actualiza o borra la fila de `recompensas` según el caso.
  - `calcularTotales()` recibe cuántas entradas se canjean y los pesos de los productos canjeados, para mostrar el descuento igual que la base.
  - `PasoPago` solo ofrece canjear la entrada y los productos del carrito, con tope en la cantidad elegida. Si el cliente vuelve al candy y saca productos, el canje se ajusta solo.
  - La pantalla **Admin → Puntos** (`Recompensas`) lista el catálogo completo y edita las excepciones, y el **Perfil** lista `misCanjes()`.

#### 6.2.10 Comprobante (HU-27) — `supabase/07_comprobante.sql`

- **Base:** `obtener_comprobante(codigo, email)` (`security definer`, `stable`) devuelve en **un solo JSON** la compra, la película, la función, la sala, las entradas y el candy.
  - **Dueño o admin:** alcanza con el código. Se controla con `auth.uid()` y `es_admin()`.
  - **Invitado:** el mail tiene que coincidir con el de la compra. Hace falta porque sin sesión las policies de `compras` no le devuelven nada.
  - Si no se cumple nada de eso, el error es **siempre el mismo** ("No encontramos una compra con ese código y ese mail"), exista o no el código.
  - `coalesce(usuario_id = auth.uid(), false)`: sin sesión, `auth.uid()` es null, la comparación da null y un `not (null or …)` no cortaría. Con el `coalesce`, un invitado con el mail equivocado recibe el error.
- **Angular:**
  - `ComprasService.obtenerComprobante()` llama a `rpc()` y convierte los montos a número para los pipes.
  - `recordarMail()` y `mailRecordado()` guardan el mail del invitado en `sessionStorage`, por código.
  - La pantalla `Comprobante` primero intenta sin mail (sirve para el registrado) y, si no hay sesión, lo pide.

#### 6.2.11 Cancelar una compra (HU-28) — `supabase/08_cancelar_compra.sql`

- **Base:** `cancelar_compra(codigo)` (`security definer`) valida en orden y corta en el primer problema. Todos los errores llevan `hint = 'cancelacion'`:
  1. hay sesión y la compra es del usuario ("No encontramos esa compra entre las tuyas");
  2. no está ya cancelada;
  3. no se usó ninguna entrada ni se entregó candy;
  4. faltan más de 2 horas ("Solo se puede cancelar hasta 2 horas antes de la función (hasta el 27/09 16:00 hs)"; la hora se muestra en horario de Argentina);
  5. el saldo de puntos alcanza para restar los ganados menos los canjeados.

  Si pasa todo, en **una transacción**:
  - suma el crédito y ajusta los puntos del perfil;
  - marca la compra como `cancelada` (con `cancelada_en` y `credito_devuelto`) y sus canjes como `devuelto`;
  - **borra sus filas de `butacas_ocupadas`**, y Realtime manda el `DELETE` a los mapas abiertos;
  - descuenta las entradas de `peliculas.vendidas`.

  Las filas de `entradas` y `compra_items` **no se borran**: quedan como historial y para los reportes.
- `funciones_bloquear_con_ventas` ignora las compras canceladas: si todas las compras de una función se cancelan, se puede volver a mover.
- **Angular:**
  - `ComprasService.misCompras()` trae en **una sola consulta** la compra con la función, la película y la sala embebidas, más la cantidad de entradas (`entradas(count)`). Si la película se ocultó, la compra se muestra igual, como "Película no disponible".
  - `MisCompras` muestra u oculta el botón con la misma regla de 2 horas, pero **quien decide es la base**. Si algo no se cumple, se muestra su mensaje tal cual.

#### 6.2.12 Validación y entrega (HU-32, HU-33) — `supabase/09_validacion.sql`

- **Base:**
  - `es_empleado()` es igual que `es_admin()`, pero acepta los roles `empleado` y `admin`.
  - `validar_entrada(codigo, funcion_id)` y `entregar_candy(codigo)` son `security definer` y empiezan controlando `es_empleado()`. Un cliente que las llame desde la consola recibe "Solo un empleado puede validar entradas".
  - Las dos bloquean la compra con `for update`: si dos empleados escanean el mismo código a la vez, el segundo espera y después ve "ya se usaron". **Un código no puede entrar dos veces.**
  - La entrada marca `entradas.usada_en` y `compras.estado = 'usada'`; el candy marca `compra_items.entregado_en`. Son marcas separadas, por eso son independientes.
  - `hora_ar()` formatea las horas de los mensajes en horario de Argentina.
  - `datos_para_empleado()` arma la respuesta con película, función, sala, butacas y candy, y la usan las dos funciones.
- **Angular:**
  - `ValidacionService` llama a las dos funciones con `rpc()` y convierte el error en un `Error` con el mensaje de la base.
  - `FuncionesService.listarDeHoy()` trae las funciones de hoy con película y sala embebidas, para el selector.
  - `Validacion` usa `viewChild()` para devolverle el foco al campo después de cada escaneo.

#### 6.2.13 Personal (HU-34) — `supabase/10_personal.sql`

- **Base:**
  - **Se borra la policy `admin cambia roles`**. Ya no hay ninguna policy de `update` en `perfiles`: rol, puntos y crédito solo cambian desde funciones de la base.
  - **`alta_personal(email, nombre, apellido, fecha, rol)`** (`security definer`) controla, en orden:
    - que sea el admin;
    - que el rol sea `empleado` o `admin`;
    - los datos;
    - que la cuenta de Auth exista (busca en `auth.users` por mail);
    - que **no tenga perfil**: si lo tiene, es un cliente u otro miembro del personal y se rechaza.

    Si pasa todo, crea el perfil con el rol. Errores con `hint = 'personal'`.
  - `asignar_cupon_primera_compra` (el trigger del registro) ahora solo da el cupón si el perfil es de **cliente**.
  - `confirmar_compra` se redefine (igual que en el script 06) con un control más en el paso "comprador": si la cuenta no es de cliente, rechaza la compra.
- **Angular:**
  - `PersonalService.alta()` crea la cuenta de Auth con `signUp` **desde un cliente sin sesión** (`crearClienteSinSesion()`), así la sesión del admin sigue intacta. Después llama a `alta_personal` con la sesión del admin.
  - Si una alta anterior quedó a mitad (cuenta creada sin perfil), repetirla la completa: el `signUp` avisa que el mail existe y `alta_personal` crea el perfil que faltaba.
  - La pantalla `Usuarios` (Admin → Personal) tiene `canDeactivate` con `formGuard`, como el resto de los formularios del admin.

### 6.3 Seguridad (RLS)

Todas las tablas tienen RLS activado. Criterio general:

| Quién | Qué puede hacer |
|---|---|
| Visitante sin sesión | Leer películas no ocultas, funciones, salas, precios, reseñas, candy, combos, recompensas, la configuración de cupones y las butacas ocupadas. Reservar, liberar y comprar **solo a través de las funciones** de la base (`reservar_butaca`, `confirmar_compra`, …). |
| Usuario registrado | Además, leer y crear **solo su propio** perfil (como cliente, sin puntos ni crédito) y ver sus propios cupones, compras y canjes. No puede modificar su perfil (ni sus puntos ni su crédito): solo cambian a través de `confirmar_compra` y `cancelar_compra`. |
| Admin | Escribir (insert / update / delete) en las tablas de catálogo, salas, funciones, candy, combos, cupones y recompensas. Ver todos los perfiles y dar de alta personal (con `alta_personal`). **Nadie cambia roles.** |

Por eso los guards de Angular alcanzan para la navegación: aunque alguien los saltee, la base no le devuelve ni le deja modificar lo que no le corresponde.

### 6.4 Storage

Tres buckets **públicos de lectura**: `posters`, `candy` y `combos`. Son públicos porque las imágenes se muestran en la cartelera a visitantes sin sesión. La escritura está restringida al admin.

---

## 7. Adaptaciones respecto del pedido original

| Pedido del cliente | Cómo se resolvió | Por qué |
|---|---|---|
| Imagen de película | Subida a Supabase Storage | Aprobado por el docente; evita links externos rotos |
| Filas J y K accesibles | Unificadas en la fila J; la K no existe | Decisión de diseño de la sala |
| Cupón para mayores de 50 | Cupones por edad mínima configurable | Cubre el caso pedido y otros (jubilados, etc.) |
| Contraseña en el registro | Se agregó | Supabase Auth la necesita |
| Butacas en tiempo real | Reserva temporal de 10 min + Supabase Realtime | Aprobado por el docente |
| PDF de la entrada | Comprobante imprimible + "Guardar como PDF" del navegador | No se vieron librerías de PDF |
| QR en la entrada | Librería `qrcode`; el QR contiene el código de compra | Aprobado |
| Escaneo con cámara | Campo de texto (los lectores USB escriben como teclado) | No se vio acceso a la cámara |
| Pagos | Pago simulado con formulario validado | Fuera del alcance |
| Alertas por mail | Avisos dentro de la app | No se vio envío de mails |
| Exportar a Excel | CSV | Excel lo abre directo |
| Gráficos | Barras con CSS y `ngStyle` | No se vieron librerías de gráficos |
| Alta de empleados | El admin crea cuentas nuevas de empleado o admin con una contraseña inicial; no convierte clientes | Pedido del cliente: cada rol separado y con solo sus funciones (RF-30, RF-33) |
