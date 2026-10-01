
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,"0");
const clamp = (n,min,max)=>Math.min(max,Math.max(min,n));

const STATUS = {
  work:{label:"Arbeit",icon:"●",class:"work"},
  vacation:{label:"Urlaub",icon:"🏖",class:"vacation"},
  specialLeave:{label:"Sonderurlaub",icon:"🌴",class:"specialLeave"},
  sick:{label:"Krank",icon:"✚",class:"sick"},
  holiday:{label:"Feiertag",icon:"◆",class:"holiday"},
  flex:{label:"FZA",icon:"↻",class:"flex"},
  off:{label:"Frei",icon:"○",class:"off"}
};

const defaultSettings = {
  weekdayTargets:[8,8,8,8,8,0,0],
  weekdayStartTimes:["06:35","06:35","06:35","06:35","06:35","",""],
  quickPausePresets:[15,20,30,45],
  plannedPauseMin:30,
  vacationEntitlement:30,
  breakReminder:true,
  autoHolidaysBW:true,
  demoSeed:false,
  homeLayoutVersion:4,
  pixelMeter:true,
  homeWidgets:{
    image:false,
    saldo:true,
    friday:true,
    timeline:true,
    statuses:false,
    week:false,
    note:false
  },
  homeOrder:["saldo","friday","statuses","week","note"]
};

function freshDefaultSettings(){
  return {
    ...defaultSettings,
    weekdayTargets:[...defaultSettings.weekdayTargets],
    weekdayStartTimes:[...defaultSettings.weekdayStartTimes],
    quickPausePresets:[...defaultSettings.quickPausePresets],
    homeWidgets:{...defaultSettings.homeWidgets},
    homeOrder:[...defaultSettings.homeOrder]
  };
}

function migrateState(){
  let v4 = null;
  try{ v4 = JSON.parse(localStorage.getItem("arbeitszeit-v4") || "null"); }catch{}
  if(v4) return v4;

  let old = null;
  try{ old = JSON.parse(localStorage.getItem("arbeitszeit-v3") || "null"); }catch{}
  if(!old) return {settings:freshDefaultSettings(),records:{},weekPlans:{}};

  old.settings = {...freshDefaultSettings(),...(old.settings||{})};
  for(const [key,r] of Object.entries(old.records||{})){
    if(!Array.isArray(r.pauses)){
      r.pauses=[];
      if(r.breakStart){
        r.pauses.push({start:r.breakStart,end:r.breakEnd||""});
      }
    }
    if(r.status==="special") r.status="specialLeave";
  }
  return old;
}

let state = migrateState();
let demo = null; // V37 Demo-Modus: {scen, nowMin}
state.settings = {...freshDefaultSettings(),...(state.settings||{})};
delete state.settings.durationFormat;
state.settings.quickPausePresets=Array.isArray(state.settings.quickPausePresets)
  ? state.settings.quickPausePresets.slice(0,4).map(v=>Math.max(0,Number(v)||0))
  : [...defaultSettings.quickPausePresets];
while(state.settings.quickPausePresets.length<4) state.settings.quickPausePresets.push(0);
state.settings.homeWidgets={...defaultSettings.homeWidgets,...(state.settings.homeWidgets||{})};
delete state.settings.homeWidgets.totalAccount;
if((Number(state.settings.homeLayoutVersion)||0)<3){
  state.settings.homeWidgets={
    ...state.settings.homeWidgets,
    image:true,
    saldo:true,
    friday:true,
    timeline:true,
    statuses:false,
    week:false,
    note:false
  };
  state.settings.homeOrder=["saldo","friday","timeline","statuses","week","note"];
  state.settings.homeLayoutVersion=3;
}
const FIXED_HOME_ORDER=["saldo","friday","statuses","week","note"];
// V30: Tageslogik ist Kernbestandteil und nicht mehr frei verschieb-/abschaltbar.
state.settings.homeWidgets.timeline=true;
state.settings.homeOrder=[...FIXED_HOME_ORDER];
state.settings.homeLayoutVersion=4;
state.records = state.records || {};
// V36: Feierabendmotiv ist standardmäßig aus (einmalig auch für Bestandsnutzer).
if(state.settings.v36ImageOff!==true){
  state.settings.homeWidgets.image=false;
  state.settings.v36ImageOff=true;
}
state.weekPlans = state.weekPlans && typeof state.weekPlans==="object" ? state.weekPlans : {};

let currentView = "day";
let selectedDate = localDateKey(new Date());
let monthCursor = new Date(new Date().getFullYear(),new Date().getMonth(),1);
let weekOffset = 0;
let yearCursor = new Date().getFullYear();
let editDateKey = selectedDate;
let editPauses = [];
let editOrigin = null;
let bulkType = "vacation";
let saldoScope = localStorage.getItem("arbeitszeit-saldo-scope") || "week";
let monthSelectMode=false;
let monthSelectedDates=new Set();
let plannerWeekKey=null;
let plannerFridayPauseTouched=false;


function localDateKey(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function dateFromKey(key){
  const [y,m,d]=key.split("-").map(Number);
  return new Date(y,m-1,d);
}
function save(){
  // Im Demo-Modus wird nie gespeichert – echte Daten bleiben unberührt.
  if(demo) return true;
  try{
    localStorage.setItem("arbeitszeit-v4",JSON.stringify(state));
    return true;
  }catch(error){
    console.error("Speichern fehlgeschlagen",error);
    toast("Speichern fehlgeschlagen – bitte Backup exportieren");
    return false;
  }
}
/* V36: gesetzliche Pausen und Höchstarbeitszeit (§§ 3, 4 ArbZG) */
function legalPauseFor(workMin){
  if(workMin>540) return 45;
  if(workMin>360) return 30;
  return 0;
}
const MAX_WORK_MIN=600;
function minutesFromTime(t){
  if(!t) return null;
  const [h,m]=t.split(":").map(Number);
  return h*60+m;
}
function timeFromMinutes(min){
  min=((Math.round(min)%1440)+1440)%1440;
  return `${pad(Math.floor(min/60))}:${pad(min%60)}`;
}
function nowTime(){
  if(demo) return timeFromMinutes(demo.nowMin);
  const d=new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatHours(min){
  min=Math.round(min||0);
  const sign=min<0?"−":"";
  min=Math.abs(min);
  return `${sign}${Math.floor(min/60)}:${pad(min%60)} h`;
}
function formatCompact(min){
  min=Math.round(Math.max(0,min||0));
  if(min<60) return `${min} Min`;
  return `${Math.floor(min/60)}:${pad(min%60)} h`;
}
function formatSignedHours(min){
  min=Math.round(min||0);
  const sign=min>0?"+":min<0?"−":"";
  min=Math.abs(min);
  return `${sign}${Math.floor(min/60)}:${pad(min%60)} h`;
}
function weekdayName(d,short=true){
  return (short?["So","Mo","Di","Mi","Do","Fr","Sa"]:["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"])[d.getDay()];
}
function monthName(m){
  return ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][m];
}
function dayIndexMon0(d){ return (d.getDay()+6)%7; }

function isoWeekNumber(d){
  const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum=date.getUTCDay()||7;
  date.setUTCDate(date.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date-yearStart)/86400000)+1)/7);
}

/* Feiertage Baden-Württemberg */
const holidayCache = {};
function bwHolidayName(key){
  if(!state.settings.autoHolidaysBW) return null;
  const year=dateFromKey(key).getFullYear();
  if(!holidayCache[year]){
    const names={};
    const fix=(m,d)=>`${year}-${pad(m)}-${pad(d)}`;

    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
    const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
    const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
    const em=Math.floor((h+l-7*m+114)/31),ed=((h+l-7*m+114)%31)+1;
    const easter=new Date(year,em-1,ed);
    const offsetKey=days=>{
      const x=new Date(easter); x.setDate(x.getDate()+days); return localDateKey(x);
    };

    names[fix(1,1)]="Neujahr";
    names[fix(1,6)]="Heilige Drei Könige";
    names[offsetKey(-2)]="Karfreitag";
    names[offsetKey(1)]="Ostermontag";
    names[fix(5,1)]="Tag der Arbeit";
    names[offsetKey(39)]="Christi Himmelfahrt";
    names[offsetKey(50)]="Pfingstmontag";
    names[offsetKey(60)]="Fronleichnam";
    names[fix(10,3)]="Tag der Deutschen Einheit";
    names[fix(11,1)]="Allerheiligen";
    names[fix(12,25)]="1. Weihnachtsfeiertag";
    names[fix(12,26)]="2. Weihnachtsfeiertag";
    holidayCache[year]=names;
  }
  return holidayCache[year][key]||null;
}


