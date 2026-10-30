# Figuras de Zentangle en Mandala Studio

Las siluetas de dinosaurios, críptidos y animales del motor de Zentangle
(`zentangle_app_solo_fixed/js/generators/figure.js`) se exportan como un paquete de
figuras de Mandala Studio. La app las rellena con `figureFill.js`, igual que una imagen
subida por el usuario: no hace falta portar el motor de tangles.

## Usar el paquete ya generado

En la app, **Figuras → Importar paquete** y elegir `assets/figuras-zentangle.json`
(41 figuras: dinosaurios, críptidos y animales). Cada figura entra con uso «Figura
rellena de mandalas».

## Regenerarlo

```
node scripts/exportZenFigures.mjs --zen ../zentangle_app_solo_fixed --out assets/figuras-zentangle.json
```

Opciones: `--sets dino,dinoOrigamiMix,cryptids,cryptidsOrigami,kids,bio`, `--only trex,yeti`,
`--size 1000` (lado largo en px).

El script no modifica el repositorio de Zentangle: carga una copia temporal de
`figure.js` con `FIGURES` exportado y la borra al terminar.

## Cómo funciona

1. Aplana los comandos `M/L/Q/C/Z` de la silueta, las piezas (`parts`, `back`, `front`) y los
   detalles (`deco`) a polilíneas.
2. Los dibuja como tinta (línea de ~4 px a 1000 px) sobre blanco.
3. Clasifica cada píxel por relleno de inundación: 0 tinta, 1 interior rellenable,
   2 fondo (conectado al borde), 3 interior diminuto (< 0.06 % del interior).
4. Empaqueta con `figurePack.js` (mismo formato que `preprocesar.html`).

## Límites conocidos

- Hereda la calidad de las siluetas de Zentangle: las de pocos puntos se ven «de juguete».
- Las piezas internas definen las regiones: figuras con pocas líneas internas (yeti, bigfoot)
  quedan con una región grande y pocos mandalas pequeños.
- Las variantes origami (`angularize`) no se exportan.
