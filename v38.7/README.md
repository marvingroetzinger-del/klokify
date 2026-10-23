# Klokify – Version 38.7

## Ziel dieser Version

Homescreen neu, ausgelegt auf Samsung S25 (411 × 781 px). Farbwelt Graphit + Lime.
Woche, Monat, Jahr und Dialoge folgen in eigenen Schritten (Farben sind bereits angeglichen, Layout und Schriftgrößen noch alt).

## V38.7 – Schnellpause rückwirkend

- **Schnellpausen im Pause-Dialog tragen jetzt eine bereits gemachte Pause ein:** sie endet jetzt und beginnt entsprechend früher (15 Min um 11:20 → 11:05–11:20). Vorher startete sie jetzt und endete automatisch.
- Jeder Knopf zeigt die Zeitspanne, die eingetragen wird. Passt sie nicht (vor Arbeitsbeginn, Überschneidung mit einer Pause), ist der Knopf ausgegraut mit kurzem Grund.
- Nach dem Eintragen: Hinweis mit „Rückgängig“.
- Alte Einträge mit automatisch endender Pause werden weiter richtig angezeigt.

## V38.6 – Jahr

- **Kopf wie im Monat:** nur „2026 ‹ ›“. „Dieses Jahr“ erscheint nur, wenn ein anderes Jahr offen ist. Die Knopfreihe oben entfällt.
- **„+ Zeitraum“ und „Tage auswählen“** unter Übersicht bzw. Kalender. Auswählen mit derselben Leiste wie im Monat („leeren“, „Fertig“, Typen 2 × 3).
- **Folgejahr:** Gelegenheiten oben auf 3 begrenzt, Rest über „weitere … alle ›“ (vorher alle untereinander, Kalender rutschte weit nach unten).
- **Übersicht:** künftige Monate blasser, unter der Summe zusätzlich „= +4:09 h“.

## V38.5 – Monat

- **Kopf:** nur „Oktober 2026 ‹ ›“. „Heute“ erscheint nur, wenn ein anderer Monat offen ist.
- **Ein Zahlenblock wie in der Woche:** Saldo groß („bis heute“ / „abgeschlossen“), Arbeit mit Balken, Konto gesamt. Zähler (Urlaub, Krank, Feiertag …) nur, wenn nicht 0. Die drei Kacheln und die Zeile „U 0 · SU 0 …“ entfallen.
- **Kalender:** keine Punkte mehr, Wochenende ohne Kachel, gewählter Tag lime gefüllt, heute mit lime Rahmen, Stunden als „8:52“.
- **Tag-Leiste direkt unter dem Kalender** statt der großen Karte ganz unten: „Di 20.10. · 06:34–15:16 · 8:12 h · +0:12 · Notiz“ und „Bearbeiten ›“.
- **Feiertage** als Zeile unter dem Kalender statt eigener Karte.
- **„+ Zeitraum“ und „Tage auswählen“** unter dem Kalender. Auswählen: schmale Leiste mit „Fertig“, Typen 2 × 3, „Kein Eintrag“ heißt „Löschen“.
- **Liste:** bleibt; künftige Tage blasser, unter der Summe zusätzlich „= +2:23 h“.

## V38.4 – Woche planen

- **Freitagsziel:** eine Zeile „Freitag Feierabend“ mit großer Uhrzeit zum Antippen. Die ±-Knöpfe sind weg. Darunter „Beginn 06:35 · Pause 30 Min (auto)“ – Tippen auf die Pause blendet das Feld ein, „automatisch“ setzt sie zurück.
- **Plan-Block bleibt:** „Wochenziel exakt geplant“ und die Rechenzeile Mo–Do / Fr = Woche, jetzt etwas größer; „Genau Wochenziel: bis …“ weiter nur bei Abweichung.
- **Feste Endzeit direkt in der Tagesliste:** offene Tage (✎) antippen → „bis“ und „Pause“ in der Zeile, „lösen“ gibt den Tag wieder frei. Feste Tage blau mit „fest“. Der eigene Bereich unten entfällt.
- **Verteilen** in einer Zeile („Rest auf Mi + Do“), nur sichtbar bei mindestens zwei offenen Tagen.
- **Warnung**, wenn ein geplanter Tag über 10 h kommt. Plan löschen per Mülleimer.

