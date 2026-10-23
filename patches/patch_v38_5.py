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
    assert h.count("38.4") == 4
    return h.replace("38.4", "38.5")

def app(s):
    # Kalenderzellen: ohne Punkte, Wochenende ohne Kachel, Stunden ohne „h“
    s = once(s, '''    const cls=[
      status!=="empty"?status:"",
      autoHoliday?"autoHoliday":"",''', '''    const cls=[
      status!=="empty"?status:"",
      status==="empty"&&[0,6].includes(dt.getDay())?"we":"",
      autoHoliday?"autoHoliday":"",''')
    s = once(s, '''    if(status==="work"&&rec) small=formatCompact(c.worked);''',
                '''    if(status==="work"&&rec&&(rec.end||isManualWorkRecord(rec)||k===localDateKey(new Date()))) small=hDur(c.worked);''')
    s = once(s, '''      <span class="num">${d}</span><span class="dot"></span>
      <span class="day-work">${small}</span>''', '''      <span class="num">${d}</span>
      <span class="day-work">${small||"&nbsp;"}</span>''')

    # Seitenaufbau Monat neu
    a = s.index('''  const selectionPanel=monthSelectMode?selectionPanelHTML():"";''')
    b = s.index("function selectionPanelHTML(){")
    s = s[:a] + r'''  const selectionPanel=monthSelectMode?selectionPanelHTML(true):"";
  const now=new Date(),todayK=localDateKey(now);
  const isCur=y===now.getFullYear()&&m===now.getMonth();
  const isFut=first>now;
  const counts=[["vacation","Urlaub"],["specialLeave","Sonderurlaub"],["sick","Krank"],["flex","FZA"],["holiday","Feiertag"],["off","Frei"]]
    .filter(([k])=>stats[k]).map(([k,l])=>`<span class="m-cnt ${k}">${l} <b>${stats[k]}</b></span>`).join("");
  const konto=homeOpt("konto")?kontoBalance():null;
  const hero=`<section class="h-hero w-sum m-sum">
      <div class="h-c">
        <div class="h-c-big"><span>Saldo ${monthName(m)}</span><b class="${stats.balance>=0?"":"neg"}">${hSigned(stats.balance)}<small> h</small></b><span>${isFut?"noch nichts gebucht":isCur?"bis heute":"abgeschlossen"}</span></div>
        <div class="h-c-rows">
          <div class="h-c-row"><span>Arbeit</span><div class="val">${hDur(stats.worked)}<em>von ${hDur(stats.target)}</em></div><div class="h-bar"><i class="lime" style="width:${stats.target?clamp(stats.worked/stats.target*100,0,100):0}%"></i></div></div>
          ${konto===null?"":`<div class="h-c-row"><span>Konto</span><div class="val ${konto>=0?"pos":"neg"}">${hSigned(konto)} h<em>gesamt</em></div></div>`}
        </div>
      </div>
      ${counts?`<div class="y-extras m-cnts">${counts}</div>`:""}
    </section>`;

  let stripBody="";
  const sTarget=targetForDate(selectedDate);
  if(selectedStatus==="work"&&selectedRec&&(selectedRec.start||isManualWorkRecord(selectedRec))){
    const what=isManualWorkRecord(selectedRec)?"Sammelbuchung":`${selectedRec.start}–${selectedRec.end||(selectedDate===todayK?"läuft":"offen")}`;
    stripBody=`${what} · <b>${hDur(selectedCalc.worked)} h</b> · <b class="${selectedCalc.balance>=0?"pos":"neg"}">${hSigned(selectedCalc.balance)}</b>`;
  }else if(selectedStatus!=="empty"){
    const hol=bwHolidayName(selectedDate);
    stripBody=`${STATUS[selectedStatus].label}${hol&&selectedStatus==="holiday"?` · ${escapeHtml(hol)}`:""}${recordIsCreditedStatus(selectedStatus)&&selectedDate<=todayK&&selectedCalc.worked?` · <b>${hDur(selectedCalc.worked)} h</b> gutgeschrieben`:""}`;
  }else{
    stripBody=sTarget?(selectedDate<todayK?"kein Eintrag":"noch nichts eingetragen"):"frei";
  }
  if(selectedRec?.note) stripBody+=` · ${escapeHtml(selectedRec.note)}`;
  const strip=`<section class="m-strip">
      <div><b>${weekdayName(sd)} ${pad(sd.getDate())}.${pad(sd.getMonth()+1)}.</b><span>${stripBody}</span></div>
      <button type="button" class="m-edit" data-edit-day="${selectedDate}">Bearbeiten ›</button>
    </section>`;
  const holLine=state.settings.autoHolidaysBW&&holidays.length
    ? `<div class="m-hol">${holidays.map(h=>`<span><b>◆ ${dateShortDE(h.key)}</b> ${escapeHtml(h.name)}</span>`).join("")}</div>`:"";
  const acts=`<section class="m-acts">
      <button type="button" class="month-secondary" id="openBulkBtn">＋ Zeitraum</button>
      <button type="button" class="month-secondary" id="monthSelectBtn">Tage auswählen</button>
    </section>`;

  return `
    <div class="calendar-head">
      <h2>${monthName(m)} ${y}</h2>
      <div class="month-nav">${isCur?"":`<button class="m-today" id="todayMonthBtn">Heute</button>`}<button id="prevMonth" aria-label="Vorheriger Monat">‹</button><button id="nextMonth" aria-label="Nächster Monat">›</button></div>
    </div>

    ${hero}

    ${monthSelectMode?"":`<div class="h-seg" role="tablist" aria-label="Darstellung">
      <button type="button" role="tab" data-month-mode="cal" aria-selected="${monthMode!=="list"}">Kalender</button>
      <button type="button" role="tab" data-month-mode="list" aria-selected="${monthMode==="list"}">Liste</button>
    </div>`}

    ${!monthSelectMode&&monthMode==="list"?renderMonthList(y,m):`<section class="calendar card m-cal">
      <div class="weekdays"><div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div></div>
      <div class="calendar-grid">${cells}</div>
    </section>`}

    ${monthSelectMode?selectionPanel:`${monthMode==="list"?"":strip+holLine}${acts}`}
  `;
}

''' + s[b:]

    # Auswahlleiste: im Monat mit „Fertig“, Typen 2×3, „Löschen“
    s = once(s, '''function selectionPanelHTML(){
  return `
    <section class="month-selection-panel card sticky-selection">
      <div class="month-selection-head">
        <div><strong>${monthSelectedDates.size}</strong><span> Tag${monthSelectedDates.size===1?"":"e"} gewählt</span></div>
        <button type="button" class="selection-clear" id="clearMonthSelection">Auswahl leeren</button>
      </div>
      <div class="month-selection-actions">
        <button class="vacation" data-month-apply="vacation">🏖 Urlaub</button>
        <button class="specialLeave" data-month-apply="specialLeave">🌴 Sonderurlaub</button>
        <button class="sick" data-month-apply="sick">✚ Krank</button>
        <button class="flex" data-month-apply="flex">↻ FZA</button>
        <button class="off" data-month-apply="off">○ Frei</button>
        <button class="clear" data-month-apply="clear">× Kein Eintrag</button>
      </div>
    </section>`;
}''', '''function selectionPanelHTML(withDone=false){
  const n=monthSelectedDates.size;
  return `
    <section class="month-selection-panel card sticky-selection m-selbar">
      <div class="month-selection-head">
        <div><strong>${n}</strong><span> Tag${n===1?"":"e"} gewählt${n?" · Typ antippen":" · Tage antippen"}</span></div>
        <div class="m-selbtns">${n?`<button type="button" class="selection-clear" id="clearMonthSelection">leeren</button>`:""}${withDone?`<button type="button" class="m-done" id="monthSelectBtn">Fertig</button>`:""}</div>
      </div>
      <div class="month-selection-actions">
        <button class="vacation" data-month-apply="vacation">Urlaub</button>
        <button class="sick" data-month-apply="sick">Krank</button>
        <button class="flex" data-month-apply="flex">FZA</button>
        <button class="off" data-month-apply="off">Frei</button>
        <button class="specialLeave" data-month-apply="specialLeave">Sonderurlaub</button>
        <button class="clear" data-month-apply="clear">Löschen</button>
      </div>
    </section>`;
}''')

    # Liste: künftige Tage blasser, Summe zusätzlich in h:mm
    s = once(s, '''    html+=`<tr class="${r.cls}${today?" today":""}" data-edit-day="${key}">''',
                '''    html+=`<tr class="${r.cls}${today?" today":""}${key>localDateKey(new Date())?" fut":""}" data-edit-day="${key}">''')
    s = once(s, '''    <p class="h-mlist-note">Stunden dezimal (8,25''',
                '''    <p class="h-mlist-note">= <b class="${mon.bal>=0?"pos":"neg"}">${hSigned(mon.bal)} h</b> · Stunden dezimal (8,25''')
    return s

