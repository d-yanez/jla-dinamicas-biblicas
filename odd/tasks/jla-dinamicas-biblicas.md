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

### Fase 3 — Motor de palabras desordenadas

- **S29.** Roadmap, fase 3 — criterio de salida: "10 soluciones y anagramas validados, dos pistas opcionales, 3 desempates".
- **S30.** "**10 palabras** con solución editable, anagrama editable o regenerable, **hasta dos pistas opcionales** por palabra; orden manual."
- **S31.** "Verificar que solución y anagrama contengan exactamente el mismo multiconjunto de letras, normalizando acentos y mayúsculas según reglas documentadas; no aceptar letras faltantes o extras."
- **S32.** "Preparar **3 palabras de desempate** (una principal y dos reservas), con respuesta y anagrama válidos; requisito para publicar."
- **S33.** "Dos actividades completas de ejemplo, una por juego, sobre ayuno y oración, editables, disponibles para ensayo, **no publicadas automáticamente**." (la de este juego se siembra en esta fase, cuando ya existe su validador)

### Fase 4 — Presentación y temporizadores

- **S34.** Roadmap, fase 4 — criterio de salida: "10 rondas por juego, control manual, sonidos, atajos, extra de 60 segundos".
- **S35.** "Introducción muestra cuadrícula sin resolver, nombre/tema e instrucciones; reloj detenido."
- **S36.** "Primera ronda comienza con botón **Mostrar palabra**; ocultar la cuadrícula y proyectar **solo palabra objetivo**, cronómetro grande y **historial de palabras anteriores**."
- **S37.** "**Siguiente palabra** avanza y arranca el cronómetro inmediatamente con una sola acción; jamás avanzar automáticamente al llegar a cero. Al llegar a `00:00` detener. Pausar/reanudar, reiniciar tiempo de la ronda, avanzar y retroceder; al retroceder restaurar estado previo con cronómetro pausado. Evitar dobles avances por clic/tecla repetidos."
- **S38.** "Tras ronda 10, moderador inicia manualmente **60 segundos extra**."
- **S39.** "Revisión manual: confirmar antes de mostrar respuestas al público, revelar una ubicación/solución por acción, colores distinguibles que persisten en la cuadrícula hasta completar las diez."
- **S40.** "Proyectar solamente palabra desordenada actual, reloj y pistas ya mostradas; **no mostrar historial** de palabras anteriores."
- **S41.** "Pausar/reanudar, reiniciar tiempo preservando pistas, volver a ronda anterior preservando pistas y con reloj pausado, revelar pista 1/2 manualmente."
- **S42.** "Empates: palabra extra **sin cronómetro**, primero en levantar mano y responder correctamente; respuesta revelada manualmente."
- **S43.** "Sonido activado por defecto al **30 %**; volumen ajustable, silencio, campana inicial, tic en últimos cinco segundos, campana final." + capa de tensión sintetizada (L23).
- **S44.** "Atajos fijos en ambos juegos: `Espacio` pausar/reanudar, `→` avanzar, `←` retroceder, `R` reiniciar reloj, `F` pantalla completa, `M` activar/silenciar, `?` ayuda. En Juego 2, `1` y `2` muestran pistas."
- **S45.** "Pausa de presentación: sustituir temporalmente contenido público por pantalla neutral JLA, pausar reloj, preservar todo, restaurar contenido al volver y reanudar reloj solo manualmente."
- **S46.** "Reflexión bíblica final opcional, en **pantalla separada** activada manualmente después de revisión... Después, pantalla **Gracias por participar**, **Volver al inicio** y **Jugar nuevamente**."
- **S47.** "Finalizar anticipadamente o mostrar soluciones públicas requiere confirmación. Avance de ronda y pistas son inmediatos, con protección anti doble acción."
- **S48.** "Ayuda `?` en juegos reales y ensayos, específica por juego; al abrir, pausar el cronómetro y al cerrar permanecer pausado."

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
| T19 | S31 | Núcleo de anagramas: normalización documentada, multiconjunto y generación determinista, con tests | inline | pendiente |
| T20 | S30, S32 | Modelo de palabras desordenadas: palabras con pistas y tres desempates, con tests | inline | pendiente |
| T21 | S29, S33 | Validación estricta y ejemplo de ayuno y oración sin publicar, con tests | inline | pendiente |
| T22 | S30 | Extraer la sesión de borrador y los campos comunes para no duplicar el editor | inline | pendiente |
| T23 | S30 | Editor de palabras desordenadas: solución, anagrama regenerable, pistas y desempates | inline | pendiente |
| T24 | S29 | Verificación: unitarios + smoke extendido a fase 3 | inline | pendiente |
| T25 | S13 | Commit, push y verificación del sitio publicado | inline | pendiente |
| T26 | — | Publicación mínima (una por juego) para que exista contenido jugable | inline | pendiente |
| T27 | S35-S38, S41 | Motor de rondas puro: etapas, reloj, pausa, reinicio, avanzar/retroceder, doble acción, extra de 60 s | inline | pendiente |
| T28 | S39, S42 | Revisión secuencial con retroceso sin borrar revelados, y desempate sin cronómetro | inline | pendiente |
| T29 | S43 | Audio sintetizado: campana, tic con intensidad, campana final y tensión | inline | pendiente |
| T30 | S36, S40 | Pantalla de juego: intro, ronda, historial (sopa), pistas y descubrimientos (palabras) | inline | pendiente |
| T31 | S44, S47, S48 | Atajos, anti doble acción, ayuda que pausa y confirmaciones | inline | pendiente |
| T32 | S45, S46 | Pausa de presentación, reflexión y pantalla de gracias | inline | pendiente |
| T33 | S34 | Verificación: unitarios del motor + sesión completa en navegador | inline | pendiente |
| T34 | S13 | Commit, push y verificación del sitio publicado | inline | pendiente |

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

