import sys
d = sys.argv[1]

def edit(path, fn):
    t = open(path, encoding="utf-8").read()
    t = fn(t)
    open(path, "w", encoding="utf-8").write(t)

def once(t, a, b):
    assert t.count(a) == 1, (t.count(a), a[:80])
    return t.replace(a, b)

TRASH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>'

# ───────── index.html ─────────
def html(h):
    assert h.count("38.2") == 4
    h = h.replace("38.2", "38.3")
    h = once(h, '''      <div class="dialog-head">
        <div>
          <h2>Tag bearbeiten</h2>
          <div class="muted small" id="editDateLabel"></div>
        </div>
        <button type="button" class="icon-btn mini" data-close="editDialog">×</button>
      </div>
''', '''      <div class="dialog-head">
        <h2>Tag bearbeiten</h2>
        <button type="button" class="icon-btn mini" data-close="editDialog" aria-label="Schließen">×</button>
      </div>
      <div class="e-daynav">
        <button type="button" id="editPrevDay" aria-label="Vortag">‹</button>
        <div><b id="editDateLabel"></b><small id="editDateSub"></small></div>
        <button type="button" id="editNextDay" aria-label="Folgetag">›</button>
      </div>
''')
    h = once(h, '''        <div class="subhead-row pause-subhead-row">
          <h3>Pausen</h3>
          <div class="pause-head-actions">
            <div class="edit-quick-pause-row" id="editQuickPauseButtons"></div>
            <button type="button" class="tiny-btn" id="addPauseRowBtn">+ Pause</button>
          </div>
        </div>
        <div id="pauseRows"></div>
''', '''        <div class="e-ph">
          <h3>Pausen</h3>
          <span id="editPauseSum"></span>
        </div>
        <div id="pauseRows"></div>
        <div class="e-add">
          <div class="edit-quick-pause-row" id="editQuickPauseButtons"></div>
          <button type="button" id="addPauseRowBtn">+ mit Uhrzeit</button>
        </div>
''')
    h = once(h, '<summary>Weitere Optionen</summary>',
             '<summary><span><b>Sonderfälle</b> · <span class="e-adv-sum" id="editAdvSum"></span></span></summary>')
    h = once(h, '''      <label>Notiz <input type="text" id="editNote" maxlength="160" placeholder="optional"></label>
''', '''      <details class="edit-advanced e-note" id="editNoteWrap">
        <summary><b>+ Notiz</b></summary>
        <div class="edit-advanced-panel"><input type="text" id="editNote" maxlength="160" placeholder="z. B. Montage Baustelle" aria-label="Notiz"></div>
      </details>
''')
    h = once(h, '''        <button type="button" class="ghost-btn" data-close="editDialog">Abbrechen</button>
        <button type="submit" class="primary-small">Speichern</button>
      </div>
    </form>''', f'''        <button type="button" class="e-del" id="editDeleteBtn" aria-label="Eintrag löschen" title="Eintrag löschen">{TRASH}</button>
        <button type="button" class="ghost-btn" data-close="editDialog">Abbrechen</button>
        <button type="submit" class="primary-small">Speichern</button>
      </div>
    </form>''')
    return h

