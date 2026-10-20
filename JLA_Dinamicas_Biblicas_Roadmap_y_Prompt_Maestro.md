# JLA Dinámicas Bíblicas
## Roadmap definitivo y prompt maestro de implementación

**Estado:** especificación funcional cerrada para desarrollo.  
**Destino:** web estática HTML/CSS/JavaScript, GitHub Pages, sin backend ni login.  
**Idioma:** español (Chile). **Estética:** verde bosque `#173B31`, crema `#F8F5EC`, dorado tenue `#E8C988`, llama discreta, juvenil y reverente.

## 1. Propósito y límites
Aplicación gratuita para dinámicas bíblicas presenciales del grupo juvenil JLA. Dos juegos: **Sopa de letras** y **Palabras desordenadas**, ambos con administración, ensayos, proyección, impresión y respaldos. No registrar participantes ni puntuaciones en línea; las parejas escriben en papel y el moderador evalúa manualmente. Toda la información permanece en el navegador del dispositivo salvo exportaciones/importaciones manuales. Sin sincronización entre dispositivos.

## 2. Roadmap por entregables

| Fase | Entregable | Criterio de salida |
|---|---|---|
| 1 | Estructura web, home, diseño responsive, persistencia y acceso PIN | Dos tarjetas Jugar; administración protegida; primer PIN y archivo de recuperación |
| 2 | Modelo de actividades, borradores y motor de sopa de letras | 20×20 exacto, 10 palabras válidas y coordenadas guardadas, variantes previsualizables |
| 3 | Motor de palabras desordenadas | 10 soluciones y anagramas validados, dos pistas opcionales, 3 desempates |
| 4 | Presentación y temporizadores | 10 rondas por juego, control manual, sonidos, atajos, extra de 60 segundos |
| 5 | Ensayos, guardado y recuperación | Ensayo aislado, restauración pausada, retroceso y confirmaciones sensibles |
| 6 | Impresión | Vista previa completa y PDF carta participantes/moderador, cálculos por parejas |
| 7 | Biblioteca y respaldo | Publicar, duplicar, buscar, filtrar, papelera, importar/exportar JSON seguro |
| 8 | Proyección segura | Ventana privada y pública sincronizadas, control único, recuperación ante desconexión |
| 9 | Offline, actualizaciones, accesibilidad | Service worker, funcionamiento sin red, actualización consentida, contraste y wake lock |
| 10 | QA y despliegue | Pruebas completas y publicación en GitHub Pages con instrucciones de uso |

## 3. Interfaz general
- Portada con dos tarjetas grandes: **Sopa de letras** y **Palabras desordenadas**, breve descripción y botón **Jugar**. Estética verde/crema/dorado, adaptable a móviles, tabletas, notebook y proyector.
- Engranaje **Administrar** discreto en esquina inferior. PIN local de cuatro dígitos: crear y confirmar al primer acceso, solicitarlo al volver desde portada; navegación dentro de admin sin pedirlo de nuevo. PIN no es seguridad criptográfica contra alguien con acceso al navegador: documentar limitación.
- Archivo de recuperación de PIN creado al configurarlo; importar archivo permite establecer PIN nuevo sin borrar actividades. PIN y recuperación son propios de cada dispositivo y se excluyen de todo respaldo JSON general o por juego.
- Admin con tres secciones: **Sopa de letras**, **Palabras desordenadas** y **Configuración general**.
- Si no hay actividad publicada, Jugar informa y ofrece volver al inicio.
- Ayuda `?` en juegos reales y ensayos, específica por juego; al abrir, pausar el cronómetro y al cerrar permanecer pausado.
- Tamaños de proyección **Normal** y **Grande**, siendo Grande predeterminado; ajuste independiente **Alto contraste** con estilo JLA predeterminado. Ningún texto ni cuadrícula debe recortarse.

