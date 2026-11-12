/* =========================================================
   Miran — core: storage, auth, layout, analysis engine
   Front-end prototype: data is kept in the browser
   (localStorage + IndexedDB for recordings). No server.
   ========================================================= */
(function () {
  const M = window.MIRAN;
  const DB_KEY = "miran.db.v1";
  const AUTH_KEY = "miran.auth.v1";

  /* ---------------- helpers ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = p => p + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = v => Math.round(v * 10) / 10;
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const fmtDate = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const qs = k => new URLSearchParams(location.search).get(k);
  function rngFrom(seed) { // mulberry32
    let a = typeof seed === "number" ? seed : [...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const noise = r => (r() + r() + r() - 1.5) / 1.5; // ~[-1,1], centred

  /* ---------------- storage ---------------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(DB_KEY)) || null; } catch (e) { return null; }
  }
  function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function db() { return M._db || (M._db = load()); }
  function commit() { save(M._db); }

  async function hash(pw) { // NFR: passwords stored hashed (SHA-256 in this prototype)
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("miran:" + pw));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { let h = 0; for (const c of "miran:" + pw) h = (h * 31 + c.charCodeAt(0)) | 0; return "x" + h; }
  }

  /* ---------------- auth ---------------- */
  const auth = {
    current() { const id = localStorage.getItem(AUTH_KEY); return id ? db().users.find(u => u.id === id) || null : null; },
    async signIn(email, pw) {
      const u = db().users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!u || u.pwHash !== await hash(pw)) return { ok: false, error: "The email or password is incorrect." };
      localStorage.setItem(AUTH_KEY, u.id); return { ok: true, user: u };
    },
    async signUp({ name, email, password }) {
      email = email.trim().toLowerCase();
      if (db().users.some(u => u.email === email)) return { ok: false, field: "email", error: "An account with this email already exists." };
      const u = { id: uid("u"), type: "candidate", name: name.trim(), email, pwHash: await hash(password), createdAt: new Date().toISOString(),
        fieldId: null, role: null, interviewDate: null, consentAt: null, cameraMeasures: true, autoDelete30: false };
      db().users.push(u); commit(); localStorage.setItem(AUTH_KEY, u.id); return { ok: true, user: u };
    },
    signOut() { localStorage.removeItem(AUTH_KEY); location.href = "index.html"; },
    /* Route guard: candidate pages need a signed-in candidate who has given consent */
    require(kind = "candidate") {
      const u = auth.current();
      if (!u) { location.replace("index.html"); throw new Error("redirect"); }
      if (kind === "candidate" && u.type === "admin") { location.replace("admin.html"); throw new Error("redirect"); }
      if (kind === "admin" && u.type !== "admin") { location.replace("dashboard.html"); throw new Error("redirect"); }
      if (kind === "candidate" && !u.consentAt) { location.replace("consent.html"); throw new Error("redirect"); }
      return u;
    }
  };

  /* ---------------- layout ---------------- */
  function shell(active) {
    const u = auth.current();
    const initials = (u?.name || "?").split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();
    const nav = u?.type === "admin"
      ? [["admin.html", "Admin", "admin"]]
      : [["dashboard.html", "Home", "home"], ["setup.html", "Practice", "practice"], ["reports.html", "Reports", "reports"], ["lessons.html", "Lessons", "lessons"]];
    const streak = u?.type === "candidate" ? engine.streak(u.id) : 0;
    const header = document.createElement("header");
    header.className = "topbar";
    header.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="${u?.type === "admin" ? "admin.html" : "dashboard.html"}" aria-label="Miran home"><img src="miran-logo.png" alt="Miran"></a>
        <button class="menu-toggle" aria-label="Menu" onclick="document.querySelector('.nav').classList.toggle('open')">☰</button>
        <nav class="nav" aria-label="Main">${nav.map(([h, t, k]) => `<a href="${h}" class="${k === active ? "active" : ""}">${t}</a>`).join("")}</nav>
        ${streak ? `<span class="streak-pill" title="Weeks in a row with at least one session">🔥 ${streak}-week streak</span>` : ""}
        <div class="user-menu">
          <button class="user-btn" id="userBtn" aria-haspopup="true"><span class="avatar">${esc(initials)}</span><span>${esc(u?.name?.split(" ")[0] || "")}</span> ▾</button>
          <div class="dropdown" id="userDrop">
            <div style="padding:8px 12px"><b style="color:var(--ink)">${esc(u?.name || "")}</b><br><span class="small muted">${esc(u?.email || "")}</span></div>
            <div class="sep"></div>
            ${u?.type === "admin" ? "" : `<a href="settings.html">Settings &amp; privacy</a>`}
            <button id="signOutBtn">Sign out</button>
          </div>
        </div>
      </div>`;
    document.body.prepend(header);
    $("#userBtn").onclick = e => { e.stopPropagation(); $("#userDrop").classList.toggle("open"); };
    document.addEventListener("click", () => $("#userDrop")?.classList.remove("open"));
    $("#signOutBtn").onclick = () => auth.signOut();
    const f = document.createElement("footer");
    f.className = "footer";
    f.innerHTML = `Miran (مِران) · Emotional Intelligence Practice and Feedback System for Job Interviews · CPIS 498 Group H, FCIT, King Abdulaziz University<br>Practice only. Miran never shares your results with employers and makes no hiring decisions.`;
    document.body.append(f);
  }

  function toast(msg, ms = 2600) {
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.append(t); }
    t.innerHTML = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms);
  }
  function modal(html) {
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); });
    document.body.append(bg); return bg;
  }
  function showBadges(ids) {
    if (!ids?.length) return;
    const b = ids.map(M.badgeById);
    const m = modal(`<div class="badge-pop">${b.map(x => `<div class="badge-icon earned">${x.icon}</div><h2>New badge: ${esc(x.name)}</h2><p class="muted">${esc(x.desc)}</p>`).join("")}
      <button class="btn btn-primary" style="margin-top:6px">Nice</button></div>`);
    $("button", m).onclick = () => m.remove();
  }

  /* ---------------- recordings (IndexedDB) ---------------- */
  const rec = {
    _db: null,
    open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((res, rej) => {
        if (!window.indexedDB) return rej("no idb");
        const r = indexedDB.open("miran-recordings", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("videos");
        r.onsuccess = () => res(this._db = r.result); r.onerror = () => rej(r.error);
      });
    },
    async put(key, blob) { try { const d = await this.open(); return new Promise(r => { const tx = d.transaction("videos", "readwrite"); tx.objectStore("videos").put(blob, key); tx.oncomplete = () => r(true); tx.onerror = () => r(false); }); } catch (e) { return false; } },
    async get(key) { try { const d = await this.open(); return new Promise(r => { const q = d.transaction("videos").objectStore("videos").get(key); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); }); } catch (e) { return null; } },
    async clearPrefix(prefix) {
      try { const d = await this.open(); return new Promise(r => { const tx = d.transaction("videos", "readwrite"); const st = tx.objectStore("videos"); const q = st.openCursor(); q.onsuccess = () => { const c = q.result; if (c) { if (String(c.key).startsWith(prefix)) c.delete(); c.continue(); } }; tx.oncomplete = () => r(true); }); } catch (e) { return false; }
    }
  };

  /* =========================================================
     Analysis engine (rules written by the team; in the real
     system the measures come from speech-to-text, MediaPipe
     and a generative AI API — see Table 1)
     ========================================================= */
  const FILLER_RE = /^(um+|uh+|erm|like|you know)$/i;

  const scoreOf = {
    pace: v => v >= 120 && v <= 160 ? 10 : clamp(10 - (v < 120 ? 120 - v : v - 160) / 3.5, 0, 10),
    fillers: v => v < 3 ? 10 - v * 0.6 : clamp(8.2 - (v - 3) * 1.8, 0, 10),
    pauses: v => v <= 2 ? 10 - v * 0.7 : clamp(8.6 - (v - 2) * 2, 0, 10),
    eye: v => clamp(v / 6.5, 0, 10),
    smile: v => v >= 15 ? clamp(7.5 + (v - 15) / 6, 0, 10) : v / 2,
    star: v => v * 2.5,
    relevance: v => (v - 1) * 2.5,
    ei_shown: v => ({ shown: 9, partly: 6, not: 2.5 }[v]),
    gap: v => clamp(10 - v * 3.5, 0, 10)
  };
  const meetsTarget = {
    pace: v => v >= 120 && v <= 160, fillers: v => v < 3, pauses: v => v <= 2, eye: v => v >= 60, smile: v => v >= 15,
    star: v => v === 4, relevance: v => v >= 4, ei_shown: v => v === "shown", gap: v => v <= 1
  };

  /* Words with timestamps → pace, fillers, pauses (+ evidence) */
  function speechMeasures(words, duration) {
    const spoken = words.filter(w => !FILLER_RE.test(w.w.replace(/[^\w ]/g, "")));
    let gaps = [];
    for (let i = 1; i < words.length; i++) { const g = words[i].t - words[i - 1].t; if (g > 2) gaps.push({ t: words[i - 1].t, g }); }
    const gapTime = gaps.reduce((s, x) => s + x.g, 0);
    const speakSec = Math.max(5, (duration || (words.at(-1)?.t || 0) + 0.5) - gapTime);
    const pace = Math.round(spoken.length / (speakSec / 60));
    const fillerWords = words.filter(w => FILLER_RE.test(w.w.replace(/[^\w ]/g, "")));
    // two-word filler "you know"
    let yk = 0; for (let i = 1; i < words.length; i++) if (/^you$/i.test(words[i - 1].w) && /^know[,.]?$/i.test(words[i].w)) yk++;
    const fpm = round1((fillerWords.length + yk) / (speakSec / 60));
    // evidence: fastest 12-word stretch
    let best = null;
    for (let i = 0; i + 12 < words.length; i++) {
      const dt = words[i + 12].t - words[i].t; if (dt <= 0) continue;
      const wpm = 12 / (dt / 60); if (!best || wpm > best.wpm) best = { wpm, t: words[i].t };
    }
    const sentences = sentenceSplit(words);
    const fillerSentence = sentences.map(s => ({ ...s, n: s.words.filter(w => FILLER_RE.test(w.w.replace(/[^\w ]/g, "")) || /^you$/i.test(w.w)).length }))
      .sort((a, b) => b.n - a.n)[0];
    return {
      pace: { value: pace, evidence: best && best.wpm > 160 ? [{ t: best.t, text: `Pace rises to about ${Math.round(best.wpm)} words per minute here.` }] : [] },
      fillers: { value: fpm, evidence: fillerSentence && fillerSentence.n >= 2 ? [{ t: fillerSentence.t, text: `"${trimQuote(fillerSentence.text)}" (${fillerSentence.n} fillers in one sentence)` }] : [] },
      pauses: { value: gaps.length, evidence: gaps.slice(0, 2).map(g => ({ t: g.t, text: `Pause of ${g.g.toFixed(1)} seconds.` })) }
    };
  }
  function sentenceSplit(words) {
    const out = []; let cur = [];
    words.forEach(w => { cur.push(w); if (/[.?!]$/.test(w.w)) { out.push(cur); cur = []; } });
    if (cur.length) out.push(cur);
    return out.map(ws => ({ t: ws[0].t, words: ws, text: ws.map(w => w.w).join(" ") }));
  }
  const trimQuote = s => s.length > 120 ? s.slice(0, 117).replace(/\s\S*$/, "") + "…" : s;

  /* Build a timed transcript from a sample answer to simulate speech-to-text */
  function synthTranscript(text, pace, fpm, nPauses, r) {
    const base = text.split(/\s+/);
    const minutes = base.length / pace;
    const nFill = Math.round(fpm * minutes);
    const fillers = ["um,", "uh,", "like,", "um,", "you know,"];
    const ws = [...base];
    for (let k = 0; k < nFill; k++) { const pos = 1 + Math.floor(r() * (ws.length - 2)); fillers[k % fillers.length].split(" ").reverse().forEach(f => ws.splice(pos, 0, f)); }
    const ends = ws.map((w, i) => /[.?!]$/.test(w) ? i : -1).filter(i => i >= 0 && i < ws.length - 1);
    const pauseAt = new Set(); for (let k = 0; k < nPauses && ends.length; k++) pauseAt.add(ends.splice(Math.floor(r() * ends.length), 1)[0]);
    let t = 0.8; const out = [];
    const step = 60 / pace;
    ws.forEach((w, i) => { out.push({ w, t: round1(t) }); t += step * (0.8 + r() * 0.4) * (FILLER_RE.test(w.replace(/[^\w ]/g, "")) ? 0.7 : 1); if (pauseAt.has(i)) t += 2.2 + r() * 1.3; });
    return { words: out, duration: round1(t + 0.6) };
  }

  /* Content measures (stand-in for the generative AI rubric) */
  const EI_CUES = {
    empathy: /\b(understand|felt|feel|worried|listened|listen|their side|upset|asked what)\b/i,
    motivation: /\b(goal|want|because|enjoy|target|kept|finished|learn)\b/i,
    self_awareness: /\b(weakness|realised|realized|learned|feedback|improv|honest|i was)\b/i
  };
  const STAR_PARTS = ["Situation", "Task", "Action", "Result"];
  function pickQuote(words, re) {
    const s = sentenceSplit(words); const hit = s.find(x => re.test(x.text)) || s[Math.min(1, s.length - 1)];
    return hit ? { t: hit.t, text: `"${trimQuote(hit.text.replace(/\b(um|uh|like|you know),?\s*/gi, ""))}"` } : null;
  }

  /* True underlying skill used to simulate results (improves with practice and passed lessons) */
  function trueSkill(userId, comp, r) {
    const prior = sessionsOf(userId).filter(s => s.compScores?.[comp] != null);
    const last = prior.at(-1)?.compScores[comp];
    const base = last != null ? last : 5.2;
    const lessonsPassed = db().lessonProgress.filter(p => p.userId === userId && p.status === "passed" && M.lessonById(p.lessonId).comp === comp && (!prior.length || p.completedAt > prior.at(-1).completedAt)).length;
    return clamp(base + 0.35 + lessonsPassed * 0.6 + noise(r) * 0.6, 1.5, 9.6);
  }

  /* Measure one answer. measured = components measured in this session */
  function measureAnswer(ans, q, skills, measured, opts, r) {
    const m = {};
    const tq = skills[q.comp] ?? 5;
    let words = ans.words, duration = ans.duration;
    if (!words || words.length < 12) {
      const tsr = skills.self_regulation ?? 6;
      const pace = tsr >= 8 ? 140 + noise(r) * 15 : 160 + (8 - tsr) * 7 + noise(r) * 5;
      const fpm = Math.max(0.3, (9 - tsr) * 1.0 + noise(r) * 0.4);
      const np = Math.max(0, Math.round((8 - tsr) * 0.8 + noise(r) * 0.8));
      const s = synthTranscript(M.SAMPLE_ANSWERS[q.comp], pace, fpm, np, r);
      words = s.words; duration = s.duration; ans.simulated = true;
    }
    ans.words = words; ans.duration = duration;
    ans.transcript = words.map(w => w.w).join(" ");

    // 1. relevance (all sessions)
    const rel = clamp(Math.round(1 + tq / 2.5 + noise(r) * 0.5), 1, 5);
    m.relevance = { value: rel, reason: rel >= 4 ? "Answers the question and links it to the role." : rel === 3 ? "Answers the question but the link to the role is general." : "Only partly answers what was asked." };
    // 2. EI shown in the answer
    if (EI_CUES[q.comp] && measured.includes(q.comp)) {
      const v = tq >= 7.2 ? "shown" : tq >= 4.5 ? "partly" : "not";
      m.ei_shown = { value: v, evidence: [pickQuote(words, EI_CUES[q.comp])].filter(Boolean) };
    }
    // 3. STAR + 7/8 camera measures (social skill)
    if (measured.includes("social_skill")) {
      const ts = skills.social_skill ?? 5;
      const c = clamp(Math.round(ts / 2.5 + 0.4 + noise(r) * 0.5), 1, 4);
      const present = { 4: [0, 1, 2, 3], 3: [0, 1, 2], 2: [0, 2], 1: [0] }[c];
      const parts = STAR_PARTS.map((p, i) => ({ p, ok: present.includes(i) }));
      m.star = { value: parts.filter(x => x.ok).length, parts };
      if (!opts.cameraMeasures) { m.eye = { notMeasured: "Camera measures are turned off." }; m.smile = { notMeasured: "Camera measures are turned off." }; }
      else if (opts.lowLight) {
        const why = "Low lighting: eye contact could not be measured reliably, so it is shown as not measured and does not count toward your level.";
        m.eye = { notMeasured: why }; m.smile = { notMeasured: "Low lighting: smiling could not be measured reliably." };
      } else {
        const eye = Math.round(clamp(ts * 7.5 + noise(r) * 8, 15, 96));
        const smile = Math.round(clamp(ts * 3 + noise(r) * 5, 2, 55));
        m.eye = { value: eye, evidence: eye < 60 ? [{ t: round1(duration * (0.35 + r() * 0.3)), text: "Gaze moves away from the camera for several seconds while answering." }] : [] };
        m.smile = { value: smile, evidence: [] };
      }
    }
    // 4–6 speech measures (self-regulation)
    if (measured.includes("self_regulation")) Object.assign(m, speechMeasures(words, duration));
    // scores
    Object.entries(m).forEach(([k, x]) => { if (x.value != null) { x.score = round1(scoreOf[k](x.value)); x.ok = meetsTarget[k](x.value); } });
    ans.measures = m;
    return ans;
  }

  /* Per-answer score for a component, 0–10 */
  function answerCompScore(ans, comp) {
    const m = ans.measures || {};
    const pick = keys => mean(keys.map(k => m[k]?.score).filter(v => v != null));
    if (comp === "self_regulation") return pick(["pace", "fillers", "pauses"]);
    if (comp === "social_skill") return pick(["star", "eye", "smile"]);
    if (comp === "self_awareness") return ans.comp === "self_awareness" ? pick(["ei_shown", "relevance"]) : null;
    return ans.comp === comp ? pick(["ei_shown", "relevance"]) : null;
  }
  const toFive = s => clamp(Math.round(1 + s * 0.4), 1, 5);

  function criteriaFor(session, comp) {
    // per question: relevance + the question's component + (in full sessions) delivery and structure
    const c = ["relevance", comp];
    if (session.type === "full") { if (comp !== "self_regulation") c.push("self_regulation"); if (comp !== "social_skill") c.push("social_skill"); }
    return [...new Set(c)];
  }

  /* Session analysis after self-rating. Returns earned badge ids. */
  function analyseSession(session, opts = {}) {
    const r = rngFrom(session.id);
    const measured = session.type === "full" ? M.COMPONENTS.map(c => c.id) : [session.focus];
    const skills = opts.skills || Object.fromEntries(M.COMPONENTS.map(c => [c.id, trueSkill(session.userId, c.id, r)]));
    session.measured = measured;
    session.answers.forEach(a => {
      const q = questionById(a.qid);
      if (!(opts.reuse && a.measures)) measureAnswer(a, q, skills, measured, { cameraMeasures: session.cameraMeasures, lowLight: session.lowLight }, r);
      // system result per criterion on the same 1–5 scale as the self-rating
      a.system = {};
      criteriaFor(session, a.comp).forEach(cr => {
        if (cr === "relevance") a.system[cr] = a.measures.relevance.value;
        else { const s = answerCompScore(a, cr); a.system[cr] = s == null ? null : toFive(s); }
      });
      const gaps = Object.keys(a.system).filter(k => a.system[k] != null && a.selfRatings?.[k] != null).map(k => Math.abs(a.selfRatings[k] - a.system[k]));
      a.gap = gaps.length ? round1(mean(gaps)) : null;
      if (measured.includes("self_awareness") && a.gap != null) a.measures.gap = { value: a.gap, score: round1(scoreOf.gap(a.gap)), ok: a.gap <= 1 };
    });
    session.compScores = {};
    M.COMPONENTS.forEach(c => {
      if (!measured.includes(c.id)) { session.compScores[c.id] = null; return; }
      let vals;
      if (c.id === "self_awareness") vals = session.answers.flatMap(a => [a.measures.gap?.score, a.comp === "self_awareness" ? a.measures.ei_shown?.score : null]).filter(v => v != null);
      else vals = session.answers.map(a => answerCompScore(a, c.id)).filter(v => v != null);
      session.compScores[c.id] = vals.length ? round1(mean(vals)) : null;
    });
    session.completedAt = session.completedAt || new Date().toISOString();
    session.status = "complete";
    return evaluateBadges(session.userId, session);
  }

  /* ---------------- gamification & personalisation rules ---------------- */
  function sessionsOf(userId) { return db().sessions.filter(s => s.userId === userId && s.status === "complete").sort((a, b) => a.completedAt.localeCompare(b.completedAt)); }
  function skillProfile(userId) { // latest measured score per component (SkillProfile)
    const out = {}; M.COMPONENTS.forEach(c => out[c.id] = { score: null, prev: null, sessionNo: null });
    sessionsOf(userId).forEach((s, i) => M.COMPONENTS.forEach(c => { const v = s.compScores?.[c.id]; if (v != null) { out[c.id].prev = out[c.id].score; out[c.id].score = v; out[c.id].sessionNo = i + 1; } }));
    return out;
  }
  function weekIndex(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return Math.round(x.getTime() / 604800000); }
  function streak(userId) {
    const weeks = new Set(sessionsOf(userId).map(s => weekIndex(s.completedAt)));
    let w = weekIndex(new Date()); if (!weeks.has(w)) w--; let n = 0;
    while (weeks.has(w)) { n++; w--; }
    return n;
  }
  function suggestion(userId) {
    const prof = skillProfile(userId); const ss = sessionsOf(userId);
    if (!ss.length) return { type: "full", why: "Start with a full session: one question for each of the five skills, so Miran can find your starting level." };
    const unmeasured = M.COMPONENTS.filter(c => prof[c.id].score == null);
    if (unmeasured.length) return { type: "full", why: `${unmeasured.map(c => c.name).join(", ")} ${unmeasured.length > 1 ? "have" : "has"} not been measured yet.` };
    const lastTwo = ss.slice(-2);
    const sorted = M.COMPONENTS.map(c => ({ c, s: prof[c.id].score })).sort((a, b) => a.s - b.s);
    const weakest = sorted[0];
    if (lastTwo.length === 2 && lastTwo.every(s => s.type === "focus" && s.focus === weakest.c.id) && weakest.s >= 6) {
      return { type: "full", why: `Your last two sessions focused on ${weakest.c.name.toLowerCase()}. A full session re-checks all five skills.` };
    }
    const lessonId = M.LESSON_FOR_COMP[weakest.c.id];
    return { type: "focus", focus: weakest.c.id, lessonId,
      why: `${weakest.c.name} is ${weakest.s.toFixed(1)} / 10, the lowest of your five skills. Rule: suggest a focus session on the lowest skill.` };
  }
  function evaluateBadges(userId, session) {
    const have = new Set(db().badges.filter(b => b.userId === userId).map(b => b.badgeId));
    const ss = sessionsOf(userId).concat(session && !db().sessions.includes(session) ? [session] : []);
    const earned = [];
    const give = id => { if (!have.has(id)) { have.add(id); earned.push(id); db().badges.push({ userId, badgeId: id, earnedAt: session?.completedAt || new Date().toISOString(), sessionId: session?.id }); } };
    if (ss.length >= 1) give("first");
    if (ss.some(s => s.type === "full")) give("full");
    if (ss.some(s => s.type === "focus")) give("focus");
    if (session && session.measured?.includes("self_regulation") && session.answers.every(a => a.measures.pace?.ok)) give("calm");
    if (session && session.answers.every(a => Object.keys(a.system || {}).every(c => a.system[c] == null || (a.selfRatings?.[c] != null && Math.abs(a.selfRatings[c] - a.system[c]) <= 1)))) give("accurate");
    if (db().lessonProgress.filter(p => p.userId === userId && p.status === "passed").length >= 3) give("learner");
    if (streak(userId) >= 3) give("streak3");
    if (session) session.badgesEarned = earned;
    return earned;
  }

  /* ---------------- questions ---------------- */
  function allQuestions() { const d = db(); return M.QUESTIONS.concat(d.customQuestions || []).filter(q => !(d.disabledQuestions || []).includes(q.id)); }
  function questionById(id) { return M.QUESTIONS.concat(db().customQuestions || []).find(q => q.id === id); }
  function personFor(fieldId) { return (M.FIELDS.find(f => f.id === fieldId) || M.FIELDS[0]).person; }
  function qText(q, fieldId) { return q.text.replace(/\{person\}/g, personFor(fieldId)); }
  function selectQuestions({ type, focus, difficulty, fieldId, userId, seed }) {
    const r = rngFrom(seed || Date.now());
    const used = new Set(sessionsOf(userId).slice(-2).flatMap(s => s.answers.map(a => a.qid)));
    const pool = allQuestions().filter(q => !q.fields || q.fields.includes(fieldId));
    const pick = (list, n) => {
      const sorted = list.map(q => ({ q, k: (q.diff === difficulty ? 0 : 2) + (used.has(q.id) ? 1 : 0) + r() })).sort((a, b) => a.k - b.k);
      return sorted.slice(0, n).map(x => x.q);
    };
    if (type === "full") return M.COMPONENTS.map(c => pick(pool.filter(q => q.comp === c.id), 1)[0]).filter(Boolean);
    return pick(pool.filter(q => q.comp === focus), 5);
  }
  function matchField(text) {
    const t = " " + (text || "").toLowerCase() + " ";
    let best = null;
    M.FIELDS.forEach(f => { const n = f.keywords.filter(k => t.includes(k)).length; if (n && (!best || n > best.n)) best = { f, n }; });
    return best?.f || null;
  }

  /* ---------------- progress chart (SVG) ----------------
     Y axis: 0–10 score scale (#116). Focus sessions only measure one skill,
     so other skills have no point for that session (#117). */
  function progressChart(el, userId) {
    const ss = sessionsOf(userId).slice(-8);
    if (!ss.length) { el.innerHTML = `<div class="empty">Your progress graph appears after your first session.</div>`; return; }
    const W = 760, H = 270, L = 58, R = 44, T = 14, B = 52;
    const x = i => L + (ss.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (ss.length - 1));
    const y = v => T + (10 - v) * (H - T - B) / 10;
    const hidden = new Set(JSON.parse(sessionStorage.getItem("miran.chart.off") || "[]"));
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Progress by skill">`;
    for (let v = 0; v <= 10; v += 2) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#E8EDF7"/><text x="${L - 10}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6B7896">${v}</text>`;
    svg += `<text x="12" y="${(T + H - B) / 2}" font-size="11" fill="#6B7896" transform="rotate(-90 12 ${(T + H - B) / 2})" text-anchor="middle">${M.SCALE.label}</text>`;
    ss.forEach((s, i) => {
      svg += `<text x="${x(i)}" y="${H - B + 18}" text-anchor="middle" font-size="11.5" fill="#33405F" font-weight="600">S${sessionsOf(userId).indexOf(s) + 1}</text>`;
      svg += `<text x="${x(i)}" y="${H - B + 33}" text-anchor="middle" font-size="10.5" fill="#6B7896">${s.type === "full" ? "Full" : "Focus · " + M.compById(s.focus).short}</text>`;
    });
    M.COMPONENTS.forEach(c => {
      if (hidden.has(c.id)) return;
      const pts = ss.map((s, i) => s.compScores?.[c.id] != null ? [x(i), y(s.compScores[c.id]), s, i] : null).filter(Boolean);
      if (pts.length > 1) svg += `<polyline fill="none" stroke="${c.color}" stroke-width="2.4" stroke-linejoin="round" points="${pts.map(p => p[0] + "," + p[1]).join(" ")}"/>`;
      pts.forEach(p => svg += `<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#fff" stroke="${c.color}" stroke-width="2.4" data-tip="${esc(c.name)} · S${sessionsOf(userId).indexOf(p[2]) + 1}: ${p[2].compScores[c.id].toFixed(1)} / 10"/>`);
    });
    svg += `</svg>`;
    el.innerHTML = `<div class="chart-legend" style="margin-bottom:8px">${M.COMPONENTS.map(c => `<span data-c="${c.id}" class="${hidden.has(c.id) ? "off" : ""}"><i style="background:${c.color}"></i>${c.name}</span>`).join("")}</div>
      <div class="chart-wrap">${svg}<div class="chart-tip"></div></div>`;
    const tip = $(".chart-tip", el), wrap = $(".chart-wrap", el);
    $$(".pt", el).forEach(p => {
      p.addEventListener("mouseenter", () => { const b = p.getBoundingClientRect(), w = wrap.getBoundingClientRect(); tip.textContent = p.dataset.tip; tip.style.left = (b.left - w.left + b.width / 2) + "px"; tip.style.top = (b.top - w.top) + "px"; tip.style.opacity = 1; });
      p.addEventListener("mouseleave", () => tip.style.opacity = 0);
    });
    $$(".chart-legend span", el).forEach(s => s.onclick = () => { hidden.has(s.dataset.c) ? hidden.delete(s.dataset.c) : hidden.add(s.dataset.c); sessionStorage.setItem("miran.chart.off", JSON.stringify([...hidden])); progressChart(el, userId); });
  }

  /* ---------------- demo data ---------------- */
  async function seed() {
    const now = Date.now(), day = 86400000;
    const d = { version: 1, users: [], sessions: [], lessonProgress: [], badges: [], customQuestions: [], disabledQuestions: [] };
    M._db = d;
    const sara = { id: "u_sara", type: "candidate", name: "Sara Alharbi", email: M.DEMO.email, pwHash: await hash(M.DEMO.password),
      createdAt: new Date(now - 40 * day).toISOString(), fieldId: "customer_service", role: "Customer service representative",
      interviewDate: new Date(now + 12 * day).toISOString().slice(0, 10), consentAt: new Date(now - 40 * day).toISOString(), cameraMeasures: true, autoDelete30: false };
    const admin = { id: "u_admin", type: "admin", name: "Miran Admin", email: M.DEMO.admin, pwHash: await hash(M.DEMO.adminPassword), createdAt: new Date(now - 60 * day).toISOString(), consentAt: new Date().toISOString() };
    d.users.push(sara, admin);
    const plan = [
      { ago: 33, type: "full", sk: { self_awareness: 5.0, self_regulation: 3.4, motivation: 6.4, empathy: 5.6, social_skill: 5.2 }, bias: 1.2 },
      { ago: 26, type: "full", sk: { self_awareness: 5.4, self_regulation: 3.9, motivation: 6.8, empathy: 6.1, social_skill: 5.7 }, bias: 1.0 },
      { ago: 19, type: "focus", focus: "self_regulation", sk: { self_regulation: 3.8 }, bias: 1.0 },
      { ago: 12, type: "full", sk: { self_awareness: 6.2, self_regulation: 3.9, motivation: 7.2, empathy: 6.3, social_skill: 6.5 }, bias: 0.7 },
      { ago: 5, type: "focus", focus: "self_regulation", sk: { self_regulation: 4.3 }, bias: 0.8, lowLight: false }
    ];
    plan.forEach((p, i) => {
      const s = { id: "s_demo" + (i + 1), userId: sara.id, type: p.type, focus: p.focus || null, difficulty: i < 2 ? "basic" : i === 3 ? "advanced" : "basic",
        fieldId: sara.fieldId, role: sara.role, jd: "", cameraMeasures: true, lowLight: i === 3,
        startedAt: new Date(now - p.ago * day - 1800000).toISOString(), completedAt: new Date(now - p.ago * day).toISOString() };
      const qsSel = selectQuestions({ type: p.type, focus: p.focus, difficulty: s.difficulty, fieldId: s.fieldId, userId: sara.id, seed: 100 + i });
      const r = rngFrom(900 + i);
      s.answers = qsSel.map(q => ({ qid: q.id, comp: q.comp }));
      // simulate self-ratings: Sara rates herself higher than the evidence, less so over time
      const sk = Object.fromEntries(M.COMPONENTS.map(c => [c.id, p.sk[c.id] ?? 6]));
      analyseSession(s, { skills: sk }); // first pass: Miran's result per criterion
      s.answers.forEach(a => { a.selfRatings = {}; Object.keys(a.system).forEach(cr => { a.selfRatings[cr] = clamp(Math.round((a.system[cr] ?? 3) + p.bias * (cr === "self_regulation" ? 1.5 : 0.5) + noise(r) * 0.6), 1, 5); }); });
      analyseSession(s, { skills: sk, reuse: true }); // second pass: gaps and self-awareness
      d.sessions.push(s);
    });
    // lesson progress (LessonProgress)
    d.lessonProgress.push(
      { userId: sara.id, lessonId: "L2", status: "passed", openedAt: new Date(now - 25 * day).toISOString(), quizScore: 3, completedAt: new Date(now - 25 * day).toISOString() },
      { userId: sara.id, lessonId: "L4", status: "passed", openedAt: new Date(now - 24 * day).toISOString(), quizScore: 2, completedAt: new Date(now - 24 * day).toISOString() },
      { userId: sara.id, lessonId: "L1", status: "open", openedAt: new Date(now - 4 * day).toISOString(), quizScore: null, completedAt: null }
    );
    d.sessions.forEach(s => s.badgesEarned = []);
    d.badges = [];
    // award badges in order
    const order = d.sessions.slice();
    d.sessions = [];
    order.forEach(s => { d.sessions.push(s); evaluateBadges(sara.id, s); });
    save(d);
  }

  async function init() {
    M._db = load();
    if (!M._db) await seed();
    // retention rule: auto-delete recordings older than 30 days when the user chose it
    const u = auth.current();
    if (u?.autoDelete30) db().sessions.filter(s => s.userId === u.id && s.completedAt && daysBetween(s.completedAt, new Date()) > 30)
      .forEach(s => { if (s.hasVideo) { rec.clearPrefix(s.id); s.hasVideo = false; } });
    commit();
  }

  Object.assign(M, {
    $, $$, esc, uid, clamp, round1, mean, fmtTime, fmtDate, daysBetween, qs, rngFrom,
    db, commit, hash, auth, shell, toast, modal, showBadges, rec,
    engine: { analyseSession, sessionsOf, skillProfile, streak, suggestion, evaluateBadges, criteriaFor, scoreOf, meetsTarget, answerCompScore, speechMeasures, toFive },
    allQuestions, questionById, qText, selectQuestions, matchField, progressChart,
    resetDemo: async () => { localStorage.removeItem(DB_KEY); localStorage.removeItem(AUTH_KEY); await rec.clearPrefix(""); location.href = "index.html"; }
  });
  const engine = M.engine;
  M.ready = init();
})();