function holidaysForYear(year){
  const rows=[];
  const d=new Date(year,0,1), end=new Date(year,11,31);
  while(d<=end){
    const key=localDateKey(d);
    const name=bwHolidayName(key);
    if(name) rows.push({key,name,date:new Date(d)});
    d.setDate(d.getDate()+1);
  }
  return rows;
}
function holidaysForMonth(year,month){
  return holidaysForYear(year).filter(h=>h.date.getMonth()===month);
}
function dateShortDE(key){
  const d=dateFromKey(key);
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.`;
}

function normalizeRecord(r){
  if(!r) return r;
  if(r.manualWorkedMinutes!==undefined){
    const manual=Number(r.manualWorkedMinutes);
    if(Number.isFinite(manual) && manual>=0) r.manualWorkedMinutes=Math.round(manual);
    else delete r.manualWorkedMinutes;
  }
  if(!Array.isArray(r.pauses)){
    r.pauses=[];
    if(r.breakStart) r.pauses.push({start:r.breakStart,end:r.breakEnd||""});
  }
  r.pauses=r.pauses.map(p=>{
    const fixed=Math.max(0,Number(p.minutes)||0);
    if(fixed>0 && !p.start) return {start:"",end:"",minutes:fixed};
    const timed={start:p.start||"",end:p.end??p.ende??""};
    if(p.autoEnd) timed.autoEnd=true;
    return timed;
  });
  if(typeof r.note!=="string") r.note="";
  return r;
}
Object.values(state.records).forEach(normalizeRecord);

function targetForDate(key){
  const rec=state.records[key];
  if(rec && typeof rec.targetHours==="number") return rec.targetHours*60;
  return (state.settings.weekdayTargets[dayIndexMon0(dateFromKey(key))]||0)*60;
}
function effectiveStatus(key){
  const rec=state.records[key];
  if(rec?.status) return rec.status;
  if(bwHolidayName(key)) return "holiday";
  return "empty";
}
function ensureRecord(key){
  if(!state.records[key]){
    state.records[key]={
      status:"work",start:"",end:"",pauses:[],
      targetHours:targetForDate(key)/60,note:""
    };
  }
  return normalizeRecord(state.records[key]);
}
function autoPauseRunning(p,key=localDateKey(new Date())){
  if(!p?.autoEnd || !p.start || !p.end || key!==localDateKey(new Date())) return false;
  const now=minutesFromTime(nowTime());
  const start=minutesFromTime(p.start);
  const end=minutesFromTime(p.end);
  return now!==null && start!==null && end!==null && now>=start && now<end;
}
function activePause(rec,key=localDateKey(new Date())){
  return (rec?.pauses||[]).find(p=>p.start&&!p.end || autoPauseRunning(p,key))||null;
}
function pauseMinutes(rec,live=false,key=null,includeFuture=false){
  if(!rec) return 0;

  const isToday=key===localDateKey(new Date());
  const now=minutesFromTime(nowTime());
  let fixedTotal=0;
  const timed=[];

  for(const p of (rec.pauses||[])){
    const fixed=Math.max(0,Number(p.minutes)||0);
    if(fixed>0 && !p.start){
      fixedTotal+=fixed;
      continue;
    }

    const a=minutesFromTime(p.start);
    if(a===null) continue;

    let b=minutesFromTime(p.end);
    if(b===null && live && isToday) b=now;
    if(b!==null && live && isToday && !includeFuture && now!==null) b=Math.min(b,now);
    if(b===null || b<=a) continue;

    timed.push([a,b]);
  }

  timed.sort((x,y)=>x[0]-y[0]);
  let timedTotal=0;
  let current=null;

  for(const [a,b] of timed){
    if(!current){
      current=[a,b];
      continue;
    }
    if(a<=current[1]){
      current[1]=Math.max(current[1],b);
    }else{
      timedTotal+=current[1]-current[0];
      current=[a,b];
    }
  }
  if(current) timedTotal+=current[1]-current[0];

  return Math.max(0,Math.round(fixedTotal+timedTotal));
}
function isManualWorkRecord(rec){
  return !!rec && rec.status==="work" && Number.isFinite(Number(rec.manualWorkedMinutes)) && Number(rec.manualWorkedMinutes)>=0;
}
function parseWorkDurationInput(raw){
  const original=String(raw||"").trim();
  if(!original) return null;
  let s=original.toLowerCase().replace(/\s+/g,"").replace(",",".");
  let minutes=null;

  const colon=s.match(/^(\d{1,2}):([0-5]\d)$/);
  if(colon) minutes=Number(colon[1])*60+Number(colon[2]);
  else if(/^\d+(?:\.\d+)?h$/.test(s)) minutes=Math.round(Number(s.slice(0,-1))*60);
  else if(/^\d+(?:\.\d+)?(?:min|m)$/.test(s)) minutes=Math.round(Number(s.replace(/(?:min|m)$/,"")));
  else if(/^\d+(?:\.\d+)?$/.test(s)) minutes=Math.round(Number(s)*60);

  if(!Number.isFinite(minutes) || minutes<0 || minutes>1440) return {error:true,original};
  return {minutes,original};
}
function workDurationInputValue(rec){
  if(!isManualWorkRecord(rec)) return "";
  const min=Math.round(Number(rec.manualWorkedMinutes)||0);
  return `${Math.floor(min/60)}:${pad(min%60)}`;
}
function recordCalc(key,live=false){
  const rec=state.records[key];
  const target=targetForDate(key);
  const status=effectiveStatus(key);

  if(status==="off"){
    return {worked:0,target:0,balance:0,status,breakMin:0,plannedEnd:null,remaining:0};
  }
  if(status!=="work" && status!=="empty"){
    const credit=["vacation","specialLeave","sick","holiday","flex"].includes(status)?target:0;
    return {worked:credit,target,balance:credit-target,status,breakMin:0,plannedEnd:null,remaining:0};
  }

  if(!rec){
    return {worked:0,target,balance:0,status:"empty",breakMin:0,plannedEnd:null,remaining:target};
  }

  if(isManualWorkRecord(rec)){
    const worked=Math.max(0,Math.round(Number(rec.manualWorkedMinutes)||0));
    return {
      worked,target,balance:worked-target,status:"work",breakMin:0,
      plannedEnd:null,remaining:Math.max(0,target-worked),manual:true
    };
  }

  const start=minutesFromTime(rec.start);
  if(start===null){
    return {worked:0,target,balance:0,status:"work",breakMin:0,plannedEnd:null,remaining:target};
  }

  let end=minutesFromTime(rec.end);
  if(end===null && live && key===localDateKey(new Date())) end=minutesFromTime(nowTime());
  if(end===null) end=start;

  // Für die bereits geleistete Arbeitszeit zählt von einer vorausgebuchten
  // Schnellpause nur der Teil, der zeitlich wirklich schon vergangen ist.
  const breakMin=pauseMinutes(rec,live,key,false);
  const projectedBreakMin=pauseMinutes(rec,live,key,true);
  const worked=Math.max(0,end-start-breakMin);

  const plannedPauseMin=Math.max(
    Math.max(0,Number(state.settings.plannedPauseMin)||0),
    legalPauseFor(target)
  );
  const hasActualPause=(rec.pauses||[]).some(p=>
    (p.start && (p.end || (live && key===localDateKey(new Date())))) ||
    (Number(p.minutes)>0 && !p.start)
  );

  // Vor der ersten echten Pause dient die geplante Pause nur als Prognose.
  const baselineEnd=start+target+plannedPauseMin;

  // Sobald eine Pause tatsächlich erfasst wurde, zählt ihre reale Dauer
  // minutengenau. Es gibt weder Mindestreserve noch 15-Minuten-Raster.
  // V37: Auch nach der ersten echten Pause rechnet die Prognose mindestens mit
  // der gesetzlichen Pause für das Tagessoll (§ 4 ArbZG). Eine 15-Min-Pause
  // zieht den Feierabend also nicht mehr künstlich nach vorne.
  const projectedPauseMin=hasActualPause ? Math.max(projectedBreakMin,legalPauseFor(target)) : plannedPauseMin;
  const plannedEnd=start+target+projectedPauseMin;

  // Spätestes Ende nach § 3 ArbZG: 10 h Arbeit + mindestens 45 Min Pause.
  const latestEnd=start+MAX_WORK_MIN+Math.max(45,projectedBreakMin);
  const legalPauseMin=legalPauseFor(Math.max(worked,target));

  return {
    worked,target,balance:worked-target,status:"work",breakMin,
    plannedPauseMin,projectedPauseMin,hasActualPause,
    baselineEnd,plannedEnd,latestEnd,legalPauseMin,
    remaining:Math.max(0,target-worked)
  };
}
function statusCountForYear(year,status){
  let count=0;
  for(let m=0;m<12;m++){
    const last=new Date(year,m+1,0).getDate();
    for(let d=1;d<=last;d++){
      const k=localDateKey(new Date(year,m,d));
      if(effectiveStatus(k)===status && ![0,6].includes(dateFromKey(k).getDay())) count++;
    }
  }
  return count;
}

function recordIsCreditedStatus(status){
  return ["vacation","specialLeave","sick","holiday","flex"].includes(status);
}
function dayBalanceForSummary(key,live=false){
  const status=effectiveStatus(key);
  const rec=state.records[key];

  if(status==="empty") return 0;
  if(recordIsCreditedStatus(status) || status==="off") return 0;

  if(status==="work"){
    if(!rec) return 0;

    // Abgeschlossene oder als Sammelbuchung erfasste Arbeitstage zählen vollständig.
    if(rec.end || isManualWorkRecord(rec)) return recordCalc(key,false).balance;

    // Der laufende heutige Tag erzeugt erst dann Saldo,
    // wenn das Soll erreicht wurde. Morgens kein künstliches Minus.
    if(live && key===localDateKey(new Date()) && rec.start){
      return Math.max(0,recordCalc(key,true).balance);
    }
  }
  return 0;
}
function dateRangeBalance(startDate,endDate,liveToday=true){
  const end=new Date(endDate);
  let d=new Date(startDate), total=0;
  while(d<=end){
    total+=dayBalanceForSummary(localDateKey(d),liveToday);
    d.setDate(d.getDate()+1);
  }
  return total;
}
function mondayOfDate(d){
  const x=new Date(d);
  x.setDate(x.getDate()-dayIndexMon0(x));
  x.setHours(0,0,0,0);
  return x;
}
function currentWeekBalance(){
  const now=new Date();
  return dateRangeBalance(mondayOfDate(now),now,true);
}
function currentMonthBalance(){
  const now=new Date();
  return dateRangeBalance(new Date(now.getFullYear(),now.getMonth(),1),now,true);
}
function currentYearBalance(){
  const now=new Date();
  return dateRangeBalance(new Date(now.getFullYear(),0,1),now,true);
}
function balanceForScope(scope){
  return scope==="month"?currentMonthBalance():scope==="year"?currentYearBalance():currentWeekBalance();
}
function saldoScopeLabel(scope){
  return scope==="month"?"Monat":scope==="year"?"Jahr":"Woche";
}
function nextSaldoScope(scope){
  return scope==="week"?"month":scope==="month"?"year":"week";
}
/* V36.1: Die in den Einstellungen festgelegte Beginnzeit ist maßgeblich.
   Früher wurde stattdessen der Beginn des letzten echten Wochentags genommen,
   dadurch blieben geänderte Einstellungen im Wochenplan wirkungslos. */
function plannedStartForWeekday(mon0){
  return state.settings.weekdayStartTimes?.[mon0] || "06:35";
}

function fridayForecastRelevant(){
  const now=new Date();
  const mon=mondayOfDate(now);
  const friday=new Date(mon);
  friday.setDate(mon.getDate()+4);
  const fridayStatus=effectiveStatus(localDateKey(friday));

  // Ist Freitag bereits als Abwesenheit/Feiertag/Frei gebucht,
  // ist eine Feierabend-Prognose nicht hilfreich.
  if(["vacation","specialLeave","sick","holiday","flex","off"].includes(fridayStatus)) return false;

  // Wenn Mo-Fr komplett mit Nicht-Arbeit belegt sind, ebenfalls ausblenden.
  let hasWorkPotential=false;
  for(let i=0;i<5;i++){
    const d=new Date(mon); d.setDate(mon.getDate()+i);
    const s=effectiveStatus(localDateKey(d));
    if(s==="work" || s==="empty"){
      hasWorkPotential=true;
      break;
    }
  }
  return hasWorkPotential;
}

function currentPlannerWeekKey(){
  return localDateKey(mondayOfDate(new Date()));
}
function normalizeWeekPlan(plan={}){
  return {
    fridayEnd:typeof plan.fridayEnd==="string"?plan.fridayEnd:"",
    fridayPauseMin:Math.max(0,Number(plan.fridayPauseMin)||0),
    distribution:plan.distribution==="frontload"?"frontload":"even",
    constraints:plan.constraints && typeof plan.constraints==="object" ? plan.constraints : {}
  };
}
function activeWeekPlan(){
  const key=currentPlannerWeekKey();
  const plan=state.weekPlans?.[key];
  return plan?.fridayEnd ? normalizeWeekPlan(plan) : null;
}
function plannerStartForKey(key){
  const rec=state.records[key];
  if(rec?.start) return rec.start;
  const idx=dayIndexMon0(dateFromKey(key));
  return plannedStartForWeekday(idx);
}
function plannerRecommendedPause(key,endTime){
  const start=minutesFromTime(plannerStartForKey(key));
  const end=minutesFromTime(endTime);
  if(start===null || end===null || end<=start) return 0;
  const attendance=end-start;
  return attendance<=360 ? 0 : Math.max(0,Number(state.settings.plannedPauseMin)||0);
}
function plannerConstraintWork(key,spec,currentWorked=0){
  const startText=plannerStartForKey(key);
  const start=minutesFromTime(startText);
  const end=minutesFromTime(spec?.end);
  const pause=Math.max(0,Number(spec?.pauseMin)||0);
  if(start===null || end===null || end<=start){
    return {work:Math.max(0,currentWorked),start:startText,end:spec?.end||"",pause,invalid:true};
  }
  const planned=Math.max(0,end-start-pause);
  return {work:Math.max(currentWorked,planned),start:startText,end:spec.end,pause,invalid:false};
}
function plannerPauseForFlexible(key,plannedWork){
  const rec=state.records[key];
  const real=rec ? pauseMinutes(rec,true,key) : 0;
  if(plannedWork<=360) return real;
  return Math.max(real,Number(state.settings.plannedPauseMin)||0);
}
function allocatePlannerWork(flexible,totalNeed,mode){
  const result=flexible.map(item=>({...item,plannedWork:Math.max(item.minWork,item.target)}));
  if(!result.length) return result;
  let current=result.reduce((s,x)=>s+x.plannedWork,0);
  let diff=Math.round(totalNeed-current);
  if(diff>0){
    if(mode==="frontload") result[0].plannedWork+=diff;
    else{
      const each=Math.floor(diff/result.length);
      let rest=diff-each*result.length;
      result.forEach(x=>{x.plannedWork+=each+(rest>0?1:0);if(rest>0)rest--;});
    }
  }else if(diff<0){
    let reduce=-diff;
    if(mode==="frontload"){
      for(let i=result.length-1;i>=0 && reduce>0;i--){
        const can=Math.max(0,result[i].plannedWork-result[i].minWork);
        const take=Math.min(can,reduce);
        result[i].plannedWork-=take;reduce-=take;
      }
    }else{
      let guard=0;
      while(reduce>0 && guard<100){
        const candidates=result.filter(x=>x.plannedWork>x.minWork);
        if(!candidates.length) break;
        const each=Math.max(1,Math.floor(reduce/candidates.length));
        let moved=0;
        for(const x of candidates){
          const can=x.plannedWork-x.minWork;
          const take=Math.min(can,each,reduce);
          x.plannedWork-=take;reduce-=take;moved+=take;
          if(reduce<=0) break;
        }
        if(!moved) break;
        guard++;
      }
    }
  }
  return result;
}
function calculateWeekPlan(rawPlan){
  const plan=normalizeWeekPlan(rawPlan);
  const now=new Date();
  const todayKey=localDateKey(now);
  const mon=mondayOfDate(now);
  const days=Array.from({length:5},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
  const fridayKey=localDateKey(days[4]);
  const constraints={...plan.constraints};
  if(plan.fridayEnd) constraints[fridayKey]={end:plan.fridayEnd,pauseMin:plan.fridayPauseMin};

  let weekTarget=0,fixedWork=0;
  const rows=[],flexible=[],warnings=[];

  for(const [index,d] of days.entries()){
    const key=localDateKey(d),status=effectiveStatus(key),rec=state.records[key];
    const target=status==="off"?0:targetForDate(key);
    weekTarget+=target;

    if(recordIsCreditedStatus(status)){
      fixedWork+=target;rows.push({key,index,type:"credited",target,work:target,delta:0});continue;
    }
    if(status==="off"){
      rows.push({key,index,type:"off",target:0,work:0,delta:0});continue;
    }
    if(rec?.end || isManualWorkRecord(rec)){
      const c=recordCalc(key,false);fixedWork+=c.worked;
      rows.push({
        key,index,type:"actual",target,work:c.worked,delta:c.worked-target,
        start:rec.start||"",end:rec.end||"",manual:isManualWorkRecord(rec)
      });continue;
    }
    if(key<todayKey){
      const c=recordCalc(key,false);fixedWork+=c.worked;
      rows.push({key,index,type:"missing",target,work:c.worked,delta:c.worked-target,start:rec?.start||""});
      warnings.push(`${weekdayName(d)} ist noch nicht vollständig abgeschlossen.`);continue;
    }

    const currentWorked=key===todayKey && rec?.start ? recordCalc(key,true).worked : 0;
    const spec=constraints[key];
    if(spec?.end){
      const info=plannerConstraintWork(key,spec,currentWorked);fixedWork+=info.work;
      rows.push({key,index,type:key===fridayKey?"goal":"constraint",target,work:info.work,delta:info.work-target,start:info.start,end:info.end,pause:info.pause,invalid:info.invalid});
      if(info.invalid) warnings.push(`${weekdayName(d)}: Endzeit liegt nicht nach dem Arbeitsbeginn.`);
      else if(key===todayKey && currentWorked>Math.max(0,(minutesFromTime(info.end)??0)-(minutesFromTime(info.start)??0)-info.pause)) warnings.push(`${weekdayName(d)}: Die geplante Endzeit ist durch die bereits geleistete Zeit nicht mehr erreichbar.`);
      continue;
    }

    flexible.push({key,index,target,minWork:key===todayKey?currentWorked:0,start:plannerStartForKey(key)});
  }

  const needForFlexible=weekTarget-fixedWork;
  const allocated=allocatePlannerWork(flexible,needForFlexible,plan.distribution);
  for(const item of allocated){
    const pause=plannerPauseForFlexible(item.key,item.plannedWork);
    const startMin=minutesFromTime(item.start)??0;
    rows.push({...item,type:"flex",work:item.plannedWork,delta:item.plannedWork-item.target,pause,end:timeFromMinutes(startMin+item.plannedWork+pause)});
  }
  rows.sort((a,b)=>a.index-b.index);

  const totalPlanned=fixedWork+allocated.reduce((s,x)=>s+x.plannedWork,0);
  const gap=Math.round(totalPlanned-weekTarget);
  const futureRows=rows.filter(r=>r.key>=todayKey && ["flex","constraint","goal"].includes(r.type));
  const nextRow=futureRows[0]||null;
  return {plan,weekTarget,totalPlanned,gap,rows,warnings,fridayKey,nextRow};
}
function plannerRowLabel(row){
  const d=dateFromKey(row.key);
  return `${weekdayName(d)} ${pad(d.getDate())}.${pad(d.getMonth()+1)}.`;
}
function plannerStatusText(row){
  if(row.type==="credited") return STATUS[effectiveStatus(row.key)]?.label||"Gutgeschrieben";
  if(row.type==="off") return "Frei";
  if(row.type==="actual") return `Ist ${formatCompact(row.work)}`;
  if(row.type==="missing") return "unvollständig";
  return row.end ? `bis ${row.end}` : formatCompact(row.work);
}
function renderWeekPlanPreview(plan){
  const result=calculateWeekPlan(plan);
  const warningHTML=result.warnings.length?`<div class="planner-warning">${result.warnings.map(x=>`<div>! ${x}</div>`).join("")}</div>`:"";
  const gapClass=result.gap>=0?"positive":"negative";
  const gapText=result.gap===0?"Wochenziel exakt geplant":result.gap>0?`${formatCompact(result.gap)} über Wochenziel`:`${formatCompact(Math.abs(result.gap))} fehlen noch`;
  return `<div class="planner-preview-head"><span>Plan</span><strong class="${gapClass}">${gapText}</strong></div>
    <div class="planner-preview-list">${result.rows.map(row=>`<div class="planner-preview-row"><span>${plannerRowLabel(row)}</span><strong>${plannerStatusText(row)}</strong><small class="${row.delta>=0?"positive":"negative"}">${row.target?formatSignedHours(row.delta):""}</small></div>`).join("")}</div>${warningHTML}`;
}
function plannerConstraintCandidates(){
  const now=new Date(),todayKey=localDateKey(now),mon=mondayOfDate(now),items=[];
  for(let i=0;i<5;i++){
    const d=new Date(mon);d.setDate(mon.getDate()+i);
    const key=localDateKey(d),status=effectiveStatus(key),rec=state.records[key];
    items.push({
      key,d,status,rec,
      isPast:key<todayKey,
      isToday:key===todayKey,
      isFriday:i===4,
      locked:key<todayKey || !!rec?.end || recordIsCreditedStatus(status) || status==="off"
    });
  }
  return items;
}

function readWeekPlannerDraft(){
  const constraints={};
  document.querySelectorAll("[data-planner-end]").forEach(input=>{
    const key=input.dataset.plannerEnd;
    if(!input.value) return;
    const pauseInput=document.querySelector(`[data-planner-pause="${key}"]`);
    let pause=pauseInput?.value===""?plannerRecommendedPause(key,input.value):Math.max(0,Number(pauseInput?.value)||0);
    constraints[key]={end:input.value,pauseMin:pause};
  });
  return normalizeWeekPlan({
    fridayEnd:$("plannerFridayEnd").value,
    fridayPauseMin:Math.max(0,Number($("plannerFridayPause").value)||0),
    distribution:$("plannerDistribution").value,
    constraints
  });
}
function updateWeekPlannerPreview(){
  const end=$("plannerFridayEnd").value;
  if(end && !plannerFridayPauseTouched) $("plannerFridayPause").value=plannerRecommendedPause(currentPlannerFridayKey(),end);
  const draft=readWeekPlannerDraft();
  const fridayRow=$("plannerFridayRowValue"); if(fridayRow) fridayRow.textContent=end||"—";
  $("plannerFridayHint").textContent=end?`Beginn ${plannerStartForKey(currentPlannerFridayKey())} · kurze Freitage bekommen automatisch 0 Min Pause, solange du den Wert nicht selbst änderst.`:"Wunschzeit für Freitag wählen.";
  $("weekPlannerPreview").innerHTML=end?renderWeekPlanPreview(draft):'<div class="planner-empty">Wähle zuerst deine gewünschte Feierabendzeit für Freitag.</div>';
}
function currentPlannerFridayKey(){
  const mon=mondayOfDate(new Date());const fr=new Date(mon);fr.setDate(mon.getDate()+4);return localDateKey(fr);
}
function renderPlannerConstraintRows(plan){
  const box=$("plannerConstraintRows");
  const items=plannerConstraintCandidates();
  box.innerHTML=items.map(({key,d,status,rec,isFriday,locked})=>{
    const spec=plan.constraints?.[key]||{};
    const dateText=`${pad(d.getDate())}.${pad(d.getMonth()+1)}.`;

    if(isFriday){
      return `<div class="planner-constraint-row planner-row-locked">
        <div class="planner-day"><strong>${weekdayName(d,false)}</strong><small>${dateText} · Beginn ${plannerStartForKey(key)}</small></div>
        <div class="planner-row-state"><span>Wunschziel</span><strong id="plannerFridayRowValue">${$("plannerFridayEnd").value||"—"}</strong><small>oben einstellen</small></div>
      </div>`;
    }

    if(recordIsCreditedStatus(status) || status==="off"){
      return `<div class="planner-constraint-row planner-row-locked">
        <div class="planner-day"><strong>${weekdayName(d,false)}</strong><small>${dateText}</small></div>
        <div class="planner-row-state"><span>Status</span><strong>${STATUS[status]?.label||status}</strong><small>wird automatisch berücksichtigt</small></div>
      </div>`;
    }

    if(rec?.end || isManualWorkRecord(rec)){
      const c=recordCalc(key,false);
      const main=isManualWorkRecord(rec)?`${formatCompact(c.worked)} Arbeit`:`${rec.start||"—"}–${rec.end}`;
      const sub=isManualWorkRecord(rec)?`Sammelbuchung · ${formatSignedHours(c.balance)}`:`${c.breakMin?`${formatCompact(c.breakMin)} Pause · `:""}${formatSignedHours(c.balance)}`;
      return `<div class="planner-constraint-row planner-row-locked">
        <div class="planner-day"><strong>${weekdayName(d,false)}</strong><small>${dateText}</small></div>
        <div class="planner-row-state"><span>Ist-Zeit</span><strong>${main}</strong><small>${sub}</small></div>
      </div>`;
    }

    if(locked){
      return `<div class="planner-constraint-row planner-row-locked">
        <div class="planner-day"><strong>${weekdayName(d,false)}</strong><small>${dateText}</small></div>
        <div class="planner-row-state"><span>Vergangen</span><strong>${rec?.start||"—"}</strong><small>nicht abgeschlossen</small></div>
      </div>`;
    }

    return `<div class="planner-constraint-row">
      <div class="planner-day"><strong>${weekdayName(d,false)}</strong><small>${dateText} · Beginn ${plannerStartForKey(key)}</small></div>
      <label>Feierabend<input type="time" data-planner-end="${key}" value="${spec.end||""}"></label>
      <label>Pause<input type="number" min="0" max="180" step="5" data-planner-pause="${key}" value="${spec.end?(spec.pauseMin??plannerRecommendedPause(key,spec.end)):""}" placeholder="auto"></label>
    </div>`;
  }).join("");
  box.querySelectorAll("input").forEach(el=>el.addEventListener("input",updateWeekPlannerPreview));
}

function openWeekPlanner(){
  plannerWeekKey=currentPlannerWeekKey();
  const existing=normalizeWeekPlan(state.weekPlans?.[plannerWeekKey]||{});
  const forecast=fridayForecast();
  const defaultEnd=forecast.projectedEnd!=null?timeFromMinutes(forecast.projectedEnd):"12:00";
  $("plannerFridayEnd").value=existing.fridayEnd||defaultEnd;
  plannerFridayPauseTouched=!!existing.fridayEnd;
  $("plannerFridayPause").value=existing.fridayEnd?existing.fridayPauseMin:plannerRecommendedPause(currentPlannerFridayKey(),$("plannerFridayEnd").value);
  $("plannerDistribution").value=existing.distribution;
  const mon=dateFromKey(plannerWeekKey);const fr=new Date(mon);fr.setDate(mon.getDate()+4);
  $("weekPlannerDateLabel").textContent=`${pad(mon.getDate())}.${pad(mon.getMonth()+1)}. – ${pad(fr.getDate())}.${pad(fr.getMonth()+1)}.${fr.getFullYear()}`;
  renderPlannerConstraintRows(existing);
  $("deleteWeekPlanBtn").hidden=!state.weekPlans?.[plannerWeekKey];
  updateWeekPlannerPreview();
  $("weekPlannerDialog").showModal();
}

function fridayForecast(){
  if(!fridayForecastRelevant()) return {mode:"hidden"};
  const now=new Date();
  const dow=dayIndexMon0(now);
  const mon=mondayOfDate(now);
  const friday=new Date(mon);
  friday.setDate(mon.getDate()+4);
  const fridayKey=localDateKey(friday);

  if(dow>4){
    return {mode:"weekend",title:"Freitags-Prognose",note:"Neue Prognose ab Montag."};
  }

  let accrued=0;
  for(let i=0;i<Math.min(dow+1,4);i++){
    const d=new Date(mon);
    d.setDate(mon.getDate()+i);
    const key=localDateKey(d);
    const status=effectiveStatus(key);
    const rec=state.records[key];

    if(i<dow){
      accrued+=dayBalanceForSummary(key,false);
    }else{
      if(status==="work" && (rec?.end || isManualWorkRecord(rec))) accrued+=recordCalc(key,false).balance;
      else if(status==="work" && rec?.start && !rec.end) accrued+=Math.max(0,recordCalc(key,true).balance);
      else if(recordIsCreditedStatus(status) || status==="off") accrued+=recordCalc(key,false).balance;
    }
  }

  const fridayTarget=targetForDate(fridayKey);
  const requiredFriday=Math.max(0,fridayTarget-accrued);
  const start=plannedStartForWeekday(4);
  const startMin=minutesFromTime(start) ?? 395;
  const pauseMin=Number(state.settings.plannedPauseMin)||0;
  const projectedEnd=startMin+requiredFriday+pauseMin;

  if(dow<4){
    return {mode:"forecast",accrued,fridayTarget,requiredFriday,start,projectedEnd,title:"Freitags-Prognose"};
  }

  const fridayRec=state.records[fridayKey];
  const startToday=fridayRec?.start || start;
  const startTodayMin=minutesFromTime(startToday) ?? startMin;
  let prevBalance=0;
  for(let i=0;i<4;i++){
    const d=new Date(mon);
    d.setDate(mon.getDate()+i);
    prevBalance+=dayBalanceForSummary(localDateKey(d),false);
  }
  const neededToday=Math.max(0,fridayTarget-prevBalance);
  const hasFridayPause=!!fridayRec && (fridayRec.pauses||[]).some(p=>
    (p.start && (p.end || fridayKey===localDateKey(new Date()))) ||
    (Number(p.minutes)>0 && !p.start)
  );
  const realPause=fridayRec ? pauseMinutes(fridayRec,true,fridayKey,true) : 0;
  const plannedPause=hasFridayPause ? realPause : pauseMin;
  return {
    mode:"friday",accrued:prevBalance,fridayTarget,requiredFriday:neededToday,
    start:startToday,projectedEnd:startTodayMin+neededToday+plannedPause,title:"Wochenziel heute"
  };
}

function tapIconHTML(size=26){
  return `
    <svg class="tap-cue-icon" width="${size}" height="${size}" viewBox="0 0 64 64"
         aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path class="tap-ring tap-ring-1" d="M18 25a14 14 0 0 1 28 0" />
      <path class="tap-ring tap-ring-2" d="M12 25a20 20 0 0 1 40 0" />
      <path class="tap-hand" d="M32 48V25c0-3 2-5 5-5s5 2 5 5v12-5c0-3 2-5 5-5s5 2 5 5v8-4c0-3 2-5 5-5 2 0 4 2 4 5v10c0 9-7 16-16 16H33c-7 0-12-4-14-10l-4-12c-1-3 1-6 4-7 3-1 6 1 7 4l3 8" />
    </svg>`;
}
function renderSaldoInsight(){
  const val=balanceForScope(saldoScope);
  const cls=val>=0?"positive":"negative";
  return `<section class="saldo-switch card">
    <div class="saldo-left"><span>Saldo ${saldoScopeLabel(saldoScope)}</span><strong class="${cls}">${formatSignedHours(val)}</strong></div>
    <button class="saldo-tap-btn" id="saldoSwitch" type="button" aria-label="Saldoansicht wechseln: Woche, Monat, Jahr">
      <span class="saldo-scope-label">${saldoScopeLabel(saldoScope)}</span>${tapIconHTML(24)}
    </button>
  </section>`;
}
function fridayEditAffordanceHTML(){
  return `<span class="friday-edit-affordance" aria-hidden="true">${uiLineIconSVG("edit")}</span>`;
}
function renderFridayInsight(compact=false){
  const plan=activeWeekPlan();
  if(plan){
    const r=calculateWeekPlan(plan);
    const fridayEnd=plan.fridayEnd;
    const next=r.nextRow;
    const nextText=next ? `${next.key===localDateKey(new Date())?"Heute":weekdayName(dateFromKey(next.key),false)} bis ${next.end}` : "Woche geplant";
    const gapBad=r.gap<0;
    if(compact){
      const bottom=r.gap===0
        ? `<div class="friday-compact-bottom"><span>${nextText}</span><strong class="friday-gap good">passt</strong></div>`
        : `<div class="friday-compact-bottom friday-gap-block"><strong class="friday-gap ${gapBad?"bad":"good"}">${formatSignedHours(r.gap)}</strong><span>${gapBad?"zum Wochensoll":"über Wochensoll"}</span></div>`;
      return `<button type="button" class="friday-card card compact friday-plan-trigger" id="openWeekPlannerBtn" aria-label="Wochenplan bearbeiten${gapBad?`, ${formatSignedHours(r.gap)} zum Wochensoll`:""}">${fridayEditAffordanceHTML()}<div class="friday-kicker">Freitag · Ziel</div><div class="friday-main ${gapBad?"bad":"good"}">${fridayEnd}</div>${bottom}</button>`;
    }
    return `<button type="button" class="friday-card card friday-plan-trigger" id="openWeekPlannerBtn" aria-label="Wochenplan bearbeiten">${fridayEditAffordanceHTML()}<div class="friday-top"><div><div class="friday-kicker">Freitag · Wunschziel</div><div class="friday-main ${gapBad?"bad":"good"}">${fridayEnd} Uhr</div><div class="friday-note">${nextText} · antippen zum Anpassen.</div>${r.gap!==0?`<div class="friday-gap-note ${gapBad?"bad":"good"}">${formatSignedHours(r.gap)} ${gapBad?"zum Wochensoll":"über Wochensoll"}</div>`:""}</div></div><div class="friday-time-row"><div><span>Freitag Beginn</span><strong>${plannerStartForKey(r.fridayKey)}</strong></div><div><span>Pause</span><strong>${plan.fridayPauseMin} Min</strong></div><div><span>Plan-Saldo</span><strong class="${r.gap>=0?"positive":"negative"}">${formatSignedHours(r.gap)}</strong></div></div></button>`;
  }

  const f=fridayForecast();
  if(f.mode==="hidden") return "";
  if(f.mode==="weekend") return `<section class="friday-card card${compact?" compact":""}"><div class="friday-kicker">Freitags-Prognose</div><div class="friday-main">Ab Montag</div>${compact?"":`<div class="friday-note">Neue Prognose mit Beginn der Arbeitswoche.</div>`}</section>`;
  const saved=f.fridayTarget-f.requiredFriday;
  if(compact){
    if(f.mode==="forecast") return `<button type="button" class="friday-card card compact friday-plan-trigger" id="openWeekPlannerBtn" aria-label="Freitagsziel planen">${fridayEditAffordanceHTML()}<div class="friday-kicker">Freitag</div><div class="friday-main ${saved>=0?"good":"bad"}">${formatCompact(f.requiredFriday)}</div><div class="friday-compact-bottom"><span>Feierabend</span><strong>${timeFromMinutes(f.projectedEnd)}</strong></div></button>`;
    return `<button type="button" class="friday-card card compact friday-plan-trigger" id="openWeekPlannerBtn" aria-label="Freitagsziel planen">${fridayEditAffordanceHTML()}<div class="friday-kicker">Wochenziel heute</div><div class="friday-main ${saved>=0?"good":"bad"}">${timeFromMinutes(f.projectedEnd)}</div><div class="friday-compact-bottom"><span>Noch nötig</span><strong>${formatCompact(f.requiredFriday)}</strong></div></button>`;
  }
  const savedText=saved>0?`${formatCompact(saved)} früher als Soll`:saved<0?`${formatCompact(Math.abs(saved))} länger als Soll`:"aktuell genau im Soll";
  if(f.mode==="forecast") return `<button type="button" class="friday-card card friday-plan-trigger" id="openWeekPlannerBtn" aria-label="Freitagsziel planen">${fridayEditAffordanceHTML()}<div class="friday-top"><div><div class="friday-kicker">${f.title}</div><div class="friday-main ${saved>=0?"good":"bad"}">${formatCompact(f.requiredFriday)} arbeiten</div><div class="friday-note">Wenn die restlichen Tage nach Soll laufen · antippen zum Planen.</div></div></div><div class="friday-time-row"><div><span>Beginn</span><strong>${f.start}</strong></div><div><span>Feierabend</span><strong>${timeFromMinutes(f.projectedEnd)}</strong></div><div><span>Wochenplus</span><strong class="${f.accrued>=0?"positive":"negative"}">${formatSignedHours(f.accrued)}</strong></div></div><div class="friday-note">${savedText}.</div></button>`;
  return `<button type="button" class="friday-card card friday-plan-trigger" id="openWeekPlannerBtn" aria-label="Freitagsziel planen">${fridayEditAffordanceHTML()}<div class="friday-top"><div><div class="friday-kicker">${f.title}</div><div class="friday-main ${saved>=0?"good":"bad"}">${timeFromMinutes(f.projectedEnd)} Uhr</div><div class="friday-note">Dann ist dein Wochen-Soll erreicht · antippen zum Planen.</div></div></div><div class="friday-time-row"><div><span>Beginn</span><strong>${f.start}</strong></div><div><span>Heute nötig</span><strong>${formatCompact(f.requiredFriday)}</strong></div><div><span>Mo–Do</span><strong class="${f.accrued>=0?"positive":"negative"}">${formatSignedHours(f.accrued)}</strong></div></div><div class="friday-note">${savedText}.</div></button>`;
}

function uiLineIconSVG(kind){
  const common='viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if(kind==="start") return `<svg ${common}><circle cx="12" cy="12" r="8"></circle><path d="M12 7.8v4.5l3 1.8"></path></svg>`;
  if(kind==="pause") return `<svg ${common}><path d="M9 7.2v9.6M15 7.2v9.6"></path></svg>`;
  if(kind==="booking") return `<svg ${common}><path d="M6.5 8.2h11M6.5 12h7.2M6.5 15.8h8.8"></path><path d="M5 4.8h14a1.5 1.5 0 0 1 1.5 1.5v11.4A1.5 1.5 0 0 1 19 19.2H5a1.5 1.5 0 0 1-1.5-1.5V6.3A1.5 1.5 0 0 1 5 4.8Z"></path></svg>`;
  if(kind==="finish") return `<svg ${common}><circle cx="12" cy="12" r="8"></circle><path d="M12 8v4.2l2.8 1.7"></path><path d="M16.6 5.9l1.7-1.7M18.1 8.3h2.2"></path></svg>`;
  if(kind==="edit") return `<svg ${common}><path d="M5.2 18.8l3.5-.8 9.1-9.1a2 2 0 0 0-2.8-2.8L5.9 15.2l-.7 3.6Z"></path><path d="M13.8 7.3l2.9 2.9"></path></svg>`;
  return `<svg ${common}><circle cx="12" cy="12" r="8"></circle></svg>`;
}

function pauseTimeDetails(rec,key){
  if(!rec) return [];
  const isToday=key===localDateKey(new Date());

  return (rec.pauses||[]).map((p,index)=>{
    const fixed=Math.max(0,Math.round(Number(p.minutes)||0));
    const start=minutesFromTime(p.start);

    if(start!==null){
      if(p.end){
        const end=minutesFromTime(p.end);
        if(end===null || end<start) return null;
        return {
          type:"timed",
          start:p.start,
          end:p.end,
          label:`${p.start}–${p.end}`,
          duration:end-start,
          running:autoPauseRunning(p,key),
          index
        };
      }
      if(isToday){
        const now=minutesFromTime(nowTime());
        const duration=now===null?0:Math.max(0,now-start);
        return {
          type:"timed",
          start:p.start,
          end:null,
          label:`${p.start}–läuft`,
          duration,
          running:true,
          index
        };
      }
      return {
        type:"timed",
        start:p.start,
        end:null,
        label:`${p.start}–…`,
        duration:0,
        running:false,
        index
      };
    }

    if(fixed>0){
      return {
        type:"fixed",
        start:null,
        end:null,
        label:`${fixed} Min · ohne Uhrzeit`,
        duration:fixed,
        running:false,
        index
      };
    }

    return null;
  }).filter(Boolean);
}

function openPastDayKey(){
  const today=new Date();
  for(let i=1;i<=14;i++){
    const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()-i);
    const key=localDateKey(d);
    const rec=state.records[key];
    if(!rec || rec.status!=="work" || isManualWorkRecord(rec)) continue;
    if(rec.start && !rec.end) return key;
  }
  return null;
}
function openPastDayHTML(){
  if(selectedDate!==localDateKey(new Date())) return "";
  const key=openPastDayKey();
  if(!key) return "";
  const d=dateFromKey(key);
  return `<section class="context-hint attention open-day-hint">
    <span class="context-icon">!</span>
    <div><strong>${weekdayName(d,false)} ${pad(d.getDate())}.${pad(d.getMonth()+1)}. ohne Ende</strong><small>Beginn ${state.records[key].start} · Endzeit fehlt noch</small></div>
    <button type="button" class="hint-action" data-edit-day="${key}">Nachtragen</button>
  </section>`;
}
function contextualDayHint(key,rec,c){
  if(!rec?.start || rec.end) return "";

  const isToday=key===localDateKey(new Date());
  if(isToday && c.worked>=MAX_WORK_MIN-30){
    const over=c.worked>=MAX_WORK_MIN;
    return `<section class="context-hint attention">
      <span class="context-icon">!</span>
      <div><strong>${over?"10-Stunden-Grenze erreicht":"10-Stunden-Grenze naht"}</strong><small>${formatCompact(c.worked)} gearbeitet · spätestens ${timeFromMinutes(c.latestEnd)} Feierabend</small></div>
    </section>`;
  }

  const legalNow=legalPauseFor(c.worked);
  if(isToday && state.settings.breakReminder && c.worked>=360 && c.breakMin<Math.max(30,legalNow)){
    const need=Math.max(30,legalNow);
    return `<section class="context-hint attention">
      <span class="context-icon">!</span>
      <div><strong>Pause prüfen</strong><small>${formatCompact(c.worked)} gearbeitet · bisher ${formatCompact(c.breakMin)} Pause · Pflicht ${need} Min${need===45?" ab 9 h":" ab 6 h"}</small></div>
    </section>`;
  }

  if(isToday && state.settings.breakReminder && c.hasActualPause && !activePause(rec) && c.target>540 && c.projectedPauseMin<45){
    return `<section class="context-hint attention">
      <span class="context-icon">!</span>
      <div><strong>Längerer Tag geplant</strong><small>Über 9 h Arbeit sind 45 Min Pause Pflicht · bisher ${formatCompact(c.projectedPauseMin)}</small></div>
    </section>`;
  }

  if(!isToday && !rec.end){
    return `<section class="context-hint attention">
      <span class="context-icon">!</span>
      <div><strong>Eintrag unvollständig</strong><small>Für diesen Arbeitstag fehlt die Endzeit.</small></div>
    </section>`;
  }

  return "";
}

function renderHomeWidget(id,ctx,compact=false){
  const {key,rec,c}=ctx;

  if(id==="saldo") return renderSaldoInsight();
  if(id==="friday") return renderFridayInsight(compact);

  if(id==="stats") return "";
  if(id==="statuses") return statusButtons(key);
  if(id==="week") return weekDots();
  if(id==="note") return rec?.note?`<section class="note card"><span class="note-label">Notiz</span><div>${escapeHtml(rec.note)}</div></section>`:"";
  return "";
}
function renderHomeWidgets(ctx){
  const enabled=state.settings.homeWidgets||{};
  const order=FIXED_HOME_ORDER.filter(id=>enabled[id]!==false);
  const compactIds=new Set(["saldo","friday"]);
  let out="";

  for(let i=0;i<order.length;i++){
    const id=order[i],next=order[i+1];

    if(compactIds.has(id) && compactIds.has(next)){
      const first=renderHomeWidget(id,ctx,true);
      const second=renderHomeWidget(next,ctx,true);

      if(first && second){
        out+=`<section class="home-widget-pair">${first}${second}</section>`;
      }else{
        out+=first||second||"";
      }
      i++;
      continue;
    }

    out+=renderHomeWidget(id,ctx,false);
  }
  return out;
}
function idyllicSceneHTML(done=false){
  return `<div class="idyllic-wrap" aria-hidden="true">
    <svg class="idyllic-scene" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#263d5f"/><stop offset="1" stop-color="#101d2e"/></linearGradient>
        <linearGradient id="sunset" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9cff21" stop-opacity=".75"/><stop offset="1" stop-color="#fbbf24" stop-opacity=".7"/></linearGradient>
      </defs>
      <rect x="2" y="4" width="136" height="88" rx="20" fill="url(#sky)" stroke="#24354d"/>
      <circle cx="103" cy="30" r="13" fill="${done?"#9cff21":"url(#sunset)"}" opacity=".9"/>
      <path d="M4 68 L33 42 L52 59 L72 34 L103 66 L121 51 L138 70 L138 92 L4 92 Z" fill="#18293a"/>
      <path d="M4 74 L35 54 L52 67 L76 47 L105 73 L123 61 L138 75 L138 92 L4 92 Z" fill="#10291f"/>
      <path d="M5 78 C31 72 52 84 73 78 C94 72 116 82 137 75 L137 92 L5 92 Z" fill="#0b2130"/>
      <path d="M8 82 C34 77 52 87 75 81 C96 76 116 84 133 79" fill="none" stroke="#5b85a4" stroke-opacity=".28" stroke-width="2"/>
      <g fill="#173727"><path d="M18 72 l7-15 7 15h-5v12h-4V72z"/><path d="M112 70 l7-17 7 17h-5v14h-4V70z"/></g>
    </svg>
    <div class="idyllic-caption">${done?"FEIERABEND":"DEIN FEIERABEND"}</div>
  </div>`;
}

function setHeader(){
  const now=new Date();
  $("liveTime").textContent=nowTime();
  renderDemoBanner();
  const d=dateFromKey(selectedDate);
  const isToday=selectedDate===localDateKey(now);
  $("headerDate").innerHTML=`${weekdayName(d,false)}, ${pad(d.getDate())}.${pad(d.getMonth()+1)}.<small>KW ${isoWeekNumber(d)} · ${d.getFullYear()}${isToday?"":" · zurück zu heute"}</small>`;
  $("headerDate").classList.toggle("not-today",!isToday);
}
function toast(msg,action=null){
  const t=$("toast");
  t.textContent=msg;
  t.classList.toggle("has-action",!!action);
  if(action){
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="toast-action";
    btn.textContent=action.label;
    btn.addEventListener("click",()=>{
      clearTimeout(window.__toast);
      t.classList.remove("show");
      action.run();
    },{once:true});
    t.appendChild(btn);
  }
  t.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast=setTimeout(()=>t.classList.remove("show"),action?6000:1800);
}
function undoableRecordChange(key,message,change){
  const before=state.records[key]?JSON.parse(JSON.stringify(state.records[key])):null;
  change();
  save();render();
  toast(message,{label:"Rückgängig",run:()=>{
    if(before) state.records[key]=before; else delete state.records[key];
    save();render();toast("Rückgängig gemacht");
  }});
}
function escapeHtml(str){
  return String(str||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function statusButtons(key){
  const hasRecord=!!state.records[key];
  return `
    <section class="day-type-wrap">
      <button class="day-type-toggle" data-toggle-daytypes aria-label="Tagestyp und Abwesenheit öffnen">
        <span>Tagestyp / Abwesenheit</span>
        <span class="day-type-affordance"><span class="chev">⌄</span></span>
      </button>
      <div class="day-type-panel" data-daytype-panel>
        <section class="status-grid">
          <button class="vacation" data-set-status="${key}|vacation"><span>🏖</span>Urlaub</button>
          <button class="specialLeave" data-set-status="${key}|specialLeave"><span>🌴</span>Sonderurlaub</button>
          <button class="sick" data-set-status="${key}|sick"><span>✚</span>Krank</button>
          <button class="flex" data-set-status="${key}|flex"><span>↻</span>FZA</button>
          <button class="off" data-set-status="${key}|off"><span>○</span>Frei</button>
          <button class="clear-entry" data-clear-day="${key}"><span>×</span>Kein Eintrag</button>
        </section>
        <div class="overwrite-info">${hasRecord?"Vorhandene Werte werden nur nach Bestätigung geändert oder gelöscht.":"Noch kein gespeicherter Eintrag für diesen Tag."}</div>
      </div>
    </section>`;
}
function weekDots(){
  const d=dateFromKey(selectedDate);
  const monday=new Date(d); monday.setDate(d.getDate()-dayIndexMon0(d));
  let html='<section class="week-row card">';
  for(let i=0;i<7;i++){
    const x=new Date(monday);x.setDate(monday.getDate()+i);
    const k=localDateKey(x), status=effectiveStatus(k);
    const cls=k===selectedDate?"today":(status!=="empty"?"done":"");
    html+=`<button class="day ${cls}" data-select-day="${k}" style="background:none;border:0">
      <span>${weekdayName(x)}</span><div class="day-dot"></div>
    </button>`;
  }
  return html+"</section>";
}

function homeDayTimeline(rec,c,key){
  if(!rec?.start || c.plannedEnd==null) return null;

  const start=minutesFromTime(rec.start);
  if(start===null) return null;

  const isToday=key===localDateKey(new Date());
  const now=minutesFromTime(nowTime());
  const actualEnd=minutesFromTime(rec.end);

  // Die Achse reicht vom Arbeitsbeginn bis zum errechneten Feierabend.
  // Nur Pausen mit echter Uhrzeit bekommen eine Position im Zeitstrahl.
  const axisEnd=Math.max(start+1,actualEnd!==null ? actualEnd : c.plannedEnd);
  const span=Math.max(1,axisEnd-start);

  const elapsedEnd=actualEnd!==null
    ? actualEnd
    : (isToday && now!==null ? clamp(now,start,axisEnd) : start);

  const elapsedPct=clamp((elapsedEnd-start)/span*100,0,100);
  const details=pauseTimeDetails(rec,key);

  const timedSegments=details
    .filter(p=>p.type==="timed" && p.start)
    .map((p,index)=>{
      const a=minutesFromTime(p.start);
      let b=minutesFromTime(p.end);
      if(b===null && p.running && isToday) b=now;
      if(a===null || b===null || b<=a) return null;

      const ca=clamp(a,start,axisEnd);
      const cb=clamp(b,start,axisEnd);
      if(cb<=ca) return null;

      const left=clamp((ca-start)/span*100,0,100);
      const width=clamp((cb-ca)/span*100,0,100);

      return {
        left,
        width,
        center:clamp(left+width/2,0,100),
        label:p.label,
        running:p.running,
        lane:index%2
      };
    })
    .filter(Boolean);

  // Pausen ohne Uhrzeit und die reine Planpause werden bewusst NICHT
  // künstlich irgendwo im Balken platziert. Ihre Dauer steht kompakt
  // im Kopf des Zeitstrahls.
  return {
    startLabel:rec.start,
    endLabel:actualEnd!==null ? rec.end : timeFromMinutes(c.plannedEnd),
    elapsedPct,
    timedSegments
  };
}

function plannedStartToday(){
  const idx=dayIndexMon0(new Date());
  const t=state.settings.weekdayStartTimes?.[idx];
  const plan=minutesFromTime(t),now=minutesFromTime(nowTime());
  if(plan===null||now===null) return null;
  // Nur anbieten, wenn der Planbeginn schon vorbei ist, aber noch plausibel (max. 4 h).
  if(plan>=now || now-plan>240) return null;
  return t;
}
/* ── V37 Homescreen ── */
const H_ICON={
  exit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4"/></svg>',
  enter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 16l4-4-4-4M18 12H8"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.6A1 1 0 0 0 8 5.5z"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>'
};
function hDur(min){
  min=Math.round(Math.abs(min||0));
  return `${Math.floor(min/60)}:${pad(min%60)}`;
}
function hSigned(min){
  min=Math.round(min||0);
  return `${min>0?"+":min<0?"−":""}${hDur(min)}`;
}
function plannedStartFor(key){
  return state.settings.weekdayStartTimes?.[dayIndexMon0(dateFromKey(key))]||"";
}

function hTimeline(rec,c,key){
  const start=minutesFromTime(rec.start);
  if(start===null||c.plannedEnd==null) return "";
  const isToday=key===localDateKey(new Date());
  const now=minutesFromTime(nowTime());
  const end=minutesFromTime(rec.end);
  const ref=end!==null?end:(isToday?Math.max(start,now):start);
  const axisEnd=end!==null?Math.max(end,start+1):Math.max(c.plannedEnd,ref);
  const span=Math.max(1,axisEnd-start);
  const pct=m=>clamp((m-start)/span*100,0,100);

  let ticks="";
  for(let m=Math.ceil((start+1)/30)*30;m<axisEnd;m+=30){
    ticks+=`<i class="h-tick${m%60?" half":""}" style="left:${pct(m)}%"></i>`;
  }
  const blocks=pauseTimeDetails(rec,key).filter(p=>p.type==="timed").map(p=>{
    const a=minutesFromTime(p.start);
    let b=p.end?minutesFromTime(p.end):(p.running&&isToday?now:null);
    if(a===null||b===null||b<=a) return null;
    b=Math.min(b,ref);
    if(b<=a) return null;
    return {l:pct(a),w:Math.max(.8,pct(b)-pct(a)),c:pct((a+b)/2),run:!p.end&&p.running,
      label:!p.end&&p.running?`seit ${p.start}`:`${p.start}–${p.end}`};
  }).filter(Boolean);
  const lanes=[];
  blocks.forEach(b=>{
    let lane=lanes.findIndex(last=>b.c-last>30);
    if(lane<0){lane=lanes.length;lanes.push(b.c)}else lanes[lane]=b.c;
    b.lane=lane;
  });
  const over=end===null&&axisEnd>c.plannedEnd;
  const endLabel=end!==null?"Ende":c.balance>=0?"Soll erreicht":"Feierabend";
  const endTime=end!==null?rec.end:timeFromMinutes(c.plannedEnd);
  return `<div class="h-tl">
    <div class="h-tl-ends"><span>Beginn<b>${rec.start}</b></span><span class="end">${endLabel}<b>${endTime}</b></span></div>
    <div class="h-track" role="img" aria-label="Arbeitstag von ${rec.start} bis ${timeFromMinutes(axisEnd)}">
      <div class="h-track-clip">
        <div class="h-fill" style="width:${pct(ref)}%"></div>
        ${blocks.map(b=>`<i class="h-pz${b.run?" running":""}" style="left:${b.l}%;width:${b.w}%"></i>`).join("")}
        ${ticks}
      </div>
      ${over?`<i class="h-soll" style="left:${pct(c.plannedEnd)}%"></i>`:""}
      ${end===null&&isToday?`<i class="h-now" style="left:${pct(ref)}%"></i>`:""}
    </div>
    ${blocks.length?`<div class="h-pz-labels" style="height:${lanes.length*20}px">${blocks.map(b=>`<span style="left:${clamp(b.c,12,88)}%;top:${b.lane*20}px">${b.label}</span>`).join("")}</div>`:""}
  </div>`;
}

function hWeek(){
  const sel=dateFromKey(selectedDate);
  const mon=mondayOfDate(sel);
  const todayK=localDateKey(new Date());
  const thisWeek=localDateKey(mon)===localDateKey(mondayOfDate(new Date()));
  const fridayKey=localDateKey(new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+4));
  const f=thisWeek&&fridayKey>todayK?fridayForecast():{mode:"hidden"};
  const plan=thisWeek?activeWeekPlan():null;

  const cells=[];
  for(let i=0;i<5;i++){
    const d=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i);
    const key=localDateKey(d);
    const status=effectiveStatus(key);
    const rec=state.records[key];
    const isToday=key===todayK;
    const dn=weekdayName(d);
    const sel=key===selectedDate?" sel":"";

    if(i===4&&key>todayK&&(plan||f.mode==="forecast")&&(status==="work"||status==="empty")){
      const t=plan?plan.fridayEnd:timeFromMinutes(f.projectedEnd);
      cells.push(`<button type="button" class="h-day fc" id="openWeekPlannerBtn" aria-label="Freitag planen"><span class="dn">Fr</span><span class="dh">${t}</span><span class="db">${plan?"Plan":"Prognose"}</span></button>`);
      continue;
    }
    let dh="–",db="",dbCls="";
    if(status!=="work"&&status!=="empty"){
      dh=`<span class="h-typed ${status}">${STATUS[status].label}</span>`;
    }else if(rec&&(rec.start||isManualWorkRecord(rec))){
      const c=recordCalc(key,isToday);
      dh=hDur(c.worked);
      const counts=rec.end||isManualWorkRecord(rec)||(isToday&&c.balance>=0);
      if(counts){db=hSigned(c.balance);dbCls=c.balance>=0?"pos":"neg";}
      else db=isToday?"läuft":"offen";
    }else if(key<todayK&&targetForDate(key)>0){
      db="fehlt";
    }else if(targetForDate(key)>0){
      db=`Soll ${hDur(targetForDate(key))}`;
    }
    cells.push(`<button type="button" class="h-day${isToday?" today":""}${sel}" data-select-day="${key}"><span class="dn">${dn}</span><span class="dh">${dh}</span><span class="db ${dbCls}">${db||"&nbsp;"}</span></button>`);
  }

  let bal,sub;
  if(thisWeek){
    bal=currentWeekBalance();
    const tRec=state.records[todayK];
    const todayPart=tRec&&effectiveStatus(todayK)==="work"?dayBalanceForSummary(todayK,true):0;
    sub=todayPart!==0?"inkl. heute":"bis gestern";
  }else{
    const sun=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+6);
    bal=dateRangeBalance(mon,sun,false);
    sub="Wochensaldo";
  }
  return `<section class="h-week">
    <button type="button" class="h-week-head" data-sheet="konto" aria-label="Zeitkonto öffnen"><span><span class="h-kicker">Woche ${isoWeekNumber(sel)}</span><b class="${bal>=0?"pos":"neg"}">${hSigned(bal)}</b></span><span class="h-konto"><small>Konto</small><b class="${kontoBalance()>=0?"pos":"neg"}">${hSigned(kontoBalance())} h</b><i>›</i></span></button>
    <div class="h-days">${cells.join("")}</div>
  </section>`;
}

function vacationBlockFrom(startKey){
  // Urlaubsblock ab startKey: Wochenenden, Feiertage und freie Tage dazwischen verbinden ihn
  let to=startKey,workdays=0;
  const d=dateFromKey(startKey);
  for(let i=0;i<90;i++){
    const k=localDateKey(d);
    const st=effectiveStatus(k);
    if(st==="vacation"){to=k;workdays++;}
    else if(!(st==="holiday"||st==="off"||targetForDate(k)===0)) break;
    d.setDate(d.getDate()+1);
  }
  return {to,workdays};
}
function workdaysBetween(fromKey,toKeyExcl){
  // zählt Arbeitstage (Soll > 0, kein Feiertag/Urlaub/Frei) im Bereich [fromKey, toKeyExcl)
  let n=0;
  const d=dateFromKey(fromKey);
  while(localDateKey(d)<toKeyExcl){
    const k=localDateKey(d);
    const st=effectiveStatus(k);
    if((st==="work"||st==="empty")&&targetForDate(k)>0) n++;
    d.setDate(d.getDate()+1);
  }
  return n;
}
function daysUntil(key){
  const t=new Date();t.setHours(0,0,0,0);
  return Math.round((dateFromKey(key)-t)/86400000);
}
function nextVacation(){
  const todayK=localDateKey(new Date());
  const keys=Object.keys(state.records).filter(k=>k>todayK&&state.records[k]?.status==="vacation").sort();
  if(!keys.length) return null;
  const from=keys[0];
  const {to,workdays}=vacationBlockFrom(from);
  // Heute zählt mit, solange noch kein Feierabend gestempelt ist
  const tRec=state.records[todayK];
  const startK=tRec?.end?localDateKey(new Date(Date.now()+86400000)):todayK;
  return {from,to,workdays,days:daysUntil(from),workLeft:workdaysBetween(startK,from)};
}
function nextHoliday(){
  const d=new Date();
  for(let i=1;i<=366;i++){
    d.setDate(d.getDate()+1);
    const k=localDateKey(d);
    const name=bwHolidayName(k);
    if(name&&![0,6].includes(d.getDay())) return {key:k,name,days:daysUntil(k)};
  }
  return null;
}
function hVacation(){
  const year=new Date().getFullYear();
  const ent=Number(state.settings.vacationEntitlement)||0;
  const rest=ent-statusCountForYear(year,"vacation");
  const restHTML=`<span class="h-vac-r">Rest<b>${rest} / ${ent}</b></span>`;
  const fmt=k=>{const d=dateFromKey(k);return `${weekdayName(d)} ${pad(d.getDate())}.${pad(d.getMonth()+1)}.`};
  const todayK=localDateKey(new Date());
  const unit=n=>n===1?"Tag":"Tage";

  // Urlaub läuft gerade
  if(effectiveStatus(todayK)==="vacation"){
    const {to}=vacationBlockFrom(todayK);
    const left=daysUntil(to);
    return `<button type="button" class="h-vac on" data-sheet="vacation"><span class="h-vac-n">${left}<small> ${unit(left)}</small></span><span class="h-vac-t"><b>${left?"Urlaub läuft noch":"Letzter Urlaubstag"}</b><span>Resturlaub ${rest} / ${ent}</span></span><span class="h-vac-r">bis ${weekdayName(dateFromKey(to))}<b>${pad(dateFromKey(to).getDate())}.${pad(dateFromKey(to).getMonth()+1)}.</b></span></button>`;
  }

  const v=nextVacation();
  if(v){
    return `<button type="button" class="h-vac" data-sheet="vacation"><span class="h-vac-n">${v.days}<small> ${unit(v.days)}</small></span><span class="h-vac-t"><b>bis zum Urlaub</b><span>noch ${v.workLeft} Arbeits${v.workLeft===1?"tag":"tage"}</span></span><span class="h-vac-r">ab ${weekdayName(dateFromKey(v.from))}<b>${pad(dateFromKey(v.from).getDate())}.${pad(dateFromKey(v.from).getMonth()+1)}.</b></span></button>`;
  }

  // Kein Urlaub geplant: nächster Feiertag als Ersatz
  const h=nextHoliday();
  return `<button type="button" class="h-vac" id="openBulkBtn"><span class="h-vac-n${h?"":" none"}">${h?`${h.days}<small> ${unit(h.days)}</small>`:"–"}</span><span class="h-vac-t"><b>${h?`bis ${escapeHtml(bridgeName(h.name))}`:"Kein Urlaub eingetragen"}</b><span>Urlaub eintragen ›</span></span>${restHTML}</button>`;
}

/* ── V37 Brückentag-Finder ──
   Sucht Zeiträume, in denen wenige Urlaubstage dank Feiertagen viele freie Tage
   am Stück ergeben. Gerechnet wird mit den echten Arbeitstagen (Soll > 0) und
   bereits eingetragenen freien Tagen. Freie Tage = Wochenende/Soll 0, Feiertag,
   Urlaub, Sonderurlaub, FZA, Frei. */
function bridgeDayInfo(key){
  const st=effectiveStatus(key);
  const work=(st==="work"||st==="empty"||st==="sick")&&targetForDate(key)>0&&!state.records[key]?.start;
  return {key,work,holiday:st==="holiday"?bwHolidayName(key):null};
}
function bridgeOpportunities(fromKey,days=430){
  const list=[];
  const d=dateFromKey(fromKey);
  for(let i=0;i<days;i++){list.push(bridgeDayInfo(localDateKey(d)));d.setDate(d.getDate()+1);}
  // Läufe bilden: abwechselnd frei / Arbeit
  const runs=[];
  for(const x of list){
    const last=runs[runs.length-1];
    if(last&&last.work===x.work){last.days.push(x);}
    else runs.push({work:x.work,days:[x]});
  }
  const out=[];
  for(let a=0;a<runs.length;a++){
    if(!runs[a].work) continue;
    let vac=0,vacDays=[];
    for(let b=a;b<runs.length;b++){
      if(runs[b].work){
        vac+=runs[b].days.length;vacDays=vacDays.concat(runs[b].days);
        if(vac>10) break;
        const before=a>0?runs[a-1]:null,after=runs[b+1]||null;
        if(!before||!after) continue; // nur vollständig bekannte Zeiträume
        const span=[...before.days];
        for(let k=a;k<=b+1;k++) span.push(...runs[k].days);
        const holidays=span.filter(x=>x.holiday&&!x.work);
        const workdayHolidays=holidays.filter(x=>{const t=dateFromKey(x.key).getDay();return t>0&&t<6;});
        if(!workdayHolidays.length) continue;
        const total=span.length;
        const ratio=total/vac;
        if(ratio<2&&!(workdayHolidays.length>=2&&ratio>=1.75)) continue;
        out.push({
          from:span[0].key,to:span[span.length-1].key,
          vacFrom:vacDays[0].key,vacTo:vacDays[vacDays.length-1].key,
          vac,total,ratio,
          names:[...new Set(workdayHolidays.map(x=>x.holiday))],
          id:workdayHolidays.map(x=>x.key).join("+")+"/"+vac
        });
      }
    }
  }
  // je Feiertagsgruppe nur die beste Variante
  const best={};
  for(const o of out){
    const g=o.id.split("/")[0];
    const cur=best[g];
    if(!cur||o.ratio>cur.ratio||(o.ratio===cur.ratio&&o.total>cur.total)) best[g]=o;
  }
  return Object.values(best).sort((x,y)=>x.vacFrom<y.vacFrom?-1:1);
}
const BRIDGE_SHORT_NAMES={"1. Weihnachtsfeiertag":"Weihnachten","2. Weihnachtsfeiertag":"Weihnachten","Christi Himmelfahrt":"Himmelfahrt","Heilige Drei Könige":"Hl. 3 Könige","Tag der Deutschen Einheit":"Einheit"};
function bridgeName(n){return BRIDGE_SHORT_NAMES[n]||n;}
function bridgeDate(key){const d=dateFromKey(key);return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.`;}
function bridgeShort(key){const d=dateFromKey(key);return `${weekdayName(d)} ${pad(d.getDate())}.${pad(d.getMonth()+1)}.`;}
function bridgeVacText(o){return o.vac===1?bridgeShort(o.vacFrom):`${bridgeShort(o.vacFrom)} – ${bridgeShort(o.vacTo)}`;}
function bridgeTip(){
  const todayK=localDateKey(new Date());
  const tomorrow=localDateKey(new Date(Date.now()+86400000));
  const dismissed=state.settings.dismissedBridgeTips||[];
  const limit=localDateKey(new Date(Date.now()+90*86400000));
  const opts=bridgeOpportunities(tomorrow,110).filter(o=>o.vacFrom>todayK&&o.vacFrom<=limit&&!dismissed.includes(o.id));
  if(!opts.length) return null;
  // beste Gelegenheit der nächsten 3 Monate (Verhältnis), bei Gleichstand die frühere
  return opts.sort((x,y)=>y.ratio-x.ratio||(x.vacFrom<y.vacFrom?-1:1))[0];
}
function hBridgeTip(){
  if(selectedDate!==localDateKey(new Date())) return "";
  const o=bridgeTip();
  if(!o) return "";
  const vt=`${o.vac} Urlaubstag${o.vac===1?"":"e"}`;
  return `<section class="h-tip">
    <button type="button" class="h-tip-body" data-bridge-book="${o.vacFrom}|${o.vacTo}" aria-label="Urlaub eintragen">
      <span class="h-tip-n">${o.total}<small>Tage frei</small></span>
      <span class="h-tip-main"><b>für ${vt}</b><span>${bridgeDate(o.vacFrom)}${o.vac>1?`–${bridgeDate(o.vacTo)}`:""} · ${escapeHtml(o.names.map(bridgeName).join(" + "))}</span><em>Antippen zum Eintragen ›</em></span>
    </button>
    <button type="button" class="h-tip-x" data-bridge-dismiss="${o.id}" aria-label="Tipp ausblenden">×</button>
  </section>`;
}
function bridgeYearHTML(year){
  const todayK=localDateKey(new Date());
  const startK=year===new Date().getFullYear()?localDateKey(new Date(Date.now()+86400000)):`${year}-01-01`;
  if(`${year}-12-31`<todayK) return "";
  const opts=bridgeOpportunities(localDateKey(new Date(dateFromKey(startK).getTime()-10*86400000)),400)
    .filter(o=>o.vacFrom.startsWith(String(year))&&o.vacFrom>todayK)
    .sort((x,y)=>x.vacFrom<y.vacFrom?-1:1);
  if(!opts.length) return "";
  return `<section class="h-bridge card">
    <div class="h-bridge-head"><span class="h-kicker">Gute Gelegenheiten ${year}</span><small>Brückentage · BW</small></div>
    ${opts.map(o=>`<button type="button" class="h-bridge-row" data-bridge-book="${o.vacFrom}|${o.vacTo}">
      <span class="h-bridge-ratio"><b>${o.total}</b><small>Tage frei</small></span>
      <span class="h-bridge-txt"><b>${escapeHtml(o.names.map(bridgeName).join(" + "))}</b><span>für <strong>${o.vac} Urlaubstag${o.vac===1?"":"e"}</strong>: ${bridgeDate(o.vacFrom)}${o.vac>1?`–${bridgeDate(o.vacTo)}`:""}</span><span>frei von ${bridgeShort(o.from)} bis ${bridgeShort(o.to)}</span></span>
      <span class="h-bridge-go">›</span>
    </button>`).join("")}
  </section>`;
}
function openBulkVacation(fromKey,toKey){
  setBulkType("vacation");
  setBulkDates(dateFromKey(fromKey),dateFromKey(toKey));
  $("bulkNote").value="";
  $("bulkSkipWeekends").checked=true;
  $("bulkSkipHolidays").checked=true;
  $("bulkOverwrite").checked=false;
  updateBulkPreview();
  $("bulkDialog").showModal();
}