## V38.3 – Tag bearbeiten

- **Kopf:** „‹ Do 22.10. ›“ – Tage blättern, ohne den Dialog zu schließen. Darunter „heute · KW 43 · Soll 8:00 h“ (bzw. Feiertagsname). Ungespeicherte Änderungen: Rückfrage „Speichern / Verwerfen“.
- **Tagestyp:** 2 Zeilen à 4. „Kein Eintrag“ ist kein Typ mehr – Löschen über den Mülleimer unten links (nur sichtbar, wenn ein Eintrag existiert, mit Rückfrage).
- **Pausen:** Kopfzeile mit Summe gegen Pflicht („45 Min · Pflicht 30 ✓“, orange bei Fehlbetrag). Je Pause eine Zeile „09:00 – 09:15 · 15 Min ×“, Uhrzeit per Tippen änderbar. Hinzufügen in einer Reihe: +15 +20 +30 +45 (ohne Uhrzeit) und „+ mit Uhrzeit“.
- **Sonderfälle** (vorher „Weitere Optionen“): zeigt zugeklappt, was abweicht (z. B. „Soll 6:00 h“, orange).
- **Notiz** einklappbar, offen wenn Text vorhanden.
- **Fuß:** Arbeit · Pause · Saldo, dazu Warnungen (Pflichtpause fehlt, über 10 h). Bei Urlaub: „danach X Urlaubstage frei“.

## V38.2 – Dialoge Pause und Zeitraum

- **Pause:** oben der Stand des Tages (genommen von Pflicht/geplant, Balken, „noch 15 Min bis zur Pflichtpause“). Ein großer Knopf je Zustand: „Pause jetzt starten“ (grün) oder „Pause beenden · läuft X Min“ (orange). Schnellpausen klar benannt: „Oder feste Dauer – startet jetzt (hh:mm), endet automatisch“ (Verhalten unverändert). Link „Tag bearbeiten ›“ für Pausen mit Uhrzeit oder ohne Zeit.
- **Zeitraum eintragen:** Tagestyp als Chips (Farben wie „Tag bearbeiten“), Vorbelegung „Nächste Woche“ statt ganzer Monat inkl. vergangener Tage, unter den Daten „Mo 26.10. – Fr 30.10. · 5 Tage“ (bei Bedarf „davon X schon vergangen“). Optionen als Schalter; „X vorhandene Einträge überschreiben“ nur sichtbar, wenn es welche gibt. Unten fest: Wirkung (z. B. „Urlaubskonto 2026: 25 frei → danach 20“) und ein Knopf, der sagt, was passiert („5 Urlaubstage eintragen“). Notiz einklappbar.

## V38.1 – Jahresansicht

- **Zusammenfassung oben:** groß „Saldo 2026“ (gebuchte Tage, wie Monatsliste – Ist − Soll = Saldo), daneben Arbeit (Balken, von Soll) und Urlaub (genommen/geplant von Anspruch inkl. Vorjahr). Darunter Sonderurlaub/Krank/FZA, wenn vorhanden. Ersetzt Urlaubskarte und die Kacheln „Ist / Soll bis heute / Saldo“ (die Beschriftung „Soll bis heute“ war irreführend).
- **„Übersicht | Kalender“** umschaltbar (wird gemerkt):
  - Übersicht: Tabelle Jan–Dez mit Soll · Ist · ± (dezimal) · U · K, Jahressumme unten, Zeile antippen = Monat öffnen.
  - Kalender: 2 Spalten, Tage 12 px statt 6–7 px, Legende darunter.
  - Auswählen und Brückentag-Hervorhebung schalten automatisch auf Kalender.
- **Gute Gelegenheiten:** im laufenden Jahr die nächsten 3 + „weitere … alle ›“ (Gelegenheiten-Blatt) + Ausblick.
- **Feiertage** eingeklappt („Feiertage 2026 · Bundesland · 12 ›“), mit Wochentag.
- Kopf wie Monat/Woche (Pfeile rechts).

