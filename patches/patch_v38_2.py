import sys, os
d = sys.argv[1]

def edit(path, fn):
    t = open(path, encoding="utf-8").read()
    t = fn(t)
    open(path, "w", encoding="utf-8").write(t)

def once(t, a, b):
    assert t.count(a) == 1, (t.count(a), a[:80])
    return t.replace(a, b)

# ───────── index.html ─────────
def html(h):
    assert h.count("38.1") == 4
    h = h.replace("38.1", "38.2")
    # Pause-Dialog
    a = h.index('<dialog id="pauseDialog"'); b = h.index('</dialog>', a) + 9
    h = h[:a] + '''<dialog id="pauseDialog" class="dialog pz38">
    <div class="dialog-head">
      <div>
        <h2>Pause</h2>
        <div class="muted small" id="pauseDialogSub"></div>
      </div>
      <button type="button" class="icon-btn mini" data-close="pauseDialog" aria-label="Schließen">×</button>
    </div>
    <div class="pz-stat" id="pauseDialogStat"></div>
    <p class="muted" id="pauseDialogHint" hidden></p>
    <button type="button" class="pz-big" id="toggleLivePauseBtn">Pause jetzt starten</button>
    <div class="pz-lbl" id="pauseQuickLabel"></div>
    <div class="pz-chips live-quick-grid" id="liveQuickPauseGrid"></div>
    <button type="button" class="pz-edit" id="pauseEditLink">Pause mit Uhrzeit oder ohne Zeit? <b>Tag bearbeiten ›</b></button>
  </dialog>''' + h[b:]
    # Zeitraum-Dialog
    a = h.index('<dialog id="bulkDialog"'); b = h.index('</dialog>', a) + 9
    types = [("work","Arbeit"),("vacation","Urlaub"),("sick","Krank"),("flex","FZA"),("off","Frei"),("specialLeave","Sonderurlaub"),("holiday","Feiertag")]
    chips = "\n".join(f'      <button type="button" data-bulk-type="{k}" class="type-chip {k}">{l}</button>' for k, l in types)
    h = h[:a] + f'''<dialog id="bulkDialog" class="dialog bulk-dialog bk38">
    <div class="dialog-head">
      <div>
        <h2>Zeitraum eintragen</h2>
        <div class="muted small">Mehrere Tage auf einmal</div>
      </div>
      <button type="button" class="icon-btn mini" data-close="bulkDialog" aria-label="Schließen">×</button>
    </div>

    <div class="bk-types" id="bulkTypeChips">
{chips}
    </div>

    <div class="quick-range-row bk-pre">
      <button type="button" data-range-preset="week">Diese Woche</button>
      <button type="button" data-range-preset="nextweek">Nächste Woche</button>
      <button type="button" data-range-preset="month">Dieser Monat</button>
    </div>

    <div class="form-grid bk-dates">
      <label>Von <input type="date" id="bulkFrom"></label>
      <label>Bis <input type="date" id="bulkTo"></label>
    </div>
    <div class="bk-span" id="bulkSpan"></div>

    <div id="bulkWorkHint" class="bk-hint" hidden>Jeder Tag bekommt seine Sollzeit als Arbeitszeit – ohne Beginn/Ende. Einzelne Tage lassen sich später genau nachtragen. Zukünftige Tage werden nicht gebucht.</div>

    <label class="s-switch"><span>Wochenenden auslassen</span><input type="checkbox" id="bulkSkipWeekends" checked><i aria-hidden="true"></i></label>
    <label class="s-switch"><span>Feiertage auslassen</span><input type="checkbox" id="bulkSkipHolidays" checked><i aria-hidden="true"></i></label>
    <label class="s-switch" id="bulkOverwriteWrap"><span id="bulkOverwriteLabel">Vorhandene Einträge überschreiben</span><input type="checkbox" id="bulkOverwrite"><i aria-hidden="true"></i></label>

    <details class="s-more bk-note">
      <summary>Notiz für alle Tage (optional)</summary>
      <input type="text" id="bulkNote" maxlength="160" placeholder="z. B. Betriebsurlaub">
    </details>

    <div class="bk-foot">
      <div id="bulkPreview" class="bk-res"></div>
      <div class="bk-btns">
        <button type="button" class="ghost-btn" data-close="bulkDialog">Abbrechen</button>
        <button type="button" class="primary-small" id="saveBulkBtn">Eintragen</button>
      </div>
    </div>
  </dialog>''' + h[b:]
    return h