# ───────── app.js ─────────
def app(s):
    # Typen: Löschen wandert in den Mülleimer
    s = once(s, '["specialLeave","Sonderurlaub"],["holiday","Feiertag"],["clear","Kein Eintrag"]];',
                '["specialLeave","Sonderurl."],["holiday","Feiertag"]];')

    # Pausen-Editor: +15 … und kompakte Zeilen
    s = once(s, '  quick.innerHTML=presets.map(min=>quickPauseButtonMarkup(min,"data-edit-quick-pause")).join("");',
                '  quick.innerHTML=presets.map(min=>`<button type="button" data-edit-quick-pause="${min}" aria-label="${min} Min Pause ohne Uhrzeit">+${min}</button>`).join("");')
    s = once(s, '''      return `<div class="pause-edit-row fixed-pause-row">
        <div class="fixed-pause-label"><span>⚡</span><strong>${fixed} Min</strong><small>Schnellpause</small></div>
        <button type="button" class="pause-delete" data-delete-pause="${i}">×</button>
      </div>`;
    }
    return `<div class="pause-edit-row">
      <input type="time" value="${p.start||""}" data-pause-start="${i}">
      <span class="pause-sep">–</span>
      <input type="time" value="${p.end||""}" data-pause-end="${i}">
      <button type="button" class="pause-delete" data-delete-pause="${i}">×</button>
    </div>`;''', '''      return `<div class="pause-edit-row fixed-pause-row">
        <div class="fixed-pause-label"><strong>${fixed} Min</strong></div>
        <span class="e-pdur">ohne Uhrzeit</span>
        <button type="button" class="pause-delete" data-delete-pause="${i}" aria-label="Pause löschen">×</button>
      </div>`;
    }
    return `<div class="pause-edit-row">
      <span class="e-ptimes"><input type="time" value="${p.start||""}" data-pause-start="${i}" aria-label="Pause ${i+1} Beginn"><i>–</i><input type="time" value="${p.end||""}" data-pause-end="${i}" aria-label="Pause ${i+1} Ende"></span>
      <span class="e-pdur" data-pause-dur="${i}"></span>
      <button type="button" class="pause-delete" data-delete-pause="${i}" aria-label="Pause löschen">×</button>
    </div>`;''')

    # Vorschau: Pausensumme gegen Pflicht, Zeilendauer, Warnungen, Urlaubskonto
    a = s.index("function updateEditPreview(){")
    b = s.index("function openEdit(key){")
    s = s[:a] + r'''function updateEditAdvSum(){
  const el=$("editAdvSum");
  if(!el) return;
  const parts=[];
  const mp=parseWorkDurationInput($("editManualWorked").value);
  if(mp&&!mp.error) parts.push(`Arbeitszeit direkt ${hDur(mp.minutes)} h`);
  const raw=$("editTarget").value;
  const t=Math.round((Number(raw)||0)*60);
  if(raw!==""&&editDateKey&&t!==targetForDate(editDateKey)) parts.push(`Soll ${hDur(t)} h`);
  el.textContent=parts.length?parts.join(" · "):"Pause nur als Dauer, Arbeitszeit direkt, Soll";
  el.classList.toggle("set",parts.length>0);
}
function updateEditPreview(){
  const el=$("editPreview");
  if(!el) return;
  updateEditAdvSum();
  const sumEl=$("editPauseSum");
  const setSum=(text,cls="")=>{sumEl.textContent=text;sumEl.className=cls;};
  const status=$("editStatus").value;
  const target=Math.round((Number($("editTarget").value)||0)*60);
  if(status==="clear"){el.innerHTML=`<span>Tag wird auf <b>Kein Eintrag</b> zurückgesetzt</span>`;return;}
  if(status!=="work"){
    const credited=["vacation","specialLeave","sick","holiday","flex"].includes(status);
    let extra="";
    if(status==="vacation"&&editDateKey){
      const dd=dateFromKey(editDateKey),y=dd.getFullYear();
      const counted=state.records[editDateKey]?.status==="vacation"||[0,6].includes(dd.getDay());
      const free=vacationEntitlementTotal()-statusCountForYear(y,"vacation")-(counted?0:1);
      extra=` · danach <b class="${free<0?"neg":""}">${String(free).replace(".",",")}</b> Urlaubstage frei`;
    }
    el.innerHTML=credited?`<span>${STATUS[status].label} · <b>${hDur(target)} h</b> gutgeschrieben · Saldo <b class="pos">0:00</b>${extra}</span>`:`<span>Frei · kein Soll</span>`;
    return;
  }
  const mp=parseWorkDurationInput($("editManualWorked").value);
  const manual=mp&&!mp.error?mp.minutes:null;
  const a=minutesFromTime($("editStart").value),eRaw=minutesFromTime($("editEnd").value);
  const isToday=editDateKey===localDateKey(new Date());
  const running=isToday&&eRaw===null;
  const e=eRaw!==null?eRaw:(isToday?minutesFromTime(nowTime()):null);
  let pause=0;
  const rowDur={};
  editPauses.forEach((p,i)=>{
    const fx=Number(p.minutes)||0;
    if(fx&&!p.start){pause+=fx;return;}
    const ps=minutesFromTime(p.start),pe=minutesFromTime(p.end)??(running?e:null);
    if(ps===null||pe===null||pe<=ps||a===null||e===null){rowDur[i]=null;return;}
    const m=Math.max(0,Math.min(pe,e)-Math.max(ps,a));
    rowDur[i]=p.end?`${m} Min`:`läuft ${m} Min`;
    pause+=m;
  });
  document.querySelectorAll("#pauseRows [data-pause-dur]").forEach(x=>{x.textContent=rowDur[x.dataset.pauseDur]||"–";});
  if(a===null&&manual){
    setSum("");
    const bal=manual-target;
    el.innerHTML=`<span>Sammelbuchung <b>${hDur(manual)} h</b> · Saldo <b class="${bal>=0?"pos":"neg"}">${hSigned(bal)} h</b></span>`;return;
  }
  if(a===null){setSum(editPauses.length?`${pause} Min`:"");el.innerHTML=`<span>Beginn fehlt noch</span>`;return;}
  if(e===null){setSum(editPauses.length?`${pause} Min`:"");el.innerHTML=`<span>Ende fehlt noch</span>`;return;}
  const worked=Math.max(0,e-a-pause),bal=worked-target;
  const need=legalPauseFor(worked);
  const warn=[];
  if(need===0){
    setSum(running?`${pause} Min · ab 6 h Pflicht 30`:`${pause} Min`);
    if(running&&worked>=300&&pause<30) warn.push(`ab 6 h fehlen noch ${30-pause} Min Pause`);
  }else if(pause>=need){
    setSum(`${pause} Min · Pflicht ${need} ✓`,"ok");
  }else{
    setSum(`${pause} Min · Pflicht ${need} – fehlen ${need-pause}`,"warn");
    warn.push(`über ${need===45?9:6} h: ${need} Min Pause Pflicht (fehlen ${need-pause})`);
  }
  if(worked>MAX_WORK_MIN) warn.push("über 10 h Arbeit");
  el.innerHTML=`<span>${running?"bis jetzt · ":""}Arbeit <b>${hDur(worked)} h</b> · Pause <b>${pause} Min</b> · Saldo <b class="${bal>=0?"pos":"neg"}">${hSigned(bal)} h</b></span>${warn.length?`<span class="warn">${warn.join(" · ")}</span>`:""}`;
}
let editDraftSig="";
function editDraftSignature(){
  return JSON.stringify([$("editStatus").value,$("editStart").value,$("editEnd").value,$("editManualWorked").value,$("editTarget").value,$("editNote").value,editPauses]);
}
''' + s[b:]

    # openEdit: Herkunft nur beim ersten Öffnen merken, Kopf mit Blättern
    s = once(s, '''  captureEditOrigin();
  editDateKey=key;''', '''  if(!$("editDialog").open) captureEditOrigin();
  editDateKey=key;''')
    s = once(s, '''  $("editDateLabel").textContent=`${weekdayName(d,false)}, ${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;''',
                '''  const nowD=new Date(),isTodayKey=key===localDateKey(nowD);
  $("editDateLabel").textContent=`${weekdayName(d)} ${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()!==nowD.getFullYear()?d.getFullYear():""}`;
  const hol=bwHolidayName(key);
  $("editDateSub").textContent=[isTodayKey?"heute":"",`KW ${isoWeekNumber(d)}`,hol||`Soll ${hDur(targetForDate(key))} h`].filter(Boolean).join(" · ");''')
    s = once(s, '''  $("editNote").value=rec.note||"";
  editPauses=''', '''  $("editNote").value=rec.note||"";
  $("editNoteWrap").open=!!rec.note;
  $("editDeleteBtn").hidden=!existing;
  $("editDeleteBtn").closest(".e-actions").classList.toggle("no-del",!existing);
  editPauses=''')
    s = once(s, '''  $("editDialog").showModal();
  updateEditPreview();
}''', '''  if(!$("editDialog").open) $("editDialog").showModal();
  updateEditPreview();
  editDraftSig=editDraftSignature();
}''')
    s = once(s, '''  const note=$("editNote").closest("label");
  if(note) note.style.display=status==="clear"?"none":"grid";''', '''  const note=$("editNoteWrap");
  if(note) note.style.display=status==="clear"?"none":"block";''')

    # Speichern als eigene Funktion (für Speichern und Blättern)
    a = s.index('''  if(status==="work"){
    const validation=validateWorkEditDraft();''')
    end = '''  save();
  $("editDialog").close();
  renderBackToEditOrigin("Tag gespeichert");
});
'''
    b = s.index(end, a)
    body = s[a:b].replace("return;", "return false;")
    s = s[:a] + '''  if(!commitEditDraft()) return;
  $("editDialog").close();
  renderBackToEditOrigin("Tag gespeichert");
});
function commitEditDraft(){
  const status=$("editStatus").value;
''' + body + '''  save();
  return true;
}
/* V38.3: Löschen per Mülleimer, Tage blättern */
$("editDeleteBtn").addEventListener("click",async()=>{
  if(!state.records[editDateKey]) return;
  if(!(await confirmClearDay(editDateKey))) return;
  delete state.records[editDateKey];
  save();
  $("editDialog").close();
  renderBackToEditOrigin("Eintrag zurückgesetzt – Kein Eintrag");
});
async function stepEditDay(n){
  if(editDraftSignature()!==editDraftSig){
    const ok=await askConfirm(`Änderungen am ${$("editDateLabel").textContent} speichern?`,{ok:"Speichern",cancel:"Verwerfen"});
    if(ok){
      if($("editStatus").value==="work"){
        const v=validateWorkEditDraft();
        if(v){showEditValidation(v.message,v.focusId);return;}
      }
      if(!commitEditDraft()) return;
      render();
      toast("Tag gespeichert");
    }
  }
  const d=dateFromKey(editDateKey);
  openEdit(localDateKey(new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)));
}
$("editPrevDay").addEventListener("click",()=>stepEditDay(-1));
$("editNextDay").addEventListener("click",()=>stepEditDay(1));
''' + s[b + len(end):]
    return s

