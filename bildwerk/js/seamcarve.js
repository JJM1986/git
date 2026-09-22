/* Bildwerk – Inhaltsbasiertes Skalieren (Seam Carving).
 *
 * Statt das Bild gleichmaessig zu stauchen, werden die unauffaelligsten
 * Pixelpfade ("Nahtlinien") entfernt bzw. verdoppelt. Motive bleiben dadurch
 * in Form, waehrend ruhige Flaechen wie Himmel oder Wand nachgeben.
 *
 * Zur Geschwindigkeit: Alle Daten liegen in festen Puffern mit konstanter
 * Zeilenlaenge (stride). Eine Naht wird nicht in neue Arrays umkopiert,
 * sondern mit copyWithin innerhalb des Puffers geschlossen - das erledigt
 * die JavaScript-Laufzeit nativ. Nur die logische Breite schrumpft.
 * Ausserdem wird die Energiekarte nach jeder Naht nur im betroffenen Band
 * aufgefrischt statt komplett neu berechnet.
 */
import { makeCanvas } from './core.js';

const MAX_PIXELS = 6e6;   // darueber wird es im Browser unzumutbar langsam
const BAND = 3;           // Spalten links und rechts der Naht, die neu bewertet werden

class Feld {
  constructor(canvas, kapazitaet) {
    const w = canvas.width, h = canvas.height;
    this.stride = Math.max(w, kapazitaet);
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(this.stride * h * 4);
    this.gray = new Float32Array(this.stride * h);
    this.energy = new Float32Array(this.stride * h);
    this.mask = null;

    const img = canvas.getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      this.data.set(img.subarray(y * w * 4, (y + 1) * w * 4), y * this.stride * 4);
    }
    this.berechneGrau();
    this.berechneEnergie(0, w - 1);
  }

  setzeMaske(rect) {
    this.mask = new Float32Array(this.stride * this.h);
    if (!rect) return;
    const x0 = Math.max(0, Math.floor(rect.x)), y0 = Math.max(0, Math.floor(rect.y));
    const x1 = Math.min(this.w, Math.ceil(rect.x + rect.w));
    const y1 = Math.min(this.h, Math.ceil(rect.y + rect.h));
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) this.mask[y * this.stride + x] = 1e5;
    this.berechneEnergie(0, this.w - 1);
  }

  berechneGrau() {
    const { data, gray, stride, w, h } = this;
    for (let y = 0; y < h; y++) {
      const row = y * stride;
      for (let x = 0; x < w; x++) {
        const p = (row + x) * 4;
        gray[row + x] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
      }
    }
  }

  /** Energie (Betrag des Helligkeitsgradienten) fuer die Spalten x0..x1. */
  berechneEnergie(x0, x1) {
    const { gray, energy, mask, stride, w, h } = this;
    x0 = Math.max(0, x0); x1 = Math.min(w - 1, x1);
    for (let y = 0; y < h; y++) {
      const row = y * stride;
      const oben = y > 0 ? row - stride : row;
      const unten = y < h - 1 ? row + stride : row;
      for (let x = x0; x <= x1; x++) {
        const links = gray[row + (x > 0 ? x - 1 : 0)];
        const rechts = gray[row + (x < w - 1 ? x + 1 : w - 1)];
        const e = Math.abs(rechts - links) + Math.abs(gray[unten + x] - gray[oben + x]);
        energy[row + x] = mask ? e + mask[row + x] : e;
      }
    }
  }

  /** Senkrechte Naht kleinster Gesamtenergie; liefert je Zeile eine Spalte. */
  findeNaht(M, from, seam) {
    const { energy, stride, w, h } = this;
    for (let x = 0; x < w; x++) M[x] = energy[x];
    for (let y = 1; y < h; y++) {
      const row = y * stride, prev = row - stride;
      for (let x = 0; x < w; x++) {
        let best = M[prev + x], dir = 0;
        if (x > 0) { const v = M[prev + x - 1]; if (v < best) { best = v; dir = -1; } }
        if (x < w - 1) { const v = M[prev + x + 1]; if (v < best) { best = v; dir = 1; } }
        M[row + x] = energy[row + x] + best;
        from[row + x] = dir;
      }
    }
    const last = (h - 1) * stride;
    let x = 0;
    for (let i = 1; i < w; i++) if (M[last + i] < M[last + x]) x = i;
    for (let y = h - 1; y >= 0; y--) {
      seam[y] = x;
      x += from[y * stride + x];
      if (x < 0) x = 0; else if (x > this.w - 1) x = this.w - 1;
    }
    return seam;
  }

  /** Naht herausnehmen: Zeilenrest nach links ruecken, Breite -1. */
  entferneNaht(seam) {
    const { data, gray, energy, mask, stride, w, h } = this;
    for (let y = 0; y < h; y++) {
      const row = y * stride, sx = seam[y];
      if (sx < w - 1) {
        data.copyWithin((row + sx) * 4, (row + sx + 1) * 4, (row + w) * 4);
        gray.copyWithin(row + sx, row + sx + 1, row + w);
        energy.copyWithin(row + sx, row + sx + 1, row + w);
        if (mask) mask.copyWithin(row + sx, row + sx + 1, row + w);
      }
    }
    this.w--;
    this.frischeAuf(seam);
  }

  /** Naht verdoppeln: Zeilenrest nach rechts ruecken, neues Pixel mitteln. */
  fuegeNahtEin(seam) {
    const { data, gray, energy, mask, stride, w, h } = this;
    if (w + 1 > stride) throw new Error('Puffer zu klein fuer weitere Nahtlinien');
    for (let y = 0; y < h; y++) {
      const row = y * stride, sx = seam[y];
      data.copyWithin((row + sx + 2) * 4, (row + sx + 1) * 4, (row + w) * 4);
      gray.copyWithin(row + sx + 2, row + sx + 1, row + w);
      energy.copyWithin(row + sx + 2, row + sx + 1, row + w);
      if (mask) mask.copyWithin(row + sx + 2, row + sx + 1, row + w);

      const a = (row + sx) * 4, neu = (row + sx + 1) * 4;
      const b = sx + 2 <= w ? (row + sx + 2) * 4 : a;
      for (let k = 0; k < 4; k++) data[neu + k] = (data[a + k] + data[b + k]) >> 1;
      gray[row + sx + 1] = (gray[row + sx] + gray[row + Math.min(w, sx + 2)]) / 2;
      // Eingefuegte Naehte verteuern, damit die naechste woanders verlaeuft
      if (mask) mask[row + sx + 1] = (mask[row + sx] || 0) + 150;
    }
    this.w++;
    this.frischeAuf(seam);
  }

  /** Energie rund um die veraenderte Naht neu bewerten. */
  frischeAuf(seam) {
    let min = this.w, max = 0;
    for (let y = 0; y < this.h; y++) {
      if (seam[y] < min) min = seam[y];
      if (seam[y] > max) max = seam[y];
    }
    this.berechneEnergie(min - BAND, max + BAND);
  }

  /** Aktuellen Stand als Canvas ausgeben. */
  zuCanvas() {
    const { data, stride, w, h } = this;
    const c = makeCanvas(w, h);
    const img = new ImageData(w, h);
    for (let y = 0; y < h; y++)
      img.data.set(data.subarray(y * stride * 4, y * stride * 4 + w * 4), y * w * 4);
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
  }
}

