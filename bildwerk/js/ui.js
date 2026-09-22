/* Bildwerk – Oberfläche: Bühne, Panels, Ebenenliste, Dialoge. */
import {
  state, page, layers, activeLayer, setActiveLayer, renderPage, BLEND_MODES,
  ADJUSTMENTS, defaultAdjust, refreshLayer, commit, notify, on, say, maxZoomFor,
} from './core.js';
import { TOOLS, opts, drawOverlay, pointerDown, pointerMove, pointerUp, clearCrop } from './tools.js';
import { fontOptions } from './fonts.js';

export const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of [].concat(kids)) n.append(k);
  return n;
};

const canvas = () => $('#canvas');
const overlay = () => $('#overlay');
const thumbCache = new WeakMap();
let renderQueued = false;
let stripTimer = 0;

/* ---------------- Aufbau ---------------- */

export function initUI() {
  buildToolbar();
  buildBlendSelect();
  buildAdjustments();
  buildFontSelect();
  bindPanels();
  bindStage();
  on('change', scheduleRender);
  on('status', (m) => { $('#status-msg').textContent = m || ''; });
  buildToolOptions();
}

function buildToolbar() {
  const bar = $('#toolbar');
  bar.textContent = '';
  for (const t of TOOLS) {
    const b = el('button', { className: 'tool', title: t.label, textContent: t.icon });
    b.dataset.tool = t.id;
    b.onclick = () => setTool(t.id);
    bar.append(b);
  }
  syncToolbar();
}

export function setTool(id) {
  state.tool = id;
  if (id !== 'crop') clearCrop();
  syncToolbar();
  buildToolOptions();
  scheduleRender();
}

function syncToolbar() {
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === state.tool));
  const cursors = { move: 'move', brush: 'crosshair', eraser: 'crosshair', bucket: 'crosshair',
    eyedrop: 'crosshair', text: 'text', select: 'crosshair', crop: 'crosshair', hand: 'grab' };
  $('#stage').style.cursor = cursors[state.tool] || 'crosshair';
}

function num(label, key, min, max, step, suffix = '') {
  const o = el('output', { textContent: fmt(opts[key], suffix) });
  const i = el('input', { type: 'range', min, max, step, value: opts[key] });
  i.oninput = () => { opts[key] = Number(i.value); o.textContent = fmt(opts[key], suffix); };
  return el('div', { className: 'opt' }, [el('span', { textContent: label }), i, o]);
}
const fmt = (v, s) => (Math.round(v * 100) / 100) + s;

function check(label, key) {
  const i = el('input', { type: 'checkbox', checked: !!opts[key] });
  i.onchange = () => { opts[key] = i.checked; };
  const l = el('label', { className: 'opt' }, [i, el('span', { textContent: label })]);
  return l;
}

function buildToolOptions() {
  const box = $('#tool-options');
  box.textContent = '';
  const t = state.tool;
  if (t === 'brush' || t === 'eraser') {
    box.append(num('Größe', 'size', 1, 400, 1, ' px'));
    box.append(num('Härte', 'hardness', 0, 1, 0.05));
    box.append(num('Deckkraft', 'flow', 0.02, 1, 0.02));
    box.append(hint('Alt-Taste malt mit der Hintergrundfarbe'));
  } else if (t === 'bucket') {
    box.append(num('Toleranz', 'tolerance', 0, 160, 1));
    box.append(hint('Mit aktiver Auswahl wird nur diese gefüllt'));
  } else if (t === 'text') {
    box.append(num('Schriftgröße', 'fontSize', 6, 400, 1, ' px'));
    box.append(hint('Auf die Bühne klicken, dann rechts unter „Schrift“ bearbeiten'));
  } else if (t === 'rect' || t === 'ellipse') {
    box.append(check('Gefüllt', 'fillShape'));
    box.append(num('Konturstärke', 'strokeWidth', 0, 60, 1, ' px'));
    if (t === 'rect') box.append(num('Eckenradius', 'radius', 0, 200, 1, ' px'));
  } else if (t === 'line') {
    box.append(num('Stärke', 'strokeWidth', 1, 60, 1, ' px'));
  } else if (t === 'crop') {
    box.append(hint('Bereich aufziehen, dann mit Eingabe bestätigen (Esc bricht ab)'));
  } else if (t === 'move') {
    box.append(hint('Ecken ziehen skaliert (Umschalt = proportional), der Punkt darüber dreht'));
  } else if (t === 'select') {
    box.append(hint('Entf leert die Auswahl, Strg+D hebt sie auf'));
  } else if (t === 'eyedrop') {
    box.append(hint('Klick nimmt die Vordergrundfarbe auf, Alt+Klick die Hintergrundfarbe'));
  } else if (t === 'hand') {
    box.append(hint('Ziehen verschiebt den Bildausschnitt'));
  }
}
const hint = (text) => el('div', { className: 'opt', textContent: text });

