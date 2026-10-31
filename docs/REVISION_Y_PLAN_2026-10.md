# Revisión completa de Mandala Studio y plan de trabajo (31 oct 2026)

**Alcance.** Interfaz para producir libros a diario, motores de dibujo, paquetes de imágenes prediseñadas y
lo que separa un interior bien hecho de un libro que se vende. **Audiencia:** quien produce los libros y
quien programe las mejoras. **Objetivo:** saber qué falta, en qué orden hacerlo y cómo comprobar que quedó.

**Cómo se revisó.** Lectura del código (`js/app.js`, `js/core/*`, `js/generators/*`, `scripts/*`), de la
documentación existente, `npm test` (75/75 pruebas pasan), un libro de prueba con
`node scripts/bench-book.mjs 1 50 KDP_8_5x11 adulto` (62 páginas, **media 83,7 · mínima 72 · 0 flojas ·
0 gemelas**) y seis páginas renderizadas para mirarlas. Más una búsqueda de tendencias de mercado y de las
reglas de portada de KDP (fuentes al final).

**Límite.** No hay datos de ventas propios ni pruebas con compradores. Donde el reporte habla de «vender
más», se apoya en convenciones del mercado y en las reglas de Amazon, no en mediciones. Datos insuficientes
para estimar cuánto subirían las ventas con cada cambio.

---

## 1. Diagnóstico en una página

El interior ya es sólido. El motor clásico dibuja páginas coloreables a la primera, la curaduría
automática elimina páginas flojas y gemelas, y el PDF cumple las reglas técnicas de KDP. Ese trabajo
está hecho y medido.

Lo que falta está alrededor del interior.

| Área | Estado | Hueco principal |
|---|---|---|
| Interior (motor clásico) | ✅ media ≈ 84/100, sin páginas flojas | coherencia estética del libro: fondos de «confeti» y mezcla de estilos |
| Cumplimiento KDP del interior | ✅ márgenes, páginas pares, PDF aplanado, sin fuentes | — |
| **Portada** | ❌ no existe | KDP exige un PDF de portada completa (contraportada + lomo + frente) |
| **Idioma de lo impreso** | ❌ sólo español | Amazon.com, el mayor mercado, compra en inglés |
| **Trabajo diario** | ⚠️ todo se pierde al recargar | sin proyectos, sin biblioteca de imágenes, sin cola de libros |
| Motores radial y de capas | ⚠️ 57 y 71 frente a 84 del clásico | o se arreglan o se quitan del modo libro |
| Imágenes prediseñadas | ⚠️ 32 dinosaurios + 41 zentangle + 150 adornos | faltan los temas que más se buscan (animales, mar, temporadas, boho) |
| Paquete comercial | ❌ | ficha de producto, palabras clave, imágenes para la ficha, páginas finales |

Una imagen terrestre ayuda. La app hoy fabrica excelentes ladrillos, pero entrega la casa sin puerta ni
letrero. El comprador de Amazon ve primero la portada, después la ficha, después las primeras páginas del
«Look Inside». El interior sólo se juzga en la reseña, semanas después.

---

## 2. Huecos de la interfaz para el uso diario

Ordenados por cuánto tiempo hacen perder en una jornada de producción.

### 2.1 Nada persiste (crítico)

- **Los ajustes del libro no se guardan.** `urlState.js` sólo guarda los parámetros de «Diseñar». Título,
  subtítulo, autor, número de mandalas, páginas extra, reverso, DPI y perfil se pierden al recargar.
- **Las imágenes no se guardan.** `userFigures` vive en memoria (`js/app.js:33`). Cada sesión hay que
  volver a subir los paquetes de `assets/` (5 MB el de adornos infantiles) y volver a elegir el uso de cada
  imagen.
- **Los cambios de la revisión se pierden** al cambiar la semilla, el perfil o la dificultad
  (`bookOverrides = new Map()` en siete sitios). Es el trabajo manual más valioso de la sesión y se borra
  sin aviso.
- **Favoritos dependen de un CDN** (`idb-keyval` desde jsDelivr): sin red, no hay favoritos.

**Qué hace falta:** un concepto de **Proyecto de libro** (ajustes + semilla + cambios de revisión +
imágenes elegidas + metadatos de venta), con autoguardado en IndexedDB, lista de proyectos recientes,
«duplicar proyecto» (para la versión 6×9 o la edición en inglés) y exportar/importar el proyecto como
`.json`. Antes de borrar cambios de revisión, un aviso: «Tienes 7 páginas cambiadas a mano. ¿Descartarlas?».

### 2.2 Imágenes prediseñadas sin biblioteca

