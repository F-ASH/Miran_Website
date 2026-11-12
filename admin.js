/* Administrator: manage questions and lessons (FR). Aggregate counts only;
   the administrator never sees individual candidates' results (privacy NFR). */
(async function () {
  const M = window.MIRAN; await M.ready;
  const { $, $$, esc } = M;
  M.auth.require("admin");
  M.shell("admin");
  const d = M.db();
  let tab = M.qs("tab") || "questions", filt = { comp: "", diff: "" };

  function stats() {
    const cands = d.users.filter(u => u.type === "candidate").length;
    const sess = d.sessions.filter(s => s.status === "complete").length;
    const passed = d.lessonProgress.filter(p => p.status === "passed").length;
    return `<div class="grid g-3" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      ${[["Candidates", cands], ["Sessions completed", sess], ["Questions in bank", M.allQuestions().length], ["Lessons passed", passed]].map(([t, v]) => `<div class="card card-tight"><div class="eyebrow">${t}</div><div class="big-stat">${v}</div></div>`).join("")}</div>`;
  }
  function questions() {
    const list = M.QUESTIONS.concat(d.customQuestions).filter(q => (!filt.comp || q.comp === filt.comp) && (!filt.diff || q.diff === filt.diff));
    return `<div class="card">
      <div class="card-head"><h2>Question bank</h2><button class="btn btn-primary btn-sm" id="addQ">+ Add question</button></div>
      <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <select id="fc" style="width:auto"><option value="">All skills</option>${M.COMPONENTS.map(c => `<option value="${c.id}" ${filt.comp === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select>
        <select id="fd" style="width:auto"><option value="">All difficulties</option><option value="basic" ${filt.diff === "basic" ? "selected" : ""}>Basic</option><option value="advanced" ${filt.diff === "advanced" ? "selected" : ""}>Advanced</option></select>
        <span class="small muted" style="align-self:center">${list.length} questions · {person} is replaced by customer, patient, user or client by field</span>
      </div>
      <table class="table"><thead><tr><th>ID</th><th>Question</th><th>EI skill</th><th>Type</th><th>Level</th><th>Active</th></tr></thead><tbody>
      ${list.map(q => `<tr><td class="small muted">${q.id}</td><td>${esc(q.text)}</td><td><span class="tag">${esc(M.compById(q.comp).name)}</span></td><td class="small">${q.type}</td><td class="small">${q.diff}</td>
        <td><label class="check" style="margin:0"><input type="checkbox" data-q="${q.id}" ${d.disabledQuestions.includes(q.id) ? "" : "checked"}></label></td></tr>`).join("")}</tbody></table></div>`;
  }
  function lessons() {
    return `<div class="card"><div class="card-head"><h2>Lessons</h2><span class="small muted">Each lesson: tips → 3-question quiz → status</span></div>
      <table class="table"><thead><tr><th>ID</th><th>Title</th><th>EI skill</th><th>Linked measures</th><th>Minutes</th><th>Passed by</th></tr></thead><tbody>
      ${M.LESSONS.map(l => `<tr><td class="small muted">${l.id}</td><td><b>${esc(l.title)}</b><div class="small muted">${esc(l.tips.length)} tips · ${l.quiz.length} quiz questions</div></td><td><span class="tag">${esc(M.compById(l.comp).name)}</span></td>
        <td class="small">${l.measures.map(k => M.MEASURES[k].name).join(", ")}</td><td>${l.minutes}</td><td>${d.lessonProgress.filter(p => p.lessonId === l.id && p.status === "passed").length}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function measures() {
    return `<div class="card"><div class="card-head"><h2>Measures and thresholds</h2><span class="small muted">Table 1 · used by the report</span></div>
      <table class="table"><thead><tr><th>#</th><th>Measure</th><th>EI skill</th><th>How it is measured</th><th>Target</th><th>Tool</th></tr></thead><tbody>
      ${Object.values(M.MEASURES).map(m => `<tr><td>${m.n}</td><td><b>${esc(m.name)}</b></td><td class="small">${esc(m.comp.split(",").map(x => x.trim() === "all" ? "All" : M.compById(x.trim())?.name).join(", "))}</td><td class="small">${esc(m.how)}</td><td>${esc(m.target)}</td><td class="small muted">${esc(m.tool)}</td></tr>`).join("")}</tbody></table>
      <p class="small muted" style="margin-top:10px">Eye contact and smiling are not reported when the average frame brightness is too low to measure reliably; the report says "not measured" instead.</p></div>`;
  }
  function render() {
    $("#app").innerHTML = `<div class="page-head"><div><h1>Administration</h1><p>Manage the question bank and lessons. Candidates' individual results are not visible here.</p></div></div>
      ${stats()}
      <div class="seg" style="margin-bottom:16px">${[["questions", "Questions"], ["lessons", "Lessons"], ["measures", "Measures"]].map(([k, t]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${t}</button>`).join("")}</div>
      ${tab === "questions" ? questions() : tab === "lessons" ? lessons() : measures()}`;
    $$(".seg button[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    $("#fc") && ($("#fc").onchange = e => { filt.comp = e.target.value; render(); });
    $("#fd") && ($("#fd").onchange = e => { filt.diff = e.target.value; render(); });
    $$("input[data-q]").forEach(c => c.onchange = () => { const id = c.dataset.q; d.disabledQuestions = c.checked ? d.disabledQuestions.filter(x => x !== id) : [...d.disabledQuestions, id]; M.commit(); M.toast(c.checked ? "Question activated" : "Question deactivated"); });
    $("#addQ") && ($("#addQ").onclick = () => {
      const m = M.modal(`<h2>Add a question</h2><form id="qf">
        <div class="field"><label>Question text</label><textarea name="text" required placeholder="Use {person} for customer / patient / user / client"></textarea></div>
        <div class="grid g-3" style="gap:10px">
          <div class="field"><label>EI skill</label><select name="comp">${M.COMPONENTS.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select></div>
          <div class="field"><label>Type</label><select name="type"><option>behavioural</option><option>situational</option><option>general</option><option>reflection</option></select></div>
          <div class="field"><label>Level</label><select name="diff"><option value="basic">Basic</option><option value="advanced">Advanced</option></select></div>
        </div>
        <div class="field"><label>Guidance points <span class="muted">(one per line)</span></label><textarea name="guide" style="min-height:70px"></textarea></div>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn btn-ghost" id="c">Cancel</button><button class="btn btn-primary">Add question</button></div></form>`);
      $("#c", m).onclick = () => m.remove();
      $("#qf", m).onsubmit = e => { e.preventDefault(); const f = e.target;
        d.customQuestions.push({ id: "q" + (31 + d.customQuestions.length), comp: f.comp.value, type: f.type.value, diff: f.diff.value, text: f.text.value.trim(), guide: f.guide.value.split("\n").map(s => s.trim()).filter(Boolean).concat(f.guide.value.trim() ? [] : ["Answer with a specific example"]) });
        M.commit(); m.remove(); render(); M.toast("✓ Question added to the bank"); };
    });
  }
  render();
})();
