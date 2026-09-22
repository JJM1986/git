/* Bildwerk – Start, Menüs, Tastatur, Drag & Drop. */
import { state, page, activeLayer, commit, notify, say, on } from './core.js';
import { initUI, scheduleRender, fitZoom, setTool, $ } from './ui.js';
import { run, newDocument, handleDroppedFile } from './commands.js';
import { opts, getCropRect, clearCrop } from './tools.js';
import { importPdf, exportPdf } from './pdfio.js';

/* ---------------- Menüs ---------------- */

function initMenus() {
  const closeAll = () => document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = btn.parentElement;
      const open = m.classList.contains('open');
      closeAll();
      if (!open) m.classList.add('open');
    });
    btn.parentElement.addEventListener('mouseenter', () => {
      if (document.querySelector('.menu.open')) { closeAll(); btn.parentElement.classList.add('open'); }
    });
  });
  document.addEventListener('click', closeAll);

  /* Alle Schaltflächen mit data-cmd – Menü, Kopfleiste und Panels */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    closeAll();
    try {
      await run(btn.dataset.cmd);
    } catch (err) {
      console.error(err);
      say('Fehler: ' + (err?.message || err));
    }
  });
}

/* ---------------- Tastatur ---------------- */

const TOOL_KEYS = { v: 'move', m: 'select', c: 'crop', b: 'brush', e: 'eraser', g: 'bucket',
  i: 'eyedrop', t: 'text', u: 'rect' };

function initKeys() {
  window.addEventListener('keydown', (ev) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
    if (!$('#modal').hidden) return;
    const mod = ev.ctrlKey || ev.metaKey;

    if (mod) {
      const map = { z: 'undo', y: 'redo', j: 'copy-layer', d: 'select-none',
        n: 'new', o: 'open-image', s: 'save-project', e: 'export-png' };
      const cmd = ev.shiftKey && ev.key.toLowerCase() === 'z' ? 'redo' : map[ev.key.toLowerCase()];
      if (cmd) { ev.preventDefault(); run(cmd); }
      return;
    }
    if (typing) return;

    const k = ev.key.toLowerCase();
    if (TOOL_KEYS[k]) { setTool(TOOL_KEYS[k]); return; }

    switch (ev.key) {
      case 'Delete': case 'Backspace': ev.preventDefault(); run('clear-selection'); break;
      case 'Enter': if (getCropRect()) run('crop-to-selection'); break;
      case 'Escape': state.selection = null; clearCrop(); notify(); break;
      case '+': case '=': run('zoom-in'); break;
      case '-': run('zoom-out'); break;
      case '0': fitZoom(); break;
      case 'x': case 'X': run('swap-colors'); break;
      case '[': opts.size = Math.max(1, Math.round(opts.size * 0.8)); setTool(state.tool); say('Pinsel: ' + opts.size + ' px'); break;
      case ']': opts.size = Math.min(400, Math.round(opts.size * 1.25) + 1); setTool(state.tool); say('Pinsel: ' + opts.size + ' px'); break;
      case 'PageDown': if (state.active < state.pages.length - 1) { state.active++; notify(); } break;
      case 'PageUp': if (state.active > 0) { state.active--; notify(); } break;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
        const l = activeLayer();
        if (!l) break;
        ev.preventDefault();
        const d = ev.shiftKey ? 10 : 1;
        commit('Verschieben');
        if (ev.key === 'ArrowLeft') l.x -= d;
        if (ev.key === 'ArrowRight') l.x += d;
        if (ev.key === 'ArrowUp') l.y -= d;
        if (ev.key === 'ArrowDown') l.y += d;
        notify();
        break;
      }
    }
  });
}

/* ---------------- Dateien hineinziehen ---------------- */

function initDrop() {
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(t => document.addEventListener(t, stop));
  document.addEventListener('drop', async (ev) => {
    for (const f of [...(ev.dataTransfer?.files || [])]) {
      try { await handleDroppedFile(f); }
      catch (err) { console.error(err); say('Fehler: ' + err.message); }
    }
  });
}

/* ---------------- Start ---------------- */

function initLibState() {
  const node = $('#status-lib');
  node.textContent = 'PDF-Bibliotheken werden geladen …';
  (window.bildwerkLibs || Promise.resolve({})).then(libs => {
    const ok = Object.values(libs).filter(l => l.ok);
    if (ok.length === 2) {
      node.className = 'lib-state ok';
      node.textContent = ok.every(l => l.local) ? 'PDF: offline bereit' : 'PDF: bereit';
    } else {
      node.className = 'lib-state warn';
      node.textContent = 'PDF-Funktionen nicht verfügbar (siehe vendor/README.md)';
    }
  });
}

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  initUI();
  initMenus();
  initKeys();
  initDrop();
  initLibState();
  newDocument(1600, 1000, false);
  state.name = 'Unbenannt';
  say('Bereit – alles läuft lokal auf diesem Rechner');
  window.addEventListener('resize', () => scheduleRender());
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  /* Kleine Schnittstelle für die Browser-Konsole und automatische Tests */
  window.bildwerk = { state, page, run, importPdf, exportPdf, notify, fitZoom };
}

document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