Los paquetes de `assets/` existen, pero la app no los conoce: hay que buscarlos en disco y subirlos.
Falta una pestaña **Biblioteca** con tarjetas por paquete (miniatura, número de figuras, tema, uso por
defecto), carga con un clic (`fetch` perezoso) y filtro por tema. Un `assets/catalogo.json` describe los
paquetes; añadir uno nuevo debería ser soltar el `.json` y añadir una línea al catálogo.

### 2.3 Avisos con `alert()` y `confirm()`

Hay 12 en `app.js`. Bloquean la página, no se pueden copiar y en móvil tapan todo. El mensaje final del
libro («✅ Libro creado… control de calidad…») merece un diálogo de resultado con: páginas, margen,
media de calidad, botones para descargar de nuevo el PDF y el CSV, y la lista de lo que falta para
publicar (portada, ficha).

### 2.4 Generación que congela la página y no se puede cancelar

El libro se dibuja en el hilo principal (`downloadBookPdf`, `export.js:433`). Con 100 páginas a 600 DPI
la pestaña se congela minutos y no hay botón «Cancelar». Si falla en la página 90, se pierde todo.
Hace falta mover el dibujo a un Web Worker (con `OffscreenCanvas`), un botón de cancelar y, como
mínimo, reintentar sólo la página que falló.

### 2.5 No hay vista del libro como objeto

La revisión muestra una rejilla de mandalas, pero no el libro impreso: hoja de título, derechos,
reversos en blanco, portadillas, números de página, pliegos enfrentados. Falta un **hojeador**
(dos páginas enfrentadas, flechas, mismo orden que el PDF) que deje ver lo que verá el comprador en el
«Look Inside» antes de gastar minutos en el PDF.

### 2.6 La revisión de páginas se queda corta para un trabajo fino

| Falta | Por qué importa |
|---|---|
| Fijar una página («me gusta, no la toques») | la curaduría automática puede rehacer una página que gustaba |
| Reordenar arrastrando | la primera página del capítulo y las tres primeras del libro venden el «Look Inside» |
| Vista grande con teclado (← →, B = borrar y crear otro) | revisar 60 miniaturas de 150 px no permite ver detalles finos |
| Filtros: sólo flojas, sólo gemelas, sólo cambiadas | con 100 páginas, encontrar lo pendiente cuesta |
| Elegir la portadilla y la página «escaparate» | ver § 4.3 |

### 2.7 Producción en serie

Un catálogo vendible se construye en series (mismo diseño de portada, volumen 1, 2, 3…; misma obra en
8,5×11 y 6×9; edición en inglés y español). Hoy cada libro se arma a mano desde cero. Falta una **cola**:
lista de libros pendientes (proyecto + formato + idioma), «crear todos» y descargas en un `.zip`.

### 2.8 Detalles menores de interfaz

- Dos opciones con nombres casi iguales confunden: el nivel «Más vendido KDP» (Diseñar) y el perfil
  «Los más vendidos para este formato» (Libro KDP). Renombrar el nivel a «Trazo grueso sin texturas».
- El escenario crece al pasar el ratón (`#stage:hover { transform: scale(1.02) }`): distrae al revisar.
- Las imágenes sólo funcionan con el motor clásico; la app lo dice en texto. Mejor desactivar los otros
  motores mientras haya imágenes con uso elegido.
- Máximo 120 mandalas (`bookCount`): suficiente para casi todo, pero un libro de 150 diseños existe en el
  mercado. El límite real lo pone KDP (828 páginas).
- En móvil (desde donde trabaja quien usa la app) la barra lateral ocupa 40 % de la altura y el PDF de
  600 DPI falla en Safari. Un modo «revisar en el móvil, crear el PDF en el ordenador» con el proyecto
  sincronizado por archivo resolvería la mayor parte.

---

## 3. Huecos en los motores

### 3.1 Motor clásico: bien medido, estéticamente desigual

La puntuación mide lo que promete (celdas, huecos, trazos), y el libro de prueba no tiene páginas flojas.
Al mirar las seis páginas renderizadas aparecen problemas que la métrica no ve:

1. **Fondos de confeti.** En «fondo decorado» y en el centrado vertical, gotas, hojas, corazones y puntos
   flotan sueltos alrededor del disco. Los libros líderes para adultos llenan el fondo con tramas
   continuas (teselados, zentangle, ondas) que se leen como parte del diseño. El confeti se lee infantil.
2. **Mezcla de registros.** Un mandala de geometría sagrada junto a corazones y tréboles de fondo en la
   misma página rompe el tono. El plan elige el fondo «acorde al estilo», pero el catálogo de motivos es
   pequeño y los corazones aparecen en mandalas florales de libros para adultos serios.
