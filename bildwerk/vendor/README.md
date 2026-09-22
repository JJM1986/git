# vendor/

Hier liegen die beiden Fremdbibliotheken für die PDF-Funktionen:

| Datei | Zweck | Lizenz |
|---|---|---|
| `pdf.min.js` + `pdf.worker.min.js` | PDF-Seiten lesen und anzeigen (Mozilla pdf.js) | Apache-2.0 |
| `pdf-lib.min.js` | PDF-Dateien schreiben und Seiten übernehmen | MIT |

Einmalig holen:

```sh
sh vendor/get-libs.sh
```

Ohne diese Dateien versucht Bildwerk, die Bibliotheken von einem CDN zu laden.
Schlägt auch das fehl, bleibt der Bildeditor voll nutzbar – nur PDF-Öffnen und
PDF-Export sind dann abgeschaltet (die Statusleiste sagt es an).
