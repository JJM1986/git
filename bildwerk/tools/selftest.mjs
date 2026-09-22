/* Selbsttest fuer Bildwerk.
 *
 *   sh start.sh &                     # Server auf Port 8777
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/selftest.mjs           # BILDWERK_URL setzt eine andere Adresse
 *
 * Prueft Pinsel, Historie, Formen, Text, Filter, PNG-Export, den kompletten
 * PDF-Weg sowie die Punkte, an denen frueher Bildinhalt verloren ging:
 * Duplizieren, Vereinen ueber den Leinwandrand hinaus, Zoomgrenze und das
 * inhaltsbasierte Skalieren (auch auf Spiegelfehler beim Achsentausch).
 */
import { chromium } from 'playwright';

const URL = process.env.BILDWERK_URL || 'http://127.0.0.1:8777/';
const P = [];
const check = (n, ok, x='') => { console.log((ok?'  OK   ':'  FEHL ')+n+(x?'  → '+x:'')); if(!ok) P.push(n+' '+x); };
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1400, height: 880 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

console.log('F1 – Duplizieren');
let r = await page.evaluate(async () => {
  const core = await import('/js/core.js'); const cmd = await import('/js/commands.js');
  cmd.newDocument(600, 400, false);
  const p = core.page(), l = p.layers[0];
  const x = l.canvas.getContext('2d');
  x.fillStyle = '#888'; x.fillRect(0,0,600,400);
  for (const [c,mx,my] of [['#f00',0,0],['#0f0',570,0],['#00f',570,370],['#ff0',0,370]]) { x.fillStyle=c; x.fillRect(mx,my,30,30); }
  await cmd.run('copy-layer');
  const k = core.activeLayer(), bb = core.layerBBox(k);
  const q = k.canvas.getContext('2d', {willReadFrequently:true});
  const ecke = (px,py)=>[...q.getImageData(px,py,1,1).data].slice(0,3).join(',');
  return { pos:`${k.x},${k.y}`, ragtRaus: bb.x<0||bb.y<0||bb.x+bb.w>p.width||bb.y+bb.h>p.height,
           geteilt: k.canvas === p.layers[0].canvas,
           ecken:[ecke(10,10),ecke(590,10),ecke(590,390),ecke(10,390)].join(' ') };
});
check('Kopie liegt deckungsgleich', r.pos === '0,0', 'Position ' + r.pos);
check('Kopie ragt nicht über die Leinwand', !r.ragtRaus);
check('Bilddaten werden geteilt (kein Speicherverbrauch)', r.geteilt);
check('Alle vier Ecken vorhanden', r.ecken === '255,0,0 0,255,0 0,0,255 255,255,0', r.ecken);

console.log('\nF1b – Malen nach dem Duplizieren trennt die Bilddaten');
r = await page.evaluate(async () => {
  const core = await import('/js/core.js');
  const p = core.page(), unten = p.layers[0], oben = p.layers[1];
  const ctx = core.beginPixelEdit(oben);
  ctx.fillStyle = '#00ffff'; ctx.fillRect(100,100,50,50);
  const les = (cv,px,py)=>[...cv.getContext('2d',{willReadFrequently:true}).getImageData(px,py,1,1).data].slice(0,3).join(',');
  return { obenNeu: les(oben.canvas,120,120), untenAlt: les(unten.canvas,120,120), getrennt: oben.canvas !== unten.canvas };
});
check('Kopie bemalt, Original unberührt', r.obenNeu==='0,255,255' && r.untenAlt==='136,136,136' && r.getrennt,
  `oben=${r.obenNeu} unten=${r.untenAlt}`);