**L15** — Decisiones técnicas de fase 3 (ambigüedades resueltas sin consultar):

1. **Una sola regla de normalización para los dos juegos**: mayúsculas, sin acentos, `Ñ→N`, solo `A–Z`, largo 2–20. Vale para la sopa (ubicar) y para las palabras desordenadas (comparar multiconjuntos). Documentada en `letters.js` y usada por ambos motores.
2. **El anagrama se guarda y se muestra normalizado** (mayúsculas, sin acentos). Mostrar `ORACIÓN` mezclada con tildes filtraría la posición del acento y regalaría parte de la respuesta.
3. **El anagrama no puede ser igual a la solución** y la generación prefiere permutaciones con dos o más posiciones cambiadas; acepta una sola si no hay mejor. Si la palabra no admite ninguna permutación distinta (todas las letras iguales), el motor devuelve un error concreto en vez de un anagrama trivial.
4. **Las pistas son texto libre opcional**: máximo dos por palabra, recortadas, hasta 140 caracteres. No participan de la validación de multiconjunto.
5. **Tres desempates exactos**, rotulados Principal, Reserva 1 y Reserva 2, con la misma validación que las palabras y sin pistas.
6. **Orden de ronda relevante en este juego**: a diferencia de la sopa (donde reordenar no cambia la cuadrícula), en palabras desordenadas el orden define la secuencia jugada, así que cuenta como contenido relevante e invalida el «probado».
7. **La siembra ahora incluye los dos ejemplos**: la de palabras desordenadas se agrega recién ahora, cuando existe su validador (era la decisión pendiente de L11.5).
8. **Extracción previa a escribir el segundo editor**: la sesión de borrador (autoguardado, indicador, lista, apertura, duplicado, limpieza de requisitos) y los campos comunes se extraen a módulos compartidos. Copiar 600 líneas del editor de sopa habría duplicado el lugar donde viven los bugs de guardado.

**L16** — Fase 3 cerrada. Entregado: motor de anagramas (normalización compartida con la sopa, multiconjunto de letras, generación determinista por semilla con preferencia por mover al menos dos letras y error explícito cuando no existe anagrama distinto), modelo de palabras desordenadas con solución/anagrama/hasta dos pistas/orden manual, tres desempates rotulados, validación estricta con mensajes por campo, y el ejemplo de ayuno y oración **sin publicar** con nueve pistas y tres desempates válidos.

**Refactor previo obligatorio**: se extrajeron `draft-session.js` (autoguardado, indicador, lista, apertura, duplicado, limpieza de requisitos, selección por juego) y `activity-editor.js` (campos comunes, plantilla de instrucciones, verificación de requisitos). El editor de sopa se reescribió como sección delgada y el de palabras desordenadas se escribió una sola vez. Copiar el editor habría duplicado justo los lugares donde viven los bugs de guardado.

Defectos encontrados durante la fase (todos corregidos):
1. **Regresión del refactor detectada por el smoke**: `renderVariants` cortaba con `isConnected`, pero al montar la sección la caja todavía no estaba adjunta, así que la cuadrícula no se dibujaba (0 celdas). Se quitó el guard: renderizar en un nodo desconectado es inocuo.
2. **Colisión de prefijos en los selectores del test**: `Solución del desempate 1` y `Anagrama del desempate 1` también empezaban con `Solución `/`Anagrama `, y `Regenerar anagrama 1` matcheaba `…10`. Se rotularon los desempates como «Respuesta» (la palabra del documento) y se usaron patrones exactos.
3. **Dato de test incorrecto**: `OOICARN` tiene el mismo multiconjunto que `ORACION` (la O se repite), así que era un anagrama válido y no un caso de letra extra. Corregido a `OOICARNO`.

Evidencia: `node --test tests/*.test.mjs` → 106/106 (18 pruebas nuevas de anagramas y modelo de palabras); `node tests/browser-smoke.mjs` → 28/28 (5 verificaciones nuevas de fase 3).