/* ── V37 Zeitkonto ──
   Übertrag (Stand laut Abrechnung) + alle Tagessalden ab dem Übertragsdatum.
   Der laufende Tag zählt wie überall erst ab Erreichen des Solls. */
function parseSignedDuration(raw){
  let t=String(raw||"").trim().replace("−","-");
  if(!t) return 0;
  const neg=t.startsWith("-");
  t=t.replace(/^[-+]/,"");
  let min;
  if(t.includes(":")){const [h,m]=t.split(":");min=Number(h||0)*60+Number(m||0);}
  else min=Math.round(Number(t.replace(",","."))*60);
  if(!Number.isFinite(min)) return null;
  return neg?-min:min;
}
function kontoFromKey(){
  if(state.settings.kontoStartDate) return state.settings.kontoStartDate;
  const keys=Object.keys(state.records).sort();
  return keys[0]||localDateKey(new Date());
}
function kontoBalance(){
  const start=Number(state.settings.kontoStartMin)||0;
  const from=dateFromKey(kontoFromKey());
  const today=new Date();
  return start+(from<=today?dateRangeBalance(from,today,true):0);
}
function signedH(min){return `${hSigned(min)} h`;}

/* ── V37 Ebenen über dem Homescreen (Blatt von unten) ── */
function openSheet(html){
  const layer=$("sheetLayer");
  layer.innerHTML=`<div class="h-scrim" data-sheet-close><div class="h-sheet" role="dialog" aria-modal="true"><div class="h-grab"></div>${html}</div></div>`;
  layer.hidden=false;
}
function closeSheet(){const l=$("sheetLayer");l.hidden=true;l.innerHTML="";}
function sheetRows(rows){
  return `<div class="h-rows">${rows.filter(Boolean).map(r=>`<div class="h-row${r.cls?" "+r.cls:""}"><span>${r.l}</span><b class="${r.vc||""}">${r.v}</b></div>`).join("")}</div>`;
}
function sheetDay(){
  const key=selectedDate,rec=normalizeRecord(state.records[key]||{}),c=recordCalc(key,true);
  if(!rec.start){openEdit(key);return;}
  const legal=legalPauseFor(c.target);
  const pauseNote=c.hasActualPause?`${Math.round(c.breakMin)} genommen`:"noch keine";
  openSheet(`<h3>Tagesrechnung</h3>
    ${sheetRows([
      {l:"Beginn",v:rec.start},
      {l:"+ Soll",v:`${hDur(c.target)} h`},
      {l:`+ Pause <small>(${pauseNote}${legal?`, Pflicht ${legal}`:""})</small>`,v:`${Math.round(c.projectedPauseMin||0)} Min`},
      {l:rec.end?"Ende":"= Feierabend",v:rec.end||timeFromMinutes(c.plannedEnd),cls:"total"},
      {l:"Gearbeitet",v:`${hDur(c.worked)} h`},
      {l:rec.end?"Saldo heute":"Stand jetzt",v:signedH(c.balance),vc:c.balance>=0?"pos":"neg"},
      rec.end?null:{l:"10-h-Grenze: spätestens",v:timeFromMinutes(c.latestEnd)}
    ])}
    <button type="button" class="h-btn ghost" data-sheet-edit="${key}">${H_ICON.edit}Tag bearbeiten</button>`);
}
function sheetPause(){
  const key=selectedDate,rec=normalizeRecord(state.records[key]||{}),c=recordCalc(key,true);
  const list=pauseTimeDetails(rec,key);
  const isToday=key===localDateKey(new Date());
  openSheet(`<h3>Pausen</h3>
    ${list.length?sheetRows(list.map(p=>({l:p.type==="fixed"?"ohne Uhrzeit":p.label.replace("–läuft"," – läuft"),v:`${Math.round(p.duration)} Min`}))):`<p>Noch keine Pause erfasst.</p>`}
    ${sheetRows([{l:"Summe",v:`${Math.round(c.breakMin||0)} Min`,cls:"total"},{l:"Gerechnet für Feierabend",v:`${Math.round(c.projectedPauseMin||0)} Min`}])}
    <div class="h-sheet-actions">
      ${isToday&&!rec.end?`<button type="button" class="h-btn primary" data-sheet-pause>${H_ICON.pause}Pause / Schnellpause</button>`:""}
      <button type="button" class="h-btn ghost" data-sheet-edit="${key}">${H_ICON.edit}Pausen bearbeiten</button>
    </div>`);
}
function sheetKonto(){
  const now=new Date(),todayK=localDateKey(now);
  const week=currentWeekBalance(),month=currentMonthBalance(),year=currentYearBalance();
  const startMin=Number(state.settings.kontoStartMin)||0;
  const from=kontoFromKey();
  const todayPart=state.records[todayK]&&effectiveStatus(todayK)==="work"?dayBalanceForSummary(todayK,true):0;
  const total=kontoBalance();
  openSheet(`<h3>Zeitkonto</h3>
    ${sheetRows([
      {l:"Heute",v:todayPart?signedH(todayPart):"zählt ab Soll",vc:todayPart>=0?"pos":"neg"},
      {l:`Woche ${isoWeekNumber(now)}`,v:signedH(week),vc:week>=0?"pos":"neg"},
      {l:monthName(now.getMonth()),v:signedH(month),vc:month>=0?"pos":"neg"},
      {l:`Jahr ${now.getFullYear()}`,v:signedH(year),vc:year>=0?"pos":"neg"},
      {l:`Übertrag <small>ab ${dateShortDE(from)}</small>`,v:signedH(startMin)},
      {l:"Konto gesamt",v:signedH(total),vc:total>=0?"pos":"neg",cls:"total"}
    ])}
    ${startMin||state.settings.kontoStartDate?"":`<p>Tipp: Trag in den Einstellungen den Stand laut Lohnabrechnung als Übertrag ein, dann stimmt das Konto.</p>`}
    <div class="h-sheet-actions two">
      <button type="button" class="h-btn ghost" data-sheet-go="week">Woche ›</button>
      <button type="button" class="h-btn ghost" data-sheet-go="month">Monat ›</button>
    </div>
    ${startMin||state.settings.kontoStartDate?"":`<button type="button" class="h-btn ghost" data-sheet-settings>Übertrag eintragen</button>`}`);
}
function sheetVacation(){
  const now=new Date(),year=now.getFullYear(),todayK=localDateKey(now);
  const ent=Number(state.settings.vacationEntitlement)||0;
  let taken=0,planned=0;
  const d=new Date(year,0,1);
  while(d.getFullYear()===year){
    const k=localDateKey(d);
    if(effectiveStatus(k)==="vacation"&&![0,6].includes(d.getDay())){ if(k<=todayK) taken++; else planned++; }
    d.setDate(d.getDate()+1);
  }
  const v=nextVacation();
  const fmt=k=>bridgeShort(k);
  openSheet(`<h3>Urlaub ${year}</h3>
    ${v?sheetRows([
      {l:"Nächster Urlaub",v:`${fmt(v.from)} – ${fmt(v.to)}`},
      {l:"Urlaubstage",v:`${v.workdays}`},
      {l:"Noch",v:`${v.days} Tage · ${v.workLeft} Arbeitstage`,cls:"total"}
    ]):`<p>Kein Urlaub geplant.</p>`}
    ${sheetRows([
      {l:"Anspruch",v:`${ent}`},
      {l:"Genommen",v:`${taken}`},
      {l:"Geplant",v:`${planned}`},
      {l:"Rest (frei verplanbar)",v:`${ent-taken-planned}`,cls:"total"}
    ])}
    <div class="h-sheet-actions two">
      <button type="button" class="h-btn primary" data-sheet-bulk>＋ Urlaub</button>
      <button type="button" class="h-btn ghost" data-sheet-go="year">Jahr ›</button>
    </div>`);
}
const HOME_SHEETS={day:sheetDay,pause:sheetPause,konto:sheetKonto,vacation:sheetVacation};
function hExtras(){
  return hWeek()+hVacation()+hBridgeTip();
}

