# Testlauf: Prompt Basisbogen auf Beispiel 1

Der Prompt aus `02_prompt_basisbogen.txt` wurde mit dem Gesprächsprotokoll (Quelle 1)
und dem Erhebungsbogen C (Quelle 2) von Beispiel 1 durchgeführt. Legende für den Lauf:

```
- ohne Kürzel / Ich-Form = Frau Anna Apfelkuchen
- FS = Pflegemutter (Betreutes Wohnen in Familien), Frau S.
- FF = Begleitung außerhalb der Werkstatt, Frau F. (Funktion nicht im Protokoll)
- FD = Fachdienst der Werkstatt (Liebenau)
- SD = Sozialer Dienst Landratsamt, bedarfsermittelnde Fachkraft
```

## 1. Soll-Ausgabe der KI

```text
BEI_BW A – BASISBOGEN – AUSFÜLLLISTE
Legende: [X] = ankreuzen · [ ] = leer lassen · TEXT: = eintragen · OFFEN = aus der Akte ergänzen
Status je Feld: BELEGT / ABGELEITET (bitte prüfen) / OFFEN

1 ANGABEN ZUR PERSON
1.1 Stammdaten
Name, Vorname: TEXT: Apfelkuchen, Anna | Status: BELEGT | Beleg: „Frau Anna Apfelkuchen hat als primäres Thema aktuell die Verbesserung der gesundheitlichen Lage.“ (Quelle 2, Ergänzende Hinweise); „FS: Anna Apfelkuchen war sehr fit die letzten Monate“ (Quelle 1, FS)
Geburtsdatum: TEXT: OFFEN | Status: OFFEN | Beleg: kein Datum in den Quellen
Geschlecht: [X] weiblich [ ] männlich [ ] divers | Status: ABGELEITET (bitte prüfen) | Beleg: „Frau Anna Apfelkuchen“ (Quelle 2); „Sie hatte einen dreifachen Bandscheibenvorfall“ (Quelle 1, FS)
Familienstand: [ ] ledig [ ] verheiratet [ ] verwitwet [ ] geschieden | Status: OFFEN | Beleg: keine Angabe zu Ehe oder Partnerschaft in den Quellen
Anzahl der Kinder: TEXT: OFFEN | davon im eigenen Haushalt: TEXT: OFFEN | Status: OFFEN | Beleg: keine Angabe der Person zu eigenen Kindern. Hinweis: „FS: sie spielt gerne mit meinen 3 Kindern“ sind Kinder von FS.
Staatsangehörigkeit: [ ] deutsch [ ] andere, und zwar: TEXT: OFFEN | Status: OFFEN | Beleg: keine Angabe in den Quellen
1.2 Kontaktdaten
Straße und Hausnr.: TEXT: OFFEN | Status: OFFEN
Postleitzahl und Ort: TEXT: OFFEN | Status: OFFEN (Hinweis, keine Adresse: „FS: es sind 5KM bis zur Bushaltestelle in Bad Wurzach. Wir wohnen sehr außerhalb.“)
Telefon: TEXT: OFFEN | Status: OFFEN
E-Mail: TEXT: OFFEN | Status: OFFEN
Ergänzende Hinweise: TEXT: ---
1.3 Rechtliche Vertretung
Erwachsene: [ ] keine [ ] Vollmacht [X] rechtliche Betreuung [ ] sonstige | Status: ABGELEITET (bitte prüfen) | Beleg: „FS: Es gab jetzt ein Betreuerinnenwechsel. Zu Frau Koch hatte sie einen engen Kontakt, mit Frau Holzmann jetzt klappt die Organisation gut, sie haben aber keinen so engen Kontakt.“ (Quelle 1, FS). Aus dem Protokoll geht nicht hervor, ob eine rechtliche Betreuung gemeint ist; Akte prüfen.
Kinder und Jugendliche: [ ] beide Eltern [ ] nur Mutter [ ] nur Vater | Status: OFFEN (Person ist erwachsen, Spalte bleibt leer)
Aufgabenbereiche: [ ] Vermögenssorge [ ] Gesundheitsfürsorge [ ] Aufenthaltsbestimmung [ ] Vertretung gegenüber Behörden, Versicherungen, Renten- und Sozialleistungsträgern [ ] Wohnungsangelegenheiten [ ] Entgegennahme, Öffnen und Anhalten der Post | Status: OFFEN (nur aus Betreuerausweis oder Beschluss)
Ergänzende Hinweise: TEXT: Frau Koch (bisher), Frau Holzmann (jetzt) – Funktion laut Protokoll „Betreuerin“, bitte prüfen
1.4 Personen des Vertrauens
Name, Vorname: TEXT: OFFEN | Status: OFFEN | Beleg: keine Person von der leistungsberechtigten Person als Vertrauensperson benannt. Hinweis: FS (Pflegemutter) kommt in Frage: „FF: Die ärztliche Begleitung teilen wir uns, wir sind viel im Austausch.“
Kontaktdaten: TEXT: OFFEN | Status: OFFEN
Ergänzende Hinweise: TEXT: ---

2 GESPRÄCHE ZUR BEDARFSERMITTLUNG
2.1 Datum, Ort und Beteiligte
Datum, Ort: TEXT: Datum OFFEN; Ort: Werkstatt der Liebenau | Status: Datum OFFEN, Ort ABGELEITET (bitte prüfen) | Beleg: „Danach bin ich hierhergekommen (Liebenau).“ (Quelle 1, Person); „Hier her fahre ich mit dem Bus.“ (Quelle 1, Person); „FS: Im Dezember hast du hier angefangen.“ (Quelle 1, FS); „Aus dem Gespräch am XX.XX.XXXX“ (Quelle 2)
Teilnehmende Personen mit Funktion und Kürzel: TEXT: Frau Anna Apfelkuchen – leistungsberechtigte Person (ohne Kürzel); FS – Frau S. – Pflegemutter (Betreutes Wohnen in Familien); FF – Frau F. – Begleitung außerhalb der Werkstatt; FD – Fachdienst der Werkstatt (Liebenau); SD – Sozialer Dienst Landratsamt, bedarfsermittelnde Fachkraft | Status: BELEGT (Kürzel aus Quelle 1), Funktionen aus Legende | Beleg: Kürzel FS, FF, FD, SD kommen im Protokoll vor; Aussagen ohne Kürzel in Ich-Form
Ergänzende Hinweise: TEXT: ---
2.2 Kommunikationshilfen
[X] nicht erforderlich [ ] erforderlich, und zwar: TEXT: – | Status: ABGELEITET (bitte prüfen) | Beleg: Person antwortet selbst in ganzen Sätzen („Ich bin im Innenbereich und arbeite gerne mit Fahrradtaschen.“); kein Signalwort für Kommunikationshilfen in den Quellen

3 DOKUMENTATION DER BEDARFSERMITTLUNG
3.1 Erst- oder Folgeermittlung
[ ] Erstermittlung [X] Folgeermittlung | Status: ABGELEITET (bitte prüfen) | Beleg: „Letzter Teilhabebericht für weitere Informationen beachten“ (Quelle 2); „Aus dem Teilhabebericht vom 13.02.26:“ (Quelle 2); „Siehe Vorbereitungsbogen“ (Quelle 2)
Datum der letzten Bedarfsermittlung: TEXT: OFFEN | abgeschlossen am: TEXT: OFFEN | Status: OFFEN
Datum der vorliegenden Bedarfsermittlung: TEXT: OFFEN | abgeschlossen am: TEXT: OFFEN | Status: OFFEN
3.2 Bedarfsermittelnde Fachkraft
Name, Vorname: TEXT: OFFEN | Stelle: TEXT: Sozialer Dienst Landratsamt | Kontaktdaten: TEXT: OFFEN | Status: Stelle aus Legende (SD), Rest OFFEN
3.3 Versand der ausgefüllten Bögen
[ ] ja [X] nein | Status: ABGELEITET (bitte prüfen) | Beleg: kein Signalwort („zugeschickt“, „Kopie“, „per Post“) in den Quellen
Ergänzende Hinweise: TEXT: Der Wunsch zum Erhalt des BEI BW wurde im Gespräch nicht geäußert.

4 BEHINDERUNG UND PFLEGEGRAD
4.1 Schwerbehinderung
[ ] ja, GdB: TEXT: OFFEN | Merkzeichen: TEXT: OFFEN | [ ] beantragt | [ ] nein | Status: OFFEN | Beleg: kein Signalwort (GdB, Ausweis, Merkzeichen) in den Quellen
Ergänzende Hinweise: TEXT: ---
4.2 Wesentliche Behinderung
[ ] liegt vor [ ] droht [ ] noch nicht festgestellt | Status: OFFEN | Beleg: keine ausdrückliche Angabe in den Quellen
[ ] körperliche [ ] seelische [ ] geistige [ ] Sinnesbeeinträchtigungen | Status: OFFEN | Beleg: keine ausdrückliche Angabe. Hinweis: „Sie hatte einen dreifachen Bandscheibenvorfall“ (Quelle 1, FS) ist eine Gesundheitsangabe für Bogen B und begründet kein Kreuz bei „körperliche“.
Ergänzende Hinweise: TEXT: ---
4.3 Pflegegrad
[ ] ja, Pflegegrad: [ ] 1 [ ] 2 [ ] 3 [ ] 4 [ ] 5 | [ ] beantragt | [ ] nein | Status: OFFEN | Beleg: kein Signalwort (Pflegegrad, Pflegekasse, Medizinischer Dienst) in den Quellen
Ergänzende Hinweise: TEXT: ---

5 ERGÄNZENDE HINWEISE (GESAMT)
TEXT: ---

NICHT ZUGEORDNET
(Protokollstellen mit Bezug zum Basisbogen, die keinem Feld sicher zuzuordnen sind. Wörtlich, mit Kürzel. Sonst: keine.)
- keine

SELBSTPRÜFUNG
1 Alle 5 Abschnitte und alle Felder in der Reihenfolge der Vorlage ausgegeben? ja
2 Jedes [X] hat einen Beleg aus Quelle 1 oder Quelle 2? ja
3 Kein Feld aus Allgemeinwissen oder Vermutung gefüllt? ja
4 Kinder oder Angehörige anderer Sprecher nicht der Person zugerechnet? ja
5 In Abschnitt 4 nichts angekreuzt, was nicht ausdrücklich GdB, Pflegegrad oder wesentliche Behinderung nennt? ja
6 Alle Belege buchstabengetreu mit Sprecherkürzel? ja
```