**L17** — El smoke contra el sitio publicado falló una vez justo después del deploy (`317236d`) y pasó en dos corridas posteriores. No era la app: la siembra de los dos ejemplos estaba correcta en IndexedDB (verificado con un script que leyó la base del sitio publicado) y el fallo fue la ventana de propagación del CDN de GitHub Pages, en la que conviven archivos viejos y nuevos.

Lección de proceso: después de un deploy, **esperar la propagación antes de correr la verificación contra la URL pública**. El SHA de `/deployments` confirma que el despliegue terminó, no que el CDN ya sirva todos los archivos nuevos. Para el desarrollo diario, el smoke local sigue siendo la verificación primaria; el remoto valida el despliegue (rutas, MIME, HTTPS), no la lógica.

Evidencia final: 28/28 local y 28/28 contra `https://d-yanez.github.io/jla-dinamicas-biblicas/` en dos corridas consecutivas.

**L18** — Bug reportado por el usuario al validar la fase 3: la sección «Palabras desordenadas» decía «Todavía no hay actividades», aun estando desplegado el ejemplo.

Causa raíz: la siembra usaba **una única marca global** (`examplesSeededAt`) y se cortaba con `if (existing.length > 0) return`. El navegador del usuario ya tenía esa marca desde la fase 2 —cuando el único ejemplo era la sopa—, así que el ejemplo agregado en la fase 3 **nunca llegó a su dispositivo**. Un lector nuevo sí lo recibía, por eso el smoke en contexto limpio pasaba: el test no podía ver el defecto.

Corrección:
1. **Siembra por ejemplo**: cada ejemplo lleva `exampleKey` estable (`sopa-ayuno-oracion`, `palabras-ayuno-oracion`); se siembra el que falte según la lista `examplesSeeded`. Así los ejemplos de fases futuras llegan a navegadores existentes sin duplicar los que ya están.
2. **Migración de la marca vieja**: si existe `examplesSeededAt` y no la lista nueva, se asume sembrado solo el ejemplo de sopa.
3. **Una copia no es el ejemplo**: `duplicateAsDraft` limpia `exampleKey`, así duplicar no bloquea la siembra. `normalizeActivity` conserva la marca al leer.
4. **Nueva verificación de navegador** que reproduce el estado exacto del usuario (borra el ejemplo de palabras, borra la lista y deja la marca antigua), recarga y exige que el ejemplo reaparezca. Sin esa prueba, el defecto era invisible.

Evidencia: `node --test tests/*.test.mjs` → 113/113 (7 pruebas nuevas en `tests/examples.test.mjs`); `node tests/browser-smoke.mjs` → 29/29.

**L19** — Dos bugs reportados al validar la fase 3. Ambos eran míos.

1. **«Hasta 2 pistas» no hacía nada**: el botón agregaba una pista vacía y `normalizeHints` filtraba las pistas vacías, así que el autoguardado la borraba medio segundo después. Corregido: una pista vacía es una fila que el moderador acaba de agregar y se conserva; la validación sigue limitando a dos y a 140 caracteres. El botón se renombró a **«Agregar pista»**, porque «Hasta dos pistas» se leía como una etiqueta, no como una acción.
2. **Las ediciones posteriores a un guardado se perdían** («hace rollback»): los manejadores capturaban los objetos `word`/`tiebreaker` del borrador que existía al dibujar la fila. Cada autoguardado **reemplaza** `state.draft` con la copia normalizada, así que editar después de un guardado escribía en un objeto muerto y la escritura siguiente lo descartaba. Corregido en las dos secciones: los manejadores resuelven la entidad **por índice** desde el borrador vigente (`currentDraft().game.words[index]`).

Verificación nueva (sin la cual estos dos defectos eran invisibles): agregar una pista desde cero, escribirla, editarla después de un guardado y exigir que persista tras recargar; y en sopa, editar una palabra dos veces con un guardado en el medio y leer la base para exigir el segundo valor.

Evidencia: `node --test tests/*.test.mjs` → 115/115; `node tests/browser-smoke.mjs` → 32/32.

**L20** — Extensión pedida por el usuario (fuera del documento maestro): **descubrimientos de letras** además de las dos pistas. Decisión tomada por recomendación del arquitecto, con el criterio de entretenimiento y suspenso que pidió el usuario.

Diseño elegido: **vocales primero, después la última consonante**, configurable **por actividad (0–2)**, con revelado **manual ronda por ronda** (llega en la fase 4). Razones:
- Revelar una letra suelta al azar (p. ej. la posición 7 de `PERSEVERANCIA`) no produce ningún momento de descubrimiento: es el peor esquema para suspenso.
- Revelar todas las vocales convierte la ronda en una deducción colectiva («A _ U _ O») y es el mejor momento de juego; el segundo descubrimiento agrega la última consonante para que todavía quede una carta.
- Como el revelado es manual, las palabras cortas (`FE`) no se regalan: el moderador simplemente no lo usa ahí. Esa sola decisión elimina la debilidad del esquema.

