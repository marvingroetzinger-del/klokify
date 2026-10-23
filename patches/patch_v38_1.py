import sys, os
d = sys.argv[1]
app = os.path.join(d, "app.js")
s = open(app, encoding="utf-8").read()

def once(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80])
    s = s.replace(a, b)

# Gelegenheiten im Jahr: optional begrenzt mit "alle ›"
once('''function bridgeYearHTML(year){''', '''function bridgeYearHTML(year,limit=0){''')
once('''  const outlook=year===new Date().getFullYear()?bridgeOutlookRow(year):"";
  if(!opts.length&&!outlook) return "";''', '''  const outlook=year===new Date().getFullYear()?bridgeOutlookRow(year):"";
  if(!opts.length&&!outlook) return "";
  const more=limit&&opts.length>limit?opts.length-limit:0;
  if(limit) opts.splice(limit);''')
once('''    ${outlook}
  </section>`;''', '''    ${more?`<button type="button" class="h-bridge-row more" data-sheet="bridges"><span class="h-bridge-txt"><b>${more} weitere Gelegenheiten</b></span><span class="h-bridge-go">alle ›</span></button>`:""}
    ${outlook}
  </section>`;''')

# Jahresansicht neu
a = s.index('function renderYear(){')
b = s.index('function render(){')
s = s[:a] + r'''/* ── V38.1 Jahresansicht: Zusammenfassung oben, Übersicht (Tabelle) | Kalender ── */
let yearMode="table";
try{yearMode=localStorage.getItem("klokify-year-mode")||"table";}catch{}
function setYearMode(m){yearMode=m;try{localStorage.setItem("klokify-year-mode",m);}catch{}render();}
function monthBookedSums(y,m){
  // gleiche Logik wie die Monatsliste: nur gebuchte Tage, dadurch Ist − Soll = Saldo
  const last=new Date(y,m+1,0).getDate();
  let soll=0,ist=0,bal=0,n=0;
  for(let d=1;d<=last;d++){
    const r=monthListRow(localDateKey(new Date(y,m,d)));
    if(!r||!r.counts) continue;
    soll+=r.sumSoll;ist+=r.sumIst;bal+=r.sumBal;n++;
  }
  return {soll,ist,bal,n};
}
function renderYearTable(year){
  const now=new Date();
  const curY=now.getFullYear(),curM=now.getMonth();
  const short=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  let tot={soll:0,ist:0,bal:0,u:0,k:0};
  const rows=short.map((name,m)=>{
    const s=monthBookedSums(year,m),st=monthStats(year,m);
    tot.soll+=s.soll;tot.ist+=s.ist;tot.bal+=s.bal;tot.u+=st.vacation;tot.k+=st.sick;
    const future=year>curY||(year===curY&&m>curM);
    const cur=year===curY&&m===curM;
    const empty=!s.n;
    return `<tr class="${cur?"today":""}${future?" future":""}" data-open-month="${m}" data-open-year="${year}">
      <td class="d"><b>${name}</b></td>
      <td>${empty?"–":fmtH(s.soll)}</td>
      <td>${empty?"–":fmtH(s.ist)}</td>
      <td class="${empty?"muted":s.bal>=0?"pos":"neg"}">${empty?"":fmtSigned(s.bal)}</td>
      <td class="u">${st.vacation||""}</td>
      <td class="k">${st.sick||""}</td>
    </tr>`;
  }).join("");
  return `<section class="h-mlist h-ylist card">
    <table>
      <colgroup><col style="width:16%"><col><col><col style="width:18%"><col style="width:10%"><col style="width:10%"></colgroup>
      <thead><tr><th>Monat</th><th>Soll</th><th>Ist</th><th>±</th><th>U</th><th>K</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>${year}</td><td>${fmtH(tot.soll)}</td><td>${fmtH(tot.ist)}</td><td class="${tot.bal>=0?"pos":"neg"}">${fmtSigned(tot.bal)}</td><td class="u">${tot.u||""}</td><td class="k">${tot.k||""}</td></tr></tfoot>
    </table>
    <p class="h-mlist-note">Stunden dezimal · Summen über gebuchte Tage · U = Urlaubstage, K = Krankheitstage (inkl. geplant) · Zeile antippen = Monat öffnen</p>
  </section>`;
}
function renderYear(){
  const year=yearCursor;
  const showCal=yearMode==="cal"||monthSelectMode||!!bridgeFocus;

  let sumSoll=0,sumIst=0,sumBal=0;
  for(let m=0;m<12;m++){const s=monthBookedSums(year,m);sumSoll+=s.soll;sumIst+=s.ist;sumBal+=s.bal;}
  const used=statusCountForYear(year,"vacation");
  const special=statusCountForYear(year,"specialLeave");
  const sick=statusCountForYear(year,"sick");
  const flex=statusCountForYear(year,"flex");
  const ent=vacationEntitlementTotal();
  const vp=ent?clamp(used/ent*100,0,100):0;
  const holidays=holidaysForYear(year);
  const isPast=year<new Date().getFullYear(),isFuture=year>new Date().getFullYear();

  let months=Array.from({length:12},(_,m)=>yearMonthCalendar(year,m)).join("");
  if(bridgeFocus&&!monthSelectMode){
    const ty=Number(bridgeFocus.to.slice(0,4)),tm=Number(bridgeFocus.to.slice(5,7))-1;
    const fy=Number(bridgeFocus.from.slice(0,4)),fm=Number(bridgeFocus.from.slice(5,7))-1;
    const other=(y,m)=>yearMonthCalendar(y,m).replace('class="year-month-card','class="year-month-card next-year').replace(/(<div class="year-month-title">\s*<span>)([^<]+)/,`$1$2 ${y}`);
    if(ty>year) for(let m=0;m<=tm;m++) months+=other(ty,m);
    if(fy<year) months=Array.from({length:12-fm},(_,i)=>other(fy,fm+i)).join("")+months;
  }

  const extras=[special?`Sonderurlaub ${special}`:"",sick?`Krank ${sick}`:"",flex?`FZA ${flex}`:""].filter(Boolean).join(" · ");
  const summary=`<section class="h-hero w-sum y-sum">
      <div class="h-c">
        <div class="h-c-big"><span>Saldo ${year}</span><b class="${sumBal>=0?"":"neg"}">${hSigned(sumBal)}<small> h</small></b><span>${isFuture?"noch nichts gebucht":isPast?"abgeschlossen":"bis heute gebucht"}</span></div>
        <div class="h-c-rows">
          <div class="h-c-row"><span>Arbeit</span><div class="val">${hDur(sumIst)}<em>von ${hDur(sumSoll)}</em></div><div class="h-bar"><i class="lime" style="width:${sumSoll?clamp(sumIst/sumSoll*100,0,100):0}%"></i></div></div>
          <div class="h-c-row"><span>Urlaub</span><div class="val pz">${String(used).replace(".",",")}<em>von ${String(ent).replace(".",",")}</em></div><div class="h-bar"><i class="or" style="width:${vp}%"></i></div></div>
        </div>
      </div>
      ${extras?`<div class="y-extras">${extras}</div>`:""}
    </section>`;

  const holidayList=state.settings.autoHolidaysBW
    ? `<details class="y-hol card"><summary><span>Feiertage ${year} · ${STATE_NAMES[currentStateCode()]}</span><b>${holidays.length} ›</b></summary>
        ${holidays.map(h=>`<div class="holiday-row"><div class="holiday-date">${weekdayName(h.date)} ${dateShortDE(h.key)}</div><div class="holiday-name">${escapeHtml(h.name)}</div></div>`).join("")||`<div class="holiday-empty">Keine Feiertage gefunden.</div>`}
      </details>`
    : "";

  const legend=`<section class="year-legend card">
      <span class="legend-item"><i class="legend-dot work"></i>Arbeit</span>
      <span class="legend-item"><i class="legend-dot vacation"></i>Urlaub</span>
      <span class="legend-item"><i class="legend-dot specialLeave"></i>Sonderurlaub</span>
      <span class="legend-item"><i class="legend-dot sick"></i>Krank</span>
      <span class="legend-item"><i class="legend-dot holiday"></i>Feiertag</span>
      <span class="legend-item"><i class="legend-dot flex"></i>FZA</span>
    </section>`;

  return `
    <div class="calendar-head">
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

    ${monthSelectMode||bridgeFocus?"":summary}
    ${!monthSelectMode&&!bridgeFocus&&isFuture?bridgeYearHTML(year):""}

    ${monthSelectMode||bridgeFocus?"":`<div class="h-seg" role="tablist" aria-label="Darstellung">
      <button type="button" role="tab" data-year-mode="table" aria-selected="${!showCal}">Übersicht</button>
      <button type="button" role="tab" data-year-mode="cal" aria-selected="${showCal}">Kalender</button>
    </div>`}

    ${showCal?`
      ${monthSelectMode?`<div class="year-calendar-title"><h3>Tage auswählen</h3><span class="year-subtle-label">Tage antippen, unten zuordnen</span></div>`:""}
      ${monthSelectMode?"":bridgeBannerHTML()}
      <section class="year-calendar${monthSelectMode?" selecting":" y-cal"}">${months}</section>
      ${monthSelectMode?selectionPanelHTML():legend}
    `:renderYearTable(year)}

    ${monthSelectMode||bridgeFocus||isFuture?"":bridgeYearHTML(year,3)}
    ${monthSelectMode||bridgeFocus?"":holidayList}
  `;
}
''' + s[b:]

