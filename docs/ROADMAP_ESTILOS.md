# Roadmap del plan B · Estilos que se reconozcan (14 nov 2026)

**Qué es.** El plan B de `REVISION_MOTORES_2026-11.md` § 3: empezar por la identidad de los siete
estilos del motor clásico, antes de corregir la puntuación.
**Audiencia.** Quien programe los estilos y quien revise las páginas.
**Objetivo.** Que una persona, al ver una página sin rótulo, diga «celta», «islámico» o «azteca»,
y que eso quede demostrado con medidas y con una prueba a ciegas.

## 0. Premisa, riesgo y cómo se contiene

Hoy el estilo sólo entra al motor por una tabla de pesos (`STYLE_WEIGHTS`,
`mandalaClassic.js:21`): los siete estilos sortean entre los mismos doce motivos con
probabilidades distintas. La silueta sale de una lista común (`SILHOUETTE`, línea 34) y el núcleo
de tres variantes sin estilo (línea 711). Tres motivos declarados (`voluta`, `roseta`, `antemia`)
están excluidos del sorteo (línea 153): tienen peso y nunca se dibujan.

El riesgo del plan B es conocido: la puntuación comercial arrastra restas constantes (H4 de la
revisión), de modo que distingue mal una página buena de una excelente. Tres reglas lo contienen:

1. **La puntuación se congela.** Ningún PR de este roadmap toca `commercialMetrics.js`. Si la
   medida cambia a mitad del trabajo, el antes y el después dejan de ser comparables.
2. **Se compara contra la línea base de cada estilo, no contra un número absoluto.** La meta es
   «no bajar», no «llegar a 90».
3. **La identidad se mide con un instrumento propio** (`scripts/bench-identity.mjs`, ya en el
   repositorio) y se confirma con personas (§ 6.5).

Lo que este roadmap **no** resuelve: el nivel experto seguirá sin llegar a «Listo para KDP» y las
figuras, tramas y páginas especiales quedan como están. Eso pertenece a las fases 1, 3 y 4 de la
revisión.

## 1. Línea base (motor clásico, nivel adulto)

| Estilo | Puntuación media | Mínima | Acierto del clasificador |
|---|---|---|---|
| floral | 79,1 | 62 | 35 % |
| geométrico | 79,6 | 61 | 30 % |
| islámico | 79,5 | 68 | 15 % |
| sashiko | 80,0 | 71 | 30 % |
| celta | 78,0 | 60 | 10 % |
| azteca | 73,1 | 37 | 10 % |
| yantra | 75,3 | 42 | 35 % |
| **Global** | **77,8** | **37** | **24–29 %** (azar: 14 %) |

Fuentes: `node scripts/bench-styles.mjs 10` (puntuación, 10 semillas por estilo) y
`node scripts/bench-identity.mjs 40 adulto` (acierto; 24 % con 40 páginas por estilo, 28 % con
80, 29 % en experto).

Lectura. El clasificador acierta poco más que una moneda de siete caras. Celta se confunde con
floral en 12 de 20 páginas; azteca, con geométrico y yantra en 15 de 20. Los centroides de los
siete estilos caben dentro de una desviación estándar: son dialectos del mismo idioma.

Límite del instrumento: el clasificador usa siete rasgos de forma y un centroide por estilo. Mide
separación geométrica, que es condición necesaria para que el ojo distinga, no suficiente. Por eso
la meta final es la prueba a ciegas.

## 2. Arquitectura de destino

Un estilo deja de ser una fila de pesos y pasa a ser una **gramática**: un módulo que declara qué
puede dibujarse en cada parte del disco.

```
js/generators/styles/
  index.js        registro: STYLE_GRAMMARS, grammarOf(styleMode)
  common.js       primitivas compartidas (pétalo, círculo, celda polar, cinta entrelazada)
  floral.js  geometric.js  islamico.js  sashiko.js  celtico.js  azteca.js  yantra.js
```

Contrato de cada gramática:

| Campo | Qué declara | Sustituye a |
|---|---|---|
| `motifs` | motivos de banda permitidos y su peso | fila de `STYLE_WEIGHTS` |
| `exclusive` | motivos que sólo existen en este estilo, con su función de dibujo | — (nuevo) |
| `banned` | motivos comunes que este estilo nunca usa | — (nuevo) |
| `silhouettes` | siluetas exteriores propias y permitidas | `SILHOUETTE` y `SILHOUETTES_BY_STYLE` |
| `cores` | núcleos propios | `CORE_VARIANTS` |
| `counts` | números de pétalos naturales del estilo | `petals` del perfil |
| `line` | reglas de trazo: rectas o curvas, doble línea, jerarquía | — (nuevo) |
| `quota` | mínimo de bandas con motivo exclusivo por página | — (nuevo) |
| `backgrounds` | tramas de fondo afines | `BACKGROUND_STYLES` |

Dos reglas de la gramática hacen el trabajo de identidad:

- **Cuota de firma:** cada página lleva al menos una banda con motivo exclusivo, y la silueta o el
  núcleo propios. Sin cuota, el sorteo puede producir una página «celta» sin un solo nudo.
- **Vetos:** un estilo también se define por lo que no dibuja. Corazones fuera de islámico,
  azteca, yantra y geométrico; triángulos y rombos fuera de floral y celta.

Todo motivo exclusivo cumple el contrato del motor clásico: celdas cerradas, simetría exacta con
conteos armónicos de N, pintado de fuera hacia dentro con relleno blanco, y respeto de la celda y
el trazo mínimos del nivel.

## 3. Especificación por estilo

Cada ficha dice qué reconoce el ojo, qué se construye y qué restricciones de coloreado aplican.
Los motivos son construcciones geométricas tradicionales y genéricas; no se copia ninguna pieza
concreta.

### 3.1 Islámico