Implementación:
- `computeReveals(solution, level)` puro en `anagram.js`: nivel 1 = vocales en su posición; nivel 2 = + última consonante; sin vocales cae a la primera consonante; sin consonantes no agrega nada.
- El modelo guarda `letterReveals` en la actividad y **las posiciones reveladas en cada palabra**. La pantalla de juego nunca las recalcula (S20): se leen como dato, igual que la cuadrícula de la sopa.
- El nivel cuenta como contenido relevante: cambiarlo invalida el «probado».
- El editor muestra un selector 0–2 y, por palabra, la vista previa enmascarada (`Descubrimiento 2: A _ U _ O N`).

Evidencia: `node --test tests/*.test.mjs` → 123/123 (8 pruebas nuevas en `tests/reveals.test.mjs`); `node tests/browser-smoke.mjs` → 34/34 (2 nuevas: configuración con vista previa y persistencia del nivel y las posiciones).

**L21** — Decisión del usuario sobre el audio (fase 4): **set del documento, sin agregados**.

Alcance cerrado, tomado de §8:
- **Campana inicial** al empezar la ronda.
- **Tic en los últimos cinco segundos**, suave y con intensidad creciente.
- **Campana final** al llegar a `00:00`.
- **Volumen 30 % por defecto**, ajustable; **silencio** con `M`.
- **Probar sonido** desde preparación.
- Arranque del contexto de audio en la primera interacción del usuario (restricción del navegador), nunca al cargar.

Descartado explícitamente por el usuario: sonido al revelar pistas/descubrimientos y colchón de ambiente. Motivo registrado: en la sala la música compite con la voz del moderador; el suspenso lo producen el tic y la pausa, no la música.

Implementación prevista: **WebAudio sintetizado** (oscilador + envolvente) en un módulo `audio.js`, sin archivos ni CDN: cero peso en el repo y disponible offline desde el primer uso. Si más adelante se prefiere una campana real, el reemplazo son dos archivos cortos y un punto de cambio.

**L22** — Bug reportado: «las palabras de desempate no permiten agregar pistas». Era una **restricción propia**, no del documento: §6 solo pide «respuesta y anagrama válidos» en los desempates, y en L15.5 se decidió dejarlas sin pistas sin fundamento en el texto. Corregido: los desempates comparten el editor de pistas con las palabras de ronda (0–2 pistas, hasta 140 caracteres), sus pistas se normalizan, se validan, entran en la firma de contenido relevante y las copia el duplicado.

Se extrajo un único `buildHints({ store, index, rerender })` para que palabras y desempates no tengan dos editores de pistas que se puedan desincronizar.

Evidencia: `node --test tests/*.test.mjs` → 125/125 (2 pruebas nuevas); `node tests/browser-smoke.mjs` → 35/35 (nueva verificación: agregar una pista al desempate 1 y comprobar en la base que quedó guardada).

**L23** — Decisión del usuario sobre música de fondo «tipo Kahoot». Preguntó explícitamente por música de suspenso de fondo; se le explicaron las tres restricciones (licencia propietaria del tema de Kahoot, peso y caché offline, arranque por interacción) y eligió **capa de tensión sintetizada**.

Alcance cerrado para la fase 4:
- **Pulso sintetizado con WebAudio**: sin archivos, sin licencia, sin peso en el repo.
- Intensidad baja durante la ronda; **acelera y sube en los últimos 10 segundos** (refuerza el tic de los últimos 5).
- **Volumen propio**, independiente de la campana y el tic.
- **Se corta al pausar y al llegar a `00:00`**, y no suena en la pantalla de pausa de presentación.
- Arranca con la primera interacción del moderador (restricción del navegador).

Descartado: incluir el tema de Kahoot (propietario) y agregar un loop libre (no había archivo ni licencia confirmada). Si más adelante se aporta un loop CC0, entra por un solo punto de cambio sin tocar el resto del audio.

Queda junto a L21: el set del documento (campana inicial, tic, campana final, volumen 30 % ajustable, silencio con `M`, probar sonido) sigue vigente y la tensión sintetizada se suma como capa opcional, activada por defecto.

**L24** — Calibración de dificultad del anagrama, pedida por el usuario («¿qué complejidad tiene? ¿es normal para 1 min?»).

Medición del algoritmo anterior (azar uniforme + dos guardas): no había nivel, había **varianza**. Con las mismas palabras del ejemplo: `PERDON` salía `REPDON` (4 de 6 letras en su lugar, se leía casi completo) mientras `PERSEVERANCIA` salía `AVPIERNECRSAE` (13 letras sin ningún punto de apoyo). Además la misma palabra cambiaba de dificultad según la semilla: entre 0 y 3 letras en su lugar.

Corrección — tres niveles elegidos por el usuario, **por actividad** (`anagramDifficulty`, por defecto `media`):
- **Fácil**: primera letra anclada y al menos dos letras en su lugar, con techo de la mitad del largo.
- **Media**: solo la primera letra anclada; techo de un tercio en su lugar.
- **Difícil**: sin ancla inicial y como máximo una letra quieta.