# Umschalter binden
once('''  document.querySelectorAll("[data-month-mode]").forEach(el=>el.addEventListener("click",()=>setMonthMode(el.dataset.monthMode)));''', '''  document.querySelectorAll("[data-month-mode]").forEach(el=>el.addEventListener("click",()=>setMonthMode(el.dataset.monthMode)));
  document.querySelectorAll("[data-year-mode]").forEach(el=>el.addEventListener("click",()=>setYearMode(el.dataset.yearMode)));''')

open(app, "w", encoding="utf-8").write(s)

# Version 38.1
idx = os.path.join(d, "index.html")
h = open(idx, encoding="utf-8").read()
assert h.count("38.0") == 4
h = h.replace("38.0", "38.1")
open(idx, "w", encoding="utf-8").write(h)
sw = os.path.join(d, "sw.js")
t = open(sw, encoding="utf-8").read()
assert t.count('const VERSION="v38.0";') == 1
t = t.replace('const VERSION="v38.0";', 'const VERSION="v38.1";')
open(sw, "w", encoding="utf-8").write(t)

css = os.path.join(d, "styles.css")
open(css, "a", encoding="utf-8").write('''

/* ════ V38.1 Jahresansicht ════ */
.y-sum{padding:14px}
.y-extras{font-size:var(--fs-s);color:var(--muted);border-top:1px solid var(--line);padding-top:10px}
.h-ylist tbody tr{cursor:pointer}
.h-ylist tr.future td{color:var(--muted)}
.h-ylist td.u{color:var(--orange);text-align:center}
.h-ylist td.k{color:var(--danger);text-align:center}
.h-ylist th:nth-child(5),.h-ylist th:nth-child(6){text-align:center}
.h-ylist tfoot td.u,.h-ylist tfoot td.k{text-align:center}
/* Kalender lesbar: 2 Spalten, Tage 12 px */
.year-calendar.y-cal{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px}
.y-cal .year-month-card{padding:10px}
.y-cal .year-month-title span{font-size:var(--fs-m);font-weight:700}
.y-cal .year-weekdays span{font-size:11px!important}
.y-cal .year-days{gap:3px}
.y-cal .year-day{font:600 12px/1 var(--font-num)!important;border-radius:5px!important;min-height:20px}
.h-bridge-row.more{justify-content:space-between}
.h-bridge-row.more .h-bridge-go{color:var(--lime);font-size:var(--fs-s);font-weight:700}
.y-hol{padding:0 14px;background:var(--panel)}
.y-hol summary{display:flex;justify-content:space-between;align-items:center;min-height:52px;cursor:pointer;list-style:none;font-weight:600}
.y-hol summary::-webkit-details-marker{display:none}
.y-hol summary b{color:var(--muted);font-size:var(--fs-s)}
.y-hol[open] summary{border-bottom:1px solid var(--line)}
.y-hol .holiday-row{display:grid;grid-template-columns:96px 1fr;gap:8px;padding:10px 0;border-bottom:1px solid var(--line);font-size:var(--fs-m)}
.y-hol .holiday-row:last-child{border-bottom:0}
.y-hol .holiday-date{font-family:var(--font-num);color:var(--blue);font-weight:600}
.year-legend .legend-item{font-size:var(--fs-s)}
''')

