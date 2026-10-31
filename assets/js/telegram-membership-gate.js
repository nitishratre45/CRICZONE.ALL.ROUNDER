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
    #cz-tg-gate{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:20px;padding-top:max(20px,env(safe-area-inset-top));padding-bottom:max(20px,env(safe-area-inset-bottom));background:rgba(3,8,13,.8);backdrop-filter:blur(14px) saturate(125%);-webkit-backdrop-filter:blur(14px) saturate(125%);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;animation:czGateFade .22s ease-out}
    #cz-tg-gate.cz-open{display:flex}
    #cz-tg-card{position:relative;isolation:isolate;overflow:hidden;width:min(100%,430px);padding:30px 25px 24px;border:1px solid rgba(255,255,255,.13);border-radius:26px;background:radial-gradient(ellipse at 50% -15%,rgba(47,190,125,.2),transparent 48%),linear-gradient(155deg,#14251f 0%,#0b1512 58%,#09110f 100%);color:#f4fff8;box-shadow:0 28px 100px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.06);text-align:center;animation:czGateRise .28s cubic-bezier(.2,.8,.2,1)}
    #cz-tg-card:before{content:"";position:absolute;z-index:-1;top:0;left:12%;right:12%;height:1px;background:linear-gradient(90deg,transparent,rgba(126,244,177,.7),transparent)}
    #cz-tg-card .cz-mark{display:grid;place-items:center;overflow:hidden;width:66px;height:66px;margin:0 auto 17px;border:2px solid rgba(126,244,177,.65);border-radius:50%;background:#10251b;box-shadow:0 0 0 5px rgba(126,244,177,.09),0 8px 28px rgba(0,0,0,.3)}
    #cz-tg-card .cz-mark img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#10251b;border-radius:50%}
    #cz-tg-card .cz-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(126,244,177,.17);border-radius:99px;background:rgba(28,94,63,.28);color:#91efb8;font-size:10px;font-weight:800;letter-spacing:1.15px}
    #cz-tg-card .cz-badge:before{content:"";width:6px;height:6px;border-radius:50%;background:#68e5a0;box-shadow:0 0 10px #68e5a0}
    #cz-tg-card h2{margin:17px 0 10px;font-size:clamp(25px,7vw,30px);font-weight:800;letter-spacing:-.8px;line-height:1.12}
    #cz-tg-card p{max-width:340px;margin:0 auto 22px;color:#aebdb4;font-size:14px;line-height:1.65}
    #cz-tg-card .cz-btn{position:relative;display:flex;width:100%;min-height:54px;align-items:center;justify-content:center;gap:10px;margin-top:12px;padding:13px 16px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:linear-gradient(180deg,#269fe0,#1688c6);color:#fff;font-size:14px;font-weight:750;letter-spacing:.1px;text-decoration:none;cursor:pointer;box-shadow:0 8px 22px rgba(17,137,200,.19);transition:transform .18s ease,filter .18s ease}
    #cz-tg-card .cz-btn:active{transform:scale(.985)}
    #cz-tg-card .cz-btn:focus-visible{outline:3px solid rgba(126,244,177,.75);outline-offset:3px}
    #cz-tg-card .cz-btn.cz-join{border-color:rgba(124,245,176,.2);background:linear-gradient(180deg,#239b62,#167b4b);box-shadow:0 8px 22px rgba(23,139,83,.2)}
    #cz-tg-card .cz-btn:disabled{opacity:.68;cursor:wait;box-shadow:none}
    #cz-tg-card .cz-btn .cz-btn-icon{font-size:18px;line-height:1}
    #cz-tg-card .cz-small{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);color:#899b90;font-size:11px;line-height:1.5}
    #cz-tg-card .cz-small:before{content:"🔒";font-size:12px}
    #cz-tg-card .cz-error{min-height:17px;margin-top:10px;color:#ffb4a8;font-size:12px;line-height:1.45}
    @keyframes czGateFade{from{opacity:0}to{opacity:1}}
    @keyframes czGateRise{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    @media(hover:hover){#cz-tg-card .cz-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}}
    @media(max-width:380px){#cz-tg-card{padding:25px 19px 20px;border-radius:23px}#cz-tg-card .cz-mark{width:58px;height:58px;margin-bottom:14px}#cz-tg-card p{font-size:13px}}
    @media(prefers-reduced-motion:reduce){#cz-tg-gate,#cz-tg-card{animation:none}#cz-tg-card .cz-btn{transition:none}}
  `;
  document.head.appendChild(style);
  root.innerHTML = `<section id="cz-tg-card" role="dialog" aria-modal="true" aria-labelledby="cz-tg-title">
    <div class="cz-mark"><img src="https://criczone.pages.dev/photos/photo_2026-10-28_14-52-23.jpg" alt="CRICZONE cricket profile" loading="eager"></div>
    <span class="cz-badge">CRICZONE MEMBER ACCESS</span>
    <h2 id="cz-tg-title">Unlock for 12 Hours</h2>
    <p>Tap Join to connect Telegram, then join our channel. This page unlocks automatically when membership is confirmed.</p>
    <a class="cz-btn cz-join" id="cz-tg-join" href="${JOIN}" rel="noopener"><span class="cz-btn-icon" aria-hidden="true">✈</span>Join &amp; Unlock Access</a>
    <button class="cz-btn" id="cz-tg-continue" type="button"><span class="cz-btn-icon" aria-hidden="true">▶</span>Continue with Telegram Bot</button>
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

  const joinBtn = document.getElementById("cz-tg-join");
  const isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") ||
    (navigator.userAgentData && navigator.userAgentData.mobile === true);

  async function beginJoinVerification() {
    if (started || verified) return;
    started = true;
    const error = document.getElementById("cz-tg-error");
    joinBtn.textContent = "Connecting to Telegram...";
    joinBtn.setAttribute("aria-disabled", "true");
    error.textContent = "";
    try {
      const r = await fetch(API + "/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ return_url: location.href })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.bot_url || !d.nonce) throw new Error(d.error || "Could not start verification.");
      saveNonce(d.nonce);
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = window.setInterval(pollLoginStatus, 1500);
      // Link the Telegram account first; the bot then offers the channel join button.
      if (isPhone) window.location.assign(d.bot_url);
      else {
        const tab = window.open(d.bot_url, "_blank", "noopener");
        if (!tab) window.location.assign(d.bot_url);
      }
    } catch (e) {
      error.textContent = e.message || "Please try again.";
      joinBtn.innerHTML = '<span class="cz-btn-icon" aria-hidden="true">✈</span>Join &amp; Unlock Access';
      joinBtn.removeAttribute("aria-disabled");
      started = false;
    }
  }

  joinBtn.addEventListener("click", event => {
    event.preventDefault();
    beginJoinVerification();
  });

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
      // Phones: open Telegram in the current browser context so the device can hand the t.me link to Telegram.
      // Desktop: keep the existing new-tab behavior.
      if (isPhone) {
        window.location.assign(d.bot_url);
      } else {
        const tab = window.open(d.bot_url, "_blank", "noopener");
        if (!tab) window.location.assign(d.bot_url);
      }
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