El techo de letras en su lugar es lo que impide que vuelva a salir un «REPDON». La generación es determinista por (semilla, nivel), el nivel se guarda con la actividad y **no** entra en la firma de contenido relevante: solo afecta a la próxima regeneración, no a lo ya generado.

Palabras de dos letras: el único anagrama posible no tiene anclas; queda documentado y el moderador lo resuelve no usando descubrimientos ahí.

Evidencia: `node --test tests/*.test.mjs` → 132/132 (7 pruebas nuevas en `tests/anagram-difficulty.test.mjs`, incluida la ventana de cada nivel sobre siete palabras y cinco semillas); `node tests/browser-smoke.mjs` → 36/36 (nueva verificación: elegir Difícil, regenerar y comprobar que se guarda y que los trece anagramas siguen válidos).

**L25** — Pregunta del usuario al validar: «¿ese valor dónde se cambia después?». La dificultad del anagrama vive en el editor de palabras desordenadas, por actividad, junto a «Descubrimientos por palabra». Cambiarla **no** re-mezcla lo ya generado, y regenerar trece anagramas a mano era tedioso, así que se agregó **«Regenerar todos los anagramas»**: aplica el nivel elegido a las diez palabras y a los tres desempates en una sola acción, omite las entradas cuya solución está vacía o es inválida y avisa cuántas regeneró y cuántas omitió.

Decisión: la acción es explícita y sin confirmación, porque el usuario la pide con un clic y el resultado se revierte regenerando de nuevo; no se destruye nada irrecuperable.

Evidencia: 132/132 unitarias; `node tests/browser-smoke.mjs` → 37/37 (nueva verificación: elegir Fácil, regenerar todo, exigir trece anagramas válidos y que el primero conserve la primera letra anclada).

**L26** — Decisiones de arranque de la fase 4.

1. **Dependencia que el roadmap no resuelve: sin publicación no hay nada que jugar.** La fase 7 trae la biblioteca completa (buscar, filtrar, papelera, respaldos), pero la pantalla de juego necesita una actividad publicada. Se adelanta **solo la publicación mínima**: publicar una actividad de un juego despublica la otra del mismo juego (la regla ya existe en la validación), y se puede despublicar. Buscar, filtrar, papelera y respaldos siguen en la fase 7.
2. **El motor de rondas es puro y con reloj inyectado**: sin DOM, sin `setInterval` propio. La UI lo alimenta con `tick(deltaMs)` y él devuelve eventos (`round-start`, `tick`, `time-up`). Así se prueban cero segundos, doble acción, retroceso y extra de 60 s sin esperar en tiempo real.
3. **El audio se decide en un plan puro** (`audio-plan.js`: qué suena ante qué evento y con qué intensidad) y se ejecuta en un módulo WebAudio delgado. El comportamiento audible se puede testear sin tarjeta de sonido.
4. **La capa de tensión es continua, no un evento**: sube en los últimos 10 s y se corta al pausar. Vive en la UI, alimentada por el tiempo restante.
5. **Un solo componente de juego** para los dos juegos, con diferencias por tipo: historial y cuadrícula en sopa, pistas y descubrimientos en palabras.

**L27** — La guarda anti doble acción tenía un defecto: `resume()` también marcaba el instante del último avance, así que un «Siguiente» inmediatamente después de reanudar quedaba bloqueado. Corregido: la guarda (300 ms) protege **avances** (empezar, siguiente, extra, revelar) y no reanudaciones. El smoke ahora espacia sus clics como una persona; la app no se ralentizó para complacer al test.

**L28** — El smoke destapó un problema de **pérdida de datos**: al editar una palabra se descartaban las variantes, así que corregir un error de tipeo y volver atrás dejaba la actividad sin cuadrícula aprobada y sin forma de recuperarla salvo regenerar. Contradice el principio del documento («priorizar la preservación de datos»). Corregido: al cambiar palabras se **conservan** las variantes que siguen verificando y solo se **retira la aprobación** cuando la cuadrícula ya no cubre las palabras. Un ida y vuelta de la palabra devuelve la misma cuadrícula (mismo id) y basta aprobarla otra vez. El aviso pasó de «las variantes se descartaron» a «la aprobación se retiró porque la cuadrícula ya no coincide».

Evidencia de fase 4: `node --test tests/*.test.mjs` → 157/157 (19 del motor de rondas, 4 del plan de audio, más las de preservación); `node tests/browser-smoke.mjs` → 45/45, con una sesión completa: publicar, jugar con pistas y descubrimientos, pausa, siguiente, retroceder, extra de 60 s, revisión secuencial con retroceso, reflexión y gracias, y la sopa con historial y cuadrícula coloreada.

**L29** — Comentarios del usuario sobre la fase 4, resueltos en este incremento.