function buildBlendSelect() {
  const s = $('#l-blend');
  s.textContent = '';
  for (const [v, label] of BLEND_MODES) s.append(el('option', { value: v, textContent: label }));
  s.onchange = () => { const l = activeLayer(); if (!l) return; commit('Modus'); l.blend = s.value; notify(); };
}

function buildFontSelect() {
  const s = $('#t-family');
  s.textContent = '';
  for (const [v, label] of fontOptions()) s.append(el('option', { value: v, textContent: label }));
}
export const refreshFontSelect = () => {
  const cur = $('#t-family').value;
  buildFontSelect();
  const l = activeLayer();
  $('#t-family').value = (l?.text?.family) || cur;
};

function buildAdjustments() {
  const box = $('#adjust-list');
  box.textContent = '';
  for (const d of ADJUSTMENTS) {
    const out = el('output', { textContent: d.def + d.unit });
    const inp = el('input', { type: 'range', min: d.min, max: d.max, step: 1, value: d.def });
    inp.dataset.adj = d.key;
    let started = false;
    inp.onpointerdown = () => { started = false; };
    inp.oninput = () => {
      const l = activeLayer();
      if (!l) return;
      if (!started) { commit('Anpassung'); started = true; }
      l.adjust[d.key] = Number(inp.value);
      out.textContent = inp.value + d.unit;
      notify();
    };
    inp.onchange = () => { started = false; };
    box.append(el('div', { className: 'adjust-row' }, [el('label', { textContent: d.label }), inp, out]));
  }
}

/* ---------------- Panels verdrahten ---------------- */

function bindPanels() {
  $('#fg-color').oninput = (e) => { state.fg = e.target.value; pushRecent(state.fg); notify(); };
  $('#bg-color').oninput = (e) => { state.bg = e.target.value; notify(); };

  $('#l-opacity').oninput = (e) => {
    const l = activeLayer(); if (!l) return;
    l.opacity = Number(e.target.value) / 100;
    $('#op-val').textContent = e.target.value + '%';
    notify();
  };
  $('#l-opacity').onpointerdown = () => { if (activeLayer()) commit('Deckkraft'); };

  const textFields = {
    't-content': 'content', 't-family': 'family', 't-size': 'size', 't-weight': 'weight',
    't-line': 'lineHeight', 't-spacing': 'spacing', 't-align': 'align', 't-color': 'color',
    't-stroke': 'stroke', 't-strokew': 'strokeWidth', 't-italic': 'italic',
  };
  for (const [id, key] of Object.entries(textFields)) {
    const node = $('#' + id);
    let armed = false;
    node.addEventListener('focus', () => { armed = false; });
    node.addEventListener('input', () => {
      const l = activeLayer();
      if (!l || l.type !== 'text') return;
      if (!armed) { commit('Text ändern'); armed = true; }
      let v = node.type === 'checkbox' ? node.checked : node.value;
      if (['size', 'lineHeight', 'spacing', 'strokeWidth'].includes(key)) v = Number(v);
      l.text[key] = v;
      refreshLayer(l);
      notify();
    });
    node.addEventListener('change', () => { armed = false; });
  }
}

function pushRecent(hex) {
  if (state.recentColors[0] === hex) return;
  state.recentColors = [hex, ...state.recentColors.filter(c => c !== hex)].slice(0, 12);
}

/* ---------------- Bühne ---------------- */

function stagePoint(ev) {
  const r = canvas().getBoundingClientRect();
  return { x: (ev.clientX - r.left) / state.zoom, y: (ev.clientY - r.top) / state.zoom };
}

