import sys
p = sys.argv[1]
h = open(p, encoding="utf-8").read()

def once(a, b):
    global h
    assert h.count(a) == 1, (h.count(a), a[:70])
    h = h.replace(a, b)

# Version
assert h.count("37.0") >= 4
h = h.replace("37.0", "38.0")

# Einstellungs-Dialog komplett neu
a = h.index('<dialog id="settingsDialog"')
b = h.index('</dialog>', a) + len('</dialog>')
STATES = [("BW","Baden-Württemberg"),("BY","Bayern"),("BE","Berlin"),("BB","Brandenburg"),("HB","Bremen"),("HH","Hamburg"),("HE","Hessen"),("MV","Mecklenburg-Vorpommern"),("NI","Niedersachsen"),("NW","Nordrhein-Westfalen"),("RP","Rheinland-Pfalz"),("SL","Saarland"),("SN","Sachsen"),("ST","Sachsen-Anhalt"),("SH","Schleswig-Holstein"),("TH","Thüringen")]
opts = "\n".join(f'              <option value="{c}">{n}</option>' for c, n in STATES)

def sw(id_, title, sub=""):
    s = f'<small class="toggle-sub">{sub}</small>' if sub else ""
    return f'''<label class="s-switch">
            <span>{title}{s}</span>
            <input type="checkbox" id="{id_}"><i aria-hidden="true"></i>
          </label>'''

h = h[:a] + f'''<dialog id="settingsDialog" class="dialog settings-dialog s38">
    <div class="dialog-head settings-dialog-head">
      <div>
        <h2>Einstellungen</h2>
        <small>Änderungen gelten sofort.</small>
      </div>
      <button type="button" class="icon-btn mini" data-close="settingsDialog" aria-label="Schließen">×</button>
    </div>

    <div class="settings-accordion-list">
      <details class="settings-accordion" open>
        <summary>
          <span class="settings-summary-copy"><b>Arbeitszeit</b><small id="settingsSummaryWork"></small></span>
          <span class="settings-chevron">⌄</span>
        </summary>
        <div class="settings-accordion-panel">
          <div class="s-row2">
            <label>Wochenstunden
              <input type="text" id="sWeekHours" inputmode="decimal" autocomplete="off" placeholder="z. B. 40 · 38,5">
            </label>
            <div class="s-calc" id="sPerDay"></div>
          </div>
          <div class="s-label">Arbeitstage</div>
          <div class="s-days" id="sWorkdays"></div>
          <details class="s-more">
            <summary>Tage einzeln anpassen</summary>
            <div class="s-daygrid" id="weekdayTargets"></div>
          </details>

          <label>Arbeitsbeginn
            <input type="time" id="sStartAll">
          </label>
          <details class="s-more">
            <summary>Beginn je Tag abweichend</summary>
            <div class="s-daygrid" id="weekdayStarts"></div>
          </details>

          <div class="s-sep">Zeitkonto</div>
          <p class="settings-help">Stand laut Lohnabrechnung. Klokify zählt ab dem Datum weiter.</p>
          <div class="s-row2">
            <label>Übertrag (h:mm)
              <input type="text" id="kontoStartInput" inputmode="text" autocomplete="off" placeholder="z. B. 23:07 · -2:30">
            </label>
            <label>gilt ab
              <input type="date" id="kontoStartDate">
            </label>
          </div>
        </div>
      </details>

      <details class="settings-accordion">
        <summary>
          <span class="settings-summary-copy"><b>Pause</b><small id="settingsSummaryPause"></small></span>
          <span class="settings-chevron">⌄</span>
        </summary>
        <div class="settings-accordion-panel">
          <label>Geplante Pause (Min)
            <input type="number" id="plannedPauseInput" min="0" max="180" step="5">
          </label>
          <div class="s-label">Schnellpausen (Min, 0 = aus)</div>
          <div class="s-quick" id="quickPauseSettings"></div>
          {sw("breakReminder","Pausenhinweis ab 6 Stunden","Erinnert an die gesetzliche Pause")}
        </div>
      </details>

      <details class="settings-accordion">
        <summary>
          <span class="settings-summary-copy"><b>Urlaub & Feiertage</b><small id="settingsSummaryCalendar"></small></span>
          <span class="settings-chevron">⌄</span>
        </summary>
        <div class="settings-accordion-panel">
          <label>Bundesland
            <select id="sState">
{opts}
            </select>
          </label>
          {sw("autoHolidaysBW","Feiertage automatisch","Gesetzliche Feiertage des Bundeslands")}
          <div id="sRegionalWrap">
          {sw("sRegional","Regionale Feiertage mitzählen","")}
          </div>
          <div class="s-hint" id="sHolidayHint"></div>
          <div class="s-row2">
            <label>Urlaubsanspruch (Tage)
              <input type="number" id="vacationEntitlementInput" min="0" max="60" step="0.5">
            </label>
            <label>Rest aus Vorjahr
              <input type="number" id="sVacCarry" min="0" max="60" step="0.5">
            </label>
          </div>
        </div>
      </details>

      <details class="settings-accordion">
        <summary>
          <span class="settings-summary-copy"><b>Homescreen</b><small id="settingsSummaryHome"></small></span>
          <span class="settings-chevron">⌄</span>
        </summary>
        <div class="settings-accordion-panel">
          <p class="settings-help">Fest: Tagesbereich, Aktionen, Wochenzeile und Hinweise. Eine Notiz erscheint automatisch.</p>
          {sw("homeKontoToggle","Zeitkonto im Wochenkopf","für Gleitzeit / Überstunden")}
          {sw("homeVacationToggle","Urlaubsleiste","Countdown bis zum nächsten Urlaub")}
          {sw("homeBridgeToggle","Brückentag-Tipps","Hinweis bis 3 Monate vorher")}
          {sw("homeImageToggle","Feierabendmotiv","Bild oben im Tagesbereich")}
          <button type="button" class="ghost-btn full" id="resetBridgeTipsBtn">Ausgeblendete Tipps wieder zeigen</button>
        </div>
      </details>

      <details class="settings-accordion">
        <summary>
          <span class="settings-summary-copy"><b>Daten & System</b><small id="settingsSummaryData"></small></span>
          <span class="settings-chevron">⌄</span>
        </summary>
        <div class="settings-accordion-panel">
          <div class="s-sep">Sichern</div>
          <div class="settings-actions">
            <button class="ghost-btn" id="exportJsonBtn">Backup (JSON)</button>
            <button class="ghost-btn" id="exportCsvBtn">Tabelle (CSV)</button>
          </div>
          <div class="s-hint" id="sBackupHint"></div>

          <div class="s-sep">Wiederherstellen</div>
          <label class="ghost-btn import-label full">Backup importieren
            <input type="file" id="importInput" accept="application/json">
          </label>

          <div class="s-sep">Werkzeuge</div>
          {sw("pixelMeterToggle","Pixel-Messanzeige unten rechts","Antippen öffnet die Demo")}
          <button type="button" class="ghost-btn full" id="openDemoBtn">Demo-Modus öffnen</button>

          <div class="s-sep danger">Gefahrenzone</div>
          <button class="danger-btn full" id="resetAllBtn">Alle Daten löschen</button>
        </div>
      </details>
    </div>
  </dialog>''' + h[b:]
open(p, "w", encoding="utf-8").write(h)
print("html ok")
