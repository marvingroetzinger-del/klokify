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
    assert h.count("38.3") == 4
    h = h.replace("38.3", "38.4")
    a = h.index('      <section class="wp-goal">')
    b = h.index('    </form>', a)
    h = h[:a] + f'''      <section class="wp-goal2">
        <label for="plannerFridayEnd"><span>Freitag Feierabend</span><small id="plannerFridayHint"></small></label>
        <input type="time" id="plannerFridayEnd" required>
      </section>
      <div class="wp-pzrow" id="plannerPauseRow" hidden>
        <label>Pause Freitag (Min)<input type="number" id="plannerFridayPause" min="0" max="180" step="5"></label>
        <button type="button" class="wp-pzauto" id="plannerPauseAuto">automatisch</button>
      </div>

      <section id="weekPlannerPreview" class="week-planner-preview wp-preview" aria-live="polite"></section>
      <div id="plannerConstraintRows" hidden></div>

      <div class="wp-dist2" id="plannerDistWrap">
        <span id="plannerDistLabel">Rest verteilen</span>
        <div class="h-seg" role="radiogroup" aria-label="Rest verteilen">
          <button type="button" data-plan-dist="even" role="radio">gleichmäßig</button>
          <button type="button" data-plan-dist="frontload" role="radio">vorarbeiten</button>
        </div>
        <select id="plannerDistribution" hidden>
          <option value="even">Gleichmäßig verteilen</option>
          <option value="frontload">Frühestmöglich vorarbeiten</option>
        </select>
      </div>

      <div class="planner-dialog-actions wp-actions">
        <button type="button" class="wp-del" id="deleteWeekPlanBtn" aria-label="Plan löschen" title="Plan löschen">{TRASH}</button>
        <button type="button" class="ghost-btn" data-close="weekPlannerDialog">Abbrechen</button>
        <button type="submit" class="primary-small">Plan speichern</button>
      </div>
''' + h[b:]
    return h