function transponiere(canvas) {
  const c = makeCanvas(canvas.height, canvas.width);
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.scale(1, -1);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

async function schnitzeAchse(canvas, anzahl, schutz, onProgress, basis, gesamt, signal) {
  if (anzahl === 0) return canvas;
  const entfernen = anzahl > 0;
  const schritte = Math.abs(anzahl);
  const feld = new Feld(canvas, entfernen ? canvas.width : canvas.width + schritte);
  if (schutz) feld.setzeMaske(schutz);

  const M = new Float32Array(feld.stride * feld.h);
  const from = new Int8Array(feld.stride * feld.h);
  const seam = new Int32Array(feld.h);

  for (let i = 0; i < schritte; i++) {
    feld.findeNaht(M, from, seam);
    if (entfernen) feld.entferneNaht(seam); else feld.fuegeNahtEin(seam);
    if ((i & 15) === 0) {
      if (signal?.aborted) throw new Error('abgebrochen');
      onProgress?.((basis + i) / gesamt);
      await new Promise(r => setTimeout(r, 0));   // Oberflaeche bedienbar halten
    }
  }
  return feld.zuCanvas();
}

/**
 * Inhaltsbasiert auf Zielgroesse bringen.
 * @param {HTMLCanvasElement} canvas Quellbild
 * @param {number} zielW Zielbreite in Pixeln
 * @param {number} zielH Zielhoehe in Pixeln
 * @param {object} opt { schutz:{x,y,w,h}|null, onProgress:fn(0..1), signal:AbortSignal }
 */
export async function contentAwareResize(canvas, zielW, zielH, opt = {}) {
  const { schutz = null, onProgress = null, signal = null } = opt;
  const w0 = canvas.width, h0 = canvas.height;
  zielW = Math.max(8, Math.round(zielW));
  zielH = Math.max(8, Math.round(zielH));
  if (w0 * h0 > MAX_PIXELS)
    throw new Error(`Die Ebene ist mit ${(w0 * h0 / 1e6).toFixed(1)} Megapixeln zu gross ` +
      `(Grenze ${MAX_PIXELS / 1e6} MP). Bitte vorher verkleinern.`);

  const dW = w0 - zielW, dH = h0 - zielH;
  const gesamt = Math.abs(dW) + Math.abs(dH) || 1;
  let bild = canvas;

  if (dW !== 0)
    bild = await schnitzeAchse(bild, dW, schutz, onProgress, 0, gesamt, signal);

  if (dH !== 0) {
    // Waagerechte Naehte: gedreht behandeln, danach zurueckdrehen
    const schutzT = schutz
      ? { x: schutz.y, y: schutz.x, w: schutz.h, h: schutz.w }
      : null;
    const gedreht = await schnitzeAchse(transponiere(bild), dH, schutzT,
      onProgress, Math.abs(dW), gesamt, signal);
    bild = transponiere(gedreht);
  }

  onProgress?.(1);
  return bild;
}

export const maxPixels = MAX_PIXELS;
