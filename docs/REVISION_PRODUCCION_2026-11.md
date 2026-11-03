# Revisión para producción de libros (3 nov 2026)

**Pregunta.** ¿Está la app lista para producir libros KDP sin fallas?
**Audiencia.** Quien produce los libros y quien programe los cambios.
**Respuesta corta.** Ahora sí para el interior, tras corregir cinco defectos que llegaban al PDF o al
usuario. Quedan riesgos menores, listados abajo con su plan.

## 1. Cómo se revisó

- `npm test`: 93 pruebas al empezar, 100 al terminar (todas pasan).
- `scripts/bench-book.mjs 2 50 KDP_8_5x11 adulto`: media 82,6–83,1/100, 0 páginas flojas, 0 gemelas.
- Prueba real en Chromium (Playwright), pulsando «Crear libro» como lo haría una persona:
  - 74 páginas, 8,5×11, español (19 s);
  - 74 páginas, 6×9, inglés, con números de página (10 s);
  - 256 páginas, 8,5×11, inglés, con todas las páginas de venta (61 s; PDF de 91 MB).
- Cada PDF se abrió por dentro: número y tamaño de páginas, fuentes (ninguna: todo va rasterizado),
  imágenes en gris de 8 bits a 300 ppp, y **la tinta de cada página medida en píxeles** contra el
  medianil y la zona segura de KDP.

Límite: el navegador de la prueba es Chromium en Linux. No se probó Safari ni un Android real;
datos insuficientes para afirmar el comportamiento exacto de la fuente en esos equipos.

## 2. Defectos encontrados y corregidos

| # | Defecto | Efecto en el libro | Corrección | Guardia que evita que vuelva |
|---|---|---|---|---|
| 1 | El marco de página se dibujaba centrado sobre la línea del margen: medio trazo caía fuera. Sin marco, la línea que cierra la trama quedaba *fuera* del margen cuando el espaciado superaba la holgura. Igual en misterio y en las hojas del mural. | Tinta a 8,1–9,4 mm del corte en 20 de 28 combinaciones composición × marco, por debajo del medianil de 9,5 mm que exige KDP para ≤ 150 páginas. Riesgo de rechazo o aviso en la revisión de KDP. | El marco se mete medio trazo (`pageComposer.js`, `mandalaClassic.js`, `mysteryMandala.js`, `muralPage.js`); sin marco, la holgura nunca es menor que el espacio del recorte. | `tests/margins.test.mjs`: mide la tinta real (trazo + medio grosor + recortes) en 252 combinaciones y en libros completos con todas las páginas especiales, sin tolerancia. |
| 2 | Los rótulos dentro de las páginas especiales estaban fijos en español. | Un libro en inglés imprimía «Mandala que crece · etapa…», «Capítulo 1 · Jardín de mandalas», «Misterioso…», las notas científicas y la guía del mural en español. | Diccionario único `js/core/pageTexts.js` (es/en); los generadores reciben `lang` desde el idioma del libro. | `tests/pageTexts.test.mjs`: mismas claves en ambos idiomas, ningún texto en español en un libro en inglés. |
| 3 | Sin título, la hoja de título y los derechos decían «Mandalas para Colorear» en cualquier idioma. | Primera página en español en un libro en inglés. | Título de serie por idioma (`BOOK_TEXTS.*.defaultTitle`). | Paridad de claves de `BOOK_TEXTS` en la misma prueba. |
| 4 | La instrucción del mandala misterioso era una sola línea de ~86 caracteres. | En 6×9 medía ~146 mm sobre 132 mm útiles: se salía del margen. | Se corta al ancho útil y sube si ocupa dos líneas. | La misma prueba estima el ancho de cada rótulo con el ancho de letra que usa el corte de líneas (`CHAR_EM`, ahora exportado). |
| 5 | Al terminar el libro, el resumen de calidad se calculaba y no se mostraba; siempre salía «Listo para KDP». | Un libro con páginas flojas o gemelas se anunciaba como listo. | El aviso muestra el control de calidad; si quedan páginas pendientes es una advertencia, y «Listo para KDP» sólo aparece si el control corrió y no dejó pendientes. | Revisión en el código; ver plan § 3.3 para una prueba de interfaz. |
| 6 | `sw.js` guardaba `index.html` con una revisión escrita a mano; el commit `d243cfd` cambió `index.html` sin subirla. Los paquetes de figuras usaban «caché primero» 90 días. | Quien ya tenía la app instalada recibía el `index.html` viejo con el `app.js` nuevo (botones o ids que faltan), y nunca recibía un paquete corregido. | Revisión = hash del contenido (`npm run sw:rev`); paquetes con «obsoleto mientras revalida». | `tests/sw.test.mjs` falla si una revisión no coincide con el archivo. `npm run check` lo comprueba antes de las pruebas. |
| 7 | Los iconos «192» y «512» del manifiesto eran el mismo PNG de 640×640 (656 KB). | Aviso del navegador al instalar la app; descarga pesada. | Redimensionados a 192 y 512 px. | Cubierto por el hash del precache. |

