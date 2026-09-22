/* Selbsttest fuer Bildwerk.
 *
 *   sh start.sh &                     # Server auf Port 8777
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/selftest.mjs           # BILDWERK_URL setzt eine andere Adresse
 *
 * Prueft Pinsel, Historie, Formen, Text, Filter, PNG-Export sowie den
 * kompletten PDF-Weg (oeffnen, Text ergaenzen, exportieren, Text wieder
 * auslesen).
 */
import { chromium } from 'playwright';

const URL = process.env.BILDWERK_URL || 'http://127.0.0.1:8777/';

const problems = [];
const check = (name, cond, extra='') => {
  console.log((cond ? '  OK   ' : '  FEHL ') + name + (extra ? '  → ' + extra : ''));
  if (!cond) problems.push(name + ' ' + extra);
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

check('Dialog beim Start verborgen', await page.locator('#modal').isHidden());

const box = async () => (await page.locator('#canvas').boundingBox());

/* --- 1. Pinsel --- */
console.log('\n1) Pinsel');
await page.keyboard.press('b');
let b = await box();
await page.mouse.move(b.x + 120, b.y + 120);
await page.mouse.down();
await page.mouse.move(b.x + 320, b.y + 220, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(150);
let r = await page.evaluate(() => {
  const s = window.bildwerk.state, p = s.pages[0], l = p.layers[p.layers.length-1];
  const d = l.canvas.getContext('2d').getImageData(0,0,l.canvas.width,l.canvas.height).data;
  let painted = 0;
  for (let i=3;i<d.length;i+=4) if (d[i]>10) painted++;
  return { layers: p.layers.length, painted };
});
check('Pinselstrich erzeugt Pixel', r.painted > 500, r.painted + ' Pixel');

/* --- 2. Rückgängig --- */
console.log('\n2) Rückgängig / Wiederholen');
await page.keyboard.press('Control+z');
await page.waitForTimeout(120);
let after = await page.evaluate(() => {
  const p = window.bildwerk.state.pages[0], l = p.layers[p.layers.length-1];
  const d = l.canvas.getContext('2d').getImageData(0,0,l.canvas.width,l.canvas.height).data;
  let n=0; for (let i=3;i<d.length;i+=4) if (d[i]>10) n++;
  return n;
});
check('Rückgängig entfernt den Strich', after === 0, after + ' Pixel übrig');
await page.keyboard.press('Control+y');
await page.waitForTimeout(120);
after = await page.evaluate(() => {
  const p = window.bildwerk.state.pages[0], l = p.layers[p.layers.length-1];
  const d = l.canvas.getContext('2d').getImageData(0,0,l.canvas.width,l.canvas.height).data;
  let n=0; for (let i=3;i<d.length;i+=4) if (d[i]>10) n++;
  return n;
});
check('Wiederholen stellt ihn her', after > 500, after + ' Pixel');

/* --- 3. Form --- */
console.log('\n3) Rechteck');
await page.keyboard.press('u');
b = await box();
await page.mouse.move(b.x + 420, b.y + 120);
await page.mouse.down();
await page.mouse.move(b.x + 620, b.y + 260, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(120);
r = await page.evaluate(() => {
  const p = window.bildwerk.state.pages[0], l = p.layers[p.layers.length-1];
  return { type: l.type, w: l.canvas.width, h: l.canvas.height, kind: l.shape?.kind };
});
check('Formebene entsteht', r.type === 'shape' && r.kind === 'rect' && r.w > 50, JSON.stringify(r));

/* --- 4. Text --- */
console.log('\n4) Textebene');
await page.evaluate(() => window.bildwerk.run('add-text'));
await page.waitForTimeout(200);
await page.fill('#t-content', 'Bildwerk Test');
await page.dispatchEvent('#t-content', 'input');
await page.fill('#t-size', '72');
await page.dispatchEvent('#t-size', 'input');
await page.waitForTimeout(200);
r = await page.evaluate(() => {
  const p = window.bildwerk.state.pages[0], l = p.layers[p.layers.length-1];
  return { type: l.type, content: l.text?.content, size: l.text?.size, w: l.canvas.width };
});
check('Text wird übernommen und neu gesetzt', r.type==='text' && r.content==='Bildwerk Test' && r.size===72 && r.w>200, JSON.stringify(r));

/* --- 5. Anpassung + Filter --- */
console.log('\n5) Anpassungen und Filter');
await page.evaluate(() => {
  const s = window.bildwerk.state, p = s.pages[0];
  p.activeLayerId = p.layers[0].id;
});
await page.evaluate(() => {
  const p = window.bildwerk.state.pages[0];
  p.layers[0].adjust.brightness = 160;
});
await page.evaluate(() => window.bildwerk.run('bake-adjust'));
await page.waitForTimeout(200);
r = await page.evaluate(() => window.bildwerk.state.pages[0].layers[0].adjust.brightness);
check('Anpassung wird eingerechnet und zurückgesetzt', r === 100, 'brightness=' + r);

/* --- 6. PNG-Export --- */
console.log('\n6) PNG-Export');
r = await page.evaluate(async () => {
  const { pageToCanvas } = await import('/js/core.js');
  const c = pageToCanvas(window.bildwerk.page(), 1, false);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  return { w: c.width, h: c.height, bytes: blob.size };
});
check('PNG in Dokumentgröße', r.w === 1600 && r.h === 1000 && r.bytes > 2000, JSON.stringify(r));



/* --- 7. PDF öffnen und exportieren --- */
console.log('\n7) PDF-Durchlauf');
r = await page.evaluate(async () => {
  const { PDFDocument, StandardFonts } = window.PDFLib;
  const doc = await PDFDocument.create();
  const pg = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  pg.drawText('ORIGINALTEXT AUS DEM PDF', { x: 60, y: 760, size: 18, font });
  const pg2 = doc.addPage([595, 842]);
  pg2.drawText('Seite zwei', { x: 60, y: 760, size: 18, font });
  const bytes = await doc.save();

  const pdfio = await import('/js/pdfio.js');
  await pdfio.importPdf(bytes.buffer, { name: 'test.pdf' });
  const s = window.bildwerk.state;
  return { pages: s.pages.length, w: Math.round(s.pages[0].width), pdfPoints: s.pages[0].pdfPoints, layers: s.pages[0].layers.length };
});
check('PDF mit 2 Seiten geladen', r.pages === 2 && r.w > 500, JSON.stringify(r));

r = await page.evaluate(async () => {
  const core = await import('/js/core.js');
  const t = core.defaultText('Neu hinzugefuegter Text');
  t.size = 24; t.color = '#c00000';
  const l = core.createLayer({ name: 'Zusatz', type: 'text', text: t });
  core.refreshLayer(l);
  l.x = 60; l.y = 300;
  core.addLayer(l);
  const pdfio = await import('/js/pdfio.js');
  const blob = await pdfio.exportPdf({ mode: 'hybrid', format: 'jpeg', quality: 0.9 });
  const buf = await blob.arrayBuffer();

  const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    text += c.items.map(x => x.str).join(' ') + '\n';
  }
  return { size: blob.size, pages: doc.numPages, text };
});
check('PDF-Export hat 2 Seiten', r.pages === 2, JSON.stringify({size: r.size, pages: r.pages}));
check('Originaltext bleibt echter Text', r.text.includes('ORIGINALTEXT AUS DEM PDF'), JSON.stringify(r.text));
check('Neue Textebene wird echter PDF-Text', r.text.includes('Neu hinzugefuegter Text'), JSON.stringify(r.text));

r = await page.evaluate(async () => {
  const pdfio = await import('/js/pdfio.js');
  const blob = await pdfio.exportPdf({ mode: 'flat', format: 'jpeg', quality: 0.85 });
  return blob.size;
});
check('Rasterexport erzeugt PDF', r > 5000, r + ' Bytes');



console.log('\nKonsolenfehler: ' + (errors.length ? '\n' + errors.join('\n') : 'keine'));
console.log(problems.length ? '\n>>> ' + problems.length + ' Test(s) fehlgeschlagen' : '\n>>> alle Tests bestanden');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
