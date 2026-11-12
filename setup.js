/* Session setup: role or job description, session type, focus skill (suggested or manual), difficulty */
(async function () {
  const M = window.MIRAN; await M.ready;
  const { $, $$, esc, engine } = M;
  const u = M.auth.require("candidate");
  M.shell("practice");

  const f = $("#setupForm");
  const prof = engine.skillProfile(u.id);
  const sug = engine.suggestion(u.id);
  const suggestedFocus = sug.focus || M.COMPONENTS.slice().sort((a, b) => (prof[a.id].score ?? 11) - (prof[b.id].score ?? 11))[0].id;
  const state = { type: M.qs("type") || sug.type || "full", focus: M.qs("focus") || suggestedFocus, mode: M.qs("focus") && M.qs("focus") !== suggestedFocus ? "manual" : "suggested", diff: "basic" };

  // field & role
  f.field.innerHTML = M.FIELDS.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
  const fillRoles = () => { const fl = M.FIELDS.find(x => x.id === f.field.value); f.role.innerHTML = fl.roles.map(r => `<option>${esc(r)}</option>`).join(""); };
  f.field.value = u.fieldId || "customer_service"; fillRoles(); if (u.role) f.role.value = u.role;
  f.field.onchange = fillRoles;
  f.jd.addEventListener("input", () => {
    const m = M.matchField(f.jd.value);
    if (f.jd.value.trim().length < 20) { $("#jdMatch").textContent = "Miran will match questions to the requirements it finds."; return; }
    if (m) { $("#jdMatch").innerHTML = `Matched to <b>${esc(m.name)}</b>. Questions will use this field.`; f.field.value = m.id; fillRoles(); }
    else $("#jdMatch").textContent = "No clear field found; the field selected above will be used.";
  });

  function render() {
    $$(".choice").forEach(c => { const on = c.dataset.type === state.type; c.classList.toggle("selected", on); $("input", c).checked = on; });
    $("#focusBox").classList.toggle("hidden", state.type !== "focus");
    $("#focusTag").innerHTML = sug.type === "focus" ? `<span class="tag" style="margin-left:6px">Suggested</span>` : "";
    $$("#focusMode button").forEach(b => b.classList.toggle("on", b.dataset.m === state.mode));
    if (state.mode === "suggested") state.focus = suggestedFocus;
    $("#focusChips").innerHTML = M.COMPONENTS.map(c => {
      const s = prof[c.id].score;
      return `<button type="button" class="chip ${state.focus === c.id ? "on" : ""}" data-c="${c.id}" ${state.mode === "suggested" && c.id !== suggestedFocus ? "disabled style='opacity:.45;cursor:not-allowed'" : ""}>${esc(c.name)} <small>${s == null ? "not measured" : s.toFixed(1)}</small></button>`;
    }).join("");
    $$("#focusChips .chip").forEach(b => b.onclick = () => { if (state.mode === "manual") { state.focus = b.dataset.c; render(); } });
    $("#focusWhy").innerHTML = state.mode === "suggested"
      ? `Suggested by Miran: your lowest-scoring skill${prof[suggestedFocus].score != null ? ` (${prof[suggestedFocus].score.toFixed(1)} / 10)` : ""}. Switch to <i>Choose myself</i> to pick another.`
      : `You chose this skill yourself. ${esc(M.compById(state.focus).meaning)}`;
    $$("#diff button").forEach(b => b.classList.toggle("on", b.dataset.d === state.diff));
    const cam = u.cameraMeasures !== false;
    $("#summary").innerHTML = `5 questions · about 2 minutes each · ${cam ? "camera and microphone needed" : "microphone needed (camera measures are off)"}<br>
      <span class="small">${state.type === "full" ? "Measures all five skills." : `Measures ${esc(M.compById(state.focus).name.toLowerCase())} only.`} You'll rate yourself once at the end, then see your report.</span>`;
  }
  $$(".choice").forEach(c => c.onclick = () => { state.type = c.dataset.type; render(); });
  $$("#focusMode button").forEach(b => b.onclick = () => { state.mode = b.dataset.m; render(); });
  $$("#diff button").forEach(b => b.onclick = () => { state.diff = b.dataset.d; render(); });
  render();

  f.onsubmit = e => {
    e.preventDefault();
    const s = { id: M.uid("s"), userId: u.id, type: state.type, focus: state.type === "focus" ? state.focus : null, focusChosen: state.type === "focus" ? state.mode : null,
      difficulty: state.diff, fieldId: f.field.value, role: f.role.value, jd: f.jd.value.trim(), cameraMeasures: u.cameraMeasures !== false,
      status: "draft", startedAt: new Date().toISOString() };
    const q = M.selectQuestions({ type: s.type, focus: s.focus, difficulty: s.difficulty, fieldId: s.fieldId, userId: u.id, seed: s.id });
    s.answers = q.map(x => ({ qid: x.id, comp: x.comp }));
    M.db().sessions = M.db().sessions.filter(x => !(x.userId === u.id && x.status === "draft"));
    M.db().sessions.push(s); M.commit();
    location.href = "record.html?id=" + s.id;
  };
})();
