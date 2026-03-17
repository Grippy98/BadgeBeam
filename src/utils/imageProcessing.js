/**
 * imageProcessing.js
 * Core logic to resize, grayscale, and dither an image for a 400x300 1-bit E-ink display.
 */

export const DISPLAY_WIDTH = 400;
export const DISPLAY_HEIGHT = 300;

/**
 * Loads an image from a native File object.
 * @param {File} file 
 * @returns {Promise<HTMLImageElement>}
 */
export const loadImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Draws an image to a canvas, applying Floyd-Steinberg Dithering
 * and extracting the final 1-bit packed byte array for BLE transfer.
 * 
 * @param {HTMLImageElement} img 
 * @param {HTMLCanvasElement} canvas 
 * @param {boolean} dither - Whether to apply Floyd-Steinberg dithering or simple threshold
 * @returns {Uint8Array} - Packed 1-bit image buffer (15,000 bytes)
 */
export const processImageForScreen = (img, canvas, dither = true) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = DISPLAY_WIDTH;
  canvas.height = DISPLAY_HEIGHT;

  // Fill with white background first (E-ink default)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

  // Calculate scaling to 'cover' or 'contain'
  // Let's use 'contain' so nothing is cut off for badges
  const scale = Math.min(DISPLAY_WIDTH / img.width, DISPLAY_HEIGHT / img.height);
  const x = (DISPLAY_WIDTH / 2) - (img.width / 2) * scale;
  const y = (DISPLAY_HEIGHT / 2) - (img.height / 2) * scale;
  
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

  const imageData = ctx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  const data = imageData.data;

  // Convert to Grayscale
  const grayscale = new Float32Array(DISPLAY_WIDTH * DISPLAY_HEIGHT);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    grayscale[i / 4] = lum;
  }

  // Dithering or Threshold
  const resultData = new Uint8ClampedArray(data.length);
  const threshold = 128;

  for (let y = 0; y < DISPLAY_HEIGHT; y++) {
    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      const idx = y * DISPLAY_WIDTH + x;
      const oldPixel = grayscale[idx];
      let newPixel = oldPixel < threshold ? 0 : 255;
      
      if (!dither) {
        newPixel = oldPixel < threshold ? 0 : 255;
      } else {
        // Floyd-Steinberg error diffusion
        const err = oldPixel - newPixel;
        grayscale[idx] = newPixel;
        
        if (x + 1 < DISPLAY_WIDTH) {
          grayscale[idx + 1] += err * 7 / 16;
        }
        if (x - 1 >= 0 && y + 1 < DISPLAY_HEIGHT) {
          grayscale[idx - 1 + DISPLAY_WIDTH] += err * 3 / 16;
        }
        if (y + 1 < DISPLAY_HEIGHT) {
          grayscale[idx + DISPLAY_WIDTH] += err * 5 / 16;
        }
        if (x + 1 < DISPLAY_WIDTH && y + 1 < DISPLAY_HEIGHT) {
          grayscale[idx + 1 + DISPLAY_WIDTH] += err * 1 / 16;
        }
      }
      
      const pixelIdx = idx * 4;
      resultData[pixelIdx] = newPixel;     // R
      resultData[pixelIdx + 1] = newPixel; // G
      resultData[pixelIdx + 2] = newPixel; // B
      resultData[pixelIdx + 3] = 255;      // A
    }
  }

  // Draw the processed dithered image back to canvas for preview
  const outImageData = new ImageData(resultData, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  ctx.putImageData(outImageData, 0, 0);

  // Pack into 1-bit byte array
  // 1 = White, 0 = Black. 8 pixels per byte. MSB is the leftmost pixel.
  const bytesPerRow = DISPLAY_WIDTH / 8; // 50 bytes
  const buffer = new Uint8Array(bytesPerRow * DISPLAY_HEIGHT); // 15,000 bytes

  for (let y = 0; y < DISPLAY_HEIGHT; y++) {
    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      const pixelValue = resultData[(y * DISPLAY_WIDTH + x) * 4]; // 0 or 255
      // Bit logic: if 255 (white), we want a 1. If 0 (black), we want a 0.
      const bit = pixelValue > 128 ? 1 : 0;
      
      const byteIdx = (y * bytesPerRow) + Math.floor(x / 8);
      const bitPos = 7 - (x % 8); // MSB first
      
      if (bit === 1) {
        buffer[byteIdx] |= (1 << bitPos);
      }
    }
  }

  return buffer;
};
