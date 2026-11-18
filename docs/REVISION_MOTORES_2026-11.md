# Revisión de motores y de la app, con plan y verificación (14 nov 2026)

**Pregunta.** ¿Qué separa hoy a los motores de dibujo de producir libros para colorear mejores que
los de la competencia, en todos los estilos?
**Audiencia.** Quien produce los libros y quien programe las mejoras.
**Objetivo.** Una lista ordenada de áreas de oportunidad, cada una con su arreglo y con la medida
que demuestra que quedó resuelta.

Continúa a `REVISION_Y_PLAN_2026-10.md` (plan general) y `REVISION_PRODUCCION_2026-11.md`
(defectos de producción). No repite lo que allí quedó cerrado.

## 1. Cómo se revisó

| Qué | Con qué | Resultado |
|---|---|---|
| Pruebas | `npm test` | 110 de 110 pasan |
| Libro «más vendidos» | `node scripts/bench-book.mjs 3 50 KDP_8_5x11 adulto` | media 82,8–83,2 · mínima 70 · 0 flojas · 0 gemelas tras la curaduría |
| Repetición | `node scripts/bench-variety.mjs 5` | 0,2 gemelas por libro antes de curar |
| Motor × nivel × estilo | `node scripts/bench-styles.mjs 10` (nuevo) | 3 motores × 4 niveles × 7 estilos × 10 semillas = 840 páginas |
| Mirada directa | láminas de `bench-styles.mjs --html` y láminas de encuadres, fondos, páginas especiales y figuras | unas 110 páginas vistas |
| Flujo de la app | lectura de `index.html` y `js/app.js` | sin ejecución en navegador |

**Límites.** La app no se ejecutó en un navegador en esta sesión; lo dicho sobre la interfaz sale
del código y de la prueba real de la revisión del 3 de noviembre. No hay medidas de libros de la
competencia ni datos de ventas: datos insuficientes para una comparación cuantitativa con la
competencia. Donde este informe compara, lo hace contra las convenciones de la categoría ya
recogidas en la revisión de octubre. `bd` no está instalado en este entorno; las tareas del § 4
están redactadas para pasarlas a `bd create` tras `bd search`.

## 2. Diagnóstico

El camino principal funciona. Un libro «más vendidos» de nivel adulto sale con media de 83, sin
páginas flojas ni gemelas, y los niveles infantil (89–91) y trazo grueso (83–84) son todavía más
estables. Ese camino es estrecho.

Fuera de él aparecen tres problemas de fondo: los siete estilos casi no se distinguen entre sí, la
puntuación de calidad está calibrada para un solo público y castiga justo las páginas más ricas, y
las páginas con figura no se miden. Un termómetro que sólo marca bien a 36 °C no sirve para
detectar la fiebre.

### 2.1 Puntuación por motor y nivel (media de los 7 estilos, 10 semillas, página centrada)

| Motor | Niños | Trazo grueso | Adulto | Experto |
|---|---|---|---|---|
| Clásico | 89–91 | 83–84 | 73–80 | 38–43 |
| Radial | 61 | 83 | 60 | 5 |
| Modular (capas) | 69–81 | 85–94 | 68–77 | 0 |

### 2.2 Hallazgos, ordenados por efecto en el libro

**H1 · Los estilos son un acento, no un estilo.** Con la misma semilla, cambiar de estilo deja una
página que la propia app clasifica como gemela: parecido medio de 0,96 en el motor clásico, con
197 de 210 pares por encima del umbral de 0,90 (`TWIN_THRESHOLD`). En la lámina se ve por qué. La
silueta exterior, el núcleo y el anillo de cuentas son idénticos; sólo cambian los motivos de una o
dos bandas intermedias (`STYLE_WEIGHTS` en `mandalaClassic.js:20`). «Islámico» no tiene estrellas
entrelazadas, «celta» no tiene nudos, «azteca» no tiene grecas escalonadas, «sashiko» no tiene
asanoha ni seigaiha. Un comprador que busca «mandalas celtas» no reconocería el suyo.
La variedad del libro existe, pero la aportan la silueta, la estructura y el encuadre.