| | |
|---|---|
| **Lo que se reconoce** | estrellas de muchas puntas hechas de rectas, cintas que se entrelazan, arcos lobulados |
| **Conteos** | 8, 10, 12, 16, 24 |
| **Núcleo propio** | roseta de estrella de N puntas: estrella central, anillo de cometas y anillo de pétalos hexagonales |
| **Silueta propia** | arcos polilobulados; almenas escalonadas |
| **Banda 1 · estrella** | polígono estrellado {n/k} formado por dos polígonos regulares girados (dos cuadrados dan la estrella de 8) |
| **Banda 2 · lacería** | cinta de doble línea en zigzag que pasa por encima y por debajo en cada cruce |
| **Banda 3 · cometas** | anillo de cometas y rombos que teselan la banda sin huecos |
| **Trazo** | rectas dominantes; la cinta es una celda coloreable |
| **Vetos** | corazón, pétalo redondo, hoja, llama |
| **Restricción de coloreado** | ancho de cinta ≥ 2,5 mm; puntas de estrella con ángulo ≥ 30° (más agudo deja celdas que no admiten lápiz) |

### 3.2 Celta

| | |
|---|---|
| **Lo que se reconoce** | nudos de cinta sin principio ni fin, trenzas, triquetras |
| **Conteos** | 6, 9, 12, 18, 24 (múltiplos de 3 para el núcleo) |
| **Núcleo propio** | triquetra o trísquel dentro de un círculo cuando N es múltiplo de 3; si no, anillo de N lazos |
| **Silueta propia** | corona de lazos de nudo; borde de cinta cerrada |
| **Banda 1 · trenza** | trenza de 2 o 3 cabos sobre rejilla polar, con alternancia arriba/abajo |
| **Banda 2 · nudo** | nudo cerrado por celda (lazo en ocho, nudo de cuatro esquinas), repetido N veces |
| **Banda 3 · eslabones** | anillos enlazados en cadena |
| **Trazo** | curvas; toda cinta va en doble línea con cortes limpios en los cruces |
| **Vetos** | triángulo, rombo, chevrón, llama |
| **Restricción de coloreado** | ancho de cinta ≥ 2,5 mm; los huecos entre cabos ≥ celda mínima del nivel o se cierran en negro fino, nunca quedan astillas |

Pieza técnica nueva: `ribbon()` en `common.js`, que recibe una línea central y un mapa de cruces y
devuelve los dos bordes con los cortes del cabo que pasa por debajo. La usan celta e islámico.

### 3.3 Azteca

| | |
|---|---|
| **Lo que se reconoce** | grecas escalonadas, rayos triangulares, anillos de casillas, todo anguloso |
| **Conteos** | 4, 8, 16, 20 |
| **Núcleo propio** | disco solar: círculo central, cuatro casillas en cruz y anillo de cuentas cuadradas |
| **Silueta propia** | rayos triangulares que alternan grande y pequeño; almenas en escalón |
| **Banda 1 · greca** | greca escalonada con gancho, construida con celdas polares rectas |
| **Banda 2 · dentado** | triángulos dentados enfrentados (dientes de sierra dobles) |
| **Banda 3 · casillas** | cartuchos rectangulares con un símbolo simple dentro (punto, barra, cruz) |
| **Trazo** | sólo rectas y arcos concéntricos; esquinas vivas |
| **Vetos** | corazón, hoja, pétalo redondo, festón |
| **Restricción de coloreado** | escalón de greca ≥ 2,5 mm de lado; es el estilo con peor mínimo hoy (37), así que cada motivo se prueba primero en banda estrecha |

### 3.4 Sashiko

| | |
|---|---|
| **Lo que se reconoce** | tramas japonesas de costura: hoja de cáñamo, olas, círculos enlazados |
| **Conteos** | 6, 12, 16, 18, 24 |
| **Núcleo propio** | crisantemo de 16 pétalos redondeados en doble corona |
| **Silueta propia** | olas apiladas (seigaiha) como borde; festón doble |
| **Banda 1 · asanoha** | estrella hexagonal de cáñamo adaptada a la celda polar |
| **Banda 2 · seigaiha** | abanicos de arcos concéntricos solapados |
| **Banda 3 · shippo** | círculos entrelazados que forman lentes |
| **Banda 4 · kikko** | hexágonos en panal |
| **Trazo** | grosor uniforme en toda la página; sin jerarquía de trazo ni pétalo dentro de pétalo |
| **Vetos** | llama, corazón, chevrón |
| **Restricción de coloreado** | lente de shippo ≥ celda mínima; arcos de seigaiha separados ≥ 2 mm |

### 3.5 Yantra

| | |
|---|---|
| **Lo que se reconoce** | triángulos entrelazados en el centro, coronas de loto, recinto cuadrado con cuatro puertas |
| **Conteos** | 8, 16 (loto); 3 y 6 en el núcleo |
| **Núcleo propio** | triángulos entrelazados hacia arriba y hacia abajo (de 2 a 5) con un punto central |
| **Silueta propia** | corona de 16 pétalos de loto entre tres anillos lisos |
| **Marco propio** | recinto cuadrado con cuatro puertas en T, alrededor del disco (sustituye al marco de página) |
| **Banda 1 · loto** | pétalos de loto de 8 y de 16, con pétalo interior |
| **Banda 2 · anillos** | tres círculos concéntricos lisos (franja coloreable) |
| **Trazo** | rectas en el núcleo, curvas en los lotos; pocas bandas y amplias |
| **Vetos** | corazón, festón, cuentas, llama |
| **Restricción de coloreado** | las intersecciones de los triángulos generan celdas pequeñas: con más de 3 triángulos, el núcleo crece hasta que la menor celda cumpla el mínimo |

El recinto cuadrado toca al compositor de página (`pageComposer.js`), no sólo al disco. Va en un
PR aparte del resto del estilo.

### 3.6 Floral (depuración)

Floral es el estilo por defecto y el de mayor peso en el libro (3 de cada 6,5 páginas en «más
vendidos»). No necesita motivos nuevos; necesita dejar de compartir los ajenos.

- **Vetos:** triángulo, rombo, chevrón, antemia.
- **Firma:** pétalos solapados en dos o tres capas desfasadas, hojas entre pétalos, núcleo de
  estambres (disco con corona de puntos coloreables).
- **Silueta propia:** pétalo ancho con muesca; hoja lanceolada.

### 3.7 Geométrico (depuración)

