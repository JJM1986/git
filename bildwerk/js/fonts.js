/* Bildwerk – Schriftverwaltung: Systemschriften plus eigene Schriftdateien. */

export const SYSTEM_FONTS = [
  // Hausschrift nach EFCO Brand Book; Arial ist dort der vorgesehene Ersatz
  ['"Panton", Arial, Helvetica, sans-serif', 'Panton (Hausschrift)'],
  ['Arial, Helvetica, sans-serif', 'Arial (EFCO Office)'],
  ['system-ui, sans-serif', 'System (serifenlos)'],
  ['"Helvetica Neue", Helvetica, sans-serif', 'Helvetica Neue'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, sans-serif', 'Tahoma'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet MS'],
  ['Impact, Haettenschweiler, sans-serif', 'Impact'],
  ['"Segoe UI", Roboto, sans-serif', 'Segoe UI / Roboto'],
  ['Georgia, serif', 'Georgia'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['Garamond, serif', 'Garamond'],
  ['"Palatino Linotype", Palatino, serif', 'Palatino'],
  ['"Courier New", Courier, monospace', 'Courier New'],
  ['"Consolas", ui-monospace, monospace', 'Consolas'],
  ['cursive', 'Schreibschrift (System)'],
  ['fantasy', 'Dekorativ (System)'],
];

/** Vom Nutzer geladene Schriften: name -> dataURL (wird im Projekt mitgespeichert) */
export const customFonts = new Map();

function familyName(fileName) {
  return fileName.replace(/\.(ttf|otf|woff2?|ttc)$/i, '').replace(/[^\w\s-]/g, '').trim() || 'Eigene Schrift';
}

export async function registerFont(name, dataUrl) {
  const face = new FontFace(name, `url(${dataUrl})`);
  await face.load();
  document.fonts.add(face);
  customFonts.set(name, dataUrl);
  return name;
}

export async function loadFontFile(file) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return registerFont(familyName(file.name), dataUrl);
}

export async function restoreFonts(map) {
  for (const [name, url] of Object.entries(map || {})) {
    try { await registerFont(name, url); } catch (e) { console.warn('Schrift nicht ladbar:', name, e); }
  }
}

export function fontOptions() {
  const custom = [...customFonts.keys()].map(n => [`"${n}"`, n + ' (geladen)']);
  return [...custom, ...SYSTEM_FONTS];
}

export function serializeFonts() {
  return Object.fromEntries(customFonts);
}
