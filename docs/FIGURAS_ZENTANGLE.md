# Figuras de Zentangle en Mandala Studio

Las siluetas de dinosaurios, críptidos y animales del motor de Zentangle
(`zentangle_app_solo_fixed/js/generators/figure.js`) se exportan como un paquete de
figuras de Mandala Studio. No son la figura central de la página: sirven como motivo
para construir mandalas, igual que una imagen subida por el usuario. No hace falta portar
el motor de tangles.

Por defecto cada figura entra con uso **«Anillos alrededor de un mandala»**: `pageComposer.js`
la repite 6–12 veces en corona (rotada, con espejo alterno). El centro es un núcleo propio del mandala,
sin la figura: una figura sola en un círculo se lee como una ilustración pegada. Para ponerla también en el
centro, `figureCenter: true` en las opciones de la página. También puede usarse con uso «Medallón central»
o, con `--use figura`, como figura rellena.

## Usar el paquete ya generado

En la app, **Figuras → Importar paquete** y elegir `assets/figuras-zentangle.json`
(41 figuras: dinosaurios, críptidos y animales). Cada figura entra con uso «Anillos»;
se puede cambiar a «Medallón central» o «Figura rellena» en la lista de figuras.

## Regenerarlo

```
node scripts/exportZenFigures.mjs --zen ../zentangle_app_solo_fixed --out assets/figuras-zentangle.json
```

Opciones: `--sets dino,dinoOrigamiMix,cryptids,cryptidsOrigami,kids,bio`, `--only trex,yeti`,
`--size 1000` (lado largo en px), `--use anillos|figura|medallon` (uso inicial), `--detail 0..1` (cuerdas, 0 las apaga), `--echo 56` (ancho de banda de los ecos en px, 0 los apaga), `--scales 100`, `--feathers 130` (ancho de pluma) y `--fur 104` (separación de mechones), todos en px y con 0 para apagarlos.

El script no modifica el repositorio de Zentangle: carga una copia temporal de
`figure.js` con `FIGURES` exportado y la borra al terminar.

## Cómo funciona

1. Aplana los comandos `M/L/Q/C/Z` de la silueta, las piezas (`parts`, `back`, `front`) y los
   detalles (`deco`) a polilíneas.
2. Los dibuja como tinta (línea de ~4 px a 1000 px) sobre blanco.
3. Clasifica cada píxel por relleno de inundación: 0 tinta, 1 interior rellenable,
   2 fondo (conectado al borde), 3 interior diminuto (< 0.06 % del interior).
4. Detalle interno, para que las figuras no queden como siluetas vacías:
   - **Cuerdas de Zentangle** (`makeSections`): las curvas que subdividen cada pieza, recortadas al
     interior. Cada una se acepta solo si no crea celdas donde no quepa un círculo de ~1.7 mm
     (con el trazo grueso del sello quedarían rellenas de tinta).
   - **Ecos**: líneas paralelas al contorno por dentro (curvas de nivel de la transformada de
     distancia), una o dos por región, solo si el núcleo restante sigue siendo coloreable.
   - **Escamas** (dinosaurios, nessie, kraken, fish; no ammonite): arcos «de pez» en rejilla hexagonal,
     solo donde la escama cabe entera en una región amplia. Sustituyen a los ecos en esas figuras.
   - **Plumas** (thunderbird, mothman, owl, bird, penguin): arcos apuntados hacia abajo, en filas que se solapan (130 px: con 90 el pingüino parecía una piña).
   - **Pelo** (bigfoot, yeti, wendigo, chupacabra, jackalope, bear, fox, rabbit, cat): mechones en V en filas
     escalonadas, separados ~104 px para que el trazo grueso del sello no los funda en manchas.
   Cada textura se dibuja solo donde cabe entera dentro de una región, y si pone alguna sustituye a los ecos.
5. Empaqueta con `figurePack.js` (mismo formato que `preprocesar.html`).

## Huecos blancos de la corona

Con la figura de uso «Anillos», `pageComposer.js` llama a `drawRingGaps` (en `figureFill.js`): rellena el
espacio entre copias vecinas y entre ellas y el medallón con motivos del estilo del mandala (flores, hojas,
mariposas, estrellas…). Usa la silueta real de cada copia (`cls`, que `app.js` pasa en `figureRing`), no su
caja, así que los motivos entran entre patas y colas sin tocar el dibujo. Los huecos pequeños llevan un
punto sólido. Si la figura no trae `cls`, la corona queda como antes.

## Relleno temático (prehistórico)

