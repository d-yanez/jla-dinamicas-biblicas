# JLA Dinámicas Bíblicas — app estática (GitHub Pages)

App web estática (HTML/CSS/JS vanilla, sin backend) para dinámicas bíblicas presenciales del grupo juvenil JLA. Dos juegos con administración local, ensayos, proyección, impresión y respaldos. Fuente de verdad: `JLA_Dinamicas_Biblicas_Roadmap_y_Prompt_Maestro.md` (raíz del proyecto).

## Specs

Estado: **Fase 1** en implementación. Los `S#` citan el documento maestro textualmente; las fases se agregan al abrirse.

### Fase 1 — Estructura, home, responsive, persistencia y PIN

- **S1.** Roadmap, fase 1 — criterio de salida: "Dos tarjetas Jugar; administración protegida; primer PIN y archivo de recuperación".
- **S2.** "Portada con dos tarjetas grandes: **Sopa de letras** y **Palabras desordenadas**, breve descripción y botón **Jugar**. Estética verde/crema/dorado, adaptable a móviles, tabletas, notebook y proyector."
- **S3.** "Engranaje **Administrar** discreto en esquina inferior."
- **S4.** "PIN local de cuatro dígitos: crear y confirmar al primer acceso, solicitarlo al volver desde portada; navegación dentro de admin sin pedirlo de nuevo."
- **S5.** "Archivo de recuperación de PIN creado al configurarlo; importar archivo permite establecer PIN nuevo sin borrar actividades."
- **S6.** "PIN y recuperación son propios de cada dispositivo y se excluyen de todo respaldo JSON general o por juego."
- **S7.** "Admin con tres secciones: **Sopa de letras**, **Palabras desordenadas** y **Configuración general**."
- **S8.** "Si no hay actividad publicada, Jugar informa y ofrece volver al inicio."
- **S9.** "Tamaños de proyección **Normal** y **Grande**, siendo Grande predeterminado; ajuste independiente **Alto contraste** con estilo JLA predeterminado."
- **S10.** "Preferir IndexedDB para datos estructurados y sesiones, con esquema versionado y migraciones".
- **S11.** "**Estética:** verde bosque `#173B31`, crema `#F8F5EC`, dorado tenue `#E8C988`, llama discreta, juvenil y reverente."
- **S12.** "PIN no es seguridad criptográfica contra alguien con acceso al navegador: documentar limitación."
- **S13.** "compatible con GitHub Pages incluso cuando se publique en `https://usuario.github.io/nombre-repositorio/`".
- **S14.** "Evita dependencias de CDN en tiempo de ejecución."
- **S15.** "Los datos pueden perderse si el usuario limpia el navegador: avisar claramente."

### Fase 2 — Modelo de actividades, borradores y motor de sopa de letras

- **S16.** Roadmap, fase 2 — criterio de salida: "20×20 exacto, 10 palabras válidas y coordenadas guardadas, variantes previsualizables".
- **S17.** "Cuadrícula **20×20** con **10 palabras administrables**; dificultad media, ubicaciones horizontal, vertical y diagonal, incluidas direcciones inversas."
- **S18.** "Verificar cada ubicación y guardar exactamente 400 caracteres, diez respuestas, posiciones inicial/final y dirección."
- **S19.** "Permitir generar variantes, previsualizar solución de cada una y publicar solo una aprobada; permitir ordenar manualmente la secuencia de palabras."
- **S20.** "Evitar regenerar la cuadrícula al jugar, imprimir, recargar o restaurar."
- **S21.** "Cada actividad contiene identificador estable, tipo de juego, nombre, tema bíblico, referencia bíblica opcional, enseñanza opcional, instrucciones introductorias editables, reflexión bíblica final opcional y referencia, nombre del evento opcional y fecha opcional."
- **S22.** "Instrucciones basadas en plantilla por juego, con duración de reloj interpolada dinámicamente."
- **S23.** "Edición de actividad publicada crea **borrador independiente** y jamás cambia el contenido publicado hasta aprobación explícita. Duplicar produce borrador independiente."
- **S24.** "Borradores con autoguardado tras breve inactividad, indicador y **Guardar ahora**; nunca autopublicar."
- **S25.** "Publicación requiere validación estricta de campos esenciales, mostrando errores específicos; ensayo completo recomendado pero opcional, indicador de «probado» invalidado al modificar contenido relevante."
- **S26.** "Las diez rondas usan una duración común por actividad, **30 s predeterminados, configurable de 10 a 120 s**".
- **S27.** "Una actividad publicada por juego como máximo."
- **S28.** "Dos actividades completas de ejemplo, una por juego, sobre ayuno y oración, editables, disponibles para ensayo, **no publicadas automáticamente**."

