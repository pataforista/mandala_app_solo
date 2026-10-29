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
3. **Patrones:** «Los más vendidos para este formato».
4. **Páginas sorprendentes:** opcionales. Los mandalas misteriosos tienen celdas pequeñas por diseño:
   ponlos sólo en libros para adultos con paciencia; quítalos en libros «large print» o infantiles.
5. **Textos y páginas extra:** título, autor, **reverso en blanco** (recomendado para marcadores).
6. Lee el **resumen** debajo: debe decir «✅ Cumple los requisitos de interior de KDP».
   Cualquier ⚠️ se corrige antes de seguir.

## Paso 4 · Revisar páginas antes de crear (puerta de calidad 1)

Pulsa **Revisar páginas antes de crear**. Cada miniatura muestra su puntuación:

- Arriba aparece la **media del libro** y la lista de páginas flojas (< 60).
- **Rehacer páginas flojas** prueba hasta 4 diseños nuevos para cada página roja y se queda con el mejor.
- Después mira las miniaturas con tus ojos. La puntuación mide celdas pequeñas, huecos estrechos y
  trazos finos; **no** mide belleza, equilibrio visual ni si dos páginas se parecen demasiado.
  Usa **Borrar y crear otro** u **Otro encuadre** en lo que no te guste.
- Las páginas especiales (misteriosos, naturaleza, soluciones) no se puntúan: revísalas a ojo.

Debajo aparece la línea **Variedad**: cuántas formas exteriores distintas tiene el libro y si
hay pares de páginas cercanas (a menos de 5 de distancia) con el mismo encuadre, estilo y forma
exterior. Esas páginas se ven gemelas al hojear: usa **Borrar y crear otro** en una de cada par
(el reemplazo cambia también la forma exterior).

**Criterio para continuar:** ninguna página roja, media ≥ 70 y sin páginas gemelas cercanas.

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
