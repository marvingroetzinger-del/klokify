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
    assert h.count("38.7") == 4
    h = h.replace("38.7", "38.8")
    return once(h, '''        <button type="button" id="editNextDay" aria-label="Folgetag">›</button>
      </div>
''', '''        <button type="button" id="editNextDay" aria-label="Folgetag">›</button>
      </div>
      <div class="e-saved" id="editSaved" hidden><span id="editSavedText"></span><button type="button" id="editSavedUndo">Rückgängig</button></div>
''')

def app(s):
    # Blättern speichert immer; ungültige Eingaben halten an, Rückgängig im Hinweis
    s = once(s, '''async function stepEditDay(n){
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
  }''', '''async function stepEditDay(n){
  if(editDraftSignature()!==editDraftSig){
    if($("editStatus").value==="work"){
      const v=validateWorkEditDraft();
      if(v){showEditValidation(v.message,"");$("editValidation").scrollIntoView({block:"center",behavior:"smooth"});return;}
    }
    const k=editDateKey,label=$("editDateLabel").textContent;
    const before=state.records[k]?JSON.parse(JSON.stringify(state.records[k])):null;
    if(!commitEditDraft()) return;
    render();
    const d0=dateFromKey(k);
    openEdit(localDateKey(new Date(d0.getFullYear(),d0.getMonth(),d0.getDate()+n)));
    $("editSavedText").innerHTML=`<b>${label}</b> gespeichert`;
    $("editSaved").hidden=false;
    $("editSavedUndo").hidden=false;
    $("editSavedUndo").onclick=()=>{
      if(before) state.records[k]=before; else delete state.records[k];
      save();render();
      $("editSavedText").innerHTML=`<b>${label}</b> zurückgesetzt`;
      $("editSavedUndo").hidden=true;
    };
    return;
  }''')
    return once(s, '''  if(!$("editDialog").open) captureEditOrigin();''', '''  if(!$("editDialog").open) captureEditOrigin();
  $("editSaved").hidden=true;''')

CSS = '''
/* ── V38.8 Blättern speichert ── */
.e-saved{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:rgba(182,226,76,.12);font-size:var(--fs-s);color:var(--muted)}
.e-saved[hidden]{display:none}
.e-saved b{color:var(--lime)}
.e-saved button{border:0;background:none;color:var(--text);font:700 var(--fs-s)/1 var(--font-ui);padding:6px 0;text-decoration:underline}
.e-saved button[hidden]{display:none}
'''

def css(t):
    assert "V38.8" not in t
    return t + CSS

def sw(t):
    return once(t, 'const VERSION="v38.7";', 'const VERSION="v38.8";')

def readme(t):
    t = once(t, "# Klokify – Version 38.7", "# Klokify – Version 38.8")
    return once(t, "## V38.7 – Schnellpause rückwirkend", '''## V38.8 – Blättern speichert

- **„Tag bearbeiten“ ‹ ›:** Änderungen werden beim Blättern automatisch gespeichert, ohne Rückfrage. Danach steht im Dialog unter dem Datum „Do 22.10. gespeichert · Rückgängig“ (ein normaler Hinweis wäre hinter dem Dialog nicht antippbar).
- Ist eine Eingabe ungültig (z. B. Ende vor Beginn), wird nicht geblättert; die Meldung erscheint im Dialog.
- „Abbrechen“ und × verwerfen weiterhin den gerade offenen Tag.

## V38.7 – Schnellpause rückwirkend''')

edit(f"{d}/index.html", html)
edit(f"{d}/app.js", app)
edit(f"{d}/styles.css", css)
edit(f"{d}/sw.js", sw)
edit(f"{d}/README.md", readme)
print("v38.8 ok")
