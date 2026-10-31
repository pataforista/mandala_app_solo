# Guía para quien ayude con los dibujos de dinosaurios

**Qué se busca.** Siluetas de dinosaurios (y otros animales) bonitas, en estilo «icono»: un contorno limpio por
animal, con el rasgo que lo define bien marcado y poco detalle. Se repiten 6–12 veces en corona alrededor de un
mandala para colorear (libro KDP), a unos 45 mm de alto. Lo que ya hay hecho por código se ve torpe; la calidad
artística es lo que falta, y es trabajo de un ilustrador, no de más código.

## 1. Qué dibujar

Prioridad (los de la imagen de referencia): **T. rex, triceratops, estegosaurio, braquiosaurio, spinosaurus,
parasaurolophus, pterosaurio, velociraptor**. Opcionales: anquilosaurio, diplodocus, plesiosaurio, huevo.

El rasgo que debe leerse de un vistazo:

| Animal | Rasgo |
|---|---|
| T. rex | cabeza enorme con mandíbula, brazos diminutos |
| Triceratops | gola con borde de puntas, dos cuernos largos y uno corto |
| Estegosaurio | placas en el lomo, púas en la cola |
| Braquiosaurio | cuello larguísimo, cabeza pequeña |
| Spinosaurus | vela dorsal, hocico largo |
| Parasaurolophus | cresta tubular hacia atrás |
| Pterosaurio | alas extendidas, pico largo, cresta |

## 2. Reglas para el archivo (SVG)

- **Un animal por archivo**, mirando a la **derecha**, en un lienzo cuadrado (`viewBox` 0 0 1000 1000). Los
  márgenes no importan: se recorta solo.
- **Silueta cerrada y continua**, sin huecos ni trazos sueltos. Las patas pueden ir juntas o separadas.
- **Detalle mínimo.** Cada zona cerrada debe poder colorearse con un lápiz: círculo inscrito de **≥ 4 mm de
  diámetro con el animal a 45 mm de alto**, es decir ≥ 90 px en un lienzo de 1000 px. Nada de escamas, pelo ni
  plumas finos: eso ya lo añade el código si hace falta. Sí: ojo, línea de la boca, 2–4 divisiones del cuerpo.
- **Sin** texto, sombras, degradados ni fondos. **Sin `transform`** (aplanarlo: Inkscape «Aplicar transformaciones»,
  Illustrator «Expandir»).
- Formas admitidas: `path`, `circle`, `ellipse`, `rect`, `polygon`, `polyline`. Curvas Bézier y arcos valen.
- **Formas con relleno = silueta** (se unen en un solo contorno, así que pueden solaparse: cuerpo + cola + patas
  como piezas separadas). **Formas sin relleno (`fill="none"`) = líneas de detalle** dentro de la silueta; se
  recortan a ella, así que pueden sobrepasar el borde.
- Ejemplos del formato: `docs/ejemplos_svg/` (hechos por código, **como muestra del formato, no de la calidad**).

**Derechos.** Dibujos propios o CC0. No copiar ilustraciones ajenas, aunque sean de referencia: el libro se
vende. Cada figura lleva `rightsConfirmed`; las importadas entran en `false` y solo se pone en `true` con
`--rights 1` cuando quien las trae asegura que puede usarlas.

## 3. Cómo probarlas

```
node scripts/exportZenFigures.mjs --svg docs/ejemplos_svg --svgmode silhouette \
     --theme prehistorico --out figuras-nuevas.json
```

Genera un paquete que se carga en la app con **Figuras → Importar paquete**. Cada figura aparece con uso «Anillos»
(se puede cambiar a «Medallón central» o «Figura rellena de mandalas»). `--svgmode outline` (por defecto) trata
todo como líneas: sirve si el dibujo es de contornos en vez de siluetas. Necesita Node 20+ y el repositorio de
Zentangle junto a este (`../zentangle_app_solo_fixed`, o `--zen RUTA`) solo para el relleno temático; para SVG no
se usa su motor de figuras.

**Alternativa sin código:** imágenes PNG/JPG de línea sobre fondo blanco, directamente en la app
(**Figuras → Subir imágenes**) o en `preprocesar.html`. La app trae su propia lista de requisitos y
verificación por imagen (resolución, fondo, celdas cerradas).

## 3b. Dibujos en una lámina (varios animales en una imagen)

Si los dibujos llegan en una lámina de línea negra sobre fondo blanco (como las generadas con IA), se separan
solos:

```
node scripts/importSheet.mjs lamina.jpg --names trex,triceratops,... --theme prehistorico --out lamina.json
node scripts/checkFigures.mjs lamina.json        # semáforo de zonas coloreables, en mm reales
```

Los nombres van en orden de lectura (filas de arriba abajo). Requiere Playwright. El paquete
`assets/figuras-dinosaurios.json` (32 figuras) salió de dos láminas así. **Derechos:** `--rights 1` las marca como
confirmadas (sin él entran sin confirmar y la app las marca «no lista» hasta que se marque la casilla). Quien genera
dibujos con IA debe comprobar los términos de la herramienta para uso comercial: aquí no se puede verificar.

## 4. Mapa del código (para un desarrollador)

| Archivo | Qué hace |
|---|---|
| `scripts/exportZenFigures.mjs` | Convierte figuras (del motor de Zentangle o SVG) en un paquete importable |
| `scripts/importSheet.mjs` | Separa los animales de una lámina de línea y los empaqueta como figuras |
| `scripts/checkFigures.mjs` | Semáforo de coloreabilidad de un paquete (zonas cerradas ≥ 4 mm a 45 mm de alto) |
| `scripts/svgPath.mjs` | Lector de SVG → comandos M/L/Q/C/Z |
| `scripts/zenOverrides.mjs` | Figuras redibujadas por código (ufo, greyalien, pulpo, wendigo, conejo, mosasaurio, terópodos) |
| `scripts/zenIcons.mjs` | Íconos de un contorno hechos por código (opcionales: `--icons 1`); **no entran al paquete por defecto** |
| `js/generators/figureFill.js` | `drawRingGaps` (huecos de la corona), `drawMedallionWeb`, relleno de figura |
| `js/generators/pageComposer.js` | Composición «anillos» y motivos de relleno (palmera, helecho, huevo, huella, pterosaurio) |
| `js/core/geometry.js` | `enclosingCircle`: encaja una figura en un medallón |
| `assets/figuras-zentangle.json` | Paquete actual (41 figuras) |
| `assets/adornos-infantiles.json`, `assets/adornos-naturaleza.json` | Adornos de fondo (78 y 72 ilustraciones extra) |
| `docs/FIGURAS_ZENTANGLE.md` | Cómo funciona todo, con sus límites |

Pruebas: `npm test`.

## 5. Estado

- La **corona, el relleno de huecos, el tema prehistórico y la importación** funcionan y están probados.
- Los **dibujos de dinosaurios hechos por código** son el punto débil: legibles, pero sin la gracia de un dibujo
  hecho por una persona. Los íconos de `zenIcons.mjs` (braquiosaurio, estegosaurio, T. rex, triceratops,
  pterosaurio) son un intento más limpio, pero tampoco llegan a «bonitos»; por eso no están activos.