## Tasks

| ID | Spec | Tarea | Ruta | Commit |
|---|---|---|---|---|
| T1 | S1-S15 | Feature document y proyección de tasks | — | — |
| T2 | S11-S14 | Scaffold estático, design system JLA, tokens, favicon, shell `index.html` | inline | sin repo git (L3.8) |
| T3 | S10 | Capa de persistencia IndexedDB versionada + migraciones | inline | sin repo git (L3.8) |
| T4 | S4-S6, S12 | Núcleo PIN (PBKDF2) y archivo de recuperación, con tests | inline | sin repo git (L3.8) |
| T5 | S2, S3, S8 | Portada con dos tarjetas, engranaje Administrar, pantalla sin actividad publicada | inline | sin repo git (L3.8) |
| T6 | S4, S5, S7, S9, S15 | Shell de admin de 3 secciones + Configuración general (prefs, cambio de PIN, recuperación, cierre de sesión, aviso de pérdida de datos) | inline | sin repo git (L3.8) |
| T7 | S1 | Verificación: tests unitarios RED→GREEN, smoke de módulos, navegador real | inline | sin repo git (L3.8) |
| T8 | S13 | README con ejecución local y publicación en subruta | inline | sin repo git (L3.8) |
| T9 | S1, S4, S5, S12 | Verificación independiente del guard de acceso y endurecimiento de los defectos reportados | inline | sin repo git (L3.8) |
| T10 | S13 | Repositorio público, commit inicial y publicación en GitHub Pages verificada | inline | b343b2d (fase 1) |
| T11 | S21, S25 | Modelo de actividades, validación estricta y firma de contenido relevante, con tests | inline | pendiente |
| T12 | S17, S18 | Motor de sopa: generación determinista 20×20, verificación de ubicaciones, con tests | inline | pendiente |
| T13 | S19, S20 | Variantes: generación, aprobación de una sola e invalidación al cambiar palabras, con tests | inline | pendiente |
| T14 | S22 | Instrucciones por plantilla con duración interpolada, con tests | inline | pendiente |
| T15 | S28 | Actividad de ejemplo de sopa (ayuno y oración), borrador, con variante aprobada | inline | pendiente |
| T16 | S19, S23, S24 | Editor de sopa: campos, orden manual de palabras, autoguardado e indicador, vista previa de variantes | inline | pendiente |
| T17 | S16 | Verificación: unitarios + smoke de navegador extendido a fase 2 | inline | pendiente |
| T18 | S13 | Commit, push y verificación del sitio publicado | inline | pendiente |

Evidencia de cierre de fase 1: `node --test tests/*.test.mjs` → 48/48; `node tests/browser-smoke.mjs` → 15/15 verificaciones en Chromium, 3 corridas consecutivas verdes; verificación independiente (`gentle-ai-verify`) sin defectos restantes; capturas reales en `docs/capturas/`.

## Log

**L1** — Pedido original del usuario (verbatim):