CSS = '''
/* ── V38.5 Monat ── */
.month-nav .m-today{width:auto;padding:0 14px;font:700 var(--fs-s)/1 var(--font-ui)}
.m-sum .val.pos{color:var(--lime)} .m-sum .val.neg{color:var(--danger)}
.m-cnts{display:flex;flex-wrap:wrap;gap:4px 14px}
.m-cnt b{color:var(--text)}
.m-cnt.vacation{color:var(--orange)} .m-cnt.sick{color:var(--danger)} .m-cnt.flex{color:var(--violet)}
.m-cnt.holiday,.m-cnt.specialLeave{color:var(--blue)}
.m-cal{padding:10px 8px}
.m-cal .weekdays{font-size:var(--fs-s);color:var(--muted)}
.m-cal .calendar-grid{gap:4px}
.m-cal .calendar-day{min-height:52px;padding:6px 2px;border-radius:10px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:var(--panel2)}
.m-cal .calendar-day .num{font:700 var(--fs-m)/1 var(--font-num);color:var(--text)}
.m-cal .calendar-day .day-work{margin:0;font:600 11px/1 var(--font-num);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.m-cal .calendar-day.we,.m-cal .calendar-day.empty{background:none}
.m-cal .calendar-day.we .num{color:var(--muted)}
.m-cal .calendar-day.sick{background:rgba(240,118,114,.18)} .m-cal .calendar-day.sick .day-work{color:var(--danger)}
.m-cal .calendar-day.vacation{background:rgba(242,168,63,.18)} .m-cal .calendar-day.vacation .day-work{color:var(--orange)}
.m-cal .calendar-day.holiday,.m-cal .calendar-day.autoHoliday,.m-cal .calendar-day.specialLeave{background:rgba(125,184,242,.16)}
.m-cal .calendar-day.holiday .day-work,.m-cal .calendar-day.autoHoliday .day-work,.m-cal .calendar-day.specialLeave .day-work{color:var(--blue)}
.m-cal .calendar-day.flex{background:rgba(169,133,255,.16)} .m-cal .calendar-day.flex .day-work{color:var(--violet)}
.m-cal .calendar-day.off{background:none;box-shadow:inset 0 0 0 1px var(--line)}
.m-cal .calendar-day.today{border-color:var(--lime)}
.m-cal .calendar-day.selected{background:var(--lime)}
.m-cal .calendar-day.selected .num,.m-cal .calendar-day.selected .day-work{color:#18210a}
.m-strip{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:var(--panel);border-radius:14px;padding:10px 12px}
.m-strip div{display:flex;flex-direction:column;gap:3px;min-width:0}
.m-strip div>b{font-size:var(--fs-m)}
.m-strip span{font-size:var(--fs-s);color:var(--muted)}
.m-strip span b{font:700 var(--fs-m)/1 var(--font-num);color:var(--text)}
.m-strip span b.pos{color:var(--lime)} .m-strip span b.neg{color:var(--danger)}
.m-edit{border:0;border-radius:10px;padding:12px;background:var(--panel2);color:var(--text);font:700 var(--fs-s)/1 var(--font-ui);white-space:nowrap}
.m-hol{display:flex;flex-direction:column;gap:2px;font-size:var(--fs-s);color:var(--muted);padding:0 4px}
.m-hol b{color:var(--blue)}
.m-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.m-acts button{min-height:46px}
.m-selbar .month-selection-head span{font-size:var(--fs-s)}
.m-selbtns{display:flex;gap:6px;align-items:center}
.m-selbtns .selection-clear{font-size:var(--fs-s)}
.m-done{border:0;border-radius:10px;padding:10px 14px;background:var(--lime);color:#18210a;font:700 var(--fs-s)/1 var(--font-ui)}
.m-selbar .month-selection-actions button{min-height:44px;font:700 var(--fs-s)/1 var(--font-ui)}
.month-selection-actions .vacation{color:var(--orange)}
.month-selection-actions .specialLeave{color:var(--blue)}
.month-selection-actions .flex{color:var(--violet)}
.month-selection-actions .clear{color:var(--danger)}
.h-mlist tr.fut td{opacity:.55}
'''

