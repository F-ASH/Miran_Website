/* Home dashboard — every element is backed by a stored record:
   SkillProfile (levels), Session/ComponentScore (graph), Badge, LessonProgress, suggestion rule */
(async function () {
  const M = window.MIRAN; await M.ready;
  const { $, esc, engine } = M;
  const u = M.auth.require("candidate");
  M.shell("home");

  const sessions = engine.sessionsOf(u.id);
  const prof = engine.skillProfile(u.id);
  const sug = engine.suggestion(u.id);
  const streak = engine.streak(u.id);
  const myBadges = M.db().badges.filter(b => b.userId === u.id).map(b => b.badgeId);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const daysToInterview = u.interviewDate ? M.daysBetween(new Date().toISOString().slice(0, 10), u.interviewDate) : null;
  const lp = M.db().lessonProgress.filter(p => p.userId === u.id);
  const statusOfLesson = id => lp.find(p => p.lessonId === id)?.status || "not_started";
  const thisWeek = sessions.filter(s => M.daysBetween(s.completedAt, new Date()) < 7).length;

  const sugCard = sug.type === "focus"
    ? `<div class="eyebrow"><span class="tag">Suggested next</span></div>
       <h2>Focus session: ${esc(M.compById(sug.focus).name)}</h2>
       <p>Five questions on your weakest skill. ${statusOfLesson(sug.lessonId) !== "passed" ? `Read the lesson <a href="lessons.html?id=${sug.lessonId}">"${esc(M.lessonById(sug.lessonId).title)}"</a> first.` : ""}</p>
       <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
         <a class="btn btn-primary" href="setup.html?type=focus&focus=${sug.focus}&suggested=1">Start session</a>
         <a class="btn btn-outline" href="setup.html">Choose another</a>
       </div>
       <p class="small muted" style="margin:0"><b>Why this?</b> ${esc(sug.why)}</p>`
    : `<div class="eyebrow"><span class="tag">Suggested next</span></div>
       <h2>${sessions.length ? "Full session" : "Your first session"}</h2>
       <p>One question for each of the five EI skills, about two minutes each. Best for a first try or a check-up.</p>
       <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
         <a class="btn btn-primary" href="setup.html?type=full&suggested=1">Start session</a>
         <a class="btn btn-outline" href="lessons.html">Browse lessons</a>
       </div>
       <p class="small muted" style="margin:0"><b>Why this?</b> ${esc(sug.why)}</p>`;

  const skillRows = M.COMPONENTS.map(c => {
    const p = prof[c.id]; const s = p.score;
    const delta = s != null && p.prev != null ? M.round1(s - p.prev) : null;
    const weakest = sug.focus === c.id;
    return `<div class="skill-row" title="${esc(c.meaning)}">
      <span class="name">${esc(c.name)}</span>
      <div class="bar" aria-label="${esc(c.name)} ${s ?? "not measured"} out of 10"><span class="${weakest ? "low" : ""}" style="width:${s == null ? 0 : s * 10}%"></span></div>
      <span class="val">${s == null ? "—" : `<b>${s.toFixed(1)}</b> · Lv ${M.levelOf(s)}`}${delta ? ` <span style="color:${delta > 0 ? "var(--green)" : "var(--red)"}">${delta > 0 ? "▲" : "▼"}</span>` : ""}</span>
    </div>`;
  }).join("");

  const badgeRows = M.BADGES.slice().sort((a, b) => myBadges.includes(b.id) - myBadges.includes(a.id)).slice(0, 4).map(b => `
    <div class="badge-item"><div class="badge-icon ${myBadges.includes(b.id) ? "earned" : "locked"}">${b.icon}</div>
    <div><div class="t">${esc(b.name)}</div><div class="d">${myBadges.includes(b.id) ? "Earned" : esc(b.desc)}</div></div></div>`).join("");

  const recent = sessions.slice().reverse().slice(0, 5).map((s, i) => {
    const n = sessions.length - i;
    const scores = Object.values(s.compScores).filter(v => v != null);
    return `<tr><td><b>S${n}</b></td><td>${s.type === "full" ? "Full" : "Focus · " + esc(M.compById(s.focus).name)}</td>
      <td class="muted">${M.fmtDate(s.completedAt)}</td><td>${M.mean(scores).toFixed(1)} / 10</td>
      <td style="text-align:right"><a class="btn btn-ghost btn-sm" href="report.html?id=${s.id}">View report →</a></td></tr>`;
  }).join("");

  const recLessons = M.COMPONENTS.map(c => prof[c.id].score).some(v => v != null)
    ? M.COMPONENTS.slice().sort((a, b) => (prof[a.id].score ?? 11) - (prof[b.id].score ?? 11)).slice(0, 3).map(c => M.lessonById(M.LESSON_FOR_COMP[c.id]))
    : M.LESSONS.slice(0, 3);
  const lessonRows = recLessons.map(l => {
    const st = statusOfLesson(l.id);
    return `<a class="lesson-item" href="lessons.html?id=${l.id}" style="text-decoration:none">
      <div class="lesson-num">${l.id.slice(1)}</div>
      <div style="flex:1"><div class="t">${esc(l.title)}</div><div class="m">${esc(M.compById(l.comp).name)} · ${l.minutes} min</div></div>
      <span class="tag ${st === "passed" ? "tag-green" : st === "open" ? "" : "tag-grey"}">${st === "passed" ? "Passed" : st === "open" ? "Open" : "Not started"}</span></a>`;
  }).join("");

  $("#app").innerHTML = `
    ${M.qs("welcome") ? `<div class="alert alert-ok">Your account is ready. Start your first session below; it takes about 12 minutes.</div>` : ""}
    <div class="page-head">
      <div><h1>${greet}, ${esc(u.name.split(" ")[0])}</h1>
      <p>${esc(u.role || "Choose a role in Settings")}${daysToInterview != null && daysToInterview >= 0 ? ` · interview in ${daysToInterview} day${daysToInterview === 1 ? "" : "s"}` : ""}</p></div>
      <div class="flow-steps" aria-label="Practice loop"><b>Practise</b> → Rate yourself → Report by EI skill → Lesson → <b>Suggested next session</b></div>
    </div>

    <div class="grid g-dash">
      <div class="card card-feature">${sugCard}</div>
      <div class="card">
        <div class="card-head"><h3>Skill levels</h3><span class="small muted">latest score</span></div>
        ${skillRows}
        <div class="scale-note">Scale 0–10 per EI skill · Level 1 (0–4) to Level 5 (8.5–10)</div>
      </div>
      <div class="card">
        <h3>This week</h3>
        <div class="big-stat">${streak} week${streak === 1 ? "" : "s"}</div>
        <div class="small muted" style="margin-bottom:14px">practice streak · ${thisWeek} session${thisWeek === 1 ? "" : "s"} in the last 7 days</div>
        <h3 style="margin-top:4px">Badges <span class="small muted" style="font-weight:500">${myBadges.length} of ${M.BADGES.length}</span></h3>
        <div class="badge-list">${badgeRows}</div>
      </div>

      <div class="card span-all">
        <div class="card-head"><h3>Progress by skill</h3><span class="small muted">last ${Math.min(8, sessions.length) || 0} sessions</span></div>
        <div id="chart"></div>
        <p class="scale-note" style="margin:6px 0 0">A focus session measures only its target skill, so the other skills have no point for that session; their lines join the nearest measured sessions.</p>
      </div>

      <div class="card" style="grid-column:span 2">
        <div class="card-head"><h3>Recent sessions</h3><a href="reports.html" class="small">All reports</a></div>
        ${sessions.length ? `<table class="table">${recent}</table>` : `<div class="empty">No sessions yet. Your reports will appear here.</div>`}
      </div>
      <div class="card">
        <div class="card-head"><h3>Lessons for you</h3><a href="lessons.html" class="small">Library</a></div>
        ${lessonRows}
      </div>
    </div>`;
  M.progressChart($("#chart"), u.id);
})();