**H2 · El motor radial ignora el estilo.** Los siete estilos dan exactamente la misma página
(parecido 1,000 en 210 de 210 pares; mismas métricas al decimal). Además dibuja pétalos encimados
que se leen como manchas negras, y con nivel experto puntúa 5. El motor modular deja bandas anchas
vacías y un 66 % de trazos por debajo de 0,7 mm. Ninguno entra en el libro (decisión de octubre),
pero ambos se ofrecen en «Diseñar» con el selector de siete estilos y se exportan como página
suelta.

**H3 · La puntuación tiene un solo público.** `commercialScore` resta 15 puntos fijos si el trazo
baja de 0,8 mm y 10 si la celda mínima baja de 5 mm² (`commercialMetrics.js:331`). El nivel
experto (0,4 mm, 2 mm²) empieza con 25 puntos menos por definición.

| Perfil de producto | Nivel | Media | Mínima | Flojas (< 60) antes de curar |
|---|---|---|---|---|
| Más vendidos | adulto | 82,2 | 61 | 0 de 80 |
| Personas mayores · trazo grande | adulto | 83,3 | 60 | 0 de 80 |
| Niños · trazo grueso | adulto | 81,9 | 58 | 1 de 80 |
| Adultos · florales y tramas (0,7 mm) | adulto | 71,5 | 43 | 7 de 80 |
| Expertos · geometría sagrada (0,6 mm) | adulto | 71,3 | 42 | 8 de 80 |
| Expertos · geometría sagrada | experto | 50,6 | 20 | 60 de 80 |
| Más vendidos | experto | 41,8 | 14 | 76 de 80 |

Dos perfiles que la app ofrece traen un trazo que la app misma penaliza. Y un libro experto no
puede llegar a «Listo para KDP»: la curaduría gasta sus 8 intentos por página en un objetivo
inalcanzable. Al mirar las láminas, las páginas de experto son las más cercanas a un libro
«intrincado» de la categoría. La métrica y el ojo discrepan, y en este caso el ojo tiene razón.

**H4 · Penalizaciones estructurales en todas las páginas.** En el clásico adulto, el 35 % de los
trazos mide menos de 0,7 mm porque el trazo de detalle es `0,55 × grosor` con piso de 0,55 mm
(`mandalaClassic.js:80`): el motor dibuja a propósito lo que la métrica castiga (7,5 puntos). Los
«huecos» rondan el 25–28 % en cualquier página (unos 10 puntos). Hipótesis sin verificar: buena
parte son trazos ocultos por el relleno blanco de la banda vecina, que la medida vectorial cuenta
y la imprenta no. Mientras esas dos restas sean constantes, la puntuación distingue mal una página
buena de una excelente.

**H5 · Las páginas con figura no se miden.** `measureSvg` sólo lee trazos vectoriales; la figura
es una imagen. Un eclipse con un disco negro macizo obtiene 83. A la vista:

- *Figura rellena*: el contorno mide 3–4 mm frente a 0,8 mm del resto de la página, y el interior
  se llena con rosetas sueltas que flotan en lugar de bandas que sigan la forma. El resultado se
  lee como un recorte con pegatinas. Los rasgos que identifican al animal (ojo, hocico, pelaje)
  quedan tapados o perdidos.
- *Anillos*: las copias de la figura salen pálidas, de trazo fino y de unos 25 mm, junto a un
  mandala de trazo firme. No son coloreables y parecen de otra impresión.

**H6 · La dificultad progresiva no respeta el perfil.** La rampa va de 40 a `max(base, 200)`
(`bookPlan.js:568`). Un libro para niños (base 60) o de trazo grande (base 80) termina con
páginas de complejidad 200, la misma cima que un libro adulto.

**H7 · Tramas y fondos.** Hay 5 tramas. La línea de la trama es más fina que la del mandala, y el
mandala se asienta sobre un disco blanco cerrado por un círculo liso: la trama no dialoga con él,
se interrumpe. La página «trama» completa es una sola retícula a una sola escala (un rombo
repetido unas 150 veces) y puntúa 85; es la página más monótona del libro y la métrica no lo ve.

