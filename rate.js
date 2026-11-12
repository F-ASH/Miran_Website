/* Self-rating (rule #119): once, at the end of the interview, without replaying;
   per question and per criterion on a 1–5 scale. Ratings are stored and
   compared with Miran's result for each question in the report. */
(async function () {
  const M = window.MIRAN; await M.ready;
  const { $, $$, esc, engine } = M;
  const u = M.auth.require("candidate");
  const s = M.db().sessions.find(x => x.id === M.qs("id") && x.userId === u.id);
  if (!s) { location.replace("setup.html"); return; }
  if (s.status === "complete") { location.replace("report.html?id=" + s.id); return; }

  let cur = 0;
  s.answers.forEach(a => a.selfRatings = a.selfRatings || {});
  const crits = a => engine.criteriaFor(s, a.comp);
  const done = a => crits(a).every(c => a.selfRatings[c]);

  function render() {
    const a = s.answers[cur]; const q = M.questionById(a.qid);
    const total = s.answers.filter(done).length;
    $("#app").innerHTML = `
      <h1>How did you do?</h1>
      <p class="muted">Rate each answer before you see Miran's feedback. Rate from memory, as you would after a real interview; replay is not available here. Comparing your ratings with Miran's results is part of your self-awareness score.</p>
      <div class="q-tabs">${s.answers.map((x, i) => `<button class="${i === cur ? "on" : ""} ${done(x) ? "done" : ""}" data-i="${i}">Answer ${i + 1}</button>`).join("")}</div>
      <div class="card">
        <div class="card-head"><div><span class="tag">${esc(M.compById(q.comp).name)}</span><h3 style="margin-top:8px">${esc(M.qText(q, s.fieldId))}</h3></div></div>
        <table class="table">
          <thead><tr><th>Criterion</th><th style="width:230px">Your rating (1 = weak, 5 = strong)</th></tr></thead>
          <tbody>${crits(a).map(c => `<tr><td>${esc(M.CRITERIA[c].label)}</td><td><div class="rate-scale" data-c="${c}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${a.selfRatings[c] === n ? "on" : ""}" data-n="${n}" aria-label="${n}">${n}</button>`).join("")}</div></td></tr>`).join("")}</tbody>
        </table>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:12px;flex-wrap:wrap">
          <span class="small muted">${total} of ${s.answers.length} answers rated</span>
          <div style="display:flex;gap:10px">
            ${cur > 0 ? `<button class="btn btn-outline" id="prev">← Previous</button>` : ""}
            ${cur < s.answers.length - 1 ? `<button class="btn btn-primary" id="next" ${done(a) ? "" : "disabled"}>Next answer →</button>`
              : `<button class="btn btn-primary" id="finish" ${total === s.answers.length ? "" : "disabled"}>See my report</button>`}
          </div>
        </div>
      </div>`;
    $$(".q-tabs button").forEach(b => b.onclick = () => { cur = +b.dataset.i; render(); });
    $$(".rate-scale").forEach(sc => $$("button", sc).forEach(b => b.onclick = () => { a.selfRatings[sc.dataset.c] = +b.dataset.n; M.commit(); render(); }));
    $("#prev") && ($("#prev").onclick = () => { cur--; render(); });
    $("#next") && ($("#next").onclick = () => { cur++; render(); });
    $("#finish") && ($("#finish").onclick = analyse);
  }

  function analyse() {
    const steps = ["Transcribing answers", "Measuring pace, fillers and pauses", s.cameraMeasures ? "Measuring eye contact and smiling" : "Skipping camera measures (turned off)", "Scoring content against the rubric", "Comparing your ratings with Miran's results", "Building your report"];
    $("#app").innerHTML = `<div class="card analysing"><div class="spinner"></div><h2>Analysing your session</h2><p class="muted">This usually takes a few minutes. In this prototype it's quicker.</p>
      <ul class="an-steps">${steps.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
    const lis = $$(".an-steps li"); let i = 0;
    const tick = () => {
      lis.forEach((l, k) => l.className = k < i ? "done" : k === i ? "now" : "");
      if (i++ < steps.length) setTimeout(tick, 550);
      else {
        const earned = engine.analyseSession(s);
        M.commit();
        location.href = `report.html?id=${s.id}${earned.length ? "&new=" + earned.join(",") : ""}`;
      }
    };
    tick();
  }
  render();
})();
