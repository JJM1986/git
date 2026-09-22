/* Bildwerk – lädt die beiden PDF-Bibliotheken.
   Bevorzugt lokale Kopien in vendor/ (vollständig offline),
   fällt sonst einmalig auf ein CDN zurück. Ohne beides bleiben
   nur die PDF-Funktionen deaktiviert; der Bildeditor läuft weiter. */
(function () {
  const LIBS = [
    {
      key: 'pdflib', label: 'pdf-lib',
      local: 'vendor/pdf-lib.min.js',
      cdn: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
      ok: () => !!window.PDFLib,
    },
    {
      key: 'pdfjs', label: 'pdf.js',
      local: 'vendor/pdf.min.js',
      cdn: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
      ok: () => !!window.pdfjsLib,
      after(fromLocal) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = fromLocal
          ? 'vendor/pdf.worker.min.js'
          : 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      },
    },
  ];

  function load(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error('nicht ladbar: ' + url));
      document.head.appendChild(s);
    });
  }

  async function one(lib) {
    for (const [src, isLocal] of [[lib.local, true], [lib.cdn, false]]) {
      try {
        await load(src);
        if (!lib.ok()) continue;
        lib.after?.(isLocal);
        return { key: lib.key, label: lib.label, ok: true, local: isLocal };
      } catch (_) { /* nächste Quelle */ }
    }
    return { key: lib.key, label: lib.label, ok: false };
  }

  window.bildwerkLibs = Promise.all(LIBS.map(one)).then(res => {
    const map = {};
    for (const r of res) map[r.key] = r;
    window.bildwerkLibState = map;
    return map;
  });
})();
