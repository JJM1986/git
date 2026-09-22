#!/usr/bin/env python3
"""Baut aus den Einzeldateien eine einzige HTML-Datei.

Das Ergebnis (bildwerk-standalone.html) laesst sich per Doppelklick im
Browser oeffnen, ohne lokalen Webserver. Die beiden PDF-Bibliotheken
werden weiterhin aus dem danebenliegenden Ordner vendor/ geladen (oder,
falls der fehlt, vom CDN).

Aufruf:  python3 tools/build-standalone.py
"""
import re
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


def main() -> None:
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
                        '<script>\n' + loader + '\n</script>')
    html = html.replace('<script type="module" src="js/main.js"></script>',
                        '<script type="module">\n' + bundle + '\n</script>')

    out = ROOT / 'bildwerk-standalone.html'
    out.write_text(html, encoding='utf-8')
    kb = out.stat().st_size / 1024
    print(f'geschrieben: {out.relative_to(ROOT)}  ({kb:.0f} KB)')


if __name__ == '__main__':
    main()
