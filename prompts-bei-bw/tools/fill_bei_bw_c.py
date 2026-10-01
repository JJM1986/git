#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fuellt die Word-Vorlage "BEI_BW C - Erhebungsbogen" aus einer JSON-Zuordnung.

Aufruf:
    python fill_bei_bw_c.py VORLAGE.docx ZUORDNUNG.json AUSGABE.docx

Die JSON-Datei hat dieses Schema (alle Listen enthalten woertliche Zitate,
jeweils ein Zitat pro Eintrag, mit Sprecherkuerzel wie im Protokoll):

{
  "person": "Anna Apfelkuchen",
  "datum_gespraech": "XX.XX.XXXX",
  "datum_teilhabebericht": null,
  "wuensche":        {"wohnen": [], "arbeiten": [], "beziehungen": [], "zeit": [], "sonstiges": []},
  "lebenssituation": {"wohnen": [], "arbeiten": [], "beziehungen": [], "zeit": [], "sonstiges": []},
  "lebensbereiche":  {"1": [], "2": [], "3": [], "4": [], "5": [], "6": [], "7": [], "8": [], "9": []},
  "umweltfaktoren":  {"foerderfaktoren": [], "barrieren": []},
  "ergaenzende_hinweise": [],
  "nicht_zugeordnet": [],
  "mehrfach_zugeordnet": []
}