**H8 · Papel en blanco.** La página centrada con marco usa cerca de la mitad de la hoja de 8,5×11
(es el valor por defecto en «Diseñar»; el libro lo corrige con fondo). En «mandala que crece», la
etapa 2 de 4 es un mandala de unos 60 mm en una hoja vacía.

**H9 · Páginas especiales.** El mandala misterioso sigue con 7 figuras escondidas (pendiente 3.8
de octubre): el segundo libro de una serie las repite. Sus celdas con punto o raya son pequeñas
para colorear por código. Los rótulos y notas van en gris `#444` a 2,8 mm (unos 8 pt): en un
interior en blanco y negro, el gris se imprime tramado.

**H10 · App: pendientes que siguen abiertos.** Sin portada (KDP exige el PDF de cubierta
completa). Dependencias de CDN en el arranque (Shoelace, jsPDF, Workbox, idb-keyval, fuentes de
Google). Texto impreso con la fuente del sistema (`Georgia`). El PDF se arma en el hilo principal
y vive entero en memoria. No hay prueba de punta a punta en el repositorio. `js/app.js` pasó de
2 499 a 3 264 líneas con 126 escuchas de eventos en un solo archivo.

## 3. Comparación de caminos

| Criterio | Opción A · Profundizar el motor clásico | Opción B · Reparar radial y modular |
|---|---|---|
| Punto de partida | 73–91 según nivel; único con encuadres, fondos, figuras y curaduría | 60–77 en adulto; sin encuadres ni figuras |
| Identidad de estilo | 0,96 de parecido: hay que añadir gramática propia por estilo | radial 1,00 (ignora el estilo); modular 0,97 |
| Trabajo para llegar a libro | motivos y núcleos nuevos sobre una base probada | rehacer celdas, trazos y composición en dos motores |
| Riesgo | bajo: 110 pruebas y tres bancos lo vigilan | alto: casi sin pruebas propias |
| Efecto en el libro publicado | directo: el libro sólo usa este motor | nulo hasta igualar al clásico |

Veredicto. A concentra el esfuerzo donde ya hay medida, curaduría y libro; B reparte el mismo
esfuerzo en dos motores que hoy no llegan al PDF.
A conviene a quien quiere publicar libros distintos por estilo en las próximas semanas.
B sólo se justifica si se busca una estética que el clásico no pueda dar; hasta entonces, radial y
modular deben salir del selector o marcarse como experimentales.

## 4. Plan

Cada tarea lleva su comprobación. Las cifras de «hoy» son la línea base de este informe.
Orden: primero el instrumento de medida (fase 1), porque sin él las mejoras de dibujo no se pueden
demostrar.

### Fase 1 · Que la medida diga la verdad

| # | Tarea | Archivos | Cómo se verifica |
|---|---|---|---|
| 1.1 | Umbrales de la puntuación por público: `commercialScore` recibe el nivel y mide el trazo y la celda contra lo que ese nivel promete, no contra 0,8 mm y 5 mm² fijos. Umbral absoluto de imprenta aparte (nunca < 0,35 mm). | `commercialMetrics.js`, `levels.js`, `bookCurator.js` | `bench-styles.mjs` tabla 3: «más vendidos + experto» pasa de 76/80 flojas a ≤ 8/80; el caso adulto no cambia (82 ± 1). Prueba nueva: una página experta con celdas de 1 mm² sigue saliendo floja. |
| 1.2 | Coherencia perfil ↔ medida: los perfiles de 0,7 y 0,6 mm dejan de perder 15 puntos por su propio trazo (o suben a 0,8 mm si se decide que ése es el piso comercial). | `bookPlan.js` | tabla 3: `mindful_patterns` e `intricate_sacred` con ≤ 2/80 flojas (hoy 7 y 8). |
| 1.3 | Aclarar los «huecos»: medir sólo lo visible (descontar trazos tapados por rellenos blancos) o demostrar que son huecos reales. | `commercialMetrics.js` | 12 páginas rasterizadas a 300 ppp: el % de huecos vectorial difiere < 5 puntos del medido en píxeles. Hoy 25–28 % en todas las páginas. |
| 1.4 | Trazo de detalle y umbral de «fino» alineados: o el detalle sube a ≥ 0,7 mm en niveles comerciales o el umbral baja al mínimo real de imprenta. | `mandalaClassic.js`, `commercialMetrics.js` | «finas %» del clásico adulto < 10 (hoy 35). |
| 1.5 | Medir la tinta de las figuras: rasterizar la imagen de la figura a baja resolución y sumar negro macizo, grosor de contorno y tamaño de celda a la puntuación de la página. | `commercialMetrics.js`, `figureChecks.js` | prueba: la página del eclipse macizo puntúa < 60 (hoy 83); una figura de línea limpia no baja más de 3 puntos. |
| 1.6 | Medir la monotonía: número de formas de celda distintas y de escalas por página. | `commercialMetrics.js` | la página «trama» de una sola retícula puntúa < 70 (hoy 85). |