# ───────── app.js ─────────
def app(s):
    # Tagesliste: offene Tage antippbar, Platz für die Eingabe direkt unter der Zeile
    s = once(s, '''    <div class="planner-preview-list">${result.rows.map(row=>`<div class="planner-preview-row${row.key===localDateKey(new Date())?" today":""}"><span>${plannerRowLabel(row)}</span><strong>${plannerStatusText(row)}</strong><small class="${row.delta>=0?"positive":"negative"}">${row.target?formatSignedHours(row.delta):""}</small></div>`).join("")}</div>${warningHTML}`;''',
    '''    <div class="planner-preview-list">${result.rows.map(row=>{
      const open=row.key!==result.fridayKey&&["flex","constraint"].includes(row.type);
      const cls=`${row.key===localDateKey(new Date())?" today":""}${open?" open":""}${row.type==="constraint"?" fix":""}${row.key===result.fridayKey?" goal":""}`;
      return `<div class="planner-preview-row${cls}"${open?` data-wp-open="${row.key}" role="button" tabindex="0" aria-label="${plannerRowLabel(row)} feste Endzeit"`:""}><span>${plannerRowLabel(row)}</span><strong>${plannerStatusText(row)}</strong><small class="${row.delta>=0?"positive":"negative"}">${row.target?formatSignedHours(row.delta):""}</small></div>${open?`<div class="wp-slot" data-wp-slot="${row.key}"></div>`:""}`;
    }).join("")}</div>${warningHTML}`;''')
    # Warnung über 10 h
    s = once(s, '''  const result=calculateWeekPlan(plan);
  const warningHTML=''', '''  const result=calculateWeekPlan(plan);
  result.rows.filter(r=>["flex","constraint","goal"].includes(r.type)&&r.work>MAX_WORK_MIN).forEach(r=>result.warnings.push(`${weekdayName(dateFromKey(r.key))}: über 10 h geplant (${formatCompact(r.work)})`));
  const warningHTML=''')

    # Eingabefelder für feste Endzeit: einmal gebaut, beim Neuzeichnen in die Zeile gehängt
    a = s.index("function renderPlannerConstraintRows(plan){")
    b = s.index("function openWeekPlanner(){")
    s = s[:a] + '''function renderPlannerConstraintRows(plan){
  const box=$("plannerConstraintRows");
  document.querySelectorAll(".wp-edit").forEach(p=>p.remove());
  const items=plannerConstraintCandidates();
  box.innerHTML=items.map(({key,status,rec,isFriday,locked})=>{
    if(isFriday||locked||recordIsCreditedStatus(status)||status==="off"||rec?.end||isManualWorkRecord(rec)) return "";
    const spec=plan.constraints?.[key]||{};
    return `<div class="wp-edit" data-wp-edit="${key}" hidden>
      <label>bis<input type="time" data-planner-end="${key}" value="${spec.end||""}"></label>
      <label>Pause<input type="number" min="0" max="180" step="5" data-planner-pause="${key}" value="${spec.end?(spec.pauseMin??plannerRecommendedPause(key,spec.end)):""}" placeholder="auto"></label>
      <button type="button" data-wp-clear="${key}">lösen</button>
    </div>`;
  }).join("");
  box.querySelectorAll("input").forEach(el=>el.addEventListener("change",updateWeekPlannerPreview));
  box.querySelectorAll("[data-wp-clear]").forEach(btn=>btn.addEventListener("click",()=>{
    const k=btn.dataset.wpClear;
    document.querySelector(`[data-planner-end="${k}"]`).value="";
    document.querySelector(`[data-planner-pause="${k}"]`).value="";
    btn.closest(".wp-edit").hidden=true;
    updateWeekPlannerPreview();
  }));
}
function placePlannerEditRows(){
  document.querySelectorAll(".wp-edit").forEach(p=>{
    const slot=document.querySelector(`[data-wp-slot="${p.dataset.wpEdit}"]`);
    (slot||$("plannerConstraintRows")).appendChild(p);
  });
}
function togglePlannerEdit(key){
  const p=document.querySelector(`[data-wp-edit="${key}"]`);
  if(!p) return;
  p.hidden=!p.hidden;
  if(!p.hidden) p.querySelector("input")?.focus({preventScroll:true});
}

''' + s[b:]

    # Vorschau: Hinweis mit Pause-Knopf, Verteilen nur bei 2+ offenen Tagen, Felder einhängen
    s = once(s, '''  $("plannerFridayHint").textContent=end?`Beginn ${plannerStartForKey(currentPlannerFridayKey())} · Pause ${plannerFridayPauseTouched?"selbst gesetzt":"automatisch nach Arbeitszeit"}`:"Wunschzeit für Freitag wählen.";''',
    '''  $("plannerFridayHint").innerHTML=end?`Beginn ${plannerStartForKey(currentPlannerFridayKey())} · <button type="button" class="wp-pzbtn" data-wp-pause>Pause ${Math.max(0,Number($("plannerFridayPause").value)||0)} Min</button> ${plannerFridayPauseTouched?"(selbst)":"(auto)"}`:"Wunschzeit wählen";''')
    s = once(s, '''  $("weekPlannerPreview").innerHTML=end?renderWeekPlanPreview(draft):'<div class="planner-empty">Wähle zuerst deine gewünschte Feierabendzeit für Freitag.</div>';
}''', '''  document.querySelectorAll("#weekPlannerPreview .wp-edit").forEach(p=>$("plannerConstraintRows").appendChild(p));
  $("weekPlannerPreview").innerHTML=end?renderWeekPlanPreview(draft):'<div class="planner-empty">Wähle zuerst deine gewünschte Feierabendzeit für Freitag.</div>';
  placePlannerEditRows();
  const flex=end?calculateWeekPlan(draft).rows.filter(r=>r.type==="flex"):[];
  $("plannerDistWrap").hidden=flex.length<2;
  $("plannerDistLabel").textContent=`Rest auf ${flex.map(r=>weekdayName(dateFromKey(r.key))).join(" + ")}`;
}''')
    # openWeekPlanner: alter Bereich weg, Mülleimer-Spalte
    s = once(s, '''  $("deleteWeekPlanBtn").hidden=!state.weekPlans?.[plannerWeekKey];''', '''  $("deleteWeekPlanBtn").hidden=!state.weekPlans?.[plannerWeekKey];
  $("deleteWeekPlanBtn").closest(".wp-actions").classList.toggle("no-del",!state.weekPlans?.[plannerWeekKey]);
  $("plannerPauseRow").hidden=true;''')
    s = once(s, '''  $("weekPlannerDateLabel").textContent=`${pad(mon.getDate())}.${pad(mon.getMonth()+1)}. – ${pad(fr.getDate())}.${pad(fr.getMonth()+1)}.${fr.getFullYear()}`;''',
                '''  $("weekPlannerDateLabel").textContent=`KW ${isoWeekNumber(mon)} · ${pad(mon.getDate())}.${pad(mon.getMonth()+1)}. – ${pad(fr.getDate())}.${pad(fr.getMonth()+1)}.`;''')

    # Klicks: Tag öffnen, Pause ein-/ausblenden, Pause zurück auf automatisch
    s = once(s, '''$("weekPlannerPreview").addEventListener("click",e=>{
  const b=e.target.closest("[data-take-friday]");
  if(!b) return;''', '''$("weekPlannerPreview").addEventListener("click",e=>{
  const o=e.target.closest("[data-wp-open]");
  if(o&&!e.target.closest(".wp-edit")){togglePlannerEdit(o.dataset.wpOpen);return;}
  const b=e.target.closest("[data-take-friday]");
  if(!b) return;''')
    s = once(s, '''document.querySelectorAll("[data-plan-dist]").forEach(b=>b.addEventListener("click"''', '''$("weekPlannerPreview").addEventListener("keydown",e=>{
  const o=e.target.closest("[data-wp-open]");
  if(o&&(e.key==="Enter"||e.key===" ")){e.preventDefault();togglePlannerEdit(o.dataset.wpOpen);}
});
$("plannerFridayHint").addEventListener("click",e=>{
  if(!e.target.closest("[data-wp-pause]")) return;
  e.preventDefault();
  $("plannerPauseRow").hidden=!$("plannerPauseRow").hidden;
  if(!$("plannerPauseRow").hidden) $("plannerFridayPause").focus({preventScroll:true});
});
$("plannerPauseAuto").addEventListener("click",()=>{plannerFridayPauseTouched=false;$("plannerPauseRow").hidden=true;updateWeekPlannerPreview();});
document.querySelectorAll("[data-plan-dist]").forEach(b=>b.addEventListener("click"''')
    return s

