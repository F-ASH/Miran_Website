/* Sign in, sign up and consent pages */
(async function () {
  const M = window.MIRAN; await M.ready;
  const { $, esc } = M;
  const page = document.body.dataset.page;

  const setErr = (input, msg) => {
    input.classList.toggle("input-error", !!msg);
    let e = input.parentElement.querySelector(".error-text");
    if (msg) { if (!e) { e = document.createElement("div"); e.className = "error-text"; input.parentElement.append(e); } e.textContent = msg; }
    else e?.remove();
  };
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

  /* ---------- Sign in ---------- */
  if (page === "signin") {
    const u = M.auth.current();
    if (u) { location.replace(u.type === "admin" ? "admin.html" : u.consentAt ? "dashboard.html" : "consent.html"); return; }
    const f = $("#signinForm");
    $("#fillDemo").onclick = () => { f.email.value = M.DEMO.email; f.password.value = M.DEMO.password; f.email.focus(); };
    $("#fillAdmin").onclick = () => { f.email.value = M.DEMO.admin; f.password.value = M.DEMO.adminPassword; };
    $("#togglePw").onclick = () => { const p = f.password; p.type = p.type === "password" ? "text" : "password"; $("#togglePw").textContent = p.type === "password" ? "Show" : "Hide"; };
    f.onsubmit = async e => {
      e.preventDefault(); $("#formAlert").classList.add("hidden");
      let ok = true;
      if (!emailOk(f.email.value)) { setErr(f.email, "Enter a valid email address."); ok = false; } else setErr(f.email);
      if (!f.password.value) { setErr(f.password, "Enter your password."); ok = false; } else setErr(f.password);
      if (!ok) return;
      const btn = $("button[type=submit]", f); btn.disabled = true; btn.textContent = "Signing in…";
      const r = await M.auth.signIn(f.email.value, f.password.value);
      if (!r.ok) { $("#formAlert").textContent = r.error; $("#formAlert").classList.remove("hidden"); btn.disabled = false; btn.textContent = "Sign in"; return; }
      location.href = r.user.type === "admin" ? "admin.html" : r.user.consentAt ? "dashboard.html" : "consent.html";
    };
    $("#forgot").onclick = e => {
      e.preventDefault();
      const m = M.modal(`<h2>Reset your password</h2><p class="muted">Enter your account email and we'll send you a link to set a new password.</p>
        <form id="resetForm"><div class="field"><label for="re">Email</label><input id="re" type="email" value="${esc(f.email.value)}" required></div>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn btn-ghost" id="rc">Cancel</button><button class="btn btn-primary">Send reset link</button></div></form>`);
      $("#rc", m).onclick = () => m.remove();
      $("#resetForm", m).onsubmit = ev => {
        ev.preventDefault(); const v = $("#re", m).value;
        if (!emailOk(v)) { setErr($("#re", m), "Enter a valid email address."); return; }
        $(".modal", m).innerHTML = `<h2>Check your inbox</h2><p>If an account exists for <b>${esc(v)}</b>, a reset link is on its way. The link expires in 30 minutes.</p><p class="small muted">Prototype: no email is actually sent.</p><button class="btn btn-primary" id="rok">Back to sign in</button>`;
        $("#rok", m).onclick = () => m.remove();
      };
    };
  }

  /* ---------- Sign up ---------- */
  if (page === "signup") {
    if (M.auth.current()) { location.replace("dashboard.html"); return; }
    const f = $("#signupForm");
    const meter = $(".pw-meter span");
    f.password.addEventListener("input", () => {
      const v = f.password.value; let s = 0;
      if (v.length >= 8) s++; if (/\d/.test(v)) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/[^\w]/.test(v) || v.length >= 12) s++;
      meter.style.width = (s * 25) + "%"; meter.style.background = ["#FA4B47", "#FA4B47", "#E39A1B", "#12A07A", "#12805C"][s];
      $("#pwHint").textContent = v ? ["Too short", "Weak", "Fair", "Good", "Strong"][s] + " · at least 8 characters, with a number" : "At least 8 characters, with a number.";
    });
    f.onsubmit = async e => {
      e.preventDefault();
      let ok = true;
      const chk = (inp, cond, msg) => { if (!cond) { setErr(inp, msg); ok = false; } else setErr(inp); };
      chk(f.name, f.name.value.trim().length >= 2, "Enter your full name.");
      chk(f.email, emailOk(f.email.value), "Enter a valid email address.");
      chk(f.password, f.password.value.length >= 8 && /\d/.test(f.password.value), "Use at least 8 characters, including a number.");
      chk(f.confirm, f.confirm.value === f.password.value && f.confirm.value, "Passwords do not match.");
      if (!f.terms.checked) { $("#termsErr").classList.remove("hidden"); ok = false; } else $("#termsErr").classList.add("hidden");
      if (!ok) { f.querySelector(".input-error")?.focus(); return; }
      const r = await M.auth.signUp({ name: f.name.value, email: f.email.value, password: f.password.value });
      if (!r.ok) { setErr(f[r.field], r.error); return; }
      location.href = "consent.html";
    };
  }

  /* ---------- Consent (shown after sign-up, before any recording) ---------- */
  if (page === "consent") {
    const u = M.auth.current();
    if (!u) { location.replace("index.html"); return; }
    $("#who").textContent = u.name.split(" ")[0];
    const f = $("#consentForm");
    f.camera.checked = u.cameraMeasures !== false;
    f.autodel.checked = !!u.autoDelete30;
    if (u.consentAt) { f.agree.checked = true; $("#consentTitle").textContent = "Your privacy choices"; }
    // role step
    const fieldSel = f.field, roleSel = f.role;
    fieldSel.innerHTML = `<option value="">Choose a field…</option>` + M.FIELDS.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
    const fillRoles = () => { const fl = M.FIELDS.find(x => x.id === fieldSel.value); roleSel.innerHTML = fl ? fl.roles.map(r => `<option>${esc(r)}</option>`).join("") : `<option value="">Choose a field first</option>`; roleSel.disabled = !fl; };
    fieldSel.onchange = fillRoles;
    if (u.fieldId) { fieldSel.value = u.fieldId; fillRoles(); roleSel.value = u.role; } else fillRoles();
    if (u.interviewDate) f.idate.value = u.interviewDate;
    f.agree.onchange = () => $("#agreeErr").classList.add("hidden");
    f.onsubmit = e => {
      e.preventDefault();
      if (!f.agree.checked) { $("#agreeErr").classList.remove("hidden"); return; }
      u.consentAt = u.consentAt || new Date().toISOString();
      u.cameraMeasures = f.camera.checked; u.autoDelete30 = f.autodel.checked;
      u.fieldId = fieldSel.value || "customer_service"; u.role = roleSel.value || M.FIELDS.find(x => x.id === u.fieldId).roles[0];
      u.interviewDate = f.idate.value || null;
      M.commit();
      location.href = "dashboard.html?welcome=1";
    };
    $("#notNow").onclick = () => {
      const m = M.modal(`<h2>Consent is needed to practise</h2><p>Miran can't record or analyse answers without your agreement. You can sign out and come back any time.</p>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" id="stay">Stay</button><button class="btn btn-outline" id="so">Sign out</button></div>`);
      $("#stay", m).onclick = () => m.remove(); $("#so", m).onclick = () => M.auth.signOut();
    };
  }
})();
