# Libro para Amazon KDP: variedad, figuras e imágenes de dominio público

## 1. Variedad entre páginas

Un libro de 30 discos centrados sobre papel vacío se percibe como la misma página fotocopiada.
El modo libro planifica ahora cada página antes de dibujarla (`js/core/bookPlan.js`):

| Dimensión | Opciones | Regla |
|---|---|---|
| Estilo | sashiko, floral, geométrico, islámico, azteca, yantra, céltico | bolsa barajada: se agotan todos antes de repetir; nunca dos iguales seguidos |
| Composición | centrado, fondo decorado, constelación, cuartos en esquinas, gigante recortado, medio mandala | «centrado» pesa más (es el más coloreable) |
| Marco | redondeado, doble con rombos, festón, sin marco | sin repetición consecutiva |
| Pétalos | 8–24 | bolsa barajada |
| Dificultad | mixta, progresiva (fácil → difícil), fija | |
| Mis imágenes | uso elegido **a mano** por imagen: figura rellena, anillos o medallón | cada imagen elegida aparece una vez, repartida de forma uniforme |

Misma semilla ⇒ mismo libro (reproducible).

## 2. Requisitos de KDP que el PDF cumple

Fuente: [Trim size, bleed and margins (KDP)](https://kdp.amazon.com/help/topic/G201857950).

| Requisito KDP (tapa blanda, interior B/N, sin sangrado) | Antes | Ahora |
|---|---|---|
| Mínimo 24 páginas, máximo 828 | aviso | lista de verificación en la interfaz |
| Margen interior (medianil) según páginas: 24–150 → 0,375″; 151–300 → 0,5″; 301–500 → 0,625″; 501–700 → 0,75″; 701–828 → 0,875″ | 10 mm fijos (fallaba por encima de 150 págs.) | margen calculado con el total de páginas |
| Márgenes exteriores ≥ 0,25″ (6,4 mm) | ✔ | ✔ |
| Fuentes incrustadas | ✘ jsPDF declaraba Helvetica/Times sin incrustar | ✔ texto rasterizado y `putOnlyUsedFonts`: el PDF no contiene fuentes |
| Imágenes ≥ 300 DPI | ✔ | ✔ |
| PDF aplanado, sin transparencias | ✘ cada página llevaba máscara alfa (SMask) | ✔ PNG en gris de 8 bits sin alfa (además ~4× más ligero) |
| Número de páginas par | a veces impar | siempre par |
| Mandalas en página derecha con reverso en blanco | ✔ | ✔ |
| Página de derechos de autor | — | opcional (activada por defecto) |

Al subir a KDP elige: **tinta negra, papel blanco, sin sangrado (No bleed)** y el mismo tamaño de corte
elegido en «Formato de Papel». Revisa siempre con el **Print Previewer** de KDP antes de publicar.

## 3. Figuras rellenas de mandalas (tus imágenes)

1. Sube imágenes en «Mis imágenes (figuras)» o, para lotes y fotos difíciles, abre `preprocesar.html`.
2. El procesamiento (`js/core/lineArt.js → processFigure`) busca una figura **sin fondo, sin texto y
   con pocos detalles**:
   - **Colores planos** (caricaturas, carteles): bordes entre zonas de color.
   - **Dibujo / grabado**: umbral de tinta.
   - **Pintura / foto**: diferencia de gaussianas (una línea por contorno).
   - **Quitar fondo**: crece desde los bordes superior y laterales; una segunda pasada suavizada
     reconoce fondos con textura (marcos grabados, papel viejo).
   - **Clics sobre el fondo** (en `preprocesar.html`): borran fondos que no tocan el borde,
     como el fondo oscuro de una foto enmarcada.
   - **Sólo la figura principal**: descarta textos, pies de foto, firmas y restos de marco.
   - **Simplificar**: borra trazos cortos (pelo, grano), suaviza la silueta y elimina franjas
     delgadas pegadas a la figura. Deja la silueta y los rasgos grandes (ojos, nariz, boca).
   - Vacía las manchas negras (un gato negro queda como silueta rellenable) y deja en blanco las
     regiones pequeñas (ojos).
   - Salida a 3000 px de lado largo: ≈300 DPI para una figura de 25 cm.
3. El relleno (`js/generators/figureFill.js`) coloca mandalas pequeños, flores y estrellas dentro de
   cada región cerrada sin tocar ninguna línea. «Densidad del relleno» baja = más fácil de colorear.

**Receta para una foto antigua** (p. ej. el gato con sombrero): tipo «Pintura / foto»,
Simplificar 0,5, Tolerancia del fondo ≈20, 4–5 clics sobre el fondo oscuro y recorte inferior
si queda el borde de la foto.

**Qué funciona mejor:** caricaturas con contornos claros y fondo sencillo, grabados e ilustraciones
de libros antiguos, retratos de animales sobre fondo liso.

### Elección manual y anillos de figuras

Ninguna imagen se integra sola. Al subirla o importarla queda en «No usar»; bajo cada miniatura
(o en cada tarjeta de `preprocesar.html`) eliges su uso:

| Uso | Resultado | Mejor para |
|---|---|---|
| Figura rellena de mandalas | la figura ocupa la página y su interior se llena de mandalas y flores | siluetas grandes y cerradas (caricaturas, animales) |
| Anillos alrededor de un mandala | 6–12 copias (en espejo alterno) entre bandas de mandala, y la figura entera en el medallón | figuras pequeñas o con poco interior |
| Medallón central | la figura dentro del círculo central de un mandala clásico | retratos, cabezas |

**Geometría de los anillos** (resuelta con Wolfram Language): una copia de alto h y ancho a·h con
su borde interior a distancia d del centro cabe si a·h/2 ≤ d·tan(π/n) (no invade la cuña de su
vecina) y (d+h)² + (a·h/2)² ≤ r_ext² (su esquina exterior no sale del anillo). El alto máximo es
h = 2·r_ext·t / √(4at + 4t² + a²(1+t²)), con t = tan(π/n). Se elige el mayor número de copias que
no las encoja más de un 5 %; con Félix (a ≈ 0,8) las copias crecen un 11 % frente al cálculo anterior.

Las copias de los anillos y el medallón usan una versión «sello» de trazo grueso (≈1,6 % del lado),
para que sigan siendo coloreables a 25 mm. Idea tomada de `mandalas.py` (estampas en anillos),
combinada con la limpieza de figuras de la app.

Al crear el libro se descarga también `…_registro_fuentes.csv`: página del PDF, uso, estilo e
imagen de origen. Guárdalo como prueba de qué obra de dominio público usaste en cada página.

### Lista de verificación (imagen lista antes de entrar al libro)

Cada imagen se comprueba sola (`js/core/figureChecks.js`), en `preprocesar.html` y en la app.
Sólo entran al libro las que tienen uso elegido **y** ningún error:

| Requisito | ✅ | ⚠️ aviso | ❌ bloquea | Alternativa sugerida |
|---|---|---|---|---|
| Resolución del original | ≥ 800 px | 350–800 px | < 350 px | Upscayl |
| Sin fondo (relleno de la caja de la silueta) | ≤ 78 % | 78–90 % | > 90 % (queda un rectángulo) | clics, rembg, Photopea |
| Sin texto ni restos | ≤ 3 trazos sueltos | 4–10 | > 10 | Photopea, GIMP |
| Pocos detalles (línea / figura) | ≤ 21 % | ≤ 30 % | > 30 % (figura rellena) | Simplificar, sketch2lineart, Anime2Sketch |
| Interior rellenable (figura rellena) | ≥ 30 % | 15–30 % | < 15 % | Inkscape, o usar en «Anillos» |
| Proporción (anillos / medallón) | 0,4–1,6 / 0,6–1,4 | fuera de rango | — | recortar |
| Derechos y fuente | confirmados | — | faltan | Smithsonian Open Access, Rawpixel |

La fuente anotada viaja en el paquete y aparece en la columna `fuente` del registro CSV del libro.

## 4. Derechos de autor: qué puedes usar para vender

Esto es orientación, no asesoría legal. Ante la duda, no lo uses.

- **Protegidos (no usar):** Minions, Pokémon, Disney/Pixar modernos, Bluey, personajes actuales.
  Un mandala alrededor de ellos sigue siendo una obra derivada.
- **El dominio público depende del país.** En EE. UU. entraron obras publicadas hasta 1930 (en 2026).
  En México la protección dura la vida del autor **más 100 años**; en la UE, vida + 70.
  Amazon vende en varios países: prefiere autores fallecidos hace más de 100 años.
- **Marcas registradas:** aunque un dibujo antiguo sea de dominio público, el nombre puede seguir
  siendo marca. Ej.: las primeras caricaturas de Félix el Gato se consideran de dominio público
  en EE. UU., pero el nombre y el personaje siguen como marca de DreamWorks/NBCUniversal
  ([Wikipedia](https://en.wikipedia.org/wiki/Felix_the_Cat)). El fotograma de la serie de TV
  (años 50-60) **no** es de las primeras caricaturas. No pongas «Félix» en título ni portada.
- **KDP y dominio público:** si el contenido ya existe gratis, KDP exige una edición diferenciada
  (p. ej. «(Illustrated)») y lo excluye de KDP Select
  ([guía de KDP](https://kdp.amazon.com/help/topic/G200743940)). Rellenar la figura con mandalas
  originales es una transformación; descríbela al inicio de la descripción del producto.

### Dónde conseguir imágenes de dominio público / CC0

- [Smithsonian Open Access](https://www.si.edu/openaccess): millones de imágenes CC0.
- [Rawpixel – Public Domain](https://www.rawpixel.com/public-domain): ilustraciones CC0, con PNG transparentes.
- [Wikimedia Commons](https://commons.wikimedia.org): revisa la licencia de cada archivo.
- Library of Congress, Paris Musées, The Heritage Library: ilustraciones históricas.
- Buenas candidatas: Beatrix Potter (†1943), John Tenniel (†1914), grabados de Hokusai (†1849),
  Gustave Doré (†1883), ilustraciones científicas de Ernst Haeckel (†1919).

## 5. Herramientas externas de preprocesamiento (opcionales)

`preprocesar.html` corre en el navegador y puede alojarse en cualquier hosting estático público
(p. ej. GitHub Pages). Si una imagen necesita más limpieza antes de importarla:

| Necesidad | Herramienta | Notas |
|---|---|---|
| Quitar fondo | [rembg](https://github.com/danielgatis/rembg) (MIT, local) | sin subir imágenes a terceros |
| Foto → dibujo de líneas | [Fotor – Photo to Coloring Page](https://www.fotor.com/features/photo-to-coloring-page/) | servicio comercial con uso gratuito limitado |
| Ilustración → líneas (IA) | [Anime2Sketch](https://github.com/Mukosame/Anime2Sketch) (MIT), Spaces de Hugging Face como [sketch2lineart](https://huggingface.co/spaces/tori29umai/sketch2lineart) | resultados variables; revisa los términos de cada Space |

Exporta el resultado en blanco y negro e impórtalo con el tipo «Dibujo / grabado».
Revisa la licencia de cada herramienta antes de vender lo que generen.