> Actúa como un desarrollador senior Full Stack, experto en HTML, CSS, JavaScript, aplicaciones web offline y GitHub Pages.
>
> Te adjunto el documento **JLA_Dinamicas_Biblicas_Roadmap_y_Prompt_Maestro.md**, que contiene los requisitos, el roadmap y las especificaciones del proyecto **JLA Dinámicas Bíblicas**.
>
> **Tu misión:**
>
> 1. Lee y analiza completamente el archivo adjunto antes de comenzar.
> 2. Considera el documento como la fuente principal de requisitos. No omitas funcionalidades.
> 3. Desarrolla la aplicación siguiendo las fases del roadmap, comenzando por la fase 1.
> 4. Utiliza una arquitectura limpia, modular, mantenible y compatible con GitHub Pages, sin backend ni servicios de pago.
> 5. Implementa funcionalidades reales, no solamente diseños visuales o simulaciones.
> 6. Verifica y prueba cada fase antes de continuar con la siguiente.
> 7. Conserva las funcionalidades ya implementadas al avanzar de fase.
> 8. Si encuentras alguna ambigüedad menor, aplica una solución técnica razonable y documenta tu decisión. Consulta únicamente si existe un impedimento importante.
>
> **Importante:** Los dos juegos, Sopa de letras y Palabras desordenadas, deben respetar exactamente las reglas, tiempos, impresión, proyección y revisión establecidos en el documento.
>
> **Comienza ahora:** confirma que has leído el archivo completo, presenta brevemente la arquitectura propuesta y desarrolla la **fase 1** con código funcional. Indica cómo probarla y cuáles son los criterios de aceptación cumplidos.
>
> No avances a la siguiente fase hasta que la fase actual esté validada.

**L2** — Clasificación: tarea **grande** (10 fases, multi-sesión, criterios de aceptación 14 y 15 dependen de fases futuras). Rutas: implementación inline en fase 1 (unidades interdependientes que comparten contratos de datos), sin subagentes de escritura.

**L3** — Decisiones técnicas de fase 1 (ambigüedades menores resueltas sin consultar):
1. **Sin build step, sin bundler, sin dependencias.** ES modules nativos + rutas relativas (`./src/...`), obligatorio por S13/S14.
2. **Router por hash** (`#/`, `#/juego/sopa`, `#/admin`, `#/admin/<sección>`). GitHub Pages no reescribe rutas: un router por path rompería la navegación en subruta y en recarga.
3. **IndexedDB como única fuente de verdad** para datos y sesiones; `localStorage` se reserva para preferencias pequeñas si hiciera falta (hoy no se usa: las prefs también van a IndexedDB, que es una store key-value igual de simple y evita dos mecanismos).
4. **PIN hasheado con PBKDF2-SHA256** (210 000 iteraciones, sal de 16 bytes). S12 exige documentar que no protege contra acceso al navegador; igual no se guarda el PIN en claro.
5. **Archivo de recuperación = prueba de posesión local**: contiene `installationId` + `recoveryKey` (32 bytes aleatorios) además de metadatos. Importarlo requiere coincidencia con lo guardado en el dispositivo; con eso se define un PIN nuevo sin tocar actividades. Se regenera al cambiar el PIN.
6. **Desbloqueo de admin en memoria**, no persistido: se pierde al recargar (se vuelve a pedir PIN) y no se pide al navegar entre secciones internas, tal como S4.
7. **Tamaño Grande por defecto** vía `data-size` en `<html>`; Alto contraste independiente vía `data-contrast`. Ambos persistidos.
8. **Sin repositorio git**: el proyecto no está inicializado como repo. No se hacen commits porque el harness prohíbe commitear sin pedido explícito del usuario. Decisión registrada como pendiente en T2-T8.
9. **Fuera de alcance en fase 1** (no se simula ni se stubea): motores de juego, temporizadores, audio, ensayos, impresión/PDF, biblioteca, respaldos JSON, proyección de dos ventanas, service worker. Cada uno llega en su fase.

**L4** — Verificación de fase 1: `node --test` sobre los módulos puros (PIN, recuperación, prefs, router, gate de admin, migraciones) con RED observado antes de implementar; smoke de importación de todos los módulos; servidor estático local para la comprobación funcional en navegador.

