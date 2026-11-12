/* Lesson library (#122): each lesson = tips → quiz → status (not started / open / passed).
   The quiz result is stored in LessonProgress so later sessions can show whether the lesson helped. */
(async function () {
  const M = window.MIRAN; await M.ready;
  const { $, $$, esc, engine } = M;
  const u = M.auth.require("candidate");
  M.shell("lessons");
  const prof = engine.skillProfile(u.id);
  const from = M.qs("from");
  const progress = id => M.db().lessonProgress.find(p => p.userId === u.id && p.lessonId === id);
  const status = id => progress(id)?.status || "not_started";
  const tagFor = st => st === "passed" ? `<span class="tag tag-green">Passed</span>` : st === "open" ? `<span class="tag">Open</span>` : `<span class="tag tag-grey">Not started</span>`;
  const recommended = new Set(M.COMPONENTS.filter(c => prof[c.id].score != null && prof[c.id].score < 6).map(c => M.LESSON_FOR_COMP[c.id]));

  let cur = M.qs("id") || [...recommended][0] || "L1";
  let step = "tips", qi = 0, answers = [];

  function list() {
    const comps = M.COMPONENTS.slice().sort((a, b) => (prof[a.id].score ?? 11) - (prof[b.id].score ?? 11));
    return comps.map(c => `<div class="eyebrow" style="margin:14px 0 6px">${esc(c.name)} ${prof[c.id].score != null ? `· ${prof[c.id].score.toFixed(1)} / 10` : ""}</div>` +
      M.LESSONS.filter(l => l.comp === c.id).map(l => `<div class="lesson-item ${l.id === cur ? "on" : ""}" data-id="${l.id}" tabindex="0">
        <div class="lesson-num">${l.id.slice(1)}</div>
        <div style="flex:1"><div class="t">${esc(l.title)}</div><div class="m">${l.minutes} min${recommended.has(l.id) ? " · recommended from your reports" : ""}</div></div>
        ${tagFor(status(l.id))}</div>`).join("")).join("");
  }

  function open(id) {
    cur = id; step = "tips"; qi = 0; answers = [];
    let p = progress(id);
    if (!p) { p = { userId: u.id, lessonId: id, status: "open", openedAt: new Date().toISOString(), quizScore: null, completedAt: null }; M.db().lessonProgress.push(p); M.commit(); }
    else if (p.status === "not_started") { p.status = "open"; M.commit(); }
    render();
  }

  function body() {
    const L = M.lessonById(cur), p = progress(cur);
    const steps = `<div class="lesson-steps"><div class="${step === "tips" ? "on" : "done"}">1 · Tips</div><div class="${step === "quiz" ? "on" : step === "result" ? "done" : ""}">2 · Quiz</div><div class="${step === "result" ? (p.status === "passed" ? "done" : "on") : ""}">3 · Status</div></div>`;
    const head = `<span class="tag">${esc(M.compById(L.comp).name)}</span><h2 style="margin-top:10px">${esc(L.title)}</h2>
      <p class="small muted">${L.minutes} min · linked measures: ${L.measures.map(k => M.MEASURES[k].name).join(", ")} · status: ${tagFor(p.status)}${p.quizScore != null ? ` · last quiz ${p.quizScore}/3` : ""}</p>${steps}`;
    if (step === "tips") return head + `<p>${esc(L.body)}</p><div class="eyebrow">Try this</div>${L.tips.map((t, i) => `<div class="tip"><span class="n">${i + 1}</span><span>${esc(t)}</span></div>`).join("")}
      <div style="margin-top:18px;display:flex;gap:10px"><button class="btn btn-primary" id="toQuiz">Take the 3-question quiz</button></div>`;
    if (step === "quiz") {
      const Q = L.quiz[qi], a = answers[qi];
      return head + `<div class="eyebrow">Quiz · question ${qi + 1} of 3</div><p style="font-weight:600;color:var(--ink)">${esc(Q.q)}</p>
        ${Q.o.map((o, k) => `<label class="quiz-opt ${a?.checked ? (k === Q.a ? "right" : k === a.pick ? "wrong" : "") : a?.pick === k ? "sel" : ""}"><input type="radio" name="qo" value="${k}">${esc(o)}</label>`).join("")}
        ${a?.checked ? `<div class="alert ${a.pick === Q.a ? "alert-ok" : "alert-error"}">${a.pick === Q.a ? "Correct. " : "Not quite. "}${esc(Q.why)}</div>` : ""}
        <div style="display:flex;gap:10px">${!a?.checked ? `<button class="btn btn-primary" id="check" ${a?.pick == null ? "disabled" : ""}>Check answer</button>` : `<button class="btn btn-primary" id="nextQ">${qi < 2 ? "Next question" : "See result"}</button>`}</div>`;
    }
    const score = answers.filter((a, i) => a.pick === L.quiz[i].a).length;
    const passed = score >= 2;
    const sug = engine.suggestion(u.id);
    return head + `<div style="text-align:center;padding:10px 0 4px"><div class="big-stat">${score} / 3</div>
      <p>${passed ? "Lesson passed. Your result is saved, and your next sessions will show whether it helped." : "Two out of three is needed to pass. Review the tips and try again."}</p></div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${passed ? `<a class="btn btn-primary" href="setup.html?type=focus&focus=${L.comp}">Practise now: focus on ${esc(M.compById(L.comp).name.toLowerCase())}</a>` : `<button class="btn btn-primary" id="retry">Try again</button>`}
        ${from ? `<a class="btn btn-outline" href="report.html?id=${from}">Back to report</a>` : `<a class="btn btn-outline" href="dashboard.html">Back to home</a>`}
      </div>`;
  }

  function render() {
    $("#app").innerHTML = `
      <div class="page-head"><div><h1>Lessons</h1><p>Short lessons, each linked to a skill and to the measures in your report. Pass the three-question quiz to mark a lesson complete.</p></div>
      <span class="small muted">${M.db().lessonProgress.filter(p => p.userId === u.id && p.status === "passed").length} of ${M.LESSONS.length} passed</span></div>
      <div class="grid g-lessons"><div class="card card-tight">${list()}</div><div class="card" id="lbody">${body()}</div></div>`;
    $$(".lesson-item").forEach(el => { el.onclick = () => open(el.dataset.id); el.onkeydown = e => e.key === "Enter" && open(el.dataset.id); });
    const L = M.lessonById(cur);
    $("#toQuiz") && ($("#toQuiz").onclick = () => { step = "quiz"; render(); });
    $$(".quiz-opt input").forEach(r => r.onchange = () => { answers[qi] = { pick: +r.value }; render(); });
    $("#check") && ($("#check").onclick = () => { answers[qi].checked = true; render(); });
    $("#nextQ") && ($("#nextQ").onclick = () => {
      if (qi < 2) { qi++; render(); return; }
      const score = answers.filter((a, i) => a.pick === L.quiz[i].a).length;
      const p = progress(cur); p.quizScore = score;
      let earned = [];
      if (score >= 2 && p.status !== "passed") { p.status = "passed"; p.completedAt = new Date().toISOString(); M.commit(); earned = engine.evaluateBadges(u.id, null); }
      M.commit(); step = "result"; render(); M.showBadges(earned);
    });
    $("#retry") && ($("#retry").onclick = () => { step = "tips"; qi = 0; answers = []; render(); });
  }
  open(cur);
})();