CSS = '''
/* ── V38.4 Woche planen ── */
.wp-goal2{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;border-radius:16px;background:var(--panel2)}
.wp-goal2 label{display:flex;flex-direction:column;gap:2px;min-width:0}
.wp-goal2 label span{font-weight:700;font-size:var(--fs-m);color:var(--text)}
.wp-goal2 small{font-size:var(--fs-s);font-weight:500;color:var(--muted)}
.wp37 .wp-goal2 input#plannerFridayEnd{flex:0 0 auto;width:auto;min-width:0;font:700 30px/1 var(--font-num)!important;color:var(--lime);padding:8px 12px;border-radius:12px;background:var(--bg);border:1px solid var(--line);min-height:52px}
.wp-goal2 input#plannerFridayEnd::-webkit-calendar-picker-indicator{display:none}
.wp-pzbtn{border:0;background:none;padding:2px 0;color:var(--text);font:600 var(--fs-s)/1.2 var(--font-ui);border-bottom:1px dashed var(--muted)}
.wp-pzrow{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
.wp-pzrow[hidden]{display:none}
.wp-pzrow label{display:flex;flex-direction:column;gap:4px;font-size:var(--fs-s);color:var(--muted)}
.wp-pzauto{min-height:48px;border:0;border-radius:10px;padding:0 12px;background:var(--panel2);color:var(--text);font:600 var(--fs-s)/1 var(--font-ui)}
.wp-preview{border:1px solid var(--line)}
.wp-preview .planner-preview-head{background:var(--panel2);padding:12px}
.wp-preview .planner-preview-head span{font-weight:700;color:var(--muted)}
.wp-preview .planner-preview-head strong{font-size:18px}
.wp-calc{border-top:1px solid var(--line);align-items:baseline}
.wp-calc span{white-space:nowrap}
.wp-preview .planner-preview-row{align-items:center;min-height:46px;border-top:1px solid var(--line)}
.wp-preview .planner-preview-row:last-child strong{color:inherit}
.wp-preview .planner-preview-row.goal strong{color:var(--lime)}
.wp-preview .planner-preview-row.open{cursor:pointer}
.wp-preview .planner-preview-row.open strong::after{content:" ✎";color:var(--muted);font-weight:500}
.wp-preview .planner-preview-row.fix strong{color:var(--blue)}
.wp-preview .planner-preview-row.fix strong::after{content:" · fest";color:var(--blue);font:600 var(--fs-s)/1 var(--font-ui)}
.wp-slot:empty{display:none}
.wp-edit{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:end;padding:0 12px 10px}
.wp-edit[hidden]{display:none}
.wp-edit label{display:flex;flex-direction:column;gap:4px;font-size:var(--fs-s);color:var(--muted);min-width:0}
.wp37 .wp-edit input{width:100%;min-width:0}
.wp-edit button{min-height:48px;border:0;border-radius:10px;padding:0 10px;background:none;color:var(--muted);font:600 var(--fs-s)/1 var(--font-ui)}
.wp-dist2{display:flex;justify-content:space-between;align-items:center;gap:8px}
.wp-dist2[hidden]{display:none}
.wp-dist2>span{font-size:var(--fs-s);color:var(--muted);white-space:nowrap}
.wp-dist2 .h-seg{flex:0 0 auto}
.wp-dist2 .h-seg button{padding:0 12px}
.wp-dist2 .h-seg button[aria-checked="true"]{background:var(--panel2);color:var(--text)}
.wp37 .wp-actions{grid-template-columns:52px auto minmax(0,1fr);margin:0 -18px;padding-inline:18px}
.wp37 .wp-actions.no-del{grid-template-columns:auto minmax(0,1fr)}
.wp37 .wp-actions button{white-space:nowrap;padding-inline:14px;min-width:0}
.wp-del{min-height:48px;border:1px solid rgba(240,118,114,.4);border-radius:14px;background:none;color:var(--danger);display:grid;place-items:center;padding:0}
.wp-del[hidden]{display:none}
'''

