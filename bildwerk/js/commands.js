/* Bildwerk – Befehle aus Menü, Panels und Tastatur. */
import {
  state, page, layers, activeLayer, setActiveLayer, addLayer, removeLayer, createLayer,
  createPage, makeCanvas, cloneCanvas, pageToCanvas, flattenLayer, renderPage, commit, undo, redo,
  notify, say, defaultAdjust, defaultText, refreshLayer, resetHistory, beginPixelEdit, layerMatrix,
} from './core.js';
import * as F from './filters.js';
import * as PDF from './pdfio.js';
import { modal, info, fitZoom, setZoom, refreshFontSelect, setTool, renderAll } from './ui.js';
import { loadFontFile, serializeFonts, restoreFonts, customFonts } from './fonts.js';
import { opts, getCropRect, clearCrop } from './tools.js';

/* ---------------- Datei-Hilfen ---------------- */

function pickFile(accept, multiple = false) {
  return new Promise(resolve => {
    const inp = document.querySelector('#file-input');
    inp.value = '';
    inp.accept = accept;
    inp.multiple = multiple;
    inp.onchange = () => resolve(multiple ? [...inp.files] : inp.files[0] || null);
    inp.click();
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

async function fileToImage(file) {
  const url = URL.createObjectURL(file);
  try { return await loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}

function imageToCanvas(img) {
  const c = makeCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

/* ---------------- Dokument ---------------- */

export function newDocument(w, h, transparent) {
  state.pages = [createPage(w, h, transparent ? null : '#ffffff')];
  state.active = 0;
  state.selection = null;
  state.sourcePdfBytes = null;
  PDF.pdfSources.clear();
  resetHistory();
  const p = page();
  const base = createLayer({ name: 'Hintergrund', w: p.width, h: p.height });
  p.layers.push(base);
  p.activeLayerId = base.id;
  state.dirty = false;
  notify();
  fitZoom();
}

async function openImageAsDocument(file) {
  const img = await fileToImage(file);
  const c = imageToCanvas(img);
  state.pages = [createPage(c.width, c.height, null)];
  state.active = 0;
  state.name = file.name.replace(/\.[^.]+$/, '');
  PDF.pdfSources.clear();
  resetHistory();
  const p = page();
  const l = createLayer({ name: file.name, canvas: c });
  p.layers.push(l);
  p.activeLayerId = l.id;
  state.dirty = false;
  say(`${file.name} geöffnet (${c.width}×${c.height})`);
  notify();
  fitZoom();
}

async function placeImage(file) {
  const img = await fileToImage(file);
  const c = imageToCanvas(img);
  commit('Bild einfügen');
  const p = page();
  const l = createLayer({ name: file.name, canvas: c });
  const s = Math.min(1, p.width / c.width, p.height / c.height);
  l.sx = l.sy = s;
  l.x = (p.width - c.width * s) / 2;
  l.y = (p.height - c.height * s) / 2;
  addLayer(l);
  say(`${file.name} als Ebene eingefügt`);
  notify();
}

/** Datei, die auf das Fenster gezogen wurde: nach Typ einsortieren. */
export async function handleDroppedFile(file) {
  if (file.type === 'application/pdf') {
    say('PDF wird geladen …');
    await PDF.importPdf(await file.arrayBuffer(), { name: file.name, append: state.pages.length > 1 });
    resetHistory();
    fitZoom();
  } else if (/^image\//.test(file.type)) {
    if (state.pages.length === 1 && layers().length === 1 && !state.dirty)
      await openImageAsDocument(file);
    else
      await placeImage(file);
  } else if (/\.bildwerk$/i.test(file.name)) {
    await openProject(file);
  } else {
    say('Dateityp wird nicht unterstützt: ' + (file.type || file.name));
  }
}

/* ---------------- Ebenenoperationen ---------------- */

function ensureRaster(l) {
  if (l.type === 'raster') return;
  l.type = 'raster';
  l.text = null;
  l.shape = null;
}

function applyPixelOp(fn, label) {
  const l = activeLayer();
  if (!l) { say('Keine Ebene ausgewählt'); return; }
  commit(label);
  ensureRaster(l);
  l.canvas = fn(l.canvas);
  notify();
  say(label + ' angewendet');
}

function mergeDown() {
  const p = page();
  const l = activeLayer();
  const i = p.layers.indexOf(l);
  if (i < 1) { say('Darunter liegt keine Ebene'); return; }
  commit('Ebenen vereinen');
  const below = p.layers[i - 1];
  const c = makeCanvas(p.width, p.height);
  const ctx = c.getContext('2d');
  const tmp = { ...p, bgColor: null, layers: [below, l] };
  renderPage(tmp, ctx, { scale: 1, transparent: true });
  const merged = createLayer({ name: below.name, canvas: c });
  p.layers.splice(i - 1, 2, merged);
  p.activeLayerId = merged.id;
  notify();
}

function flattenPage() {
  const p = page();
  commit('Auf Hintergrund reduzieren');
  const c = pageToCanvas(p, 1, !p.bgColor);
  const l = createLayer({ name: 'Hintergrund', canvas: c });
  p.layers = [l];
  p.activeLayerId = l.id;
  notify();
}

function moveLayer(dir) {
  const p = page();
  const l = activeLayer();
  const i = p.layers.indexOf(l);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= p.layers.length) return;
  commit('Ebene umsortieren');
  p.layers.splice(j, 0, p.layers.splice(i, 1)[0]);
  notify();
}

function cropTo(rect) {
  const p = page();
  const r = {
    x: Math.max(0, Math.round(rect.x)), y: Math.max(0, Math.round(rect.y)),
    w: Math.round(rect.w), h: Math.round(rect.h),
  };
  if (r.w < 2 || r.h < 2) { say('Der Bereich ist zu klein'); return; }
  commit('Zuschneiden');
  for (const l of p.layers) { l.x -= r.x; l.y -= r.y; }
  p.width = Math.min(r.w, 20000);
  p.height = Math.min(r.h, 20000);
  p.pdfSource = null;
  p.pdfPoints = null;
  state.selection = null;
  clearCrop();
  notify();
  fitZoom();
  say(`Zugeschnitten auf ${p.width}×${p.height}`);
}

function scaleDocument(factor) {
  const p = page();
  commit('Bildgröße');
  for (const l of p.layers) {
    l.x *= factor; l.y *= factor; l.sx *= factor; l.sy *= factor;
  }
  p.width = Math.round(p.width * factor);
  p.height = Math.round(p.height * factor);
  p.pdfSource = null;
  notify();
  fitZoom();
}

/* ---------------- Projektdatei ---------------- */

async function saveProject() {
  const data = {
    format: 'bildwerk/1',
    name: state.name,
    fonts: serializeFonts(),
    pages: state.pages.map(p => ({
      width: p.width, height: p.height, bgColor: p.bgColor,
      activeLayerId: p.activeLayerId,
      layers: p.layers.map(l => ({
        id: l.id, name: l.name, type: l.type, visible: l.visible, opacity: l.opacity,
        blend: l.blend, x: l.x, y: l.y, rot: l.rot, sx: l.sx, sy: l.sy,
        adjust: l.adjust, text: l.text, shape: l.shape,
        image: l.type === 'raster' ? l.canvas.toDataURL('image/png') : null,
      })),
    })),
  };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }),
    (state.name || 'projekt') + '.bildwerk');
  state.dirty = false;
  say('Projekt gespeichert');
}

async function openProject(file) {
  const data = JSON.parse(await file.text());
  if (data.format !== 'bildwerk/1') throw new Error('Unbekanntes Projektformat');
  await restoreFonts(data.fonts);
  const pages = [];
  for (const sp of data.pages) {
    const p = createPage(sp.width, sp.height, sp.bgColor);
    for (const sl of sp.layers) {
      const l = createLayer({ name: sl.name, type: sl.type });
      Object.assign(l, {
        visible: sl.visible, opacity: sl.opacity, blend: sl.blend,
        x: sl.x, y: sl.y, rot: sl.rot, sx: sl.sx, sy: sl.sy,
        adjust: { ...defaultAdjust(), ...sl.adjust }, text: sl.text, shape: sl.shape,
      });
      if (sl.image) l.canvas = imageToCanvas(await loadImage(sl.image));
      else refreshLayer(l);
      p.layers.push(l);
    }
    p.activeLayerId = p.layers[p.layers.length - 1]?.id ?? null;
    pages.push(p);
  }
  state.pages = pages;
  state.active = 0;
  state.name = data.name || 'Projekt';
  resetHistory();
  refreshFontSelect();
  notify();
  fitZoom();
  say('Projekt geladen');
}

/* ---------------- Export ---------------- */

async function exportImage(type, quality) {
  const p = page();
  const c = pageToCanvas(p, 1, type === 'image/png' || type === 'image/webp' ? !p.bgColor : false);
  const blob = await new Promise(r => c.toBlob(r, type, quality));
  const ext = type.split('/')[1].replace('jpeg', 'jpg');
  download(blob, `${state.name || 'bild'}.${ext}`);
  say(`Exportiert als ${ext.toUpperCase()} (${c.width}×${c.height})`);
}

async function exportPdfDialog() {
  const res = await modal('Als PDF exportieren', [
    { key: 'mode', label: 'Modus', type: 'select', value: 'hybrid', options: [
      ['hybrid', 'Original beibehalten, Änderungen aufsetzen'],
      ['flat', 'Alles als Bild rastern'],
    ] },
    { key: 'format', label: 'Bildkompression der gerasterten Seiten', type: 'select', value: 'jpeg', options: [
      ['jpeg', 'JPEG (klein)'], ['png', 'PNG (verlustfrei, groß)'],
    ] },
    { key: 'quality', label: 'JPEG-Qualität (0,1–1,0)', type: 'number', value: 0.9, min: 0.1, max: 1, step: 0.05 },
  ], { okLabel: 'Exportieren', text:
    'Im ersten Modus bleiben Text und Vektoren geöffneter PDFs erhalten; ' +
    'neue Textebenen werden – wo möglich – als echter PDF-Text geschrieben.' });
  if (!res) return;
  say('PDF wird erzeugt …');
  const blob = await PDF.exportPdf({ mode: res.mode, format: res.format, quality: res.quality });
  download(blob, `${state.name || 'dokument'}.pdf`);
  say(`PDF mit ${state.pages.length} Seite(n) exportiert`);
}

/* ---------------- Befehlsverteiler ---------------- */

export async function run(cmd) {
  const p = page();
  const l = activeLayer();

  switch (cmd) {
    /* --- Datei --- */
    case 'new': {
      const r = await modal('Neues Dokument', [
        { key: 'w', label: 'Breite (px)', type: 'number', value: p?.width || 1600, min: 1, max: 20000 },
        { key: 'h', label: 'Höhe (px)', type: 'number', value: p?.height || 1000, min: 1, max: 20000 },
        { key: 'transparent', label: 'Transparenter Hintergrund', type: 'checkbox', value: false },
      ], { okLabel: 'Anlegen' });
      if (r) { state.name = 'Unbenannt'; newDocument(r.w, r.h, r.transparent); }
      break;
    }
    case 'open-image': {
      const f = await pickFile('image/*');
      if (f) await openImageAsDocument(f);
      break;
    }
    case 'place-image': {
      const f = await pickFile('image/*');
      if (f) await placeImage(f);
      break;
    }
    case 'open-pdf': {
      const f = await pickFile('application/pdf');
      if (f) { say('PDF wird geladen …'); await PDF.importPdf(await f.arrayBuffer(), { name: f.name }); resetHistory(); fitZoom(); }
      break;
    }
    case 'pdf-append': {
      const f = await pickFile('application/pdf');
      if (f) { commit('PDF anhängen'); await PDF.importPdf(await f.arrayBuffer(), { append: true, name: f.name }); }
      break;
    }
    case 'save-project': await saveProject(); break;
    case 'open-project': {
      const f = await pickFile('.bildwerk,application/json');
      if (f) await openProject(f);
      break;
    }
    case 'export-png': await exportImage('image/png'); break;
    case 'export-webp': await exportImage('image/webp', 0.92); break;
    case 'export-jpg': {
      const r = await modal('JPEG exportieren', [
        { key: 'q', label: 'Qualität (0,1–1,0)', type: 'number', value: 0.92, min: 0.1, max: 1, step: 0.02 },
      ], { okLabel: 'Exportieren' });
      if (r) await exportImage('image/jpeg', r.q);
      break;
    }
    case 'export-pdf': await exportPdfDialog(); break;

    /* --- Bearbeiten --- */
    case 'undo': if (undo()) { notify(); say('Rückgängig'); } else say('Nichts zum Rückgängigmachen'); break;
    case 'redo': if (redo()) { notify(); say('Wiederholt'); } else say('Nichts zum Wiederholen'); break;
    case 'copy-layer': {
      if (!l) break;
      commit('Ebene duplizieren');
      const copy = createLayer({ name: l.name + ' Kopie', type: l.type });
      Object.assign(copy, {
        visible: l.visible, opacity: l.opacity, blend: l.blend,
        x: l.x + 12, y: l.y + 12, rot: l.rot, sx: l.sx, sy: l.sy,
        adjust: { ...l.adjust }, text: l.text ? { ...l.text } : null,
        shape: l.shape ? { ...l.shape } : null, canvas: cloneCanvas(l.canvas),
      });
      addLayer(copy);
      notify();
      break;
    }
    case 'delete-layer': {
      if (!l) break;
      if (layers().length <= 1) { say('Die letzte Ebene lässt sich nicht löschen'); break; }
      commit('Ebene löschen');
      removeLayer(l.id);
      notify();
      break;
    }
    case 'clear-selection': {
      if (!l || !state.selection) { say('Keine Auswahl'); break; }
      commit('Auswahl leeren');
      const ctx = beginPixelEdit(l);
      const s = state.selection;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const m = layerMatrix(l).inverse();
      const pts = [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]]
        .map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(q => ctx.lineTo(q.x, q.y));
      ctx.closePath();
      ctx.clip();
      ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
      ctx.restore();
      notify();
      break;
    }
    case 'select-none': state.selection = null; clearCrop(); notify(); break;
    case 'crop-to-selection': {
      const r = getCropRect() || state.selection;
      if (!r) { say('Erst einen Bereich auswählen'); break; }
      cropTo(r);
      break;
    }
    case 'resize-doc': {
      const r = await modal('Dokumentgröße (Leinwand)', [
        { key: 'w', label: 'Breite (px)', type: 'number', value: p.width, min: 1, max: 20000 },
        { key: 'h', label: 'Höhe (px)', type: 'number', value: p.height, min: 1, max: 20000 },
      ], { okLabel: 'Ändern', text: 'Die Ebenen behalten ihre Größe und Position.' });
      if (!r) break;
      commit('Dokumentgröße');
      p.width = r.w; p.height = r.h; p.pdfSource = null;
      notify(); fitZoom();
      break;
    }
    case 'resize-image': {
      const r = await modal('Bildgröße skalieren', [
        { key: 'w', label: 'Neue Breite (px)', type: 'number', value: p.width, min: 1, max: 20000 },
      ], { okLabel: 'Skalieren', text: 'Seitenverhältnis und alle Ebenen werden mitskaliert.' });
      if (!r) break;
      scaleDocument(r.w / p.width);
      break;
    }

    /* --- Ebene --- */
    case 'add-layer': {
      commit('Neue Ebene');
      addLayer(createLayer({ name: 'Ebene ' + (layers().length + 1), w: p.width, h: p.height }));
      notify();
      break;
    }
    case 'add-text': {
      commit('Textebene');
      const t = defaultText('Neuer Text');
      t.size = opts.fontSize; t.color = state.fg;
      const layer = createLayer({ name: 'Text', type: 'text', text: t });
      refreshLayer(layer);
      layer.x = p.width / 2 - layer.canvas.width / 2;
      layer.y = p.height / 2 - layer.canvas.height / 2;
      addLayer(layer);
      setTool('move');
      notify();
      break;
    }
    case 'merge-down': mergeDown(); break;
    case 'flatten': flattenPage(); break;
    case 'layer-up': moveLayer(1); break;
    case 'layer-down': moveLayer(-1); break;
    case 'fit-layer': {
      if (!l) break;
      commit('Ebene einpassen');
      const s = Math.min(p.width / l.canvas.width, p.height / l.canvas.height);
      l.sx = l.sy = s; l.rot = 0;
      l.x = (p.width - l.canvas.width * s) / 2;
      l.y = (p.height - l.canvas.height * s) / 2;
      notify();
      break;
    }
    case 'reset-transform': {
      if (!l) break;
      commit('Transformation zurücksetzen');
      l.rot = 0; l.sx = 1; l.sy = 1;
      notify();
      break;
    }
    case 'rasterize-text': {
      if (!l || l.type === 'raster') { say('Diese Ebene ist bereits gerastert'); break; }
      commit('Rastern');
      ensureRaster(l);
      notify();
      say('Ebene gerastert');
      break;
    }

    /* --- Farben & Anpassungen --- */
    case 'swap-colors': { const t = state.fg; state.fg = state.bg; state.bg = t; notify(); break; }
    case 'reset-adjust': {
      if (!l) break;
      commit('Anpassungen zurücksetzen');
      l.adjust = defaultAdjust();
      notify();
      break;
    }
    case 'bake-adjust': {
      if (!l) break;
      commit('Anpassungen einrechnen');
      ensureRaster(l);
      const res = F.bakeAdjust(l.canvas, l.adjust);
      if (res.canvas) {
        l.canvas = res.canvas;
        l.x -= res.offset * l.sx;
        l.y -= res.offset * l.sy;
        l.adjust = res.adjust;
      }
      notify();
      say('Anpassungen sind jetzt Teil der Pixel');
      break;
    }

    /* --- Filter --- */
    case 'fx-sharpen': applyPixelOp(F.sharpen, 'Schärfen'); break;
    case 'fx-edge': applyPixelOp(F.edges, 'Kanten betonen'); break;
    case 'fx-emboss': applyPixelOp(F.emboss, 'Relief'); break;
    case 'fx-vignette': applyPixelOp(c => F.vignette(c, 0.75), 'Vignette'); break;
    case 'fx-autolevel': applyPixelOp(F.autoLevel, 'Auto-Tonwert'); break;
    case 'fx-flip-h': applyPixelOp(c => F.flip(c, true), 'Horizontal spiegeln'); break;
    case 'fx-flip-v': applyPixelOp(c => F.flip(c, false), 'Vertikal spiegeln'); break;
    case 'fx-rot90': applyPixelOp(F.rotate90, '90° drehen'); break;
    case 'fx-pixelate': {
      const r = await modal('Verpixeln', [{ key: 'v', label: 'Blockgröße (px)', type: 'number', value: 12, min: 2, max: 200 }]);
      if (r) applyPixelOp(c => F.pixelate(c, r.v), 'Verpixeln');
      break;
    }
    case 'fx-noise': {
      const r = await modal('Rauschen', [{ key: 'v', label: 'Stärke', type: 'number', value: 20, min: 1, max: 120 }]);
      if (r) applyPixelOp(c => F.noise(c, r.v), 'Rauschen');
      break;
    }
    case 'fx-posterize': {
      const r = await modal('Tontrennung', [{ key: 'v', label: 'Stufen', type: 'number', value: 5, min: 2, max: 32 }]);
      if (r) applyPixelOp(c => F.posterize(c, r.v), 'Tontrennung');
      break;
    }
    case 'fx-threshold': {
      const r = await modal('Schwellenwert', [{ key: 'v', label: 'Grenze (0–255)', type: 'number', value: 128, min: 0, max: 255 }]);
      if (r) applyPixelOp(c => F.threshold(c, r.v), 'Schwellenwert');
      break;
    }

    /* --- Seiten --- */
    case 'page-add': {
      const r = await modal('Leere Seite anhängen', [
        { key: 'w', label: 'Breite (px)', type: 'number', value: p.width, min: 1, max: 20000 },
        { key: 'h', label: 'Höhe (px)', type: 'number', value: p.height, min: 1, max: 20000 },
      ], { okLabel: 'Anhängen' });
      if (r) PDF.addBlankPage(r.w, r.h);
      break;
    }
    case 'page-dup': PDF.duplicatePage(); break;
    case 'page-del': PDF.deletePage(); break;
    case 'page-rot': PDF.rotatePage(); break;

    /* --- Ansicht --- */
    case 'zoom-in': setZoom(state.zoom * 1.25); break;
    case 'zoom-out': setZoom(state.zoom / 1.25); break;
    case 'zoom-fit': fitZoom(); break;

    /* --- Schrift --- */
    case 'load-font': {
      const f = await pickFile('.ttf,.otf,.woff,.woff2,font/*');
      if (!f) break;
      const name = await loadFontFile(f);
      refreshFontSelect();
      const cur = activeLayer();
      if (cur?.type === 'text') { commit('Schriftart'); cur.text.family = `"${name}"`; refreshLayer(cur); }
      notify();
      say(`Schrift „${name}“ geladen – sie wird im Projekt mitgespeichert`);
      break;
    }

    /* --- Hilfe --- */
    case 'shortcuts': await info('Tastenkürzel', SHORTCUT_HTML); break;
    case 'about': await info('Über Bildwerk', ABOUT_HTML); break;

    default: console.warn('Unbekannter Befehl:', cmd);
  }
}