function renderTypedDay(key,status){
  const c=recordCalc(key,false),meta=STATUS[status],holiday=bwHolidayName(key);
  const credited=["vacation","specialLeave","sick","holiday","flex"].includes(status);
  const copy=status==="off"?"Keine Sollzeit an diesem Tag.":credited?`${formatHours(c.target)} Soll werden gutgeschrieben.`:"";
  return `<section class="h-start">
    <span class="h-kicker">${meta.label}</span>
    <div class="h-typed-big ${status}">${holiday&&status==="holiday"?escapeHtml(holiday):meta.label}</div>
    ${copy?`<p>${copy}</p>`:""}
    <button class="h-btn ghost" data-edit-day="${key}">${H_ICON.edit}Tag bearbeiten</button>
  </section>${hExtras()}`;
}

function renderDay(){
  const key=selectedDate,status=effectiveStatus(key);
  if(status!=="work"&&status!=="empty") return renderTypedDay(key,status);
  const stored=state.records[key];
  const rec=stored?normalizeRecord(stored):{status:"work",start:"",end:"",pauses:[],targetHours:targetForDate(key)/60,note:""};
  const c=recordCalc(key,true),isToday=key===localDateKey(new Date());

  if(isManualWorkRecord(rec)){
    return `<section class="h-start">
      <span class="h-kicker">Sammelbuchung</span>
      <div class="h-stats">
        <div class="h-stat key"><span>Saldo</span><b class="${c.balance>=0?"pos":"neg"}">${hSigned(c.balance)}<small> h</small></b><em>Tag</em></div>
        <div class="h-stat"><span>Arbeit</span><b>${hDur(c.worked)}<small> h</small></b><em>von ${hDur(c.target)} h</em></div>
        <div class="h-stat"><span>Uhrzeiten</span><b>–</b><em>nicht erfasst</em></div>
      </div>
      <button class="h-btn ghost" data-edit-day="${key}">${H_ICON.edit}Tag bearbeiten</button>
    </section>${hExtras()}`;
  }

  if(!rec.start){
    const planStart=isToday?plannedStartToday():null;
    const ps=plannedStartFor(key);
    const psMin=minutesFromTime(ps);
    const target=targetForDate(key);
    const planEnd=psMin!==null&&target>0?timeFromMinutes(psMin+target+Math.max(Number(state.settings.plannedPauseMin)||0,legalPauseFor(target))):null;
    return `${openPastDayHTML()}<section class="h-start">
      <span class="h-kicker">${isToday?"Noch nicht gestartet":"Kein Eintrag"}</span>
      ${planEnd?`<div class="h-plan"><span>Geplant</span><b>${ps} – ${planEnd}</b></div>`:""}
      ${isToday?`<button class="h-btn primary" id="clockInBtn">${H_ICON.enter}Kommen ${nowTime()}</button>`:""}
      ${planStart?`<button class="h-btn ghost" id="clockInPlanBtn" data-time="${planStart}">Kommen um ${planStart}<small>vergessen zu stempeln</small></button>`:""}
      <button class="h-btn ghost" data-edit-day="${key}">${H_ICON.edit}Manuell eintragen</button>
    </section>${hExtras()}`;
  }

  const pauseActive=!!activePause(rec);
  const now=minutesFromTime(nowTime());
  let chip=`<span class="h-chip run">läuft</span>`;
  // V37 Variante C: Restzeit groß links, Arbeit und Pause als Fortschrittsbalken rechts
  let big={lbl:"Noch",val:hDur(Math.max(0,c.plannedEnd-now)),unit:" h",sub:`bis ${timeFromMinutes(c.plannedEnd)}`,cls:""};
  if(pauseActive) chip=`<span class="h-chip pause">Pause läuft</span>`;
  if(rec.end){
    chip=`<span class="h-chip done">Feierabend</span>`;
    big={lbl:"Saldo",val:hSigned(c.balance),unit:" h",sub:`Ende ${rec.end}`,cls:c.balance>=0?"":"neg"};
  }else if(!isToday){
    chip=`<span class="h-chip warn">Ende fehlt</span>`;
    big={lbl:"Ende",val:"fehlt",unit:"",sub:"bitte nachtragen",cls:"neg"};
  }else if(c.balance>=0){
    if(!pauseActive) chip=`<span class="h-chip run">Plus läuft</span>`;
    big={lbl:"Zeitplus",val:`+${hDur(c.balance)}`,unit:" h",sub:"über Soll",cls:""};
  }
  const ap=activePause(rec);
  const pauseShown=Math.round(c.hasActualPause?c.breakMin:0);
  const pausePlan=Math.max(1,Math.round(c.projectedPauseMin||0));
  const pauseRunning=!!(ap&&isToday);
  const workPct=c.target?clamp(c.worked/c.target*100,0,100):0;
  const pausePct=clamp(pauseShown/pausePlan*100,0,100);
  const done=!isToday||!!rec.end;

  return `${openPastDayHTML()}<section class="h-hero" aria-label="Tag">
    <div class="h-hero-head"><span class="h-kicker">${isToday?"Heute":weekdayName(dateFromKey(key),false)}</span>${chip}</div>
    <div class="h-c">
      <button type="button" class="h-c-big" data-sheet="day" aria-label="Tagesrechnung öffnen"><span>${big.lbl}</span><b class="${big.cls}">${big.val}<small>${big.unit}</small></b><span>${big.sub}</span></button>
      <button type="button" class="h-c-rows" data-sheet="pause" aria-label="Pausen öffnen">
        <div class="h-c-row"><span>Arbeit</span><div class="val">${hDur(c.worked)} h<em>von ${hDur(c.target)}</em></div><div class="h-bar"><i class="lime" style="width:${workPct}%"></i></div></div>
        <div class="h-c-row"><span>Pause</span><div class="val pz">${pauseShown} Min<em>${pauseRunning?`seit ${ap.start}`:`von ${pausePlan}`}</em></div><div class="h-bar"><i class="or${pauseRunning?" run":""}" style="width:${pausePct}%"></i></div></div>
      </button>
    </div>
    <button type="button" class="h-tl-btn" data-edit-day="${key}" aria-label="Tag bearbeiten">${hTimeline(rec,c,key)}</button>
  </section>
  <section class="h-actions">
    <button class="h-btn primary" id="finishDayBtn" ${done?"disabled":""}>${H_ICON.exit}${rec.end?"Erledigt":"Feierabend"}</button>
    <button class="h-btn pause${pauseActive?" active":""}" id="pauseBtn" ${done?"disabled":""}>${pauseActive?H_ICON.play:H_ICON.pause}<span>${pauseActive?"Weiter":"Pause"}</span></button>
    <button class="h-btn" data-edit-day="${key}">${H_ICON.edit}<span>Ändern</span></button>
  </section>
  ${contextualDayHint(key,rec,c)}${hLimitHint(key,rec,c)}${hExtras()}`;
}
function hLimitHint(key,rec,c){
  // 10-h-Grenze ruhig anzeigen, sobald das Soll erreicht ist (die Warnung ab 9:30 h kommt aus contextualDayHint)
  if(key!==localDateKey(new Date())||rec.end||c.balance<0||c.worked>=MAX_WORK_MIN-30) return "";
  return `<div class="h-hint"><i></i><span>10-h-Grenze: spätestens <b>${timeFromMinutes(c.latestEnd)}</b> gehen</span></div>`;
}
function mondayForSelected(offset=0){
  const d=dateFromKey(selectedDate);
  const mon=new Date(d);
  mon.setDate(d.getDate()-dayIndexMon0(d)+offset*7);
  return mon;
}