Las figuras de dinosaurios (y nessie) llevan `theme: "prehistorico"` en el paquete. Con ese tema, tanto el relleno
de los huecos de la corona como el fondo de la página usan palmeras, helechos, huevos con grieta, huellas de tres
dedos, pterosaurios y hojas, en lugar de flores, corazones y coronas (`SCATTER_THEMES.prehistorico` y los motivos
nuevos de `drawFiller`). Palmeras y helechos solo salen cuando hay sitio (radio ≥ 7.5 mm); si no, se sustituyen
por una hoja para que no queden celdas sin colorear. Un fondo elegido a mano (`opts.background`) tiene prioridad
sobre el tema de la figura.

## Figura en el medallón (uso «Medallón central» o `figureCenter`)

El medallón es un círculo con la figura recortada por dentro. Antes la imagen se ajustaba a un cuadrado del
tamaño del círculo, así que una figura ancha (dinosaurios, ballena) llegaba al borde del cuadrado y el círculo
le cortaba las puntas. Ahora `mandalaClassic.js` usa `centerArt.fit`: el círculo mínimo que encierra la
silueta real (`enclosingCircle`, en `geometry.js`), y escala la figura para que ese círculo quepa en el
medallón (con trama polar, ver abajo, o con un 5 % de aire si no hay trama). Aplica a los usos «Anillos» y «Medallón central».

Una figura sola en un círculo blanco se lee como una ilustración pegada, no como parte del mandala. Con
silueta (`cls`), `drawMedallionWeb` (en `figureFill.js`) la rodea de una trama polar: 16 rayos, dos anillos y una
banda de pétalos contra el borde, la misma lógica radial del resto del mandala. Las líneas se cortan contra la
silueta y terminan en su trazo, así las celdas quedan cerradas y coloreables. La figura se reduce al 70 % del
círculo para dejar sitio a la trama. Se dibuja encima de la imagen, porque su fondo blanco es opaco.

## Figuras redibujadas

`scripts/zenOverrides.mjs` sustituye ocho figuras del motor que, a ~45 mm, salían diminutas, cargadas de tinta
o con piezas sueltas: **ufo** (disco, cúpula y haz de luz que se cierra contra el disco), **greyalien** (cabeza
grande con ojos almendrados), **kraken** (ahora un pulpo: manto redondo y cuatro tentáculos en S que no se
cruzan; conserva el nombre `zentangle-kraken`) y **wendigo** (cabeza de ciervo con astas de líneas abiertas), **rabbit** (de frente: cabeza, orejas, cuerpo, panza y patas, todo
cerrado), **mosasaurus** (cuerpo fusiforme con aletas que se cierran contra el vientre) y los terópodos
**allosaurus** y **velociraptor**, armados con piezas simples (tronco, cola, cuello, cráneo, muslo, patas) cuyo
contorno es la **unión** de las piezas (`union` en la definición): no quedan líneas donde una pieza entra en otra.
Sus líneas interiores (`detail`: muslo, bandas de la cola, boca, ojo) se recortan a esa silueta.
Regla de diseño: silueta grande y legible, 3–7 regiones cerradas, sin piezas que se crucen y sin ecos
(`noEcho`). Para exportar las originales: `--original 1`. Para añadir más, basta otro objeto en
`buildOverrides`, con las mismas claves que `FIGURES` en `figure.js`.

## Revisión de páginas completas

Se generaron 164 páginas (41 figuras × 3 formatos KDP × estilos y semillas distintos, con y sin `figureCenter`):
sin errores, sin `NaN` ni `undefined` en el SVG. En la métrica «celdas pequeñas» (< 6 mm², objetivo < 5 %) la
corona con figura da ~18–23 %, parecido a las composiciones de fondo ya existentes (8–18 %); los puntos sólidos
del relleno suman ~5 puntos porque la métrica los cuenta como celdas aunque no se coloreen. Por eso los motivos
del relleno de huecos tienen radio mínimo 4.2 mm (antes 3.0).

## Límites conocidos

- Hereda la calidad de las siluetas de Zentangle: las de pocos puntos se ven «de juguete».
- Las escamas solo caben en regiones amplias: en patas y colas finas no aparecen. Ammonite, jerseydevil y
  rabbit no llevan ni ecos ni escamas porque sus regiones son demasiado estrechas: solo cuerdas.
- Las texturas son geométricas; no sustituyen un plumaje, unas escamas o un pelaje dibujados a mano. En
  figuras pequeñas o de miembros finos (wendigo, rabbit, chupacabra, thunderbird) caben pocos trazos.
- Los espacios blancos dentro de las celdas grandes de cada figura no se rellenan; solo los de la corona.
- Las variantes origami (`angularize`) no se exportan.
