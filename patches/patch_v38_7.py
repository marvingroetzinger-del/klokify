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
    assert h.count("38.6") == 4
    return h.replace("38.6", "38.7")

def app(s):
    # Prüfung, ob eine rückwirkende Schnellpause passt (vor Arbeitsbeginn / Überschneidung)
    s = once(s, '''function quickPauseButtonMarkup(min,attr="data-live-quick-pause"){''', '''function retroPauseCheck(rec,min){
  const endMin=minutesFromTime(nowTime());
  const startMin=endMin-min;
  const workStart=minutesFromTime(rec.start);
  if(startMin<0) return {ok:false,why:"vor Mitternacht"};
  if(workStart!=null&&startMin<workStart) return {ok:false,why:"vor Beginn"};
  const clash=(rec.pauses||[]).some(p=>{
    if(!p.start||!p.end) return false;
    const a=minutesFromTime(p.start),b=minutesFromTime(p.end);
    return a!=null&&b!=null&&rangesOverlap(startMin,endMin,a,b);
  });
  if(clash) return {ok:false,why:"überschneidet"};
  return {ok:true,start:timeFromMinutes(startMin),end:timeFromMinutes(endMin)};
}
function quickPauseButtonMarkup(min,attr="data-live-quick-pause"){''')
    # Dialog: Beschriftung und Chips mit Zeitspanne
    s = once(s, '''  $("pauseQuickLabel").textContent=`Oder feste Dauer – startet jetzt (${now}), endet automatisch:`;
  if(ap){
    grid.innerHTML="";
  }else if(presets.length){
    grid.innerHTML=presets.map(min=>quickPauseButtonMarkup(min)).join("");''', '''  $("pauseQuickLabel").textContent=`Pause schon gemacht? Dauer antippen – wird bis jetzt (${now}) eingetragen:`;
  if(ap){
    grid.innerHTML="";
  }else if(presets.length){
    grid.innerHTML=presets.map(min=>{
      const ck=retroPauseCheck(rec,min);
      return `<button type="button" class="quick-pause-btn pz-retro" data-live-quick-pause="${min}"${ck.ok?"":" disabled"}>${min}<small> Min</small><em>${ck.ok?`${ck.start}–${ck.end}`:ck.why}</em></button>`;
    }).join("");''')
    # Buchen: rückwirkend, endet jetzt; mit Rückgängig
    a = s.index("function bookLiveQuickPause(min){")
    b = s.index("function toggleMonthSelection(){")
    s = s[:a] + '''function bookLiveQuickPause(min){
  min=Math.max(1,Number(min)||0);
  if(!min) return;
  const key=localDateKey(new Date());
  const rec=ensureRecord(key);
  if(activePause(rec,key)){
    toast("Laufende Pause zuerst beenden");
    return;
  }
  const ck=retroPauseCheck(rec,min);
  if(!ck.ok){
    notify(ck.why==="vor Beginn"?`${min} Min würden vor deinem Arbeitsbeginn (${rec.start}) anfangen.`:ck.why==="überschneidet"?`${min} Min würden sich mit einer bereits erfassten Pause überschneiden.`:"Eine Pause über Mitternacht wird nicht unterstützt.");
    return;
  }
  if(!rec.start) rec.start=ck.start;
  const p={start:ck.start,end:ck.end};
  rec.pauses.push(p);
  save();
  $("pauseDialog").close();
  render();
  toast(`${min} Min Pause eingetragen · ${ck.start}–${ck.end}`,{label:"Rückgängig",run:()=>{
    const r=state.records[key];
    const i=(r?.pauses||[]).findIndex(x=>x.start===p.start&&x.end===p.end);
    if(i>=0) r.pauses.splice(i,1);
    save();render();toast("Pause entfernt");
  }});
}


''' + s[b:]
    return s

CSS = '''
/* ── V38.7 Schnellpause rückwirkend ── */
.pz-chips .quick-pause-btn.pz-retro{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:60px}
.pz-retro em{font:600 11px/1 var(--font-num);font-style:normal;color:var(--muted);white-space:nowrap}
.pz-chips .quick-pause-btn.pz-retro:disabled{opacity:.45}
'''

def css(t):
    assert "V38.7" not in t
    return t + CSS

def sw(t):
    return once(t, 'const VERSION="v38.6";', 'const VERSION="v38.7";')

def readme(t):
    t = once(t, "# Klokify – Version 38.6", "# Klokify – Version 38.7")
    return once(t, "## V38.6 – Jahr", '''## V38.7 – Schnellpause rückwirkend

- **Schnellpausen im Pause-Dialog tragen jetzt eine bereits gemachte Pause ein:** sie endet jetzt und beginnt entsprechend früher (15 Min um 11:20 → 11:05–11:20). Vorher startete sie jetzt und endete automatisch.
- Jeder Knopf zeigt die Zeitspanne, die eingetragen wird. Passt sie nicht (vor Arbeitsbeginn, Überschneidung mit einer Pause), ist der Knopf ausgegraut mit kurzem Grund.
- Nach dem Eintragen: Hinweis mit „Rückgängig“.
- Alte Einträge mit automatisch endender Pause werden weiter richtig angezeigt.

## V38.6 – Jahr''')

edit(f"{d}/index.html", html)
edit(f"{d}/app.js", app)
edit(f"{d}/styles.css", css)
edit(f"{d}/sw.js", sw)
edit(f"{d}/README.md", readme)
print("v38.7 ok")
