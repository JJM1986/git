# Bildwerk

Ein Bild- und PDF-Editor, der vollständig **lokal auf Ihrem Rechner** läuft:
im Browser, ohne Installation, ohne Konto, ohne Server. Keine Datei verlässt
den Rechner – es gibt keine Netzwerkverbindung im Programm.

Der komplette Editor belegt rund **110 KB**. Mit den beiden optionalen
PDF-Bibliotheken sind es etwa **2 MB**.

![Werkzeuge links, Bühne in der Mitte, Ebenen und Anpassungen rechts](docs/screenshot.png)

## Starten

**Weg 1 – Doppelklick (am einfachsten)**

`bildwerk-komplett.html` im Browser öffnen. Diese eine Datei (2 MB) enthält
wirklich alles, auch die beiden PDF-Bibliotheken: kein Ordner daneben, kein
Server, keine Internetverbindung. Kopieren Sie sie hin, wo Sie wollen.

Sie ist nicht eingecheckt, weil sie fremden Bibliothekscode mitbringt.
Einmal erzeugen:

```sh
sh vendor/get-libs.sh                            # holt pdf.js und pdf-lib
python3 tools/build-standalone.py --embed        # baut bildwerk-komplett.html
```

Die mitgelieferte `bildwerk-standalone.html` (107 KB) ist dieselbe Anwendung
ohne eingebettete PDF-Bibliotheken; sie sucht diese in `vendor/` daneben oder
holt sie beim ersten Start von einem CDN.

**Weg 2 – mit kleinem lokalem Webserver**

```sh
sh start.sh            # Linux/macOS  (Windows: start.cmd doppelklicken)
```

Öffnet automatisch http://127.0.0.1:8777/. Dieser Weg lädt die Einzelmodule
aus `js/` und eignet sich, wenn Sie am Programm selbst etwas ändern wollen.

**PDF-Funktionen freischalten (einmalig, ~1,9 MB)**

```sh
sh vendor/get-libs.sh
```

Nötig für Weg 2 und für den Bau von `bildwerk-komplett.html`. Ohne diesen
Schritt versucht das Programm, die beiden Bibliotheken von einem CDN zu
laden; klappt auch das nicht, bleibt der Bildeditor voll benutzbar und nur
die PDF-Funktionen sind abgeschaltet. Die Statusleiste unten rechts zeigt
den Zustand an.

## Was das Programm kann

**Bilder bearbeiten**
- Ebenen: anlegen, duplizieren, umbenennen, sortieren, ein-/ausblenden,
  Deckkraft, 16 Mischmodi (Multiplizieren, Weiches Licht, Differenz …)
- Verschieben, Skalieren (Umschalt = proportional) und Drehen über Anfasser
- Pinsel und Radierer mit Größe, Härte und Deckkraft
- Farbeimer mit Toleranz, Pipette, Rechteckauswahl, Zuschneiden
- Rechteck, Ellipse und Linie als nachträglich änderbare Formebenen
- Nicht-destruktive Anpassungen je Ebene: Helligkeit, Kontrast, Sättigung,
  Farbton, Weichzeichnen, Sepia, Graustufen, Invertieren – jederzeit
  zurücknehmbar oder per „Anpassungen einrechnen“ festschreibbar
- Filter: Schärfen, Kanten, Relief, Verpixeln, Rauschen, Tontrennung,
  Schwellenwert, Vignette, Auto-Tonwert, Spiegeln, Drehen
- **Inhaltsbasiert skalieren** (Seam Carving): ruhige Bildbereiche geben nach,
  Motive behalten ihre Form; ein ausgewählter Bereich lässt sich schützen,
  Fortschritt wird angezeigt und die Rechnung lässt sich abbrechen
- Dokumentgröße und Bildgröße ändern, Leinwand auf Inhalt erweitern,
  Historie mit 40 Schritten

**Schriften**
- Textebenen bleiben editierbar: Inhalt, Größe, Schnitt, Zeilenhöhe,
  Laufweite, Ausrichtung, Farbe und Kontur lassen sich jederzeit ändern
