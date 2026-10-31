# Proceso para producir un libro para colorear de buena calidad

Guía corta, en orden. Cada paso dice **qué hacer**, **qué revisar** y **cuándo detenerse**.
Detalles técnicos y reglas de KDP: [`libro-kdp.md`](libro-kdp.md).

## El flujo en una línea

**Formato → Nivel → Libro KDP → Revisar páginas (puntuación) → Crear PDF → Print Previewer de KDP → copia física.**

Las tres puertas de calidad son la revisión de páginas en la app, el Print Previewer de KDP y
una copia impresa. Ninguna de las tres sustituye a las otras.

## Paso 1 · Formato de papel (barra superior)

- Elige un tamaño `KDP_…`. 8.5×11 in es el más común en mandalas; 8.5×8.5 para diseños a página completa.
- El mismo tamaño debe elegirse después en KDP («trim size»). Si no coinciden, KDP rechaza el archivo.

## Paso 2 · Nivel de dificultad (pestaña Diseñar)

| Público | Nivel | Trazo | Celda mínima |
|---|---|---|---|
| Adulto general | **Adulto** (por defecto) | 0,8 mm | 5 mm² |
| Adulto que pide «large print» / relajación | **Adulto · Trazo grueso** | 1,1 mm | 7 mm² |
| Niños 9–12 | Niños grandes | 0,7 mm | 4,5 mm² |
| Niños 5–8 | Niños pequeños | 0,8 mm | 6 mm² |

Mira la **Puntuación comercial** bajo la vista previa: verde ≥ 80, naranja 60–79, rojo < 60.
Si con tus ajustes sale en rojo, sube el grosor de línea o el área mínima de celda antes de seguir.
No bajes el trazo de 0,8 mm en un libro para adultos: en papel de KDP una línea más fina se ve gris.

## Paso 3 · Configurar el libro (pestaña Libro KDP)

1. **Número de mandalas:** 40–100 (los libros mejor valorados están en ese rango).
2. **Dificultad:** «Creciente» (recomendado).
3. **Patrones:** «Los más vendidos para este formato», con **capítulos temáticos** activados.
4. **Páginas sorprendentes:** opcionales. Los mandalas misteriosos tienen celdas pequeñas por diseño:
   ponlos sólo en libros para adultos con paciencia; quítalos en libros «large print» o infantiles.
5. **Título, autor e impresión** (en «2 · Páginas extra»): título, autor, **reverso en blanco** (recomendado para marcadores).
6. Lee el **resumen** debajo: debe decir «✅ Cumple los requisitos de interior de KDP».
   Cualquier ⚠️ se corrige antes de seguir.

## Paso 4 · Revisar páginas antes de crear (puerta de calidad 1)

Pulsa **Revisar páginas antes de crear**. Cada miniatura muestra su puntuación:

- Arriba aparece la **media del libro** y la lista de páginas flojas (< 60).
- **Control de calidad automático** (casilla activada por defecto): al abrir la revisión y al crear
  el PDF, cada página roja o gemela se rehace sola. Se prueban hasta 8 diseños nuevos: los 4 primeros
  cambian semilla, silueta y estructura; los 4 últimos además cambian el encuadre por uno más limpio
  de los permitidos (centrado, fondo decorado, gigante). Gana el mejor que no repita otra página.
  **Rehacer flojas y gemelas** lanza la misma búsqueda a mano.
- Después mira las miniaturas con tus ojos. La puntuación mide celdas pequeñas, huecos estrechos y
  trazos finos; **no** mide belleza, equilibrio visual ni si dos páginas se parecen demasiado.
  Usa **Borrar y crear otro** u **Otro encuadre** en lo que no te guste.
- Las páginas especiales (misteriosos, naturaleza, soluciones) no se puntúan: revísalas a ojo.

Debajo aparece la línea **Variedad**: los pares de páginas **gemelas**, que se ven casi iguales
al hojear, en cualquier lugar del libro. Se marcan con borde naranja punteado y una nota
(«≈ gemela de la pág. 38 (90 %)»). Rehazlas con el botón o con **Borrar y crear otro**, que cambia
también la forma exterior y la estructura.