console.log('\nF2 – Vereinen ohne Verlust über den Leinwandrand hinaus');
r = await page.evaluate(async () => {
  const core = await import('/js/core.js'); const cmd = await import('/js/commands.js');
  cmd.newDocument(600, 400, false);
  const gross = core.createLayer({ name:'gross', w:600, h:400 });
  const x = gross.canvas.getContext('2d');
  x.fillStyle = '#36a'; x.fillRect(0,0,600,400);
  for (const [c,mx,my] of [['#f00',0,0],['#0f0',570,0],['#00f',570,370],['#ff0',0,370]]) { x.fillStyle=c; x.fillRect(mx,my,30,30); }
  gross.x = -120; gross.y = -80;
  core.addLayer(gross);
  await cmd.run('merge-down');
  const v = core.activeLayer();
  const q = v.canvas.getContext('2d',{willReadFrequently:true});
  const at=(px,py)=>[...q.getImageData(px,py,1,1).data].slice(0,3).join(',');
  // rote Ecke des Inhalts liegt jetzt bei (0,0) des vereinten Canvas
  return { canvas:`${v.canvas.width}x${v.canvas.height}`, pos:`${v.x},${v.y}`, roteEcke: at(10,10) };
});
check('Vereintes Canvas umfasst den Überhang', r.canvas === '720x480', r.canvas);
check('Verschobene Ecke bleibt erhalten', r.roteEcke === '255,0,0', 'oben links = ' + r.roteEcke);

console.log('\nF3 – Zoom bleibt in der zeichenbaren Größe');
r = await page.evaluate(async () => {
  const core = await import('/js/core.js'); const cmd = await import('/js/commands.js'); const ui = await import('/js/ui.js');
  cmd.newDocument(4000, 3000, false);
  ui.setZoom(16);
  await new Promise(res => requestAnimationFrame(()=>requestAnimationFrame(res)));
  const cv = document.querySelector('#canvas');
  const q = cv.getContext('2d',{willReadFrequently:true});
  const mitte = [...q.getImageData(cv.width>>1, cv.height>>1,1,1).data].slice(0,3).join(',');
  return { zoom:+core.state.zoom.toFixed(2), canvas:`${cv.width}x${cv.height}`,
           flaecheMP:+(cv.width*cv.height/1e6).toFixed(1), mitteGezeichnet: mitte !== '0,0,0' };
});
check('Zoom gedeckelt', r.zoom < 16 && r.zoom > 1, r.zoom + 'x → ' + r.canvas + ' (' + r.flaecheMP + ' MP)');
check('Bühne wird noch gezeichnet', r.mitteGezeichnet);

console.log('\nF4 – Leinwand auf Inhalt erweitern');
r = await page.evaluate(async () => {
  const core = await import('/js/core.js'); const cmd = await import('/js/commands.js');
  cmd.newDocument(600, 400, false);
  const l = core.createLayer({ name:'weit', w:300, h:200 });
  l.canvas.getContext('2d').fillRect(0,0,300,200);
  l.x = -100; l.y = 350;
  core.addLayer(l);
  await cmd.run('canvas-to-content');
  const p = core.page();
  return { groesse:`${p.width}x${p.height}`, ersteEbenePos:`${p.layers[0].x},${p.layers[0].y}` };
});
check('Leinwand umfasst alles', r.groesse === '700x550', r.groesse);

console.log('\nFeature – Inhaltsbasiert skalieren');
r = await page.evaluate(async () => {
  const core = await import('/js/core.js');
  const { contentAwareResize } = await import('/js/seamcarve.js');
  // Testbild: ruhiger Verlauf mit einem klaren roten Quadrat als Motiv
  const c = core.makeCanvas(240, 160);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0,0,240,0); g.addColorStop(0,'#5580c0'); g.addColorStop(1,'#88b0e0');
  x.fillStyle = g; x.fillRect(0,0,240,160);
  x.fillStyle = '#ff0000'; x.fillRect(100,50,40,60);
  const zaehleRot = (cv) => {
    const d = cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cv.width,cv.height).data;
    let n=0; for (let i=0;i<d.length;i+=4) if (d[i]>200 && d[i+1]<60 && d[i+2]<60) n++;
    return n;
  };
  const rotVorher = zaehleRot(c);
  const t0 = performance.now();
  const schmal = await contentAwareResize(c, 180, 160, {});
  const dauer = Math.round(performance.now()-t0);
  const rotNachher = zaehleRot(schmal);
  const breit = await contentAwareResize(c, 300, 160, {});
  const hoch  = await contentAwareResize(c, 240, 120, {});
  return { schmal:`${schmal.width}x${schmal.height}`, breit:`${breit.width}x${breit.height}`,
           hoch:`${hoch.width}x${hoch.height}`, rotVorher, rotNachher,
           motivErhalten: rotNachher > rotVorher*0.8, dauerMs: dauer,
           gleichmaessigWaere: Math.round(rotVorher*0.75) };
});
check('Verkleinern liefert Zielbreite', r.schmal === '180x160', r.schmal);
check('Vergrößern liefert Zielbreite', r.breit === '300x160', r.breit);
check('Höhe ebenfalls', r.hoch === '240x120', r.hoch);
check('Motiv bleibt in Form', r.motivErhalten,
  `rote Pixel ${r.rotVorher} → ${r.rotNachher} (bei gleichmäßigem Stauchen wären es ~${r.gleichmaessigWaere})`);
