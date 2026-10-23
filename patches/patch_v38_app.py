import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()

def once(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80])
    s = s.replace(a, b)

# ── A) neue Standardwerte ──
once('''  autoHolidaysBW:true,
  demoSeed:false,''', '''  autoHolidaysBW:true,
  stateCode:"BW",
  regionalHolidays:false,
  vacationCarryover:0,
  demoSeed:false,''')

# ── B) Feiertage für alle 16 Bundesländer ──
a = s.index('function bwHolidayName(key){')
b = s.index('function holidaysForYear(year){')
s = s[:a] + r'''/* V38: Gesetzliche Feiertage für alle 16 Bundesländer.
   Funktionsname bleibt bwHolidayName, damit alle bisherigen Aufrufer unverändert funktionieren.
   Regionale Feiertage (nur Teile eines Landes) zählen nur, wenn in den Einstellungen eingeschaltet. */
const STATE_NAMES={BW:"Baden-Württemberg",BY:"Bayern",BE:"Berlin",BB:"Brandenburg",HB:"Bremen",HH:"Hamburg",HE:"Hessen",MV:"Mecklenburg-Vorpommern",NI:"Niedersachsen",NW:"Nordrhein-Westfalen",RP:"Rheinland-Pfalz",SL:"Saarland",SN:"Sachsen",ST:"Sachsen-Anhalt",SH:"Schleswig-Holstein",TH:"Thüringen"};
const REGIONAL_HOLIDAYS={
  BY:"Mariä Himmelfahrt (15.08., Gemeinden mit überwiegend katholischer Bevölkerung) und Augsburger Friedensfest (08.08., nur Stadt Augsburg)",
  SN:"Fronleichnam (nur in einzelnen Gemeinden)",
  TH:"Fronleichnam (nur in Gemeinden mit überwiegend katholischer Bevölkerung)"
};
function currentStateCode(){return STATE_NAMES[state.settings.stateCode]?state.settings.stateCode:"BW";}
function bwHolidayName(key){
  if(!state.settings.autoHolidaysBW) return null;
  const year=dateFromKey(key).getFullYear();
  const st=currentStateCode(),reg=!!state.settings.regionalHolidays;
  const ck=`${st}|${reg?1:0}|${year}`;
  if(!holidayCache[ck]){
    const names={};
    const fix=(m,d)=>`${year}-${pad(m)}-${pad(d)}`;
    const is=(...codes)=>codes.includes(st);

    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
    const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
    const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
    const em=Math.floor((h+l-7*m+114)/31),ed=((h+l-7*m+114)%31)+1;
    const easter=new Date(year,em-1,ed);
    const offsetKey=days=>{const x=new Date(easter);x.setDate(x.getDate()+days);return localDateKey(x);};

    // bundesweit
    names[fix(1,1)]="Neujahr";
    names[offsetKey(-2)]="Karfreitag";
    names[offsetKey(1)]="Ostermontag";
    names[fix(5,1)]="Tag der Arbeit";
    names[offsetKey(39)]="Christi Himmelfahrt";
    names[offsetKey(50)]="Pfingstmontag";
    names[fix(10,3)]="Tag der Deutschen Einheit";
    names[fix(12,25)]="1. Weihnachtsfeiertag";
    names[fix(12,26)]="2. Weihnachtsfeiertag";
    // je Bundesland
    if(is("BW","BY","ST")) names[fix(1,6)]="Heilige Drei Könige";
    if((st==="BE"&&year>=2019)||(st==="MV"&&year>=2023)) names[fix(3,8)]="Internationaler Frauentag";
    if(st==="BE"&&(year===2020||year===2025)) names[fix(5,8)]="Tag der Befreiung";
    if(st==="BB"){names[offsetKey(0)]="Ostersonntag";names[offsetKey(49)]="Pfingstsonntag";}
    if(is("BW","BY","HE","NW","RP","SL")||(reg&&is("SN","TH"))) names[offsetKey(60)]="Fronleichnam";
    if(st==="BY"&&reg) names[fix(8,8)]="Augsburger Friedensfest";
    if(st==="SL"||(st==="BY"&&reg)) names[fix(8,15)]="Mariä Himmelfahrt";
    if(st==="TH"&&year>=2019) names[fix(9,20)]="Weltkindertag";
    if(year===2017||is("BB","MV","SN","ST","TH")||(is("HB","HH","NI","SH")&&year>=2018)) names[fix(10,31)]="Reformationstag";
    if(is("BW","BY","NW","RP","SL")) names[fix(11,1)]="Allerheiligen";
    if(st==="SN"){const x=new Date(year,10,22);while(x.getDay()!==3)x.setDate(x.getDate()-1);names[localDateKey(x)]="Buß- und Bettag";}
    holidayCache[ck]=names;
  }
  return holidayCache[ck][key]||null;
}

''' + s[b:]

