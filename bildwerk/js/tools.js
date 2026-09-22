/* Bildwerk – Werkzeuge und Zeigerinteraktion. */
import {
  state, page, activeLayer, setActiveLayer, addLayer, createLayer, makeCanvas,
  beginPixelEdit, commit, notify, say, docToLayer, layerCorners, layerMatrix,
  defaultText, rasterizeText, rasterizeShape, hitLayer, layerBBox, renderPage,
} from './core.js';
import { floodFill, rgbToHex } from './filters.js';

export const TOOLS = [
  { id: 'move',    icon: '✥', label: 'Verschieben / Transformieren (V)' },
  { id: 'select',  icon: '▭', label: 'Rechteckauswahl (M)' },
  { id: 'crop',    icon: '⌗', label: 'Zuschneiden (C)' },
  { id: 'brush',   icon: '✎', label: 'Pinsel (B)' },
  { id: 'eraser',  icon: '⌫', label: 'Radierer (E)' },
  { id: 'bucket',  icon: '◍', label: 'Farbeimer (G)' },
  { id: 'eyedrop', icon: '⚲', label: 'Pipette (I)' },
  { id: 'text',    icon: 'T', label: 'Text (T)' },
  { id: 'rect',    icon: '▢', label: 'Rechteck (U)' },
  { id: 'ellipse', icon: '◯', label: 'Ellipse' },
  { id: 'line',    icon: '╱', label: 'Linie' },
  { id: 'hand',    icon: '✋', label: 'Ansicht verschieben (Leertaste)' },
];

export const opts = {
  size: 28, hardness: 0.7, flow: 1,
  tolerance: 32,
  strokeWidth: 4, fillShape: true, radius: 0,
  fontSize: 64,
};

let drag = null;        // laufende Interaktion
let cropRect = null;    // Vorschau beim Zuschneiden

/* Griffe und Auswahlrahmen folgen der Akzentfarbe des Stylesheets,
   damit ein Farbwechsel im Theme nur an einer Stelle noetig ist. */
const akzent = () => getComputedStyle(document.documentElement)
  .getPropertyValue('--accent').trim() || '#ede813';

export const getCropRect = () => cropRect;
export const clearCrop = () => { cropRect = null; };

/* ---------------- Pinselstempel ---------------- */

function stamp(size, hardness, color) {
  const r = Math.max(0.5, size / 2);
  const c = makeCanvas(Math.ceil(r * 2) + 2, Math.ceil(r * 2) + 2);
  const ctx = c.getContext('2d');
  const cx = c.width / 2, cy = c.height / 2;
  if (hardness >= 0.995) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  } else {
    const g = ctx.createRadialGradient(cx, cy, r * hardness, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, color.length === 7 ? color + '00' : 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

function paintSegment(ctx, from, to, brush, erase, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(1, brush.width * 0.14);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= n; i++) {
    const x = from.x + (dx * i) / n, y = from.y + (dy * i) / n;
    ctx.drawImage(brush, x - brush.width / 2, y - brush.height / 2);
  }
  ctx.restore();
}

/* ---------------- Transformationsgriffe ---------------- */

export function handlesFor(layer) {
  if (!layer) return null;
  const c = layerCorners(layer);
  const mTop = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 };
  const center = { x: (c[0].x + c[2].x) / 2, y: (c[0].y + c[2].y) / 2 };
  let nx = mTop.x - center.x, ny = mTop.y - center.y;
  const len = Math.hypot(nx, ny) || 1;
  const off = 26 / state.zoom;
  return {
    corners: c,
    center,
    rotate: { x: mTop.x + (nx / len) * off, y: mTop.y + (ny / len) * off },
  };
}

function hitHandle(layer, p) {
  const h = handlesFor(layer);
  if (!h) return null;
  const tol = 9 / state.zoom;
  const near = (a) => Math.hypot(a.x - p.x, a.y - p.y) <= tol;
  if (near(h.rotate)) return { kind: 'rotate' };
  for (let i = 0; i < 4; i++) if (near(h.corners[i])) return { kind: 'scale', corner: i };
  return null;
}

function rot(v, a) {
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
}

