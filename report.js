/* Session report: grouped by EI component. For each component: score (0–10),
   measures vs thresholds, evidence with timestamps, and a lesson link for each weakness.
   Also: system result vs self-rating per question (#119), "not measured" rule (#121),
   and the next step in the learning loop (#113). */
(async function () {
  const M = window.MIRAN; await M.ready;
  const { $, $$, esc, engine } = M;
  const u = M.auth.require("candidate");
  M.shell("reports");
  const all = engine.sessionsOf(u.id);
  const s = all.find(x => x.id === M.qs("id")) || all.at(-1);
  if (!s) { $("#app").innerHTML = `<div class="card empty"><h2>No reports yet</h2><p>Complete a session to get your first report.</p><a class="btn btn-primary" href="setup.html">Start a session</a></div>`; return; }
  const no = all.indexOf(s) + 1;
  const prev = all.slice(0, no - 1);
  const prevScore = c => { for (let i = prev.length - 1; i >= 0; i--) if (prev[i].compScores[c] != null) return prev[i].compScores[c]; return null; };
  const lp = M.db().lessonProgress.filter(p => p.userId === u.id);
  const lessonStatus = id => lp.find(p => p.lessonId === id)?.status || "not_started";

  /* ---------- aggregate a component's measures across answers ---------- */
  function rowsFor(comp) {
    const A = s.answers;
    const vals = k => A.map(a => a.measures?.[k]).filter(m => m && m.value != null);
    const nm = k => A.map(a => a.measures?.[k]).find(m => m?.notMeasured);
    const row = (k, result, ok) => ({ k, name: M.MEASURES[k].name, result, target: M.MEASURES[k].target, ok });
    const avg = k => M.mean(vals(k).map(m => m.value));
    const out = [];
    if (comp === "self_regulation") {
      out.push(row("pace", `${Math.round(avg("pace"))} words / min`, engine.meetsTarget.pace(avg("pace"))));
      out.push(row("fillers", `${avg("fillers").toFixed(1)} per minute`, engine.meetsTarget.fillers(avg("fillers"))));
      out.push(row("pauses", `${avg("pauses").toFixed(1)} per answer`, engine.meetsTarget.pauses(avg("pauses"))));
    }
    if (comp === "social_skill") {
      out.push(row("star", `${avg("star").toFixed(1)} of 4 parts`, avg("star") >= 3.5));
      ["eye", "smile"].forEach(k => {
        if (vals(k).length) out.push(row(k, `${Math.round(avg(k))}% of frames`, engine.meetsTarget[k](avg(k))));
        else out.push({ ...row(k, "Not measured", null), note: nm(k)?.notMeasured });
      });
    }
    if (["empathy", "motivation", "self_awareness"].includes(comp)) {
      const ei = A.filter(a => a.comp === comp).map(a => a.measures.ei_shown?.value).filter(Boolean);
      if (ei.length) { const best = ["not", "partly", "shown"][Math.round(M.mean(ei.map(v => ({ not: 0, partly: 1, shown: 2 }[v]))))]; out.push(row("ei_shown", { shown: "Shown", partly: "Partly shown", not: "Not shown" }[best], best === "shown")); }
      if (comp !== "self_awareness") { const rel = A.filter(a => a.comp === comp).map(a => a.measures.relevance.value); if (rel.length) out.push(row("relevance", `${M.mean(rel).toFixed(1)} / 5`, M.mean(rel) >= 4)); }
      if (comp === "self_awareness") { const g = A.map(a => a.gap).filter(v => v != null); if (g.length) out.push(row("gap", `${M.mean(g).toFixed(1)} points (average)`, M.mean(g) <= 1)); }
    }
    return out;
  }
  function evidenceFor(comp) {
    const keys = M.COMP_MEASURES[comp].concat(comp === "social_skill" ? [] : []);
    const ev = [];
    s.answers.forEach((a, i) => {
      keys.forEach(k => {
        const m = a.measures?.[k]; if (!m) return;
        if (k === "ei_shown" && a.comp !== comp) return;
        (m.evidence || []).forEach(e => ev.push({ i, t: e.t, text: e.text, k, bad: m.ok === false }));
        if (k === "star" && m.value < 4) ev.push({ i, t: 0, text: `Structure: ${m.parts.map(p => `${p.p} ${p.ok ? "✓" : "✗"}`).join(" · ")}`, k, bad: true, noTime: true });
      });
      if (comp === "self_awareness" && a.gap != null && a.gap > 1) ev.push({ i, t: 0, text: `You rated this answer ${a.gap.toFixed(1)} points away from Miran's result on average.`, k: "gap", bad: true, noTime: true });
    });
    return ev.sort((a, b) => b.bad - a.bad).slice(0, 4);
  }

  /* ---------- component cards ---------- */
  const measured = M.COMPONENTS.filter(c => s.compScores[c.id] != null).sort((a, b) => s.compScores[a.id] - s.compScores[b.id]);
  const notMeasured = M.COMPONENTS.filter(c => s.compScores[c.id] == null);
  const compCards = measured.map((c, ci) => {
    const sc = s.compScores[c.id], st = M.statusOf(sc), pv = prevScore(c.id);
    const rows = rowsFor(c.id);
    const weak = rows.filter(r => r.ok === false);
    const lessonId = weak.length ? (M.LESSON_FOR_MEASURE[weak[0].k] && M.lessonById(M.LESSON_FOR_MEASURE[weak[0].k]).comp === c.id ? M.LESSON_FOR_MEASURE[weak[0].k] : M.LESSON_FOR_COMP[c.id]) : null;
    const L = lessonId && M.lessonById(lessonId);
    const ev = evidenceFor(c.id);
    return `<div class="comp-card ${ci > 1 && !rows.some(r => r.note) ? "collapsed" : ""}" id="c_${c.id}">
      <div class="comp-head">
        <div><h3>${esc(c.name)}</h3><div class="small muted">${esc(c.meaning)}</div></div>
        <div style="display:flex;gap:8px;align-items:center;flex:none">
          ${pv != null ? `<span class="small" style="color:${sc >= pv ? "var(--green)" : "var(--red)"}">${sc >= pv ? "▲" : "▼"} ${Math.abs(sc - pv).toFixed(1)}</span>` : ""}
          <span class="score-pill ${st.cls}">${esc(st.t)} · ${sc.toFixed(1)} / 10</span><span class="muted">▾</span>
        </div>
      </div>
      <div class="comp-body">
        <table class="table">
          <thead><tr><th>Measure</th><th>Result</th><th>Target</th><th></th></tr></thead>
          <tbody>${rows.map(r => `<tr><td>${esc(r.name)}${r.note ? `<div class="small" style="color:var(--amber)">${esc(r.note)}</div>` : ""}</td><td><b>${esc(r.result)}</b></td><td class="muted">${esc(r.target)}</td>
            <td style="text-align:right">${r.ok == null ? `<span class="tag tag-amber">Not counted</span>` : r.ok ? `<span class="tag tag-green">On target</span>` : `<span class="tag tag-red">Below target</span>`}</td></tr>`).join("")}</tbody>
        </table>
        ${ev.length ? `<div class="eyebrow" style="margin-top:14px">Evidence from your recording</div>` + ev.map(e => `<div class="evidence">${e.noTime ? `<span class="ts" style="cursor:default">A${e.i + 1}</span>` : `<button class="ts" data-i="${e.i}" data-t="${e.t}">▶ A${e.i + 1} · ${M.fmtTime(e.t)}</button>`}<span>${esc(e.text)}</span></div>`).join("") : ""}
        ${L ? `<div class="lesson-link"><span class="txt"><b>Linked to this weakness:</b> ${esc(L.title)} (${L.minutes} min) · ${lessonStatus(L.id) === "passed" ? "passed" : lessonStatus(L.id) === "open" ? "in progress" : "not started"}</span><a class="btn btn-outline btn-sm" href="lessons.html?id=${L.id}&from=${s.id}">Learn: ${esc(L.title)}</a></div>` : `<div class="alert alert-ok" style="margin:12px 0 0">All measures for ${esc(c.name.toLowerCase())} are on target in this session.</div>`}
      </div></div>`;
  }).join("") + (notMeasured.length ? `<div class="card card-tight" style="margin-bottom:16px"><span class="small muted"><b>Not measured in this ${s.type} session:</b> ${notMeasured.map(c => c.name).join(", ")}. Their levels stay as they were.</span></div>` : "");

  /* ---------- self-rating vs Miran, per question ---------- */
  function ratingTable(i) {
    const a = s.answers[i], q = M.questionById(a.qid);
    const crit = Object.keys(a.system || {});
    return `<p class="small" style="margin:0 0 8px"><b>A${i + 1}.</b> ${esc(M.qText(q, s.fieldId))}</p>
      <table class="table"><thead><tr><th>Criterion</th><th>You</th><th>Miran</th><th>Gap</th></tr></thead><tbody>
      ${crit.map(c => { const me = a.selfRatings?.[c], sys = a.system[c]; const g = me != null && sys != null ? me - sys : null;
        return `<tr><td class="small">${esc(M.CRITERIA[c].label)}</td><td>${me ?? "—"}</td><td><b>${sys ?? "—"}</b></td>
        <td>${g == null ? "" : Math.abs(g) <= 1 ? `<span class="tag tag-green">close</span>` : `<span class="tag tag-amber">${g > 0 ? "+" : ""}${g}</span>`}</td></tr>`; }).join("")}
      </tbody></table>`;
  }
  const gaps = s.answers.map(a => a.gap).filter(v => v != null);
  const over = s.answers.flatMap(a => Object.keys(a.system || {}).map(c => (a.selfRatings?.[c] ?? 0) - (a.system[c] ?? 0)));
  const bias = M.mean(over);

  /* ---------- next step in the loop ---------- */
  const sug = engine.suggestion(u.id);
  const isLatest = s === all.at(-1);
  const weakest = measured[0];
  const loopLesson = weakest && M.lessonById(M.LESSON_FOR_COMP[weakest.id]);

  $("#app").innerHTML = `
    <div class="page-head">
      <div><a href="reports.html" class="small">← All reports</a><h1 style="margin-top:6px">Session report · S${no}</h1>
      <p>${s.type === "full" ? "Full session" : "Focus session · " + esc(M.compById(s.focus).name)} · ${esc(s.role)} · ${s.difficulty === "advanced" ? "Advanced" : "Basic"} · ${M.fmtDate(s.completedAt)}</p></div>
      <span class="small muted" style="max-width:300px;text-align:right">Practice guidance from observable evidence. Not a psychological test.</span>
    </div>
    <div class="grid g-report">
      <aside style="display:grid;gap:20px">
        <div class="card">
          <h3>Scores this session</h3>
          ${M.COMPONENTS.map(c => { const v = s.compScores[c.id]; return `<div class="skill-row"><span class="name">${esc(c.name)}</span><div class="bar"><span class="${v != null && v < 5 ? "low" : ""}" style="width:${(v ?? 0) * 10}%"></span></div><span class="val">${v == null ? "not measured" : `<b>${v.toFixed(1)}</b> / 10`}</span></div>`; }).join("")}
          <div class="scale-note">Scale 0–10 per EI skill.</div>
        </div>
        <div class="card">
          <h3>Your rating vs Miran</h3>
          <p class="small muted">Per question, on the same 1–5 scale. A gap of 1 or less counts as close.</p>
          <div class="q-tabs" id="rtabs">${s.answers.map((a, i) => `<button class="${i === 0 ? "on" : ""}" data-i="${i}">A${i + 1}</button>`).join("")}</div>
          <div id="rtable">${ratingTable(0)}</div>
          <p class="small" style="margin:12px 0 0">${gaps.length ? `Average gap <b>${M.mean(gaps).toFixed(1)}</b>. ${bias > 0.5 ? "You rated yourself higher than the evidence, mostly on delivery. Watching the moments on the right can help close the gap." : bias < -0.5 ? "You rated yourself lower than the evidence. You did better than you thought." : "Your ratings were close to Miran's results."}` : ""}</p>
        </div>
        ${s.badgesEarned?.length ? `<div class="card"><h3>Earned this session</h3><div class="badge-list">${s.badgesEarned.map(id => { const b = M.badgeById(id); return `<div class="badge-item"><div class="badge-icon earned">${b.icon}</div><div><div class="t">${esc(b.name)}</div><div class="d">${esc(b.desc)}</div></div></div>`; }).join("")}</div></div>` : ""}
      </aside>
      <section>
        ${compCards}
        <div class="next-loop">
          <div class="eyebrow" style="color:#9FB4E8">Your next step</div>
          <h3>${weakest ? `Close the gap on ${esc(weakest.name.toLowerCase())}` : "Keep practising"}</h3>
          <div class="loop-steps"><span>✓ Session</span>→<span>✓ Self-rating</span>→<span>✓ Report</span>→<span class="now">Lesson</span>→<span>Suggested session</span></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${loopLesson ? `<a class="btn btn-danger" href="lessons.html?id=${loopLesson.id}&from=${s.id}">1 · ${lessonStatus(loopLesson.id) === "passed" ? "Review" : "Learn"}: ${esc(loopLesson.title)}</a>` : ""}
            ${isLatest ? `<a class="btn btn-outline" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.4)" href="setup.html?type=${sug.type}${sug.focus ? "&focus=" + sug.focus : ""}&suggested=1">2 · ${sug.type === "focus" ? "Focus session: " + esc(M.compById(sug.focus).name) : "Full session"}</a>` : ""}
          </div>
          ${isLatest ? `<p class="small" style="margin:12px 0 0;color:#B9C8EE">Why: ${esc(sug.why)}</p>` : ""}
        </div>
        <details class="card" style="margin-top:16px"><summary style="cursor:pointer;font-weight:650;color:var(--ink)">Transcripts</summary>
          ${s.answers.map((a, i) => `<div style="margin-top:14px"><b class="small">A${i + 1} · ${esc(M.qText(M.questionById(a.qid), s.fieldId))}</b>${a.simulated ? ` <span class="tag tag-grey">sample answer</span>` : ""}<p class="small muted" style="margin:4px 0 0">${esc(a.transcript || "")}</p></div>`).join("")}
        </details>
      </section>
    </div>`;

  $$(".comp-head").forEach(h => h.onclick = () => h.parentElement.classList.toggle("collapsed"));
  $$("#rtabs button").forEach(b => b.onclick = () => { $$("#rtabs button").forEach(x => x.classList.remove("on")); b.classList.add("on"); $("#rtable").innerHTML = ratingTable(+b.dataset.i); });
  $$(".evidence .ts[data-t]").forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const i = +b.dataset.i, t = +b.dataset.t, a = s.answers[i];
    const blob = a.hasVideo ? await M.rec.get(`${s.id}_${i}`) : null;
    const around = (a.words || []).filter(w => w.t >= t - 1 && w.t <= t + 9).map(w => w.w).join(" ");
    const m = M.modal(`<h2>Answer ${i + 1} at ${M.fmtTime(t)}</h2>
      ${blob ? `<video controls playsinline style="width:100%;border-radius:10px;background:#111A33"></video>` : `<div class="alert alert-info">${a.simulated ? "This answer used a sample transcript, so there's no video to replay." : "The recording was deleted. The transcript is kept."}</div>`}
      <p class="small" style="margin-top:12px"><b>Transcript:</b> “${esc(around)}…”</p>
      <div style="text-align:right"><button class="btn btn-primary" id="cl">Close</button></div>`);
    if (blob) { const v = $("video", m); v.src = URL.createObjectURL(blob); v.onloadedmetadata = () => { try { v.currentTime = Math.max(0, t - 1); } catch (er) {} v.play().catch(() => {}); }; }
    $("#cl", m).onclick = () => m.remove();
  });
  if (M.qs("new")) M.showBadges(M.qs("new").split(","));
})();