3. **Grosor de línea uniforme.** Todo el dibujo usa el mismo trazo. Los libros mejor valorados usan una
   jerarquía: contorno exterior y anillos principales más gruesos, detalle interior más fino. Da
   profundidad y guía el ojo. `strokeScaleFor` ya cambia el trazo por página; falta cambiarlo por nivel
   dentro de la página.
4. **«Esquinas» y «constelación» se ven abarrotadas.** Los cuartos de mandala de las esquinas compiten con
   el disco central; las mini mandalas rellenas de corazones parecen pegatinas.
5. **La métrica no mide equilibrio ni densidad de tinta.** Falta medir: proporción de tinta por zona
   (para evitar mitades vacías), uniformidad del tamaño de celda (una página con celdas gigantes y
   diminutas a la vez cansa) y la coherencia de motivos.

### 3.2 Motores radial y de capas

Puntuación media 57 (radial) y 71 (capas) frente a 84 del clásico (`docs/proceso-calidad.md`). La app ya
avisa. Dos caminos: llevarlos a ≥ 80 o retirarlos del modo libro y dejarlos sólo para exploración.
Recomendación: retirarlos del libro ahora y decidir después si merece la pena arreglarlos (ver § 7).

### 3.3 Faltan motores de página que el mercado pide

| Motor que falta | Qué haría | Por qué |
|---|---|---|
| **Libro temático completo** | todas las páginas giran en torno a un tema (animales mandala, océano, Navidad): figura en el centro o en corona, fondo del tema, portadillas del tema | los sub-nichos venden; los libros genéricos de «mandalas para adultos» compiten con más de 100 000 títulos |
| **Página de frase** (lettering) | una frase grande con letras de contorno para colorear, rodeada de motivos | «mandalas + afirmaciones» es un nicho estable. La app ya tiene 579 frases (`dataset_taoista.js`) pero sólo las usa en la exportación suelta «Inspiracional», no en el modo libro |
| **Trama de página completa** | patrones sin centro (teselados, escamas, ondas, zentangle) a hoja entera | «100 Amazing Patterns», uno de los líderes, es exactamente eso |
| **Animal mandala** (figura grande cuyo interior es mandala) | ya existe como «figura rellena», pero sólo con imágenes del usuario y sin paquete de animales | el formato más vendido después del mandala puro |

### 3.4 Otros huecos técnicos

- **Texto impreso con la fuente del sistema** (`Georgia` en `drawTextBlock`, `export.js:406`): el mismo
  proyecto da títulos distintos en Windows, Mac y Linux. Hay que rasterizar con fuentes incluidas en
  `assets/` (y con licencia comercial).
- **Todo lo impreso está en español**: «Prueba tus colores», derechos, portadillas («Jardín de mandalas»),
  notas científicas, «Soluciones», rótulos del mural. Para Amazon.com hace falta inglés como mínimo.
- **Inconsistencia de pesos de estilo.** `bestSellerProfile` usa islámico 2 · yantra 2, mientras que los
  capítulos (`BESTSELLER_STYLE_W` en `app.js`) usan 0,3 y 0,2, y la documentación (`libro-kdp.md`) dice
  0,3 y 0,2. El libro cambia de reparto según se activen o no los capítulos. Hay que unificar en un solo
  lugar.
- **Mandalas misteriosos:** sólo 7 figuras escondidas. Con 7 páginas por libro, el segundo libro repite.
- **Service worker:** `index.html` está precacheado con revisión fija (`1.0.7`) y el JS va con
  «StaleWhileRevalidate»: tras una actualización, la primera carga usa la versión vieja. Además depende
  de Workbox, Shoelace y jsPDF desde CDN; sin red en el primer arranque, no hay app.
- **`app.js` monolítico:** 2 499 líneas, `bindUI` ocupa unas 1 500. Cada mejora de interfaz cuesta más de
  lo necesario. Separar en módulos (diseñar, libro, revisión, imágenes, exportación) antes de las fases
  grandes.
- **PDF rasterizado:** cumple KDP y evita problemas de transparencias. Un PDF vectorial daría líneas
  perfectas a cualquier escala y archivos más ligeros, pero exige aplanar transparencias y no hay
  urgencia. Prioridad baja.

---

## 4. Qué hace falta para que el libro se venda

La calidad del interior es condición necesaria, no suficiente. En Amazon el embudo es:
**búsqueda → miniatura de portada → título y precio → ficha (imágenes, descripción) → «Look Inside» →
compra → reseña**. La app sólo atiende el penúltimo paso.

### 4.1 Portada (el mayor hueco)