### Fase 2 · Estilos que se reconozcan

| # | Tarea | Cómo se verifica |
|---|---|---|
| 2.1 | Gramática propia por estilo en el clásico: cada estilo aporta al menos una silueta, un núcleo y dos motivos de banda exclusivos. Islámico: estrellas de 8, 10 y 12 puntas con lacería. Celta: nudos y trenzas de cinta (cruces por encima y por debajo). Azteca: grecas escalonadas y bandas de triángulos dentados. Sashiko: asanoha, seigaiha, shippo. Yantra: triángulos entrelazados, pétalos de loto y puertas cuadradas. Floral y geométrico: se quedan con el vocabulario actual, depurado. | `bench-styles.mjs` tabla 2: parecido entre estilos con la misma semilla ≤ 0,80 de media y menos del 10 % de pares ≥ 0,90 (hoy 0,96 y 94 %). La puntuación por estilo no baja de la línea base. |
| 2.2 | Prueba ciega: 28 páginas (4 por estilo) sin rótulo; una persona las clasifica. | ≥ 22 de 28 aciertos (79 %). Al azar serían 4. |
| 2.3 | Azteca y yantra en adulto: son los estilos con peor mínimo (37 y 42). Revisar los motivos que generan celdas pequeñas (`chevron`, `flame`, `triangle` en bandas estrechas). | mínimo ≥ 60 en 10 semillas para los 7 estilos (hoy 37–71). |
| 2.4 | Radial y modular: retirarlos del selector de «Diseñar» o rotularlos «experimental» y desactivar en ellos el selector de estilo. | prueba de interfaz: con motor radial, el selector de estilo está desactivado; ninguna página suelta de esos motores se exporta sin aviso. |

### Fase 3 · Figuras a la altura del mandala

| # | Tarea | Cómo se verifica |
|---|---|---|
| 3.1 | Contorno de la figura con el mismo peso que el contorno del mandala (1,2–1,5 × el trazo de la página, no 3–4 mm). | medida de 1.5: grosor mediano del contorno entre 1,0 y 1,6 mm en los 7 paquetes. |
| 3.2 | Relleno interior que sigue la forma: bandas paralelas al contorno (curvas de nivel de la silueta) rellenas con motivos del estilo, en lugar de rosetas sueltas; reservar ojo y rasgos de la figura original. | 14 páginas (2 por paquete) con ≥ 85 % del interior cubierto por celdas de tamaño coloreable; revisión visual sin «pegatinas» flotantes. |
| 3.3 | Anillos: figura en el anillo a ≥ 40 mm, con trazo negro del mismo peso que el mandala; si la figura no lo aguanta, no se ofrece el uso «anillos» para ella. | contraste: tinta de la figura ≥ 95 % de negro tras rasterizar; trazo ≥ 0,5 mm. |
| 3.4 | Las figuras con negro macizo quedan bloqueadas también en «Diseñar», no sólo en el libro. | prueba: `checkFigure` del eclipse devuelve bloqueo y la vista previa no lo dibuja. |

### Fase 4 · Página completa, tramas y libro

