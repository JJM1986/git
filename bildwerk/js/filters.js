/* Bildwerk – Pixeloperationen (einrechnende Filter). */
import { makeCanvas, filterString, defaultAdjust } from './core.js';

const px = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
const put = (c, d) => { c.getContext('2d').putImageData(d, 0, 0); return c; };
const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;

/** Nicht-destruktive Anpassungen dauerhaft ins Pixelbild schreiben.
 *  Liefert immer dieselbe Form, damit die Aufrufer nicht zwei Faelle
 *  unterscheiden muessen: { canvas, offset, adjust, veraendert }. */
export function bakeAdjust(canvas, adjust) {
  const f = filterString(adjust);
  if (f === 'none')
    return { canvas, offset: 0, adjust: defaultAdjust(), veraendert: false };
  const pad = Math.ceil((adjust.blur || 0) * 3);
  const out = makeCanvas(canvas.width + pad * 2, canvas.height + pad * 2);
  const ctx = out.getContext('2d');
  ctx.filter = f;
  ctx.drawImage(canvas, pad, pad);
  return { canvas: out, offset: pad, adjust: defaultAdjust(), veraendert: true };
}

export function convolve(canvas, kernel, divisor = 1, offset = 0) {
  const k = Math.round(Math.sqrt(kernel.length));
  const half = (k - 1) / 2;
  const src = px(canvas), w = canvas.width, h = canvas.height;
  const out = new ImageData(w, h);
  const s = src.data, d = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = 0; ky < k; ky++) {
        for (let kx = 0; kx < k; kx++) {
          const sy = Math.min(h - 1, Math.max(0, y + ky - half));
          const sx = Math.min(w - 1, Math.max(0, x + kx - half));
          const i = (sy * w + sx) * 4, kv = kernel[ky * k + kx];
          r += s[i] * kv; g += s[i + 1] * kv; b += s[i + 2] * kv;
        }
      }
      const o = (y * w + x) * 4;
      d[o] = clamp(r / divisor + offset);
      d[o + 1] = clamp(g / divisor + offset);
      d[o + 2] = clamp(b / divisor + offset);
      d[o + 3] = s[o + 3];
    }
  }
  return put(makeCanvas(w, h), out);
}

export const sharpen = (c) => convolve(c, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
export const edges   = (c) => convolve(c, [-1, -1, -1, -1, 8, -1, -1, -1, -1], 1, 0);
export const emboss  = (c) => convolve(c, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 1, 0);
export const softBlur= (c) => convolve(c, [1, 2, 1, 2, 4, 2, 1, 2, 1], 16);

export function pixelate(canvas, size = 12) {
  const w = canvas.width, h = canvas.height;
  const small = makeCanvas(Math.max(1, w / size), Math.max(1, h / size));
  const sc = small.getContext('2d');
  sc.imageSmoothingEnabled = true;
  sc.drawImage(canvas, 0, 0, small.width, small.height);
  const out = makeCanvas(w, h);
  const oc = out.getContext('2d');
  oc.imageSmoothingEnabled = false;
  oc.drawImage(small, 0, 0, w, h);
  return out;
}

export function noise(canvas, amount = 20) {
  const d = px(canvas), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const n = (Math.random() - 0.5) * amount * 2;
    a[i] = clamp(a[i] + n); a[i + 1] = clamp(a[i + 1] + n); a[i + 2] = clamp(a[i + 2] + n);
  }
  return put(makeCanvas(canvas.width, canvas.height), d);
}

export function posterize(canvas, levels = 5) {
  const d = px(canvas), a = d.data;
  const step = 255 / Math.max(1, levels - 1);
  for (let i = 0; i < a.length; i += 4)
    for (let k = 0; k < 3; k++) a[i + k] = clamp(Math.round(a[i + k] / step) * step);
  return put(makeCanvas(canvas.width, canvas.height), d);
}

export function threshold(canvas, level = 128) {
  const d = px(canvas), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const v = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114 >= level ? 255 : 0;
    a[i] = a[i + 1] = a[i + 2] = v;
  }
  return put(makeCanvas(canvas.width, canvas.height), d);
}

export function autoLevel(canvas) {
  const d = px(canvas), a = d.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 8) continue;
    const l = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
    if (l < lo) lo = l; if (l > hi) hi = l;
  }
  if (hi - lo < 1) return canvas;
  const scale = 255 / (hi - lo);
  for (let i = 0; i < a.length; i += 4)
    for (let k = 0; k < 3; k++) a[i + k] = clamp((a[i + k] - lo) * scale);
  return put(makeCanvas(canvas.width, canvas.height), d);
}

export function vignette(canvas, strength = 0.75) {
  const out = makeCanvas(canvas.width, canvas.height);
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const w = canvas.width, h = canvas.height;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return out;
}

export function flip(canvas, horizontal = true) {
  const out = makeCanvas(canvas.width, canvas.height);
  const ctx = out.getContext('2d');
  ctx.translate(horizontal ? canvas.width : 0, horizontal ? 0 : canvas.height);
  ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

export function rotate90(canvas) {
  const out = makeCanvas(canvas.height, canvas.width);
  const ctx = out.getContext('2d');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

/** Farbeimer mit Toleranz; arbeitet direkt auf dem übergebenen Canvas. */
export function floodFill(canvas, sx, sy, hex, tolerance = 32) {
  const w = canvas.width, h = canvas.height;
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const a = img.data;
  const start = (sy * w + sx) * 4;
  const target = [a[start], a[start + 1], a[start + 2], a[start + 3]];
  const fill = hexToRgb(hex);
  if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === 255) return false;

  const tol = tolerance * tolerance * 4;
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  const match = (i) => {
    const o = i * 4;
    const dr = a[o] - target[0], dg = a[o + 1] - target[1], db = a[o + 2] - target[2], da = a[o + 3] - target[3];
    return dr * dr + dg * dg + db * db + da * da <= tol;
  };
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !match(i)) continue;
    seen[i] = 1;
    const o = i * 4;
    a[o] = fill[0]; a[o + 1] = fill[1]; a[o + 2] = fill[2]; a[o + 3] = 255;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  ctx.putImageData(img, 0, 0);
  return true;
}

export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