function bindStage() {
  const stage = $('#stage');
  let panning = null;

  stage.addEventListener('pointerdown', (ev) => {
    if (!page()) return;
    if (ev.button === 1 || state.tool === 'hand' || (ev.button === 0 && ev.spaceKey)) {
      const wrap = $('#stage-wrap');
      panning = { x: ev.clientX, y: ev.clientY, l: wrap.scrollLeft, t: wrap.scrollTop };
      stage.style.cursor = 'grabbing';
      stage.setPointerCapture(ev.pointerId);
      return;
    }
    if (ev.button !== 0) return;
    stage.setPointerCapture(ev.pointerId);
    pointerDown(stagePoint(ev), ev);
  });

  stage.addEventListener('pointermove', (ev) => {
    const p = stagePoint(ev);
    $('#status-pos').textContent = page() ? `x ${Math.round(p.x)}  y ${Math.round(p.y)}` : '';
    if (panning) {
      const wrap = $('#stage-wrap');
      wrap.scrollLeft = panning.l - (ev.clientX - panning.x);
      wrap.scrollTop = panning.t - (ev.clientY - panning.y);
      return;
    }
    pointerMove(p, ev);
  });

  const end = (ev) => {
    if (panning) { panning = null; syncToolbar(); return; }
    pointerUp(stagePoint(ev), ev);
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  $('#stage-wrap').addEventListener('wheel', (ev) => {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    setZoom(state.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { passive: false });
}

export function setZoom(z) {
  // Oberhalb der Browsergrenze fuer Canvas bliebe die Buehne leer,
  // deshalb wird die Vergroesserung an der Dokumentgroesse gedeckelt.
  const max = maxZoomFor(page());
  const ziel = Math.max(0.02, z);
  if (ziel > max && state.zoom >= max - 1e-6)
    say(`Mehr als ${Math.round(max * 100)}% laesst die Bildflaeche bei dieser Dokumentgroesse nicht zu`);
  state.zoom = Math.min(max, ziel);
  scheduleRender();
}

export function fitZoom() {
  const p = page();
  if (!p) return;
  const wrap = $('#stage-wrap');
  const pad = 52;
  setZoom(Math.min((wrap.clientWidth - pad) / p.width, (wrap.clientHeight - pad) / p.height, 4));
  scheduleRender();
}

/* ---------------- Rendering ---------------- */

export function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderAll(); });
}

export function renderAll() {
  const p = page();
  const c = canvas(), o = overlay();
  if (!p) return;
  const w = Math.round(p.width * state.zoom), h = Math.round(p.height * state.zoom);
  for (const cv of [c, o]) {
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
  }
  $('#stage').style.width = w + 'px';
  $('#stage').style.height = h + 'px';

  renderPage(p, c.getContext('2d'), { scale: state.zoom });
  drawOverlay(o.getContext('2d'));

  syncPanels();
  renderLayerList();
  renderRecentColors();
  renderPageStrip();

  $('#zoom-label').textContent = Math.round(state.zoom * 100) + '%';
  $('#status-doc').textContent =
    `${state.name} · ${p.width}×${p.height} px · Seite ${state.active + 1}/${state.pages.length} · ${p.layers.length} Ebene(n)`;
}

function syncPanels() {
  const l = activeLayer();
  $('#fg-color').value = state.fg;
  $('#bg-color').value = state.bg;

  const isText = !!l && l.type === 'text';
  $('#panel-text').hidden = !isText;
  if (isText && document.activeElement?.id?.startsWith('t-') !== true) {
    const t = l.text;
    $('#t-content').value = t.content;
    $('#t-family').value = t.family;
    $('#t-size').value = t.size;
    $('#t-weight').value = t.weight;
    $('#t-line').value = t.lineHeight;
    $('#t-spacing').value = t.spacing;
    $('#t-align').value = t.align;
    $('#t-color').value = t.color;
    $('#t-stroke').value = t.stroke;
    $('#t-strokew').value = t.strokeWidth;
    $('#t-italic').checked = t.italic;
  }

  if (l) {
    $('#l-opacity').value = Math.round(l.opacity * 100);
    $('#op-val').textContent = Math.round(l.opacity * 100) + '%';
    $('#l-blend').value = l.blend;
    for (const d of ADJUSTMENTS) {
      const inp = document.querySelector(`input[data-adj="${d.key}"]`);
      if (inp && document.activeElement !== inp) {
        inp.value = l.adjust[d.key];
        inp.nextElementSibling.textContent = l.adjust[d.key] + d.unit;
      }
    }
  }
}

function thumbFor(layer) {
  let url = thumbCache.get(layer.canvas);
  if (!url) {
    const S = 32;
    const t = document.createElement('canvas');
    t.width = t.height = S;
    const s = Math.min(S / layer.canvas.width, S / layer.canvas.height);
    const w = Math.max(1, layer.canvas.width * s), h = Math.max(1, layer.canvas.height * s);
    t.getContext('2d').drawImage(layer.canvas, (S - w) / 2, (S - h) / 2, w, h);
    url = t.toDataURL();
    thumbCache.set(layer.canvas, url);
  }
  return url;
}