edit(os.path.join(d, "index.html"), html)

# ───────── app.js ─────────
def app(s):
    s = once(s, '''function quickPauseButtonMarkup(min,attr="data-live-quick-pause"){
  return `<button type="button" class="quick-pause-btn" ${attr}="${min}">${min} Min</button>`;
}''', '''function quickPauseButtonMarkup(min,attr="data-live-quick-pause"){
  return `<button type="button" class="quick-pause-btn" ${attr}="${min}">${min}<small> Min</small></button>`;
}''')
    a = s.index('function renderLivePauseDialog(){'); b = s.index('function rangesOverlap(')
    s = s[:a] + r'''/* V38.2: Pause-Dialog mit Stand (genommen / Pflicht), ein großer Knopf je Zustand */
function renderLivePauseDialog(){
  const key=localDateKey(new Date());
  const rec=ensureRecord(key);
  if(isManualWorkRecord(rec)) delete rec.manualWorkedMinutes;
  const ap=activePause(rec);
  const grid=$("liveQuickPauseGrid");
  const presets=getQuickPausePresets();
  const c=recordCalc(key,true);
  const used=Math.round(c.breakMin||0);
  const need=Math.max(Number(state.settings.plannedPauseMin)||0,legalPauseFor(c.target));
  const pct=need?clamp(used/need*100,0,100):100;
  const now=nowTime();
  const runMin=ap?Math.max(0,minutesFromTime(now)-minutesFromTime(ap.start)):0;
  $("pauseDialogSub").textContent=`heute · Arbeit ${hDur(c.worked)} h`;
  $("pauseDialogStat").innerHTML=`<b>${used}<small> Min</small></b><div class="pz-bar"><i class="${ap?"run":""}" style="width:${pct}%"></i></div>
    <span></span><span>${ap?`läuft seit ${ap.start} · ab 6 h Pflicht: ${legalPauseFor(Math.max(c.worked,c.target))||30} Min`:used>=need?`von ${need} Min · Pflichtpause erledigt`:used?`von ${need} Min · noch ${need-used} Min bis zur Pflichtpause`:`von ${need} Min · ab 6 h Arbeit Pflicht`}</span>`;
  const btn=$("toggleLivePauseBtn");
  btn.className=`pz-big ${ap?"stop":"start"}`;
  btn.innerHTML=ap?`${H_ICON.play}Pause beenden <small>läuft ${runMin} Min</small>`:`${H_ICON.pause}Pause jetzt starten`;
  $("pauseQuickLabel").hidden=!!ap;
  $("pauseQuickLabel").textContent=`Oder feste Dauer – startet jetzt (${now}), endet automatisch:`;
  if(ap){
    grid.innerHTML="";
  }else if(presets.length){
    grid.innerHTML=presets.map(min=>quickPauseButtonMarkup(min)).join("");
  }else{
    grid.innerHTML='<div class="live-pause-running">Keine Schnellpausen eingerichtet (Einstellungen → Pause).</div>';
  }
  grid.querySelectorAll("[data-live-quick-pause]").forEach(b=>{
    b.addEventListener("click",()=>bookLiveQuickPause(Number(b.dataset.liveQuickPause)));
  });
}

''' + s[b:]
    s = once(s, '''$("toggleLivePauseBtn").addEventListener("click",()=>{''', '''$("pauseEditLink").addEventListener("click",()=>{$("pauseDialog").close();openEdit(localDateKey(new Date()));});
$("toggleLivePauseBtn").addEventListener("click",()=>{''')

    # Zeitraum: Vorbelegung Nächste Woche, Vorschau neu
    s = once(s, '''function openBulkForMonth(){
  const y=monthCursor.getFullYear(),m=monthCursor.getMonth();
  setBulkType("vacation");
  setBulkDates(new Date(y,m,1),new Date(y,m+1,0));''', '''let bulkPreset="";
function markBulkPreset(p){
  bulkPreset=p;
  document.querySelectorAll("[data-range-preset]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.rangePreset===p)));
}
function openBulkForMonth(){
  // V38.2: Vorbelegung „Nächste Woche“ statt ganzer Monat inkl. vergangener Tage
  setBulkType("vacation");
  const mon=mondayOf(new Date(Date.now()+7*86400000)),fri=new Date(mon);fri.setDate(mon.getDate()+4);
  setBulkDates(mon,fri);
  markBulkPreset("nextweek");''')
    s = once(s, '''function openBulkVacation(fromKey,toKey){
  setBulkType("vacation");''', '''function openBulkVacation(fromKey,toKey){
  markBulkPreset("");
  setBulkType("vacation");''')
    s = once(s, '''document.querySelectorAll("[data-range-preset]").forEach(btn=>btn.addEventListener("click",()=>{
  const p=btn.dataset.rangePreset;''', '''document.querySelectorAll("[data-range-preset]").forEach(btn=>btn.addEventListener("click",()=>{
  const p=btn.dataset.rangePreset;
  markBulkPreset(p);''')
    s = once(s, '''["bulkFrom","bulkTo","bulkSkipWeekends","bulkSkipHolidays","bulkOverwrite"].forEach(id=>$(id).addEventListener("change",updateBulkPreview));''', '''["bulkFrom","bulkTo","bulkSkipWeekends","bulkSkipHolidays","bulkOverwrite"].forEach(id=>$(id).addEventListener("change",updateBulkPreview));
["bulkFrom","bulkTo"].forEach(id=>$(id).addEventListener("input",()=>markBulkPreset("")));''')
    a = s.index('function updateBulkPreview(){'); b = s.index('$("saveBulkBtn").addEventListener("click",async()=>{')
    s = s[:a] + r'''/* V38.2: Zeitraum-Vorschau – Spanne, Wirkung, Knopf sagt was passiert */
const BULK_WORDS={work:["Arbeitstag","Arbeitstage"],vacation:["Urlaubstag","Urlaubstage"],specialLeave:["Sonderurlaubstag","Sonderurlaubstage"],sick:["Krankheitstag","Krankheitstage"],flex:["FZA-Tag","FZA-Tage"],off:["freien Tag","freie Tage"],holiday:["Feiertag","Feiertage"]};
function updateBulkPreview(){
  const info=bulkDatesInfo(),box=$("bulkPreview"),btn=$("saveBulkBtn"),span=$("bulkSpan");
  document.querySelectorAll("[data-bulk-type]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.bulkType===bulkType)));
  if(!info.valid){
    span.textContent="Bitte einen gültigen Zeitraum wählen.";
    box.innerHTML="";btn.disabled=true;btn.textContent="Eintragen";
    $("bulkOverwriteWrap").hidden=true;
    return;
  }
  const from=$("bulkFrom").value,to=$("bulkTo").value,todayK=localDateKey(new Date());
  const wd=k=>{const x=dateFromKey(k);return `${weekdayName(x)} ${pad(x.getDate())}.${pad(x.getMonth()+1)}.`;};
  const past=info.eligible.filter(k=>k<todayK).length;
  span.innerHTML=`<b>${wd(from)}${from!==to?` – ${wd(to)}`:""}</b> · ${info.eligible.length} Tag${info.eligible.length===1?"":"e"}${past&&bulkType!=="work"?` · davon ${past} schon vergangen`:""}`;

  $("bulkOverwriteWrap").hidden=!info.existing;
  if(!info.existing) $("bulkOverwrite").checked=false;
  $("bulkOverwriteLabel").textContent=info.existing===1?"1 vorhandenen Eintrag überschreiben":`${info.existing} vorhandene Einträge überschreiben`;
  const overwrite=$("bulkOverwrite").checked;
  const writeKeys=overwrite?info.eligible:info.eligible.filter(k=>!state.records[k]);
  const n=writeKeys.length;
  const words=BULK_WORDS[bulkType]||["Tag","Tage"];

  let effect="";
  if(bulkType==="vacation"){
    const y=dateFromKey(from).getFullYear();
    const free=vacationEntitlementTotal()-statusCountForYear(y,"vacation");
    const add=writeKeys.filter(k=>![0,6].includes(dateFromKey(k).getDay())).length;
    effect=`Urlaubskonto ${y}: <b>${String(free).replace(".",",")}</b> frei → danach <b class="${free-add<0?"neg":""}">${String(free-add).replace(".",",")}</b>`;
  }else if(bulkType==="work"){
    const total=writeKeys.reduce((a,k)=>a+targetForDate(k),0);
    effect=`Je Tag das Soll als Arbeitszeit · gesamt <b>${hDur(total)} h</b>${info.skippedFuture?` · ${info.skippedFuture} zukünftige Tage ausgelassen`:""}`;
  }else if(bulkType==="off"){
    effect="Kein Soll an diesen Tagen";
  }else{
    effect=`${STATUS[bulkType].label}: Soll wird gutgeschrieben (Saldo ±0)`;
  }
  const skipped=[info.skippedWeekend?`${info.skippedWeekend} Wochenendtage`:"",info.skippedHoliday?`${info.skippedHoliday} Feiertage`:""].filter(Boolean).join(", ");
  box.innerHTML=`<div>${effect}</div>${skipped?`<div class="muted">ausgelassen: ${skipped}</div>`:""}${info.existing&&!overwrite?`<div class="warn">${info.existing===1?"1 Tag mit Eintrag bleibt":`${info.existing} Tage mit Einträgen bleiben`} unverändert</div>`:""}`;
  btn.disabled=!n;
  btn.textContent=n?`${n} ${n===1?words[0]:words[1]} eintragen`:"Nichts einzutragen";
}

''' + s[b:]
    return s