Das Skript aendert nur Inhalte, nie das Layout: Es setzt die Datumsangaben in
die Hinweiszeilen der Vorlage ein, haengt Zitate als eigene Absaetze an und
uebernimmt die Formatierung des jeweils vorhandenen Vorlagenabsatzes.
Benoetigt: python-docx (pip install python-docx).
"""
import copy
import json
import sys

try:
    from docx import Document
    from docx.oxml.ns import qn
    from docx.text.paragraph import Paragraph
except ImportError:  # pragma: no cover
    sys.stderr.write("Fehlt: python-docx. Installieren mit: pip install python-docx\n")
    sys.exit(2)

PLACEHOLDER = "XX.XX.XXXX"
CELL_KEYS = ["wohnen", "arbeiten", "beziehungen", "zeit", "sonstiges"]
SIEHE = "Siehe Vorbereitungsbogen"
KEINE = "Keine Einschränkungen ersichtlich."


# ---------------------------------------------------------------- Hilfsfunktionen
def ptext(p):
    return "".join(r.text for r in p.runs)


def set_text(p, text):
    """Ersetzt den Text eines Absatzes, behaelt die Formatierung des ersten Runs."""
    runs = p.runs
    if runs:
        runs[0].text = text
        for r in runs[1:]:
            r._r.getparent().remove(r._r)
    else:
        p.add_run(text)


def clone_after(anchor, text, template=None):
    """Neuer Absatz nach `anchor`, Absatz- und Zeichenformat von `template` (Standard: anchor)."""
    src = template if template is not None else anchor
    new_p = copy.deepcopy(src._p)
    for child in list(new_p):
        if child.tag != qn("w:pPr"):
            new_p.remove(child)
    anchor._p.addnext(new_p)
    np = Paragraph(new_p, anchor._parent)
    run = np.add_run(text)
    if src.runs and src.runs[0]._r.rPr is not None:
        run._r.insert(0, copy.deepcopy(src.runs[0]._r.rPr))
    return np


def is_heading(p):
    return (p.style is not None and p.style.name.startswith("BEI_BW")) or \
           (p._p.pPr is not None and p._p.pPr.pStyle is not None and
            str(p._p.pPr.pStyle.get(qn("w:val"))).startswith("BEIBW"))


def clean(items):
    """Leere Eintraege entfernen, Reihenfolge behalten, Dubletten im selben Block entfernen."""
    out, seen = [], set()
    for it in items or []:
        s = (it or "").strip()
        if s and s not in seen:
            out.append(s)
            seen.add(s)
    return out


def append_block(anchor, items, quote_template):
    """Haengt Zitate nach `anchor` an. Nutzt einen direkt folgenden leeren Absatz als ersten Platz."""
    nxt = anchor._p.getnext()
    slot = None
    if nxt is not None and nxt.tag == qn("w:p"):
        cand = Paragraph(nxt, anchor._parent)
        if not ptext(cand).strip() and not is_heading(cand):
            slot = cand
    last = anchor
    for i, q in enumerate(items):
        if i == 0 and slot is not None:
            set_text(slot, q)
            last = slot
        else:
            last = clone_after(last, q, quote_template)
    return last


# ---------------------------------------------------------------- Bloecke
def fill_tables(doc, data, datum):
    tables = doc.tables
    if len(tables) < 2:
        raise SystemExit("Vorlage unerwartet: weniger als zwei Tabellen gefunden.")
    for table, key in ((tables[0], "wuensche"), (tables[1], "lebenssituation")):
        block = data.get(key, {}) or {}
        value_rows = [r for i, r in enumerate(table.rows) if i % 2 == 1]
        for row, cell_key in zip(value_rows, CELL_KEYS):
            cell = row.cells[0]
            quotes = clean(block.get(cell_key))
            ps = cell.paragraphs
            base = ps[0]
            for p in ps[1:]:          # vorbelegte Hinweis- und Leerabsaetze entfernen
                p._p.getparent().remove(p._p)
            if ptext(base).strip() != SIEHE:
                set_text(base, SIEHE)
            if quotes:
                last = clone_after(base, "Ergänzung aus dem Gespräch am %s:" % datum, base)
                for q in quotes:
                    last = clone_after(last, q, base)


def fill_lebensbereiche(doc, data, datum):
    lb = data.get("lebensbereiche", {}) or {}
    paras = doc.paragraphs
    for n in range(1, 10):
        idx = next((i for i, p in enumerate(paras)
                    if is_heading(p) and ptext(p).strip().startswith("Lebensbereich %d" % n)), None)
        if idx is None:
            raise SystemExit("Vorlage unerwartet: Ueberschrift Lebensbereich %d fehlt." % n)
        anchor = paras[idx + 1]
        if "Aus dem Gespräch am" not in ptext(anchor):
            raise SystemExit("Vorlage unerwartet: Hinweiszeile nach Lebensbereich %d fehlt." % n)
        set_text(anchor, "Aus dem Gespräch am %s:" % datum)
        quotes = clean(lb.get(str(n))) or [KEINE]
        append_block(anchor, quotes, anchor)


def fill_umweltfaktoren(doc, data, datum):
    uf = data.get("umweltfaktoren", {}) or {}
    paras = doc.paragraphs
    anchor = next((p for p in paras if ptext(p).strip().startswith("Aus dem Teilhabebericht vom")), None)
    if anchor is None:
        raise SystemExit("Vorlage unerwartet: Zeile 'Aus dem Teilhabebericht vom' fehlt.")
    bullet_tpl = next((p for p in paras if p._p.pPr is not None and p._p.pPr.numPr is not None), None)
    d_thb = (data.get("datum_teilhabebericht") or "").strip()
    if d_thb:
        set_text(anchor, "Aus dem Teilhabebericht vom %s:" % d_thb)
    else:
        set_text(anchor, "Aus dem Gespräch am %s:" % datum)
    last = anchor
    for label, key in (("Förderfaktoren:", "foerderfaktoren"), ("Barrieren:", "barrieren")):
        items = clean(uf.get(key))
        if not items:
            continue
        last = append_block(last, [label], anchor) if last is anchor else clone_after(last, label, anchor)
        for it in items:
            last = clone_after(last, it, bullet_tpl if bullet_tpl is not None else anchor)


def fill_hinweise(doc, data):
    items = data.get("ergaenzende_hinweise")
    if isinstance(items, str):
        items = [items]
    items = clean(items)
    if not items:
        return
    paras = doc.paragraphs
    heading = None
    for p in paras:
        if is_heading(p) and ptext(p).strip() == "Ergänzende Hinweise":
            heading = p
    if heading is None:
        raise SystemExit("Vorlage unerwartet: Ueberschrift 'Ergaenzende Hinweise' fehlt.")
    normal_tpl = next((p for p in paras if ptext(p).strip().startswith("Aus dem Gespräch am")), heading)
    append_block(heading, items, normal_tpl)


def write_protocol(path, data):
    lines = ["Pruefprotokoll zur Uebertragung (automatisch erzeugt)", ""]
    lines.append("Person: %s" % data.get("person", ""))
    lines.append("Gespraech am: %s" % data.get("datum_gespraech", PLACEHOLDER))
    lines.append("Teilhabebericht vom: %s" % (data.get("datum_teilhabebericht") or "nicht beigefuegt"))
    lines.append("")
    lines.append("Nicht zugeordnete Saetze:")
    lines += ["- " + s for s in clean(data.get("nicht_zugeordnet"))] or ["- keine"]
    lines.append("")
    lines.append("Mehrfach zugeordnete Saetze:")
    lines += ["- " + s for s in clean(data.get("mehrfach_zugeordnet"))] or ["- keine"]
    lines.append("")
    lines.append("Bitte pruefen: Ergaenzende Hinweise sind ein Entwurf; Umweltfaktoren ohne Teilhabebericht stammen aus dem Gespraech.")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def main(argv):
    if len(argv) != 4:
        sys.stderr.write(__doc__)
        return 1
    template, mapping, output = argv[1], argv[2], argv[3]
    with open(mapping, encoding="utf-8") as fh:
        data = json.load(fh)
    datum = (data.get("datum_gespraech") or "").strip() or PLACEHOLDER
    doc = Document(template)
    fill_tables(doc, data, datum)
    fill_lebensbereiche(doc, data, datum)
    fill_umweltfaktoren(doc, data, datum)
    fill_hinweise(doc, data)
    doc.save(output)
    proto = output.rsplit(".", 1)[0] + "_Pruefprotokoll.txt"
    write_protocol(proto, data)
    print("Geschrieben: %s" % output)
    print("Pruefprotokoll: %s" % proto)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