## 4. Modelo común de actividades
- Cada actividad contiene identificador estable, tipo de juego, nombre, tema bíblico, referencia bíblica opcional, enseñanza opcional, instrucciones introductorias editables, reflexión bíblica final opcional y referencia, nombre del evento opcional y fecha opcional.
- Nombre del evento y fecha aparecen discretamente en PDF cuando existan, sin dejar huecos cuando falten.
- Instrucciones basadas en plantilla por juego, con duración de reloj interpolada dinámicamente.
- Biblioteca local de múltiples actividades con nombre/fecha, búsqueda por título o tema, filtros publicadas/borradores y orden fecha/nombre. Una actividad publicada por juego como máximo.
- Edición de actividad publicada crea **borrador independiente** y jamás cambia el contenido publicado hasta aprobación explícita. Duplicar produce borrador independiente. Borradores con autoguardado tras breve inactividad, indicador y **Guardar ahora**; nunca autopublicar.
- Publicación requiere validación estricta de campos esenciales, mostrando errores específicos; ensayo completo recomendado pero opcional, indicador de «probado» invalidado al modificar contenido relevante.
- Dos actividades completas de ejemplo, una por juego, sobre ayuno y oración, editables, disponibles para ensayo, **no publicadas automáticamente**. Referencias o citas bíblicas en RVR1960 solo si se verifican literalmente; si no se puede verificar, usar referencias sin transcripción.
- Papelera recuperable por juego; restauración y eliminación definitiva con confirmación. Eliminar la publicada la despublica; restaurarla no la publica automáticamente.

## 5. Juego 1: Sopa de letras
### Creación
- Cuadrícula **20×20** con **10 palabras administrables**; dificultad media, ubicaciones horizontal, vertical y diagonal, incluidas direcciones inversas. Verificar cada ubicación y guardar exactamente 400 caracteres, diez respuestas, posiciones inicial/final y dirección. Permitir generar variantes, previsualizar solución de cada una y publicar solo una aprobada; permitir ordenar manualmente la secuencia de palabras.
- Evitar regenerar la cuadrícula al jugar, imprimir, recargar o restaurar.

### Partida
- Introducción muestra cuadrícula sin resolver, nombre/tema e instrucciones; reloj detenido. Pantalla de espera neutral opcional previa, sin palabras ni respuestas.
- Primera ronda comienza con botón **Mostrar palabra**; ocultar la cuadrícula y proyectar **solo palabra objetivo**, cronómetro grande y **historial de palabras anteriores**. Las diez rondas usan una duración común por actividad, **30 s predeterminados, configurable de 10 a 120 s**.
- **Siguiente palabra** avanza y arranca el cronómetro inmediatamente con una sola acción; jamás avanzar automáticamente al llegar a cero. Al llegar a `00:00` detener. Pausar/reanudar, reiniciar tiempo de la ronda, avanzar y retroceder; al retroceder restaurar estado previo con cronómetro pausado. Evitar dobles avances por clic/tecla repetidos.
- Tras ronda 10, moderador inicia manualmente **60 segundos extra**; parejas levantan sus hojas; moderador revisa manualmente. Primeras tres parejas con resultados correctos finalistas, con criterio alternativo de mayor cantidad de respuestas correctas. Sin captura digital de puntajes.
- Revisión manual: confirmar antes de mostrar respuestas al público, revelar una ubicación/solución por acción, colores distinguibles que persisten en la cuadrícula hasta completar las diez. Vista final 20×20 resuelta sin lista lateral. Usar secuencia y contador; permitir retroceder sin borrar colores ya revelados.

## 6. Juego 2: Palabras desordenadas
### Creación
- **10 palabras** con solución editable, anagrama editable o regenerable, **hasta dos pistas opcionales** por palabra; orden manual. Verificar que solución y anagrama contengan exactamente el mismo multiconjunto de letras, normalizando acentos y mayúsculas según reglas documentadas; no aceptar letras faltantes o extras.
- Preparar **3 palabras de desempate** (una principal y dos reservas), con respuesta y anagrama válidos; requisito para publicar.

### Partida
- Intro con nombre/tema/instrucciones. **Comenzar juego** inicia primera ronda y reloj. Proyectar solamente palabra desordenada actual, reloj y pistas ya mostradas; **no mostrar historial** de palabras anteriores.
- 10 rondas, duración común por actividad **30 s predeterminados, 10–120 s configurable independientemente de Juego 1**. Siguiente con una acción y reinicio inmediato; cero detiene sin avanzar. Pausar/reanudar, reiniciar tiempo preservando pistas, volver a ronda anterior preservando pistas y con reloj pausado, revelar pista 1/2 manualmente.
- Tras décima ronda, **60 segundos extra** iniciados manualmente. Moderador elige tres parejas con más respuestas correctas. Empates: palabra extra **sin cronómetro**, primero en levantar mano y responder correctamente; respuesta errónea permite responder a otros. Tres desempates preparados, respuesta revelada manualmente.
- Revisión: confirmar entrada, revelar soluciones una a una manualmente, contador y retroceso de navegación; no revelar futuras respuestas.