edit(os.path.join(d, "app.js"), app)

# ───────── sw.js ─────────
edit(os.path.join(d, "sw.js"), lambda t: once(t, 'const VERSION="v38.1";', 'const VERSION="v38.2";'))

# ───────── styles.css ─────────
with open(os.path.join(d, "styles.css"), "a", encoding="utf-8") as f:
    f.write('''

/* ════ V38.2 Dialog Pause ════ */
.pz38[open]{display:flex;flex-direction:column;gap:14px}
.pz-stat{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center;font-size:var(--fs-s);color:var(--muted)}
.pz-stat b{font:700 var(--fs-xl)/1 var(--font-num);color:var(--orange)}
.pz-stat b small{font-size:var(--fs-m)}
.pz-bar{height:8px;border-radius:4px;background:var(--bg);overflow:hidden}
.pz-bar i{display:block;height:100%;border-radius:4px;background:var(--orange)}
.pz-bar i.run{background:repeating-linear-gradient(135deg,var(--orange) 0 5px,#c9852b 5px 10px)}
.pz-big{min-height:60px;border:0;border-radius:16px;font:700 var(--fs-l)/1 var(--font-ui);display:flex;align-items:center;justify-content:center;gap:10px}
.pz-big svg{width:22px;height:22px}
.pz-big.start{background:var(--lime);color:#18210a}
.pz-big.stop{background:var(--orange);color:#2a1a04}
.pz-big small{font-size:var(--fs-s);font-weight:600;opacity:.8}
.pz-lbl{font-size:var(--fs-s);color:var(--muted)}
.pz-lbl[hidden]{display:none}
.pz-chips{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.pz-chips .quick-pause-btn{min-height:52px;border:0;border-radius:12px;background:var(--panel2);color:var(--text);font:700 var(--fs-l)/1 var(--font-num)}
.pz-chips .quick-pause-btn small{font:500 var(--fs-s)/1 var(--font-ui);color:var(--muted)}
.pz-chips:empty{display:none}
.pz-edit{border:0;border-radius:12px;background:var(--panel2);color:var(--muted);text-align:left;padding:12px;font:500 var(--fs-s)/1.3 var(--font-ui)}
.pz-edit b{color:var(--text)}

/* ════ V38.2 Dialog Zeitraum ════ */
.bk38{padding-bottom:0}
.bk38[open]{display:flex;flex-direction:column;gap:12px}
.bk-types{display:flex;flex-wrap:wrap;gap:6px}
.bk-types .type-chip{border:0!important;border-radius:10px;padding:10px 12px;min-height:0;background:var(--panel2)!important;color:var(--text)!important;font:600 var(--fs-s)/1 var(--font-ui)!important;box-shadow:none!important}
.bk-types .type-chip[aria-pressed="true"]{background:var(--orange)!important;color:#2a1a04!important}
.bk-types .type-chip.work[aria-pressed="true"]{background:var(--lime)!important;color:#18210a!important}
.bk-types .type-chip.sick[aria-pressed="true"]{background:var(--danger)!important;color:#2a0b0a!important}
.bk-types .type-chip.flex[aria-pressed="true"]{background:var(--violet)!important;color:#160d2b!important}
.bk-types .type-chip.specialLeave[aria-pressed="true"],.bk-types .type-chip.holiday[aria-pressed="true"]{background:var(--blue)!important;color:#0b1a2a!important}
.bk-pre{display:grid!important;grid-template-columns:repeat(3,1fr);gap:6px}
.bk-pre button{min-height:40px;border:1px solid var(--line);border-radius:10px;background:none;color:var(--text);font:600 var(--fs-s)/1 var(--font-ui)}
.bk-pre button[aria-pressed="true"]{border-color:var(--lime);color:var(--lime)}
.bk38 input{font:600 var(--fs-m)/1.2 var(--font-num)!important;min-height:48px;width:100%;min-width:0}
.bk38 label{font-size:var(--fs-s)}
.bk-span{font-size:var(--fs-s);color:var(--muted)}
.bk-span b{color:var(--text)}
.bk-hint{font-size:var(--fs-s);color:var(--muted);padding:10px 12px;border-radius:12px;background:var(--panel2)}
.bk-hint[hidden],#bulkOverwriteWrap[hidden]{display:none}
.bk-note input{margin-bottom:12px}
.bk-foot{position:sticky;bottom:0;margin:4px -20px 0;padding:12px 20px calc(14px + env(safe-area-inset-bottom));background:var(--panel);border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px;z-index:2}
.bk-res{font-size:var(--fs-s);color:var(--muted);display:flex;flex-direction:column;gap:3px}
.bk-res b{color:var(--text);font-family:var(--font-num);font-size:var(--fs-m)}
.bk-res b.neg{color:var(--danger)}
.bk-res .warn{color:var(--orange)}
.bk-btns{display:grid;grid-template-columns:1fr 2fr;gap:8px}
.bk-btns button{min-height:52px;font-size:var(--fs-m)}
''')

