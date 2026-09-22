#!/bin/sh
# Laedt pdf.js und pdf-lib einmalig hierher, damit Bildwerk auch
# ohne Internetverbindung PDFs oeffnen und schreiben kann (~3 MB).
set -e
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PDFJS=3.11.174
PDFLIB=1.17.1

# $1 = Pfad ab dem Paketnamen, $2 = Zieldatei
fetch() {
  echo "  $2"
  for BASE in "https://cdn.jsdelivr.net/npm" "https://unpkg.com"; do
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "$BASE/$1" -o "$DIR/$2" && return 0
    else
      wget -q "$BASE/$1" -O "$DIR/$2" && return 0
    fi
  done
  return 1
}

echo "Lade PDF-Bibliotheken nach vendor/ ..."
if fetch "pdfjs-dist@$PDFJS/build/pdf.min.js" pdf.min.js &&
   fetch "pdfjs-dist@$PDFJS/build/pdf.worker.min.js" pdf.worker.min.js &&
   fetch "pdf-lib@$PDFLIB/dist/pdf-lib.min.js" pdf-lib.min.js; then
  echo "Fertig. Bildwerk arbeitet jetzt vollstaendig offline."
  exit 0
fi

# Zweiter Weg fuer Netze, die CDNs sperren: ueber die npm-Registry
echo "CDN nicht erreichbar, versuche npm ..."
command -v npm >/dev/null 2>&1 || {
  echo "npm fehlt ebenfalls - bitte die drei Dateien von Hand nach vendor/ legen."
  exit 1
}
TMP=$(mktemp -d)
( cd "$TMP" && npm pack "pdfjs-dist@$PDFJS" "pdf-lib@$PDFLIB" >/dev/null 2>&1 &&
  for T in *.tgz; do tar xzf "$T"; done )
cp "$TMP/package/build/pdf.min.js" "$TMP/package/build/pdf.worker.min.js" \
   "$TMP/package/dist/pdf-lib.min.js" "$DIR/" 2>/dev/null ||
  { echo "Fehlgeschlagen."; rm -rf "$TMP"; exit 1; }
rm -rf "$TMP"
echo "Fertig (ueber npm). Bildwerk arbeitet jetzt vollstaendig offline."