## 2. Abgleich mit dem tatsächlich ausgefüllten Basisbogen (Beispiel 1)

Der ausgefüllte Beispiel-Basisbogen ist die Referenz. Er enthält auch Angaben aus der
Akte, die im Protokoll nicht vorkommen. Bewertung: **Treffer** = Prompt liefert dasselbe;
**korrekt OFFEN** = Referenz hat einen Wert, der nicht in den Quellen steht, Prompt lässt
ihn richtig offen; **Mehrwert** = Prompt liefert etwas, das die Referenz leer ließ;
**Fehler** = Prompt liefert etwas anderes als die Referenz.

| Feld | Referenz (ausgefüllter Bogen) | Prompt-Ergebnis | Bewertung |
|---|---|---|---|
| Name, Vorname | Apfelkuchen, Anna | Apfelkuchen, Anna (BELEGT) | Treffer |
| Geburtsdatum | XX.XX.XXXX | OFFEN | Treffer (auch Referenz ohne Wert) |
| Geschlecht | weiblich | weiblich (ABGELEITET) | Treffer |
| Familienstand | ledig | OFFEN | korrekt OFFEN (steht nicht im Protokoll) |
| Anzahl der Kinder | 0 | OFFEN, Hinweis auf „meine 3 Kinder“ von FS | korrekt OFFEN, Falle vermieden |
| Staatsangehörigkeit | deutsch | OFFEN | korrekt OFFEN |
| Kontaktdaten | leer | OFFEN | Treffer |
| Rechtliche Vertretung | rechtliche Betreuung | rechtliche Betreuung (ABGELEITET, prüfen) | Treffer |
| Aufgabenbereiche | alle 6 angekreuzt | OFFEN | korrekt OFFEN (nur aus Betreuerausweis) |
| Personen des Vertrauens | leer | OFFEN, Hinweis FS | Treffer |
| Datum, Ort | leer | Datum OFFEN, Ort Werkstatt der Liebenau (ABGELEITET) | Mehrwert |
| Teilnehmende Personen | leer | 5 Einträge mit Kürzel und Funktion | Mehrwert |
| Kommunikationshilfen | nicht erforderlich | nicht erforderlich (ABGELEITET) | Treffer |
| Erst-/Folgeermittlung | Folgeermittlung | Folgeermittlung (ABGELEITET) | Treffer |
| Daten der Ermittlungen | leer | OFFEN | Treffer |
| Fachkraft | Wirth, Eva-Marie; Sozialer Dienst, LRA KN; Telefon/Mail | Name und Kontakt OFFEN, Stelle aus Legende | korrekt OFFEN (kommt aus der Legende, nicht aus dem Protokoll) |
| Versand | nein; „Der Wunsch zum Erhalt des BEI BW wurde im Gespräch nicht geäußert.“ | nein; identischer Satz | Treffer |
| Schwerbehinderung | ja, GdB 50, Merkzeichen - | OFFEN | korrekt OFFEN |
| Wesentliche Behinderung | liegt vor; geistige | OFFEN, Hinweis: Bandscheibenvorfall gehört in Bogen B | korrekt OFFEN, Falle vermieden (kein Kreuz bei „körperliche“) |
| Pflegegrad | ja, Pflegegrad 2 | OFFEN | korrekt OFFEN |
| Ergänzende Hinweise (alle) | --- | --- | Treffer |