**L5** — Dos bugs encontrados por la verificación en navegador que las pruebas unitarias no podían ver (ambos en `src/ui/common.js`, corregidos):
1. `createDialog` construía el `body` pero nunca lo anexaba al `<dialog>`: todos los diálogos abrían vacíos. El smoke falló por timeout esperando el título del diálogo de recuperación.
2. `createDialog` no exponía `content`, que `src/ui/security.js` ya usaba: `sheet.content.append` lanzaba TypeError y el diálogo de recuperación nunca aparecía.
Ambos son el argumento concreto de por qué la fase no se cierra con unit tests solos.

**L6** — Un tercer defecto de portabilidad detectado por lectura, no por test: la regla CSS `.segmented__option:has(input:checked), .segmented__option[data-selected="true"]` invalidaba la lista completa en navegadores sin `:has()`, dejando sin resaltar la opción elegida. Se separaron en dos reglas independientes.

**L7** — Verificación de fase 1 (primera pasada, evidencia reproducible):
- `node --test tests/*.test.mjs` → 33 pruebas, 33 pasan, 0 fallan.
- `node tests/browser-smoke.mjs` → 15 verificaciones en Chromium, todas OK, consola del navegador sin errores.
- Capturas generadas desde la app real en `docs/capturas/` (portada, PIN inicial, admin configuración, portada móvil).
- Sin desborde horizontal en 390×844; las tarjetas se apilan.

**L8** — Bug de pérdida de datos encontrado al repetir el smoke: falló 3/3 en «tras recargar se conservan las preferencias» con `data-contrast='jla'` en vez de `alto`, mientras `data-size` sí persistía. Causa raíz: `persistPrefs` escribía en IndexedDB en fire-and-forget; IndexedDB es asíncrono, así que una recarga inmediata después del cambio descartaba la escritura **sin ningún error visible**. No era flakiness del test: era una escritura perdida de la aplicación.

Corrección (revierte la decisión L3.3):
- Las preferencias pasan a `localStorage` mediante `readStoredPrefs`/`writeStoredPrefs` en `src/core/prefs.js`, con escritura **síncrona** y manejo de fallo (devuelve `false` si el almacenamiento rechaza). Es el uso que S10 autoriza explícitamente para preferencias pequeñas.
- Los datos estructurados y las sesiones siguen en IndexedDB, donde las escrituras críticas ya se esperan (`await setPin`, `await persistSecurity`).
- El botón «Descargar archivo» ahora espera la persistencia antes de afirmar que el archivo se descargó.
- Tests nuevos primero (RED: export inexistente), luego implementación: 7 pruebas de almacenamiento con storage falso, incluida la de un `setItem` que lanza.

Verificación posterior: 40/40 unitarias y 3 corridas consecutivas del smoke de navegador verdes.

**L9** — Verificación independiente (mecanismo 3, riesgo item 2: el PIN es un guard de acceso) con `gentle-ai-verify`, 4 rondas. La primera encontró 5 defectos reales; las siguientes confirmaron las correcciones y estrecharon la misma clase hasta eliminarla:

1. **Costo de PBKDF2 sin techo**: un registro manipulado con `iterations` gigante colgaba la verificación. Corregido con `PIN_MAX_ITERATIONS = 1_000_000` validado en `isPinRecord`, con tests que prueban que un costo absurdo se rechaza sin derivar.
2. **Estado en memoria mutado antes del commit**: `persistSecurity` asignaba `state.security` y después escribía; una transacción fallida dejaba la sesión creyendo en un PIN que no estaba en disco. Ahora escribe y recién entonces adopta.
3. **Desbloqueo huérfano por verificación asíncrona**: `gate.unlock()` ocurría después del `await` sin validar que la visita siguiera vigente. Se agregó `navigationGeneration` (se incrementa al navegar y al cerrar sesión) y la regla pura `canHonorVerification({ startedAt, current, route })`, con 4 tests. Se aplicó después a `setPin`, que tenía el mismo defecto en los flujos de configuración y recuperación.
4. **Fallo de guardado de preferencias silencioso**: `persistPrefs` devuelve el booleano de `writeStoredPrefs` y el panel lo informa en una línea `role="status"`.
5. **Descarga de recuperación sin esperar la persistencia**: `downloadRecovery` devuelve `{ downloaded, marked }`; el diálogo distingue «descargado y registrado» de «descargado pero no registrado».