**Criterio para continuar:** ninguna página roja, media ≥ 70 y sin páginas gemelas.

### Qué consigue el control automático

Medido con `node scripts/bench-book.mjs 3 50 <formato> <nivel>` (libros de 50 mandalas + secuencia
que crece + mural de 2×2 + portadillas; perfil «los más vendidos», capítulos, dificultad creciente):

| Libro | Antes de esta revisión | Sin control automático | Con control automático |
|---|---|---|---|
| Adulto · 8.5×11 · media | 65 | 71 | 73–75 |
| Adulto · 8.5×11 · páginas flojas (< 60) | 23 % | 12 % | 0 |
| Adulto · 8.5×8.5 · flojas / pares gemelos | — | 4–10 / 0–4 | 0 / 0 |
| Trazo grueso · 8.5×11 · flojas | — | 7–10 | 0 |
| Niños · 8.5×11 · media | — | 83 | 88–89 |

«Antes de esta revisión» es el estado anterior a dos correcciones de raíz:

- La estructura **áurea** crecía 1,618× por banda y dejaba la banda interior en un 4 % del radio
  (celdas de 2–3 mm). Ahora crece √φ ≈ 1,27× por banda: sigue siendo progresiva y la media de esas
  páginas pasó de 58 a 69.
- La puntuación contaba los **puntos negros sólidos** del fondo como celdas diminutas. No se colorean;
  ya no cuentan como celdas (siguen contando para los huecos entre trazos).

Coste: unos 8 diseños extra por página floja; en un libro de 50 mandalas, ~10–20 s más al crear.
Límite: cuando una página se cambia de encuadre, el reparto final se aparta un poco del plan
(p. ej. 4–7 gigantes en vez de 5). La puntuación sigue sin medir belleza: la revisión a ojo y la
copia impresa siguen siendo obligatorias.

### Cómo se mide la repetición

Cada página recibe una **huella geométrica** calculada sobre el dibujo mismo (`js/core/variety.js`),
no sobre las etiquetas del plan:

| Parte de la huella | Qué capta |
|---|---|
| Perfil radial de tinta | dónde caen los anillos: la estructura del mandala |
| Espectro angular por anillo | cuántas repeticiones tiene cada banda, aunque esté girada |
| Mapa de tinta 6×8 | cómo se reparte el dibujo en la hoja: encuadre y fondo |

Dos páginas con parecido ≥ 0,90 son gemelas. El umbral se fijó mirando pares reales: los de
0,90 o más se veían casi iguales; los de 0,81–0,85 ya se distinguían. Para repetir la medición:
`node scripts/bench-variety.mjs 10` (y `--antiguo` para comparar con el reparto anterior).

| 10 libros de 50 páginas | Antes | Ahora |
|---|---|---|
| Pares gemelos (≥ 0,90) por libro | 1,4 | 0,4 (y la revisión los rehace) |
| Pares parecidos (≥ 0,85) por libro | 5,0 | 2,1 |

Límite: la huella no ve el estilo de los motivos (un pétalo floral y uno geométrico del mismo
tamaño cuentan igual). Datos insuficientes para afirmar que coincide con la percepción de
compradores: se calibró con una sola revisión visual, no con lectores.

### Por qué la forma exterior importa tanto

Al hojear, el ojo reconoce primero la silueta del mandala (su banda exterior), no el interior.
El plan reparte 9 siluetas en 5 familias visuales y nunca pone la misma familia en dos páginas
seguidas:

| Familia | Siluetas | Se ve como |
|---|---|---|
| Puntas | loto, pétalo, ojiva | flor de pétalos puntiagudos |
| Lóbulos | festón, redondo | flor de pétalos redondos |
| Corazones | corazón | corona de corazones |
| Rayos | hoja | sol de rayos finos |
| Medallón | rombo, triángulo | disco cerrado por un círculo |