# ── C) Beschriftung Bundesland statt fest BW ──
once('<small>Brückentage · BW</small>', '<small>Brückentage · ${currentStateCode()}</small>')

# ── D) Urlaubsanspruch inkl. Resturlaub Vorjahr ──
old = 'const ent=Number(state.settings.vacationEntitlement)||0;'
assert s.count(old) == 3, s.count(old)
s = s.replace(old, 'const ent=vacationEntitlementTotal();')


# ── E) Feierabendmotiv als Option im Tagesbereich ──
once('''  return `${openPastDayHTML()}<section class="h-hero" aria-label="Tag">
    <div class="h-hero-head">''', '''  const motif=state.settings.homeWidgets?.image===true?`<div class="h-motif${rec.end?" done":""}">${idyllicSceneHTML(!!rec.end)}</div>`:"";
  return `${openPastDayHTML()}<section class="h-hero" aria-label="Tag">
    ${motif}
    <div class="h-hero-head">''')

# ── F) Einstellungen: Aufbau + sofort speichern ──
a = s.index('function settingsWorkSummary(){')
b = s.index('function homeOpt(id){')
s = s[:a] + r'''function settingsWorkSummary(){
  const vals=(state.settings.weekdayTargets||[]).map(Number);
  const days=vals.filter(v=>v>0).length;
  const sum=vals.reduce((a,v)=>a+v,0);
  if(!days) return "keine Sollzeit";
  return `${String(Math.round(sum*100)/100).replace(".",",")} h/Woche · ${days} Tage`;
}
function settingsPauseSummary(){
  const p=Math.max(0,Number(state.settings.plannedPauseMin)||0);
  const quick=(state.settings.quickPausePresets||[]).filter(v=>Number(v)>0).length;
  return `${p} Min geplant · ${quick} Schnellpausen`;
}
function vacationEntitlementTotal(){
  return (Number(state.settings.vacationEntitlement)||0)+(Number(state.settings.vacationCarryover)||0);
}
function settingsCalendarSummary(){
  const ent=vacationEntitlementTotal();
  return `${currentStateCode()} · ${String(ent).replace(".",",")} Tage Urlaub · Feiertage ${state.settings.autoHolidaysBW?"an":"aus"}`;
}
''' + s[b:]

