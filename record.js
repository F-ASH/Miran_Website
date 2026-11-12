/* Recording page: device check → one question per screen → record, replay, re-record */
(async function () {
  const M = window.MIRAN; await M.ready;
  const { $, $$, esc } = M;
  const u = M.auth.require("candidate");
  const s = M.db().sessions.find(x => x.id === M.qs("id") && x.userId === u.id);
  if (!s) { location.replace("setup.html"); return; }
  if (s.status === "complete") { location.replace("report.html?id=" + s.id); return; }

  const app = $("#app");
  const MAX = 120; // seconds per answer
  let stream = null, recorder = null, chunks = [], timer = null, t0 = 0, recog = null, lumaTimer = null;
  let idx = s.answers.findIndex(a => !a.recorded); if (idx < 0) idx = 0;
  const lumaSamples = [];
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  $("#exitBtn").onclick = () => {
    const m = M.modal(`<h2>Leave this session?</h2><p>Your recorded answers so far are kept as a draft. You can start a new session from Practice.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" id="st">Keep going</button><a class="btn btn-outline" href="dashboard.html">Leave</a></div>`);
    $("#st", m).onclick = () => m.remove();
  };

  /* ---------- media ---------- */
  async function getMedia() {
    if (stream) return stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: s.cameraMeasures ? { width: 1280, height: 720 } : false, audio: true }); }
    catch (e) { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e2) { stream = null; } }
    return stream;
  }
  const hasVideo = () => stream && stream.getVideoTracks().length > 0;
  const hasAudio = () => stream && stream.getAudioTracks().length > 0;
  function luma(video) {
    if (!video || video.readyState < 2) return null;
    const c = document.createElement("canvas"); c.width = 64; c.height = 36;
    const g = c.getContext("2d"); g.drawImage(video, 0, 0, 64, 36);
    const d = g.getImageData(0, 0, 64, 36).data; let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return sum / (d.length / 4);
  }

  /* ---------- 1. Device check (error prevention) ---------- */
  async function deviceCheck() {
    $("#qCounter").textContent = "Camera and microphone check";
    app.innerHTML = `
      <div class="page-head"><div><h1>Check your camera and microphone</h1><p>Miran checks your setup before recording so your measures are reliable.</p></div></div>
      <div class="rec-grid">
        <div class="video-box" id="vbox"><div class="video-placeholder"><div class="spinner"></div>Asking for camera and microphone access…</div></div>
        <div class="card">
          <h3>Setup check</h3>
          <ul class="check-list">
            <li><span>Camera</span><span id="cCam" class="tag tag-grey">Checking…</span></li>
            <li><span>Microphone</span><span style="display:flex;gap:10px;align-items:center"><span class="meter"><span id="micLvl"></span></span><span id="cMic" class="tag tag-grey">Checking…</span></span></li>
            <li><span>Lighting</span><span id="cLight" class="tag tag-grey">Checking…</span></li>
            <li><span>Live transcript</span><span id="cSr" class="tag ${SR ? "tag-green" : "tag-grey"}">${SR ? "Available" : "Not in this browser"}</span></li>
          </ul>
          <p class="small muted" id="checkNote" style="margin:12px 0"></p>
          <button class="btn btn-primary btn-block" id="goBtn" disabled>Start question 1</button>
          <button class="btn btn-ghost btn-block" id="skipMedia" style="margin-top:6px">Continue without camera (prototype)</button>
        </div>
      </div>`;
    $("#skipMedia").onclick = () => { s.noMedia = true; M.commit(); question(); };
    await getMedia();
    const vbox = $("#vbox");
    if (!stream) {
      vbox.innerHTML = `<div class="video-placeholder"><div class="silhouette"></div>Camera and microphone are not available.<br><span class="small">Allow access in your browser, or continue in prototype mode with sample answers.</span></div>`;
      $("#cCam").className = "tag tag-red"; $("#cCam").textContent = "Not available";
      $("#cMic").className = "tag tag-red"; $("#cMic").textContent = "Not available";
      $("#cLight").textContent = "—";
      $("#checkNote").textContent = "You can still walk through the session: each answer uses a sample transcript in place of your recording.";
      $("#goBtn").disabled = false; $("#goBtn").onclick = () => { s.noMedia = true; M.commit(); question(); };
      return;
    }
    if (hasVideo()) {
      vbox.innerHTML = `<video id="pv" autoplay muted playsinline></video>`;
      $("#pv").srcObject = stream;
      $("#cCam").className = "tag tag-green"; $("#cCam").textContent = "OK";
    } else {
      vbox.innerHTML = `<div class="video-placeholder"><div class="silhouette"></div>${s.cameraMeasures ? "Camera not available" : "Camera measures are off"}<br><span class="small">Your report will use content and speech only.</span></div>`;
      $("#cCam").className = s.cameraMeasures ? "tag tag-amber" : "tag tag-grey"; $("#cCam").textContent = s.cameraMeasures ? "Not found" : "Off";
      s.cameraMeasures = false;
    }
    // mic level
    let micOk = false;
    if (hasAudio()) {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)(); const an = ac.createAnalyser(); an.fftSize = 512;
        ac.createMediaStreamSource(stream).connect(an); const buf = new Uint8Array(an.fftSize);
        const tick = () => {
          if (!$("#micLvl")) { ac.close(); return; }
          an.getByteTimeDomainData(buf); let peak = 0; buf.forEach(v => peak = Math.max(peak, Math.abs(v - 128)));
          $("#micLvl").style.width = Math.min(100, peak * 2.2) + "%";
          if (peak > 6 && !micOk) { micOk = true; $("#cMic").className = "tag tag-green"; $("#cMic").textContent = "OK"; }
          requestAnimationFrame(tick);
        };
        tick();
        $("#cMic").textContent = "Say something…";
      } catch (e) { $("#cMic").className = "tag tag-green"; $("#cMic").textContent = "OK"; }
    }
    // lighting (rule #121)
    setTimeout(() => {
      const L = hasVideo() ? luma($("#pv")) : null;
      if (L == null) { $("#cLight").textContent = "—"; }
      else if (L < M.LOW_LIGHT_LUMA) { $("#cLight").className = "tag tag-amber"; $("#cLight").textContent = "Low"; $("#checkNote").textContent = "Lighting is low. Face a window or lamp; otherwise eye contact and smiling may be reported as \"not measured\"."; }
      else { $("#cLight").className = "tag tag-green"; $("#cLight").textContent = "OK"; $("#checkNote").textContent = "Everything looks good. Look at the camera lens, not the screen."; }
      $("#goBtn").disabled = false;
    }, 1200);
    $("#goBtn").onclick = () => question();
  }

  /* ---------- 2. One question per screen ---------- */
  function question() {
    const a = s.answers[idx];
    const q = M.questionById(a.qid);
    const comp = M.compById(q.comp);
    $("#qCounter").textContent = `Question ${idx + 1} of ${s.answers.length}`;
    app.innerHTML = `
      <div class="stepper">${s.answers.map((x, i) => `<div class="${i < idx ? "done" : i === idx ? "now" : ""}"></div>`).join("")}</div>
      <div class="rec-grid">
        <div>
          <div class="video-box" id="vbox"></div>
          <p class="small muted" style="margin-top:10px">Up to 2 minutes. After you stop, you can watch the answer and re-record it before moving on.</p>
        </div>
        <div class="card">
          <span class="tag">${esc(comp.name)} · ${esc(q.type)}</span>
          <div class="q-text">${esc(M.qText(q, s.fieldId))}</div>
          <p class="small"><b>Tip:</b> ${esc(q.guide.join(". "))}.</p>
          <div class="status-row" style="padding-top:12px;border-top:1px solid var(--line)">
            <span>Camera <span class="tag ${hasVideo() ? "tag-green" : "tag-grey"}">${hasVideo() ? "OK" : "Off"}</span></span>
            <span>Microphone <span class="tag ${hasAudio() ? "tag-green" : "tag-grey"}">${hasAudio() ? "OK" : "Off"}</span></span>
            <span>Transcript <span class="tag ${SR && hasAudio() ? "tag-green" : "tag-grey"}">${SR && hasAudio() ? "Live" : "Sample"}</span></span>
          </div>
          <div id="answerActions" style="margin-top:18px"></div>
        </div>
      </div>`;
    a.recorded ? review() : ready();
  }

  function ready() {
    const vbox = $("#vbox");
    vbox.innerHTML = hasVideo() ? `<video id="pv" autoplay muted playsinline></video>` : `<div class="video-placeholder"><div class="silhouette"></div>${stream ? "Audio only" : "Prototype mode"}</div>`;
    if (hasVideo()) $("#pv").srcObject = stream;
    vbox.insertAdjacentHTML("beforeend", `<div class="video-controls"><button class="btn btn-danger" id="recBtn">● Start recording</button></div>`);
    $("#answerActions").innerHTML = `<button class="btn btn-ghost btn-sm" id="sampleBtn" title="Prototype: use a sample answer instead of recording">Use a sample answer (prototype)</button>`;
    $("#recBtn").onclick = start;
    $("#sampleBtn").onclick = () => { const a = s.answers[idx]; a.recorded = true; a.simulated = true; a.words = null; a.duration = null; a.hasVideo = false; M.commit(); review(); };
  }

  function start() {
    const vbox = $("#vbox");
    const a = s.answers[idx];
    chunks = []; t0 = performance.now();
    a.words = []; let segStart = {};
    if (stream && window.MediaRecorder) {
      try { recorder = new MediaRecorder(stream); recorder.ondataavailable = e => e.data.size && chunks.push(e.data); recorder.start(250); } catch (e) { recorder = null; }
    }
    if (SR && hasAudio()) {
      try {
        recog = new SR(); recog.lang = "en-US"; recog.continuous = true; recog.interimResults = true;
        recog.onresult = ev => {
          const now = (performance.now() - t0) / 1000; let live = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (segStart[i] == null) segStart[i] = Math.max(0, now - 0.6);
            if (r.isFinal && !r._done) {
              r._done = true;
              const ws = r[0].transcript.trim().split(/\s+/).filter(Boolean);
              ws.forEach((w, k) => a.words.push({ w, t: M.round1(segStart[i] + (now - segStart[i]) * k / Math.max(1, ws.length)) }));
              if (a.words.length) a.words[a.words.length - 1].w += ".";
            } else live = r[0].transcript;
          }
          const cap = $("#liveCap"); if (cap) cap.textContent = live || a.words.slice(-12).map(w => w.w).join(" ");
        };
        recog.onerror = () => {}; recog.onend = () => { if (recorder?.state === "recording" || timer) try { recog.start(); } catch (e) {} };
        recog.start();
      } catch (e) { recog = null; }
    }
    $(".video-controls", vbox).innerHTML = `<button class="btn btn-danger" id="stopBtn">■ Stop recording</button>`;
    vbox.insertAdjacentHTML("afterbegin", `<div class="rec-badge"><span class="rec-dot"></span><span id="clock">REC 0:00 / 2:00</span></div>`);
    if (SR && hasAudio()) vbox.insertAdjacentHTML("beforeend", `<div class="live-caption" id="liveCap">Listening…</div>`);
    $("#answerActions").innerHTML = `<p class="small muted">Recording… take a breath before you start; a short pause is fine.</p>`;
    $("#stopBtn").onclick = stop;
    timer = setInterval(() => {
      const sec = (performance.now() - t0) / 1000;
      $("#clock").textContent = `REC ${M.fmtTime(sec)} / 2:00`;
      if (sec >= MAX) stop();
    }, 250);
    if (hasVideo()) lumaTimer = setInterval(() => { const L = luma($("#pv")); if (L != null) lumaSamples.push(L); }, 1500);
  }

  async function stop() {
    clearInterval(timer); timer = null; clearInterval(lumaTimer);
    const a = s.answers[idx];
    a.duration = M.round1((performance.now() - t0) / 1000);
    if (recog) { const r = recog; recog = null; r.onend = null; try { r.stop(); } catch (e) {} }
    a.recorded = true;
    if (!a.words || a.words.length < 12) { a.words = null; a.simulated = true; }
    if (recorder && recorder.state !== "inactive") {
      await new Promise(res => { recorder.onstop = res; recorder.stop(); });
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      a.hasVideo = await M.rec.put(`${s.id}_${idx}`, blob);
      s.hasVideo = s.hasVideo || a.hasVideo;
    }
    if (lumaSamples.length) s.lowLight = M.mean(lumaSamples) < M.LOW_LIGHT_LUMA;
    M.commit();
    review();
  }

  async function review() {
    const a = s.answers[idx];
    const vbox = $("#vbox");
    const blob = a.hasVideo ? await M.rec.get(`${s.id}_${idx}`) : null;
    if (blob) { vbox.innerHTML = `<video class="playback" controls playsinline></video>`; $("video", vbox).src = URL.createObjectURL(blob); }
    else vbox.innerHTML = `<div class="video-placeholder"><div class="silhouette"></div>Answer saved${a.simulated ? " (sample answer)" : ""}</div>`;
    const last = idx === s.answers.length - 1;
    $("#answerActions").innerHTML = `
      <div class="alert alert-ok" style="margin-bottom:12px">Answer ${idx + 1} saved${a.duration ? ` · ${M.fmtTime(a.duration)}` : ""}.${a.words?.length ? ` ${a.words.length} words transcribed.` : ""}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-outline" id="reBtn">↺ Re-record</button>
        <button class="btn btn-primary" id="nextBtn">${last ? "Finish and rate your answers" : "Next question →"}</button>
      </div>`;
    $("#reBtn").onclick = () => { a.recorded = false; a.words = null; a.hasVideo = false; M.commit(); ready(); };
    $("#nextBtn").onclick = () => {
      if (last) { s.status = "rating"; M.commit(); stream?.getTracks().forEach(t => t.stop()); location.href = "rate.html?id=" + s.id; }
      else { idx++; question(); }
    };
  }

  s.noMedia ? question() : deviceCheck();
})();
