/* Bildwerk – PDF öffnen, Seiten verwalten, PDF schreiben. */
import {
  state, page, createPage, createLayer, addLayer, makeCanvas, pageToCanvas,
  commit, notify, say, newId,
} from './core.js';

const PT_PER_PX = 72 / 96;   // Bildschirmpixel -> PDF-Punkte
const MAX_RENDER_PX = 2600;  // Deckel gegen riesige Seiten-Canvas

export const pdfSources = new Map(); // docId -> Uint8Array (Originaldatei)

async function libs() { return window.bildwerkLibs ? await window.bildwerkLibs : {}; }

export async function pdfjsReady() {
  const l = await libs();
  if (!l.pdfjs?.ok) throw new Error('pdf.js ist nicht verfügbar – siehe vendor/README.md');
  return window.pdfjsLib;
}

export async function pdfLibReady() {
  const l = await libs();
  if (!l.pdflib?.ok) throw new Error('pdf-lib ist nicht verfügbar – siehe vendor/README.md');
  return window.PDFLib;
}

/* ---------------- Import ---------------- */

export async function importPdf(arrayBuffer, { append = false, name = 'Dokument.pdf' } = {}) {
  const pdfjsLib = await pdfjsReady();
  const original = new Uint8Array(arrayBuffer.slice(0)); // Kopie: pdf.js entleert den Puffer
  const docId = newId();

  const task = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
  const pdf = await task.promise;
  pdfSources.set(docId, original);

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const base = pg.getViewport({ scale: 1 });
    let scale = 2;
    if (base.width * scale > MAX_RENDER_PX) scale = MAX_RENDER_PX / base.width;
    if (base.height * scale > MAX_RENDER_PX) scale = MAX_RENDER_PX / base.height;
    const vp = pg.getViewport({ scale });

    const c = makeCanvas(vp.width, vp.height);
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;

    const p = createPage(vp.width, vp.height, '#ffffff');
    p.pdfSource = { docId, index: i - 1 };
    p.pdfPoints = { w: base.width, h: base.height };
    p.pdfRotate = (pg.rotate || 0) % 360;
    const layer = createLayer({ name: `PDF-Seite ${i}`, canvas: c });
    layer.pdfBase = true;
    p.layers.push(layer);
    p.activeLayerId = layer.id;
    pages.push(p);
  }

  if (append && state.pages.length) {
    state.pages.push(...pages);
    say(`${pages.length} Seite(n) angehängt`);
  } else {
    state.pages = pages;
    state.active = 0;
    state.name = name.replace(/\.pdf$/i, '');
    say(`${pages.length} Seite(n) geladen`);
  }
  notify();
  return pages.length;
}

/* ---------------- Seitenverwaltung ---------------- */

export function addBlankPage(w, h) {
  commit('Seite anhängen');
  const cur = page();
  const p = createPage(w || cur?.width || 1240, h || cur?.height || 1754, '#ffffff');
  state.pages.push(p);
  state.active = state.pages.length - 1;
  notify();
}

export function duplicatePage() {
  const p = page();
  if (!p) return;
  commit('Seite duplizieren');
  const copy = {
    ...p, id: newId(),
    layers: p.layers.map(l => ({ ...l, id: newId(), adjust: { ...l.adjust },
      text: l.text ? { ...l.text } : null, shape: l.shape ? { ...l.shape } : null })),
  };
  state.pages.splice(state.active + 1, 0, copy);
  state.active++;
  notify();
}

export function deletePage() {
  if (state.pages.length <= 1) { say('Die letzte Seite lässt sich nicht löschen'); return; }
  commit('Seite löschen');
  state.pages.splice(state.active, 1);
  state.active = Math.min(state.active, state.pages.length - 1);
  notify();
}

/** Dreht die Seite um 90°; der Inhalt wird dabei auf eine Ebene reduziert. */
export function rotatePage() {
  const p = page();
  if (!p) return;
  commit('Seite drehen');
  const flat = pageToCanvas(p, 1, true);
  const out = makeCanvas(flat.height, flat.width);
  const ctx = out.getContext('2d');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(flat, -flat.width / 2, -flat.height / 2);

  p.width = out.width; p.height = out.height;
  if (p.pdfPoints) p.pdfPoints = { w: p.pdfPoints.h, h: p.pdfPoints.w };
  p.pdfSource = null; // gedrehte Seite wird beim Export neu gerastert
  const layer = createLayer({ name: 'Seite (gedreht)', canvas: out });
  p.layers = [layer];
  p.activeLayerId = layer.id;
  notify();
}

export function movePage(from, to) {
  if (to < 0 || to >= state.pages.length) return;
  commit('Seiten umsortieren');
  const [p] = state.pages.splice(from, 1);
  state.pages.splice(to, 0, p);
  state.active = to;
  notify();
}

/* ---------------- Export ---------------- */

const STD_FONTS = [
  [/courier|mono/i, 'Courier'],
  [/times|georgia|garamond|serif/i, 'TimesRoman'],
];

function standardFontFor(t) {
  let base = 'Helvetica';
  for (const [re, name] of STD_FONTS) if (re.test(t.family)) { base = name; break; }
  const bold = Number(t.weight) >= 600;
  const italic = !!t.italic;
  if (base === 'TimesRoman') {
    if (bold && italic) return 'TimesRomanBoldItalic';
    if (bold) return 'TimesRomanBold';
    if (italic) return 'TimesRomanItalic';
    return 'TimesRoman';
  }
  const suffix = bold && italic ? 'BoldOblique' : bold ? 'Bold' : italic ? 'Oblique' : '';
  return base + suffix;
}