## V38.0 – Einstellungen & Daten (Schritt 5)

- **Änderungen gelten sofort.** Kein „Einstellungen speichern“ mehr; jede Änderung wird direkt gespeichert (kurzer Toast „Gespeichert“). Kein Verlust mehr beim Schließen.
- **Sollzeit über Wochenstunden + Arbeitstage:** z. B. 38,5 h, Mo–Fr antippen → 7:42 h je Tag. „Tage einzeln anpassen“ für abweichende Tage (Wochensumme rechnet mit).
- **Arbeitsbeginn:** ein Feld für alle Arbeitstage, „Beginn je Tag abweichend“ optional.
- **Bundesland wählbar (alle 16):** gesetzliche Feiertage je Land, u. a. Reformationstag (BB, HB, HH, MV, NI, SN, ST, SH, TH), Buß- und Bettag (SN), Frauentag (BE ab 2019, MV ab 2023), Weltkindertag (TH ab 2019), Allerheiligen (BW, BY, NW, RP, SL), Fronleichnam (BW, BY, HE, NW, RP, SL), Mariä Himmelfahrt (SL), Hl. Drei Könige (BW, BY, ST), Oster-/Pfingstsonntag (BB), Tag der Befreiung (BE 2020/2025). Schalter „Regionale Feiertage“ für BY (Mariä Himmelfahrt, Augsburger Friedensfest) und SN/TH (Fronleichnam in Teilen). Hinweis zeigt Anzahl Feiertage an Werktagen.
- **Resturlaub aus dem Vorjahr** als eigenes Feld; Urlaubskonto, Urlaubsleiste und Jahr rechnen mit Anspruch + Übertrag.
- **Feierabendmotiv** wieder als Option (Einstellungen → Homescreen, standardmäßig aus), als Bildstreifen oben im Tagesbereich.
- **Daten & System neu geordnet:** Sichern (Backup JSON, Tabelle CSV, Datum des letzten Backups) → Wiederherstellen → Werkzeuge (Pixel-Messanzeige, Demo) → Gefahrenzone. „Demo-Werte beim ersten Start“ entfällt (ersetzt durch Demo-Modus).
- Schalter einheitlich als Kippschalter, alle Beschriftungen mind. 13 px, Felder 48 px hoch.
- Cache-Version v38.0.

## V37.0 – Neuer Homescreen

- **Keine große Feierabendzeit mehr.** Oben links groß „Noch 3:45 h · bis 15:05“ (nach Soll „Zeitplus“, nach Feierabend „Saldo“), rechts Arbeit und Pause als Fortschrittsbalken mit Wert („4:30 h von 8:00“, „15 Min von 30“). Laufende Pause schraffiert.
- **Zeitstrahl 40 px hoch** mit Halbstunden-Strichen, Jetzt-Strich, Pausen als Blöcke mit Uhrzeit darunter (13 px). Laufende Pause schraffiert, keine Animation. Feierabendzeit steht hervorgehoben am rechten Ende, nach Erreichen des Solls „Soll erreicht“.
- **Wochenzeile Mo–Fr** auf der Startseite: Stunden und Saldo je Tag, Freitag als Prognose bzw. Plan (antippen öffnet „Woche planen“). Tag antippen zeigt diesen Tag, Kopf antippen öffnet die Wochenansicht.
- **Urlaubsleiste:** „18 Tage bis zum Urlaub · noch 12 Arbeitstage · ab Mo 19.10.“ Heute zählt mit, solange kein Feierabend gestempelt ist. Während des Urlaubs: „Urlaub läuft noch 2 Tage · bis Fr 23.10.“ Ohne geplanten Urlaub: Countdown bis zum nächsten Feiertag (Mo–Fr), antippen öffnet „Zeitraum eintragen“.
- **Brückentag-Finder:** sucht Zeiträume, in denen wenige Urlaubstage dank Feiertagen (BW) viele freie Tage am Stück ergeben, z. B. „4 Tage frei für 1 Urlaubstag“ nach Himmelfahrt. Gerechnet wird mit den eigenen Arbeitstagen und bereits eingetragenem Urlaub; 24.12. und 31.12. zählen als normale Arbeitstage.
  - Homescreen: Tipp für die beste Gelegenheit der nächsten 3 Monate. Antippen springt in den Jahreskalender: betroffener Monat groß, Urlaubstage gefüllt, freie Tage umrandet, oben Banner mit „Eintragen“. „×“ am Tipp blendet ihn dauerhaft aus.
  - Jahresansicht: Liste „Gute Gelegenheiten“; Zeile antippen zeigt die Gelegenheit ebenfalls im Kalender.
  - Ausblick: letzte Zeile der Liste im laufenden Jahr „2027 · 9 Gelegenheiten · bis zu 16 Tage frei ›“. In Zukunftsjahren steht die Liste oben. Im Urlaub-Blatt ab September „Ausblick 2027 ›“.
