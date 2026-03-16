
/**
 * Image Processing Module for Mandala Studio
 * Handles Edge Detection (Sobel), Thinning, and Vectorization
 * Optimized for better line extraction and detail preservation
 */

export class ImageProcessor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Process an image to extract edge points with preprocessing
   * @param {HTMLImageElement} img
   * @param {Object} opts { threshold, zoom, offsetX, offsetY, samples }
   * @returns {Array} List of {x, y} points
   */
  process(img, opts = {}) {
    const {
      threshold = 128,
      zoom = 1.0,
      offsetX = 0,
      offsetY = 0,
      samples = 2
    } = opts;

    const targetDim = 512;
    this.canvas.width = targetDim;
    this.canvas.height = targetDim;

    this.ctx.clearRect(0, 0, targetDim, targetDim);

    const w = img.width * zoom;
    const h = img.height * zoom;
    const x = (targetDim - w) / 2 + offsetX;
    const y = (targetDim - h) / 2 + offsetY;

    this.ctx.drawImage(img, x, y, w, h);

    const imageData = this.ctx.getImageData(0, 0, targetDim, targetDim);
    const data = imageData.data;

    // Preprocessing pipeline
    let grayscale = this._toGrayscale(data, targetDim, targetDim);
    grayscale = this._gaussianBlur(grayscale, targetDim, targetDim, 1.5);

    const edges = this._applySobel(grayscale, targetDim, targetDim, threshold);
    const thinned = this._thinEdges(edges, targetDim, targetDim);

    return this._vectorizeOptimized(thinned, targetDim, targetDim, samples);
  }

  /**
   * Convert RGBA to grayscale
   */
  _toGrayscale(data, width, height) {
    const grayscale = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      grayscale[i / 4] = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    }
    return grayscale;
  }

  /**
   * Apply Gaussian blur for noise reduction
   */
  _gaussianBlur(data, width, height, sigma = 1.0) {
    const kernel = this._gaussianKernel(sigma);
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

  /**
   * Generate Gaussian kernel
   */
  _gaussianKernel(sigma) {
    const size = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = Array(size).fill(0).map(() => Array(size).fill(0));
    const sum = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - Math.floor(size / 2);
        const dy = y - Math.floor(size / 2);
        const val = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kernel[y][x] = val;
      }
    }

    // Normalize
    let total = kernel.flat().reduce((a, b) => a + b, 0);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= total;
      }
    }

    return kernel;
  }

  /**
   * Apply optimized Sobel edge detection
   */
  _applySobel(grayscale, width, height, threshold) {
    const result = new Uint8ClampedArray(width * height);
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    let maxMag = 0;
    const magnitudes = new Float32Array(width * height);

    // Compute magnitudes
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
        const mag = Math.sqrt(sumX * sumX + sumY * sumY);
        magnitudes[y * width + x] = mag;
        maxMag = Math.max(maxMag, mag);
      }
    }

    // Non-maximum suppression for thinner edges
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const mag = magnitudes[idx];

        if (mag > threshold) {
          // Simple non-max suppression: compare with neighbors
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

  /**
   * Thin edges using Zhang-Suen algorithm (simplified)
   */
  _thinEdges(data, width, height) {
    const result = new Uint8ClampedArray(data);
    let changed = true;
    let iterations = 0;
    const maxIterations = 20;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (result[idx] === 0) continue;

          // Count neighbors
          let neighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if ((dx !== 0 || dy !== 0) && result[(y + dy) * width + (x + dx)] === 255) {
                neighbors++;
              }
            }
          }

          // Thin if isolated or unnecessary
          if (neighbors <= 2 && Math.random() < 0.5) {
            // Check if removing this pixel would break connectivity
            if (!this._breakesConnectivity(result, width, height, x, y)) {
              result[idx] = 0;
              changed = true;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if removing a pixel breaks connectivity
   */
  _breakesConnectivity(data, width, height, px, py) {
    // Simplified: check 8-neighborhood
    let whiteNeighbors = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx !== 0 || dy !== 0) && data[(py + dy) * width + (px + dx)] === 255) {
          whiteNeighbors++;
        }
      }
    }
    return whiteNeighbors <= 1;
  }

  /**
   * Vectorize edges with smart sampling and noise reduction
   */
  _vectorizeOptimized(data, width, height, step) {
    const points = [];
    const visited = new Set();

    // Find all edge pixels
    const edgePixels = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y * width + x] === 255) {
          edgePixels.push({ x, y });
        }
      }
    }

    // Cluster and sample points adaptively
    for (let i = 0; i < edgePixels.length; i += Math.max(1, step)) {
      const pixel = edgePixels[i];
      const key = `${pixel.x},${pixel.y}`;

      if (!visited.has(key)) {
        visited.add(key);
        // Normalize coordinates to -0.5 to 0.5
        points.push({
          x: (pixel.x / width) - 0.5,
          y: (pixel.y / height) - 0.5
        });
      }
    }

    // Remove near-duplicate points
    return this._reduceRedundantPoints(points, 0.005);
  }

  /**
   * Remove points that are too close together
   */
  _reduceRedundantPoints(points, minDistance) {
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
}
