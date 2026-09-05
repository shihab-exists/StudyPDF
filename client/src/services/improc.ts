/**
 * Canvas image-enhancement pipeline (pure JS, mirrors the classic scanner
 * cleanup steps): deskew → denoise → contrast → readability → sharpen.
 */

export interface EnhanceOpts {
  deskew: boolean;
  denoise: boolean;
  contrast: boolean;
  sharpen: boolean;
  readability: boolean;
}

function gray(d: Uint8ClampedArray, i: number): number {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

/** Estimates the skew angle (deg, −4..4, step 0.5) that maximises row-profile sharpness. */
export function estimateSkew(src: HTMLCanvasElement): number {
  const small = document.createElement('canvas');
  const s = Math.min(1, 260 / src.width);
  small.width = Math.max(8, Math.round(src.width * s));
  small.height = Math.max(8, Math.round(src.height * s));
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  let best = 0;
  let bestScore = -1;
  for (let a = -4; a <= 4.001; a += 0.5) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, small.width, small.height);
    ctx.translate(small.width / 2, small.height / 2);
    ctx.rotate((a * Math.PI) / 180);
    ctx.drawImage(src, (-src.width / 2) * s, (-src.height / 2) * s, src.width * s, src.height * s);
    ctx.restore();
    const d = ctx.getImageData(0, 0, small.width, small.height).data;
    const rows = new Float64Array(small.height);
    for (let y = 0; y < small.height; y++) {
      let sum = 0;
      for (let x = 0; x < small.width; x++) sum += 255 - gray(d, (y * small.width + x) * 4);
      rows[y] = sum;
    }
    let score = 0;
    for (let y = 0; y < small.height; y++) score += rows[y] * rows[y];
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

function rotateCanvas(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  if (!deg) return src;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const out = document.createElement('canvas');
  out.width = Math.ceil(src.width * cos + src.height * sin);
  out.height = Math.ceil(src.width * sin + src.height * cos);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/** 3×3 median filter (per channel) — kills speckle noise. */
function denoise(img: ImageData): ImageData {
  const { width: w, height: h, data } = img;
  const out = new ImageData(w, h);
  const win = new Uint8Array(9);
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            win[n++] = data[(yy * w + xx) * 4 + c];
          }
        }
        win.subarray(0, 9).sort();
        out.data[(y * w + x) * 4 + c] = win[4];
      }
    }
  }
  for (let i = 3; i < data.length; i += 4) out.data[i] = 255;
  return out;
}

/** 2–98 percentile stretch (per channel), optionally grayscale first. */
function stretch(img: ImageData, toGray: boolean, sigmoid: boolean): ImageData {
  const d = img.data;
  if (toGray) {
    for (let i = 0; i < d.length; i += 4) {
      const v = gray(d, i);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  const total = d.length / 4;
  const lo = percentile(hist, total, 0.02);
  const hi = percentile(hist, total, 0.98);
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = ((d[i + c] - lo) / range) * 255;
      if (sigmoid) {
        const t = v / 255;
        v = 255 * (1 / (1 + Math.exp(-3 * (t - 0.5)) - 0.0067)) ;
        v = Math.min(255, Math.max(0, v));
      }
      d[i + c] = v;
    }
  }
  return img;
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = total * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

/** Unsharp mask: img + amount·(img − blur). */
function unsharp(img: ImageData, amount = 0.7): ImageData {
  const { width: w, height: h, data } = img;
  const blur = new Uint8ClampedArray(data.length);
  // separable 3-tap box blur (radius 1)
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4 + c;
        const l = data[(y * w + Math.max(0, x - 1)) * 4 + c];
        const r = data[(y * w + Math.min(w - 1, x + 1)) * 4 + c];
        blur[i] = (l + data[i] + r) / 3;
      }
    }
  }
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.min(255, Math.max(0, data[i + c] + amount * (data[i + c] - blur[i + c])));
    }
  }
  return img;
}

/** Runs the enabled enhancement steps on a rendered page canvas. */
export function enhanceCanvas(src: HTMLCanvasElement, opts: EnhanceOpts): HTMLCanvasElement {
  let canvas = src;
  if (opts.deskew) {
    const angle = estimateSkew(canvas);
    if (Math.abs(angle) >= 0.5) canvas = rotateCanvas(canvas, angle);
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (opts.denoise) img = denoise(img);
  if (opts.readability) img = stretch(img, true, true);
  else if (opts.contrast) img = stretch(img, false, false);
  if (opts.sharpen) img = unsharp(img, 0.7);
  ctx.putImageData(img, 0, 0);
  return canvas;
}
