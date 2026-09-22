/* Bildwerk – Kern: Dokumentmodell, Ebenen, Rendering, Historie.
   Alles läuft lokal im Browser; es verlässt kein Byte den Rechner. */

export const BLEND_MODES = [
  ['source-over', 'Normal'], ['multiply', 'Multiplizieren'], ['screen', 'Negativ multiplizieren'],
  ['overlay', 'Ineinanderkopieren'], ['darken', 'Abdunkeln'], ['lighten', 'Aufhellen'],
  ['color-dodge', 'Farbig abwedeln'], ['color-burn', 'Farbig nachbelichten'],
  ['hard-light', 'Hartes Licht'], ['soft-light', 'Weiches Licht'], ['difference', 'Differenz'],
  ['exclusion', 'Ausschluss'], ['hue', 'Farbton'], ['saturation', 'Sättigung'],
  ['color', 'Farbe'], ['luminosity', 'Luminanz'],
];

export const ADJUSTMENTS = [
  { key: 'brightness', label: 'Helligkeit', min: 0, max: 300, def: 100, unit: '%' },
  { key: 'contrast',   label: 'Kontrast',   min: 0, max: 300, def: 100, unit: '%' },
  { key: 'saturate',   label: 'Sättigung',  min: 0, max: 400, def: 100, unit: '%' },
  { key: 'hue',        label: 'Farbton',    min: -180, max: 180, def: 0, unit: '°' },
  { key: 'blur',       label: 'Weichzeichnen', min: 0, max: 60, def: 0, unit: 'px' },
  { key: 'sepia',      label: 'Sepia',      min: 0, max: 100, def: 0, unit: '%' },
  { key: 'grayscale',  label: 'Graustufen', min: 0, max: 100, def: 0, unit: '%' },
  { key: 'invert',     label: 'Invertieren',min: 0, max: 100, def: 0, unit: '%' },
];

/* Browser-Grenzen fuer Canvas. Darueber liefert Chrome leere Flaechen,
   statt einen Fehler zu melden - deshalb halten wir bewusst Abstand. */
export const MAX_EDGE = 16384;
export const MAX_AREA = 200e6;

/** Groesste erlaubte Vergroesserung, bei der die Buehne noch gezeichnet wird. */
export function maxZoomFor(p, hardLimit = 16) {
  if (!p) return hardLimit;
  return Math.max(0.02, Math.min(
    hardLimit,
    MAX_EDGE / p.width,
    MAX_EDGE / p.height,
    Math.sqrt(MAX_AREA / (p.width * p.height)),
  ));
}

/** Passt eine gewuenschte Canvasgroesse in die Browsergrenzen ein. */
export function fitCanvasSize(w, h) {
  let s = Math.min(1, MAX_EDGE / w, MAX_EDGE / h, Math.sqrt(MAX_AREA / (w * h)));
  if (!isFinite(s) || s <= 0) s = 1;
  return { w: Math.max(1, Math.floor(w * s)), h: Math.max(1, Math.floor(h * s)), scale: s };
}

let uid = 1;
export const newId = () => 'id' + (uid++);

export const state = {
  name: 'Unbenannt',
  pages: [],
  active: 0,
  zoom: 1,
  tool: 'move',
  fg: '#373639',   // EFCO Anthrazitgrau
  bg: '#ffffff',
  selection: null,       // {x,y,w,h} in Dokumentkoordinaten
  recentColors: ['#ede813', '#3d4d54', '#373639', '#54434a', '#565442', '#ffffff'],
  sourcePdfBytes: null,  // Original-PDF für den verlustarmen Export
  dirty: false,
};

/* ---------------- Hilfsfunktionen ---------------- */

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function cloneCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

export function defaultAdjust() {
  const a = {};
  for (const d of ADJUSTMENTS) a[d.key] = d.def;
  return a;
}

export function isAdjustNeutral(a) {
  return ADJUSTMENTS.every(d => Math.abs((a[d.key] ?? d.def) - d.def) < 0.001);
}