function weekTimelineHTML(rec,key){
  if(!rec?.start) return "";

  const start=minutesFromTime(rec.start);
  const isToday=key===localDateKey(new Date());
  let end=minutesFromTime(rec.end);

  if(end===null && isToday){
    end=minutesFromTime(nowTime());
  }
  if(start===null || end===null || end<=start) return "";

  const total=end-start;
  const details=pauseTimeDetails(rec,key);

  const segments=details
    .filter(p=>p.type==="timed" && p.start)
    .map(p=>{
      const a=minutesFromTime(p.start);
      let b=minutesFromTime(p.end);
      if(b===null && p.running && isToday) b=minutesFromTime(nowTime());
      if(a===null||b===null||b<=a) return null;

      const left=clamp((Math.max(a,start)-start)/total*100,0,100);
      const right=clamp((Math.min(b,end)-start)/total*100,0,100);
      if(right<=left) return null;

      return {
        left,
        width:right-left,
        start:p.start,
        end:p.end,
        label:p.label,
        running:p.running
      };
    })
    .filter(Boolean);

  const detailHTML=details.length
    ? `<div class="week-pause-times" aria-label="Pausenzeiten">
        ${details.map(p=>`<span class="week-pause-chip${p.running?" running":""}">${p.type==="timed"?"Ⅱ ":""}${p.label}</span>`).join("")}
       </div>`
    : "";

  return `<div class="week-timeline-wrap">
    <div class="week-timeline-track" aria-label="Arbeitszeit von ${rec.start} bis ${rec.end||(isToday?nowTime():"…")}">
      <div class="week-work-fill"></div>
      ${segments.map(s=>`<span class="week-pause-segment${s.running?" running":""}" style="left:${s.left}%;width:${s.width}%"
        title="Pause ${s.label}" aria-label="Pause ${s.label}"></span>`).join("")}
    </div>
    ${detailHTML}
  </div>`;
}

function weekPauseLabel(rec,c){
  if(!rec?.start) return "";
  if(!c.breakMin) return "Pause —";
  return `Pause ${formatCompact(c.breakMin)}`;
}

function renderWeek(){
  const monday=mondayForSelected(weekOffset);
  const days=Array.from({length:7},(_,i)=>{
    const x=new Date(monday);
    x.setDate(monday.getDate()+i);
    return x;
  });

  let worked=0,target=0,balance=0;
  const todayKey=localDateKey(new Date());

  const rows=days.map(d=>{
    const k=localDateKey(d);
    const status=effectiveStatus(k);
    const rec=state.records[k];
    const live=k===todayKey;
    const c=recordCalc(k,live);

    // Wochenziel bleibt die komplette Sollwoche.
    target+=c.target;

    // Ist: nur tatsächlich erfasste/angerechnete Zeit.
    if(recordIsCreditedStatus(status)) worked+=c.worked;
    else if(status==="work" && (rec?.start || isManualWorkRecord(rec))) worked+=c.worked;

    // Saldo folgt derselben Logik wie Homescreen:
    // abgeschlossene Tage vollständig, heute erst positives Plus.
    balance+=dayBalanceForSummary(k,true);

    const label=status==="empty"?"Kein Eintrag":STATUS[status].label;
    const manualWork=status==="work" && isManualWorkRecord(rec);
    const workRow=status==="work" && (rec?.start || manualWork);
    const endDisplay=rec?.end || (live?nowTime():"…");
    const workedLabel=workRow?formatCompact(c.worked):formatCompact(c.target);

    return `<article class="week-item card" data-select-day="${k}">
      <div class="week-date">
        <strong>${weekdayName(d)}</strong>
        <span>${pad(d.getDate())}.${pad(d.getMonth()+1)}</span>
      </div>

      <div class="week-mid">
        <div class="mini-row">
          <span>${label}</span>
          <span>${workedLabel}</span>
        </div>

        ${workRow?`
          ${manualWork?`
            <div class="week-time-meta manual">
              <span>Sammelbuchung</span>
              <span>${formatCompact(c.worked)} Arbeit</span>
            </div>
          `:`
            <div class="week-time-meta">
              <span>${rec.start}–${endDisplay}</span>
              <span>${weekPauseLabel(rec,c)}</span>
            </div>
            ${weekTimelineHTML(rec,k)}
          `}
        `:`
          <div class="week-status-line ${status}"></div>
        `}
      </div>

      <div class="week-right">
        <div class="week-balance ${c.balance>=0?"positive":"negative"}">
          ${status==="work"&&(rec?.end||manualWork)?formatSignedHours(c.balance):status==="work"&&live&&rec?.start&&c.balance>0?formatSignedHours(c.balance):"—"}
        </div>
        <button type="button" class="week-edit-btn" data-edit-week-day="${k}" aria-label="${weekdayName(d,false)} bearbeiten">✎</button>
      </div>
    </article>`;
  }).join("");

  const currentMonday=mondayOfDate(new Date());
  const isCurrentWeek=localDateKey(monday)===localDateKey(currentMonday);

  return `
    <div class="calendar-head">
      <div>
        <div class="muted small">${dateShortDE(localDateKey(days[0]))}–${dateShortDE(localDateKey(days[6]))}</div>
        <h2>KW ${isoWeekNumber(monday)}</h2>
      </div>
      <div class="month-nav"><button id="prevWeek" aria-label="Vorherige Woche">‹</button><button id="nextWeek" aria-label="Nächste Woche">›</button></div>
    </div>

    <section class="month-tools week-tools">
      <button class="month-secondary" id="openWeekPlannerBtn">Woche planen</button>
      <button class="month-secondary${isCurrentWeek?" is-current":""}" id="thisWeekBtn" ${isCurrentWeek?"disabled":""}>${isCurrentWeek?"Aktuelle Woche ✓":"Aktuelle Woche"}</button>
    </section>

    <section class="summary-grid">
      <article class="summary-card card"><span>Ist</span><strong>${formatHours(worked)}</strong></article>
      <article class="summary-card card"><span>Wochenziel</span><strong>${formatHours(target)}</strong></article>
      <article class="summary-card card"><span>Saldo</span><strong class="${balance>=0?"positive":"negative"}">${formatSignedHours(balance)}</strong></article>
    </section>

    <section class="week-list">${rows}</section>
  `;
}

function monthStats(year,month){
  const last=new Date(year,month+1,0).getDate();
  const todayKey=localDateKey(new Date());
  const stats={worked:0,target:0,balance:0,vacation:0,specialLeave:0,sick:0,holiday:0,flex:0,off:0};

  for(let d=1;d<=last;d++){
    const key=localDateKey(new Date(year,month,d));
    const s=effectiveStatus(key);

    // Status-Zähler zeigen auch bereits geplante zukünftige Urlaubstage.
    if(stats[s]!==undefined && s!=="work" && s!=="empty") stats[s]++;

    // Zeit-Summen nur bis heute. Für vergangene Monate damit automatisch vollständig.
    if(key>todayKey) continue;

    const rec=state.records[key];
    const c=recordCalc(key,key===todayKey);

    if(recordIsCreditedStatus(s)){
      stats.worked+=c.worked;
      stats.target+=c.target;
      continue;
    }
    if(s==="off") continue;

    if(s==="work" && (rec?.end || isManualWorkRecord(rec))){
      stats.worked+=c.worked;
      stats.target+=c.target;
      stats.balance+=c.balance;
    }else if(s==="work" && key===todayKey && rec?.start){
      // Heute: für Ist live mitzählen, Saldo aber erst ab Soll positiv.
      stats.worked+=c.worked;
      stats.target+=c.target;
      stats.balance+=Math.max(0,c.balance);
    }
  }
  return stats;
}
function renderMonth(){
  const y=monthCursor.getFullYear(),m=monthCursor.getMonth();
  const stats=monthStats(y,m);
  const holidays=holidaysForMonth(y,m);
  const first=new Date(y,m,1),lastDay=new Date(y,m+1,0).getDate();
  const offset=dayIndexMon0(first);
  let cells="";
  for(let i=0;i<offset;i++) cells+=`<div class="calendar-day empty"></div>`;

  for(let d=1;d<=lastDay;d++){
    const dt=new Date(y,m,d),k=localDateKey(dt),rec=state.records[k],c=recordCalc(k,k===localDateKey(new Date()));
    const status=effectiveStatus(k);
    const autoHoliday=status==="holiday"&&!rec&&bwHolidayName(k);
    const multiSelected=monthSelectedDates.has(k);
    const cls=[
      status!=="empty"?status:"",
      autoHoliday?"autoHoliday":"",
      k===localDateKey(new Date())?"today":"",
      !monthSelectMode&&k===selectedDate?"selected":"",
      multiSelected?"multi-selected":"",
      monthSelectMode?"selectable":""
    ].join(" ");

    let small="";
    if(status==="work"&&rec) small=formatCompact(c.worked);
    else if(status==="holiday") small="Feiertag";
    else if(status!=="empty") small=STATUS[status].label;

    const aria=bwHolidayName(k)?` aria-label="${escapeHtml(bwHolidayName(k))}" title="${escapeHtml(bwHolidayName(k))}"`:"";
    cells+=`<button class="calendar-day ${cls}" data-select-day="${k}"${aria}>
      <span class="num">${d}</span><span class="dot"></span>
      <span class="day-work">${small}</span>
      ${multiSelected?'<span class="multi-check">✓</span>':""}
    </button>`;
  }

  const selectedStatus=effectiveStatus(selectedDate);
  const selectedCalc=recordCalc(selectedDate,selectedDate===localDateKey(new Date()));
  const selectedRec=state.records[selectedDate],sd=dateFromKey(selectedDate);

  const selectionPanel=monthSelectMode?selectionPanelHTML():"";

  const holidayBlock = state.settings.autoHolidaysBW
    ? `<section class="month-holiday-list card">
        <h3>Feiertage ${monthName(m)}</h3>
        ${holidays.length
          ? holidays.map(h=>`<div class="month-holiday-row"><span>${dateShortDE(h.key)}</span><span>${escapeHtml(h.name)}</span></div>`).join("")
          : `<div class="holiday-empty">Keine gesetzlichen Feiertage in diesem Monat.</div>`}
      </section>`
    : `<section class="month-holiday-list card"><div class="holiday-empty">Automatische Feiertage sind in den Einstellungen ausgeschaltet.</div></section>`;

  return `
    <div class="calendar-head">
      <h2>${monthName(m)} ${y}</h2>
      <div class="month-nav"><button id="prevMonth">‹</button><button id="nextMonth">›</button></div>
    </div>

    <section class="month-tools">
      <button class="month-plan-btn" id="openBulkBtn">＋ Zeitraum</button>
      <button class="month-secondary ${monthSelectMode?"active":""}" id="monthSelectBtn">${monthSelectMode?"Fertig":"Auswählen"}</button>
      <button class="month-secondary" id="todayMonthBtn">Heute</button>
    </section>

    <section class="summary-grid">
      <article class="summary-card card"><span>Ist bis heute</span><strong>${formatHours(stats.worked)}</strong></article>
      <article class="summary-card card"><span>Soll bis heute</span><strong>${formatHours(stats.target)}</strong></article>
      <article class="summary-card card"><span>Saldo</span><strong class="${stats.balance>=0?"positive":"negative"}">${formatSignedHours(stats.balance)}</strong></article>
    </section>

    <section class="month-status-summary card">
      <span class="status-count vacation">🏖 U ${stats.vacation}</span>
      <span class="status-count specialLeave">🌴 SU ${stats.specialLeave}</span>
      <span class="status-count sick">✚ K ${stats.sick}</span>
      <span class="status-count flex">↻ FZA ${stats.flex}</span>
      <span class="status-count holiday">◆ FT ${stats.holiday}</span>
    </section>

    <section class="calendar card">
      <div class="weekdays"><div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div></div>
      <div class="calendar-grid">${cells}</div>
    </section>

    ${selectionPanel}
    ${holidayBlock}

    ${monthSelectMode?"":`<section class="month-detail card">
      <h3>${pad(sd.getDate())}.${pad(sd.getMonth()+1)}.${sd.getFullYear()}</h3>
      <div class="detail-row"><span>Status</span><strong>${selectedStatus==="empty"?"Kein Eintrag":STATUS[selectedStatus].label}</strong></div>
      ${bwHolidayName(selectedDate)?`<div class="detail-row"><span>Feiertag</span><strong class="holiday-label">${escapeHtml(bwHolidayName(selectedDate))}</strong></div>`:""}
      <div class="detail-row"><span>Ist</span><strong>${formatHours(selectedCalc.worked)}</strong></div>
      <div class="detail-row"><span>Soll</span><strong>${formatHours(selectedCalc.target)}</strong></div>
      <div class="detail-row"><span>Saldo</span><strong class="${selectedCalc.balance>=0?"positive":"negative"}">${formatSignedHours(selectedCalc.balance)}</strong></div>
      ${selectedRec?.note?`<div class="detail-row"><span>Notiz</span><strong>${escapeHtml(selectedRec.note)}</strong></div>`:""}
      <button class="ghost-btn full" data-edit-day="${selectedDate}" style="margin-top:12px">Tag bearbeiten / Eintrag löschen</button>
    </section>`}
  `;
}

function selectionPanelHTML(){
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
}
function yearMonthCalendar(year,month){
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstOffset=dayIndexMon0(new Date(year,month,1));
  const total=firstOffset+daysInMonth;
  const gridCells=Math.ceil(total/7)*7;
  let days="";

  for(let i=0;i<gridCells;i++){
    const day=i-firstOffset+1;
    if(day<1||day>daysInMonth){
      days+=`<span class="year-day empty"></span>`;
      continue;
    }

    const dt=new Date(year,month,day);
    const key=localDateKey(dt);
    const status=effectiveStatus(key);
    const rec=state.records[key];
    const weekend=[0,6].includes(dt.getDay());
    const today=key===localDateKey(new Date());

    let cls="year-day";
    if(status==="work" && (rec?.end || isManualWorkRecord(rec))) cls+=" work";
    else if(status==="vacation") cls+=" vacation";
    else if(status==="specialLeave") cls+=" specialLeave";
    else if(status==="sick") cls+=" sick";
    else if(status==="holiday") cls+=" holiday";
    else if(status==="flex") cls+=" flex";
    else if(status==="off") cls+=" off";
    else if(weekend) cls+=" weekend";

    if(today) cls+=" today";
    const title=bwHolidayName(key)||STATUS[status]?.label||"";
    if(monthSelectMode){
      const picked=monthSelectedDates.has(key);
      days+=`<button type="button" class="${cls} pickable${picked?" picked":""}" data-year-pick="${key}" title="${escapeHtml(title)}" aria-pressed="${picked}">${day}</button>`;
    }else{
      days+=`<span class="${cls}" title="${escapeHtml(title)}">${day}</span>`;
    }
  }

  const isCurrent=year===new Date().getFullYear()&&month===new Date().getMonth();
  const mName=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][month];
  if(monthSelectMode){
    return `<article class="year-month-card selecting${isCurrent?" current":""}">
    <div class="year-month-title"><span>${mName}</span></div>
    <div class="year-weekdays"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div>
    <div class="year-days">${days}</div>
  </article>`;
  }
  return `<article class="year-month-card${isCurrent?" current":""}" data-open-month="${month}" data-open-year="${year}"
                   role="button" tabindex="0" aria-label="${mName} ${year} öffnen">
    <div class="year-month-title">
      <span>${["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"][month]}</span>
      <span class="month-open-mark">›</span>
    </div>
    <div class="year-weekdays"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div>
    <div class="year-days">${days}</div>
  </article>`;
}

