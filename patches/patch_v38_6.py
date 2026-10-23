import sys
d = sys.argv[1]

def edit(path, fn):
    t = open(path, encoding="utf-8").read()
    t = fn(t)
    open(path, "w", encoding="utf-8").write(t)

def once(t, a, b):
    assert t.count(a) == 1, (t.count(a), a[:80])
    return t.replace(a, b)

def html(h):
    assert h.count("38.5") == 4
    return h.replace("38.5", "38.6")

def app(s):
    # Kopf wie im Monat, Knöpfe unter den Inhalt, Auswahl mit „Fertig“ unten
    s = once(s, '''    <div class="calendar-head">
      <div>
        <div class="muted small">Jahresübersicht</div>
        <h2>${year}</h2>
      </div>
      <div class="month-nav"><button id="prevYear" aria-label="Vorheriges Jahr">‹</button><button id="nextYear" aria-label="Nächstes Jahr">›</button></div>
    </div>

    <section class="month-tools">
      <button class="month-plan-btn" id="openBulkBtn">＋ Zeitraum</button>
      <button class="month-secondary ${monthSelectMode?"active":""}" id="monthSelectBtn">${monthSelectMode?"Fertig":"Auswählen"}</button>
      <button class="month-secondary" id="thisYearBtn" ${year===new Date().getFullYear()?"disabled":""}>Dieses Jahr</button>
    </section>
''', '''    <div class="calendar-head">
      <h2>${year}</h2>
      <div class="month-nav">${year===new Date().getFullYear()?"":`<button class="m-today" id="thisYearBtn">Dieses Jahr</button>`}<button id="prevYear" aria-label="Vorheriges Jahr">‹</button><button id="nextYear" aria-label="Nächstes Jahr">›</button></div>
    </div>
''')
    s = once(s, '''    ${!monthSelectMode&&!bridgeFocus&&isFuture?bridgeYearHTML(year):""}''',
                '''    ${!monthSelectMode&&!bridgeFocus&&isFuture?bridgeYearHTML(year,3):""}''')
    s = once(s, '''      ${monthSelectMode?`<div class="year-calendar-title"><h3>Tage auswählen</h3><span class="year-subtle-label">Tage antippen, unten zuordnen</span></div>`:""}
''', '')
    s = once(s, '''      ${monthSelectMode?selectionPanelHTML():legend}
    `:renderYearTable(year)}
''', '''      ${monthSelectMode?selectionPanelHTML(true):legend}
    `:renderYearTable(year)}

    ${monthSelectMode||bridgeFocus?"":`<section class="m-acts">
      <button type="button" class="month-secondary" id="openBulkBtn">＋ Zeitraum</button>
      <button type="button" class="month-secondary" id="monthSelectBtn">Tage auswählen</button>
    </section>`}
''')
    # Tabelle: Summe zusätzlich in h:mm
    s = once(s, '''    <p class="h-mlist-note">Stunden dezimal · Summen über gebuchte Tage · U = Urlaubstage''',
                '''    <p class="h-mlist-note">= <b class="${tot.bal>=0?"pos":"neg"}">${hSigned(tot.bal)} h</b> · Stunden dezimal · Summen über gebuchte Tage · U = Urlaubstage''')
    return s

CSS = '''
/* ── V38.6 Jahr ── */
.h-ylist tr.future td{opacity:.55}
.y-sum + .h-bridge{margin-top:0}
'''

def css(t):
    assert "V38.6" not in t
    return t + CSS

def sw(t):
    return once(t, 'const VERSION="v38.5";', 'const VERSION="v38.6";')

def readme(t):
    t = once(t, "# Klokify – Version 38.5", "# Klokify – Version 38.6")
    return once(t, "## V38.5 – Monat", '''## V38.6 – Jahr

- **Kopf wie im Monat:** nur „2026 ‹ ›“. „Dieses Jahr“ erscheint nur, wenn ein anderes Jahr offen ist. Die Knopfreihe oben entfällt.
- **„+ Zeitraum“ und „Tage auswählen“** unter Übersicht bzw. Kalender. Auswählen mit derselben Leiste wie im Monat („leeren“, „Fertig“, Typen 2 × 3).
- **Folgejahr:** Gelegenheiten oben auf 3 begrenzt, Rest über „weitere … alle ›“ (vorher alle untereinander, Kalender rutschte weit nach unten).
- **Übersicht:** künftige Monate blasser, unter der Summe zusätzlich „= +4:09 h“.

## V38.5 – Monat''')

edit(f"{d}/index.html", html)
edit(f"{d}/app.js", app)
edit(f"{d}/styles.css", css)
edit(f"{d}/sw.js", sw)
edit(f"{d}/README.md", readme)
print("v38.6 ok")