## 7. Flujo compartido y cierre
- Pausa de presentación: sustituir temporalmente contenido público por pantalla neutral JLA, pausar reloj, preservar todo, restaurar contenido al volver y reanudar reloj solo manualmente. Disponible en partida y ensayo.
- Finalizar anticipadamente o mostrar soluciones públicas requiere confirmación. Avance de ronda y pistas son inmediatos, con protección anti doble acción.
- Reflexión bíblica final opcional, en **pantalla separada** activada manualmente después de revisión, con texto y referencia editables; moderador la explica. Si no existe, saltar a agradecimiento. Después, pantalla **Gracias por participar**, **Volver al inicio** y **Jugar nuevamente** (mismo contenido publicado).
- Confirmación antes de descartar/reiniciar sesión activa, navegación interna protegida y advertencia `beforeunload` cuando el navegador la permita. Guardar estado frecuente, incluyendo ronda, tiempo restante, pistas, revisiones, desempates, pausas y etapa. Al reabrir tras interrupción mostrar **pantalla de recuperación** con actividad, ronda y tiempo; elegir continuar pausado o descartar con confirmación. No borrar biblioteca ni actividad publicada.
- Ensayo integral de 10 rondas, tiempo, pistas, extra, desempates, revisión, reflexión y cierre, sin afectar partida real ni publicado. Etiqueta **MODO ENSAYO** siempre visible, discreta; salida con confirmación.

## 8. Audio, controles y proyección
- Sonido activado por defecto al **30 %**; volumen ajustable, silencio, campana inicial, tic en últimos cinco segundos, campana final. Considerar restricciones de reproducción de audio del navegador: iniciar/reanudar contexto tras interacción del usuario. Probar sonido desde preparación.
- Atajos fijos en ambos juegos: `Espacio` pausar/reanudar, `→` avanzar, `←` retroceder, `R` reiniciar reloj, `F` pantalla completa, `M` activar/silenciar, `?` ayuda. En Juego 2, `1` y `2` muestran pistas. Deshabilitar al escribir en inputs/textareas, al haber diálogos y donde causen acciones indebidas; confirmaciones sensibles siguen obligatorias. En `F` usar Fullscreen API con fallback e instrucciones; `Esc` sale de fullscreen sin pérdida.
- Controles discretos inferiores en pantalla única, ocultación automática tras inactividad y reaparición por ratón/tacto. En dos ventanas, controles **solo en moderador privado**.
- Modo opcional de dos ventanas del **mismo navegador/dispositivo**: ventana moderador con controles y respuestas **ocultas inicialmente** y botón **Ver respuesta** exclusivamente privado; ventana pública con únicamente contenido permitido. Comunicación local (p. ej. BroadcastChannel con alternativa) sin backend y offline. Confirmación explícita de qué ventana está en notebook y cuál en proyector antes de empezar. Si se cierra la ventana pública o se pierde comunicación, pausar, alertar, permitir reabrir y reanudar manualmente. Aclarar que desconexión física del cable puede ser indetectable.
- Protección automática al intentar ir al administrador desde partida: ocultar contenido público, pausar reloj, pedir confirmación. Si cancela, restaurar pantalla con reloj pausado.
- Una sola ventana moderadora con autoridad por partida. Pestañas duplicadas quedan en modo consulta y no pueden alterar rondas ni reloj. Recuperar autoridad si se pierde ventana principal con confirmación, sin dos líderes simultáneos; preservar modo proyector.
- Intentar mantener pantalla encendida durante partidas y ensayos mediante Screen Wake Lock cuando esté disponible, por defecto activado; liberar al salir, reintentar apropiadamente tras recuperar visibilidad si procede, aviso discreto si no se admite. No prometer impedir toda suspensión.