function renderYear(){
  const year=yearCursor;
  let totalWorked=0,totalTarget=0,totalBalance=0;
  for(let m=0;m<12;m++){
    const s=monthStats(year,m);
    totalWorked+=s.worked;
    totalTarget+=s.target;
    totalBalance+=s.balance;
  }

  const used=statusCountForYear(year,"vacation");
  const special=statusCountForYear(year,"specialLeave");
  const sick=statusCountForYear(year,"sick");
  const flex=statusCountForYear(year,"flex");
  const ent=Number(state.settings.vacationEntitlement)||0;
  const rest=Math.max(0,ent-used);
  const vacationPct=ent?clamp(used/ent*100,0,100):0;
  const holidays=holidaysForYear(year);

  const months=Array.from({length:12},(_,m)=>yearMonthCalendar(year,m)).join("");

  const holidayList=state.settings.autoHolidaysBW
    ? `<section class="holiday-list card">
        <h3>Feiertage ${year}</h3>
        ${holidays.length
          ? holidays.map(h=>`<div class="holiday-row"><div class="holiday-date">${dateShortDE(h.key)}</div><div class="holiday-name">${escapeHtml(h.name)}</div></div>`).join("")
          : `<div class="holiday-empty">Keine Feiertage gefunden.</div>`}
      </section>`
    : `<section class="holiday-list card"><div class="holiday-empty">Automatische Feiertage sind in den Einstellungen ausgeschaltet.</div></section>`;

  return `
    <div class="year-head">
      <div>
        <div class="muted small">12-Monats-Kalender</div>
        <h2>${year}</h2>
      </div>
      <div class="arrows">
        <button id="prevYear">‹</button>
        <button id="nextYear">›</button>
      </div>
    </div>

    <section class="month-tools">
      <button class="month-plan-btn" id="openBulkBtn">＋ Zeitraum</button>
      <button class="month-secondary ${monthSelectMode?"active":""}" id="monthSelectBtn">${monthSelectMode?"Fertig":"Auswählen"}</button>
      <button class="month-secondary" id="thisYearBtn" ${year===new Date().getFullYear()?"disabled":""}>Dieses Jahr</button>
    </section>

    <div class="year-calendar-title">
      <h3>12 Monate</h3>
      <span class="year-subtle-label">${monthSelectMode?"Tage antippen zum Auswählen":"Monat antippen zum Öffnen"}</span>
    </div>

    <section class="year-calendar${monthSelectMode?" selecting":""}">${months}</section>
    ${monthSelectMode?selectionPanelHTML():""}



    <section class="year-legend card">
      <span class="legend-item"><i class="legend-dot work"></i>Arbeit</span>
      <span class="legend-item"><i class="legend-dot vacation"></i>Urlaub</span>
      <span class="legend-item"><i class="legend-dot specialLeave"></i>Sonderurlaub</span>
      <span class="legend-item"><i class="legend-dot sick"></i>Krank</span>
      <span class="legend-item"><i class="legend-dot holiday"></i>Feiertag</span>
      <span class="legend-item"><i class="legend-dot flex"></i>FZA</span>
    </section>

    <section class="vacation-card card">
      <div class="vacation-top"><span>Urlaubskonto ${year}</span><strong>${used} / ${ent}</strong></div>
      <div class="vacation-bar"><i style="width:${vacationPct}%"></i></div>
      <div class="vacation-meta"><span>${used} genommen</span><span>${rest} Rest</span></div>
      <div class="special-note">🌴 Sonderurlaub: <strong>${special}</strong> · ✚ Krank: <strong>${sick}</strong> · ↻ FZA: <strong>${flex}</strong></div>
    </section>
    ${bridgeYearHTML(year)}

    <section class="summary-grid">
      <article class="summary-card card"><span>Ist</span><strong>${formatHours(totalWorked)}</strong></article>
      <article class="summary-card card"><span>Soll bis heute</span><strong>${formatHours(totalTarget)}</strong></article>
      <article class="summary-card card"><span>Saldo</span><strong class="${totalBalance>=0?"positive":"negative"}">${formatSignedHours(totalBalance)}</strong></article>
    </section>

    ${holidayList}
  `;
}
function render(){
  setHeader();
  $("appContent").innerHTML=currentView==="day"?renderDay():currentView==="week"?renderWeek():currentView==="month"?renderMonth():renderYear();
  bindDynamic();
}
function updateNav(){
  document.querySelectorAll(".nav-item").forEach(btn=>{
    const active=btn.dataset.view===currentView;
    btn.classList.toggle("active",active);
    if(active) btn.setAttribute("aria-current","page");
    else btn.removeAttribute("aria-current");
  });
}


function recordHasValues(key){
  const rec=state.records[key];
  if(!rec) return false;
  return !!(
    rec.start || rec.end ||
    isManualWorkRecord(rec) ||
    (rec.pauses||[]).length ||
    rec.note ||
    (rec.status && rec.status!=="work")
  );
}
function describeExistingDay(key){
  const rec=state.records[key];
  if(!rec) return "";
  const parts=[];
  if(rec.status && rec.status!=="work") parts.push(STATUS[rec.status]?.label||rec.status);
  if(isManualWorkRecord(rec)) parts.push(`Arbeit ${formatCompact(rec.manualWorkedMinutes)} · Sammelbuchung`);
  if(rec.start) parts.push(`Beginn ${rec.start}`);
  if(rec.end) parts.push(`Ende ${rec.end}`);
  if((rec.pauses||[]).length) parts.push(`${pauseMinutes(rec,false,key)} Min Pause`);
  return parts.join(" · ");
}
/* V37: eigene Bestätigung statt Browser-Fenster – funktioniert auch in
   eingebetteten Ansichten, in denen der Browser diese Fenster blockiert. */
function askConfirm(message,{ok="Ja",cancel="Abbrechen",danger=false}={}){
  return new Promise(resolve=>{
    const d=$("confirmDialog");
    $("confirmText").textContent=message;
    const okBtn=$("confirmOk"),noBtn=$("confirmCancel");
    okBtn.textContent=ok;noBtn.textContent=cancel;
    okBtn.className=danger?"danger-btn":"primary-small";
    noBtn.hidden=!cancel;
    const done=v=>{okBtn.onclick=noBtn.onclick=null;d.onclose=null;if(d.open)d.close();resolve(v);};
    okBtn.onclick=()=>done(true);
    noBtn.onclick=()=>done(false);
    d.onclose=()=>done(false);
    d.showModal();
  });
}
function notify(message){ return askConfirm(message,{ok:"OK",cancel:""}); }
function confirmOverwriteDay(key,newStatus){
  if(!recordHasValues(key)) return Promise.resolve(true);
  const d=dateFromKey(key);
  const old=describeExistingDay(key) || "vorhandene Werte";
  const neu=STATUS[newStatus]?.label||newStatus;
  return askConfirm(
    `Für ${weekdayName(d,false)}, ${pad(d.getDate())}.${pad(d.getMonth()+1)}. sind bereits Werte gespeichert:\n\n${old}\n\nMöchtest du diese Werte wirklich mit „${neu}“ überschreiben?`,{ok:"Überschreiben"}
  );
}
function confirmClearDay(key){
  const d=dateFromKey(key);
  if(!state.records[key]){
    if(bwHolidayName(key)){
      toast("Kein manueller Eintrag – der Feiertag bleibt automatisch sichtbar");
    }else{
      toast("Für diesen Tag gibt es keinen gespeicherten Eintrag");
    }
    return Promise.resolve(false);
  }
  const old=describeExistingDay(key) || "gespeicherter Eintrag";
  return askConfirm(
    `Möchtest du den Eintrag für ${weekdayName(d,false)}, ${pad(d.getDate())}.${pad(d.getMonth()+1)}. wirklich vollständig zurücksetzen?\n\n${old}\n\nDanach steht der Tag wieder auf „Kein Eintrag“.`,{ok:"Zurücksetzen",danger:true}
  );
}

function getQuickPausePresets(){
  return (state.settings.quickPausePresets||[])
    .slice(0,4)
    .map(v=>Math.max(0,Number(v)||0))
    .filter(v=>v>0);
}

function quickPauseButtonMarkup(min,attr="data-live-quick-pause"){
  return `<button type="button" class="quick-pause-btn" ${attr}="${min}">${min} Min</button>`;
}

function renderLivePauseDialog(){
  const key=localDateKey(new Date());
  const rec=ensureRecord(key);
  if(isManualWorkRecord(rec)) delete rec.manualWorkedMinutes;
  const ap=activePause(rec);
  const grid=$("liveQuickPauseGrid");
  const presets=getQuickPausePresets();

  $("toggleLivePauseBtn").textContent=ap?"Pause jetzt beenden":"Pause jetzt starten";
  $("pauseDialogHint").textContent=ap
    ? `Pause läuft seit ${ap.start}.`
    : "Pause live starten oder eine feste Dauer direkt buchen.";

  if(ap){
    grid.innerHTML='<div class="live-pause-running">Schnellpausen sind während einer laufenden Pause ausgeblendet.</div>';
  }else if(presets.length){
    grid.innerHTML=presets.map(min=>quickPauseButtonMarkup(min)).join("");
  }else{
    grid.innerHTML='<div class="live-pause-running">Keine Schnellpausen eingerichtet.</div>';
  }

  grid.querySelectorAll("[data-live-quick-pause]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      bookLiveQuickPause(Number(btn.dataset.liveQuickPause));
    });
  });
}

function rangesOverlap(a1,a2,b1,b2){
  return a1<b2 && b1<a2;
}

function bookLiveQuickPause(min){
  min=Math.max(1,Number(min)||0);
  if(!min) return;

  const key=localDateKey(new Date());
  const rec=ensureRecord(key);
  if(activePause(rec,key)){
    toast("Laufende Pause zuerst beenden");
    return;
  }

  const start=nowTime();
  const startMin=minutesFromTime(start);
  const endMin=startMin+min;
  const workStart=minutesFromTime(rec.start);

  if(endMin>=1440){
    notify("Eine Schnellpause über Mitternacht wird aktuell nicht unterstützt.");
    return;
  }
  if(workStart!=null && startMin<workStart){
    notify("Die Schnellpause kann nicht vor deinem Arbeitsbeginn starten.");
    return;
  }

  const conflicts=(rec.pauses||[]).some(p=>{
    if(!p.start || !p.end) return false;
    const a=minutesFromTime(p.start),b=minutesFromTime(p.end);
    return a!=null && b!=null && rangesOverlap(startMin,endMin,a,b);
  });
  if(conflicts){
    notify("Diese Schnellpause würde sich mit einer bereits erfassten Pause überschneiden.");
    return;
  }

  const end=timeFromMinutes(endMin);
  rec.pauses.push({start,end,autoEnd:true});
  save();
  $("pauseDialog").close();
  render();
  toast(`${min} Min Schnellpause · ${start}–${end}`);
}


function toggleMonthSelection(){
  monthSelectMode=!monthSelectMode;
  if(!monthSelectMode) monthSelectedDates.clear();
  render();
}
function toggleMonthSelectedDate(key){
  if(monthSelectedDates.has(key)) monthSelectedDates.delete(key);
  else monthSelectedDates.add(key);
  render();
}
async function applyMonthSelection(status){
  const keys=[...monthSelectedDates].sort();
  if(!keys.length){
    toast("Bitte zuerst Tage auswählen");
    return;
  }

  if(status==="clear"){
    const manual=keys.filter(k=>state.records[k]);
    if(!manual.length){
      toast("Kein manueller Eintrag in der Auswahl");
      return;
    }
    if(!(await askConfirm(`${manual.length} gespeicherte${manual.length===1?"r Eintrag":" Einträge"} wirklich auf „Kein Eintrag“ zurücksetzen?`,{ok:"Zurücksetzen",danger:true}))) return;
    manual.forEach(k=>delete state.records[k]);
    save();
    monthSelectedDates.clear();
    monthSelectMode=false;
    render();
    toast(`${manual.length} Tag${manual.length===1?"":"e"} zurückgesetzt`);
    return;
  }

  const existing=keys.filter(k=>state.records[k]);
  const holidays=keys.filter(k=>!state.records[k] && !!bwHolidayName(k));
  if(existing.length || holidays.length){
    const details=[
      existing.length?`${existing.length} vorhandene Einträge`:"",
      holidays.length?`${holidays.length} automatische Feiertage`:""
    ].filter(Boolean).join(" und ");
    if(!(await askConfirm(`${details} werden mit „${STATUS[status].label}“ überschrieben. Fortfahren?`,{ok:"Überschreiben"}))) return;
  }

  keys.forEach(key=>{
    const rec=ensureRecord(key);
    rec.status=status;
    rec.start="";
    rec.end="";
    rec.pauses=[];
    delete rec.manualWorkedMinutes;
  });
  save();
  monthSelectedDates.clear();
  monthSelectMode=false;
  render();
  toast(`${keys.length} Tag${keys.length===1?"":"e"} als ${STATUS[status].label} gespeichert`);
}

/* V36: Pixel-Messanzeige für Layoutprüfung */
function updatePixelMeter(){
  const el=$("pixelMeter");
  if(!el) return;
  const on=state.settings.pixelMeter!==false;
  el.hidden=!on;
  if(!on) return;
  const vv=window.visualViewport;
  el.textContent=`${window.innerWidth}×${window.innerHeight}`+(vv?` · vv ${Math.round(vv.width)}×${Math.round(vv.height)}`:"")+" · Demo";
}
window.addEventListener("resize",updatePixelMeter);
window.visualViewport?.addEventListener("resize",updatePixelMeter);

function bindDynamic(){
  document.querySelectorAll("[data-goto-view]").forEach(el=>el.addEventListener("click",()=>{
    currentView=el.dataset.gotoView;
    if(currentView==="year") yearCursor=new Date().getFullYear();
    updateNav();render();window.scrollTo(0,0);
  }));

  document.querySelectorAll("[data-bridge-book]").forEach(el=>el.addEventListener("click",()=>{
    const [from,to]=el.dataset.bridgeBook.split("|");
    openBulkVacation(from,to);
  }));
  document.querySelectorAll("[data-bridge-dismiss]").forEach(el=>el.addEventListener("click",()=>{
    const list=state.settings.dismissedBridgeTips||[];
    list.push(el.dataset.bridgeDismiss);
    state.settings.dismissedBridgeTips=list.slice(-40);
    save();render();toast("Tipp ausgeblendet");
  }));

  document.querySelectorAll("[data-year-pick]").forEach(el=>el.addEventListener("click",()=>toggleMonthSelectedDate(el.dataset.yearPick)));
  const ty=$("thisYearBtn");
  if(ty) ty.addEventListener("click",()=>{yearCursor=new Date().getFullYear();render();});

  document.querySelectorAll("[data-sheet]").forEach(el=>el.addEventListener("click",e=>{
    e.stopPropagation();
    HOME_SHEETS[el.dataset.sheet]?.();
  }));

  const plannerBtn=$("openWeekPlannerBtn");
  if(plannerBtn) plannerBtn.addEventListener("click",openWeekPlanner);

  const saldoBtn=$("saldoSwitch");
  if(saldoBtn){
    saldoBtn.addEventListener("click",()=>{
      saldoScope=nextSaldoScope(saldoScope);
      localStorage.setItem("arbeitszeit-saldo-scope",saldoScope);
      render();
    });
  }

  document.querySelectorAll("[data-select-day]").forEach(el=>el.addEventListener("click",()=>{
    const key=el.dataset.selectDay;
    if(currentView==="month" && monthSelectMode){
      toggleMonthSelectedDate(key);
      return;
    }
    selectedDate=key;
    const d=dateFromKey(selectedDate);
    monthCursor=new Date(d.getFullYear(),d.getMonth(),1);
    if(currentView==="week") currentView="day";
    updateNav();render();
  }));

  document.querySelectorAll("[data-edit-day]").forEach(el=>el.addEventListener("click",()=>openEdit(el.dataset.editDay)));

  document.querySelectorAll("[data-edit-week-day]").forEach(el=>el.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();
    openEdit(el.dataset.editWeekDay);
  }));

  document.querySelectorAll("[data-toggle-daytypes]").forEach(btn=>btn.addEventListener("click",()=>{
    const panel=btn.parentElement.querySelector("[data-daytype-panel]");
    btn.classList.toggle("open");
    panel.classList.toggle("open");
  }));

  document.querySelectorAll("[data-set-status]").forEach(el=>el.addEventListener("click",async()=>{
    const [key,status]=el.dataset.setStatus.split("|");
    const current=effectiveStatus(key);
    if(current===status){
      toast(`${STATUS[status].label} ist bereits ausgewählt`);
      return;
    }
    if(!(await confirmOverwriteDay(key,status))) return;

    const rec=ensureRecord(key);
    rec.status=status;
    if(status!=="work"){
      rec.start="";
      rec.end="";
      rec.pauses=[];
      delete rec.manualWorkedMinutes;
    }
    save();
    render();
    toast(`${STATUS[status].label} gespeichert`);
  }));

  document.querySelectorAll("[data-clear-day]").forEach(el=>el.addEventListener("click",async()=>{
    const key=el.dataset.clearDay;
    if(!(await confirmClearDay(key))) return;
    delete state.records[key];
    save();
    render();
    toast("Eintrag zurückgesetzt – Kein Eintrag");
  }));

  const clockInAt=time=>{
    const key=localDateKey(new Date());
    undoableRecordChange(key,`Beginn ${time}`,()=>{
      const rec=ensureRecord(key);
      rec.status="work";delete rec.manualWorkedMinutes;rec.start=time;rec.end="";rec.pauses=[];
    });
  };
  const clockIn=$("clockInBtn");
  if(clockIn) clockIn.addEventListener("click",()=>clockInAt(nowTime()));
  const clockInPlan=$("clockInPlanBtn");
  if(clockInPlan) clockInPlan.addEventListener("click",()=>clockInAt(clockInPlan.dataset.time));

  const finish=$("finishDayBtn");
  if(finish) finish.addEventListener("click",()=>{
    const key=localDateKey(new Date());
    const end=nowTime();
    undoableRecordChange(key,`Feierabend ${end}`,()=>{
      const rec=ensureRecord(key);
      const ap=activePause(rec);
      if(ap){ ap.end=end; delete ap.autoEnd; }
      rec.end=end;
    });
  });


  const pause=$("pauseBtn");
  if(pause) pause.addEventListener("click",()=>{
    const key=localDateKey(new Date());
    const rec=ensureRecord(key);
    const ap=activePause(rec);

    // "Weiter" ist eine eindeutige Aktion und beendet eine laufende Pause
    // direkt. Nur beim Start bleibt der Dialog für Live- oder Schnellpause.
    if(ap){
      ap.end=nowTime();
      delete ap.autoEnd;
      const mins=pauseMinutes({pauses:[ap]},false,key);
      save();
      render();
      toast(`Pause beendet${mins?` · ${mins} Min`:""}`);
      return;
    }

    renderLivePauseDialog();
    $("pauseDialog").showModal();
  });

  const pw=$("prevWeek"),nw=$("nextWeek"),tw=$("thisWeekBtn");
  if(pw) pw.addEventListener("click",()=>{weekOffset--;render()});
  if(nw) nw.addEventListener("click",()=>{weekOffset++;render()});
  if(tw) tw.addEventListener("click",()=>{
    const now=new Date();
    selectedDate=localDateKey(now);
    weekOffset=0;
    render();
  });

  const pm=$("prevMonth"),nm=$("nextMonth");
  if(pm) pm.addEventListener("click",()=>{
    monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()-1,1);
    selectedDate=localDateKey(monthCursor);
    monthSelectedDates.clear();
    render();
  });
  if(nm) nm.addEventListener("click",()=>{
    monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,1);
    selectedDate=localDateKey(monthCursor);
    monthSelectedDates.clear();
    render();
  });

  const py=$("prevYear"),ny=$("nextYear");
  if(py) py.addEventListener("click",()=>{yearCursor--;render()});
  if(ny) ny.addEventListener("click",()=>{yearCursor++;render()});

  const bulk=$("openBulkBtn");
  if(bulk) bulk.addEventListener("click",()=>openBulkForMonth());

  const monthSelect=$("monthSelectBtn");
  if(monthSelect) monthSelect.addEventListener("click",toggleMonthSelection);

  const clearSelection=$("clearMonthSelection");
  if(clearSelection) clearSelection.addEventListener("click",()=>{
    monthSelectedDates.clear();
    render();
  });

  document.querySelectorAll("[data-month-apply]").forEach(btn=>btn.addEventListener("click",()=>{
    applyMonthSelection(btn.dataset.monthApply);
  }));
  const tm=$("todayMonthBtn");
  if(tm) tm.addEventListener("click",()=>{
    const d=new Date();
    selectedDate=localDateKey(d);monthCursor=new Date(d.getFullYear(),d.getMonth(),1);render();
  });

  document.querySelectorAll("[data-open-month]").forEach(el=>{
    const openMonth=()=>{
      const m=Number(el.dataset.openMonth);
      const y=Number(el.dataset.openYear||yearCursor);
      monthCursor=new Date(y,m,1);
      selectedDate=localDateKey(new Date(y,m,1));
      currentView="month";
      updateNav();
      render();
    };
    el.addEventListener("click",openMonth);
    el.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){
        e.preventDefault();
        openMonth();
      }
    });
  });
}

/* ── Edit dialog / multiple pauses ── */

function captureEditOrigin(){
  editOrigin={
    view:currentView,
    selectedDate,
    weekOffset,
    monthCursor:new Date(monthCursor),
    yearCursor,
    scrollY:window.scrollY
  };
}
function renderBackToEditOrigin(message){
  const origin=editOrigin;
  if(origin){
    currentView=origin.view;
    selectedDate=origin.selectedDate;
    weekOffset=origin.weekOffset;
    monthCursor=new Date(origin.monthCursor);
    yearCursor=origin.yearCursor;
  }
  editOrigin=null;
  updateNav();
  render();
  if(origin && origin.view!=="day"){
    requestAnimationFrame(()=>window.scrollTo({top:origin.scrollY,behavior:"auto"}));
  }
  if(message) toast(message);
}