1. **«Revelar y no aparece nada»**: la revisión funcionaba —la captura muestra 10 de 10 con colores y tabla— pero al entrar decía «Reveladas 0 de 10» con la cuadrícula sin pintar, y la primera solución aparecía recién con «Revelar siguiente». Era un problema de claridad, no de función. Se agregó un estado vacío explícito que explica que las respuestas se revelan de a una a propósito.
2. **Scroll en la revisión**: la tabla quedaba debajo de la cuadrícula. Ahora la revisión es **dos columnas** (cuadrícula a la izquierda, soluciones y controles a la derecha) y se apila solo en pantallas angostas.
3. **Orden de revisión**: las soluciones se listaban en el orden interno de las ubicaciones. Ahora van en **orden de ronda**, igual que el juego.
4. **Tamaño de proyección**: cuadrícula, palabra objetivo y cronómetro escalan con la ventana; en sopa las celdas llegan a 3 rem. La pantalla completa ahora se pide sobre la propia pantalla de juego, no sobre toda la app.
5. **Sonido de fondo**: la tensión sintetizada existía solo en los últimos 10 s y a un volumen casi inaudible. Ahora suena **desde el primer segundo** de la ronda y sube hacia el final.
6. **Tres etapas de audio configurables**: fondo durante la ronda, tic de los últimos cinco segundos y campana de inicio/cierre, cada una con su interruptor en el panel de ayuda, persistidas en `prefs`.

Evidencia: 158/158 unitarias (una nueva de los interruptores); `node tests/browser-smoke.mjs` → 46/46 (estado vacío de la revisión y configuración de las etapas de sonido).

**L30** — Dos decisiones del usuario, implementadas.

1. **Borrador independiente de la publicada (§4/S23)**, que hasta ahora no se cumplía: editar y guardar una publicada cambiaba lo que juega el público. Ahora: abrir una publicada desde la lista **crea (o reutiliza) un borrador** con `originId` y abre ese borrador; la fila publicada queda congelada; publicar ese borrador **reemplaza el contenido de la publicada conservando su identidad** (mismo id, mismo `createdAt`) y elimina el borrador. Además, tras publicar el editor **vuelve a la lista**: la fila publicada nunca se edita en el lugar. La lista muestra las dos filas y el editor rotula «Borrador de la publicada».
2. **Animaciones de proyección**: el cronómetro **pulsa y cambia a color de alerta en los últimos 5 segundos** (sincronizado con el tic), y al revelar una solución el color **barre la palabra de inicio a fin** con un retardo por celda. Solo la palabra recién revelada se anima; las anteriores quedan pintadas. CSS puro, sin dependencias, y desactivado por `prefers-reduced-motion`.

Corrección de verificación: dos pasos del smoke esperaban el badge «Publicada» dentro del editor; como publicar ahora vuelve a la lista, pasan a esperar la fila de la lista. La aserción del borrador espera la lista antes de contar filas, porque volver a la lista guarda el borrador de forma asíncrona.

Evidencia: 158/158 unitarias; `node tests/browser-smoke.mjs` → 47/47 (nueva verificación: editar la publicada abre un borrador, la publicada conserva su nombre y conviven las dos filas).

**L31** — Ajustes pedidos tras la primera prueba en proyector.

1. **Tensión de fondo eliminada**: al usuario le pareció «maoma». Se quitaron `startTension`/`setTension`/`stopTension` del motor, la capa del plan de audio y el interruptor de `prefs`.
2. **Layout de proyección**: la etapa se centra (antes todo quedaba a la izquierda), el fullscreen pinta el fondo crema (antes negro, con texto verde ilegible), y la palabra objetivo escala según su largo (`--letters`): `ARREPENTIMIENTO` ya no desborda ni arrastra scroll. En modo juego se ocultan el pie de página y el engranaje `html[data-mode="play"]`.
3. **Sonido de revelación**: la animación de revelar merecía su propio sonido; ahora al revelar suena un chime ascendente, con interruptor propio.
4. **Configuración de sonido en Administración**: nueva sección «Sonido» en Configuración general con volumen, silencio total y un interruptor por etapa (campana, tic, revelación), cada una con su botón «Probar». Todo sintetizado y persistido; la ayuda del juego mantiene volumen y silencio para el momento de jugar.

Evidencia: 157/157 unitarias; `node tests/browser-smoke.mjs` → 47/47.

**L32** — Música y cuenta regresiva, según lo elegido por el usuario.

- **Música sintetizada** con un secuenciador WebAudio (arpegio + bajo, sin archivos ni licencias): **lobby** en la introducción (84 BPM, suave), **pregunta** mientras responden (126 BPM, electrónica simple sin voces) y un **acorde de cierre** en «Gracias por participar». Un solo bucle vivo a la vez, elegido por la etapa; se corta en pausa de presentación, revisión y al salir.
- **Cuenta regresiva 3 · 2 · 1** con beeps ascendentes y campana al llegar a cero; la primera ronda arranca sola. Dos segundos que ordenan el inicio y crean expectativa.
- **Panel de sonido en Administración** ampliado a siete interruptores (música de espera, música de pregunta, cuenta regresiva, campana, tic, revelación, cierre) más volumen y silencio, cada uno con su botón **Probar**. La ayuda del juego mantiene volumen y silencio para el momento.
- Descartado explícitamente del set tipo Kahoot: respuesta correcta/incorrecta, marcador y podio, porque no hay puntaje digital (las parejas escriben en papel y el moderador evalúa).