KDP exige un PDF de portada completa. Reglas (ayuda de KDP; comprobar siempre su calculadora oficial):

- **Lomo** = páginas × 0,002252 in (papel blanco, B/N) o × 0,0025 in (crema).
- **Ancho** = sangrado + contraportada + lomo + portada + sangrado; **alto** = sangrado + alto + sangrado.
  Sangrado de 0,125 in por lado.
- Texto en el lomo sólo con **más de 79 páginas**; dejar holgura a ambos lados del texto del lomo.
- Zona del código de barras en la contraportada (KDP la imprime abajo a la derecha): dejarla libre.

**Qué construir:** `js/core/cover.js` (cálculo puro, con pruebas) + `js/generators/coverPage.js`
(dibujo). Plantillas de portada a color: un mandala del propio libro coloreado automáticamente (relleno
por regiones con paletas probadas), título grande legible en miniatura de 160 px, subtítulo con la
promesa («50 diseños anti-estrés, una cara, trazo grueso») y contraportada con 4 a 6 páginas interiores
en mosaico. Exportar PDF de portada (RGB o CMYK aceptados por KDP, ≥ 300 DPI) y un PNG plano de la portada
para la ficha.

**Alternativa con plugin:** la sesión tiene conectado **Canva** (generar diseño, plantillas de marca,
exportar). Puede producir la portada a partir del PNG coloreado del mandala y del tamaño calculado por
`cover.js`. Ver tabla comparativa en § 8.

### 4.2 Idioma y mercado

- Selector de **idioma de impresión** (es, en; después pt, de, fr) para todo texto del PDF: título por
  defecto, derechos, prueba de color, portadillas, notas, soluciones, mural.
- La app puede seguir en español; lo que importa es lo impreso.

### 4.3 Páginas que venden dentro del libro

Las primeras páginas forman el «Look Inside». Hoy son: título en Georgia, derechos y un mandala al azar.

| Página | Qué hace | Estado |
|---|---|---|
| Título con diseño (mandala de fondo, tipografía cuidada) | primera impresión en «Look Inside» | ❌ texto plano |
| «Este libro pertenece a…» | convención de regalo; el regalo es una gran parte de la categoría | ❌ |
| Página de bienvenida / cómo usar el libro (lápices o marcadores, poner una hoja detrás) | reduce reseñas negativas por traspaso | ❌ |
| Prueba de colores | ✅ existe | ✅ |
| **Primer mandala = el mejor del libro** («escaparate») | lo que se ve en la vista previa | ❌ el orden es aleatorio; la curaduría podría elegir el de mejor puntuación y variedad |
| Página final de petición de reseña | las reseñas sostienen el ranking | ❌ |
| Página «Otros libros de la serie» (con miniaturas de portadas) | venta cruzada | ❌ |
| Páginas de regalo: bonus en blanco con marco, o mandalas en miniatura para tarjetas | valor percibido | ❌ |

### 4.4 Ficha de producto

Generador de **paquete de publicación** (un `.zip` o carpeta):

- Título, subtítulo y 7 palabras clave a partir del tema, formato, nivel y número de diseños, con reglas
  de Amazon (sin marcas ajenas, sin «best seller», sin nombres de autores conocidos).
- Descripción con estructura (promesa, qué incluye, para quién, detalles de impresión), en el idioma del
  libro.
- **Imágenes para la ficha y A+:** 5–7 maquetas (portada en 3D, pliego abierto con una página coloreada,
  mosaico de 9 páginas, comparación de niveles, detalle del grosor de línea). Se generan con las mismas
  páginas del libro.
- Recordatorios: elegir «No bleed», papel blanco, mismo tamaño; si usa dominio público, edición
  diferenciada y fuera de KDP Select (ya documentado en `libro-kdp.md` § 4).

Un detalle de cautela: el texto generado es un borrador. Las reglas de metadatos de Amazon cambian;
quien publica debe revisarlo.

### 4.5 Coherencia de producto

Los líderes de la categoría no mezclan registros: un libro es «mandalas florales grandes» o «geometría
sagrada intrincada», no las dos cosas con corazones en medio. Propuesta: **perfiles de producto** que
fijan estilo, fondo, trazo y páginas extra para un público concreto:

| Perfil | Público | Rasgos |
|---|---|---|
| Large Print Easy (seniors, relajación) | 60+ y principiantes | trazo 1,1 mm, celdas ≥ 7 mm², centrado, sin fondo, 30–50 diseños |
| Mindful Patterns | adulto general | floral + geométrico, tramas continuas de fondo, jerarquía de trazo, 50 diseños |
| Intricate Sacred Geometry | adulto experto | geométrico, yantra, islámico; detalle alto; sin motivos infantiles |
| Animal Mandalas | adulto y regalo | figura animal rellena de mandala en cada página |
| Kids Mandalas | 6–10 | trazo grueso, figuras amables, fondo de juego |
| Seasonal (Navidad, Halloween, primavera) | regalo de temporada | figuras del tema, portadillas del tema |

