/* CRICZONE Telegram membership gate.
 * Requires Cloudflare Pages secret BOT_TOKEN and BotFather /setdomain for this site.
 * UI gating is not DRM: never treat it as protection for a publicly exposed stream URL.
 */
(() => {
  "use strict";
  if (window.__criczoneMembershipGateLoaded) return;
  window.__criczoneMembershipGateLoaded = true;

  const CHANNEL_URL = "https://t.me/criczonelive";
  const VERIFY_URL = "/api/telegram/verify";
  const STYLE_ID = "cz-membership-gate-style";
  const ROOT_ID = "cz-membership-gate";

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,7,18,.88);backdrop-filter:blur(14px);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f4f8ff;overflow-y:auto}
    #${ROOT_ID} [hidden]{display:none!important}
    #${ROOT_ID} .czmg-card{position:relative;width:min(100%,440px);max-height:calc(100dvh - 32px);overflow:auto;padding:26px 22px 22px;text-align:center;border:1px solid rgba(119,172,220,.28);border-radius:24px;background:radial-gradient(ellipse at 50% 0%,rgba(36,126,180,.2),transparent 55%),linear-gradient(145deg,#12243b,#070d18 76%);box-shadow:0 28px 90px #000b}
    #${ROOT_ID} .czmg-brand{display:inline-flex;align-items:center;gap:7px;margin-bottom:18px;padding:7px 11px;border:1px solid #284c6a;border-radius:999px;background:#10243a;color:#b8e7ff;font-size:11px;font-weight:800;letter-spacing:1.3px}
    #${ROOT_ID} .czmg-icon{display:grid;place-items:center;width:66px;height:66px;margin:0 auto 16px;border:1px solid #2b5875;border-radius:21px;background:linear-gradient(145deg,#163e59,#0c2238);font-size:32px;box-shadow:0 10px 32px #0005}
    #${ROOT_ID} h2{font-size:clamp(23px,6vw,29px);line-height:1.16;letter-spacing:-.6px;margin:0 0 11px;color:#fff}
    #${ROOT_ID} .czmg-lead{font-size:14px;line-height:1.65;color:#b9cadd;margin:0 auto 20px;max-width:340px}
    #${ROOT_ID} .czmg-steps{display:grid;gap:10px;margin:0 0 18px;text-align:left}
    #${ROOT_ID} .czmg-step{display:flex;align-items:flex-start;gap:11px;padding:12px;border:1px solid #203b54;border-radius:14px;background:rgba(11,26,43,.75)}
    #${ROOT_ID} .czmg-num{flex:0 0 26px;display:grid;place-items:center;width:26px;height:26px;border-radius:9px;background:#173a53;color:#8be4ff;font-size:12px;font-weight:900}
    #${ROOT_ID} .czmg-step strong{display:block;margin:1px 0 3px;color:#f4f8ff;font-size:13px}
    #${ROOT_ID} .czmg-step span{display:block;color:#a8bbcf;font-size:12px;line-height:1.45}
    #${ROOT_ID} .czmg-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:49px;padding:13px 16px;margin:10px 0;border:0;border-radius:13px;background:linear-gradient(100deg,#72f0c3,#64d5ff);color:#04131e;font-size:14px;font-weight:850;text-decoration:none;cursor:pointer;box-shadow:0 8px 24px #40c6d522;transition:transform .15s ease,filter .15s ease}
    #${ROOT_ID} .czmg-btn:hover{filter:brightness(1.06);transform:translateY(-1px)}
    #${ROOT_ID} .czmg-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
    #${ROOT_ID} .czmg-secondary{background:#152b41;border:1px solid #35536e;color:#e7f4ff;box-shadow:none}
    #${ROOT_ID} .czmg-divider{display:flex;align-items:center;gap:10px;margin:15px 0;color:#7189a2;font-size:11px}
    #${ROOT_ID} .czmg-divider:before,#${ROOT_ID} .czmg-divider:after{content:"";height:1px;flex:1;background:#263e55}
    #${ROOT_ID} .czmg-login{display:flex;justify-content:center;align-items:center;min-height:46px;margin:10px 0 4px}
    #${ROOT_ID} .czmg-status{min-height:22px;margin-top:10px;font-size:12px;line-height:1.5;color:#ffd38a;overflow-wrap:anywhere}
    #${ROOT_ID} .czmg-note{font-size:11px;line-height:1.5;color:#849ab2;margin-top:15px}
    #${ROOT_ID} .czmg-secure{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;color:#78c9a7;font-size:11px}
    @media(max-width:380px){#${ROOT_ID}{padding:10px}#${ROOT_ID} .czmg-card{padding:21px 15px 18px;max-height:calc(100dvh - 20px);border-radius:20px}#${ROOT_ID} .czmg-icon{width:56px;height:56px;font-size:28px}#${ROOT_ID} .czmg-step{padding:10px}}
    @media(prefers-reduced-motion:reduce){#${ROOT_ID} .czmg-btn{transition:none}}
  `;
  document.head.appendChild(style);

  const gate = document.createElement("div");
  gate.id = ROOT_ID;
  gate.setAttribute("role", "dialog");
  gate.setAttribute("aria-modal", "true");
  gate.innerHTML = `
    <section class="czmg-card">
      <div class="czmg-brand"><span aria-hidden="true">●</span> CRICZONE COMMUNITY</div>
      <div class="czmg-icon" aria-hidden="true">✈️</div>
      <h2>Join Telegram to Watch</h2>
      <p class="czmg-lead">Join our official public channel first, then sign in with Telegram so we can confirm your membership and unlock the player.</p>
      <div class="czmg-steps" aria-label="How to unlock the player">
        <div class="czmg-step"><div class="czmg-num">1</div><div><strong>Join the channel</strong><span>Tap the blue button below and press Join in Telegram.</span></div></div>
        <div class="czmg-step"><div class="czmg-num">2</div><div><strong>Verify your Telegram</strong><span>Come back here and use the Telegram login button.</span></div></div>
        <div class="czmg-step"><div class="czmg-num">3</div><div><strong>Start watching</strong><span>Once membership is confirmed, this popup closes automatically.</span></div></div>
      </div>
      <a class="czmg-btn" href="${CHANNEL_URL}" target="_blank" rel="noopener noreferrer" id="czmg-join"><span aria-hidden="true">✈️</span> Join @criczonelive</a>
      <div class="czmg-divider">ALREADY A MEMBER?</div>
      <div class="czmg-login" id="czmg-login"></div>
      <div class="czmg-status" id="czmg-status" role="status" aria-live="polite"></div>
      <button class="czmg-btn czmg-secondary" id="czmg-retry" type="button">↻ Check membership again</button>
      <div class="czmg-secure"><span aria-hidden="true">✓</span> Membership checked securely with Telegram</div>
      <div class="czmg-note">Just joined? Wait a few seconds, sign in above, then check again. Keep this page open while you join.</div>
    </section>`;
  gate.style.visibility = "hidden";\n  document.body.appendChild(gate);

  const status = gate.querySelector("#czmg-status");
  const retry = gate.querySelector("#czmg-retry");
  let lastTelegramUser = null;
  let verified = false;

  function setStatus(message, isError = true) {
    status.textContent = message;
    status.style.color = isError ? "#ffd38a" : "#70f0bb";
  }

  async function verify(user) {
    if (!user) {
      setStatus("Sign in with the Telegram button first.");
      return;
    }
    lastTelegramUser = user;
    retry.disabled = true;
    retry.textContent = "Checking…";
    setStatus("Checking your membership with Telegram…", false);
    try {
      const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(user)
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.member) {
        setStatus(result.error || "Membership could not be verified. Join the channel and retry.");
        return;
      }
      verified = true;
      gate.remove();
      style.remove();
      // This only unlocks the page UI; it does not secure a stream URL that is public elsewhere.
      document.dispatchEvent(new CustomEvent("criczone:membership-verified", { detail: { user: result.user } }));
    } catch {
      setStatus("Could not reach verification service. Check your connection and retry.");
    } finally {
      retry.disabled = false;
      retry.textContent = "Check membership again";
    }
  }

  window.onCriczoneTelegramAuth = function(user) {
    verify(user);
  };

  retry.addEventListener("click", () => {
    if (lastTelegramUser) verify(lastTelegramUser);
    else setStatus("Use the Telegram Login button first.");
  });

  // The Telegram Login Widget must be enabled for this domain in @BotFather (/setdomain).
  const widget = document.createElement("script");
  widget.async = true;
  widget.src = "https://telegram.org/js/telegram-widget.js?22";
  widget.setAttribute("data-telegram-login", "CRICZONE_ADMIN_BOT");
  widget.setAttribute("data-size", "large");
  widget.setAttribute("data-userpic", "false");
  widget.setAttribute("data-request-access", "write");
  widget.setAttribute("data-onauth", "onCriczoneTelegramAuth(user)");
  gate.querySelector("#czmg-login").appendChild(widget);

  // If this browser already has a valid, server-signed session, verify membership
  // without displaying the login popup again. The server rechecks Telegram membership.
  fetch("/api/telegram/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store"
  }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok && result.member) {
      verified = true;
      gate.remove();
      style.remove();
      document.dispatchEvent(new CustomEvent("criczone:membership-verified", { detail: { session: true } }));
      return;
    }
    gate.style.visibility = "visible";
  }).catch(() => {
    gate.style.visibility = "visible";
  });

  // If the browser restores this page from its back-forward cache after a Telegram
  // login/navigation, make sure the gate is mounted again rather than leaving a blank page.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !document.getElementById(ROOT_ID)) {
      window.location.reload();
    }
  });
})();