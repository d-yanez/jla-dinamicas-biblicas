# JLA Dinámicas Bíblicas

Aplicación web estática para las dinámicas bíblicas presenciales del grupo juvenil JLA. Dos juegos —**Sopa de letras** y **Palabras desordenadas**— con administración local, ensayos, proyección, impresión y respaldos.

Sin backend, sin cuentas, sin servicios de pago y sin dependencias en tiempo de ejecución. Toda la información vive en el navegador del dispositivo.

**Publicada en:** <https://d-yanez.github.io/jla-dinamicas-biblicas/>

> **Estado: fase 1 de 10 terminada y verificada.** La portada, el panel de administración y el acceso con PIN funcionan; los juegos, los temporizadores, la impresión y los respaldos llegan en las fases siguientes (ver [Roadmap](#roadmap)).

![Portada](docs/capturas/portada.png)

---

## Ejecutar localmente

El proyecto usa módulos ES nativos, así que **no se abre con `file://`**: necesita un servidor HTTP, por la misma política de origen que aplica a cualquier módulo.

```bash
# desde la raíz del proyecto
python3 -m http.server 8080
```

Abrí <http://localhost:8080/>. Cualquier servidor estático sirve (`npx serve`, `php -S localhost:8080`, Live Server de VS Code). No hay paso de compilación ni instalación de dependencias.

## Publicar en GitHub Pages

1. Subí el contenido del repositorio tal cual (no hace falta compilar nada).
2. En GitHub: **Settings → Pages**.
3. En *Source* elegí **Deploy from a branch**.
4. Rama `main` y carpeta `/ (root)`. Guardá.
5. Esperá la publicación: queda en `https://usuario.github.io/nombre-repositorio/`.

Funciona igual publicado en una subruta porque:

- todas las rutas a archivos son **relativas** (`./src/...`, `./assets/...`), nunca absolutas;
- la navegación usa **hash** (`#/`, `#/juego/sopa`, `#/admin/config`), y GitHub Pages no reescribe rutas desconocidas—un router por *path* rompería la recarga y los enlaces profundos en subruta;
- no hay ninguna URL de CDN: todo se sirve desde el mismo repositorio.

## Verificar antes de usar

```bash
# 48 pruebas unitarias de la lógica pura (Node 22+, sin dependencias)
node --test tests/*.test.mjs

# 15 verificaciones funcionales en un navegador real (Playwright, opcional)
node tests/browser-smoke.mjs
```

El segundo comando es una herramienta de desarrollo: levanta su propio servidor estático, recorre el flujo completo de fase 1 y falla si la consola del navegador registra un error. Requiere Playwright instalado (`npm i -g playwright && playwright install chromium`); **la aplicación publicada no lo usa**.

Para validar el sitio ya publicado, apuntalo a la URL real:

```bash
JLA_BASE_URL=https://d-yanez.github.io/jla-dinamicas-biblicas/ node tests/browser-smoke.mjs
```

Qué cubre la verificación de navegador: portada y tarjetas, `Jugar` sin actividad publicada, creación y confirmación del PIN, descarga y formato del archivo de recuperación, preferencias de tamaño y contraste, persistencia tras recarga, PIN incorrecto, cierre de sesión, importación del archivo de recuperación con PIN nuevo, rechazo de un archivo de otro dispositivo y ausencia de desborde horizontal en móvil.

## El PIN: qué protege y qué no

El PIN de cuatro dígitos evita que alguien que toma el dispositivo entre al panel por accidente. **No es seguridad criptográfica**: cualquiera con acceso al navegador puede leer IndexedDB con las herramientas de desarrollo. Aun así el PIN nunca se guarda en claro: se almacena con PBKDF2-SHA256 (210 000 iteraciones y sal propia por registro).

- Se crea al entrar por primera vez a **Administrar** y se pide cada vez que se vuelve desde la portada. Dentro del panel no se vuelve a pedir.
- Al crearlo se ofrece un **archivo de recuperación**. Es propio de cada dispositivo y sirve para definir un PIN nuevo sin tocar las actividades.
- El PIN y su archivo de recuperación **quedan fuera de todos los respaldos JSON**, por diseño.
- Si se pierden el PIN y el archivo: las actividades siguen guardadas en el navegador, pero el panel queda inaccesible. Es la razón por la que el panel insiste en descargar el archivo.

## Los datos

Todo se guarda en **IndexedDB** (`jla-dinamicas`), con esquema versionado y migraciones incrementales.

Las **preferencias de interfaz** (tamaño y contraste) son la excepción deliberada: van a `localStorage`, porque su escritura es síncrona. Con IndexedDB, cambiar el contraste y recargar enseguida perdía el cambio sin ningún error; con `localStorage`, el valor queda escrito antes de que la página pueda irse. Es el uso que la especificación permite para preferencias pequeñas.

> Si se borran los datos del navegador, se usa una ventana privada o se cambia de dispositivo, la información se pierde. El respaldo manual en JSON llega en la fase 7.

## Estructura

```
index.html                      app shell: meta, estilos, punto de entrada
assets/favicon.svg              llama JLA
src/
  main.js                       entrada; arranca la app
  app.js                        estado, ruteo, acciones y toda la escritura de datos
  core/                         lógica pura, sin DOM (probada por tests)
    db.js                       IndexedDB + migraciones versionadas
    pin.js                      PBKDF2: crear y verificar PIN
    recovery.js                 archivo de recuperación: construir, parsear, comparar
    prefs.js                    tamaño/contraste: normalizar, guardar y aplicar
    router.js                   rutas por hash, etiquetas, bloqueo al salir de admin
    admin-gate.js               máquina de estados de acceso al panel
    activities.js               consultas de actividades publicadas
  ui/                           DOM puro; sin acceso a almacenamiento
    dom.js  icons.js  fields.js  download.js  common.js
    home.js  game.js  gate.js  admin.js  security.js
  styles/
    tokens.css                  paleta JLA, tamaño, alto contraste
    base.css                    reset, tipografía, accesibilidad
    components.css              componentes visuales
tests/                          pruebas unitarias + smoke de navegador
odd/tasks/                      registro de trabajo por fase (ODD)
docs/capturas/                  capturas usadas en este README
```

### Decisiones técnicas

| Decisión | Motivo |
|---|---|
| Sin bundler ni build | Un repositorio de archivos estáticos es lo que GitHub Pages sirve mejor; cero mantenimiento de toolchain |
| Módulos ES nativos | Aislamiento real entre capas: `core/` no toca el DOM, `ui/` no toca el almacenamiento |
| Router por hash | Sobrevive a la subruta, a la recarga y al modo offline sin configuración del servidor |
| IndexedDB con migraciones | Datos estructurados, versión explícita y upgrade en sitio sin perder actividades |
| PBKDF2 en vez de PIN en claro | Aunque el PIN no sea una frontera de seguridad, una base filtrada no debe revelarlo |
| Preferencias en `localStorage`, datos en IndexedDB | Una preferencia debe sobrevivir a una recarga inmediata; IndexedDB escribe de forma asíncrona y la perdería en silencio |
| Desbloqueo solo en memoria | Recargar vuelve a pedir el PIN: el comportamiento más seguro en un notebook compartido |
| Nodes construidos por datos, nunca HTML | No hay superficie de inyección aunque un nombre de actividad traiga markup |
| Playwright solo como herramienta de desarrollo | La app publicada no tiene dependencias; el navegador se usa para verificar, no para funcionar |

## Accesibilidad y pantalla

- Tamaño de proyección **Grande** por defecto y **Normal** para pantallas chicas; escala toda la interfaz.
- **Alto contraste** independiente: no reemplaza el estilo JLA, lo refuerza.
- Foco visible siempre, enlace «Saltar al contenido», `aria-current` en la navegación del panel, errores con `role="alert"`, diálogos nativos con `Esc` y foco atrapado.
- Respeto de `prefers-reduced-motion`.

## Roadmap

| Fase | Entregable | Estado |
|---|---|---|
| 1 | Estructura, portada, responsive, persistencia y acceso PIN | ✅ terminada |
| 2 | Modelo de actividades, borradores y motor de sopa de letras 20×20 | pendiente |
| 3 | Motor de palabras desordenadas (anagramas, pistas, desempates) | pendiente |
| 4 | Presentación, temporizadores, sonido, atajos, extra de 60 s | pendiente |
| 5 | Ensayos, guardado y recuperación de sesión | pendiente |
| 6 | Impresión y PDF carta (participantes y moderador) | pendiente |
| 7 | Biblioteca, publicación, papelera y respaldos JSON | pendiente |
| 8 | Proyección de dos ventanas sincronizadas | pendiente |
| 9 | Offline, actualización consentida, accesibilidad final | pendiente |
| 10 | QA completo y despliegue | pendiente |

La especificación completa está en `JLA_Dinamicas_Biblicas_Roadmap_y_Prompt_Maestro.md`, que es la fuente de verdad del proyecto.

## Limitaciones conocidas de esta versión

- No hay actividades ni partidas: los dos juegos avisan que no hay actividad publicada, que es el estado real.
- No hay respaldo JSON todavía: solo el archivo de recuperación del PIN.
- No hay service worker: la aplicación necesita conexión en la primera carga y en cada recarga mientras no exista la fase 9.
- El PIN no resiste a alguien con acceso al navegador (ver arriba).