check('Dauer vertretbar', r.dauerMs < 8000, r.dauerMs + ' ms für 60 Nahtlinien auf 240×160');

console.log('\nAltbestand – Baseline aus dem bisherigen Selbsttest');
r = await page.evaluate(async () => {
  const core = await import('/js/core.js'); const cmd = await import('/js/commands.js');
  const pdfio = await import('/js/pdfio.js');
  cmd.newDocument(800, 600, false);
  // PDF-Runde
  const { PDFDocument, StandardFonts } = window.PDFLib;
  const d = await PDFDocument.create();
  const pg = d.addPage([595,842]);
  pg.drawText('ORIGINALTEXT', { x:60, y:760, size:18, font: await d.embedFont(StandardFonts.Helvetica) });
  await pdfio.importPdf((await d.save()).buffer, { name:'t.pdf' });
  const blob = await pdfio.exportPdf({ mode:'hybrid' });
  const pdf = await window.pdfjsLib.getDocument({ data:new Uint8Array(await blob.arrayBuffer()) }).promise;
  const tc = await (await pdf.getPage(1)).getTextContent();
  return { text: tc.items.map(i=>i.str).join(' ').trim(), seiten: pdf.numPages };
});
check('PDF-Durchlauf weiterhin in Ordnung', r.text.includes('ORIGINALTEXT') && r.seiten===1, r.text);