export function filterString(a) {
  if (!a || isAdjustNeutral(a)) return 'none';
  return [
    `brightness(${a.brightness}%)`,
    `contrast(${a.contrast}%)`,
    `saturate(${a.saturate}%)`,
    `hue-rotate(${a.hue}deg)`,
    a.blur > 0 ? `blur(${a.blur}px)` : '',
    a.sepia > 0 ? `sepia(${a.sepia}%)` : '',
    a.grayscale > 0 ? `grayscale(${a.grayscale}%)` : '',
    a.invert > 0 ? `invert(${a.invert}%)` : '',
  ].filter(Boolean).join(' ');
}

/* ---------------- Seiten & Ebenen ---------------- */

export function createPage(w = 1200, h = 800, bgColor = '#ffffff') {
  return {
    id: newId(),
    width: Math.round(w),
    height: Math.round(h),
    bgColor,
    layers: [],
    pdfSource: null, // {index} – Verweis auf Seite im Original-PDF
  };
}

export function createLayer(opts = {}) {
  return {
    id: newId(),
    name: opts.name || 'Ebene',
    type: opts.type || 'raster',   // raster | text | shape
    visible: true,
    opacity: 1,
    blend: 'source-over',
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    rot: 0,
    sx: 1,
    sy: 1,
    canvas: opts.canvas || makeCanvas(opts.w || 1, opts.h || 1),
    adjust: defaultAdjust(),
    text: opts.text || null,
    shape: opts.shape || null,
  };
}

export const page = () => state.pages[state.active];
export const layers = () => page()?.layers ?? [];

export function activeLayer() {
  const p = page();
  if (!p) return null;
  return p.layers.find(l => l.id === p.activeLayerId) || p.layers[p.layers.length - 1] || null;
}

export function setActiveLayer(id) {
  const p = page();
  if (p) p.activeLayerId = id;
}

export function addLayer(layer, { atTop = true } = {}) {
  const p = page();
  if (atTop) p.layers.push(layer); else p.layers.unshift(layer);
  p.activeLayerId = layer.id;
  return layer;
}

export function removeLayer(id) {
  const p = page();
  const i = p.layers.findIndex(l => l.id === id);
  if (i < 0) return;
  p.layers.splice(i, 1);
  const next = p.layers[Math.min(i, p.layers.length - 1)];
  p.activeLayerId = next ? next.id : null;
}

/* Kopie-bei-Schreibzugriff: vor jeder Pixeländerung aufrufen, damit
   ältere Historieneinträge ihr Canvas behalten. */
export function beginPixelEdit(layer) {
  layer.canvas = cloneCanvas(layer.canvas);
  return layer.canvas.getContext('2d');
}

/* ---------------- Transformationen ---------------- */

export function layerMatrix(layer) {
  const w = layer.canvas.width, h = layer.canvas.height;
  const cx = layer.x + (w * layer.sx) / 2;
  const cy = layer.y + (h * layer.sy) / 2;
  return new DOMMatrix()
    .translate(cx, cy)
    .rotate((layer.rot * 180) / Math.PI)
    .scale(layer.sx, layer.sy)
    .translate(-w / 2, -h / 2);
}

/** Dokumentpunkt -> Pixelkoordinate innerhalb des Ebenen-Canvas */
export function docToLayer(layer, px, py) {
  const inv = layerMatrix(layer).inverse();
  const p = inv.transformPoint(new DOMPoint(px, py));
  return { x: p.x, y: p.y };
}

export function layerToDoc(layer, lx, ly) {
  const p = layerMatrix(layer).transformPoint(new DOMPoint(lx, ly));
  return { x: p.x, y: p.y };
}

export function layerCorners(layer) {
  const w = layer.canvas.width, h = layer.canvas.height;
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => layerToDoc(layer, x, y));
}

