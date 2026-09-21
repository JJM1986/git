# BEI_BW – KI-Prompts für die Übertragung von Gesprächsprotokollen in die Bögen

Ziel: Eine Mitarbeitende des Sozialen Dienstes (Landratsamt) überträgt mit Hilfe der
hauseigenen KI „Nele“ (ChatGPT-Modelle) die Rohnotizen eines Bedarfsermittlungs-
gesprächs in die BEI_BW-Vorlagen. Die KI ordnet Textstellen zu und übernimmt sie
**wortwörtlich**. Sie formuliert nicht um und erfindet nichts.

Quellen je Fall (werden in den Prompt eingefügt):

| Quelle | Inhalt | Beispiel 1 |
|---|---|---|
| Quelle 1 | Gesprächsprotokoll (Rohnotizen, Sprecherkürzel FS/FF/FD/SD, Ich-Form = Person) | `Beispiel_1_Gesprächsprotokoll_1.docx` |
| Quelle 2 | Erhebungsbogen C (bereits ausgefüllt, mit Lebensbereichen 1–9) | `Beispiel_1_BEI_BW_C_Bedarfsermittlung_1.docx` |

Zielbögen (je ein eigener Prompt):

| Nr. | Bogen | Prompt | Status |
|---|---|---|---|
| 1 | BEI_BW A – Basisbogen | [02_prompt_basisbogen.txt](02_prompt_basisbogen.txt) · [Seite für die Mitarbeitende](https://claude.ai/artifact/TpZRBTJ2EdCQZ6CVqKPU9L) ([HTML](04_seite_basisbogen_assistent.html)) | fertig, getestet an Beispiel 1 |
| 2 | BEI_BW B – Gesundheitsbogen | – | nächster Schritt |
| 3 | GP-Vorbereitung | – | danach (offene Frage, siehe unten) |

## Warum die bisherigen Versuche scheiterten

Zwei Fehlerbilder wurden genannt: falsche Formatierung und falsche Zuordnung.
Die Ursachen liegen in der Aufgabenstellung an die KI, nicht im Modell:

1. **Die KI sollte den Bogen „ausfüllen“.** Dann baut sie die Word-Vorlage als
   Markdown nach: Tabellen, fette Überschriften, `---` wird zur Trennlinie,
   Kästchen werden zu Aufzählungen. Die Word-Kästchen sind aber
   Inhaltssteuerelemente (46 Stück im Basisbogen). Text lässt sich dort nicht
   „hineinpasten“, man muss sie anklicken. Ein nachgebauter Bogen ist deshalb
   nie übertragbar.
2. **Zuordnung nach Themenähnlichkeit statt nach Felddefinition.** Beispiele aus
   Beispiel 1: „meine 3 Kinder“ (sagt die Pflegemutter) landet bei „Anzahl der
   Kinder“; „Bandscheibenvorfall“ führt zu einem Kreuz bei „körperliche
   Beeinträchtigung“ unter *wesentliche Behinderung*; die Werkstatt-Betreuerin
   wird zur rechtlichen Betreuerin.
3. **Lücken werden plausibel gefüllt** (Familienstand „ledig“, Staatsangehörigkeit
   „deutsch“), obwohl das Protokoll dazu nichts sagt.
4. **Sprecher gehen verloren.** Ohne Kürzel-Legende weiß die KI nicht, wer FS,
   FF, FD und SD sind, und schreibt Aussagen der Begleitpersonen der Person zu.

## Lösungsweg (gilt für alle Bögen)

**Ein Bogen = ein Prompt, und jeder Prompt liefert eine Ausfüllliste, keinen Bogen.**

Die Ausfüllliste hat für jedes Feld der Vorlage genau eine Zeile in der
Reihenfolge der Vorlage: Feldname, Eintrag, Status, Beleg. Die Mitarbeitende
geht die Liste von oben nach unten durch und überträgt: Text kopieren,
Kästchen anklicken. Layout und Inhalt sind damit getrennt, das Formatproblem
entfällt.

Jeder Prompt ist gleich aufgebaut:

1. **Rolle und Auftrag** (drei Sätze).
2. **Quellen und Kürzel-Legende.** Die Legende füllt die Mitarbeitende pro Fall
   aus. Ohne Legende darf die KI keine Funktion erfinden.
3. **Grundregeln:** nur Quellen, wortwörtlich mit Kürzel, drei Status
   (BELEGT / ABGELEITET / OFFEN), Kästchen nur mit Beleg, Aussagen anderer
   Sprecher über sich selbst zählen nicht, Gesundheitsangaben gehören in Bogen B.
4. **Feldkatalog mit Signalwörtern und Fallen.** Das ist die Schlüsselwort-Analyse
   aus [01_schluesselwoerter_zuordnung.md](01_schluesselwoerter_zuordnung.md),
   direkt in den Prompt eingebaut. Die KI sucht gezielt nach diesen Signalen
   statt nach Ähnlichkeit.
5. **Festes Ausgabeformat** in einem einzigen Codeblock. Dadurch rendert der
   Chat kein Markdown, `---` bleibt `---`, und die Liste lässt sich am Stück
   kopieren.
6. **Block „Nicht zugeordnet“** für Protokollstellen mit Bezug zum Bogen, die
   die KI keinem Feld sicher zuordnen kann. Das ersetzt das Raten.
7. **Selbstprüfung** in sechs Ja/Nein-Zeilen am Ende. Sie zwingt das Modell,
   die häufigsten Fehler noch einmal gegen die eigene Ausgabe zu prüfen.

## Ablauf für die Mitarbeitende

1. Prompt-Datei öffnen, gesamten Text kopieren.
2. Die Kürzel-Legende oben im Prompt für den Fall ausfüllen (wer ist FS, FF, FD, SD).
3. Gesprächsprotokoll als Text zwischen `=== QUELLE 1 ===` und `=== ENDE QUELLE 1 ===` einfügen.
4. Erhebungsbogen C als Text zwischen `=== QUELLE 2 ===` und `=== ENDE QUELLE 2 ===` einfügen.
5. Abschicken. Die Antwort ist ein Codeblock mit der Ausfüllliste.
6. Liste von oben nach unten in die Word-Vorlage übertragen.
7. Alle Zeilen mit Status **ABGELEITET** fachlich prüfen, alle **OFFEN** aus der Akte ergänzen.

## Testlauf

[03_testlauf_beispiel1_basisbogen.md](03_testlauf_beispiel1_basisbogen.md) enthält
die Ausfüllliste, die der Prompt für Beispiel 1 liefern muss, und den Abgleich mit
dem tatsächlich ausgefüllten Basisbogen. Ergebnis: keine Fehlzuordnung, alle im
Protokoll enthaltenen Angaben gefunden, alle Fallen (Kinder, körperliche
Behinderung, Betreuerin) vermieden.

## Offene Punkte für die nächsten Prompts

- **Gesundheitsbogen B:** Diagnosen und ICF-Codes kommen nicht aus dem Gespräch,
  sondern aus Akte und Teilhabebericht. Aus dem Protokoll kommen nur die
  Spalte „Erläuterungen“ und die „Ergänzenden Hinweise“. Der Prompt braucht die
  Liste der b-Codes des Kapitels als Feldkatalog.
- **GP-Vorbereitung:** Das Beispiel ist in der dritten Person zusammengefasst
  („Frau Apfelkuchen leidet an …“), nicht wörtlich. Das widerspricht der Regel
  „wortwörtlich übernehmen“. Vor dem Prompt ist zu klären, ob die GP-Vorbereitung
  wörtliche Zitate pro Lebensbereich oder eine Zusammenfassung enthalten soll.
  Außerdem nennt die Vorlage als Grundlage „letzter GP, akt. Teilhabebericht,
  ggf. Vorbereitungsbogen“, also Dokumente von vor dem Gespräch.