const SHORTCUT_HTML = `
<table>
<tr><td>V / M / C</td><td>Verschieben · Auswahl · Zuschneiden</td></tr>
<tr><td>B / E / G</td><td>Pinsel · Radierer · Farbeimer</td></tr>
<tr><td>I / T / U</td><td>Pipette · Text · Rechteck</td></tr>
<tr><td>Strg + Z / Y</td><td>Rückgängig / Wiederholen</td></tr>
<tr><td>Strg + J</td><td>Ebene duplizieren</td></tr>
<tr><td>Strg + D</td><td>Auswahl aufheben</td></tr>
<tr><td>Entf</td><td>Auswahl leeren</td></tr>
<tr><td>Eingabe</td><td>Zuschnitt bestätigen</td></tr>
<tr><td>Strg + N / O / S</td><td>Neu · Öffnen · Projekt speichern</td></tr>
<tr><td>Strg + E</td><td>Als PNG exportieren</td></tr>
<tr><td>Strg + Mausrad</td><td>Zoomen</td></tr>
<tr><td>+ / − / 0</td><td>Größer · Kleiner · Einpassen</td></tr>
<tr><td>X</td><td>Vorder- und Hintergrundfarbe tauschen</td></tr>
<tr><td>[ / ]</td><td>Pinsel kleiner / größer</td></tr>
<tr><td>Bild ↑ / ↓</td><td>Seite wechseln</td></tr>
</table>`;

const ABOUT_HTML = `
<p><b>Bildwerk</b> ist ein Bild- und PDF-Editor, der vollständig im Browser auf
Ihrem Rechner läuft. Es gibt keinen Server, keinen Upload und kein Konto –
geöffnete Dateien bleiben im Arbeitsspeicher des Browsers.</p>
<p>Umfang: Ebenen mit Mischmodi und Deckkraft, Pinsel und Radierer, Auswahl und
Zuschnitt, Formen, editierbare Textebenen mit eigenen Schriftdateien,
nicht-destruktive Anpassungen, einrechnende Filter sowie mehrseitige
PDF-Bearbeitung mit Export.</p>
<p>Der Programmcode belegt wenige hundert Kilobyte; die beiden PDF-Bibliotheken
kommen auf rund 3 MB.</p>`;