function parseSmartPauseInput(raw){
  const original=String(raw||"").trim();
  if(!original) return null;

  let s=original.toLowerCase().replace(/\s+/g,"").replace(",",".");
  let minutes=null;
  let mode="";

  const colon=s.match(/^(\d{1,2}):([0-5]\d)$/);
  if(colon){
    minutes=Number(colon[1])*60+Number(colon[2]);
    mode="clock";
  }else if(/^[-+]?\d+(?:\.\d+)?(?:min|m)$/.test(s)){
    const n=Number(s.replace(/(?:min|m)$/,""));
    minutes=Math.round(n);
    mode="minutes";
  }else if(/^[-+]?\d+(?:\.\d+)?h$/.test(s)){
    const n=Number(s.slice(0,-1));
    minutes=Math.round(n*60);
    mode="hours";
  }else if(/^\d+$/.test(s)){
    minutes=Number(s);
    mode="minutes";
  }else if(/^\d*\.\d+$/.test(s)){
    minutes=Math.round(Number(s)*60);
    mode="decimal";
  }

  if(!Number.isFinite(minutes) || minutes<=0 || minutes>720) return {error:true,original};

  return {minutes,mode,original};
}
function smartPauseHuman(minutes){
  minutes=Math.round(minutes);
  if(minutes<60) return `${minutes} Min`;
  const h=Math.floor(minutes/60),m=minutes%60;
  return m?`${h} h ${m} Min`:`${h} h`;
}
function updateSmartPausePreview(){
  const input=$("smartPauseInput");
  const preview=$("smartPausePreview");
  if(!input||!preview) return;

  const raw=input.value.trim();
  if(!raw){
    preview.className="smart-pause-preview";
    preview.textContent="Minuten eingeben, z. B. 15. Auch 1:30 funktioniert.";
    return;
  }

  const parsed=parseSmartPauseInput(raw);
  if(!parsed || parsed.error){
    preview.className="smart-pause-preview invalid";
    preview.textContent="Nicht erkannt. Beispiele: 15 · 1:30 · 0,25 · 1,5h";
    return;
  }

  preview.className="smart-pause-preview valid";
  preview.textContent=`${raw} → ${smartPauseHuman(parsed.minutes)}`;
}
function addSmartPause(){
  const input=$("smartPauseInput");
  const parsed=parseSmartPauseInput(input?.value);
  if(!parsed || parsed.error){
    updateSmartPausePreview();
    return;
  }
  editPauses.push({start:"",end:"",minutes:parsed.minutes});
  input.value="";
  updateSmartPausePreview();
  renderPauseEditor();
  toast(`${smartPauseHuman(parsed.minutes)} Pause hinzugefügt`);
}

function renderPauseEditor(){
  const box=$("pauseRows");
  const quick=$("editQuickPauseButtons");
  const presets=getQuickPausePresets();

  quick.innerHTML=presets.map(min=>quickPauseButtonMarkup(min,"data-edit-quick-pause")).join("");
  quick.querySelectorAll("[data-edit-quick-pause]").forEach(btn=>btn.addEventListener("click",()=>{
    editPauses.push({start:"",end:"",minutes:Number(btn.dataset.editQuickPause)});
    renderPauseEditor();
  }));

  if(!editPauses.length){
    box.innerHTML='<div class="no-pauses">Keine Pause eingetragen.</div>';
    return;
  }

  box.innerHTML=editPauses.map((p,i)=>{
    const fixed=Math.max(0,Number(p.minutes)||0);
    if(fixed>0 && !p.start){
      return `<div class="pause-edit-row fixed-pause-row">
        <div class="fixed-pause-label"><span>⚡</span><strong>${fixed} Min</strong><small>Schnellpause</small></div>
        <button type="button" class="pause-delete" data-delete-pause="${i}">×</button>
      </div>`;
    }
    return `<div class="pause-edit-row">
      <input type="time" value="${p.start||""}" data-pause-start="${i}">
      <span class="pause-sep">–</span>
      <input type="time" value="${p.end||""}" data-pause-end="${i}">
      <button type="button" class="pause-delete" data-delete-pause="${i}">×</button>
    </div>`;
  }).join("");

  box.querySelectorAll("[data-pause-start]").forEach(el=>el.addEventListener("change",()=>{
    const i=Number(el.dataset.pauseStart);
    editPauses[i].start=el.value;
    delete editPauses[i].minutes;
  }));
  box.querySelectorAll("[data-pause-end]").forEach(el=>el.addEventListener("change",()=>{
    const i=Number(el.dataset.pauseEnd);
    editPauses[i].end=el.value;
    delete editPauses[i].minutes;
  }));
  box.querySelectorAll("[data-delete-pause]").forEach(el=>el.addEventListener("click",()=>{
    editPauses.splice(Number(el.dataset.deletePause),1);
    renderPauseEditor();
  }));
}
function clearEditValidation(){
  const box=$("editValidation");
  if(!box) return;
  box.hidden=true;
  box.textContent="";
}
function showEditValidation(message,focusId=""){
  const box=$("editValidation");
  if(box){
    box.hidden=false;
    box.textContent=message;
  }
  if(focusId) requestAnimationFrame(()=>$(focusId)?.focus());
}
function validateWorkEditDraft(){
  const start=$("editStart").value;
  const end=$("editEnd").value;
  const manualRaw=$("editManualWorked").value.trim();
  const manualParsed=parseWorkDurationInput(manualRaw);

  if(manualRaw && (start || end)){
    return {message:"Bitte entweder Beginn/Ende oder die direkte Arbeitsdauer verwenden – nicht beides.",focusId:"editManualWorked"};
  }
  if(manualRaw && (!manualParsed || manualParsed.error)){
    return {message:"Die direkte Arbeitsdauer wurde nicht erkannt. Beispiele: 8 · 8,25 · 8:15 · 480m.",focusId:"editManualWorked"};
  }
  if(end && !start){
    return {message:"Für eine Endzeit wird auch ein Arbeitsbeginn benötigt.",focusId:"editStart"};
  }

  const startMin=minutesFromTime(start);
  const endMin=minutesFromTime(end);
  if(startMin!==null && endMin!==null && endMin<=startMin){
    return {message:"Die Endzeit muss nach dem Arbeitsbeginn liegen. Schichten über Mitternacht werden aktuell nicht unterstützt.",focusId:"editEnd"};
  }

  const pauseEntries=editPauses.filter(p=>p.start || p.end || Number(p.minutes)>0);
  if(manualRaw && pauseEntries.length){
    return {message:"Bei direkt eingetragener Arbeitsdauer bitte keine zusätzlichen Pausen erfassen. Die direkte Dauer ist bereits die Netto-Arbeitszeit.",focusId:"editManualWorked"};
  }

  const timed=[];
  let openPauseCount=0;
  const todayKey=localDateKey(new Date());

  for(let i=0;i<pauseEntries.length;i++){
    const p=pauseEntries[i];
    const fixed=Math.max(0,Number(p.minutes)||0);
    if(fixed>0 && !p.start && !p.end) continue;

    if(!p.start && p.end){
      return {message:`Pause ${i+1}: Bitte eine Startzeit ergänzen.`,focusId:""};
    }
    if(!p.start) continue;
    if(startMin===null){
      return {message:"Für eine Pause mit Uhrzeit wird zuerst ein Arbeitsbeginn benötigt.",focusId:"editStart"};
    }

    const a=minutesFromTime(p.start);
    const b=minutesFromTime(p.end);
    if(a===null) continue;
    if(a<startMin){
      return {message:`Pause ${i+1} beginnt vor dem Arbeitsbeginn.`,focusId:""};
    }

    if(b===null){
      openPauseCount++;
      if(editDateKey!==todayKey || end){
        return {message:`Pause ${i+1} hat keine Endzeit. Eine laufende Pause ist nur für den heutigen, noch offenen Arbeitstag möglich.`,focusId:""};
      }
      timed.push({start:a,end:Infinity,index:i});
      continue;
    }

    if(b<=a){
      return {message:`Pause ${i+1}: Die Endzeit muss nach dem Pausenbeginn liegen.`,focusId:""};
    }
    if(endMin!==null && b>endMin){
      return {message:`Pause ${i+1} endet nach dem Feierabend.`,focusId:""};
    }
    timed.push({start:a,end:b,index:i});
  }

  if(openPauseCount>1){
    return {message:"Es kann nur eine laufende Pause gleichzeitig geben.",focusId:""};
  }

  timed.sort((a,b)=>a.start-b.start);
  for(let i=1;i<timed.length;i++){
    if(timed[i].start<timed[i-1].end){
      return {message:`Pause ${timed[i].index+1} überschneidet sich mit einer anderen Pause.`,focusId:""};
    }
  }

  return null;
}

