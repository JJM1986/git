#!/usr/bin/env python3
"""Baut aus den Einzeldateien eine einzige HTML-Datei.

Ohne Argument entsteht bildwerk-standalone.html (rund 110 KB). Sie laesst
sich per Doppelklick oeffnen; die beiden PDF-Bibliotheken holt sie aus dem
danebenliegenden Ordner vendor/ oder, falls der fehlt, vom CDN.

Mit --embed entsteht zusaetzlich bildwerk-komplett.html (rund 2 MB). Darin
stecken auch pdf.js und pdf-lib, sodass die Datei voellig fuer sich allein
steht: kein vendor/, kein Server, keine Internetverbindung.

Aufruf:  python3 tools/build-standalone.py [--embed]
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Reihenfolge entspricht der Abhaengigkeit der Module untereinander.
MODULES = ['core.js', 'filters.js', 'fonts.js', 'tools.js', 'pdfio.js',
           'ui.js', 'commands.js', 'main.js']

# Statt der Namensraum-Importe (import * as F) im gebuendelten Code:
NAMESPACES = """
/* Namensraeume, die im Modulbetrieb aus `import * as ...` stammen */
const F = { bakeAdjust, convolve, sharpen, edges, emboss, softBlur, pixelate,
  noise, posterize, threshold, autoLevel, vignette, flip, rotate90,
  floodFill, hexToRgb, rgbToHex };
const PDF = { pdfSources, pdfjsReady, pdfLibReady, importPdf, addBlankPage,
  duplicatePage, deletePage, rotatePage, movePage, exportPdf };
"""

IMPORT_RE = re.compile(r"^import\s+[\s\S]*?from\s+'[^']+';\s*$", re.M)
IMPORT_BARE_RE = re.compile(r"^import\s+'[^']+';\s*$", re.M)
REEXPORT_RE = re.compile(r"^export\s*\{[^}]*\}\s*;\s*$", re.M)
EXPORT_RE = re.compile(r"^export\s+", re.M)


def strip_module(src: str) -> str:
    src = IMPORT_RE.sub('', src)
    src = IMPORT_BARE_RE.sub('', src)
    src = REEXPORT_RE.sub('', src)
    return EXPORT_RE.sub('', src)


def embedded_loader() -> str:
    """Die drei Fremddateien direkt einbetten statt sie nachzuladen.

    pdf.js braucht seinen Worker als eigene Datei; dafuer wird der
    Quelltext in einem Textblock abgelegt und zur Laufzeit in eine
    Blob-Adresse verwandelt. Klappt das nicht (manche Browser verbieten
    das bei file://), bleibt der Rest der Anwendung benutzbar.
    """
    vendor = ROOT / 'vendor'
    need = ['pdf-lib.min.js', 'pdf.min.js', 'pdf.worker.min.js']
    missing = [n for n in need if not (vendor / n).exists()]
    if missing:
        sys.exit('fehlende Dateien in vendor/: ' + ', '.join(missing) +
                 '\nzuerst  sh vendor/get-libs.sh  ausfuehren')

    for name in need:
        if '</script' in (vendor / name).read_text(encoding='utf-8', errors='replace'):
            sys.exit(f'{name} enthaelt "</script" und laesst sich so nicht einbetten')

    pdflib = (vendor / 'pdf-lib.min.js').read_text(encoding='utf-8')
    pdfjs = (vendor / 'pdf.min.js').read_text(encoding='utf-8')
    worker = (vendor / 'pdf.worker.min.js').read_text(encoding='utf-8')

    return (
        '<script>\n' + pdflib + '\n</script>\n'
        '<script>\n' + pdfjs + '\n</script>\n'
        '<script id="pdfjs-worker-source" type="text/plain">\n' + worker + '\n</script>\n'
        '<script>\n' + EMBED_INIT + '\n</script>'
    )


EMBED_INIT = """/* Bildwerk: eingebettete Bibliotheken bereitstellen */
(function () {
  var state = {
    pdflib: { key: 'pdflib', label: 'pdf-lib', ok: !!window.PDFLib, local: true },
    pdfjs: { key: 'pdfjs', label: 'pdf.js', ok: !!window.pdfjsLib, local: true },
  };
  try {
    var src = document.getElementById('pdfjs-worker-source').textContent;
    var url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = url;
  } catch (e) {
    console.warn('PDF-Worker liess sich nicht einrichten:', e);
    state.pdfjs.ok = false;
  }
  window.bildwerkLibState = state;
  window.bildwerkLibs = Promise.resolve(state);
})();"""


def main() -> None:
    embed = '--embed' in sys.argv[1:]
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'css' / 'app.css').read_text(encoding='utf-8')
    loader = (ROOT / 'js' / 'vendorloader.js').read_text(encoding='utf-8')

    parts = []
    for name in MODULES:
        src = strip_module((ROOT / 'js' / name).read_text(encoding='utf-8'))
        if name == 'commands.js':
            parts.append(NAMESPACES)
        parts.append(f'\n/* ================= {name} ================= */\n{src}')
    bundle = ''.join(parts)

    html = html.replace('<link rel="stylesheet" href="css/app.css">',
                        '<style>\n' + css + '\n</style>')
    html = html.replace('<script src="js/vendorloader.js"></script>',
                        embedded_loader() if embed else '<script>\n' + loader + '\n</script>')
    html = html.replace('<script type="module" src="js/main.js"></script>',
                        '<script type="module">\n' + bundle + '\n</script>')

    out = ROOT / ('bildwerk-komplett.html' if embed else 'bildwerk-standalone.html')
    out.write_text(html, encoding='utf-8')
    kb = out.stat().st_size / 1024
    print(f'geschrieben: {out.relative_to(ROOT)}  ({kb:.0f} KB)')


if __name__ == '__main__':
    main()