Aprendizaje de diseño: desbloquear y ofrecer el archivo de recuperación son decisiones distintas. Cambiar el PIN invalida el archivo anterior, así que el archivo nuevo se ofrece siempre que el moderador esté dentro del panel desbloqueado (`shouldOfferRecoveryFile`), aunque el desbloqueo de esa operación haya quedado obsoleto por una navegación interna.

Veredicto final del verificador: **no quedan defectos**. Evidencia final: 48/48 unitarias, 15/15 de navegador, 3 corridas consecutivas verdes.

**L10** — Publicación (decisión del usuario en L9 de la conversación: hacer `git init`, subir y publicar en Pages, repo público).

- Repo: `d-yanez/jla-dinamicas-biblicas`, público, sitio en <https://d-yanez.github.io/jla-dinamicas-biblicas/>.
- Commit inicial `b343b2d` como **unidad de trabajo de la fase 1**: los archivos de la fase son interdependientes (los tests importan los módulos), así que commits intermedios no pasarían la suite. Desde la fase 2 se comitea por tarea.
- `.gitignore` excluye `.DS_Store`, `.atl/` (registro de skills local), `node_modules/` y dos artefactos locales (`deepseek-only-lite.profile.json`, `tests/.foreign-recovery.json`).
- El push falló primero por dos motivos distintos: SSH sin clave disponible en el shell (`Permission denied (publickey)`) y, por HTTPS, `HTTP/2` devolvía 400 en el `git-receive-pack`. Resuelto con el credential helper de `gh` y `http.version=HTTP/1.1` fijado en la config local del repo.
- Pages: *Deploy from a branch* → `main` / raíz, `status=built`, HTTPS aplicado.
- Criterio 15 verificado **contra el sitio real**, no solo local: `JLA_BASE_URL=https://d-yanez.github.io/jla-dinamicas-biblicas/ node tests/browser-smoke.mjs` → 15/15.




**L12** — Fase 2 cerrada. Entregado: modelo de actividades con validación estricta y firma de contenido relevante, motor de sopa determinista (400 letras A–Z, diez ubicaciones verificadas, ocho direcciones), variantes con aprobación única, instrucciones por plantilla con la duración interpolada, repositorio de actividades con siembra del ejemplo de ayuno y oración (borrador, con cuadrícula aprobada, nunca publicada), y editor completo con autoguardado, orden manual de palabras, vista de solución coloreada con tabla de coordenadas y verificación de requisitos.

Defectos encontrados durante la verificación de esta fase (los tres corregidos):

1. **Código basura en el botón ↑**: quedó un intercambio inválido (`word0(...)` inexistente) que además corrompía el orden de las palabras si hubiera compilado. Detectado por el análisis estático antes de ejecutar nada; reemplazado por `swapWords`.
2. **`normalized: ""` tratado como palabra válida**: la siembra del ejemplo construía las palabras con `normalized` vacío y `prepareWords` tomaba ese vacío como valor (`??` no cae con cadena vacía). Resultado: la generación del ejemplo fallaba **en silencio**, el ejemplo se guardaba sin cuadrícula y el listado decía «sin cuadrícula aprobada». Corregido con `wordText()` en `letters.js` (un `normalized` vacío significa «sin calcular», no «palabra vacía»), aplicado en `prepareWords`, `placementsCoverWords`, `variantCoversWords` y `wordsSignature`.
3. **Aserción débil en el smoke**: `/cuadrícula aprobada/` también coincidía con «**sin** cuadrícula aprobada», así que el test pasaba con el ejemplo roto. Endurecida a `/· cuadrícula aprobada/`.

Lección de orden: el defecto 2 lo encontró el smoke de navegador y no los unitarios, porque los unitarios probaban el motor con palabras bien formadas y nunca con el registro exacto que produce la siembra. Se agregaron dos pruebas de regresión: `normalized` vacío con texto válido, y la semilla fija del ejemplo de fase 2.