Zusammenfassung:

| Bewertung | Anzahl |
|---|---|
| Treffer | 11 |
| korrekt OFFEN | 8 |
| Mehrwert | 2 |
| Fehler | 0 |

## 3. Was der Testlauf zeigt

- **Der Basisbogen ist zu etwa einem Viertel aus dem Gespräch füllbar.** Die restlichen
  Felder sind Aktendaten. Ein Prompt, der hier „mehr“ liefert, erfindet.
- **Die drei Fallen aus Beispiel 1 werden abgefangen:** Kinder der Pflegemutter,
  Bandscheibenvorfall als körperliche Behinderung, Betreuerin ohne Klärung der Art.
- **Zwei Felder füllt der Prompt besser als die Referenz:** Ort des Gesprächs und
  Teilnehmende mit Kürzel. Beide stehen im Protokoll, wurden in der Referenz aber
  leer gelassen.
- **Der Standardsatz zum Versand** wird wörtlich übernommen, weil er im Prompt steht.
  Weitere Standardformulierungen der Dienststelle lassen sich genauso hinterlegen.

## 4. Empfehlung für den Praxistest in Nele

1. Prompt unverändert einfügen, Legende ausfüllen, beide Quellen als Text einfügen.
2. Antwort mit der Soll-Ausgabe oben vergleichen. Abweichungen bei Status oder
   Belegen notieren.
3. Typische Nachbesserungen, falls nötig: Modell setzt Kreuze ohne Beleg → Regel 4
   um „Vor jedem [X] den Beleg zitieren“ ergänzen; Modell kürzt Belege → Regel 2 um
   „mindestens den ganzen Satz“ ergänzen; Modell gibt Text vor dem Codeblock aus →
   Regel 7 an den Anfang des Prompts stellen.