| # | Tarea | Cómo se verifica |
|---|---|---|
| 4.1 | Dificultad progresiva con techo por perfil: la cima es `base × 1,5`, con tope por público. | tabla 3, columna «complejidad máx»: niños ≤ 90, trazo grande ≤ 120 (hoy 200 en ambos). Prueba en `tests/book.test.mjs`. |
| 4.2 | Tramas: pasar de 5 a 15 (panal, chevrón, trenzado, hojas imbricadas, olas japonesas, estrellas de lacería, espigas, burbujas, ladrillo curvo, zentangle por parcelas). Trazo de la trama = trazo de detalle del mandala. | `PATTERN_THEMES.length ≥ 15`; grosor de la trama ≥ 0,55 mm; cada trama puntúa ≥ 80. |
| 4.3 | Mandala integrado en la trama: quitar el disco blanco con círculo liso; la silueta del mandala recorta la trama, o la trama nace de sus pétalos exteriores. | revisión visual de 10 páginas; ninguna con círculo liso de separación. |
| 4.4 | Página «trama» completa por parcelas: la hoja se divide en 5–9 regiones orgánicas, cada una con una trama distinta. | medida de 1.6: ≥ 4 formas de celda distintas por página; puntuación ≥ 80. |
| 4.5 | «Mandala que crece»: las etapas tempranas ocupan la hoja (mismo radio final, anillos por dibujar en línea guía fina o fondo de trama). | tinta de la etapa 1 dentro de un rectángulo que cubre ≥ 60 % del área útil. |
| 4.6 | Mandala misterioso: de 7 a 27 figuras y celda mínima acorde al nivel. | `MYSTERY_KEYS.length ≥ 27`; dos libros seguidos de una serie no repiten figura; celdas ≥ celda mínima del nivel. |
| 4.7 | Rótulos impresos en negro puro y ≥ 9 pt. | prueba: ningún `fill` distinto de `#000` en texto de páginas del libro. |
| 4.8 | Página suelta centrada: por defecto con fondo en hojas verticales, igual que el libro. | tinta de la página por defecto de «Diseñar» en 8,5×11 cubre ≥ 85 % del alto útil. |

### Fase 5 · App y producción (arrastre de planes anteriores)

| # | Tarea | Cómo se verifica |
|---|---|---|
| 5.1 | Prueba de punta a punta en el repositorio (`npm run e2e`, Playwright): crea un libro corto en es y en en, abre el PDF, mide tinta contra márgenes y lee el aviso final. | pasa en limpio; falla si se reintroduce un marco centrado sobre el margen. |
| 5.2 | Dependencias a `vendor/` con versión fija y en el precache; fuente serif libre incluida para lo impreso. | la app arranca sin red en el primer uso; el mismo libro en dos equipos da páginas de texto con el mismo hash. |
| 5.3 | Portada completa KDP (`js/core/cover.js` + generador): lomo, sangrado, zona del código de barras. | pruebas con valores de la calculadora de KDP para 3 formatos; el PDF pasa el previsualizador sin avisos. |
| 5.4 | Dibujo del libro en un Web Worker y PDF por tramos. | la interfaz responde durante 256 páginas; memoria máxima < 300 MB a 300 ppp. |
| 5.5 | Partir `js/app.js` en módulos por pestaña sin cambiar el comportamiento. | `npm test` igual; el mismo PDF para la misma semilla. |
| 5.6 | Instalar `bd` en el entorno de trabajo y cargar las tareas de este plan. | `bd list --status=open` muestra una tarea por fila de las fases 1–5. |

## 5. Tablero de control

Una sola orden resume el estado: `node scripts/bench-styles.mjs 10`.

| Indicador | Hoy | Meta | Tarea |
|---|---|---|---|
| Parecido entre estilos, clásico adulto | 0,96 | ≤ 0,80 | 2.1 |
| Pares de estilos gemelos (≥ 0,90) | 197 de 210 | < 21 de 210 | 2.1 |
| Mínimo por estilo, clásico adulto | 37 (azteca) | ≥ 60 | 2.3 |
| Flojas, «más vendidos + experto» | 76 de 80 | ≤ 8 de 80 | 1.1 |
| Flojas, perfiles de 0,6–0,7 mm | 7 y 8 de 80 | ≤ 2 de 80 | 1.2 |
| Trazos finos, clásico adulto | 35 % | < 10 % | 1.4 |
| Complejidad máxima, libro de niños | 200 | ≤ 90 | 4.1 |
| Página con negro macizo | 83 puntos | < 60 | 1.5 |
| Tramas disponibles | 5 | ≥ 15 | 4.2 |
| Figuras de misterio | 7 | ≥ 27 | 4.6 |