- Systemschriften plus **eigene Schriftdateien** (.ttf, .otf, .woff, .woff2);
  geladene Schriften werden in der Projektdatei mitgespeichert

**PDF verändern**
- Mehrseitige PDFs öffnen und Seite für Seite bearbeiten
- Seiten anhängen, duplizieren, löschen, drehen; mehrere PDFs zusammenführen
- Text, Bilder und Formen auf bestehende Seiten legen
- Export in zwei Modi:
  - **Original beibehalten** – die Originalseiten werden unverändert
    übernommen, bestehender Text bleibt echter, durchsuchbarer Text.
    Neue Textebenen werden, wo möglich, ebenfalls als echter PDF-Text
    geschrieben, der Rest als passgenaues Overlay.
  - **Alles rastern** – jede Seite wird als Bild neu aufgebaut.

**Ein- und Ausgabe**
- Öffnen: PNG, JPEG, WebP, GIF, BMP, SVG, PDF (auch per Drag & Drop)
- Export: PNG, JPEG (mit Qualitätswahl), WebP, PDF
- Projektdatei `.bildwerk` mit allen Ebenen, Einstellungen und Schriften

## Tastenkürzel

| Taste | Wirkung |
|---|---|
| `V` `M` `C` | Verschieben · Auswahl · Zuschneiden |
| `B` `E` `G` | Pinsel · Radierer · Farbeimer |
| `I` `T` `U` | Pipette · Text · Rechteck |
| `Strg+Z` / `Strg+Y` | Rückgängig / Wiederholen |
| `Strg+J` | Ebene duplizieren |
| `Strg+D` / `Entf` | Auswahl aufheben / Auswahl leeren |
| `Eingabe` | Zuschnitt bestätigen |
| `Strg+N` `Strg+O` `Strg+S` | Neu · Bild öffnen · Projekt speichern |
| `Strg+E` | Als PNG exportieren |
| `+` `−` `0` | Zoom größer, kleiner, einpassen |
| `Strg`+Mausrad | Stufenlos zoomen |
| `[` `]` | Pinsel kleiner / größer |
| `X` | Vorder- und Hintergrundfarbe tauschen |
| Pfeiltasten | Ebene um 1 px (mit Umschalt 10 px) verschieben |
| `Bild ↑/↓` | Seite wechseln |

## Inhaltsbasiert skalieren

![Original, gleichmäßig gestaucht und inhaltsbasiert im Vergleich](docs/inhaltsbasiert.png)

Das Verfahren sucht wiederholt den unauffälligsten Pixelpfad durch das Bild
und entfernt ihn (oder verdoppelt ihn beim Vergrößern). Im Beispiel bleibt der
Kreis rund und die Schrift lesbar, während gleichmäßiges Stauchen alles
verzerrt. Gut zu sehen ist auch die Grenze: Der graue Quader rechts bekommt
bei 35 Prozent Stauchung eine sichtbare Einschnürung. Bis etwa 30 Prozent
Änderung sind die Ergebnisse meist sauber; darüber lohnt es sich, den
wichtigen Bereich vorher auszuwählen und im Dialog zu schützen.

Rechenzeit auf einem normalen Rechner (die Anzeige bleibt bedienbar, Abbruch
jederzeit möglich):

| Bild | Änderung | Dauer |
|---|---|---|
| 800 × 600 | 80 Nahtlinien | ≈ 0,5 s |
| 1600 × 1000 | 160 Nahtlinien | ≈ 3 s |
| 1600 × 1000 | 400 Nahtlinien | ≈ 7 s |

Die Obergrenze liegt bei 6 Megapixeln je Ebene; darüber meldet sich das
Programm, statt minutenlang zu rechnen.

## Gestaltung

Farben und Schrift folgen dem **EFCO Brand Book V1.3** (Dezember 2022, Seite 19):

| Rolle | Farbe | Hausfarbe |
|---|---|---|
| Akzent, aktive Werkzeuge, Griffe | `#ede813` | Schwefelgelb (Pantone 395C, RAL 1016) |
| Leisten und Panels | `#3d4d54` | EFCO Anthrazit (Pantone 439C) |
| Text auf gelber Fläche | `#373639` | Anthrazitgrau (Pantone 432C, RAL 7016) |
| Farbfelder | `#54434a`, `#565442` | Sekundärtöne |