Una lección común a 1, 2 y 6: **las pruebas existentes medían con tolerancia o no medían**. La prueba
de márgenes de las notas de naturaleza aceptaba 0,5 mm de exceso y medía puntos, no el grosor del
trazo; el idioma no tenía prueba; la revisión del service worker dependía de la memoria.

## 3. Plan para lo que necesita más atención

Ordenado por riesgo para un libro publicado. bd (beads) no está instalado en este entorno: al
retomarlo, crear una tarea por punto con `bd create` tras `bd search`.

### 3.1 Fuente de los textos impresos (riesgo medio)
Los textos se dibujan con `Georgia, 'Times New Roman', serif`. Si el equipo no tiene Georgia
(Android, Linux), la sustituta es más ancha (DejaVu Serif mide 0,50 em frente a 0,40 de Times) y el
aspecto cambia entre equipos.
- **Hacer:** incrustar una serif libre (p. ej. una con licencia OFL) en `assets/` y cargarla con
  `FontFace` antes de dibujar; esperar a `document.fonts.ready`.
- **Comprobar:** el mismo libro creado en dos equipos da páginas de texto idénticas (comparar hashes
  de las imágenes del PDF).

### 3.2 Niveles duplicados entre la app y el banco de pruebas (riesgo medio)
`scripts/bench-book.mjs` y `tests/margins.test.mjs` copian a mano los niveles de `COLORING_PRESETS`
(`js/app.js`). Hoy coinciden; si alguien cambia un trazo en la app, el banco medirá otro libro.
- **Hacer:** mover `COLORING_PRESETS` a `js/core/levels.js` (sin DOM) e importarlo desde app, banco y
  pruebas.
- **Comprobar:** `grep -rn "strokeWidthMm: 0.8, spacing" scripts tests` no devuelve copias.

### 3.3 Prueba de interfaz de punta a punta en el repositorio (riesgo medio)
La prueba con navegador de esta revisión vive fuera del repositorio. Los defectos 3 y 5 sólo se ven
pulsando el botón.
- **Hacer:** `scripts/e2e-book.cjs` con Playwright: crea un libro corto en es y en en, guarda el PDF,
  mide la tinta por página contra el medianil, lee el aviso final. Servir jsPDF y Shoelace desde
  `node_modules` para no depender del CDN en la prueba.
- **Comprobar:** `npm run e2e` pasa en limpio y falla si se reintroduce un marco centrado.

### 3.4 Dependencia de CDN en el primer uso (riesgo bajo)
Shoelace (jsDelivr) y jsPDF (cdnjs) se cargan de CDN. Sin red en el primer uso, la app no arranca;
después quedan en caché 30 días.
- **Hacer:** copiar ambos a `vendor/` con versión fija y añadirlos al precache.

### 3.5 Generación en el hilo principal (riesgo bajo, ya conocido)
256 páginas tardan ~1 minuto en Chromium de escritorio; la pestaña responde (cede entre páginas) y se
puede cancelar. En móvil con 600 ppp puede faltar memoria: el PDF entero vive en memoria antes de
guardarse (91 MB a 300 ppp). Ver § 2.4 de `REVISION_Y_PLAN_2026-10.md` (Web Worker).

## 4. Cómo evitar que se repitan

1. **Antes de cada commit:** `npm run check` (revisiones del service worker + todas las pruebas).
2. **Cualquier texto que se imprima** va en `js/core/pageTexts.js` (dentro del SVG) o en
   `BOOK_TEXTS` (páginas de venta), nunca escrito en el generador. Las pruebas de paridad fallan si
   falta un idioma.
3. **Cualquier línea pegada al margen** se dibuja con su borde exterior en el margen (`margen + trazo/2`),
   no su centro. La prueba de márgenes mide sin tolerancia.
4. **Una prueba que mide calidad no lleva tolerancia a favor del defecto.** Si hace falta holgura,
   va en el código que dibuja, no en la aserción.
5. **Antes de publicar un libro nuevo:** abrir el PDF y mirar la primera página de cada tipo (título,
   portadilla, misterio, naturaleza, mural); el aviso final debe decir «Listo para KDP».