CSS = '''
/* ── V38.3 Tag bearbeiten ── */
.edit37 .dialog-head h2{margin:0}
.e-daynav{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;gap:8px;align-items:center}
.e-daynav button{width:44px;height:44px;border:0;border-radius:12px;background:var(--panel2);color:var(--text);font:700 var(--fs-l)/1 var(--font-ui)}
.e-daynav div{text-align:center;min-width:0}
.e-daynav b{display:block;font:700 var(--fs-l)/1.1 var(--font-num)}
.e-daynav small{display:block;font-size:var(--fs-s);color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.edit37 .e-types{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.edit37 .e-type{padding:12px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.e-ph{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:2px 0 8px}
.e-ph h3{margin:0;font-size:var(--fs-m)}
#editPauseSum{font-size:var(--fs-s);color:var(--muted);text-align:right}
#editPauseSum.ok{color:var(--lime)}
#editPauseSum.warn{color:var(--orange)}
.edit37 .pause-edit-row,.edit37 .fixed-pause-row{display:grid;grid-template-columns:minmax(0,1fr) auto 40px;gap:6px;align-items:center;min-height:52px;padding:0 4px 0 6px;border-radius:12px;background:var(--panel2);border:0;margin:0 0 6px}
.e-ptimes{display:flex;align-items:center;gap:0;min-width:0}
.e-ptimes i{font-style:normal;color:var(--muted);padding:0 2px}
.edit37 .pause-edit-row input{background:none!important;border:0!important;box-shadow:none!important;padding:0 4px!important;min-height:44px;font:700 var(--fs-l)/1 var(--font-num)!important;flex:0 1 auto;width:4.3em;min-width:0;color:var(--text)}
.edit37 .pause-edit-row input::-webkit-calendar-picker-indicator{display:none}
.e-pdur{font-size:var(--fs-s);color:var(--muted);white-space:nowrap}
.edit37 .fixed-pause-row{grid-template-columns:minmax(0,1fr) auto 40px!important}
.edit37 .pause-delete{width:40px;height:40px;border:0;border-radius:10px;background:none;color:var(--danger);font-size:20px}
.edit37 .fixed-pause-label{display:flex;align-items:center;padding-left:6px}
.edit37 .fixed-pause-label strong{font:700 var(--fs-l)/1 var(--font-num);color:var(--text)}
.edit37 .no-pauses{font-size:var(--fs-s);color:var(--muted);margin:0 0 8px}
.e-add{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) 1.5fr;gap:6px;margin-bottom:12px}
.e-add .edit-quick-pause-row{display:contents}
.edit37 .e-add button{min-height:44px;border:1px dashed var(--line);border-radius:10px;background:none;color:var(--text);padding:0 4px;font:700 var(--fs-m)/1.1 var(--font-num)!important}
.edit37 .e-add #addPauseRowBtn{font:600 var(--fs-s)/1.1 var(--font-ui)!important}
.edit37 .edit-advanced summary{font-weight:500;color:var(--muted)}
.edit37 .edit-advanced summary b{color:var(--text)}
.e-adv-sum.set{color:var(--orange)}
.e-note .edit-advanced-panel input{width:100%}
.edit37 .e-actions{grid-template-columns:52px 1fr 2fr;margin:0 -18px;padding-inline:18px}
.edit37 .e-actions.no-del{grid-template-columns:1fr 2fr}
.e-del{min-height:48px;border:1px solid rgba(240,118,114,.4);border-radius:14px;background:none;color:var(--danger);display:grid;place-items:center;padding:0}
.e-del[hidden]{display:none}
.e-preview .warn{display:block;color:var(--orange);margin-top:2px}
'''