**Bug encontrado y corregido**: `startMusic` llamaba a `prefsMusicOff`, un nombre que nunca existió (debía ser `musicOff`), y eso lanzaba `ReferenceError` al montar la pantalla de juego, que quedaba en «No se pudo continuar». Lo encontró el smoke al esperar un botón que nunca aparecía; un log temporal en el `catch` de `render` dio el stack exacto, y se retiró después. Lección: el `renderError` genérico oculta el stack; para depurar, un log temporal en el catch es más rápido que adivinar.

Evidencia: 157/157 unitarias; `node tests/browser-smoke.mjs` → 48/48 (cuenta regresiva visible e interruptor de música persistido).

**L33** — Respaldo general adelantado de la fase 7, porque el usuario lo necesita para llevar el trabajo a la computadora de la iglesia.

- `backup.js` (puro): `buildBackup` (actividades + configuración no sensible, **nunca el PIN ni el archivo de recuperación**), `parseBackup` (validación con errores específicos y límite de 5 MB), `mergeBackup` (todo entra como **borrador con id nuevo**, `originId`/`exampleKey` limpios, nombres repetidos renombrados con ` (importado)`, inválidas omitidas y contadas, la publicada local intacta) y `previewBackup` (qué trae el archivo, con tipo y estado de cada actividad).
- Repositorio: `exportBackup(db, prefs)` e `importBackup(db, text)`.
- Administración → Datos y respaldo: **Exportar respaldo** (descarga `jla-respaldo-AAAA-MM-DD.json`) e **Importar respaldo** con **vista previa** antes de escribir nada: fecha de exportación y la lista de actividades con su juego y estado, más un aviso si hay entradas inválidas.
- El botón de recuperación del PIN pasó de «Importar» a **«Usar archivo»**: dos botones llamados «Importar» confundían al usuario y colisionaban en las pruebas.

Bugs encontrados por la verificación:
1. Un reemplazo mío en `security.js` dejó un paréntesis de más y rompió el módulo (lo detectó el test de importación de módulos).
2. La acción de importar hacía `render()`, así que el mensaje de resultado se escribía en un nodo ya reemplazado y no se veía. Ahora importar no re-renderiza: el panel escribe el resultado en su propia línea de estado.

Evidencia: `node --test tests/*.test.mjs` → 168/168 (11 pruebas de respaldo); `node tests/browser-smoke.mjs` → 49/49 (exportación real, vista previa con la lista de actividades e importación de vuelta).

**L34** — Configuración inicial empaquetada, pedida por el usuario: configurar una vez, exportar el JSON, dejarlo en el repo y que la computadora de la iglesia abra con todo cargado.

- `assets/configuracion-inicial.json` es un **respaldo normal** (mismo formato que exporta la app). Se commitea y el navegador lo busca al arrancar.
- `planSeed` (puro, en `seed.js`): **solo aplica a una base vacía**; conserva como publicada la que venga publicada en el archivo (una por juego), deja el resto como borrador y descarta las inválidas.
- `applyBundledSeed(db)`: marca el intento en `bundledSeedAppliedAt`, no reintenta en cada arranque, y **«applied» significa «insertó algo»**: una semilla válida pero vacía cae a los ejemplos de demostración en vez de dejar al navegador sin nada.
- `scripts/validate-seed.mjs`: valida formato, valida cada actividad con las mismas reglas del editor y comprueba que no haya dos publicadas del mismo juego; devuelve 1 si hay problemas, 0 si el archivo falta. Sirve para correr antes de publicar.
- Un CLI **no puede importar** en el navegador (no hay backend: los datos viven en IndexedDB), así que el script valida y la importación ocurre en la app.

Detalle de verificación: el 404 de un archivo opcional queda registrado como error de consola y el smoke exige consola limpia. Por eso se commitea una **semilla vacía válida** en lugar de no tener archivo: el pedido devuelve 200, no inserta nada y los ejemplos siguen apareciendo.

Evidencia: `node --test tests/*.test.mjs` → 174/174 (6 de la semilla); `node tests/browser-smoke.mjs` → 49/49.

**L35** — Dos pedidos del usuario probando palabras desordenadas.

1. **«Falta la música de fondo durante el juego»**: la música estaba implementada pero con un defecto real de secuenciador. El contexto de audio arranca suspendido hasta el primer gesto; cuando se reanudaba, el planificador intentaba alcanzar todos los pulsos perdidos y disparaba una ráfaga. Ahora, si el reloj de audio quedó atrás, se salta al presente (`nextTime = currentTime + 0.05`) en vez de acumular, y el bucle de pregunta subió de ganancia (0.13 → 0.17). El interruptor está en Administración → Sonido → «Música mientras responden».
2. **«Cuando termine, que muestre la palabra, no al final»**: en palabras desordenadas, al llegar a `00:00` la **respuesta de esa palabra aparece en la misma ronda**, debajo del anagrama. No hay que esperar la revisión final: el flujo real del grupo es palabra por ronda y el primero que la acierta suma un punto. La revisión sigue disponible (lista las diez) y el desempate también, pero ya no son obligatorios para saber qué palabra era.