/* Skaliert die Ebene so, dass die gegenüberliegende Ecke ortsfest bleibt. */
function applyScale(layer, cornerIdx, p, proportional) {
  const w = layer.canvas.width, h = layer.canvas.height;
  const anchorIdx = (cornerIdx + 2) % 4;
  const local = [[0, 0], [w, 0], [w, h], [0, h]];
  const [ax, ay] = local[anchorIdx];
  const A = drag.anchorDoc;
  const v = rot({ x: p.x - A.x, y: p.y - A.y }, -layer.rot);
  const dirX = ax === 0 ? 1 : -1, dirY = ay === 0 ? 1 : -1;
  let sx = (v.x * dirX) / w, sy = (v.y * dirY) / h;
  const min = 2 / Math.max(w, h);
  if (proportional) {
    const s = Math.max(Math.abs(sx), Math.abs(sy));
    sx = Math.sign(sx || 1) * s; sy = Math.sign(sy || 1) * s;
  }
  sx = Math.abs(sx) < min ? min * Math.sign(sx || 1) : sx;
  sy = Math.abs(sy) < min ? min * Math.sign(sy || 1) : sy;
  layer.sx = sx; layer.sy = sy;
  const off = rot({ x: (w / 2 - ax) * sx, y: (h / 2 - ay) * sy }, layer.rot);
  const cx = A.x + off.x, cy = A.y + off.y;
  layer.x = cx - (w * sx) / 2;
  layer.y = cy - (h * sy) / 2;
}

/* ---------------- Ebenen-Hilfen ---------------- */

function topLayerAt(p) {
  const ls = page().layers;
  for (let i = ls.length - 1; i >= 0; i--) {
    const l = ls[i];
    if (!l.visible) continue;
    if (!hitLayer(l, p.x, p.y)) continue;
    const lp = docToLayer(l, p.x, p.y);
    const ctx = l.canvas.getContext('2d', { willReadFrequently: true });
    const a = ctx.getImageData(Math.floor(lp.x), Math.floor(lp.y), 1, 1).data[3];
    if (a > 8) return l;
  }
  return null;
}

/** Liefert eine bemalbare Rasterebene – legt bei Bedarf eine neue an. */
function paintTarget() {
  let l = activeLayer();
  if (!l || l.type !== 'raster') {
    const p = page();
    l = addLayer(createLayer({ name: 'Ebene ' + (p.layers.length + 1), w: p.width, h: p.height }));
    say('Neue Rasterebene angelegt');
  }
  return l;
}

function brushScale(layer) {
  return (Math.abs(layer.sx) + Math.abs(layer.sy)) / 2 || 1;
}

/* ---------------- Zeigerereignisse ---------------- */

