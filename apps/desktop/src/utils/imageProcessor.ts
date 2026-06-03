export type DitheringMode =
  | "threshold"
  | "floyd-steinberg"
  | "halftone"
  | "grayscale";

/** Loads an image file into an HTMLImageElement */
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Draws image to offscreen canvas and returns ImageData */
function getImageData(img: HTMLImageElement): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: id.data, width: canvas.width, height: canvas.height };
}

/** Floyd-Steinberg error diffusion dithering */
function floydSteinberg(
  data: Float32Array,
  w: number,
  h: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = data[i];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const old = gray[idx];
      const newV = old < 128 ? 0 : 255;
      const err = old - newV;
      gray[idx] = newV;
      if (x + 1 < w) gray[idx + 1] += (err * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) gray[idx + w - 1] += (err * 3) / 16;
        gray[idx + w] += (err * 5) / 16;
        if (x + 1 < w) gray[idx + w + 1] += (err * 1) / 16;
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, gray[i]));
    out[i * 4 + 0] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Simple threshold (bilevel) */
function threshold(
  data: Float32Array,
  w: number,
  h: number,
  level = 128,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = data[i] >= level ? 255 : 0;
    out[i * 4 + 0] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Grayscale only */
function grayscaleOnly(
  data: Float32Array,
  w: number,
  h: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, data[i]));
    out[i * 4 + 0] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Ordered dither (4x4 Bayer halftone) */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function halftone(data: Float32Array, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const threshold2 = (BAYER[y % 4][x % 4] / 16) * 255;
      const v = data[i] > threshold2 ? 255 : 0;
      out[i * 4 + 0] = v;
      out[i * 4 + 1] = v;
      out[i * 4 + 2] = v;
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

/** Process a file and return a data URL with the dithered result */
export async function processImageForLaser(
  file: File,
  mode: DitheringMode,
  thresholdLevel = 128,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(file);
  const { data, width, height } = getImageData(img);

  // Convert to float grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  let result: Uint8ClampedArray;
  switch (mode) {
    case "floyd-steinberg":
      result = floydSteinberg(gray, width, height);
      break;
    case "halftone":
      result = halftone(gray, width, height);
      break;
    case "grayscale":
      result = grayscaleOnly(gray, width, height);
      break;
    default:
      result = threshold(gray, width, height, thresholdLevel);
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d")!;
  const imageData = outCtx.createImageData(width, height);
  imageData.data.set(result);
  outCtx.putImageData(imageData, 0, 0);

  return { dataUrl: outCanvas.toDataURL("image/png"), width, height };
}