### 4.6 Lo que la app no puede resolver

Precio, anuncios de Amazon, elección de nicho con datos de búsqueda y reseñas. La app puede preparar el
material, pero la validación de nicho exige herramientas externas (datos de búsqueda de Amazon). La
evidencia pública disponible sobre nichos es débil: muchas guías repiten cifras sin metodología. La única
tendencia que coincide en varias fuentes es que los sub-nichos específicos (letra grande para mayores,
razas de mascotas, temporadas, diseño audaz y fácil) superan a los libros genéricos.

---

## 5. Imágenes prediseñadas: qué falta y cómo deben llegar

### 5.1 Inventario actual

| Paquete | Figuras | Uso | Tema |
|---|---|---|---|
| `figuras-dinosaurios.json` | 26 animales + 6 extras | anillos / extra | prehistórico |
| `figuras-zentangle.json` | 41 | anillos | dinosaurios, críptidos, animales (calidad desigual, hechas por código) |
| `adornos-infantiles.json` | 78 | extra (decorado de fondo) | infantil |
| `adornos-naturaleza.json` | 72 | extra | naturaleza |

Sí hacen falta más. Lo actual cubre dinosaurios y decorado de fondo; no cubre los temas que más se
buscan para adultos ni da figuras grandes para «figura rellena de mandalas».

### 5.2 Paquetes que faltan (por prioridad)

| Prioridad | Paquete | Contenido mínimo | Uso principal |
|---|---|---|---|
| 1 | **Animales mandala** | 30: búho, elefante, león, lobo, zorro, gato, perro, caballo, tortuga, colibrí, mariposa, ciervo, oso, tigre, delfín, flamenco, pavo real, conejo, koala, erizo, panda, jirafa, ballena, pulpo, caracol, rana, libélula, abeja, cisne, camaleón | figura rellena (silueta grande) |
| 1 | **Tramas de fondo** | 20 teselados y patrones sin costura: escamas, ondas, flor de la vida, zentangle básicos, chevron, panal | fondo continuo (sustituye al confeti) |
| 2 | **Océano** | 25: caballito de mar, medusa, concha, estrella, coral, pez globo, raya, ancla | figura y extra |
| 2 | **Temporadas** | Navidad 25, Halloween 25, Pascua/primavera 20, San Valentín 15 | figura, corona y extra |
| 2 | **Boho / celeste** | 25: fases lunares, sol con rostro, cristales, mano de Hamsa, ojo, plumas, atrapasueños | figura y extra |
| 3 | **Razas de perro y gato** | 20 + 15, una por figura, contorno realista y audaz | figura rellena (serie por raza) |
| 3 | **Marcos y cartelas** | 15 marcos para frases y portadillas | página de frase, portadillas |
| 3 | **Figuras de misterio** | 20 siluetas simples más (para pasar de 7 a 27) | mandala misterioso |

### 5.3 Características para que se importen bien

Tres vías de entrada, todas ya soportadas por el código. Lo que sigue es el contrato de calidad.

**Comunes a todas las vías**