Verificado en un navegador real con una ronda de 10 segundos: a los 10 s aparece «Respuesta: Oración» con el reloj en `00:00`.

También quedó cerrado el **desempate en vivo** (era el hueco de §6 en la fase 4): nueva etapa `TIEBREAKER` en el motor con cinco pruebas (se abre solo desde la revisión, sin cronómetro, anagrama primero y respuesta revelada a mano, tres palabras, retroceso y guarda anti doble acción) y su pantalla con «Mostrar palabra», «Revelar respuesta», anterior/siguiente y vuelta a la revisión.

Evidencia: 179/179 unitarias; 50/50 de navegador en local.

**L36** — «No hay música de fondo en ninguno de los dos juegos». Era un **bug de lógica**: la compuerta de la música estaba **invertida**. `startMusic` la consultaba como «¿está apagada?», mientras que la pantalla de juego la respondía como «¿está encendida?». Resultado: todo bucle se detenía antes de crear siquiera el contexto de audio. Por eso el lobby no sonaba nunca y la ronda solo tenía cuenta regresiva y campana.

Cómo se encontró: instrumentando WebAudio (`createOscillator` parcheado) en vez de escuchar. En la introducción había **0 osciladores y 0 contextos**; en la ronda, 9 osciladores que eran exactamente los beeps y la campana. Después del arreglo: lobby 7 osciladores y la ronda sigue sumando (33 en la muestra).

Corrección: la compuerta pasó a llamarse `musicAllowed` (por defecto `true`) y `startMusic` la consulta como «¿está permitida?». Se agregó además una **prueba de regresión en el smoke**: un init script cuenta osciladores reales y el paso de la ronda exige que el contador crezca mientras corre el reloj. El smoke también lanza el navegador con `--autoplay-policy=no-user-gesture-required`, y dejó de apagar «Música mientras responden» al probar la persistencia de interruptores: estaba silenciando justo lo que después verifica.

Evidencia: 179/179 unitarias; 50/50 de navegador, ahora incluyendo «la música de pregunta debe seguir generando notas mientras corre el reloj».

**L37** — Acotación del usuario: «la música de fondo se detiene cuando se termina el tiempo y se reanuda cuando se pasa a la siguiente palabra».

Antes no era así: el bucle se elegía solo por **etapa**, así que seguía sonando sobre una ronda detenida. Ahora la música de pregunta **sigue al reloj**: corre mientras `running` es verdadero, se detiene en `00:00` (y en una pausa manual) y vuelve al pasar a la palabra siguiente. El evento `time-up` ahora vuelve a dibujar en los dos juegos: en palabras para mostrar la respuesta, en la sopa para que el bucle se corte.

Verificado instrumentando WebAudio en una ronda de 10 s:
- ronda corriendo (00:09): **+6 osciladores** en 1,2 s
- tras `00:00` con la respuesta a la vista: **+0**
- ronda 2 (00:09): **+7**

Evidencia: 179/179 unitarias; 50/50 de navegador.

**L38** — Versionado visible y revelado manual de la respuesta.

1. **Versionado**: `version.json` en la raíz (`0.6.0`) es la única fuente. La app lo lee al arrancar y lo muestra en el pie y en Administración → Datos y respaldo; viaja en cada respaldo como `appVersion`, y la vista previa de importación **avisa si el archivo viene de una versión más nueva**. Dos comandos: `node scripts/bump-version.mjs [patch|minor|major]` y **`node scripts/check-deployed.mjs`**, que compara el commit publicado en Pages con `HEAD` y falla si no coinciden o si hay cambios sin commitear. Sin build, esa es la única fuente honesta de «qué está publicado».
2. **Bug encontrado por el smoke al agregar lo anterior**: al reemplazar `APP_VERSION` por `version.json` quedó una referencia a la constante borrada en `buildRecoveryData`, que lanzaba `ReferenceError` **dentro** del manejador de descarga. El diálogo lo atrapaba, así que la descarga del archivo de recuperación dejaba de funcionar sin mensaje visible. Lo detectó el paso que espera el evento `download`; ahora usa `state.version`.
3. **Revelado manual en palabras**: botón **«Acertaron: mostrar respuesta»** durante la ronda. Pausa el reloj y muestra la solución al instante, sin esperar `00:00` (que sigue mostrándola sola). La palabra siguiente limpia el estado y la música vuelve.

Evidencia: 184/184 unitarias (5 de versiones); 51/51 de navegador, incluido «al acertar se pausa y se muestra la respuesta sin esperar el cero» y la versión en el pie.