export function pointerDown(p, ev) {
  const t = state.tool;
  const P = page();
  if (!P) return;

  if (t === 'eyedrop') {
    const c = makeCanvas(P.width, P.height);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    renderPage(P, ctx, { scale: 1 });
    const x = Math.min(P.width - 1, Math.max(0, Math.floor(p.x)));
    const y = Math.min(P.height - 1, Math.max(0, Math.floor(p.y)));
    const d = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(d[0], d[1], d[2]);
    if (ev.altKey) state.bg = hex; else state.fg = hex;
    if (!state.recentColors.includes(hex)) state.recentColors.unshift(hex);
    state.recentColors.length = Math.min(state.recentColors.length, 12);
    say('Farbe aufgenommen: ' + hex);
    notify();
    return;
  }

  if (t === 'select' || t === 'crop') {
    commit(t === 'crop' ? 'Zuschneiden' : 'Auswahl');
    drag = { mode: t, start: p };
    if (t === 'select') state.selection = { x: p.x, y: p.y, w: 0, h: 0 };
    else cropRect = { x: p.x, y: p.y, w: 0, h: 0 };
    notify();
    return;
  }

  if (t === 'brush' || t === 'eraser') {
    commit(t === 'brush' ? 'Pinsel' : 'Radierer');
    const layer = paintTarget();
    const ctx = beginPixelEdit(layer);
    const s = brushScale(layer);
    const color = ev.altKey ? state.bg : state.fg;
    const brush = stamp(opts.size / s, opts.hardness, t === 'eraser' ? '#000000' : color);
    const lp = docToLayer(layer, p.x, p.y);
    paintSegment(ctx, lp, lp, brush, t === 'eraser', opts.flow);
    drag = { mode: 'paint', layer, ctx, brush, last: lp, erase: t === 'eraser' };
    notify();
    return;
  }

  if (t === 'bucket') {
    const layer = paintTarget();
    commit('Füllen');
    const ctx = beginPixelEdit(layer);
    const lp = docToLayer(layer, p.x, p.y);
    if (state.selection) {
      // Nur innerhalb der Auswahl füllen
      const sel = state.selection;
      ctx.save();
      ctx.beginPath();
      const inv = layerMatrix(layer).inverse();
      const pts = [[sel.x, sel.y], [sel.x + sel.w, sel.y], [sel.x + sel.w, sel.y + sel.h], [sel.x, sel.y + sel.h]]
        .map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)));
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(q => ctx.lineTo(q.x, q.y));
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = ev.altKey ? state.bg : state.fg;
      ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
      ctx.restore();
    } else {
      floodFill(layer.canvas, lp.x, lp.y, ev.altKey ? state.bg : state.fg, opts.tolerance);
    }
    notify();
    return;
  }

  if (t === 'text') {
    const hit = topLayerAt(p);
    if (hit && hit.type === 'text') { setActiveLayer(hit.id); notify(); return; }
    commit('Text');
    const text = defaultText('Neuer Text');
    text.size = opts.fontSize;
    text.color = state.fg;
    const layer = createLayer({ name: 'Text', type: 'text', text });
    rasterizeText(layer);
    layer.x = p.x - 10; layer.y = p.y - layer.canvas.height / 2;
    addLayer(layer);
    say('Textebene angelegt – Inhalt rechts im Schrift-Panel bearbeiten');
    notify();
    return;
  }

  if (t === 'rect' || t === 'ellipse' || t === 'line') {
    commit('Form');
    const shape = {
      kind: t, w: 1, h: 1,
      fill: opts.fillShape ? state.fg : 'none',
      stroke: state.bg,
      strokeWidth: t === 'line' ? Math.max(1, opts.strokeWidth) : (opts.fillShape ? 0 : Math.max(1, opts.strokeWidth)),
      radius: opts.radius,
    };
    if (t === 'line') shape.stroke = state.fg;
    const layer = createLayer({ name: t === 'line' ? 'Linie' : t === 'rect' ? 'Rechteck' : 'Ellipse', type: 'shape', shape });
    layer.x = p.x; layer.y = p.y;
    rasterizeShape(layer);
    addLayer(layer);
    drag = { mode: 'shape', layer, start: p };
    notify();
    return;
  }

  if (t === 'move') {
    const act = activeLayer();
    const handle = act ? hitHandle(act, p) : null;
    if (handle) {
      commit('Transformieren');
      const c = layerCorners(act);
      drag = {
        mode: handle.kind, layer: act, start: p, corner: handle.corner,
        anchorDoc: handle.kind === 'scale' ? c[(handle.corner + 2) % 4] : null,
        startRot: act.rot,
        startAngle: Math.atan2(p.y - handlesFor(act).center.y, p.x - handlesFor(act).center.x),
        center: handlesFor(act).center,
      };
      return;
    }
    const hit = (act && hitLayer(act, p.x, p.y) && topLayerAt(p) === act) ? act : topLayerAt(p);
    if (!hit) { state.selection = null; notify(); return; }
    setActiveLayer(hit.id);
    commit('Verschieben');
    drag = { mode: 'move', layer: hit, start: p, ox: hit.x, oy: hit.y };
    notify();
  }
}

