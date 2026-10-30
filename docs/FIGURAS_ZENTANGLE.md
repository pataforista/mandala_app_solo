# Figuras de Zentangle en Mandala Studio

Las siluetas de dinosaurios, críptidos y animales del motor de Zentangle
(`zentangle_app_solo_fixed/js/generators/figure.js`) se exportan como un paquete de
figuras de Mandala Studio. No son la figura central de la página: sirven como motivo
para construir mandalas, igual que una imagen subida por el usuario. No hace falta portar
el motor de tangles.

Por defecto cada figura entra con uso **«Anillos alrededor de un mandala»**: `pageComposer.js`
la repite 6–12 veces en corona (rotada, con espejo alterno) y pone una copia en el medallón
central. También puede usarse como medallón o, con `--use figura`, como figura rellena.

## Usar el paquete ya generado

En la app, **Figuras → Importar paquete** y elegir `assets/figuras-zentangle.json`
(41 figuras: dinosaurios, críptidos y animales). Cada figura entra con uso «Anillos»;
se puede cambiar a «Medallón central» o «Figura rellena» en la lista de figuras.

## Regenerarlo

```
node scripts/exportZenFigures.mjs --zen ../zentangle_app_solo_fixed --out assets/figuras-zentangle.json
```

Opciones: `--sets dino,dinoOrigamiMix,cryptids,cryptidsOrigami,kids,bio`, `--only trex,yeti`,
`--size 1000` (lado largo en px), `--use anillos|figura|medallon` (uso inicial), `--detail 0..1` (cuerdas, 0 las apaga), `--echo 56` (ancho de banda de los ecos en px, 0 los apaga).

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
5. Empaqueta con `figurePack.js` (mismo formato que `preprocesar.html`).

## Límites conocidos

- Hereda la calidad de las siluetas de Zentangle: las de pocos puntos se ven «de juguete».
- Nueve figuras quedan sin ecos porque sus regiones son demasiado estrechas (diplodocus, ankylosaurus,
  dimetrodon, pterosaur, mosasaurus, ammonite, nessie, jerseydevil, rabbit): solo llevan cuerdas.
- Las cuerdas y los ecos son geométricos; no sustituyen un plumaje, unas escamas o un pelaje dibujados
  a mano. Para eso haría falta una textura por tema (escamas en dinosaurios, pelo en yeti).
- El kraken sale con piezas rectangulares en la base: conviene revisarlo antes de usarlo en un libro.
- Las variantes origami (`angularize`) no se exportan.
