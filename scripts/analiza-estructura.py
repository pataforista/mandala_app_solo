"""Mide la estructura de un mandala en imagen: celdas (regiones blancas cerradas), su reparto de
tamaños y cuánta superficie queda en celdas grandes y vacías. Todo normalizado al disco (600 px de
diámetro), para comparar una referencia con páginas propias sin depender de la resolución.
Sirve para juzgar el nivel experto, cuya puntuación comercial no es válida (penaliza el trazo fino
y las celdas chicas que ese nivel promete). Las referencias no se guardan en el repositorio.
Uso: python3 -I scripts/analiza-estructura.py etiqueta=ruta.png [etiqueta=ruta.png ...]"""
import sys
from collections import deque
import numpy as np
from PIL import Image

D = 600

def carga(path):
    g = Image.open(path).convert("L")
    a = np.array(g)
    ink = a < 150
    ys, xs = np.where(ink)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    lado = max(y1 - y0, x1 - x0)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    h = lado // 2 + 4
    g = g.crop((cx - h, cy - h, cx + h, cy + h)).resize((D, D), Image.LANCZOS)
    return np.array(g) < 150

def celdas(ink):
    """Regiones blancas conectadas dentro del disco, sin la del fondo."""
    yy, xx = np.mgrid[0:D, 0:D]
    disco = (yy - D / 2) ** 2 + (xx - D / 2) ** 2 <= (D / 2) ** 2
    libre = (~ink) & disco
    lab = np.zeros((D, D), np.int32)
    areas = []
    n = 0
    for sy in range(D):
        for sx in range(D):
            if libre[sy, sx] and lab[sy, sx] == 0:
                n += 1
                q = deque([(sy, sx)]); lab[sy, sx] = n; cnt = 0; toca_borde = False
                while q:
                    y, x = q.popleft(); cnt += 1
                    if (y - D / 2) ** 2 + (x - D / 2) ** 2 > (D / 2 - 2) ** 2: toca_borde = True
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < D and 0 <= nx < D and libre[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n; q.append((ny, nx))
                areas.append((cnt, toca_borde))
    # La región del fondo (toca el borde del disco y es enorme) se descarta
    todas = [a for a, borde in areas if not (borde and a > 0.05 * disco.sum())]
    return np.array(todas), int(disco.sum()), int(ink[disco].sum())

def informe(nombre, ink):
    a, disco, tinta = celdas(ink)
    rel = a / disco
    grandes = rel[rel > 0.004]            # celdas mayores del 0,4 % del disco: «vacías» a la vista
    # Anchura de trazo: longitud mediana de las rachas de tinta (horizontal y vertical)
    rachas = []
    for m in (ink, ink.T):
        for fila in m[::6]:
            d = np.diff(np.concatenate(([0], fila.view(np.int8), [0])))
            s, e = np.where(d == 1)[0], np.where(d == -1)[0]
            rachas.extend((e - s).tolist())
    rachas = np.array(rachas)
    return {
        "etiqueta": nombre,
        "celdas": len(a),
        "tinta %": round(100 * tinta / disco, 1),
        "celda mediana (‰ disco)": round(1000 * float(np.median(rel)), 2),
        "p10 / p90 (‰)": f"{1000 * np.percentile(rel, 10):.2f} / {1000 * np.percentile(rel, 90):.2f}",
        "superficie en celdas grandes %": round(100 * grandes.sum(), 1),
        "celdas grandes": int(len(grandes)),
        "trazo mediano px": int(np.median(rachas)),
        "trazo p90 / mediana": round(float(np.percentile(rachas, 90) / np.median(rachas)), 1),
    }

if __name__ == "__main__":
    filas = []
    for arg in sys.argv[1:]:
        nombre, ruta = arg.split("=", 1)
        filas.append(informe(nombre, carga(ruta)))
    ks = list(filas[0].keys())
    print(" | ".join(ks))
    for f in filas: print(" | ".join(str(f[k]) for k in ks))