| Requisito | Valor | Motivo |
|---|---|---|
| Color | línea negra pura (#000) sobre blanco puro (#FFF), sin grises, sombras ni degradados | el umbral de tinta separa línea de fondo; los grises crean manchas |
| Contornos | **cerrados**, sin huecos en la línea | cada zona cerrada es una celda; un hueco funde la celda con el fondo |
| Texto, firmas, marcas de agua | ninguno | la app los quitaría a ciegas o bloquearía la figura (> 10 trazos sueltos) |
| Rellenos negros | ninguno (siluetas negras se vacían y pierden detalle) | la app vacía manchas negras |
| Una figura por archivo, centrada, mirando a la derecha | — | el espejo alterno de la corona lo asume |
| Derechos | obra propia, CC0 o dominio público verificado; si sale de una IA, términos de uso comercial revisados por quien la trae | el libro se vende; `rightsConfirmed` se marca sólo con certeza |
| Nombre de archivo | neutro: `tema-NN` (`oceano-01`) | la app no muestra nombres y evita marcas en el paquete |

**Según el uso**

| Uso | Tamaño de impresión | Lado largo mínimo del archivo | Grosor de línea | Zona coloreable mínima |
|---|---|---|---|---|
| Figura rellena de mandalas | 180–230 mm | **3000 px** (≈ 300 DPI a 25 cm) | ≥ 0,8 mm impresa ≈ 10 px a 3000 px | interior rellenable ≥ 30 % de la caja (`figureChecks.js`) |
| Anillos / corona | ≈ 45 mm de alto | **1000 px** | ≥ 0,5 mm ≈ 11 px a 1000 px | círculo inscrito ≥ 4 mm ⇒ ≥ 90 px en 1000 px |
| Medallón central | 30–60 mm | 1000 px | ≥ 0,5 mm | proporción alto/ancho 0,6–1,4 |
| Ilustración extra (decorado) | 14–25 mm | **600 px** | la app engorda el sello al 2,5 %; dibujar sin detalle menor a 1/20 del alto | 1–5 zonas cerradas, sin detalles internos finos |
| Trama de fondo (nueva) | tesela repetible | 1000 × 1000 px, bordes que casan al repetir | ≥ 0,5 mm | celda ≥ 6 mm² impresa |

**Vía 1 · SVG** (`scripts/exportZenFigures.mjs --svg CARPETA --svgmode silhouette`) — la mejor calidad.
`viewBox="0 0 1000 1000"`, sin `transform` (aplicar transformaciones), sólo `path`, `circle`, `ellipse`,
`rect`, `polygon`, `polyline`. Formas **con relleno = silueta** (se unen); formas con `fill="none"` =
líneas de detalle interior (se recortan a la silueta). Detalle: `docs/GUIA_PARA_AYUDA.md`.

**Vía 2 · Lámina** (`scripts/importSheet.mjs lamina.png --theme T --use U --out paquete.json`) — muchas
figuras en una imagen. Requisitos extra: separación entre figuras ≥ 3 % del ancho de la lámina (≈ 60 px
en 2048 px) para que no se peguen; ninguna figura tocando el borde; orden de lectura por filas si se
pasan nombres con `--names`; resolución tal que cada figura cumpla el lado mínimo de su uso. Con dibujos
pequeños y juntos, `--grow 5`. Después, `node scripts/checkFigures.mjs paquete.json` (semáforo en mm
reales).

**Vía 3 · PNG/JPG suelto** en la app (Imágenes → Subir) o `preprocesar.html` — tipo «Dibujo / grabado».
La lista de verificación (`js/core/figureChecks.js`) bloquea lo que no sirve.

**Metadatos del paquete** (`figurePack.js`, formato `mandala-figuras` v1): `name`, `use`
(`figura` | `anillos` | `medallon` | `extra`), `theme` (tema que activa el relleno temático: hoy
`prehistorico`, `infantil`, `naturaleza`; los nuevos temas necesitan su entrada en `SCATTER_THEMES` de
`pageComposer.js`), `rightsConfirmed`, `source` (opcional). Propuesta para el catálogo de la Biblioteca:
añadir `audience` (`adulto` | `niños` | `todos`), `style` (`realista` | `kawaii` | `ornamental`) y
`version` del paquete.

---

## 6. Plan de trabajo detallado

Cada tarea tiene criterio de aceptación comprobable. Estimaciones en días de trabajo de una persona;
son orientativas.

### Fase 0 · Arreglos rápidos (1–2 días)

| # | Tarea | Archivos | Aceptación |
|---|---|---|---|
| 0.1 | Unificar pesos de estilo en un solo lugar (`bookPlan.js`) y corregir `libro-kdp.md` | `bookPlan.js`, `app.js`, docs | mismo reparto con y sin capítulos; prueba que lo verifica |
| 0.2 | Quitar motores radial y capas del modo libro (siguen en Diseñar) | `app.js`, `index.html` | el selector de libro sólo ofrece Clásico |
| 0.3 | Aviso antes de descartar cambios de revisión | `app.js` | con ≥ 1 cambio, pide confirmación |
| 0.4 | Quitar el zoom al pasar el ratón; renombrar el nivel «Más vendido KDP» | `index.html` | — |
| 0.5 | Service worker: revisión de `index.html` y JS ligada a la versión; Shoelace, jsPDF e idb-keyval copiados a `vendor/` | `sw.js`, `index.html` | la app arranca sin red tras la primera visita; una versión nueva se ve en la primera recarga |

### Fase 1 · Base de producción diaria (6–9 días)

| # | Tarea | Aceptación |
|---|---|---|
| 1.1 | Partir `app.js` en módulos (`ui/design.js`, `ui/book.js`, `ui/review.js`, `ui/images.js`, `ui/export.js`) sin cambiar comportamiento | `npm test` igual; mismo PDF bit a bit para la misma semilla |
| 1.2 | **Proyectos de libro** en IndexedDB: autoguardado, recientes, duplicar, exportar/importar `.json` (incluye cambios de revisión e imágenes) | recargar la página devuelve el mismo libro con sus cambios |
| 1.3 | **Biblioteca** de paquetes (`assets/catalogo.json`, carga con un clic, filtro por tema/uso) | los 4 paquetes actuales se cargan sin buscar archivos |
| 1.4 | Sustituir `alert/confirm` por diálogos y avisos breves; diálogo de resultado del libro | 0 `alert(` en el código |
| 1.5 | Dibujo del libro en Web Worker, botón cancelar, reintento por página | la interfaz responde durante la creación; cancelar deja la app usable |
| 1.6 | **Idioma de impresión** (es/en) con tabla de textos | un libro en inglés no contiene texto en español (prueba que busca cadenas) |
| 1.7 | Fuentes incluidas para lo impreso (una serif y una display con licencia OFL) | el título se ve igual en tres sistemas |

### Fase 2 · Paquete comercial (8–12 días)

| # | Tarea | Aceptación |
|---|---|---|
| 2.1 | `js/core/cover.js`: lomo, ancho, alto, zonas seguras, regla de 79 páginas | pruebas con los valores de la calculadora oficial de KDP para 3 formatos y 3 grosores |
| 2.2 | Coloreado automático de un mandala (relleno por regiones con paletas probadas) | PNG a color sin huecos blancos sueltos |
| 2.3 | Generador de portada: 4 plantillas, frente + lomo + contraportada con mosaico de páginas; PDF + PNG frontal | el PDF pasa el Print Previewer de KDP sin avisos |
| 2.4 | Páginas de venta: título con diseño, «Este libro pertenece a», bienvenida, petición de reseña, otros libros | activables por separado; respetan páginas pares y reverso |
| 2.5 | Página escaparate: la curaduría elige el mejor mandala para la posición 1 y la primera de cada capítulo | la página 1 tiene la puntuación más alta del libro entre las no gemelas |
| 2.6 | Hojeador de libro (pliegos enfrentados en orden de PDF) | coincide página a página con el PDF |
| 2.7 | Paquete de publicación: borrador de título, subtítulo, 7 palabras clave, descripción, 6 maquetas para la ficha | carpeta descargable; texto en el idioma del libro |

### Fase 3 · Motores (10–15 días)

| # | Tarea | Aceptación |
|---|---|---|
| 3.1 | Jerarquía de trazo dentro de la página (exterior y anillos principales +30 %, detalle −15 %, nunca < 0,5 mm) | media del banco ≥ la actual; revisión visual de 12 páginas |
| 3.2 | Fondos de trama continua (teselados) en lugar de confeti para perfiles de adulto | 0 motivos sueltos en el perfil «Mindful Patterns» |
| 3.3 | Perfiles de producto (§ 4.5) que fijan estilo, fondo, trazo y extras | cada perfil produce un libro coherente con su tabla |
| 3.4 | Modo **libro temático**: un tema dirige figuras, fondos, portadillas y portada | libro «Océano» de 40 páginas sin motivos de otro tema |
| 3.5 | **Página de frase** en el modo libro (letras de contorno coloreables, 579 frases + frases propias) | celdas de las letras ≥ celda mínima del nivel |
| 3.6 | Motor de **trama de página completa** | puntuación ≥ 80 en el banco |
| 3.7 | Métricas nuevas: equilibrio de tinta por cuadrante, dispersión del tamaño de celda | aparecen en la revisión; umbral calibrado con 30 páginas miradas a ojo |
| 3.8 | Mandalas misteriosos: 20 figuras más | dos libros seguidos no repiten figura |

### Fase 4 · Imágenes prediseñadas (continuo, en paralelo)

| # | Tarea | Aceptación |
|---|---|---|
| 4.1 | Paquete «Animales mandala» (30) | semáforo verde en `checkFigures`; 30 páginas de figura rellena con puntuación ≥ 75 |
| 4.2 | Paquete «Tramas de fondo» (20) | teselas sin costura visible a 3×3 |
| 4.3 | Océano, temporadas, boho (≈ 135) | ídem; temas nuevos en `SCATTER_THEMES` |
| 4.4 | Razas, marcos, figuras de misterio | ídem |

### Fase 5 · Producción en serie y robustez (5–8 días)

| # | Tarea | Aceptación |
|---|---|---|
| 5.1 | Cola de libros y descarga en `.zip` (interior + portada + paquete de publicación) | 3 libros en una tanda sin intervención |
| 5.2 | Series: plantilla de portada compartida, numeración de volumen, página «otros libros» automática | volumen 2 reutiliza la marca del 1 |
| 5.3 | Pruebas de extremo a extremo con Playwright (crear libro de 24 páginas y validar el PDF) | en `npm test` o en un comando aparte |
| 5.4 | (Opcional) PDF vectorial | PDF ≥ 40 % más ligero, mismo aspecto |

### Orden recomendado

**0 → 1.2, 1.3, 1.6 → 2.1–2.3 → 2.4–2.5 → 3.1–3.3 → 4.1–4.2 → resto.** La portada y el idioma desbloquean
la publicación en Amazon.com; los proyectos y la biblioteca recuperan las horas que hoy se pierden cada
día; los motores mejoran un producto que ya es publicable.

---

## 7. Riesgos y decisiones abiertas

- **Derechos de imágenes generadas con IA.** El código no puede verificar los términos de la herramienta
  usada; la responsabilidad queda en quien importa. Mantener `rightsConfirmed` en falso por defecto.
- **Contenido «de bajo esfuerzo».** Amazon ha endurecido su postura frente a libros repetitivos; la
  curaduría de gemelas y la coherencia de perfil ayudan, la revisión humana sigue siendo necesaria.
- **Reglas de KDP cambiantes.** Los valores de portada (§ 4.1) deben verificarse contra la calculadora
  oficial antes de cada publicación.
- **Arreglar o retirar los motores radial y de capas:** decisión pendiente. Recomendación: retirarlos del
  modo libro y reconsiderar cuando las fases 1–3 estén hechas.

---

## 8. Comparación de las dos decisiones con más peso

### 8.1 Estrategia de producto

| Criterio | Opción A: profundizar en mandalas puros | Opción B: libros temáticos de sub-nicho |
|---|---|---|
| Competencia en Amazon | muy alta (categoría genérica saturada) | menor por título, aunque hay que validar cada nicho |
| Esfuerzo de código | bajo: el motor ya está maduro | medio: modo temático, perfiles, temas nuevos |
| Esfuerzo de imágenes | casi nulo | alto: paquetes de 25–30 figuras por tema |
| Diferenciación | difícil: los diseños se parecen a los de la competencia | clara: tema + mandala es una combinación reconocible |
| Catálogo y series | series por nivel o formato | series naturales (océano 1, 2; Navidad; razas) |
| Riesgo de derechos | mínimo (todo generado) | depende del origen de cada figura |

**Veredicto.** A da libros publicables ya, con poco trabajo, pero compite en el estante más lleno.
B pide imágenes y un modo temático, a cambio de títulos que se distinguen y forman series.
Recomendación: publicar A (Large Print y Mindful Patterns) mientras se construye B, empezando por animales mandala.

### 8.2 Cómo producir la portada

| Criterio | Opción A: generador propio en la app | Opción B: Canva vía plugin |
|---|---|---|
| Automatización | total: misma semilla, mismo libro, misma portada | parcial: requiere sesión con Claude o edición manual |
| Calidad tipográfica | limitada a las plantillas que se programen | alta: plantillas y fuentes profesionales |
| Exactitud de medidas KDP | garantizada por `cover.js` con pruebas | hay que pasarle las medidas; riesgo de error manual |
| Coste de desarrollo | 5–7 días | casi nulo; depende de la cuenta de Canva |
| Producción en serie | sencilla (cola) | lenta, un diseño a la vez |

**Veredicto.** El generador propio gana en exactitud y en series; Canva gana en acabado tipográfico.
Lo razonable es combinarlas: `cover.js` calcula medidas y exporta el mandala coloreado; Canva, o una plantilla propia, compone el texto.
Para un catálogo grande conviene el generador propio; para un título insignia, Canva.

---

## Fuentes

- KDP, tamaño de corte, sangrado y márgenes: https://kdp.amazon.com/help/topic/G201834560
- KDP, medidas de portada y lomo (0,002252 in/página papel blanco; texto en el lomo con más de 79 páginas): https://kdp.amazon.com/help/topic/G201953020
- Guía de nichos 2026 (fuente secundaria, cifras sin metodología): https://cbe-web.pages.dev/blog/best-selling-coloring-book-niches-2026
- Mercado de libros para colorear 2026 (fuente secundaria): https://cbe-web.pages.dev/blog/adult-coloring-book-market-2025-trends-niches
- Nichos KDP 2026 (fuente secundaria): https://bookcoverslab.com/blog/best-kdp-niches-2026
- Documentación interna: `docs/libro-kdp.md`, `docs/proceso-calidad.md`, `docs/FIGURAS_ZENTANGLE.md`, `docs/GUIA_PARA_AYUDA.md`