function renderLayerList() {
  const box = $('#layer-list');
  const act = activeLayer();
  box.textContent = '';
  for (const l of [...layers()].reverse()) {
    const row = el('div', { className: 'layer' + (l === act ? ' active' : '') + (l.visible ? '' : ' hidden-layer') });
    const eye = el('button', { className: 'eye', textContent: l.visible ? '👁' : '—', title: 'Sichtbarkeit' });
    eye.onclick = (e) => { e.stopPropagation(); commit('Sichtbarkeit'); l.visible = !l.visible; notify(); };
    const img = el('img', { className: 'thumb', src: thumbFor(l) });
    const name = el('div', { className: 'name', textContent: l.name });
    name.ondblclick = () => {
      const inp = el('input', { type: 'text', value: l.name });
      name.textContent = ''; name.append(inp); inp.focus(); inp.select();
      const done = () => { commit('Umbenennen'); l.name = inp.value || l.name; notify(); };
      inp.onblur = done;
      inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
    };
    row.append(eye, img, name);
    if (l.type !== 'raster') row.append(el('span', { className: 'badge', textContent: l.type === 'text' ? 'T' : '◇' }));
    row.onclick = () => { setActiveLayer(l.id); notify(); };
    box.append(row);
  }
}

function renderRecentColors() {
  const box = $('#recent-colors');
  box.textContent = '';
  for (const c of state.recentColors) {
    const b = el('button', { title: c });
    b.style.background = c;
    b.onclick = () => { state.fg = c; notify(); };
    box.append(b);
  }
}

function renderPageStrip() {
  const strip = $('#pagestrip');
  strip.hidden = state.pages.length < 2;
  if (strip.hidden) return;
  clearTimeout(stripTimer);
  stripTimer = setTimeout(() => {
    strip.textContent = '';
    state.pages.forEach((p, i) => {
      const btn = el('button', { className: 'pagethumb' + (i === state.active ? ' active' : ''), title: `Seite ${i + 1}` });
      const c = document.createElement('canvas');
      const s = 62 / p.width;
      c.width = 62; c.height = Math.max(1, Math.round(p.height * s));
      renderPage(p, c.getContext('2d'), { scale: s });
      btn.append(c, el('span', { textContent: i + 1 }));
      btn.onclick = () => { state.active = i; state.selection = null; notify(); };
      strip.append(btn);
    });
  }, 220);
}

/* ---------------- Dialoge ---------------- */

export function modal(title, fields, { okLabel = 'OK', text = '' } = {}) {
  return new Promise(resolve => {
    const back = $('#modal'), body = $('#modal-body');
    $('#modal-title').textContent = title;
    body.textContent = '';
    if (text) body.append(el('p', { innerHTML: text }));

    const inputs = {};
    for (const f of fields || []) {
      const wrap = el('div', { className: 'field' });
      wrap.append(el('label', { textContent: f.label }));
      let inp;
      if (f.type === 'select') {
        inp = el('select');
        for (const [v, l] of f.options) inp.append(el('option', { value: v, textContent: l }));
        inp.value = f.value;
      } else if (f.type === 'checkbox') {
        inp = el('input', { type: 'checkbox', checked: !!f.value });
      } else {
        inp = el('input', { type: f.type || 'text', value: f.value ?? '' });
        if (f.min != null) inp.min = f.min;
        if (f.max != null) inp.max = f.max;
        if (f.step != null) inp.step = f.step;
      }
      inputs[f.key] = inp;
      wrap.append(inp);
      body.append(wrap);
    }

    $('#modal-ok').textContent = okLabel;
    back.hidden = false;
    setTimeout(() => Object.values(inputs)[0]?.focus(), 30);

    const close = (result) => {
      back.hidden = true;
      $('#modal-ok').onclick = null;
      $('#modal-cancel').onclick = null;
      back.onkeydown = null;
      resolve(result);
    };
    const accept = () => {
      const out = {};
      for (const [k, i] of Object.entries(inputs))
        out[k] = i.type === 'checkbox' ? i.checked : (i.type === 'number' ? Number(i.value) : i.value);
      close(out);
    };
    $('#modal-ok').onclick = accept;
    $('#modal-cancel').onclick = () => close(null);
    back.onkeydown = (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') accept();
      if (e.key === 'Escape') close(null);
    };
  });
}

/** Fortschrittsanzeige ueber der Buehne; liefert update/schliessen + Abbruch. */
export function showProgress(titel) {
  const box = $('#progress');
  const ctrl = new AbortController();
  $('#progress-title').textContent = titel;
  $('#progress-fill').style.width = '0%';
  $('#progress-pct').textContent = '0 %';
  $('#progress-cancel').onclick = () => {
    ctrl.abort();
    $('#progress-pct').textContent = 'wird abgebrochen…';
  };
  box.hidden = false;
  return {
    signal: ctrl.signal,
    update(v) {
      const pct = Math.round(Math.min(1, Math.max(0, v)) * 100);
      $('#progress-fill').style.width = pct + '%';
      if (!ctrl.signal.aborted) $('#progress-pct').textContent = pct + ' %';
    },
    close() { box.hidden = true; $('#progress-cancel').onclick = null; },
  };
}

export function info(title, html) {
  return modal(title, [], { okLabel: 'Schließen', text: html });
}

export { say };
