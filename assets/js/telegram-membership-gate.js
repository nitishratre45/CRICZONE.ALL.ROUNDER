(async () => {
  if (window.__CZ_TELEGRAM_GATE__) return;
  window.__CZ_TELEGRAM_GATE__ = true;

  const API = "/api/telegram";
  const JOIN = "https://t.me/criczonelive";
  const PENDING_KEY = "cz_tg_pending_nonce";
  const root = document.createElement("div");
  root.id = "cz-tg-gate";

  const style = document.createElement("style");
  style.textContent = `
    #cz-tg-gate{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,8,6,.78);backdrop-filter:blur(9px);font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    #cz-tg-gate.cz-open{display:flex}
    #cz-tg-card{width:min(100%,410px);padding:28px 23px 22px;border:1px solid rgba(255,255,255,.13);border-radius:22px;background:linear-gradient(145deg,#14231b,#09120e);color:#f4fff7;box-shadow:0 25px 90px #0009;text-align:center}
    #cz-tg-card .cz-badge{display:inline-flex;padding:7px 12px;border-radius:99px;background:#173b2a;color:#8df0b2;font-size:11px;font-weight:800;letter-spacing:1px}
    #cz-tg-card h2{margin:16px 0 8px;font-size:25px;line-height:1.15}
    #cz-tg-card p{margin:0 auto 18px;color:#a9b9af;font-size:13px;line-height:1.6}
    #cz-tg-card .cz-btn{display:flex;width:100%;min-height:48px;align-items:center;justify-content:center;margin-top:10px;border:0;border-radius:12px;background:#24a1de;color:white;font-size:14px;font-weight:800;text-decoration:none;cursor:pointer}
    #cz-tg-card .cz-btn.cz-join{background:#218b56}
    #cz-tg-card .cz-btn:disabled{opacity:.7}
    #cz-tg-card .cz-small{margin-top:14px;color:#9aa99f;font-size:11px}
    #cz-tg-card .cz-error{min-height:17px;margin-top:9px;color:#ffb4a8;font-size:12px}
  `;
  document.head.appendChild(style);
  root.innerHTML = `<section id="cz-tg-card" role="dialog" aria-modal="true" aria-labelledby="cz-tg-title">
    <span class="cz-badge">CRICZONE MEMBER ACCESS</span>
    <h2 id="cz-tg-title">Unlock for 12 Hours</h2>
    <p>Join our Telegram channel and verify your membership with our official bot to continue watching.</p>
    <a class="cz-btn cz-join" href="${JOIN}" target="_blank" rel="noopener">Join @criczonelive</a>
    <button class="cz-btn" id="cz-tg-continue" type="button">Continue with Telegram Bot</button>
    <div class="cz-error" id="cz-tg-error" aria-live="polite"></div>
    <div class="cz-small">Membership unlock remains active for 12 hours on this website.</div>
  </section>`;
  document.body.appendChild(root);

  let verified = false;
  let started = false;
  let activeNonce = "";
  let pollTimer = 0;
  let popupEnabled = true;

  const show = () => {
    if (!popupEnabled || verified) return;
    root.classList.add("cz-open");
    document.body.style.overflow = "hidden";
  };
  const hide = () => {
    root.classList.remove("cz-open");
    document.body.style.overflow = "";
  };
  const getNonce = () => {
    try { return sessionStorage.getItem(PENDING_KEY) || ""; } catch { return ""; }
  };
  const saveNonce = value => {
    activeNonce = value || "";
    try {
      if (activeNonce) sessionStorage.setItem(PENDING_KEY, activeNonce);
      else sessionStorage.removeItem(PENDING_KEY);
    } catch {}
  };

  async function sessionCheck() {
    try {
      const r = await fetch(API + "/session", { credentials: "same-origin", cache: "no-store" });
      const d = await r.json();
      if (r.ok && d.verified === true) {
        verified = true;
        saveNonce("");
        hide();
        return true;
      }
    } catch {}
    return false;
  }

  async function pollLoginStatus() {
    if (verified || !activeNonce) return false;
    try {
      const r = await fetch(API + "/status?nonce=" + encodeURIComponent(activeNonce), {
        credentials: "same-origin", cache: "no-store"
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.verified === true) {
        verified = true;
        saveNonce("");
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = 0;
        started = false;
        const btn = document.getElementById("cz-tg-continue");
        if (btn) {
          btn.textContent = "Verified — Access Unlocked";
          btn.disabled = true;
        }
        hide();
        return true;
      }
      if (r.status === 410 || d.expired) {
        saveNonce("");
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = 0;
        started = false;
        const btn = document.getElementById("cz-tg-continue");
        const error = document.getElementById("cz-tg-error");
        if (btn) { btn.textContent = "Continue with Telegram Bot"; btn.disabled = false; }
        if (error) error.textContent = "Login expired. Please try again.";
      }
    } catch {}
    return false;
  }

  async function refreshAccess() {
    if (await sessionCheck()) return;
    if (activeNonce) await pollLoginStatus();
  }

  try {
    const cfg = await fetch(API + "/settings", { credentials: "same-origin", cache: "no-store" });
    if (cfg.ok) {
      const d = await cfg.json();
      popupEnabled = d.popup_enabled === true;
    }
  } catch {}

  activeNonce = getNonce();
  if (await sessionCheck()) return;
  if (activeNonce) {
    pollLoginStatus();
    pollTimer = window.setInterval(pollLoginStatus, 1500);
  } else if (popupEnabled) {
    window.setTimeout(show, 5000);
  }

  document.getElementById("cz-tg-continue").addEventListener("click", async () => {
    if (started || verified) return;
    started = true;
    const btn = document.getElementById("cz-tg-continue");
    const error = document.getElementById("cz-tg-error");
    btn.textContent = "Connecting to Telegram...";
    btn.disabled = true;
    error.textContent = "";
    try {
      const r = await fetch(API + "/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ return_url: location.href })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.bot_url || !d.nonce) throw new Error(d.error || "Could not start Telegram verification.");
      saveNonce(d.nonce);
      if (pollTimer) clearInterval(pollTimer);
      await pollLoginStatus();
      pollTimer = window.setInterval(pollLoginStatus, 1500);
      const tab = window.open(d.bot_url, "_blank", "noopener");
      if (!tab) location.href = d.bot_url;
    } catch (e) {
      error.textContent = e.message || "Please try again.";
      btn.textContent = "Continue with Telegram Bot";
      btn.disabled = false;
      started = false;
    }
  });

  window.addEventListener("pageshow", refreshAccess);
  window.addEventListener("focus", refreshAccess);
  window.addEventListener("popstate", refreshAccess);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAccess();
  });
})();