Schrift ist die Hausschrift **Panton**; ist sie auf dem Rechner nicht
installiert, greift **Arial** — der im Brand Book vorgesehene Ersatz für
Office-Anwendungen. Panton ist lizenzpflichtig (myfonts) und wird deshalb
nicht mitgeliefert.

Eine Ausnahme ist bewusst gesetzt: Die Arbeitsfläche rund um das Bild bleibt
neutralgrau. Ein farbiger Untergrund würde die Beurteilung der Bildfarben
verfälschen. Alle Text-Hintergrund-Kombinationen der Oberfläche erreichen
mindestens 4,8:1 und liegen damit über der Anforderung für Fließtext (4,5:1).

Ein Markenwechsel betrifft einen Block: die Farbtoken in `css/app.css`.
Die Griffe auf der Bühne lesen die Akzentfarbe zur Laufzeit von dort.

## Ehrliche Einordnung

Bildwerk deckt die alltägliche Bild- und PDF-Arbeit ab, ist aber kein
Photoshop-Ersatz im vollen Funktionsumfang. Bewusst **nicht** enthalten sind
unter anderem: freie Auswahlwerkzeuge (Lasso, Zauberstab), Ebenenmasken,
Einstellungsebenen, Pfade und Vektorwerkzeuge, Smartobjekte, CMYK und
Farbprofile, RAW-Entwicklung, inhaltsbasiertes Füllen sowie 16/32-Bit-Farbtiefe.
Inhaltsbasiertes *Skalieren* ist vorhanden, arbeitet aber bis 6 Megapixel je
Ebene — darüber wird es im Browser zu langsam und das Programm sagt es an.
Gerechnet wird mit 8 Bit pro Kanal im sRGB-Raum des Browsers.

Große Dokumente kosten Arbeitsspeicher: Jede Ebene liegt als eigenes Bild im
RAM, und die Historie hält bis zu 40 Schritte vor.

## Aufbau des Programms

| Datei | Inhalt |
|---|---|
| `js/core.js` | Dokumentmodell, Ebenen, Transformationen, Rendering, Historie |
| `js/tools.js` | Werkzeuge und Zeigerinteraktion, Anfasser |
| `js/filters.js` | Pixeloperationen (Faltung, Flood-Fill, Tonwerte) |
| `js/pdfio.js` | PDF lesen, Seiten verwalten, PDF schreiben |
| `js/seamcarve.js` | Inhaltsbasiertes Skalieren (Nahtlinien-Verfahren) |
| `js/fonts.js` | System- und eigene Schriften |
| `js/ui.js` | Oberfläche, Panels, Dialoge |
| `js/commands.js` | Menübefehle, Dateiein- und -ausgabe |
| `js/main.js` | Start, Menüs, Tastatur, Drag & Drop |
| `tools/build-standalone.py` | erzeugt die Einzeldateien neu (`--embed` für die komplette) |
| `tools/selftest.mjs` | Selbsttest im echten Browser |

Nach Änderungen in `js/` oder `css/` die Einzeldatei neu bauen:

```sh
python3 tools/build-standalone.py            # bildwerk-standalone.html
python3 tools/build-standalone.py --embed    # bildwerk-komplett.html
```

Der Selbsttest fährt einen echten Browser hoch und prüft Pinsel, Historie,
Formen, Text, Filter, PNG-Export sowie den kompletten PDF-Weg (öffnen,
Text ergänzen, exportieren, Text wieder auslesen):

```sh
sh start.sh &
npm i -D playwright && npx playwright install chromium
node tools/selftest.mjs
```

## Lizenz und Fremdcode

Bildwerk selbst steht unter derselben Lizenz wie dieses Repository.
Die optionalen Bibliotheken in `vendor/` sind Fremdcode:
pdf.js (Mozilla, Apache-2.0) und pdf-lib (MIT). Sie werden nicht mit
eingecheckt, sondern bei Bedarf mit `vendor/get-libs.sh` geholt.