export function layerBBox(layer) {
  const c = layerCorners(layer);
  const xs = c.map(p => p.x), ys = c.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function hitLayer(layer, px, py) {
  const p = docToLayer(layer, px, py);
  return p.x >= 0 && p.y >= 0 && p.x < layer.canvas.width && p.y < layer.canvas.height;
}

/** Umschliessender Rahmen mehrerer Ebenen, optional samt Leinwand. */
export function unionBounds(list, withPage = null) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of list) {
    const b = layerBBox(l);
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  if (withPage) {
    x0 = Math.min(x0, 0); y0 = Math.min(y0, 0);
    x1 = Math.max(x1, withPage.width); y1 = Math.max(y1, withPage.height);
  }
  if (!isFinite(x0)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
}

/* ---------------- Text & Formen rastern ---------------- */

export function defaultText(content = 'Text') {
  return {
    content,
    family: '"Panton", Arial, Helvetica, sans-serif',
    size: 64,
    weight: '400',
    italic: false,
    color: '#373639',
    stroke: '#ffffff',
    strokeWidth: 0,
    align: 'left',
    lineHeight: 1.2,
    spacing: 0,
  };
}

function fontOf(t) {
  return `${t.italic ? 'italic ' : ''}${t.weight} ${t.size}px ${t.family}`;
}

export function rasterizeText(layer) {
  const t = layer.text;
  const lines = String(t.content ?? '').split('\n');
  const probe = makeCanvas(8, 8).getContext('2d');
  probe.font = fontOf(t);
  const hasSpacingApi = 'letterSpacing' in probe;
  if (hasSpacingApi) probe.letterSpacing = `${t.spacing}px`;

  const widths = lines.map(line => {
    if (hasSpacingApi) return probe.measureText(line).width;
    let w = 0;
    for (const ch of line) w += probe.measureText(ch).width + t.spacing;
    return Math.max(0, w - (line.length ? t.spacing : 0));
  });

  const lineH = t.size * t.lineHeight;
  const pad = Math.ceil(t.size * 0.35 + t.strokeWidth * 2 + 4);
  const w = Math.ceil(Math.max(1, ...widths)) + pad * 2;
  const h = Math.ceil(lineH * lines.length) + pad * 2;

  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.font = fontOf(t);
  if (hasSpacingApi) ctx.letterSpacing = `${t.spacing}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  lines.forEach((line, i) => {
    const baseY = pad + lineH * i + t.size * 0.82;
    let x = pad;
    if (t.align === 'center') x = pad + (w - pad * 2 - widths[i]) / 2;
    if (t.align === 'right') x = pad + (w - pad * 2 - widths[i]);

    const draw = (fn) => {
      if (hasSpacingApi) { fn(line, x, baseY); return; }
      let cx = x;
      for (const ch of line) { fn(ch, cx, baseY); cx += ctx.measureText(ch).width + t.spacing; }
    };
    if (t.strokeWidth > 0) {
      ctx.strokeStyle = t.stroke;
      ctx.lineWidth = t.strokeWidth * 2;
      draw((s, px, py) => ctx.strokeText(s, px, py));
    }
    ctx.fillStyle = t.color;
    draw((s, px, py) => ctx.fillText(s, px, py));
  });

  layer.canvas = c;
  return c;
}

export function rasterizeShape(layer) {
  const s = layer.shape;
  const pad = Math.ceil(s.strokeWidth) + 2;
  const aw = Math.max(1, Math.abs(s.w)), ah = Math.max(1, Math.abs(s.h));
  const c = makeCanvas(aw + pad * 2, ah + pad * 2);
  const ctx = c.getContext('2d');
  ctx.translate(pad, pad);
  ctx.beginPath();
  if (s.kind === 'ellipse') {
    ctx.ellipse(aw / 2, ah / 2, aw / 2, ah / 2, 0, 0, Math.PI * 2);
  } else if (s.kind === 'line') {
    const x0 = s.w < 0 ? aw : 0, y0 = s.h < 0 ? ah : 0;
    ctx.moveTo(x0, y0);
    ctx.lineTo(aw - x0, ah - y0);
  } else {
    const r = Math.min(s.radius || 0, aw / 2, ah / 2);
    if (r > 0 && ctx.roundRect) ctx.roundRect(0, 0, aw, ah, r);
    else ctx.rect(0, 0, aw, ah);
  }
  if (s.kind !== 'line' && s.fill !== 'none') { ctx.fillStyle = s.fill; ctx.fill(); }
  if (s.strokeWidth > 0) {
    ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth;
    ctx.lineCap = 'round'; ctx.stroke();
  }
  layer.canvas = c;
  return c;
}

export function refreshLayer(layer) {
  if (layer.type === 'text') rasterizeText(layer);
  else if (layer.type === 'shape') rasterizeShape(layer);
}

/* ---------------- Rendering ---------------- */

export function drawLayer(ctx, layer) {
  if (!layer.visible || layer.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = layer.blend;
  ctx.filter = filterString(layer.adjust);
  const m = layerMatrix(layer);
  ctx.setTransform(new DOMMatrix(ctx.getTransform()).multiply(m));
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}

/** Seite auf einen Kontext zeichnen. scale=1 entspricht 1:1. */
export function renderPage(p, ctx, { scale = 1, transparent = false } = {}) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, p.width, p.height);
  if (!transparent && p.bgColor) {
    ctx.fillStyle = p.bgColor;
    ctx.fillRect(0, 0, p.width, p.height);
  }
  for (const l of p.layers) drawLayer(ctx, l);
  ctx.restore();
}

/** Seite als eigenständiges Canvas (für Export, Miniaturen, PDF). */
export function pageToCanvas(p, scale = 1, transparent = false) {
  const c = makeCanvas(p.width * scale, p.height * scale);
  renderPage(p, c.getContext('2d'), { scale, transparent });
  return c;
}

/** Ebene mit allen Anpassungen flach in Dokumentkoordinaten rendern. */
export function flattenLayer(p, layer) {
  const c = makeCanvas(p.width, p.height);
  drawLayer(c.getContext('2d'), layer);
  return c;
}

/* ---------------- Historie ---------------- */

const history = { past: [], future: [], limit: 40 };

function snapPages() {
  return state.pages.map(p => ({
    ...p,
    layers: p.layers.map(l => ({
      ...l,
      adjust: { ...l.adjust },
      text: l.text ? { ...l.text } : null,
      shape: l.shape ? { ...l.shape } : null,
    })),
  }));
}

function snapshot() {
  return { pages: snapPages(), active: state.active, selection: state.selection ? { ...state.selection } : null };
}

function apply(sn) {
  state.pages = sn.pages.map(p => ({
    ...p,
    layers: p.layers.map(l => ({
      ...l,
      adjust: { ...l.adjust },
      text: l.text ? { ...l.text } : null,
      shape: l.shape ? { ...l.shape } : null,
    })),
  }));
  state.active = Math.min(sn.active, state.pages.length - 1);
  state.selection = sn.selection ? { ...sn.selection } : null;
}

/** Vor jeder Änderung aufrufen – sichert den aktuellen Stand. */
export function commit(label = '') {
  history.past.push({ ...snapshot(), label });
  if (history.past.length > history.limit) history.past.shift();
  history.future.length = 0;
  state.dirty = true;
}

export function undo() {
  if (!history.past.length) return false;
  history.future.push(snapshot());
  apply(history.past.pop());
  return true;
}

export function redo() {
  if (!history.future.length) return false;
  history.past.push(snapshot());
  apply(history.future.pop());
  return true;
}

export const canUndo = () => history.past.length > 0;
export const canRedo = () => history.future.length > 0;
export function resetHistory() { history.past.length = 0; history.future.length = 0; }

/* ---------------- Ereignisse ---------------- */

const listeners = { change: [], status: [] };
export function on(evt, fn) { (listeners[evt] ||= []).push(fn); }
export function emit(evt, arg) { (listeners[evt] || []).forEach(fn => fn(arg)); }
export const notify = () => emit('change');
export const say = (msg) => emit('status', msg);