Evidencia: `node --test tests/*.test.mjs` → 84/84; `node tests/browser-smoke.mjs` → 22/22 (15 de fase 1 + 7 de fase 2). Capturas en `docs/capturas/sopa-lista.png`, `sopa-editor.png` y `sopa-solucion.png`.

**Estado al pausar (2026-10-20):** fases 1 y 2 terminadas y verificadas; commit y push hechos, despliegue verificado contra la URL real. Próxima tarea: **fase 3 — motor de palabras desordenadas** (10 soluciones y anagramas validados por multiconjunto de letras, hasta dos pistas por palabra, tres desempates, y recién ahí la actividad de ejemplo de ese juego). Nada de la fase 3 está escrito todavía.

**L13** — Bug reportado por el usuario al validar la fase 2: «he actualizado palabras, pero luego no se actualiza la cuadrícula» (con dos capturas: palabras editadas y una cuadrícula que seguía ubicando `SILENCIO` y `PERSEVERANCIA` ya reemplazadas).

Causa raíz: `wordText()` en `letters.js` prefería el campo `normalized` (caché) sobre `text` (lo que el moderador escribe). Al editar una palabra y generar variantes antes de que corriera el autoguardado, el motor ubicaba **la palabra anterior**. Reproducido en test unitario: `wordText({ text: "Consagración", normalized: "SILENCIO" })` devolvía `SILENCIO`.

Correcciones:
1. `wordText()` ahora trata `text` como fuente de verdad y `normalized` como caché; solo cae al `normalized` cuando no hay texto (datos antiguos).
2. El editor sincroniza `normalized` en cada tecla, así ninguna caché queda vieja.
3. Aviso **inmediato** al editar: «La cuadrícula no coincide con las palabras actuales. Actualizá la cuadrícula…», con el botón cambiando a **«Actualizar la cuadrícula»**, y el badge de la variante aprobada pasando a «Aprobada, pero desactualizada» en vez de mentir. No se puede aprobar una cuadrícula desactualizada.
4. Un resultado de «cumple todos los requisitos» se borra en cuanto el contenido cambia: un veredicto viejo a la vista es peor que ninguno.
5. La celda de la solución expone `data-word` con la palabra **ubicada** (no el texto actual), que es la evidencia real de qué se ubicó.

Lecciones de verificación (dos fallos del propio test, no de la app):
- El smoke esperaba `/Las palabras cambiaron/`, texto que ahora también emitía el aviso inmediato: medía antes del autoguardado. Se separaron los mensajes y el test verifica ambos, en orden.
- La primera aserción comprobaba el texto de la tabla de soluciones, que muestra el texto **actual** de la palabra: no probaba nada sobre lo ubicado. Reemplazada por `data-word`, que falla si el motor usa la palabra vieja.

Evidencia: `node --test tests/*.test.mjs` → 88/88 (4 pruebas nuevas en `tests/stale-word.test.mjs`); `node tests/browser-smoke.mjs` → 23/23 (nueva verificación: «la cuadrícula regenerada ubica la palabra editada, no la anterior»).

**L14** — El smoke de L13 pasó local y falló contra el sitio publicado. No era el despliegue: era el test midiendo un estado **transitorio** (el aviso inmediato y la etiqueta «Actualizar la cuadrícula» mientras se tipea) que el autoguardado de 800 ms puede adelantar. En local las aserciones entraban antes del guardado; contra Pages, latencia mediante, no.

Corrección: el smoke verifica solo el estado **estable** (las variantes se descartaron, el aviso persistente aparece, el veredicto viejo de requisitos se limpió). La regla que sostiene el aviso transitorio (`variantCoversWords` falso ⇒ cuadrícula desactualizada) ya está cubierta por unitarios, y el estado transitorio queda documentado como no verificable de forma determinista sin congelar relojes.

Lección: un test que compite con el debounce de la aplicación es flaky por diseño. Se verifica el resultado, no el parpadeo intermedio.

Verificación: 23/23 local y 23/23 contra `https://d-yanez.github.io/jla-dinamicas-biblicas/`.