# ───────── README ─────────
def readme(r):
    r = once(r, "# Klokify – Version 38.1", "# Klokify – Version 38.2")
    i = r.index("## V38.1")
    return r[:i] + '''## V38.2 – Dialoge Pause und Zeitraum

- **Pause:** oben der Stand des Tages (genommen von Pflicht/geplant, Balken, „noch 15 Min bis zur Pflichtpause“). Ein großer Knopf je Zustand: „Pause jetzt starten“ (grün) oder „Pause beenden · läuft X Min“ (orange). Schnellpausen klar benannt: „Oder feste Dauer – startet jetzt (hh:mm), endet automatisch“ (Verhalten unverändert). Link „Tag bearbeiten ›“ für Pausen mit Uhrzeit oder ohne Zeit.
- **Zeitraum eintragen:** Tagestyp als Chips (Farben wie „Tag bearbeiten“), Vorbelegung „Nächste Woche“ statt ganzer Monat inkl. vergangener Tage, unter den Daten „Mo 26.10. – Fr 30.10. · 5 Tage“ (bei Bedarf „davon X schon vergangen“). Optionen als Schalter; „X vorhandene Einträge überschreiben“ nur sichtbar, wenn es welche gibt. Unten fest: Wirkung (z. B. „Urlaubskonto 2026: 25 frei → danach 20“) und ein Knopf, der sagt, was passiert („5 Urlaubstage eintragen“). Notiz einklappbar.

''' + r[i:]
edit(os.path.join(d, "README.md"), readme)
print("v38.2 ok")