Cada estilo usa sólo las siluetas que le van (un geométrico no lleva corazones).

### Estructura y fondo

Además de la silueta, el plan reparte:

- **Estructura del disco**, sin repetir en páginas seguidas: *corona* (silueta protagonista),
  *héroe* (una banda media domina), *equilibrio* (anillos parejos) y *núcleo* (flor central grande).
- **Tema de fondo**, en las páginas con espacio libre. Motivos sueltos: *jardín*, *cielo* (estrellas,
  soles, lunas), *hojas* (hojas, tulipanes, gotas) y *dulce* (corazones, tréboles); corazones y
  hojas sólo acompañan estilos florales u orgánicos. En «fondo decorado» y en el centrado de hoja
  vertical también tramas ornamentales: *escamas* (anillos de pétalos), *flor de la vida* (círculos
  entrelazados) y *sol* (rayos en forma de pétalo). Dos páginas vecinas nunca comparten fondo.

### Hoja llena en formatos verticales

En 8.5×11, A4 o Carta, un mandala redondo deja franjas vacías arriba y abajo: la página quedaba
cubierta al 61 %. Los libros líderes venden diseños de hoja completa («sin el espacio en blanco
típico de los libros de mandalas», ficha de *100 Amazing Patterns*). Ahora el mandala centrado
completa las franjas con su tema de fondo y ganan peso los encuadres que cubren la hoja:

| 8.5×11, 200 páginas medidas | Antes | Ahora |
|---|---|---|
| Hoja cubierta (media) | 78 % | 93 % |
| Páginas con menos del 70 % cubierto | 52 % | 10 % |

En formato cuadrado (8.5×8.5) el centrado sigue limpio: el disco ya llena la hoja.

### Capítulos temáticos

Con «Organizar en capítulos temáticos» (activado por defecto) el libro se agrupa por familias de
estilo, como hacen los libros líderes (*125 Mandalas*: vitral, étnico, gemas…): *Jardín de
mandalas* (floral, céltico), *Arabescos y vitrales* (islámico, sashiko), *Geometría sagrada*
(geométrico, yantra) y *Soles y piedras* (azteca). Cada capítulo abre con una portadilla para
colorear. Un capítulo de menos de 4 páginas se une al más afín. Con dificultad creciente, cada
capítulo empieza algo más fácil que donde terminó el anterior y vuelve a subir.

## Paso 5 · Crear el PDF

- Pulsa **Crear libro (PDF)** desde la revisión (así se usan tus cambios).
- Hazlo en un ordenador. Safari en iPhone/iPad puede no admitir 600 DPI.
- Si el libro lleva tus imágenes, guarda el `…_registro_fuentes.csv`: es tu prueba de derechos.

## Paso 6 · Subir a KDP (puerta de calidad 2)

- Interior: **tinta negra, papel blanco, sin sangrado (No bleed)**, mismo tamaño de corte.
- Abre el **Print Previewer** y recorre todas las páginas: márgenes, números de página, páginas en blanco.

## Paso 7 · Copia impresa (puerta de calidad 3)

Pide una copia de autor («proof copy») antes de publicar y colorea al menos tres páginas
(una fácil, una media, una difícil) con lápiz y con marcador. Es la única prueba real de que
el grosor de línea, el tamaño de las celdas y el traspaso de tinta funcionan en papel.

## Qué mide la puntuación (y qué no)

| Mide | Umbral | No mide |
|---|---|---|
| Celdas < 6 mm² | ≤ 5 % | belleza o armonía |
| Celdas con proporción extrema (agujas) | 0 % | parecido entre páginas |
| Huecos entre trazos < 1,2 mm | ≤ 5 % | cómo se ve impreso de verdad |
| Trazos < 0,7 mm | ≤ 20 % | si el tema gusta al público |
| Grosor elegido < 0,8 mm | penaliza | |

La métrica es una aproximación geométrica, no un juicio validado con lectores. Sirve para
detectar páginas problemáticas y comparar versiones, no para garantizar ventas.
