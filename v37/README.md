# Klokify – Version 37.0

## Ziel dieser Version

Homescreen neu, ausgelegt auf Samsung S25 (411 × 781 px). Farbwelt Graphit + Lime.
Woche, Monat, Jahr und Dialoge folgen in eigenen Schritten (Farben sind bereits angeglichen, Layout und Schriftgrößen noch alt).

## V37.0 – Neuer Homescreen

- **Keine große Feierabendzeit mehr.** Oben links groß „Noch 3:45 h · bis 15:05“ (nach Soll „Zeitplus“, nach Feierabend „Saldo“), rechts Arbeit und Pause als Fortschrittsbalken mit Wert („4:30 h von 8:00“, „15 Min von 30“). Laufende Pause schraffiert.
- **Zeitstrahl 40 px hoch** mit Halbstunden-Strichen, Jetzt-Strich, Pausen als Blöcke mit Uhrzeit darunter (13 px). Laufende Pause schraffiert, keine Animation. Feierabendzeit steht hervorgehoben am rechten Ende, nach Erreichen des Solls „Soll erreicht“.
- **Wochenzeile Mo–Fr** auf der Startseite: Stunden und Saldo je Tag, Freitag als Prognose bzw. Plan (antippen öffnet „Woche planen“). Tag antippen zeigt diesen Tag, Kopf antippen öffnet die Wochenansicht.
- **Urlaubsleiste:** „18 Tage bis zum Urlaub · noch 12 Arbeitstage · ab Mo 19.10.“ Heute zählt mit, solange kein Feierabend gestempelt ist. Während des Urlaubs: „Urlaub läuft noch 2 Tage · bis Fr 23.10.“ Ohne geplanten Urlaub: Countdown bis zum nächsten Feiertag (Mo–Fr), antippen öffnet „Zeitraum eintragen“.
- **Brückentag-Finder:** sucht Zeiträume, in denen wenige Urlaubstage dank Feiertagen (BW) viele freie Tage am Stück ergeben, z. B. „4 Tage frei für 1 Urlaubstag“ nach Himmelfahrt. Gerechnet wird mit den eigenen Arbeitstagen und bereits eingetragenem Urlaub; 24.12. und 31.12. zählen als normale Arbeitstage.
  - Homescreen: Tipp für die beste Gelegenheit der nächsten 3 Monate, Antippen öffnet den Urlaubsdialog vorbelegt, „×“ blendet den Tipp dauerhaft aus.
  - Jahresansicht: Liste „Gute Gelegenheiten“ mit Urlaubs- und Frei-Zeitraum.
- **Demo-Modus:** Pixel-Anzeige unten rechts antippen (oder Einstellungen → Daten & System → „Demo-Modus öffnen“). Zustände: Vor Beginn, Vergessen zu stempeln, Läuft, Pause läuft, Soll erreicht, 10-h-Grenze naht, Feierabend, Meine Daten (Kopie der echten Einträge). Uhrzeit per Schieber oder ±5/15/60 Min. Alle App-Knöpfe funktionieren; es wird nichts gespeichert. Oranger DEMO-Balken oben, „Beenden“ lädt die echten Daten.
- **Woche:** Kopf wie im Monat – Pfeile für Woche vor/zurück, darunter „Woche planen“ und „Aktuelle Woche“ (ersetzt den halb verdeckten Knopf „Diese Woche“).
- **Jahr:** Werkzeugleiste wie im Monat (＋ Zeitraum · Auswählen · Dieses Jahr). Im Auswahlmodus zweispaltig mit großen Tagen; Tage antippen, unten Urlaub/Krank/FZA/Frei/Kein Eintrag zuordnen. Die Zuordnungsleiste bleibt beim Scrollen sichtbar.
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
