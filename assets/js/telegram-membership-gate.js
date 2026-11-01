(function () {
  "use strict";
  if (window.__CZ_TELEGRAM_MEMBERSHIP_GATE__) return;
  window.__CZ_TELEGRAM_MEMBERSHIP_GATE__ = true;

  const CHANNEL_URL = "https://t.me/criczonelive";
  const START_API = "/api/telegram/start";
  const STATUS_API = "/api/telegram/status";
  const SESSION_API = "/api/telegram/session";
  const POLL_MS = 3000;
  const MAX_WAIT_MS = 5 * 60 * 1000;

  let nonce = "";
  let pollTimer = 0;
  let pollStartedAt = 0;
  let busy = false;
  let dismissed = false;

  const style = document.createElement("style");
  style.textContent = `
    #cz-member-overlay{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:18px;padding-top:max(18px,env(safe-area-inset-top));padding-bottom:max(18px,env(safe-area-inset-bottom));background:rgba(3,7,13,.58);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    #cz-member-overlay.cz-visible{display:flex;animation:czMemberFade .2s ease}
    #cz-member-card{position:relative;width:min(100%,420px);max-height:min(88dvh,760px);overflow:auto;border:1px solid rgba(255,255,255,.16);border-radius:26px;background:linear-gradient(155deg,#172b40 0%,#101a2a 48%,#09111e 100%);color:#f8fafc;text-align:center;box-shadow:0 28px 90px #000c;animation:czMemberRise .28s ease}
    #cz-member-card:before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#ffcf55,#f28a20)}
    #cz-member-card .cz-member-photo{display:block;width:100%;height:clamp(130px,24vh,190px);object-fit:cover;object-position:center 38%;border-bottom:1px solid #ffffff18}
    #cz-member-card .cz-member-icon{width:54px;height:54px;display:grid;place-items:center;margin:18px auto 13px;border:1px solid #229ed966;border-radius:17px;background:#229ed91c;color:#55c6ff;font-size:25px}
    #cz-member-card .cz-member-content{padding:0 25px 24px}
    #cz-member-card .cz-member-tag{display:inline-block;padding:6px 11px;border:1px solid #66501e;border-radius:99px;background:#302612;color:#ffd36b;font-size:10px;font-weight:850;letter-spacing:1px}
    #cz-member-card h2{margin:13px 0 9px;font-size:clamp(22px,6vw,27px);line-height:1.15;font-weight:850}
    #cz-member-card p{margin:0 auto 18px;max-width:325px;color:#b7c4d4;font-size:14px;line-height:1.55}
    #cz-member-card .cz-member-actions{display:grid;gap:10px}
    #cz-member-card .cz-member-btn{display:flex;min-height:49px;align-items:center;justify-content:center;width:100%;padding:10px 14px;border:0;border-radius:12px;background:linear-gradient(135deg,#ffc94f,#ff941c);color:#17120a;font-weight:850;font-size:14px;text-decoration:none;cursor:pointer}
    #cz-member-card .cz-member-btn:disabled{opacity:.65;cursor:wait}
    #cz-member-card .cz-member-secondary{border:1px solid #ffffff24;background:#ffffff0b;color:#e5edf7}
    #cz-member-card .cz-member-status{min-height:19px;margin:13px 0 0;color:#aab8ca;font-size:12px;line-height:1.45}
    #cz-member-card .cz-member-status.cz-error{color:#ffaaa8}
    #cz-member-card .cz-member-status.cz-success{color:#80e6ad}
    #cz-member-card .cz-member-note{display:none!important}
    #cz-member-card button:focus-visible,#cz-member-card a:focus-visible{outline:3px solid #ffd36b;outline-offset:3px}
    @keyframes czMemberFade{from{opacity:0}to{opacity:1}}
    @keyframes czMemberRise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    @media(max-width:380px){#cz-member-card .cz-member-content{padding:0 18px 21px}}
    @media(prefers-reduced-motion:reduce){#cz-member-overlay,#cz-member-card{animation:none}}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "cz-member-overlay";
  overlay.innerHTML = `
    <section id="cz-member-card" role="dialog" aria-modal="true" aria-labelledby="cz-member-title">
      <img class="cz-member-photo" src="/photos/photo_2026-10-28_14-52-23.jpg" alt="CRICZONE community">
      <div class="cz-member-icon" aria-hidden="true">✈</div>
      <div class="cz-member-content">
        <span class="cz-member-tag">CRICZONE COMMUNITY</span>
        <h2 id="cz-member-title">Verify Telegram Membership</h2>
        <p>Join our official Telegram channel and verify your membership to continue using CRICZONE.</p>
        <div class="cz-member-actions">
          <a class="cz-member-btn cz-member-secondary" href="${CHANNEL_URL}" target="_blank" rel="noopener">Join Telegram Channel</a>
          <button class="cz-member-btn" id="cz-member-verify" type="button">Continue with Telegram</button>
        </div>
        <div class="cz-member-status" id="cz-member-status" role="status" aria-live="polite">Your membership is checked securely by Telegram.</div>
      </div>
    </section>`;
  document.body.appendChild(overlay);

  const $ = id => document.getElementById(id);
  const card = $("cz-member-card");
  const status = $("cz-member-status");
  const verifyButton = $("cz-member-verify");

  function setStatus(message, type) {
    status.textContent = message;
    status.classList.remove("cz-error", "cz-success");
    if (type) status.classList.add(type);
  }

  function hidePopup() {
    overlay.classList.remove("cz-visible");
    document.body.style.overflow = "";
    dismissed = true;
  }

  function showPopup() {
    if (dismissed || !overlay.isConnected) return;
    overlay.classList.add("cz-visible");
    document.body.style.overflow = "hidden";
  }

  async function requestSession() {
    const response = await fetch(SESSION_API, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return false;
    const data = await response.json();
    return data.verified === true && data.membership_valid === true;
  }

  async function checkStatus() {
    if (!nonce) return false;
    const response = await fetch(STATUS_API + "?nonce=" + encodeURIComponent(nonce), {
      credentials: "same-origin", cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (data.verified === true) {
      clearInterval(pollTimer);
      pollTimer = 0;
      setStatus("Membership verified successfully. You are all set!", "cz-success");
      verifyButton.textContent = "Verified";
      verifyButton.disabled = true;
      window.setTimeout(hidePopup, 900);
      return true;
    }
    if (response.status === 410 || data.expired) {
      clearInterval(pollTimer);
      pollTimer = 0;
      nonce = "";
      setStatus("This verification link expired. Please try again.", "cz-error");
      verifyButton.disabled = false;
      verifyButton.textContent = "Try Again";
      return false;
    }
    if (data.membership_valid === false) {
      setStatus("Membership not detected yet. Join @criczonelive, then tap Continue with Telegram.", "cz-error");
    } else if (data.pending) {
      setStatus("Waiting for Telegram membership confirmation…");
    } else if (data.error) {
      setStatus(data.error, "cz-error");
    }
    return false;
  }

  function beginPolling() {
    clearInterval(pollTimer);
    pollStartedAt = Date.now();
    checkStatus().catch(() => setStatus("Checking Telegram…"));
    pollTimer = window.setInterval(async () => {
      if (Date.now() - pollStartedAt > MAX_WAIT_MS) {
        clearInterval(pollTimer);
        pollTimer = 0;
        setStatus("Verification timed out. Tap Continue with Telegram to try again.", "cz-error");
        verifyButton.disabled = false;
        verifyButton.textContent = "Try Again";
        return;
      }
      try { await checkStatus(); }
      catch (_) { setStatus("Connection issue. Retrying membership check…", "cz-error"); }
    }, POLL_MS);
  }

  async function startVerification() {
    if (busy) return;
    busy = true;
    verifyButton.disabled = true;
    verifyButton.textContent = "Connecting…";
    setStatus("Preparing your secure Telegram verification…");
    // Open a blank tab synchronously so mobile browsers do not block the bot link.
    const botWindow = window.open("about:blank", "_blank");
    try {
      const response = await fetch(START_API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_url: window.location.href })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.nonce || !data.bot_url) {
        if (botWindow) botWindow.close();
        throw new Error(data.error || "Could not start Telegram verification.");
      }
      nonce = data.nonce;
      if (botWindow) botWindow.location.href = data.bot_url;
      else window.location.href = data.bot_url;
      verifyButton.textContent = "Waiting for Telegram…";
      setStatus("Telegram bot opened. Press Start in the bot and make sure you have joined @criczonelive.");
      beginPolling();
    } catch (error) {
      if (botWindow && !botWindow.closed) botWindow.close();
      setStatus(error.message || "Unable to connect. Please try again.", "cz-error");
      verifyButton.disabled = false;
      verifyButton.textContent = "Try Again";
    } finally {
      busy = false;
    }
  }

  verifyButton.addEventListener("click", startVerification);
  // Mandatory gate: ignore backdrop taps and Escape; only verified membership may dismiss it.
  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  overlay.addEventListener("touchmove", event => {
    if (event.target === overlay) event.preventDefault();
  }, { passive: false });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && overlay.classList.contains("cz-visible")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  (async function init() {
    try {
      if (await requestSession()) return;
    } catch (_) { /* Fail closed: show the membership prompt if session check is unavailable. */ }
    window.setTimeout(showPopup, 5000);
  })();
})();