## 9. PDF e impresión
- Generar **PDF tamaño carta vertical (US Letter)** a partir del **contenido publicado exacto**; no regenerar ni alterar cuadrícula/anagramas al imprimir.
- Vista previa **completa de todas las páginas** antes de descargar; selección separada participantes/moderador, verificación de márgenes y cortes. Fondo blanco, textos oscuros, encabezado JLA discreto, optimizado para blanco y negro. Soluciones del moderador con colores distinguibles y marcas legibles también en grises.
- Campo **cantidad de parejas** antes de generar. Juego 1: **una página de sopa 20×20 sin lista de palabras por pareja**, con espacio para nombre de pareja; PDF moderador aparte con cuadrícula resuelta coloreada y lista de soluciones, una cuadrícula por página. Juego 2: **dos formularios de diez respuestas por página**, línea de corte central, nombre de pareja, numeración 1–10; `ceil(parejas/2)` páginas y formulario extra si impar. PDF moderador aparte con soluciones. Mostrar cálculo de hojas y formularios.
- En PDF incluir nombre del evento y fecha solo si están configurados. Evitar recortes; probar render real y exportación en navegador.

## 10. Datos, backups y seguridad de uso
- Preferir IndexedDB para datos estructurados y sesiones, con esquema versionado y migraciones; usar localStorage solo para preferencias pequeñas si corresponde. Los datos pueden perderse si el usuario limpia el navegador: avisar claramente.
- JSON export/import **general** (ambos juegos y configuraciones no sensibles) y **por juego**, con metadatos de esquema y versión, validación robusta, vista previa y confirmación. No exportar/importar PIN ni archivo de recuperación. Importación por fusión segura, resolver ID/nombres duplicados mediante renombrado o nuevos IDs; jamás cambiar actividad publicada automáticamente. Manejar archivos inválidos y límites de tamaño sin romper datos.
- Papelera local, restauración, borrado definitivo confirmado. Evitar que importación o restauración salte validación de publicación.
- Recordatorios discretos de respaldo **solo en administrador** cuando haya cambios importantes desde último JSON exportado; posponibles, nunca interrumpir partida/ensayo.
- Borradores con guardado automático y botón manual; no publicar automáticamente.

## 11. Offline, actualizaciones y preparación
- GitHub Pages: rutas relativas correctas bajo subdirectorio de repositorio, `index.html`, archivos estáticos, manifest si es pertinente, service worker con cache de app shell y dependencias necesarias. Tras una primera carga completa online, partida, admin, ensayo, PDF y biblioteca deben funcionar offline. Mostrar estado de conexión discretamente. Librerías necesarias para PDF deben quedar disponibles offline, no depender de CDN en ejecución.
- Detectar versión nueva y ofrecer aviso discreto; **aplicar actualización solo con consentimiento**, nunca recargar sesión o ensayo activo. Migraciones preservan datos y se prueban.
- Lista de preparación **opcional antes de partida real**, omisible: actividad validada/publicada, recursos offline, sonido, pantalla/fullscreen/proyector y hojas impresas. Distinguir chequeos automáticos de tareas manuales; nunca afirmar que un periférico funciona sin comprobarlo. También disponible desde administración.

## 12. Criterios de aceptación obligatorios
1. Portada funcional y navegación móvil/escritorio; PIN, recuperación y cierre de sesión admin.
2. Actividades ejemplo disponibles, editables y **no publicadas** al primer inicio.
3. Juego 1: cuadrícula 20×20 inmutable publicada, 10 ubicaciones válidas, variantes, orden manual y PDF coincidente.
4. Juego 2: diez anagramas exactos, pistas opcionales y tres desempates válidos.
5. Diez rondas completas en ambos, temporizador sin avance automático, pausa/reinicio/retroceso/avance único, 60 segundos extra manuales.
6. Soluciones solo por acción manual; nunca filtradas a proyector antes de revelación; revisión y cierre/reflexión.
7. Ensayo completo aislado, marca persistente y salida confirmada.
8. Recuperación tras recarga/cierre: misma actividad, ronda, tiempo, pistas, estado y reloj pausado.
9. PDF participantes y moderador en carta, vista previa completa, cálculo por parejas, identidad discreta, sin recortes y sin regeneración.
10. Publicación validada, edición publicada aislada, biblioteca, duplicado, papelera, import/export general y por juego, no incluir PIN.
11. Dos ventanas sincronizadas offline, una sola autoridad, pérdida de proyector causa pausa, respuestas privadas no aparecen públicamente.
12. Atajos, audio, fullscreen, alto contraste, pantalla encendida con fallback, controles ocultables, ayuda con pausa.
13. Offline tras carga inicial completa, actualización consentida y conservación de datos.
14. Tests de casos extremos: cero segundos, clic doble, palabra con acento, import corrupto, ID duplicado, almacenamiento lleno, recarga en desempate, eliminación de publicada, ventana duplicada y cambio de visibilidad.
15. GitHub Pages desplegado correctamente en subruta; README de instalación, uso, respaldos y limitaciones locales.

