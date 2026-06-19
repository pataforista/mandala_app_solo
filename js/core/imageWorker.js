// js/core/imageWorker.js
// Heavy CPU image processing worker for Sobel, Thinning, and Vectorization

self.onmessage = function(e) {
  try {
    const { pixelData, width, height, threshold, samples } = e.data;

    // 1. Grayscale conversion
    const grayscale = toGrayscale(pixelData, width, height);

    // 2. Gaussian Blur
    const blurred = gaussianBlur(grayscale, width, height, 1.5);

    // 3. Sobel Edge Detection
    const edges = applySobel(blurred, width, height, threshold);

    // 4. Zhang-Suen Thinning
    const thinned = thinEdges(edges, width, height);

    // 5. Point Vectorization & Simplification
    const points = vectorizeOptimized(thinned, width, height, samples);

    self.postMessage({ status: 'success', points });
  } catch (error) {
    self.postMessage({ status: 'error', error: error.message || 'Worker processing failed' });
  }
};

function toGrayscale(data, width, height) {
  const grayscale = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    grayscale[i / 4] = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
  }
  return grayscale;
}

function gaussianBlur(data, width, height, sigma = 1.0) {
  const kernel = gaussianKernel(sigma);
  const result = new Uint8ClampedArray(width * height);
  const ksize = kernel.length;
  const offset = Math.floor(ksize / 2);

  for (let y = offset; y < height - offset; y++) {
    for (let x = offset; x < width - offset; x++) {
      let sum = 0;
      let weight = 0;

      for (let ky = 0; ky < ksize; ky++) {
        for (let kx = 0; kx < ksize; kx++) {
          const ix = x + kx - offset;
          const iy = y + ky - offset;
          const k = kernel[ky][kx];
          sum += data[iy * width + ix] * k;
          weight += k;
        }
      }
      result[y * width + x] = Math.round(sum / weight);
    }
  }

  // Copy edges
  for (let y = 0; y < offset; y++) {
    for (let x = 0; x < width; x++) {
      result[y * width + x] = data[y * width + x];
      result[(height - 1 - y) * width + x] = data[(height - 1 - y) * width + x];
    }
  }
  for (let y = offset; y < height - offset; y++) {
    for (let x = 0; x < offset; x++) {
      result[y * width + x] = data[y * width + x];
      result[y * width + (width - 1 - x)] = data[y * width + (width - 1 - x)];
    }
  }

  return result;
}

function gaussianKernel(sigma) {
  const size = Math.ceil(sigma * 3) * 2 + 1;
  const kernel = Array(size).fill(0).map(() => Array(size).fill(0));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - Math.floor(size / 2);
      const dy = y - Math.floor(size / 2);
      const val = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y][x] = val;
    }
  }

  const total = kernel.flat().reduce((a, b) => a + b, 0);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= total;
    }
  }

  return kernel;
}

function applySobel(grayscale, width, height, threshold) {
  const result = new Uint8ClampedArray(width * height);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const magnitudes = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sumX = 0, sumY = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = grayscale[(y + ky) * width + (x + kx)];
          sumX += val * gx[(ky + 1) * 3 + (kx + 1)];
          sumY += val * gy[(ky + 1) * 3 + (kx + 1)];
        }
      }
      magnitudes[y * width + x] = Math.sqrt(sumX * sumX + sumY * sumY);
    }
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const mag = magnitudes[idx];

      if (mag > threshold) {
        let isMax = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (magnitudes[(y + dy) * width + (x + dx)] > mag) {
              isMax = false;
              break;
            }
          }
          if (!isMax) break;
        }
        result[idx] = isMax ? 255 : 0;
      }
    }
  }
  return result;
}

function thinEdges(data, width, height) {
  const result = new Uint8ClampedArray(data);
  let changed = true;
  let iterations = 0;
  const maxIterations = 15;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (result[idx] === 0) continue;

        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx !== 0 || dy !== 0) && result[(y + dy) * width + (x + dx)] === 255) {
              neighbors++;
            }
          }
        }

        if (neighbors >= 5 && !breaksConnectivity(result, width, height, x, y)) {
          result[idx] = 0;
          changed = true;
        }
      }
    }
  }

  return result;
}

function breaksConnectivity(data, width, height, px, py) {
  const n = [
    data[(py - 1) * width + px] === 255 ? 1 : 0,
    data[(py - 1) * width + (px + 1)] === 255 ? 1 : 0,
    data[py * width + (px + 1)] === 255 ? 1 : 0,
    data[(py + 1) * width + (px + 1)] === 255 ? 1 : 0,
    data[(py + 1) * width + px] === 255 ? 1 : 0,
    data[(py + 1) * width + (px - 1)] === 255 ? 1 : 0,
    data[py * width + (px - 1)] === 255 ? 1 : 0,
    data[(py - 1) * width + (px - 1)] === 255 ? 1 : 0,
  ];
  let transitions = 0;
  for (let i = 0; i < 8; i++) {
    if (n[i] === 0 && n[(i + 1) % 8] === 1) transitions++;
  }
  return transitions > 1;
}

function vectorizeOptimized(data, width, height, step) {
  const points = [];
  const visited = new Set();

  const edgePixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] === 255) {
        edgePixels.push({ x, y });
      }
    }
  }

  for (let i = 0; i < edgePixels.length; i += Math.max(1, step)) {
    const pixel = edgePixels[i];
    const key = `${pixel.x},${pixel.y}`;

    if (!visited.has(key)) {
      visited.add(key);
      points.push({
        x: (pixel.x / width) - 0.5,
        y: (pixel.y / height) - 0.5
      });
    }
  }

  return reduceRedundantPoints(points, 0.005);
}

function reduceRedundantPoints(points, minDistance) {
  if (points.length === 0) return points;

  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const last = result[result.length - 1];

    const dx = p.x - last.x;
    const dy = p.y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > minDistance) {
      result.push(p);
    }
  }

  return result;
}