def css(t):
    assert "V38.4" not in t
    return t + CSS

def sw(t):
    return once(t, 'const VERSION="v38.3";', 'const VERSION="v38.4";')

def readme(t):
    t = once(t, "# Klokify – Version 38.3", "# Klokify – Version 38.4")
    return once(t, "## V38.3 – Tag bearbeiten", '''## V38.4 – Woche planen

- **Freitagsziel:** eine Zeile „Freitag Feierabend“ mit großer Uhrzeit zum Antippen. Die ±-Knöpfe sind weg. Darunter „Beginn 06:35 · Pause 30 Min (auto)“ – Tippen auf die Pause blendet das Feld ein, „automatisch“ setzt sie zurück.
- **Plan-Block bleibt:** „Wochenziel exakt geplant“ und die Rechenzeile Mo–Do / Fr = Woche, jetzt etwas größer; „Genau Wochenziel: bis …“ weiter nur bei Abweichung.
- **Feste Endzeit direkt in der Tagesliste:** offene Tage (✎) antippen → „bis“ und „Pause“ in der Zeile, „lösen“ gibt den Tag wieder frei. Feste Tage blau mit „fest“. Der eigene Bereich unten entfällt.
- **Verteilen** in einer Zeile („Rest auf Mi + Do“), nur sichtbar bei mindestens zwei offenen Tagen.
- **Warnung**, wenn ein geplanter Tag über 10 h kommt. Plan löschen per Mülleimer.

## V38.3 – Tag bearbeiten''')

edit(f"{d}/index.html", html)
edit(f"{d}/app.js", app)
edit(f"{d}/styles.css", css)
edit(f"{d}/sw.js", sw)
edit(f"{d}/README.md", readme)
print("v38.4 ok")