rd = os.path.join(d, "README.md")
r = open(rd, encoding="utf-8").read()
assert r.count("# Klokify – Version 38.0") == 1
r = r.replace("# Klokify – Version 38.0", "# Klokify – Version 38.1")
i = r.index("## V38.0")
r = r[:i] + '''## V38.1 – Jahresansicht

- **Zusammenfassung oben:** groß „Saldo 2026“ (gebuchte Tage, wie Monatsliste – Ist − Soll = Saldo), daneben Arbeit (Balken, von Soll) und Urlaub (genommen/geplant von Anspruch inkl. Vorjahr). Darunter Sonderurlaub/Krank/FZA, wenn vorhanden. Ersetzt Urlaubskarte und die Kacheln „Ist / Soll bis heute / Saldo“ (die Beschriftung „Soll bis heute“ war irreführend).
- **„Übersicht | Kalender“** umschaltbar (wird gemerkt):
  - Übersicht: Tabelle Jan–Dez mit Soll · Ist · ± (dezimal) · U · K, Jahressumme unten, Zeile antippen = Monat öffnen.
  - Kalender: 2 Spalten, Tage 12 px statt 6–7 px, Legende darunter.
  - Auswählen und Brückentag-Hervorhebung schalten automatisch auf Kalender.
- **Gute Gelegenheiten:** im laufenden Jahr die nächsten 3 + „weitere … alle ›“ (Gelegenheiten-Blatt) + Ausblick.
- **Feiertage** eingeklappt („Feiertage 2026 · Bundesland · 12 ›“), mit Wochentag.
- Kopf wie Monat/Woche (Pfeile rechts).

''' + r[i:]
open(rd, "w", encoding="utf-8").write(r)
print("v38.1 ok")

# Nachkorrekturen V38.1
s = open(app, encoding="utf-8").read()
def once2(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80])
    s = s.replace(a, b)
once2('<div class="val">${hDur(sumIst)}<em>von ${hDur(sumSoll)}</em></div>', '<div class="val">${hDur(sumIst)}<em>/ ${hDur(sumSoll)}</em></div>')
once2('<div class="val pz">${String(used).replace(".",",")}<em>von ${String(ent).replace(".",",")}</em></div>', '<div class="val pz">${String(used).replace(".",",")}<em>/ ${String(ent).replace(".",",")} Tage</em></div>')
once2('<summary><span>Feiertage ${year} · ${STATE_NAMES[currentStateCode()]}</span>', '<summary><span>Feiertage ${year} · ${currentStateCode()}</span>')
open(app, "w", encoding="utf-8").write(s)
open(css, "a", encoding="utf-8").write('.h-ylist th:nth-child(2),.h-ylist th:nth-child(3),.h-ylist th:nth-child(4){text-align:right}\n')
print("nachkorrektur ok")