- **Vetos:** corazón, pétalo redondo, hoja, llama, festón.
- **Firma:** sólo rectas. Bandas de triángulos y rombos que teselan sin huecos, polígonos
  estrellados simples, núcleo de polígono regular subdividido.
- **Silueta propia:** puntas de diamante; estrella de N puntas.

### 3.8 Matriz de exclusividad

Un motivo marcado con ● sólo existe en ese estilo. Sirve de lista de comprobación y de prueba
(§ 6.2).

| Motivo | Floral | Geom. | Islám. | Sashiko | Celta | Azteca | Yantra |
|---|---|---|---|---|---|---|---|
| estrella {n/k}, cometas | | | ● | | | | |
| lacería (cinta en zigzag) | | | ● | | | | |
| trenza, nudo, eslabones | | | | | ● | | |
| greca, dentado, casillas | | | | | | ● | |
| asanoha, seigaiha, shippo, kikko | | | | ● | | | |
| triángulos entrelazados, recinto | | | | | | | ● |
| pétalos solapados, estambres | ● | | | | | | |
| teselado de triángulos y rombos | | ● | | | | | |

## 4. Etapas y entregables

Un PR por etapa. Tamaños relativos: chico (una sesión), medio (dos o tres), grande (más).

| Etapa | Contenido | Depende de | Tamaño |
|---|---|---|---|
| **E0** | Instrumentos: `bench-identity.mjs` y `bench-styles.mjs`, y línea base guardada en `docs/lineas-base/estilos-2026-11.txt` (todo en el PR #46) | — | hecho |
| **E1** | Refactor a gramáticas sin cambiar ningún dibujo: `styles/index.js`, siete módulos con los pesos actuales, `common.js` con las primitivas extraídas | E0 | medio |
| **E2** | Vetos y cuota de firma con los motivos que ya existen; decidir `voluta`, `roseta` y `antemia` (se rehacen como exclusivos o se borran) | E1 | chico |
| **E3** | Islámico: estrella, cometas, núcleo de roseta, silueta lobulada | E2 | grande |
| **E4** | `ribbon()` y lacería islámica | E3 | medio |
| **E5** | Celta: trenza, nudo, eslabones, triquetra, corona de lazos | E4 | grande |
| **E6** | Azteca: greca, dentado, casillas, disco solar, rayos alternos | E2 | grande |
| **E7** | Sashiko: asanoha, seigaiha, shippo, kikko, crisantemo | E2 | grande |
| **E8** | Yantra, disco: triángulos entrelazados, lotos de 8 y 16, anillos | E2 | medio |
| **E9** | Yantra, recinto cuadrado en el compositor de página | E8 | medio |
| **E10** | Floral y geométrico: firmas y siluetas propias | E2 | medio |
| **E11** | Integración en el libro: capítulos, siluetas por estilo, fondos afines, miniaturas de estilo en la interfaz, textos es/en | E3–E10 | medio |
| **E12** | Cierre: prueba a ciegas, prueba impresa, actualización de documentos | E11 | chico |

E6, E7, E8 y E10 no dependen entre sí: pueden avanzar en paralelo después de E2.
E3 va primero entre los estilos porque estrena la plantilla de trabajo (§ 5) con el motivo más
simple de construir, la estrella de rectas.

### Detalle de E1 (el refactor que sostiene todo)

1. Extraer de `mandalaClassic.js` las primitivas (`petalShape`, `heartShape`, `ogeeShape`,
   `circle`, `stipple`, `capsuleVein`) a `styles/common.js`, con `cx`, `cy` y `P` como parámetros.
2. Convertir el `switch` de motivos (líneas 280–620) en un registro `MOTIFS[nombre] = dibujar(ctx, banda)`.
3. Crear las siete gramáticas con los pesos actuales, sin vetos ni exclusivos.
4. `pickMotif`, la silueta y el núcleo leen de la gramática.
5. Conservar el orden exacto de llamadas al generador aleatorio: una llamada de más cambia todas
   las páginas de todos los libros guardados.

**Verificación de E1:** prueba dorada. Antes del refactor se guarda el hash SHA-256 del SVG de
7 estilos × 4 niveles × 10 semillas (280 páginas) y de 3 encuadres con fondo. Después, los 280
hashes coinciden. Cero páginas cambian.

## 5. Plantilla de trabajo por motivo nuevo

Cada motivo exclusivo recorre los mismos seis pasos. Es la unidad mínima de avance.

1. **Boceto en papel o SVG a mano** de una celda: dónde nace, dónde cierra, cuántas celdas
   coloreables deja.
2. **Prueba de coloreabilidad primero** (`tests/styles.test.mjs`): el motivo, dibujado en bandas
   de 6, 10 y 18 mm, con 8, 16 y 24 repeticiones, en los cuatro niveles, cumple § 6.2.
3. **Implementación** en la gramática del estilo.
4. **Lámina del motivo solo:** `node scripts/bench-styles.mjs 10 --html /tmp/laminas` y mirar las
   10 semillas del estilo.
5. **Bancos:** `bench-styles.mjs` e `bench-identity.mjs`; anotar antes y después.
6. **Regeneración de proyectos guardados:** una página guardada con ese estilo cambia de dibujo.
   Se anota en el PR (ver riesgo R3).

## 6. Verificación

Siete capas, de la más barata a la más cara. Una etapa se cierra cuando pasan todas las que le
aplican.

### 6.1 No regresión (todas las etapas)

| Comprobación | Orden | Criterio |
|---|---|---|
| Pruebas y service worker | `npm run check` | todo pasa |
| Márgenes KDP | `tests/margins.test.mjs` (dentro de `npm test`) | ninguna tinta fuera del área segura, sin tolerancia |
| Estilos no tocados | prueba dorada de E1, restringida a los estilos que el PR no modifica | hashes idénticos |
| Puntuación congelada | `git diff main -- js/core/commercialMetrics.js` | vacío |

### 6.2 Coloreabilidad de cada motivo (E3–E10)

Prueba unitaria por motivo, en `tests/styles.test.mjs`:

| Criterio | Umbral |
|---|---|
| Celdas cerradas menores que la celda mínima del nivel | 0 |
| Trazo más fino | ≥ 0,5 mm |
| Asimetría radial (`measureSvg(...).asimetria`) | 0 |
| Ancho de cinta (celta, islámico) | ≥ 2,5 mm |
| Ángulo más agudo de una celda | ≥ 30° |
| Motivo exclusivo fuera de su estilo (matriz § 3.8) | 0 apariciones en 50 páginas de cada otro estilo |
| Motivo vetado dentro del estilo | 0 apariciones en 50 páginas |
| Cuota de firma | 100 % de 50 páginas con ≥ 1 banda exclusiva |

Para las dos últimas filas, el generador expone `doc.meta.motifs` (lista de motivos dibujados por
banda). Hoy no existe: se añade en E1.

### 6.3 Puntuación por estilo (E2–E10)

`node scripts/bench-styles.mjs 10`, tabla 1, motor clásico:

| Indicador | Línea base | Criterio de la etapa | Meta final (E12) |
|---|---|---|---|
| Media del estilo tocado, adulto | ver § 1 | ≥ línea base − 1 | ≥ línea base |
| Mínima del estilo tocado, adulto | ver § 1 | ≥ línea base | ≥ 60 en los siete |
| Media en niños y trazo grueso | 89–91 y 83–84 | ≥ línea base − 1 | igual |
| Tiempo por página | 1–3 ms | ≤ 10 ms | ≤ 10 ms |

El nivel experto se informa y no decide: su puntuación está mal calibrada (H3).

### 6.4 Identidad medida (E2–E12)

`node scripts/bench-identity.mjs 80 adulto`:

| Indicador | Línea base | Criterio de la etapa | Meta final |
|---|---|---|---|
| Acierto del estilo recién hecho | 10–35 % | ≥ 65 % | ≥ 70 % |
| Acierto global | 24–29 % | sube respecto a la etapa anterior | ≥ 80 % |
| Peor confusión entre dos estilos | celta → floral, 12 de 20 | — | ningún par > 20 % |
| Parecido de huella entre estilos, misma semilla (`bench-styles.mjs`, tabla 2) | 0,96 | — | ≤ 0,85 |

La última meta es más modesta que la de la revisión (0,80). Motivo: la huella mide dónde caen los
anillos y cuántas repeticiones tienen, no la forma del motivo; dos estilos con el mismo esqueleto
de bandas seguirán pareciéndose en esa medida aunque el ojo los distinga.

Trampa a evitar: el clasificador se puede «ganar» con un truco (por ejemplo, dar a cada estilo un
número de celdas distinto). Por eso los rasgos de `bench-identity.mjs` se congelan igual que la
puntuación, y la decisión final es de la capa 6.5.

### 6.5 Prueba a ciegas con personas (E12, y un ensayo al cerrar E5)

| Paso | Detalle |
|---|---|
| Material | 28 páginas: 4 por estilo, nivel adulto, centradas, sin fondo ni rótulo, orden barajado con semilla anotada |
| Participantes | 3 personas que no hayan visto el desarrollo; reciben los siete nombres y un ejemplo de referencia externo por estilo |
| Tarea | escribir el estilo de cada página; sin límite de tiempo |
| Criterio | media ≥ 22 de 28 (79 %); ningún estilo con menos de 2 de 4 en promedio |
| Registro | tabla de aciertos por persona y estilo, en `docs/lineas-base/ciega-AAAA-MM.md`, sin datos personales |

Con tres personas el resultado orienta, no demuestra: 84 respuestas no sostienen un intervalo
estrecho. Sirve para detectar un estilo que nadie reconoce, que es justo lo que hay que saber.

### 6.6 Libro completo (E11)

| Comprobación | Orden | Criterio |
|---|---|---|
| Libro «más vendidos» | `node scripts/bench-book.mjs 3 50 KDP_8_5x11 adulto` | media ≥ 81, 0 flojas, 0 gemelas tras curar (hoy 82,8–83,2) |
| Repetición | `node scripts/bench-variety.mjs 10` | gemelas por libro ≤ 0,2 antes de curar (hoy 0,2) |
| Libro de un solo estilo, uno por cada uno de los siete | banco nuevo `bench-book.mjs --estilo X` | 40 páginas, ≤ 2 flojas antes de curar, 0 gemelas tras curar |
| Capítulos | lámina de las portadillas | cada capítulo abre con un mandala de su estilo, con firma visible |
| Idioma | `tests/pageTexts.test.mjs` | nombres de estilo y capítulo con paridad es/en |

El libro de un solo estilo es la prueba más dura: 40 páginas del mismo estilo sin gemelas exige
que cada gramática tenga variedad interna (al menos 3 motivos exclusivos, 2 siluetas y 2 núcleos).

### 6.7 Prueba de imprenta (E12)

| Paso | Criterio |
|---|---|
| Rasterizar a 300 ppp una página por estilo y medir en píxeles | trazo más fino ≥ 6 px (0,5 mm); ninguna celda cerrada < 2 mm² |
| Imprimir en casa las 7 páginas en papel de 90 g y colorear una cinta celta y una estrella islámica con lápiz y con marcador | la punta entra en la celda más pequeña sin salirse |
| Crear un libro real desde la app (un capítulo por estilo) y abrir el PDF | el aviso final dice «Listo para KDP»; se mira la primera página de cada capítulo |

El último paso exige ejecutar la app en un navegador. En la revisión de noviembre no se pudo; aquí
es obligatorio antes de cerrar.

## 7. Tablero del plan B

| Indicador | Hoy | Tras E2 | Tras E5 | Tras E10 | Meta E12 |
|---|---|---|---|---|---|
| Acierto global del clasificador | 24–29 % | ≥ 35 % | ≥ 55 % | ≥ 80 % | ≥ 80 % |
| Estilos con acierto ≥ 65 % | 0 de 7 | 0 | 2 (islámico, celta) | 7 | 7 |
| Mínima por estilo, adulto | 37 | ≥ 37 | ≥ 50 | ≥ 60 | ≥ 60 |
| Media del libro «más vendidos» | 83 | ≥ 81 | ≥ 81 | ≥ 81 | ≥ 81 |
| Prueba a ciegas | sin medir | — | ensayo | — | ≥ 22 de 28 |
| Motivos exclusivos dibujables | 0 | 0 | ≥ 7 | ≥ 20 | ≥ 20 |

Las cifras intermedias son hitos esperados, no compromisos: sirven para saber pronto si el camino
funciona. Si tras E5 el acierto global no pasa de 45 %, se detiene y se revisa la premisa.

## 8. Riesgos y reglas de parada

| # | Riesgo | Señal | Respuesta |
|---|---|---|---|
| R1 | Los motivos nuevos bajan la coloreabilidad | mínima del estilo cae bajo su línea base | el motivo no entra; se rehace en banda más ancha o se limita a niveles adulto y experto |
| R2 | El entrelazado (cinta) genera astillas | celdas < mínimo en la prueba 6.2 | cerrar la astilla o ensanchar la cinta; si persiste, la cinta pasa por encima siempre (sin cruces) |
| R3 | Los proyectos guardados cambian de dibujo | un proyecto de prueba guardado antes de E2 no reproduce sus páginas | versión de gramática en el proyecto (`grammarVersion`); un proyecto antiguo avisa antes de regenerar |
| R4 | El estilo gana identidad y pierde variedad interna | gemelas en el libro de un solo estilo | añadir un motivo o una silueta antes de seguir con el estilo siguiente |
| R5 | La cifra mejora y la página empeora | acierto alto, lámina fea | manda la lámina: la etapa no se cierra sin la mirada de doce páginas |
| R6 | La puntuación congelada oculta un defecto real | páginas que puntúan bien y se ven empastadas | anotar el caso para la fase 1 de la revisión; no tocar la medida dentro de este roadmap |
| R7 | Yantra con recinto cuadrado rompe márgenes | `tests/margins.test.mjs` falla | el recinto se dibuja con su borde exterior en el margen, igual que los marcos |

Reglas de parada generales:

- Dos intentos fallidos de un motivo contra la prueba 6.2: se descarta y se elige otro de la
  ficha del estilo.
- Una etapa que baja la media del libro «más vendidos» de 81: no entra.
- Tras E5, acierto global < 45 %: se detiene el roadmap y se revisa si la identidad debe venir
  también del esqueleto de bandas (proporciones y conteos por estilo), no sólo de los motivos.

## 9. Definición de terminado

El plan B está terminado cuando se cumplen a la vez:

1. Los siete estilos tienen gramática propia con cuota de firma y vetos.
2. `bench-identity.mjs 80 adulto` da ≥ 80 % global y ≥ 70 % en cada estilo.
3. La prueba a ciegas da ≥ 22 de 28.
4. Ningún estilo tiene mínima < 60 en adulto, y el libro «más vendidos» mantiene media ≥ 81 sin
   flojas ni gemelas.
5. Un libro de 40 páginas de cada estilo sale sin gemelas tras la curaduría.
6. Las siete páginas impresas se pueden colorear con lápiz y con marcador.
7. `REVISION_MOTORES_2026-11.md` § 5 tiene la columna «Hoy» actualizada.

## 10. Estado a 16 nov 2026

### 10.1 Etapas

| Etapa | Estado | Nota |
|---|---|---|
| E0 instrumentos y línea base | hecho | `bench-styles.mjs`, `bench-identity.mjs`, `docs/lineas-base/` |
| E1 gramáticas sin cambiar páginas | hecho | 343 de 343 páginas idénticas (`golden-styles.mjs`) |
| E2 vetos | hecho | los vetos valen también para la silueta que impone el plan del libro |
| E3 islámico | hecho | cadena de estrellas, arquería lobulada, núcleo de polígonos girados |
| E4 cinta entrelazada | hecho | `braid()` y `ringChain()`; lacería islámica |
| E5 celta | hecho | trenza, eslabones, núcleo de trenza anular |
| E6 azteca | hecho | greca, sierra doble, casillas, rayos, disco solar |
| E7 sashiko | hecho | seigaiha, asanoha, shippo, kikko, crisantemo |
| E8 yantra (disco) | hecho | loto encerrado, anillos, triángulos entrelazados con 6 o 12 pétalos |
| E9 yantra (recinto cuadrado) | hecho, primera versión | recinto con cuatro puertas en el mismo margen KDP; las puertas se ven como huecos con pestañas, no como puertas en T: pendiente de revisión visual |
| E10 floral y geométrico | hecho | corola y estambres; teselado, facetas y polígono (sólo rectas) |
| E11 integración | hecho en parte | capítulos por estilo, siluetas propias en el plan, aviso al abrir proyectos anteriores, `npm run e2e`. Faltan miniaturas de estilo en la interfaz y fondos afines por estilo |
| E12 cierre | preparado, sin ejecutar | `scripts/blind-test.mjs` crea las 28 páginas y la hoja de respuestas; la clave sale con `--clave` y no debe entregarse a quien responde. Falta que 3 personas la hagan y la prueba impresa |

### 10.2 Medidas (motor clásico; línea base → hoy)

Puntuación media y, entre paréntesis, mínima. Nivel adulto, 40 semillas hoy; la línea base de
noviembre usó 10 semillas, así que las mínimas no son comparables una a una.

| Estilo | Línea base | Tras E2 (40 semillas) | Hoy | Acierto del clasificador: base → hoy |
|---|---|---|---|---|
| floral | 79,1 (62) | 77,5 (58) | 80,5 (52) | 35 → 65 % |
| geométrico | 79,6 (61) | 81,8 (66) | 82,8 (70) | 30 → 68 % |
| islámico | 79,5 (68) | 80,4 (66) | 82,7 (66) | 15 → 50 % |
| sashiko | 80,0 (71) | 80,8 (62) | 81,6 (68) | 30 → 73 % |
| celta | 78,0 (60) | 78,9 (63) | 84,8 (71) | 10 → 75 % |
| azteca | 73,1 (37) | 75,7 (50) | 78,1 (49) | 10 → 60 % |
| yantra | 75,3 (42) | 79,9 (64) | 84,0 (74) | 35 → 70 % |

| Indicador | Línea base | Hoy | Meta | ¿Cumple? |
|---|---|---|---|---|
| Acierto global del clasificador | 24–29 % | 65,7 % | ≥ 80 % | no |
| Estilos con acierto ≥ 65 % | 0 de 7 | 5 de 7 | 7 | no |
| Parecido de huella entre estilos, misma semilla (adulto) | 0,96 | 0,89 | ≤ 0,85 | no |
| Pares de estilos gemelos, misma semilla (adulto) | 94 % | 51 % | — | — |
| Mínima por estilo, adulto | 37 | 49 (azteca) | ≥ 60 | no |
| Media del libro «más vendidos» antes de curar | 82,2 | 85,3 | ≥ 81 | sí |
| Libro «más vendidos» tras curar | 82,8–83,2 | 84,0–86,1, 0 flojas, 0 gemelas | 0 flojas, 0 gemelas | sí |
| Gemelas por libro antes de curar | 0,2 | 0,3 | ≤ 0,2 | no, por poco |
| Piezas exclusivas dibujables | 0 | 25 (18 motivos de banda o silueta y 7 núcleos) | ≥ 20 | sí |
| Libro real creado en la app (`npm run e2e`) | sin probar | 106 páginas, «Listo para KDP», media 84–85, sin errores, en es y en | pasa | sí |
| Pruebas | 110 | 122 de 122 | todas | sí |

Las 25 piezas: islámico (estrella, arco, lacería, roseta de polígonos), celta (trenza,
eslabones, trenza anular), azteca (greca, dentado, casillas, rayos, disco solar), sashiko
(seigaiha, asanoha, shippo, kikko, crisantemo), yantra (padma, anillos, triángulos), floral
(corola, estambres), geométrico (teselado, facetas, polígono).

### 10.3 Lo que no se cumplió y por qué

- **Acierto del clasificador: 66 % frente a la meta de 80 %.** Islámico (50 %) y azteca (60 %)
  se confunden entre sí y con geométrico: los tres son estilos de rectas, y los siete rasgos del
  clasificador (proporción de rectas, esquinas, redondez…) no ven la diferencia entre una
  estrella de ocho y una greca. A la vista se distinguen; la medida no alcanza. La prueba a
  ciegas (§ 6.5) decide. No se añadieron rasgos al clasificador para subir la cifra: sería
  ajustar el termómetro a la fiebre.
- **Mínima por estilo: 49 (azteca) frente a 60.** Las páginas más bajas no vienen de los motivos
  nuevos sino de motivos comunes en bandas estrechas (rombos y llamas con conteos altos). Es el
  trabajo de la tarea 2.3 de la revisión, aún abierta.
- **Niños baja entre 1 y 2 puntos en azteca, sashiko, geométrico y floral** (por ejemplo sashiko
  90,1 → 87,7), fuera del criterio de «línea base − 1». A cambio la mínima sube o se mantiene
  salvo en azteca. Motivo probable: los motivos nuevos tienen más vértices próximos entre sí, que
  la medida cuenta como huecos (H4 de la revisión, sin verificar).
- **Nivel experto: sigue sin llegar a «Listo para KDP»** (70 de 80 páginas flojas). Estaba fuera
  del alcance del plan B.

### 10.4 Pendientes nuevos encontrados por el camino

| Pendiente | Dónde | Efecto |
|---|---|---|
| El núcleo «flor de la vida» se dibuja como un disco vacío: su aro blanco se pinta encima | `mandalaClassic.js`, variante `flor_vida` | uno de cada tres núcleos comunes sale vacío. Destaparlo sin rediseñar deja un ovillo de astillas en núcleos pequeños |
| Rombos y llamas en bandas estrechas con conteos altos | motivos comunes `diamond`, `flame` | origen de las mínimas de 49–52 |
| El libro de 28 mandalas «más vendidos» sólo abre 2 capítulos | `chapterLayout` | con los pesos actuales, celta, sashiko, islámico y azteca no llegan al tamaño mínimo de capítulo |
| Miniaturas de estilo en la interfaz | `index.html`, `app.js` | el selector sigue siendo una lista de nombres |

### 10.5 Cómo comprobarlo todo

```bash
npm install            # una vez: trae Shoelace y jsPDF para la prueba de punta a punta
npm run check          # service worker + 122 pruebas (incluye la prueba dorada de 343 páginas)
npm run bench:estilos  # puntuación por estilo, parecido e identidad
npm run e2e            # crea un libro real en Chromium, en español y en inglés
node scripts/style-sheet.mjs celtico /tmp/laminas   # lámina de un estilo para mirarla
```

### 10.6 Estado final (17 nov 2026)

Fuente: `docs/lineas-base/estilos-final.txt` (`bench-styles.mjs 40`, `bench-identity.mjs 80 adulto`,
`bench-book.mjs`). Sustituye a las cifras de § 10.2 donde difieran.

**Corrección.** Una nota anterior de esta sección decía que la mínima de azteca en adulto había
subido a 64 y cumplía la meta. Esa cifra salió de una configuración de prueba distinta de la del
banco oficial. Con `bench-styles.mjs` la mínima de azteca es 55 y la más baja de los siete estilos
es 52 (floral): **la meta de mínima ≥ 60 no se cumple.**

| Estilo | Niños | Trazo grueso | Adulto | Acierto del clasificador |
|---|---|---|---|---|
| floral | 87,0 (73) | 83,9 (68) | 80,5 (52) | 60 % |
| geométrico | 90,5 (79) | 85,2 (75) | 82,8 (70) | 65 % |
| islámico | 93,9 (74) | 85,3 (71) | 82,7 (66) | 40 % |
| sashiko | 86,5 (73) | 83,2 (70) | 81,8 (68) | 73 % |
| celta | 92,9 (80) | 87,3 (74) | 84,8 (71) | 75 % |
| azteca | 88,0 (37) | 84,3 (67) | 79,5 (55) | 63 % |
| yantra | 91,0 (85) | 86,5 (79) | 84,4 (74) | 70 % |

Media y, entre paréntesis, mínima de 40 semillas.

| Indicador | Línea base | Final | Meta | ¿Cumple? |
|---|---|---|---|---|
| Acierto global del clasificador | 24–29 % | 63,6 % | ≥ 80 % | no |
| Parecido de huella entre estilos, misma semilla (adulto) | 0,96 | 0,85 | ≤ 0,85 | sí |
| Pares de estilos gemelos, misma semilla (adulto) | 94 % | 33 % | — | — |
| Mínima por estilo, adulto | 37 | 52 (floral) | ≥ 60 | no |
| Media por estilo, adulto | 73–80 | 79,5–84,8 | no bajar | sí |
| Libro «más vendidos» antes de curar | 82,2 | 85,4 | ≥ 81 | sí |
| Libro «más vendidos» tras curar | 82,8–83,2 | 84,7–86,0; 0 flojas; 0 gemelas | 0 flojas, 0 gemelas | sí |
| Libro real en la app (`npm run e2e`) | sin probar | 106 páginas, «Listo para KDP», media 84–85, sin errores, es y en | pasa | sí |
| Pruebas | 110 | 122 de 122 | todas | sí |

### 10.7 Revisión geométrica de los motivos nuevos

Se repasaron las fórmulas de los motivos con cálculo independiente; dos identidades se
confirmaron con Wolfram|Alpha (el evaluador de código de Wolfram no respondió).

| Motivo | Qué se comprobó | Resultado | Acción |
|---|---|---|---|
| Núcleo islámico (dos polígonos girados) | área de una punta | la fórmula sobrestimaba un 27 % la estrella de seis y subestimaba 3–19 % las de ocho a catorce. Wolfram: 0,0858 R² en la de ocho | corregida; cambian 2 de 343 páginas |
| Shippo y eslabones | distancia al vecino alterno en un anillo | es 2·arc·cos(π/n), no 2·arc (Wolfram). Con 12 elementos o menos el tope permitía invadir al alterno | corregido; ninguna de las 343 páginas cambia: es una salvaguarda |
| Seigaiha (olas) | si los abanicos se tocan | en 397 bandas medidas, la fila de dentro se tocaba en el 75 % y la de fuera en el 64 %; huecos de hasta 9 mm | rehecha: el radio lo fija la separación y se apilan las filas que quepan. Adulto 81,7 → 81,8 en el banco oficial |
| Trenza y lacería | precisión del corte donde una cinta pasa bajo la otra | error máximo 0,08 mm, menos de un píxel a 300 ppp | ninguna |
| Núcleo del yantra | área de la punta de la estrella de seis | correcta | ninguna |
| Cadena de estrellas, estambres | condición de contacto entre vecinos | correctas | ninguna |

### 10.8 Qué queda

| Pendiente | Por qué no se cerró |
|---|---|
| Prueba a ciegas (E12) | necesita tres personas; el material sale de `node scripts/blind-test.mjs <carpeta>` |
| Prueba impresa (E12) | necesita papel y lápices |
| Mínima ≥ 60 | las páginas más bajas vienen de motivos comunes (rombos, pétalos) en bandas estrechas; es la tarea 2.3 de la revisión |
| Clasificador ≥ 80 % | islámico cae a 40 %: comparte rectas con azteca y geométrico, y los siete rasgos no distinguen una estrella de una greca. Decide la prueba a ciegas |
| Recinto del yantra | primera versión: las puertas se leen como huecos con pestañas |
| Núcleo «flor de la vida» vacío, miniaturas de estilo, fondos afines | fuera del alcance de esta tanda |
| Nivel experto | 70 de 80 páginas flojas; depende de la puntuación por público (fase 1 de la revisión) |

### 10.9 Revisión final (17 nov 2026, tarde)

Fuente: `docs/lineas-base/estilos-final.txt` (sustituye a la versión de esa mañana). Cambios desde
§ 10.6:

- **Núcleo «disco solar» del azteca:** sus dientes medían 5,96 mm², justo por debajo de los 6 mm²
  que la métrica cuenta como celda pequeña; con tres bandas (niveles infantiles) 12 dientes
  diminutos hundían la página a 0–11 puntos. Todos los núcleos propios comparan ahora contra un
  único umbral del motor, `minCoreCell` (≥ 6,5 mm²), y los botones centrales tienen radio ≥ 1,45 mm.
- **Rayos del azteca:** los rayos pequeños se apilaban detrás de los grandes y asomaban como cuñas
  finas. Ahora los dientes alternan altura compartiendo la base: cada uno es un triángulo limpio.
- **Floral:** se veta la llama (no es un motivo floral y era el de peor nota, 71 frente a 80+).

| Estilo | Niños | Trazo grueso | Adulto | Acierto del clasificador |
|---|---|---|---|---|
| floral | 87,1 (73) | 84,9 (73) | 82,4 (71) | 68 % |
| geométrico | 90,5 (79) | 85,2 (75) | 82,8 (70) | 65 % |
| islámico | 93,9 (74) | 85,3 (71) | 82,7 (66) | 40 % |
| sashiko | 86,5 (73) | 83,2 (70) | 81,8 (68) | 73 % |
| celta | 92,9 (80) | 87,3 (74) | 84,8 (71) | 73 % |
| azteca | 89,6 (70) | 84,4 (67) | 81,9 (64) | 65 % |
| yantra | 91,0 (85) | 86,5 (79) | 84,4 (74) | 70 % |

| Indicador | Línea base | Final | Meta | ¿Cumple? |
|---|---|---|---|---|
| Acierto global del clasificador | 24–29 % | 64,6 % | ≥ 80 % | no |
| Parecido de huella entre estilos (adulto) | 0,96 | 0,85 | ≤ 0,85 | sí |
| **Mínima por estilo, adulto** | 37 | **64 (azteca)** | ≥ 60 | **sí** |
| Media por estilo, adulto | 73–80 | 81,8–84,8 | no bajar | sí |
| Libro «más vendidos» tras curar | 82,8–83,2 | 85,0–86,2; 0 flojas; 0 gemelas | 0 flojas, 0 gemelas | sí |
| Libro real en la app (`npm run e2e`) | sin probar | 106 páginas, «Listo para KDP», sin errores, es y en | pasa | sí |
| Pruebas | 110 | 124 de 124 | todas | sí |

Queda sin cumplir el clasificador (islámico, 40 %: comparte rectas con azteca y geométrico) y el
nivel experto. La mínima de niños en azteca era 37 y ahora es 70.

### 10.10 Mural para armar

El tamaño del póster recortable ya se controla desde «Libro KDP»: 2×1, 2×2, 3×2, 3×3, 4×4 o «Otro
tamaño…» con columnas y filas de 1 a 6 (de 2 a 36 hojas, más la guía). Verificado en la app real:
4×2 crea 104 páginas (3×3 crea 106), la guía rotula A1–D2 y el tamaño sobrevive a recargar.

### 10.11 Nivel experto: motivos orgánicos, puntos de contraste y puntuación propia

Origen: cuatro mandalas de referencia de libro intrincado (sólo para medir; no se copian ni se
guardan). Su estructura de celdas, medida con `scripts/analiza-estructura.py`, se compara con la
de nuestras páginas de experto.

| Punto | Qué | Efecto medido |
|---|---|---|
| 1 · Motivos orgánicos | gota con rizo, pluma, abanico y rizo, sólo en experto, con peso propio en cada estilo | celdas por mandala 730–1.370 → 1.080–1.370; superficie vacía en celdas grandes 18–31 % → 2,6–23 % |
| 2 · Puntos de contraste | anillo de puntos negros (radio 0,75 mm) en bandas de ≥ 7 mm, separación ≥ 2 mm | se leen como acentos sin formar manchas; sólo experto |
| 3 · Puntuación propia | `expertScore()`: celdas dentro del disco, astillas aparte, vacío y contraste | ver `bench-styles.mjs`, tabla 4 |

Adulto y niños no cambian: la prueba dorada sólo mueve páginas de experto.

**Qué no se puede afirmar todavía**

- La puntuación experta es una construcción propia, ajustada con criterio y con las cuatro
  referencias como única muestra. No está validada con personas; el juicio decisivo sigue siendo
  el de quien colorea.
- Las astillas (huecos de menos de 0,6 mm entre dos trazos casi pegados) son lo que más se
  separa: islámico tiene ~1.000 por mandala y sashiko ~0. No se sabe si las referencias las tienen,
  porque a la resolución de sus imágenes no se ven. Por eso se informan aparte y no restan.
- El nivel experto sigue sin llegar a «Listo para KDP» en la puntuación comercial, que no
  corresponde a este nivel.

### 10.12 Lo que quedaba del motor (17 nov 2026, última tanda)

| Pendiente | Resultado |
|---|---|
| Núcleo «flor de la vida» dibujado como disco vacío | ya no lo usa ningún estilo; el defecto queda sin efecto. La variante sigue en el código sin usarse |
| Celdas pequeñas en los núcleos | **era un error de medición**: el escáner usaba el radio de la banda 0, no el del núcleo. Lo que queda son celdas de 5–6 mm² en la banda más interior de adulto, dentro de la tolerancia (≤ 5 %) de la puntuación comercial |
| Fondos de trama afines por estilo (E11) | hecho: cada estilo recibe al menos dos tramas de su familia; el selector nunca devuelve vacío (prueba en `styles.test.mjs`) |
| Puertas del recinto del yantra (E9) | hecho: puertas en T, con jambas y umbral, dentro del margen KDP |

Sin cambios en adulto y niños: la prueba dorada sólo movió las páginas de yantra (puertas) y de
experto (motivos orgánicos y contraste).

Queda fuera del motor: las miniaturas de estilo en la interfaz (es trabajo de pantalla) y la
prueba a ciegas con personas (E12).

### 10.13 Pendientes cerrados y marcos (17 nov 2026)

| Pendiente | Estado |
|---|---|
| Fondos de trama afines por estilo (E11) | hecho (10.12) |
| Miniaturas de estilo en la pestaña del libro (E11) | hecho: una página pequeña por estilo; pulsarla marca o desmarca la casilla |
| Puertas del recinto del yantra (E9) | hecho: puertas en T |
| Núcleo «flor de la vida» | corregido el orden de pintado; ningún estilo lo usa |
| Marcos: más opciones | hecho: ocho marcos (redondeado, doble con rombos, festón, sin marco, cordón, ondas, gotas, sólo esquinas) |

Los cuatro marcos nuevos pasan las pruebas de márgenes KDP, igual que los originales.

**Lo que sigue abierto y no puedo cerrar desde aquí**

- **Prueba a ciegas con tres personas y prueba impresa (E12).** El material está listo con
  `scripts/blind-test.mjs`; hacen falta personas y papel.
- **Reconocimiento de estilos en 70 %**, por debajo de la meta de 80 %. Islámico es el más
  confuso; sólo la prueba con personas lo puede resolver.
- **Nivel experto**: la puntuación propia es una construcción sin validar con personas.
- **Marcos por estilo**: los marcos no tienen afinidad con el estilo (un festón puede ir con
  cualquier estilo). Es una opción de diseño que todavía no está decidida.

### 10.14 Marcos: afinidad, esquinas sin astillas y recinto como marco

- **Afinidad marco ↔ estilo** (`FRAME_AFFINITY` en `bookPlan.js`): cada página toma un marco de los
  que le sientan a su estilo y que el libro permite; nunca dos seguidos iguales. Verificado en planes
  generados: 0 páginas con un marco fuera de su estilo. La tabla es una propuesta de diseño, no una
  medida: lo que se midió es que todos los marcos funcionan con todos los estilos.
- **Composición «esquinas» sin astillas:** cada mandala de esquina queda entero dentro del área útil y
  no pisa el disco central. Antes se recortaba con el marco y dejaba 16 celdas diminutas junto al borde
  en 14 páginas. Ahora hay cero con cualquier marco.
- **Recinto como marco elegible:** el dibujo del recinto del yantra vive en `generators/recinto.js` y lo
  usan el motor y el compositor, así que el yantra ya no pierde su recinto al cambiar de composición.
