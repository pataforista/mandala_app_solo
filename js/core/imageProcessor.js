
/**
 * Image Processing Module for Mandala Studio
 * Handles Edge Detection (Sobel) and Vectorization
 */

export class ImageProcessor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Process an image to extract edge points
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

    // Use a fixed resolution for consistent vector density
    const targetDim = 512;
    this.canvas.width = targetDim;
    this.canvas.height = targetDim;

    this.ctx.clearRect(0, 0, targetDim, targetDim);
    
    // Apply zoom and offset
    const w = img.width * zoom;
    const h = img.height * zoom;
    const x = (targetDim - w) / 2 + offsetX;
    const y = (targetDim - h) / 2 + offsetY;
    
    this.ctx.drawImage(img, x, y, w, h);
    
    const imageData = this.ctx.getImageData(0, 0, targetDim, targetDim);
    const data = imageData.data;
    
    const edges = this._applySobel(data, targetDim, targetDim, threshold);
    return this._vectorize(edges, targetDim, targetDim, samples);
  }

  _applySobel(data, width, height, threshold) {
    const grayscale = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      // Standard grayscale conversion
      grayscale[i / 4] = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    }

    const result = new Uint8ClampedArray(width * height);
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

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
        result[y * width + x] = mag > threshold ? 255 : 0;
      }
    }
    return result;
  }

  _vectorize(data, width, height, step) {
    const points = [];
    const scale = 1.0 / width; // Normalize to 0-1 range
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (data[y * width + x] === 255) {
          // Normalize coordinates to -0.5 to 0.5 for the radial generator
          points.push({ 
            x: (x / width) - 0.5, 
            y: (y / height) - 0.5 
          });
        }
      }
    }
    return points;
  }
}