/** Textebene, die sich verlustfrei als echter PDF-Text schreiben lässt? */
function isVectorizableText(l) {
  return l.type === 'text' && l.visible && l.opacity > 0.99 &&
    Math.abs(l.rot) < 1e-6 && l.sx > 0 && l.sy > 0 &&
    Math.abs(l.sx - l.sy) < 1e-6 &&
    l.blend === 'source-over' && (!l.text.strokeWidth) &&
    /^[\x20-\x7E -ÿ\n]*$/.test(l.text.content || '');
}

function hexRgb(PDFLib, hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  const v = m ? [1, 2, 3].map(i => parseInt(m[i], 16) / 255) : [0, 0, 0];
  return PDFLib.rgb(v[0], v[1], v[2]);
}

async function canvasToBytes(canvas, format, quality) {
  const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise(r => canvas.toBlob(r, type, quality));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Seite ohne die Ausnahmeebenen rendern (transparentes Overlay). */
function overlayCanvas(p, skipIds, scale) {
  const clone = { ...p, bgColor: null, layers: p.layers.filter(l => !skipIds.has(l.id)) };
  if (!clone.layers.length) return null;
  return pageToCanvas(clone, scale, true);
}

/**
 * mode: 'hybrid' behält Originalseiten (Text bleibt Text) und stempelt Änderungen auf,
 *       'flat' rendert jede Seite komplett als Bild.
 */
export async function exportPdf({ mode = 'hybrid', format = 'jpeg', quality = 0.9, scale = 1 } = {}) {
  const PDFLib = await pdfLibReady();
  const { PDFDocument, StandardFonts, degrees } = PDFLib;
  const out = await PDFDocument.create();
  const srcDocs = new Map();
  const fontCache = new Map();

  for (const p of state.pages) {
    let done = false;

    if (mode === 'hybrid' && p.pdfSource && pdfSources.has(p.pdfSource.docId) && !p.pdfRotate) {
      try {
        const key = p.pdfSource.docId;
        if (!srcDocs.has(key))
          srcDocs.set(key, await PDFDocument.load(pdfSources.get(key), { ignoreEncryption: true }));
        const base = p.layers.find(l => l.pdfBase);
        const baseUntouched = base && base.visible && base.opacity > 0.99 &&
          base.x === 0 && base.y === 0 && base.sx === 1 && base.sy === 1 && base.rot === 0;

        if (baseUntouched) {
          const [copied] = await out.copyPages(srcDocs.get(key), [p.pdfSource.index]);
          const pdfPage = out.addPage(copied);
          const pw = pdfPage.getWidth(), ph = pdfPage.getHeight();
          const k = pw / p.width; // Pixel -> Punkte

          const skip = new Set([base.id]);
          for (const l of p.layers) {
            if (!isVectorizableText(l)) continue;
            const t = l.text;
            const fontName = standardFontFor(t);
            if (!fontCache.has(fontName))
              fontCache.set(fontName, await out.embedFont(StandardFonts[fontName]));
            const font = fontCache.get(fontName);
            const size = t.size * l.sx * k;
            const pad = Math.ceil(t.size * 0.35 + t.strokeWidth * 2 + 4);
            const lines = String(t.content ?? '').split('\n');
            lines.forEach((line, i) => {
              const yDoc = l.y + (pad + t.size * t.lineHeight * i + t.size * 0.82) * l.sy;
              let xDoc = l.x + pad * l.sx;
              if (t.align !== 'left') {
                const wText = font.widthOfTextAtSize(line, size);
                const wBox = (l.canvas.width - pad * 2) * l.sx * k;
                xDoc += (t.align === 'center' ? (wBox - wText) / 2 : wBox - wText) / k;
              }
              pdfPage.drawText(line, {
                x: xDoc * k, y: ph - yDoc * k, size, font,
                color: hexRgb(PDFLib, t.color),
                ...(t.spacing ? { characterSpacing: t.spacing * l.sx * k } : {}),
              });
            });
            skip.add(l.id);
          }

          const ov = overlayCanvas(p, skip, scale);
          if (ov) {
            const img = await out.embedPng(await canvasToBytes(ov, 'png', 1));
            pdfPage.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
          }
          done = true;
        }
      } catch (err) {
        console.warn('Originalseite konnte nicht übernommen, wird gerastert:', err);
      }
    }

    if (!done) {
      const canvas = pageToCanvas(p, scale, false);
      const bytes = await canvasToBytes(canvas, format, quality);
      const img = format === 'jpeg' ? await out.embedJpg(bytes) : await out.embedPng(bytes);
      const pw = (p.pdfPoints?.w) || p.width * PT_PER_PX;
      const ph = (p.pdfPoints?.h) || p.height * PT_PER_PX;
      const pdfPage = out.addPage([pw, ph]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
    }
  }

  out.setTitle(state.name || 'Bildwerk-Dokument');
  out.setProducer('Bildwerk');
  out.setCreator('Bildwerk – lokaler Bild- und PDF-Editor');
  return new Blob([await out.save()], { type: 'application/pdf' });
}