- **Demo-Modus:** Pixel-Anzeige unten rechts antippen (oder Einstellungen → Daten & System → „Demo-Modus öffnen“). Zustände: Vor Beginn, Vergessen zu stempeln, Läuft, Pause läuft, Soll erreicht, 10-h-Grenze naht, Feierabend, Meine Daten (Kopie der echten Einträge). Uhrzeit per Schieber oder ±5/15/60 Min. Alle App-Knöpfe funktionieren; es wird nichts gespeichert. Oranger DEMO-Balken oben, „Beenden“ lädt die echten Daten.
- **Wochenansicht neu:** oben Saldo Woche groß, daneben Arbeit (Balken, von Wochensoll) und Offen (bzw. Fehlt bei vergangenen Wochen, mit Freitags-Prognose). Darunter eine Zeile je Tag: Balken auf gemeinsamer Zeitachse (Pausen orange), Beginn–Ende · Pause, rechts Ist und Saldo. Krank/Urlaub/Feiertag farbig, Freitag mit Prognose, Wochenende nur mit Eintrag. Zeile antippen = Tag anzeigen, Stift = bearbeiten.
- **Woche:** Kopf wie im Monat – Pfeile für Woche vor/zurück, darunter „Woche planen“ und „Aktuelle Woche“ (ersetzt den halb verdeckten Knopf „Diese Woche“).
- **Jahr:** Werkzeugleiste wie im Monat (＋ Zeitraum · Auswählen · Dieses Jahr). Im Auswahlmodus zweispaltig mit großen Tagen; Tage antippen, unten Urlaub/Krank/FZA/Frei/Kein Eintrag zuordnen. Die Zuordnungsleiste bleibt beim Scrollen sichtbar.
- **Eigene Bestätigungen:** Alle Rückfragen (Überschreiben, Zurücksetzen auf „Kein Eintrag“, Sammelbuchung, Alles löschen) und Hinweise laufen über einen eigenen Dialog statt Browser-confirm()/alert(). Vorher funktionierten sie in eingebetteten Ansichten (z. B. Vorschau) nicht.
- **Homescreen als Einstieg in tiefere Ebenen:** Jedes Element öffnet per Tipp ein Blatt von unten, ohne den Homescreen zu verlassen:
  - „Noch …“ → Tagesrechnung (Beginn + Soll + Pause = Feierabend, 10-h-Grenze)
  - Arbeit/Pause-Balken → Pausen von heute, Schnellpause, bearbeiten
  - Zeitstrahl → Tag bearbeiten
  - Wochenkopf → Zeitkonto (Heute/Woche/Monat/Jahr/Übertrag/Gesamt) → Woche ›, Monat ›
  - Urlaubsleiste → Urlaub (nächster, genommen/geplant/Rest) → ＋ Urlaub, Jahr ›