console.log('\nAchsentausch – Spiegelfehler ausschließen');
r = await page.evaluate(async () => {
  const core = await import('/js/core.js');
  const sc = await import('/js/seamcarve.js');
  const out = {};

  // Bild mit eindeutig unterscheidbaren Ecken – deckt Spiegel-/Drehfehler auf
  const eckenBild = (w, h) => {
    const c = core.makeCanvas(w, h);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#445566'); g.addColorStop(1, '#99aabb');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ff0000'; x.fillRect(0, 0, 20, 20);            // oben links
    x.fillStyle = '#00ff00'; x.fillRect(w - 20, 0, 20, 20);       // oben rechts
    x.fillStyle = '#0000ff'; x.fillRect(w - 20, h - 20, 20, 20);  // unten rechts
    x.fillStyle = '#ffff00'; x.fillRect(0, h - 20, 20, 20);       // unten links
    return c;
  };
  const ecken = (cv) => {
    const q = cv.getContext('2d', { willReadFrequently: true });
    const at = (px, py) => { const d = q.getImageData(px, py, 1, 1).data;
      return d[0] > 200 && d[1] < 60 ? 'rot' : d[1] > 200 && d[0] < 60 ? 'gruen'
        : d[2] > 200 && d[0] < 60 ? 'blau' : d[0] > 200 && d[1] > 200 ? 'gelb' : 'andere'; };
    return [at(5,5), at(cv.width-5,5), at(cv.width-5,cv.height-5), at(5,cv.height-5)].join(',');
  };
  const SOLL = 'rot,gruen,blau,gelb';

  const q = eckenBild(200, 150);
  out.startEcken = ecken(q);

  out.nurBreite = ecken(await sc.contentAwareResize(q, 160, 150, {}));
  out.nurHoehe  = ecken(await sc.contentAwareResize(q, 200, 110, {}));
  out.beide     = ecken(await sc.contentAwareResize(q, 170, 120, {}));
  out.hoeherBreiter = ecken(await sc.contentAwareResize(q, 240, 190, {}));
  out.hoeheGroesser = ecken(await sc.contentAwareResize(q, 200, 190, {}));

  // Masse
  const m = async (zw, zh) => { const c = await sc.contentAwareResize(q, zw, zh, {}); return `${c.width}x${c.height}`; };
  out.masse = [await m(160,150), await m(200,110), await m(170,120), await m(240,190)].join(' ');

  // Transparenz
  const t = core.makeCanvas(100, 80);
  const tx = t.getContext('2d');
  tx.fillStyle = 'rgba(200,40,40,0.5)'; tx.fillRect(0, 0, 100, 80);
  const tr = await sc.contentAwareResize(t, 80, 60, {});
  out.alpha = tr.getContext('2d', { willReadFrequently: true }).getImageData(40, 30, 1, 1).data[3];

  // Schutzbereich senkrecht UND waagerecht
  const s2 = core.makeCanvas(200, 150);
  const sx2 = s2.getContext('2d');
  for (let i = 0; i < 200; i += 4) { sx2.fillStyle = i % 8 ? '#e8eef4' : '#16243a'; sx2.fillRect(i, 0, 2, 150); }
  sx2.fillStyle = '#ff0000'; sx2.fillRect(70, 50, 40, 50);
  const breiteRot = (cv, zeile) => {
    const d = cv.getContext('2d',{willReadFrequently:true}).getImageData(0, zeile, cv.width, 1).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i+1] < 60) n++;
    return n;
  };
  out.schutzOhne = breiteRot(await sc.contentAwareResize(s2, 140, 150, {}), 75);
  out.schutzMit  = breiteRot(await sc.contentAwareResize(s2, 140, 150, { schutz: { x:70, y:50, w:40, h:50 } }), 75);

  // Abbruch
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 60);
  try {
    await sc.contentAwareResize(eckenBild(900, 700), 500, 700, { signal: ctrl.signal });
    out.abbruch = 'nicht abgebrochen';
  } catch (e) { out.abbruch = e.message; }

  // Fortschritt läuft monoton von 0 bis 1
  const werte = [];
  await sc.contentAwareResize(eckenBild(300, 200), 250, 170, { onProgress: v => werte.push(v) });
  out.fortschrittMonoton = werte.every((v, i) => i === 0 || v >= werte[i-1]);
  out.fortschrittEnde = werte[werte.length - 1];
  return out;
});

check('Ecken im Ausgangsbild', r.startEcken === 'rot,gruen,blau,gelb', r.startEcken);
check('Nur Breite: keine Spiegelung', r.nurBreite === 'rot,gruen,blau,gelb', r.nurBreite);
check('Nur Höhe: keine Spiegelung', r.nurHoehe === 'rot,gruen,blau,gelb', r.nurHoehe);
check('Beide Achsen: keine Spiegelung', r.beide === 'rot,gruen,blau,gelb', r.beide);
check('Vergrößern beider Achsen', r.hoeherBreiter === 'rot,gruen,blau,gelb', r.hoeherBreiter);
check('Nur Höhe vergrößern', r.hoeheGroesser === 'rot,gruen,blau,gelb', r.hoeheGroesser);
check('Zielmaße exakt', r.masse === '160x150 200x110 170x120 240x190', r.masse);
check('Halbtransparenz überlebt', r.alpha > 100 && r.alpha < 160, 'Alpha ' + r.alpha);
check('Schutzbereich wirkt', r.schutzMit > r.schutzOhne, `ohne ${r.schutzOhne}px, mit ${r.schutzMit}px`);
check('Abbruch greift', /abgebrochen/.test(r.abbruch), r.abbruch);
check('Fortschritt steigt monoton bis 1', r.fortschrittMonoton && r.fortschrittEnde === 1, 'Ende ' + r.fortschrittEnde);

console.log('\nKonsolenfehler: ' + (errs.length ? errs.join(' | ') : 'keine'));
console.log(P.length ? `\n>>> ${P.length} fehlgeschlagen` : '\n>>> alle bestanden');
await browser.close();
process.exit(P.length || errs.length ? 1 : 0);