a = s.index('function settingsHomeSummary(){')
b = s.index('$("headerDate").addEventListener("click",()=>{')
s = s[:a] + r'''function settingsHomeSummary(){
  const on=[["konto","Konto"],["vacation","Urlaub"],["bridge","Tipps"]].filter(([k])=>homeOpt(k)).map(([,l])=>l);
  if(state.settings.homeWidgets?.image===true) on.push("Motiv");
  return on.length?on.join(" · "):"nur Kern";
}
function settingsDataSummary(){
  const lb=state.settings.lastBackup;
  return lb?`Letztes Backup ${dateShortDE(lb)}`:"Noch kein Backup";
}
function updateSettingsSummaries(){
  if($("settingsSummaryWork")) $("settingsSummaryWork").textContent=settingsWorkSummary();
  if($("settingsSummaryPause")) $("settingsSummaryPause").textContent=settingsPauseSummary();
  if($("settingsSummaryCalendar")) $("settingsSummaryCalendar").textContent=settingsCalendarSummary();
  if($("settingsSummaryHome")) $("settingsSummaryHome").textContent=settingsHomeSummary();
  if($("settingsSummaryData")) $("settingsSummaryData").textContent=settingsDataSummary();
}
const WD_NAMES=["Mo","Di","Mi","Do","Fr","Sa","So"];
function fmtDecH(h){return String(Math.round(h*100)/100).replace(".",",");}
function weekSum(){return (state.settings.weekdayTargets||[]).reduce((a,v)=>a+(Number(v)||0),0);}
function renderWorkFields(){
  const t=state.settings.weekdayTargets;
  const days=t.map((v,i)=>Number(v)>0?i:-1).filter(i=>i>=0);
  const sum=weekSum();
  if(document.activeElement!==$("sWeekHours")) $("sWeekHours").value=fmtDecH(sum);
  const uniq=[...new Set(days.map(i=>Number(t[i])))];
  $("sPerDay").innerHTML=days.length?(uniq.length===1?`= <b>${hDur(uniq[0]*60)} h</b> je Tag`:`<b>unterschiedlich</b> je Tag`):"keine Arbeitstage";
  $("sWorkdays").innerHTML=WD_NAMES.map((n,i)=>`<button type="button" class="s-day" data-s-day="${i}" aria-pressed="${Number(t[i])>0}">${n}</button>`).join("");
  $("weekdayTargets").innerHTML=WD_NAMES.map((n,i)=>`<label>${n}<input type="text" inputmode="decimal" data-s-target="${i}" value="${fmtDecH(Number(t[i])||0)}"></label>`).join("");
  const st=state.settings.weekdayStartTimes;
  const firstStart=days.map(i=>st[i]).find(Boolean)||"06:35";
  if(document.activeElement!==$("sStartAll")) $("sStartAll").value=firstStart;
  $("weekdayStarts").innerHTML=days.map(i=>`<label>${WD_NAMES[i]}<input type="time" data-s-start="${i}" value="${st[i]||firstStart}"></label>`).join("")||`<p class="settings-help">Erst Arbeitstage wählen.</p>`;
}
function renderHolidayFields(){
  const st=currentStateCode();
  $("sState").value=st;
  $("autoHolidaysBW").checked=!!state.settings.autoHolidaysBW;
  const regInfo=REGIONAL_HOLIDAYS[st];
  $("sRegionalWrap").hidden=!regInfo||!state.settings.autoHolidaysBW;
  $("sRegional").checked=!!state.settings.regionalHolidays;
  const y=new Date().getFullYear();
  const n=state.settings.autoHolidaysBW?holidaysForYear(y).filter(h=>![0,6].includes(h.date.getDay())).length:0;
  $("sHolidayHint").innerHTML=state.settings.autoHolidaysBW
    ?`${STATE_NAMES[st]}: <b>${n}</b> Feiertage ${y} an Werktagen.${regInfo?` <br>Regional: ${escapeHtml(regInfo)}.`:""}`
    :"Feiertage werden nicht automatisch eingetragen.";
}
function buildSettings(){
  renderWorkFields();
  $("quickPauseSettings").innerHTML=Array.from({length:4},(_,i)=>`<input type="number" min="0" max="180" step="5" data-s-quick="${i}" value="${state.settings.quickPausePresets?.[i]??0}" aria-label="Schnellpause ${i+1}">`).join("");
  $("kontoStartInput").value=state.settings.kontoStartMin?hSigned(state.settings.kontoStartMin):"";
  $("kontoStartDate").value=state.settings.kontoStartDate||"";
  $("plannedPauseInput").value=state.settings.plannedPauseMin;
  $("vacationEntitlementInput").value=state.settings.vacationEntitlement;
  $("sVacCarry").value=state.settings.vacationCarryover||0;
  $("breakReminder").checked=!!state.settings.breakReminder;
  $("pixelMeterToggle").checked=state.settings.pixelMeter!==false;
  renderHolidayFields();
  $("homeKontoToggle").checked=homeOpt("konto");
  $("homeVacationToggle").checked=homeOpt("vacation");
  $("homeBridgeToggle").checked=homeOpt("bridge");
  $("homeImageToggle").checked=state.settings.homeWidgets?.image===true;
  const hidden=(state.settings.dismissedBridgeTips||[]).length;
  $("resetBridgeTipsBtn").hidden=!hidden;
  $("resetBridgeTipsBtn").textContent=`${hidden} ausgeblendete${hidden===1?"n Tipp":" Tipps"} wieder zeigen`;
  $("sBackupHint").textContent=state.settings.lastBackup?`Letztes Backup: ${dateShortDE(state.settings.lastBackup)}`:"Noch kein Backup erstellt – am besten einmal im Monat sichern.";
  updateSettingsSummaries();
}
let settingsToastTimer=null;
function settingsSaved(){
  save();render();updateSettingsSummaries();
  clearTimeout(settingsToastTimer);
  settingsToastTimer=setTimeout(()=>toast("Gespeichert"),250);
}
function setWeekFromHours(total,days){
  const t=[0,0,0,0,0,0,0];
  if(days.length){const per=Math.round(total/days.length*100)/100;days.forEach(i=>t[i]=per);}
  state.settings.weekdayTargets=t;
  const st=state.settings.weekdayStartTimes||[];
  const first=st.find(Boolean)||"06:35";
  state.settings.weekdayStartTimes=WD_NAMES.map((_,i)=>t[i]>0?(st[i]||first):"");
}
function numDE(v){const n=Number(String(v).replace(",","."));return Number.isFinite(n)?n:null;}
function onSettingsChange(e){
  const el=e.target;const S=state.settings;
  if(el.id==="sWeekHours"){
    const h=numDE(el.value);
    if(h===null||h<0||h>80){toast("Wochenstunden z. B. 40 oder 38,5");renderWorkFields();return;}
    const days=S.weekdayTargets.map((v,i)=>Number(v)>0?i:-1).filter(i=>i>=0);
    setWeekFromHours(h,days.length?days:[0,1,2,3,4]);
    renderWorkFields();return settingsSaved();
  }
  if(el.dataset.sTarget!==undefined){
    const h=numDE(el.value);
    if(h===null||h<0||h>16){toast("Tageswert 0 bis 16 h");renderWorkFields();return;}
    S.weekdayTargets[Number(el.dataset.sTarget)]=h;
    const i=Number(el.dataset.sTarget);
    if(h>0&&!S.weekdayStartTimes[i]) S.weekdayStartTimes[i]=S.weekdayStartTimes.find(Boolean)||"06:35";
    renderWorkFields();return settingsSaved();
  }
  if(el.id==="sStartAll"){
    if(!el.value) return;
    S.weekdayStartTimes=WD_NAMES.map((_,i)=>Number(S.weekdayTargets[i])>0?el.value:"");
    renderWorkFields();return settingsSaved();
  }
  if(el.dataset.sStart!==undefined){S.weekdayStartTimes[Number(el.dataset.sStart)]=el.value||"06:35";return settingsSaved();}
  if(el.id==="kontoStartInput"){
    const ks=parseSignedDuration(el.value);
    if(ks===null){toast("Übertrag nicht lesbar – z. B. 23:07 oder -2:30");return;}
    S.kontoStartMin=ks;return settingsSaved();
  }
  if(el.id==="kontoStartDate"){S.kontoStartDate=el.value||"";return settingsSaved();}
  if(el.id==="plannedPauseInput"){S.plannedPauseMin=Math.max(0,Math.min(180,Number(el.value)||0));return settingsSaved();}
  if(el.dataset.sQuick!==undefined){
    const q=[...(S.quickPausePresets||[0,0,0,0])];q[Number(el.dataset.sQuick)]=Math.max(0,Math.min(180,Number(el.value)||0));
    S.quickPausePresets=q;return settingsSaved();
  }
  if(el.id==="breakReminder"){S.breakReminder=el.checked;return settingsSaved();}
  if(el.id==="sState"||el.id==="autoHolidaysBW"||el.id==="sRegional"){
    S.stateCode=$("sState").value;S.autoHolidaysBW=$("autoHolidaysBW").checked;S.regionalHolidays=$("sRegional").checked;
    Object.keys(holidayCache).forEach(k=>delete holidayCache[k]);
    renderHolidayFields();return settingsSaved();
  }
  if(el.id==="vacationEntitlementInput"){S.vacationEntitlement=Math.max(0,numDE(el.value)||0);return settingsSaved();}
  if(el.id==="sVacCarry"){S.vacationCarryover=Math.max(0,numDE(el.value)||0);return settingsSaved();}
  if(["homeKontoToggle","homeVacationToggle","homeBridgeToggle"].includes(el.id)){
    S.home={konto:$("homeKontoToggle").checked,vacation:$("homeVacationToggle").checked,bridge:$("homeBridgeToggle").checked};
    return settingsSaved();
  }
  if(el.id==="homeImageToggle"){S.homeWidgets={...(S.homeWidgets||{}),image:el.checked};return settingsSaved();}
  if(el.id==="pixelMeterToggle"){S.pixelMeter=el.checked;updatePixelMeter();return settingsSaved();}
}
$("settingsDialog").addEventListener("change",e=>{if(e.target.id!=="importInput") onSettingsChange(e);});
$("settingsDialog").addEventListener("click",e=>{
  const b=e.target.closest("[data-s-day]");
  if(!b) return;
  const S=state.settings,i=Number(b.dataset.sDay);
  const days=S.weekdayTargets.map((v,j)=>Number(v)>0?j:-1).filter(j=>j>=0);
  const next=days.includes(i)?days.filter(j=>j!==i):[...days,i].sort((a,c)=>a-c);
  setWeekFromHours(weekSum()||40,next);
  renderWorkFields();settingsSaved();
});
''' + s[b:]

# alter Speichern-Knopf entfällt
a = s.index('$("saveSettingsBtn").addEventListener("click",()=>{')
b = s.index('toast("Einstellungen gespeichert")});', a) + len('toast("Einstellungen gespeichert")});')
s = s[:a] + s[b:]

# Backup-Datum merken
once('''  downloadBlob(`arbeitszeit-backup-${localDateKey(new Date())}.json`,JSON.stringify(state,null,2),"application/json");
  toast("JSON exportiert");''', '''  state.settings.lastBackup=localDateKey(new Date());save();
  downloadBlob(`arbeitszeit-backup-${localDateKey(new Date())}.json`,JSON.stringify(state,null,2),"application/json");
  if($("sBackupHint")) $("sBackupHint").textContent=`Letztes Backup: ${dateShortDE(state.settings.lastBackup)}`;
  updateSettingsSummaries();
  toast("Backup gespeichert");''')

# Kopfkommentar Version
once('/* ── V37 Homescreen ── */', '/* ── V37 Homescreen (V38: Feierabendmotiv optional) ── */')

once('<svg class="idyllic-scene" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">','<svg class="idyllic-scene" viewBox="0 0 140 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">')
open(p, "w", encoding="utf-8").write(s)
print("app ok")