export function pointerMove(p, ev) {
  if (!drag) return;
  const l = drag.layer;
  switch (drag.mode) {
    case 'paint': {
      const lp = docToLayer(l, p.x, p.y);
      paintSegment(drag.ctx, drag.last, lp, drag.brush, drag.erase, opts.flow);
      drag.last = lp;
      break;
    }
    case 'move': {
      let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      l.x = drag.ox + dx; l.y = drag.oy + dy;
      break;
    }
    case 'scale':
      applyScale(l, drag.corner, p, ev.shiftKey);
      break;
    case 'rotate': {
      const a = Math.atan2(p.y - drag.center.y, p.x - drag.center.x);
      let r = drag.startRot + (a - drag.startAngle);
      if (ev.shiftKey) r = Math.round(r / (Math.PI / 12)) * (Math.PI / 12);
      const w = l.canvas.width, h = l.canvas.height;
      const c = { x: l.x + (w * l.sx) / 2, y: l.y + (h * l.sy) / 2 };
      l.rot = r;
      l.x = c.x - (w * l.sx) / 2; l.y = c.y - (h * l.sy) / 2;
      break;
    }
    case 'select':
    case 'crop': {
      const r = normRect(drag.start, p, ev.shiftKey);
      if (drag.mode === 'select') state.selection = r; else cropRect = r;
      break;
    }
    case 'shape': {
      const s = l.shape;
      if (s.kind === 'line') {
        s.w = p.x - drag.start.x; s.h = p.y - drag.start.y;
        const pad = Math.ceil(s.strokeWidth) + 2;
        l.x = Math.min(drag.start.x, p.x) - pad;
        l.y = Math.min(drag.start.y, p.y) - pad;
      } else {
        const r = normRect(drag.start, p, ev.shiftKey);
        s.w = Math.max(1, r.w); s.h = Math.max(1, r.h);
        const pad = Math.ceil(s.strokeWidth) + 2;
        l.x = r.x - pad; l.y = r.y - pad;
      }
      rasterizeShape(l);
      break;
    }
  }
  notify();
}

export function pointerUp() {
  if (!drag) return;
  if (drag.mode === 'select' && state.selection && (state.selection.w < 2 || state.selection.h < 2))
    state.selection = null;
  if (drag.mode === 'shape') say('Form erstellt – Größe und Farbe bleiben über die Ebene änderbar');
  drag = null;
  notify();
}

export const isDragging = () => !!drag;

function normRect(a, b, square) {
  let w = b.x - a.x, h = b.y - a.y;
  if (square) { const s = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * s; h = Math.sign(h || 1) * s; }
  return { x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + h), w: Math.abs(w), h: Math.abs(h) };
}

/* ---------------- Overlay (Griffe, Auswahl) ---------------- */

export function drawOverlay(ctx) {
  const z = state.zoom;
  const P = page();
  if (!P) return;
  ctx.setTransform(z, 0, 0, z, 0, 0);
  ctx.clearRect(0, 0, P.width, P.height);
  ctx.lineWidth = 1 / z;

  const dash = (r, color) => {
    ctx.save();
    ctx.strokeStyle = '#000'; ctx.setLineDash([5 / z, 4 / z]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = color; ctx.lineDashOffset = 5 / z;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  };

  if (state.selection) dash(state.selection, '#ffffff');
  if (cropRect && cropRect.w > 1) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    ctx.rect(0, 0, P.width, P.height);
    ctx.rect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.fill('evenodd');
    ctx.restore();
    dash(cropRect, akzent());
  }

  const l = activeLayer();
  if (l && (state.tool === 'move')) {
    const h = handlesFor(l);
    ctx.save();
    ctx.strokeStyle = akzent();
    ctx.lineWidth = 1.4 / z;
    ctx.beginPath();
    ctx.moveTo(h.corners[0].x, h.corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(h.corners[i].x, h.corners[i].y);
    ctx.closePath();
    ctx.stroke();

    const mTop = { x: (h.corners[0].x + h.corners[1].x) / 2, y: (h.corners[0].y + h.corners[1].y) / 2 };
    ctx.beginPath(); ctx.moveTo(mTop.x, mTop.y); ctx.lineTo(h.rotate.x, h.rotate.y); ctx.stroke();

    const r = 4.5 / z;
    ctx.fillStyle = akzent();
    for (const c of h.corners) {
      ctx.beginPath(); ctx.rect(c.x - r, c.y - r, r * 2, r * 2); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(h.rotate.x, h.rotate.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

export { layerBBox };