Regla para cerrar una tarea: el indicador alcanza su meta, `npm run check` pasa y alguien mira
doce páginas del cambio. La cifra sola no basta; el H3 de este informe es justo el caso de una
cifra que decía lo contrario de lo que se veía.

## 6. Cómo llevarlo a cabo

### 6.1 Orden y dependencias

Un PR por fila de esta tabla. Ninguno mezcla cambios de medida con cambios de dibujo: si la
puntuación y la página cambian a la vez, no se sabe cuál movió la cifra.

| PR | Tareas | Depende de | Tamaño | Por qué en este orden |
|---|---|---|---|---|
| A | 4.1 techo de dificultad por perfil | — | chico | defecto aislado de una línea; da un primer cierre rápido |
| B | 1.1 + 1.2 puntuación por público y perfiles coherentes | — | medio | desbloquea el nivel experto y dos perfiles |
| C | 1.3 + 1.4 huecos y trazos finos | B | medio | quita las restas constantes; la puntuación empieza a discriminar |
| D | 1.5 + 3.4 tinta de las figuras y bloqueo del negro macizo | B | medio | sin esta medida, la fase 3 no se puede demostrar |
| E | 1.6 monotonía | B | chico | sin esta medida, 4.4 no se puede demostrar |
| F | 2.4 radial y modular fuera o «experimental» | — | chico | evita vender siete estilos donde hay uno |
| G1–G5 | 2.1 un estilo por PR: islámico, celta, azteca, sashiko, yantra | C | grande | es el cambio que más se nota en el libro; cada estilo se revisa a ojo por separado |
| H | 2.2 + 2.3 prueba ciega y mínimos por estilo | G1–G5 | chico | cierra la fase 2 |
| I | 3.1 + 3.3 peso del contorno y anillos | D | medio | arreglo de proporciones, sin tocar el relleno |
| J | 3.2 relleno que sigue la forma | D, I | grande | la pieza más difícil de la fase 3 |
| K | 4.2 + 4.3 tramas nuevas e integradas | E | grande | |
| L | 4.4 página de trama por parcelas | E, K | medio | |
| M | 4.5–4.8 crece, misterio, rótulos, página suelta | — | medio | independientes entre sí; se pueden repartir |
| N | fase 5 (un PR por tarea) | — | variable | 5.1 (prueba de punta a punta) conviene antes de G1 |

Primera tanda recomendada: A, B y F, que no dependen de nada, y 5.1 en paralelo.

### 6.2 Rutina de cada tarea

1. **Antes de tocar nada:** `node scripts/bench-styles.mjs 10 > antes.txt` y, si la tarea afecta
   al libro, `node scripts/bench-book.mjs 3 50 KDP_8_5x11 adulto >> antes.txt`.
2. **Escribir primero la prueba que falla** con la meta de la tarea (columna «Cómo se verifica»).
3. **Hacer el cambio** hasta que esa prueba pase.
4. **Repetir los bancos** en `despues.txt` y comparar: el indicador de la tarea alcanza su meta y
   ningún otro del tablero (§ 5) empeora más de 1 punto.
5. **Mirar doce páginas** del cambio: `node scripts/bench-styles.mjs 10 --html /tmp/laminas` y
   abrir las láminas en el navegador. Si la cifra mejora y la página empeora, la tarea no está
   cerrada: se corrige la medida antes de seguir.
6. `npm run check`, y en el PR pegar el antes y el después del indicador y dos láminas.
7. **Actualizar la columna «Hoy» del § 5** en el mismo PR.

### 6.3 Reglas de parada

- Una tarea de dibujo que baja la media del libro «más vendidos» por debajo de 81 no entra.
- Una tarea de medida (fase 1) no puede cambiar ninguna página: `bench-variety.mjs` debe dar las
  mismas huellas antes y después.
- Si tras dos intentos un estilo de 2.1 no baja de 0,80 de parecido sin perder puntuación, se
  detiene y se revisa el vocabulario del estilo sobre papel antes de programar más.
- La curaduría no se usa para tapar un motivo malo: el mínimo por estilo (2.3) se mide **antes**
  de curar.