def css(t):
    assert "V38.5" not in t
    return t + CSS

def sw(t):
    return once(t, 'const VERSION="v38.4";', 'const VERSION="v38.5";')

def readme(t):
    t = once(t, "# Klokify – Version 38.4", "# Klokify – Version 38.5")
    return once(t, "## V38.4 – Woche planen", '''## V38.5 – Monat

- **Kopf:** nur „Oktober 2026 ‹ ›“. „Heute“ erscheint nur, wenn ein anderer Monat offen ist.
- **Ein Zahlenblock wie in der Woche:** Saldo groß („bis heute“ / „abgeschlossen“), Arbeit mit Balken, Konto gesamt. Zähler (Urlaub, Krank, Feiertag …) nur, wenn nicht 0. Die drei Kacheln und die Zeile „U 0 · SU 0 …“ entfallen.
- **Kalender:** keine Punkte mehr, Wochenende ohne Kachel, gewählter Tag lime gefüllt, heute mit lime Rahmen, Stunden als „8:52“.
- **Tag-Leiste direkt unter dem Kalender** statt der großen Karte ganz unten: „Di 20.10. · 06:34–15:16 · 8:12 h · +0:12 · Notiz“ und „Bearbeiten ›“.
- **Feiertage** als Zeile unter dem Kalender statt eigener Karte.
- **„+ Zeitraum“ und „Tage auswählen“** unter dem Kalender. Auswählen: schmale Leiste mit „Fertig“, Typen 2 × 3, „Kein Eintrag“ heißt „Löschen“.
- **Liste:** bleibt; künftige Tage blasser, unter der Summe zusätzlich „= +2:23 h“.

## V38.4 – Woche planen''')

edit(f"{d}/index.html", html)
edit(f"{d}/app.js", app)
edit(f"{d}/styles.css", css)
edit(f"{d}/sw.js", sw)
edit(f"{d}/README.md", readme)
print("v38.5 ok")
