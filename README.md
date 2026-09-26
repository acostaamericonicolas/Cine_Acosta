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

Los cambios de la base a partir de HU-21 están en [`supabase/`](supabase/), numerados. Se ejecutan **en orden** en Supabase → SQL Editor, cada uno completo:

| Script | HU | Qué agrega |
|---|---|---|
| `01_preventa.sql` | 21 | columnas de preventa, `hoy_ar()`, `en_preventa()`, `venta_abierta()`, `precio_entrada()` |
| `02_butacas_ocupadas.sql` | 22, 23 | tabla `butacas_ocupadas`, funciones de reserva y Realtime |

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
| 17 | Editar / eliminar funciones | Hecha (el bloqueo por entradas vendidas se completa con HU-27) |
| 18 | Categorías y productos del candy | Hecha |
| 19 | Combos a precio fijo | Hecha |
| 20 | Configuración de cupones | Hecha (la aplicación en la compra se completa con HU-26) |
| 21 | Preventa por película | Hecha (requiere `supabase/01_preventa.sql`) |
| 22 | Mapa de butacas para elegir | Hecha (requiere `supabase/02_butacas_ocupadas.sql`) |
| 23 | Butacas ocupadas en tiempo real | Hecha con Supabase Realtime (requiere `supabase/02_butacas_ocupadas.sql`) |
| 05 | Perfil: puntos, crédito, cupones y datos | Hecha (historial de canjes y "Mis películas" se llenan con las HU de puntos y compra) |
| 32, 34 | Validación, roles | Pantallas creadas, sin implementar |
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
│   ├── publico/           home, detalle, compra, login, registro
│   ├── cliente/           perfil
│   ├── empleado/          validación
│   └── admin/             ABMs del panel
└── shared/                lo que usan varias áreas
    ├── componentes/       tarjeta-pelicula, mapa-butacas
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
- **Eliminación:** por ahora se permite siempre. Cuando exista la tabla de entradas (HU-27), se va a bloquear si la función tiene entradas vendidas.
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
- Sigue en HU-24: los anónimos ingresan su fecha de nacimiento antes de elegir butacas, y se controla la edad.

### 5.11 Reglas de compra acordadas (a implementar)

Surgieron de revisar las historias contra los requerimientos funcionales:

| Tema | Regla | HU |
|---|---|---|
| Combo con entrada | Cubre 1 entrada general; si la butaca es VIP se cobra la diferencia | 19, 25 |
| Cupones | Uno por compra (primera compra **o** por edad), combinable con crédito y pago | 26 |
| Cancelación | Se restan los puntos que dio esa compra; el cupón usado no se devuelve | 28 |
| Canje de puntos | Se aplica dentro de la compra: entrada o producto a $0 pagado con puntos | 31 |
| Comprador anónimo | Pantalla "Buscar mi compra" con mail + código | 26, 27 |
| Comprobante | Código único con QR (librería `qrcode`) | 27 |
| Preventa | Precio fijo por película para general y accesible; la VIP suma su recargo | 21 |
| Alerta de estreno | Avisa cuando se abre la venta (preventa, o estreno si no hay) | 11 |
| Log de actividad | Con triggers en la base, no desde Angular | 37 |

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
| `butacas_ocupadas` | `funcion_id`, `fila`, `numero`, `estado`, `vence`, `token_hash` | clave primaria = función + butaca. En Realtime. |

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

#### 6.2.8 Próximamente

- **`confirmar_compra`** (HU-26): va a ser una función `security definer` que en una sola transacción:
  - revalida que las reservas sigan vigentes;
  - controla la edad (HU-24);
  - recalcula los precios con `precio_entrada`;
  - aplica el cupón y el crédito;
  - crea la compra, las entradas y el código;
  - pasa las butacas a `vendida` y suma los puntos.

  Si algo falla, no queda nada a medias, y el error dice en qué paso fue.

### 6.3 Seguridad (RLS)

Todas las tablas tienen RLS activado. Criterio general:

| Quién | Qué puede hacer |
|---|---|
| Visitante sin sesión | Leer películas no ocultas, funciones, salas, precios, reseñas, candy, combos, la configuración de cupones y las butacas ocupadas. Reservar y liberar butacas **solo a través de las funciones** de la base. |
| Usuario registrado | Además, leer y crear **solo su propio** perfil (como cliente, sin puntos ni crédito) y ver sus propios cupones. No puede modificar su perfil. |
| Admin | Escribir (insert / update / delete) en las tablas de catálogo, salas, funciones, candy, combos y cupones. Ver todos los perfiles y cambiar roles. |

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
| PDF de la entrada | Vista imprimible + "Guardar como PDF" (pendiente, HU-27) | No se vieron librerías de PDF |
| QR en la entrada | Librería `qrcode` (pendiente, HU-27) | Acordado |
| Escaneo con cámara | Campo de texto (los lectores USB escriben como teclado) | No se vio acceso a la cámara |
| Pagos | Pago simulado con formulario validado | Fuera del alcance |
| Alertas por mail | Avisos dentro de la app | No se vio envío de mails |
| Exportar a Excel | CSV | Excel lo abre directo |
| Gráficos | Barras con CSS y `ngStyle` | No se vieron librerías de gráficos |
| Alta de empleados | El admin asigna el rol a un usuario registrado | Evita manejar contraseñas de terceros |