- **Zeitkonto:** im Wochenkopf „Konto +23:52 h“. Einstellungen → Arbeitszeit → Zeitkonto: Übertrag (h:mm oder Dezimal, auch negativ) und Startdatum.
- **Einstellungen → Homescreen neu:** fest sind Tagesbereich, Aktionen, Wochenzeile, Hinweise; Notiz erscheint automatisch (antippen = bearbeiten). Abschaltbar: Zeitkonto im Wochenkopf, Urlaubsleiste, Brückentag-Tipps (+ ausgeblendete Tipps wieder zeigen). Feierabendmotiv und alte Bausteine (Abwesenheit, Wochenleiste, Saldo-/Freitagskarte) entfernt.
- **Monat als Liste:** Umschalter „Kalender | Liste“. Tabelle Tag · Zeit/Status · Pause (Min) · Soll · Ist · ± in Dezimalstunden (8,25 = 8 h 15 min, wie Lohnabrechnung und CSV-Export), nach jeder Woche eine KW-Summe, unten Monatssumme und Konto gesamt. Summen nur über gebuchte Tage, dadurch immer Ist − Soll = Saldo. Zeile antippen = Tag bearbeiten. Auswahl bleibt im Kalender.
- **Tag bearbeiten neu:** Tagestyp als Chips (1 Tipp statt Ausklappliste), „jetzt“-Knopf für das Ende am heutigen Tag, Schnellpausen-Chips oben, freie Pausendauer unter „Weitere Optionen“, Pausenzeilen passen in die Breite, Live-Vorschau „Arbeit · Pause · Saldo“ über Speichern/Abbrechen, die unten fest stehen bleiben.
- **Freitag-Plan verständlich:** Wochenzeile zeigt bei Plan unter der Uhrzeit das Wochenergebnis (+1:32 / −0:30). Im Planer Rechenzeile „Mo–Do +2:37 · Fr −1:05 = Woche +1:32“ und „Genau Wochenziel: bis 11:58 [übernehmen]“ (Pausenregel unter 6 h berücksichtigt). Wochenkopf „KW 40“.
- **Wochensoll-Hinweis auf dem Homescreen:** Bei Freitags-Plan mit Abweichung steht unter der Wochenzeile „40 h voll: Fr bis 11:58“ (reine Info, kein Bestätigen – gestempelt wird ohnehin).
- **Gelegenheiten-Blatt:** alle Brückentage dieses und nächstes Jahr an einem Ort. Oben Hauptschalter „Tipps auf der Startseite An/Aus“, je Zeile einzeln „✓ Start / Aus“, Zeile antippen = im Kalender. Erreichbar über „alle“ am Tipp und Urlaubsleiste → „Gute Gelegenheiten ›“ (Urlaubsleiste öffnet jetzt immer das Urlaub-Blatt).
- **Kalender über den Jahreswechsel:** reicht eine Gelegenheit ins Nachbarjahr (z. B. 25.12.–03.01.), wird der Monat des anderen Jahres gestrichelt mit angezeigt und markiert.
- **Brückentag-Tipp ausblenden:** × blendet genau diesen Tipp aus, 6 s „Rückgängig“. In der Jahresliste bleiben sie mit „auf Startseite ausgeblendet“; im Banner „Wieder auf Startseite“.
- **Demo mit Daten:** drei Vorwochen + aktuelle Woche mit realistischen Zeiten (8:51 · 8:13 · 8:39 · 8:54 · kurzer Freitag), ein Krankheitstag, Notiz, Freitags-Plan 14:00, Urlaub in gut zwei Wochen, Konto-Übertrag.
- **Woche planen neu:** oben Freitag-Feierabend mit −30/−15/+15/+30, direkt darunter die Plan-Tabelle Mo–Fr (live), Restzeit-Verteilung als Chips, feste Endzeiten nur noch für offene Tage, Speichern/Abbrechen unten fest, „Plan löschen“ als Link. Etwa ein Drittel kürzer.
- **Prognose korrigiert:** Nach der ersten echten Pause rechnet der Feierabend mindestens mit der gesetzlichen Pause fürs Tagessoll (§ 4 ArbZG). Vorher zog eine 15-Min-Pause den Feierabend fälschlich nach vorne.
- **Hinweise ruhiger:** „Pause läuft“ steht im Tagesbereich statt als eigene Karte. 10-h-Grenze als eine Zeile, sobald das Soll erreicht ist.
- **Kopfzeile:** Datum antippen springt zurück zu heute.
- **Farben:** alle Navy-Töne der App automatisch auf Graphit umgestellt, Lime gedämpft (#b6e24c), Orange #f2a83f.
- **Schrift:** Barlow / Barlow Semi Condensed (Google Fonts, offline Systemschrift). Homescreen nur 13 / 16 / 20 / 28 px.

## V36.3 – Zeitskala vereinfacht, Freitagskarte zeigt Minus

- **Zeitskala ohne Stift:** Beginn und Ende sind wieder reine Anzeige. Zeiten ändert man über den großen „Ändern“-Button. Die Minikorrektur (−5/−1/+1/+5) ist entfernt.
- **Freitagskarte zeigt Abweichung zum Wochensoll deutlich:** Ist das Freitagsziel zu früh, wird die Zielzeit orange und darunter steht z. B. „−1:00 h zum Wochensoll“ (bei Überschuss „+0:30 h über Wochensoll“, bei exakt „passt“). Gilt für die kompakte und die große Karte.
- „Rückgängig“ nach Kommen/Feierabend bleibt erhalten.

## V36.2 – Wochenplaner lesbar

- **Mindestschrift 13 px im Dialog „Woche planen“** (Referenz: Feld „Zielzeit“). Vorher 8–12 px bei Tagesdaten, Hinweisen, Status und Vorschau.
- Tageszeilen zweizeilig: Tag oben, darunter Feierabend und Pause nebeneinander, damit 13 px nicht eng wird.
- Großbuchstaben-Beschriftungen („Ist-Zeit“, „Plan“) in normale Schreibweise geändert.
- Dialogbreite auf Tablet 520 px statt 460 px.

## V36.1 – Fehlerbehebung Beginnzeit

- **Beginnzeit aus den Einstellungen gilt jetzt im Wochenplan und auf der Freitagskarte.** Vorher wurde der Beginn des letzten echten Wochentags verwendet, geänderte Einstellungen blieben wirkungslos. Betrifft Wochenplaner (Beginn je Tag), Freitagsprognose und Pausenempfehlung. Tage mit echter Stempelung behalten ihren tatsächlichen Beginn.

## Änderungen V36

1. **Kommen um Planzeit** – Wenn der geplante Arbeitsbeginn schon vorbei ist (max. 4 h), bietet der Startbildschirm zusätzlich „Kommen um 06:35 · vergessen zu stempeln“ an.
2. **Beginn/Ende korrigieren** – Tipp auf „Beginn“ (bzw. „Ende“ nach Feierabend) öffnet eine Minikorrektur mit −5/−1/+1/+5 Min. Geprüft wird: nicht in der Zukunft, nicht nach dem Ende, nicht hinter einer Pause.
3. **Rückgängig statt Rückfrage** – Kommen, Feierabend und Korrekturen zeigen 6 Sekunden lang „Rückgängig“.
4. **Gesetzliche Pausen (§ 4 ArbZG)** – Prognose nutzt vor der ersten echten Pause mindestens das gesetzliche Minimum (über 6 h: 30 Min, über 9 h: 45 Min). Echte Pausen zählen weiter minutengenau. Hinweis bei zu wenig Pause ab 6 h und ab 9 h.
5. **10-Stunden-Grenze (§ 3 ArbZG)** – Nach Erreichen des Solls kleine Zeile „spätestens hh:mm“, ab 9:30 h Arbeit deutlicher Hinweis.
6. **Offener Vortag** – Beim Öffnen: „Dienstag 29.09. ohne Ende · Nachtragen“ (letzte 14 Tage).
7. **Feierabendmotiv** standardmäßig aus (einmalig auch für Bestandsdaten), in den Einstellungen wieder einschaltbar.
8. **Pixel-Messanzeige** unten rechts, abschaltbar unter Daten & System.
9. **Technik** – `save()` fängt Speicherfehler ab, `navigator.storage.persist()` wird angefragt, `icon.svg` ergänzt (fehlte, blockierte die Offline-Installation des Service Workers).

## Technische Hinweise

- LocalStorage-Key bleibt `arbeitszeit-v4`, Daten kompatibel
- PWA-Cache-Version: v37.0