def css(t):
    assert "V38.3" not in t
    return t + CSS

def sw(t):
    return once(t, 'const VERSION="v38.2";', 'const VERSION="v38.3";')

def readme(t):
    t = once(t, "# Klokify – Version 38.2", "# Klokify – Version 38.3")
    return once(t, "## V38.2 – Dialoge Pause und Zeitraum", '''## V38.3 – Tag bearbeiten

- **Kopf:** „‹ Do 22.10. ›“ – Tage blättern, ohne den Dialog zu schließen. Darunter „heute · KW 43 · Soll 8:00 h“ (bzw. Feiertagsname). Ungespeicherte Änderungen: Rückfrage „Speichern / Verwerfen“.
- **Tagestyp:** 2 Zeilen à 4. „Kein Eintrag“ ist kein Typ mehr – Löschen über den Mülleimer unten links (nur sichtbar, wenn ein Eintrag existiert, mit Rückfrage).
- **Pausen:** Kopfzeile mit Summe gegen Pflicht („45 Min · Pflicht 30 ✓“, orange bei Fehlbetrag). Je Pause eine Zeile „09:00 – 09:15 · 15 Min ×“, Uhrzeit per Tippen änderbar. Hinzufügen in einer Reihe: +15 +20 +30 +45 (ohne Uhrzeit) und „+ mit Uhrzeit“.
- **Sonderfälle** (vorher „Weitere Optionen“): zeigt zugeklappt, was abweicht (z. B. „Soll 6:00 h“, orange).
- **Notiz** einklappbar, offen wenn Text vorhanden.
- **Fuß:** Arbeit · Pause · Saldo, dazu Warnungen (Pflichtpause fehlt, über 10 h). Bei Urlaub: „danach X Urlaubstage frei“.

## V38.2 – Dialoge Pause und Zeitraum''')

edit(f"{d}/index.html", html)
edit(f"{d}/app.js", app)
edit(f"{d}/styles.css", css)
edit(f"{d}/sw.js", sw)
edit(f"{d}/README.md", readme)
print("v38.3 ok")