## 13. Decisiones de cierre sin nuevas consultas
- Revisión final **secuencial**, contador y retroceso; en sopa las soluciones reveladas permanecen coloreadas. No añadir selector arbitrario por número en esta versión.
- No agregar funciones no solicitadas (cuentas, rankings, nube, telemetría, compras, base de datos remota).
- En caso de ambigüedad, priorizar seguridad de proyección, preservación de datos, accesibilidad y simplicidad para moderador.
- No considerar una función terminada hasta probarla de extremo a extremo.

---

# PROMPT MAESTRO PARA ENTREGAR A LA IA PROGRAMADORA

Actúa como **arquitecto senior de frontend, desarrollador experto en HTML/CSS/JavaScript vanilla, diseñador UX de aplicaciones educativas y especialista en PWA/offline y GitHub Pages**.

Tu misión es **construir de principio a fin la aplicación web estática «JLA Dinámicas Bíblicas»**, implementando íntegramente la especificación anterior. **No generes solo una maqueta, pseudocódigo o pantallas vacías**. Entrega código funcional, estructura de carpetas, archivos listos para publicar, instrucciones de instalación y pruebas. Trabaja por las 10 fases del roadmap, verificando cada una antes de avanzar.

**Restricciones no negociables:** sin backend, sin cuentas, sin base de datos externa, sin costos obligatorios; compatible con GitHub Pages incluso cuando se publique en `https://usuario.github.io/nombre-repositorio/`; responsive; usable offline después de primera carga completa; datos locales con respaldo manual; ninguna respuesta privada debe filtrarse al proyector. Evita dependencias de CDN en tiempo de ejecución. No modifiques actividad publicada sin proceso explícito de aprobación. No regeneres contenido al jugar, recuperar o imprimir.

**Desarrollo solicitado:**
1. Presenta estructura de archivos y plan de implementación por fases.
2. Implementa el shell, diseño JLA y administración local.
3. Implementa modelos de datos, validadores y motores de los dos juegos con pruebas automatizadas de generación y permutación.
4. Implementa interfaz real de edición, biblioteca, borradores, publicación y papelera.
5. Implementa presentaciones completas de 10 rondas, cronómetros, sonido, atajos, ensayos y recuperación.
6. Implementa impresión PDF US Letter con vista previa de todas las páginas y conteo por parejas, con documentos separados de moderador.
7. Implementa ventanas privadas/públicas sincronizadas, autoridad única, detección de pérdida de ventana pública y privacidad.
8. Implementa PWA/offline, actualización consentida, alto contraste, wake lock con fallback y lista de preparación.
9. Incluye ejemplos editables de ayuno y oración no publicados, y un manual de uso breve en español.
10. Ejecuta pruebas unitarias e integrales o, si no hay entorno de ejecución, entrega scripts reproducibles y lista de verificaciones manuales. Corrige errores antes de dar por terminada cada fase.

**Formato de entrega:** indica archivos creados y propósito, decisiones técnicas, cómo ejecutar localmente, cómo publicar en GitHub Pages, cómo exportar/importar respaldos, cómo usar proyección de dos ventanas, cómo imprimir y qué limitaciones del navegador persisten. Incluye checklist final basado en los 15 criterios de aceptación anteriores. No declares «terminado» algo que no has implementado o comprobado.

**Regla de colaboración:** la especificación de este documento es la fuente de verdad. Resuelve detalles menores de manera sensata sin volver a preguntar; consulta únicamente si existe una contradicción que impida implementar. Prioriza entregar software funcional y verificable sobre adornos o funciones adicionales.