function openEdit(key){
  captureEditOrigin();
  editDateKey=key;
  const existing=state.records[key];
  const rec=existing ? normalizeRecord({...existing,pauses:(existing.pauses||[]).map(p=>({...p}))}) : {
    status:bwHolidayName(key)?"holiday":"work",
    start:"",end:"",pauses:[],targetHours:targetForDate(key)/60,note:""
  };
  const d=dateFromKey(key);
  $("editDateLabel").textContent=`${weekdayName(d,false)}, ${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
  $("editStatus").value=existing ? (rec.status||"work") : (bwHolidayName(key)?"holiday":"work");
  $("editStart").value=rec.start||"";
  $("editEnd").value=rec.end||"";
  $("editManualWorked").value=workDurationInputValue(rec);
  $("editAdvanced").open=isManualWorkRecord(rec);
  $("editManualWorkedHint").textContent=isManualWorkRecord(rec)
    ? "Sammelbuchung: Du kannst die Dauer ändern oder stattdessen Beginn/Ende eintragen."
    : "Nur für Nachträge ohne Beginn und Ende.";
  $("editTarget").value=typeof rec.targetHours==="number"?rec.targetHours:targetForDate(key)/60;
  $("editNote").value=rec.note||"";
  editPauses=(rec.pauses||[]).map(p=>{
    const fixed=Math.max(0,Number(p.minutes)||0);
    return fixed>0 && !p.start ? {start:"",end:"",minutes:fixed} : {start:p.start||"",end:p.end||""};
  });
  toggleWorkFields();renderPauseEditor();
  clearEditValidation();
  $("smartPauseInput").value="";
  updateSmartPausePreview();
  $("editDialog").showModal();
}
function toggleWorkFields(){
  const status=$("editStatus").value;
  $("workFields").style.display=status==="work"?"block":"none";
  const note=$("editNote").closest("label");
  if(note) note.style.display=status==="clear"?"none":"grid";
  let hint=$("clearEntryHint");
  if(status==="clear"){
    if(!hint){
      hint=document.createElement("div");
      hint.id="clearEntryHint";
      hint.className="clear-hint";
      hint.textContent="Der gespeicherte Eintrag dieses Tages wird vollständig entfernt. Danach steht der Tag wieder auf „Kein Eintrag“. Gesetzliche Feiertage bleiben als Feiertag sichtbar.";
      $("workFields").parentElement.insertBefore(hint,note);
    }
  }else if(hint){
    hint.remove();
  }
}
$("editStatus").addEventListener("change",()=>{toggleWorkFields();clearEditValidation();});
$("addPauseRowBtn").addEventListener("click",()=>{
  editPauses.push({start:"",end:""});renderPauseEditor();
});

$("editManualWorked").addEventListener("input",()=>{
  const raw=$("editManualWorked").value.trim();
  const hint=$("editManualWorkedHint");
  if(!raw){
    hint.className="manual-work-hint";
    hint.textContent="Nur für Nachträge ohne Beginn und Ende.";
    return;
  }
  const parsed=parseWorkDurationInput(raw);
  if(!parsed || parsed.error){
    hint.className="manual-work-hint invalid";
    hint.textContent="Nicht erkannt. Beispiele: 8 · 8,25 · 8:15 · 480m";
    return;
  }
  hint.className="manual-work-hint valid";
  hint.textContent=`${raw} → ${formatCompact(parsed.minutes)} Arbeitszeit`;
});

$("smartPauseInput").addEventListener("input",updateSmartPausePreview);
$("smartPauseInput").addEventListener("keydown",e=>{
  if(e.key==="Enter"){
    e.preventDefault();
    addSmartPause();
  }
});
$("addSmartPauseBtn").addEventListener("click",addSmartPause);

$("toggleLivePauseBtn").addEventListener("click",()=>{
  const key=localDateKey(new Date());
  const rec=ensureRecord(key);
  if(isManualWorkRecord(rec)) delete rec.manualWorkedMinutes;
  if(!rec.start) rec.start=nowTime();

  const ap=activePause(rec);
  let message="Pause gestartet";
  if(ap){
    ap.end=nowTime();
    delete ap.autoEnd;
    const mins=pauseMinutes({pauses:[ap]},false,key);
    message=`Pause beendet${mins?` · ${mins} Min`:""}`;
  }else{
    rec.pauses.push({start:nowTime(),end:""});
  }

  save();
  $("pauseDialog").close();
  render();
  toast(message);
});
$("editForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const status=$("editStatus").value;

  if(status==="clear"){
    if(!state.records[editDateKey]){
      $("editDialog").close();
      renderBackToEditOrigin(
        bwHolidayName(editDateKey)
          ? "Kein manueller Eintrag – Feiertag bleibt sichtbar"
          : "Für diesen Tag war kein Eintrag gespeichert"
      );
      return;
    }
    if(!(await confirmClearDay(editDateKey))) return;
    delete state.records[editDateKey];
    save();
    $("editDialog").close();
    renderBackToEditOrigin("Eintrag zurückgesetzt – Kein Eintrag");
    return;
  }

  if(status==="work"){
    const validation=validateWorkEditDraft();
    if(validation){
      showEditValidation(validation.message,validation.focusId);
      return;
    }
  }
  clearEditValidation();

  const rec=ensureRecord(editDateKey);
  rec.status=status;
  rec.note=$("editNote").value.trim();
  rec.targetHours=Number($("editTarget").value||targetForDate(editDateKey)/60);
  if(rec.status==="work"){
    const start=$("editStart").value;
    const end=$("editEnd").value;
    const manualRaw=$("editManualWorked").value.trim();
    const manualParsed=parseWorkDurationInput(manualRaw);

    if(!start && !end && manualRaw){
      if(!manualParsed || manualParsed.error){
        toast("Arbeitszeit direkt nicht erkannt");
        return;
      }
      rec.start="";
      rec.end="";
      rec.pauses=[];
      rec.manualWorkedMinutes=manualParsed.minutes;
      rec.manualSource=rec.manualSource||"manual";
    }else{
      delete rec.manualWorkedMinutes;
      delete rec.manualSource;
      rec.start=start;
      rec.end=end;
      rec.pauses=editPauses
        .filter(p=>p.start || Number(p.minutes)>0)
        .map(p=>{
          const fixed=Math.max(0,Number(p.minutes)||0);
          return fixed>0 && !p.start ? {minutes:fixed} : {start:p.start,end:p.end||""};
        });
    }
  }else{
    rec.start="";rec.end="";rec.pauses=[];
    delete rec.manualWorkedMinutes;
    delete rec.manualSource;
  }
  save();
  $("editDialog").close();
  renderBackToEditOrigin("Tag gespeichert");
});

$("plannerFridayEnd").addEventListener("input",()=>{plannerFridayPauseTouched=false;updateWeekPlannerPreview();});
$("plannerFridayPause").addEventListener("input",()=>{plannerFridayPauseTouched=true;updateWeekPlannerPreview();});
$("plannerDistribution").addEventListener("change",updateWeekPlannerPreview);
$("weekPlannerForm").addEventListener("submit",e=>{
  e.preventDefault();
  const plan=readWeekPlannerDraft();
  if(!plan.fridayEnd){toast("Bitte Freitag-Zielzeit wählen");return;}
  plannerWeekKey=plannerWeekKey||currentPlannerWeekKey();
  state.weekPlans[plannerWeekKey]=plan;
  save();
  $("weekPlannerDialog").close();
  render();
  toast(`Freitag ${plan.fridayEnd} geplant`);
});
$("deleteWeekPlanBtn").addEventListener("click",()=>{
  const key=plannerWeekKey||currentPlannerWeekKey();
  if(!state.weekPlans[key]) return;
  delete state.weekPlans[key];save();$("weekPlannerDialog").close();render();toast("Wochenplan gelöscht");
});

document.querySelectorAll("[data-close]").forEach(btn=>btn.addEventListener("click",()=>$(btn.dataset.close).close()));

/* ── Bulk / Monatsplanung ── */
function setBulkType(type){
  bulkType=type;
  document.querySelectorAll("[data-bulk-type]").forEach(btn=>btn.classList.toggle("active",btn.dataset.bulkType===type));
  const hint=$("bulkWorkHint");
  if(hint) hint.hidden=type!=="work";
  updateBulkPreview();
}
document.querySelectorAll("[data-bulk-type]").forEach(btn=>btn.addEventListener("click",()=>setBulkType(btn.dataset.bulkType)));

function mondayOf(d){
  const x=new Date(d);x.setDate(x.getDate()-dayIndexMon0(x));return x;
}
function setBulkDates(from,to){
  $("bulkFrom").value=localDateKey(from);
  $("bulkTo").value=localDateKey(to);
  updateBulkPreview();
}
function openBulkForMonth(){
  const y=monthCursor.getFullYear(),m=monthCursor.getMonth();
  setBulkType("vacation");
  setBulkDates(new Date(y,m,1),new Date(y,m+1,0));
  $("bulkNote").value="";
  $("bulkSkipWeekends").checked=true;
  $("bulkSkipHolidays").checked=true;
  $("bulkOverwrite").checked=false;
  updateBulkPreview();
  $("bulkDialog").showModal();
}
document.querySelectorAll("[data-range-preset]").forEach(btn=>btn.addEventListener("click",()=>{
  const p=btn.dataset.rangePreset;
  if(p==="month"){
    setBulkDates(new Date(monthCursor.getFullYear(),monthCursor.getMonth(),1),new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,0));
  }else{
    const base=p==="nextweek"?new Date(Date.now()+7*86400000):new Date();
    const mon=mondayOf(base),fri=new Date(mon);fri.setDate(mon.getDate()+4);
    setBulkDates(mon,fri);
  }
}));
["bulkFrom","bulkTo","bulkSkipWeekends","bulkSkipHolidays","bulkOverwrite"].forEach(id=>$(id).addEventListener("change",updateBulkPreview));

function bulkDatesInfo(){
  const from=$("bulkFrom").value,to=$("bulkTo").value;
  if(!from||!to||from>to){
    return {valid:false,eligible:[],existing:0,skippedWeekend:0,skippedHoliday:0,skippedFuture:0,skippedNoTarget:0,totalWork:0};
  }

  const eligible=[];
  let existing=0,skippedWeekend=0,skippedHoliday=0,skippedFuture=0,skippedNoTarget=0,totalWork=0;
  const todayKey=localDateKey(new Date());
  let d=dateFromKey(from),end=dateFromKey(to);

  while(d<=end){
    const k=localDateKey(d);
    const weekend=[0,6].includes(d.getDay());
    const holiday=!!bwHolidayName(k);

    if($("bulkSkipWeekends").checked && weekend){
      skippedWeekend++;d.setDate(d.getDate()+1);continue;
    }
    if($("bulkSkipHolidays").checked && holiday){
      skippedHoliday++;d.setDate(d.getDate()+1);continue;
    }

    if(bulkType==="work"){
      if(k>todayKey){
        skippedFuture++;d.setDate(d.getDate()+1);continue;
      }
      const target=targetForDate(k);
      if(target<=0){
        skippedNoTarget++;d.setDate(d.getDate()+1);continue;
      }
      eligible.push(k);
      totalWork+=target;
    }else{
      eligible.push(k);
    }

    if(state.records[k]) existing++;
    d.setDate(d.getDate()+1);
  }

  return {valid:true,eligible,existing,skippedWeekend,skippedHoliday,skippedFuture,skippedNoTarget,totalWork};
}

function updateBulkPreview(){
  const info=bulkDatesInfo(),box=$("bulkPreview");
  if(!info.valid){
    box.innerHTML="Bitte einen gültigen Zeitraum auswählen.";
    return;
  }

  const overwrite=$("bulkOverwrite").checked;
  const writeKeys=overwrite?info.eligible:info.eligible.filter(k=>!state.records[k]);
  const willWrite=writeKeys.length;

  if(bulkType==="work"){
    const writeTotal=writeKeys.reduce((sum,k)=>sum+targetForDate(k),0);
    box.innerHTML=`
      <strong>${willWrite} Arbeitstag${willWrite===1?"":"e"}</strong> werden als Sammelbuchung eingetragen.<br>
      Arbeitszeit gesamt: <strong>${formatHours(writeTotal)}</strong>.<br>
      <span class="bulk-work-copy">Pro Tag wird die hinterlegte Sollzeit übernommen. Beginn und Ende bleiben leer.</span><br>
      ${info.skippedWeekend?`${info.skippedWeekend} Wochenendtag${info.skippedWeekend===1?"":"e"} übersprungen. `:""}
      ${info.skippedHoliday?`${info.skippedHoliday} Feiertag${info.skippedHoliday===1?"":"e"} übersprungen. `:""}
      ${info.skippedFuture?`${info.skippedFuture} zukünftige${info.skippedFuture===1?"r Arbeitstag":" Arbeitstage"} nicht als Ist-Zeit gebucht. `:""}
      ${info.skippedNoTarget?`${info.skippedNoTarget} Tag${info.skippedNoTarget===1?"":"e"} ohne Sollzeit übersprungen. `:""}
      ${info.existing?`<span class="warn">${info.existing} vorhandene Einträge ${overwrite?"werden überschrieben":"bleiben unverändert"}.</span>`:""}
    `;
    return;
  }

  box.innerHTML=`
    <strong>${willWrite} Tag${willWrite===1?"":"e"}</strong> werden als <strong>${STATUS[bulkType].label}</strong> eingetragen.<br>
    ${info.skippedWeekend?`${info.skippedWeekend} Wochenendtag${info.skippedWeekend===1?"":"e"} übersprungen. `:""}
    ${info.skippedHoliday?`${info.skippedHoliday} Feiertag${info.skippedHoliday===1?"":"e"} übersprungen. `:""}
    ${info.existing?`<span class="warn">${info.existing} vorhandene Einträge ${overwrite?"werden überschrieben":"bleiben unverändert"}.</span>`:""}
  `;
}

$("saveBulkBtn").addEventListener("click",async()=>{
  const info=bulkDatesInfo();
  if(!info.valid) return;

  const overwrite=$("bulkOverwrite").checked;
  const note=$("bulkNote").value.trim();
  const writeKeys=overwrite?info.eligible:info.eligible.filter(k=>!state.records[k]);

  if(!writeKeys.length){
    toast("Keine Tage zum Eintragen");
    return;
  }

  if(overwrite && info.existing){
    const label=bulkType==="work"?"Arbeit als Sammelbuchung":STATUS[bulkType].label;
    if(!(await askConfirm(`${info.existing} vorhandene Einträge werden mit „${label}“ überschrieben. Fortfahren?`,{ok:"Überschreiben"}))) return;
  }

  let saved=0;
  for(const key of writeKeys){
    const targetMin=targetForDate(key);
    const rec=ensureRecord(key);
    rec.status=bulkType;
    rec.note=note;
    rec.targetHours=targetMin/60;

    if(bulkType==="work"){
      rec.start="";
      rec.end="";
      rec.pauses=[];
      rec.manualWorkedMinutes=targetMin;
      rec.manualSource="bulk";
    }else{
      rec.start="";
      rec.end="";
      rec.pauses=[];
      delete rec.manualWorkedMinutes;
      delete rec.manualSource;
    }
    saved++;
  }

  save();
  $("bulkDialog").close();
  render();
  toast(
    bulkType==="work"
      ? `${saved} Arbeitstag${saved===1?"":"e"} als Sollzeit verbucht`
      : `${saved} Tag${saved===1?"":"e"} eingetragen`
  );
});

/* ── Settings ── */
const HOME_WIDGET_META={
  saldo:{label:"Saldo",sub:"Woche / Monat / Jahr",icon:"Σ"},
  friday:{label:"Freitags-Prognose",sub:"Wochenziel & frühes Gehen",icon:"⌁"},
  statuses:{label:"Abwesenheit",sub:"Urlaub, Krank, FZA …",icon:"○"},
  week:{label:"Wochenleiste",sub:"Mo bis So",icon:"7"},
  note:{label:"Notiz",sub:"nur wenn vorhanden",icon:"✎"}
};
function renderHomeLayoutSettings(){
  $("homeLayoutList").innerHTML=FIXED_HOME_ORDER.map(id=>{
    const m=HOME_WIDGET_META[id],on=state.settings.homeWidgets[id]!==false;
    return `<div class="home-layout-item">
      <span class="home-layout-icon">${m.icon}</span>
      <label class="home-layout-copy"><b>${m.label}</b><small>${m.sub}</small></label>
      <input type="checkbox" class="home-layout-check" data-home-toggle="${id}" ${on?"checked":""}>
    </div>`;
  }).join("");
}

function settingsWorkSummary(){
  const vals=(state.settings.weekdayTargets||[]).map(Number);
  const active=vals.filter(v=>v>0);
  const unique=[...new Set(active.map(v=>String(v)))];
  if(!active.length) return "keine Sollzeit";
  if(unique.length===1) return `${active.length} Tage · ${unique[0].replace(".",",")} h`;
  return `${active.length} Tage · individuell`;
}
function settingsPauseSummary(){
  const p=Math.max(0,Number(state.settings.plannedPauseMin)||0);
  const quick=(state.settings.quickPausePresets||[]).filter(v=>Number(v)>0).length;
  return `${p} Min geplant · ${quick} Schnellpausen`;
}
function settingsCalendarSummary(){
  const vac=Number(state.settings.vacationEntitlement)||0;
  return `${String(vac).replace(".",",")} Tage · Feiertage ${state.settings.autoHolidaysBW?"an":"aus"}`;
}
function settingsHomeSummary(){
  const extras=FIXED_HOME_ORDER.filter(id=>state.settings.homeWidgets[id]!==false).length;
  return `Motiv ${state.settings.homeWidgets.image!==false?"an":"aus"} · ${extras} Zusatzinfos`;
}
function updateSettingsSummaries(){
  if($("settingsSummaryWork")) $("settingsSummaryWork").textContent=settingsWorkSummary();
  if($("settingsSummaryPause")) $("settingsSummaryPause").textContent=settingsPauseSummary();
  if($("settingsSummaryCalendar")) $("settingsSummaryCalendar").textContent=settingsCalendarSummary();
  if($("settingsSummaryHome")) $("settingsSummaryHome").textContent=settingsHomeSummary();
}
function buildSettings(){
  const names=["Mo","Di","Mi","Do","Fr","Sa","So"];
  $("weekdayTargets").innerHTML=names.map((n,i)=>`<label>${n}<input type="number" min="0" max="16" step="0.25" id="wd${i}" value="${state.settings.weekdayTargets[i]}"></label>`).join("");
  const startNames=["Mo","Di","Mi","Do","Fr"];
  $("weekdayStarts").innerHTML=startNames.map((n,i)=>`<label>${n}<input type="time" id="ws${i}" value="${state.settings.weekdayStartTimes?.[i]||"06:35"}"></label>`).join("");
  $("quickPauseSettings").innerHTML=Array.from({length:4},(_,i)=>`
    <label>Pause ${i+1} (Min)
      <input type="number" min="0" max="180" step="5" id="qp${i}" value="${state.settings.quickPausePresets?.[i]??0}">
    </label>
  `).join("");
  $("kontoStartInput").value=state.settings.kontoStartMin?hSigned(state.settings.kontoStartMin):"";
  $("kontoStartDate").value=state.settings.kontoStartDate||"";
  $("plannedPauseInput").value=state.settings.plannedPauseMin;
  $("vacationEntitlementInput").value=state.settings.vacationEntitlement;
  $("breakReminder").checked=!!state.settings.breakReminder;
  $("pixelMeterToggle").checked=state.settings.pixelMeter!==false;
  $("autoHolidaysBW").checked=!!state.settings.autoHolidaysBW;
  $("demoSeed").checked=!!state.settings.demoSeed;
  $("homeImageToggle").checked=state.settings.homeWidgets.image!==false;
  renderHomeLayoutSettings();
  updateSettingsSummaries();
}
$("headerDate").addEventListener("click",()=>{
  selectedDate=localDateKey(new Date());
  const d=new Date();monthCursor=new Date(d.getFullYear(),d.getMonth(),1);weekOffset=0;
  render();
});
$("settingsBtn").addEventListener("click",()=>{
  buildSettings();
  document.querySelectorAll("#settingsDialog details.settings-accordion").forEach((d,i)=>d.open=i===0);
  $("settingsDialog").showModal();
});
$("resetHomeLayoutBtn").addEventListener("click",()=>{
  state.settings.homeWidgets={...defaultSettings.homeWidgets,timeline:true};
  state.settings.homeOrder=[...FIXED_HOME_ORDER];
  $("homeImageToggle").checked=defaultSettings.homeWidgets.image;
  renderHomeLayoutSettings();
  updateSettingsSummaries();
  toast("Standard-Homescreen gewählt");
});
$("saveSettingsBtn").addEventListener("click",()=>{
  const ks=parseSignedDuration($("kontoStartInput").value);
  if(ks===null){toast("Übertrag nicht lesbar – z. B. 23:07 oder -2:30");return;}
  state.settings.kontoStartMin=ks;state.settings.kontoStartDate=$("kontoStartDate").value||"";state.settings.weekdayTargets=Array.from({length:7},(_,i)=>Number($(`wd${i}`).value||0));state.settings.weekdayStartTimes=[$("ws0").value||"06:35",$("ws1").value||"06:35",$("ws2").value||"06:35",$("ws3").value||"06:35",$("ws4").value||"06:35","",""];state.settings.quickPausePresets=Array.from({length:4},(_,i)=>Math.max(0,Number($(`qp${i}`).value||0)));
  state.settings.plannedPauseMin=Number($("plannedPauseInput").value||0);state.settings.vacationEntitlement=Number($("vacationEntitlementInput").value||0);state.settings.breakReminder=$("breakReminder").checked;state.settings.autoHolidaysBW=$("autoHolidaysBW").checked;state.settings.demoSeed=$("demoSeed").checked;state.settings.pixelMeter=$("pixelMeterToggle").checked;updatePixelMeter();state.settings.homeWidgets.image=$("homeImageToggle").checked;document.querySelectorAll("[data-home-toggle]").forEach(ch=>state.settings.homeWidgets[ch.dataset.homeToggle]=ch.checked);state.settings.homeWidgets.timeline=true;state.settings.homeOrder=[...FIXED_HOME_ORDER];state.settings.homeLayoutVersion=4;Object.keys(holidayCache).forEach(k=>delete holidayCache[k]);save();$("settingsDialog").close();render();toast("Einstellungen gespeichert")});



document.querySelectorAll("#settingsDialog details.settings-accordion").forEach(section=>{
  section.addEventListener("toggle",()=>{
    if(!section.open) return;
    document.querySelectorAll("#settingsDialog details.settings-accordion").forEach(other=>{
      if(other!==section) other.open=false;
    });
  });
});

/* ── Export / import ── */
function downloadBlob(name,content,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}
$("exportJsonBtn").addEventListener("click",()=>{
  downloadBlob(`arbeitszeit-backup-${localDateKey(new Date())}.json`,JSON.stringify(state,null,2),"application/json");
  toast("JSON exportiert");
});
function csvDecimalHours(min){
  return (Math.round(min||0)/60).toFixed(2).replace(".",",");
}
$("exportCsvBtn").addEventListener("click",()=>{
  const rows=[[
    "Datum","Status","Beginn","Ende","Pausen",
    "Pause_min","Pause_h_dezimal",
    "Soll_h_dezimal","Ist_h_dezimal","Saldo_h_dezimal","Erfassung","Notiz"
  ]];

  Object.keys(state.records).sort().forEach(k=>{
    const r=state.records[k],c=recordCalc(k,false);
    const pauseMin=pauseMinutes(r,false,k);
    const pauses=(r.pauses||[])
      .map(p=>Number(p.minutes)>0&&!p.start?`${p.minutes} Min`:`${p.start}-${p.end}`)
      .join(" | ");

    rows.push([
      k,
      STATUS[r.status]?.label||r.status,
      r.start||"",
      r.end||"",
      pauses,
      pauseMin,
      csvDecimalHours(pauseMin),
      csvDecimalHours(c.target),
      csvDecimalHours(c.worked),
      csvDecimalHours(c.balance),
      isManualWorkRecord(r)?"Sammelbuchung":"Zeitstempel",
      (r.note||"").replaceAll('"','""')
    ]);
  });

  const csv=rows.map(row=>row.map(v=>`"${String(v)}"`).join(";")).join("\n");
  downloadBlob(`arbeitszeit-${localDateKey(new Date())}.csv`,csv,"text/csv;charset=utf-8");
  toast("CSV exportiert · Dezimalstunden");
});
$("importInput").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file) return;
  try{
    const parsed=JSON.parse(await file.text());
    if(!parsed.records||!parsed.settings) throw new Error("invalid");
    state=parsed;state.settings={...freshDefaultSettings(),...state.settings};
    state.weekPlans=state.weekPlans && typeof state.weekPlans==="object" ? state.weekPlans : {};
    delete state.settings.durationFormat;
    state.settings.quickPausePresets=Array.isArray(state.settings.quickPausePresets)
      ? state.settings.quickPausePresets.slice(0,4).map(v=>Math.max(0,Number(v)||0))
      : [...defaultSettings.quickPausePresets];
    while(state.settings.quickPausePresets.length<4) state.settings.quickPausePresets.push(0);
    state.settings.homeWidgets={...defaultSettings.homeWidgets,...(state.settings.homeWidgets||{}),timeline:true};
    state.settings.homeOrder=[...FIXED_HOME_ORDER];
    state.settings.homeLayoutVersion=4;
    Object.values(state.records).forEach(normalizeRecord);
    save();$("settingsDialog").close();render();toast("Backup importiert");
  }catch{toast("Import fehlgeschlagen")}
});
$("resetAllBtn").addEventListener("click",async()=>{
  if(await askConfirm("Wirklich alle gespeicherten Arbeitszeitdaten löschen? Das lässt sich nicht rückgängig machen.",{ok:"Alles löschen",danger:true})){
    state={settings:{...freshDefaultSettings(),demoSeed:false},records:{},weekPlans:{}};
    save();$("settingsDialog").close();render();toast("Alle Daten gelöscht");
  }
});

/* ── Navigation ── */
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{
  if(btn.dataset.view!==currentView){monthSelectMode=false;monthSelectedDates.clear();}
  currentView=btn.dataset.view;
  weekOffset=0;
  if(currentView==="month"){
    const d=dateFromKey(selectedDate);
    monthCursor=new Date(d.getFullYear(),d.getMonth(),1);
  }
  if(currentView==="year"){
    yearCursor=dateFromKey(selectedDate).getFullYear();
  }
  updateNav();render();
}));

/* Demo data only on completely new installation */
const todayKey=localDateKey(new Date());
if(state.settings.demoSeed && Object.keys(state.records).length===0){
  state.records[todayKey]={
    status:"work",start:"06:35",end:"",
    pauses:[{start:"13:36",end:"14:06"}],
    targetHours:8,note:""
  };
  const d=new Date();
  for(let i=1;i<=3;i++){
    const x=new Date(d);x.setDate(d.getDate()-i);
    if(dayIndexMon0(x)<5){
      const k=localDateKey(x);
      state.records[k]={status:"work",start:"06:40",end:"15:20",pauses:[{start:"12:25",end:"12:55"}],targetHours:8,note:""};
    }
  }
  save();
}

/* ── V37 Demo-Modus ──
   Spielt Tageszustände mit simulierter Uhrzeit durch. Arbeitet auf einer Kopie,
   save() ist abgeschaltet. „Beenden“ lädt die echten Daten neu. */
const DEMO_SCENARIOS={
  pre:{label:"Vor Beginn",now:"06:20",today:null},
  late:{label:"Vergessen zu stempeln",now:"06:50",today:null},
  run:{label:"Läuft",now:"11:20",today:{start:"06:35",pauses:[["09:00","09:15"]]}},
  pause:{label:"Pause läuft",now:"12:15",today:{start:"06:35",pauses:[["09:00","09:15"],["12:00",""]]}},
  over:{label:"Soll erreicht",now:"15:35",today:{start:"06:35",pauses:[["09:00","09:15"],["12:00","12:20"]]}},
  limit:{label:"10-h-Grenze naht",now:"16:50",today:{start:"06:35",pauses:[["09:00","09:15"],["12:00","12:20"]]}},
  done:{label:"Feierabend",now:"15:40",today:{start:"06:35",end:"15:30",pauses:[["09:00","09:15"],["12:00","12:20"]]}},
  mine:{label:"Meine Daten",now:null,today:"mine"}
};
function demoBuildState(scen){
  const real=migrateState();
  if(scen==="mine") return JSON.parse(JSON.stringify(real));
  const st={settings:JSON.parse(JSON.stringify(real.settings||freshDefaultSettings())),records:{},weekPlans:{}};
  const today=new Date();today.setHours(12,0,0,0);
  const todayK=localDateKey(today);
  const mon=mondayOfDate(today);
  const starts=["06:30","06:35","06:40","06:30"],ends=["15:20","15:20","15:20","15:10"];
  for(let i=0;i<4;i++){
    const d=new Date(mon);d.setDate(mon.getDate()+i);
    const k=localDateKey(d);
    if(k>=todayK) break;
    st.records[k]={status:"work",start:starts[i],end:ends[i],pauses:[{start:"09:00",end:"09:15"},{start:"12:00",end:"12:15"}],note:""};
  }
  // Urlaub in gut zwei Wochen, damit Countdown und Wochenzeile etwas zeigen
  const v=new Date(today);v.setDate(v.getDate()+14);
  while(v.getDay()!==1) v.setDate(v.getDate()+1);
  for(let i=0;i<5;i++){const d=new Date(v);d.setDate(v.getDate()+i);st.records[localDateKey(d)]={status:"vacation",start:"",end:"",pauses:[],note:""};}
  if(!st.settings.kontoStartMin){st.settings.kontoStartMin=23*60+7;st.settings.kontoStartDate=localDateKey(mon);}
  const t=DEMO_SCENARIOS[scen].today;
  if(t) st.records[todayK]={status:"work",start:t.start,end:t.end||"",pauses:t.pauses.map(([a,b])=>({start:a,end:b})),targetHours:8,note:""};
  return st;
}
function demoStart(scen){
  const def=DEMO_SCENARIOS[scen];
  const realNow=new Date();
  demo={scen,nowMin:def.now?minutesFromTime(def.now):realNow.getHours()*60+realNow.getMinutes()};
  state=demoBuildState(scen);
  selectedDate=localDateKey(new Date());
  currentView="day";updateNav();
  render();renderDemoDialog();
}
function demoStop(){
  demo=null;
  state=migrateState();
  selectedDate=localDateKey(new Date());
  render();
  if($("demoDialog").open) $("demoDialog").close();
  toast("Demo beendet – echte Daten geladen");
}
function renderDemoBanner(){
  const el=$("demoBanner");
  if(!el) return;
  el.hidden=!demo;
  if(!demo) return;
  el.innerHTML=`<span><b>DEMO</b> · ${timeFromMinutes(demo.nowMin)} simuliert · nichts wird gespeichert</span><button type="button" id="demoBannerOpen">Steuerung</button><button type="button" id="demoBannerStop">Beenden</button>`;
  $("demoBannerOpen").onclick=openDemoDialog;
  $("demoBannerStop").onclick=demoStop;
}
function renderDemoDialog(){
  const body=$("demoBody");
  if(!body) return;
  const now=demo?demo.nowMin:(new Date().getHours()*60+new Date().getMinutes());
  body.innerHTML=`
    <p class="demo-help">Zustand wählen, dann mit dem Schieber die Uhrzeit verstellen. Die App-Knöpfe (Kommen, Pause, Feierabend, Ändern) funktionieren normal. Deine echten Einträge bleiben unberührt.</p>
    <div class="demo-chips">${Object.entries(DEMO_SCENARIOS).map(([k,v])=>`<button type="button" data-demo-scen="${k}" aria-pressed="${demo?.scen===k}">${v.label}</button>`).join("")}</div>
    ${demo?"":`<p class="demo-help"><b>Erst einen Zustand wählen</b>, dann ist die Uhrzeit verstellbar. „Meine Daten“ nimmt deine echten Einträge (als Kopie).</p>`}
    <label class="demo-time" for="demoTime"><span>Uhrzeit</span><b id="demoTimeOut">${timeFromMinutes(now)}</b></label>
    <input type="range" id="demoTime" min="300" max="1200" step="5" value="${now}" ${demo?"":"disabled"}>
    <div class="demo-steps">${[-60,-15,-5,5,15,60].map(m=>`<button type="button" data-demo-step="${m}" ${demo?"":"disabled"}>${m>0?"+":"−"}${Math.abs(m)>=60?Math.abs(m)/60+" h":Math.abs(m)}</button>`).join("")}</div>
    ${demo?`<button type="button" class="danger-ghost full" id="demoStopBtn">Demo beenden</button>`:""}`;
  body.querySelectorAll("[data-demo-scen]").forEach(b=>b.onclick=()=>demoStart(b.dataset.demoScen));
  const r=$("demoTime");
  if(r) r.oninput=()=>{demo.nowMin=+r.value;$("demoTimeOut").textContent=timeFromMinutes(demo.nowMin);render();};
  body.querySelectorAll("[data-demo-step]").forEach(b=>b.onclick=()=>{demo.nowMin=clamp(demo.nowMin+Number(b.dataset.demoStep),0,1439);render();renderDemoDialog();});
  const stop=$("demoStopBtn");if(stop) stop.onclick=demoStop;
}
function openDemoDialog(){
  renderDemoDialog();
  $("demoDialog").showModal();
}

$("pixelMeter").addEventListener("click",openDemoDialog);
$("sheetLayer").addEventListener("click",e=>{
  const t=e.target;
  if(t.matches("[data-sheet-close]")){closeSheet();return;}
  const b=t.closest("button");
  if(!b) return;
  if(b.dataset.sheetEdit){closeSheet();openEdit(b.dataset.sheetEdit);return;}
  if(b.dataset.sheetGo){closeSheet();currentView=b.dataset.sheetGo;weekOffset=0;if(currentView==="year")yearCursor=new Date().getFullYear();if(currentView==="month"){const d=new Date();monthCursor=new Date(d.getFullYear(),d.getMonth(),1);}updateNav();render();window.scrollTo(0,0);return;}
  if(b.hasAttribute("data-sheet-bulk")){closeSheet();const d=new Date(Date.now()+86400000);openBulkVacation(localDateKey(d),localDateKey(d));return;}
  if(b.hasAttribute("data-sheet-pause")){closeSheet();renderLivePauseDialog();$("pauseDialog").showModal();return;}
  if(b.hasAttribute("data-sheet-settings")){closeSheet();buildSettings();document.querySelectorAll("#settingsDialog details.settings-accordion").forEach((d,i)=>d.open=i===0);$("settingsDialog").showModal();setTimeout(()=>$("kontoStartInput")?.focus(),50);return;}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("sheetLayer").hidden)closeSheet();});
$("openDemoBtn")?.addEventListener("click",()=>{ $("settingsDialog").close(); openDemoDialog(); });

setInterval(()=>{
  setHeader();
  if(currentView==="day") render();
},30000);

render();
updatePixelMeter();
if(navigator.storage?.persist){
  navigator.storage.persisted().then(already=>{ if(!already) navigator.storage.persist(); }).catch(()=>{});
}

if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    const hadController=!!navigator.serviceWorker.controller;
    let reloading=false;

    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(!hadController || reloading) return;
      reloading=true;
      window.location.reload();
    });

    try{
      const registration=await navigator.serviceWorker.register("sw.js",{
        updateViaCache:"none"
      });

      // Nicht auf den normalen Browser-Prüfzyklus warten.
      await registration.update();
    }catch(error){
      console.warn("Service-Worker-Update fehlgeschlagen",error);
    }
  });
}
