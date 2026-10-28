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
    /* Hide legacy page-specific Telegram overlays; use one shared membership gate. */
    #telegramPopup,#tgOverlay,#telegramModal,#czTelegramPopup{display:none!important;visibility:hidden!important;pointer-events:none!important}
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(ellipse at 50% 0%,rgba(21,105,179,.24),transparent 52%),rgba(2,6,15,.88);backdrop-filter:blur(18px) saturate(125%);-webkit-backdrop-filter:blur(18px) saturate(125%);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f4f8ff;overflow-y:auto}
    #${ROOT_ID} [hidden]{display:none!important}
    #${ROOT_ID} .czmg-card{position:relative;width:min(100%,440px);max-height:calc(100dvh - 28px);overflow:auto;padding:14px 17px 19px;text-align:center;border:1px solid rgba(121,190,255,.32);border-radius:28px;background:linear-gradient(155deg,#101f33 0%,#07111e 55%,#050a12 100%);box-shadow:0 32px 100px #000e,0 0 0 1px #ffffff08,0 0 42px #168bff1b;scrollbar-width:thin;scrollbar-color:#31536f transparent}
    #${ROOT_ID} .czmg-hero{position:relative;isolation:isolate;overflow:hidden;margin:-14px -17px 17px;padding:22px 16px 20px;border-radius:27px 27px 19px 19px;background:linear-gradient(180deg,rgba(2,9,20,.04) 0%,rgba(2,9,20,.18) 27%,rgba(3,10,20,.78) 68%,#081321 100%),url("https://raw.githubusercontent.com/nitishratre45/CRICZONE.ALL.ROUNDER/main/photo_2026-10-28_14-52-23.jpg") center 28%/cover no-repeat;border-bottom:1px solid #4b9fff55;min-height:236px;display:flex;flex-direction:column;justify-content:flex-end;animation:czmgHeroIn .55s ease both}
    #${ROOT_ID} .czmg-hero:after{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse at 50% 30%,#42b8ff22,transparent 60%)}
    #${ROOT_ID} .czmg-brand{display:inline-flex;align-items:center;gap:7px;margin-bottom:18px;padding:7px 11px;border:1px solid #284c6a;border-radius:999px;background:#10243a;color:#b8e7ff;font-size:10px;font-weight:850;letter-spacing:1.5px;text-transform:uppercase;box-shadow:0 8px 26px #0005}
    #${ROOT_ID} .czmg-icon{display:none!important} @keyframes czmgHeroIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} #${ROOT_ID} .czmg-card{animation:czmgCardIn .32s cubic-bezier(.2,.8,.2,1) both} @keyframes czmgCardIn{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    #${ROOT_ID} h2{font-size:clamp(25px,6vw,31px);line-height:1.1;letter-spacing:-.9px;margin:0 0 10px;color:#fff;text-wrap:balance;text-shadow:0 3px 18px #000b}
    #${ROOT_ID} .czmg-lead{font-size:13px;line-height:1.55;color:#e0eaf7;text-shadow:0 2px 8px #000;margin:0 auto 2px;max-width:330px}
    #${ROOT_ID} .czmg-step{backdrop-filter:blur(10px);background:linear-gradient(110deg,#10243be8,#0a1728e8);border-color:#34516d}
    #${ROOT_ID} .czmg-btn{min-height:52px;border-radius:15px;font-size:14px;letter-spacing:.1px}
    #${ROOT_ID} #czmg-join{background:linear-gradient(105deg,#62efc2,#57d4ff);box-shadow:0 8px 28px #32d5c52b}
    #${ROOT_ID} .czmg-secondary{background:linear-gradient(135deg,#173652,#10263c);border:1px solid #3e6484;color:#f1f8ff}
    #${ROOT_ID} .czmg-steps{display:grid;gap:8px;margin:0 0 15px;text-align:left}
    #${ROOT_ID} .czmg-step{display:flex;align-items:flex-start;gap:11px;padding:11px 12px;border:1px solid #27445f;border-radius:15px;background:linear-gradient(110deg,rgba(17,39,62,.92),rgba(9,22,37,.92));box-shadow:inset 0 1px #ffffff07}
    #${ROOT_ID} .czmg-num{flex:0 0 26px;display:grid;place-items:center;width:26px;height:26px;border-radius:9px;background:linear-gradient(145deg,#1d5576,#17344e);color:#a7edff;font-size:12px;font-weight:900;box-shadow:0 4px 14px #0003}
    #${ROOT_ID} .czmg-step strong{display:block;margin:1px 0 3px;color:#f4f8ff;font-size:13px}
    #${ROOT_ID} .czmg-step span{display:block;color:#a8bbcf;font-size:12px;line-height:1.45}
    #${ROOT_ID} .czmg-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:49px;padding:13px 16px;margin:9px 0;border:0;border-radius:14px;background:linear-gradient(105deg,#6af0c1 0%,#5edcff 100%);color:#04131e;font-size:14px;font-weight:900;text-decoration:none;cursor:pointer;box-shadow:0 8px 24px #40c6d522;transition:transform .18s ease,filter .18s ease,box-shadow .18s ease}
    #${ROOT_ID} .czmg-btn:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 12px 30px #40c6d533}
    #${ROOT_ID} .czmg-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
    #${ROOT_ID} .czmg-secondary{background:linear-gradient(135deg,#142d46,#0d2034);border:1px solid #345672;color:#e7f4ff;box-shadow:none}
    #${ROOT_ID} .czmg-divider{display:flex;align-items:center;gap:10px;margin:15px 0;color:#7189a2;font-size:11px}
    #${ROOT_ID} .czmg-divider:before,#${ROOT_ID} .czmg-divider:after{content:"";height:1px;flex:1;background:#263e55}
    #${ROOT_ID} .czmg-login{display:flex;justify-content:center;align-items:center;min-height:60px;margin:9px 0 4px;padding:7px 8px;border:1px solid #345b7b;border-radius:16px;background:linear-gradient(90deg,rgba(4,13,26,.78),rgba(4,13,26,.6)),url("https://raw.githubusercontent.com/nitishratre45/CRICZONE.ALL.ROUNDER/main/photo_2026-10-28_14-52-23.jpg") center 35%/cover no-repeat;box-shadow:inset 0 0 24px #0007}
    #${ROOT_ID} .czmg-status{min-height:22px;margin-top:10px;font-size:12px;line-height:1.5;color:#ffd38a;overflow-wrap:anywhere}
    #${ROOT_ID} .czmg-note{font-size:11px;line-height:1.5;color:#849ab2;margin-top:15px}
    #${ROOT_ID} .czmg-secure{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;color:#78c9a7;font-size:11px}
    @media(max-width:600px){#${ROOT_ID}{padding:10px}#${ROOT_ID} .czmg-hero{min-height:205px;background-position:center 25%} #${ROOT_ID} .czmg-card{width:min(100%,440px);max-height:calc(100dvh - 20px)}} @media(max-width:380px){#${ROOT_ID}{padding:8px}#${ROOT_ID} .czmg-card{padding:12px 13px 16px;max-height:calc(100dvh - 16px);border-radius:21px}#${ROOT_ID} .czmg-hero{margin:-12px -13px 15px;padding:20px 13px 17px}#${ROOT_ID} .czmg-icon{width:52px;height:52px;font-size:26px}#${ROOT_ID} .czmg-step{padding:10px}}
    @media(prefers-reduced-motion:reduce){#${ROOT_ID} .czmg-btn,#${ROOT_ID} .czmg-card,#${ROOT_ID} .czmg-hero{transition:none;animation:none}}
  `;
  document.head.appendChild(style);

  const gate = document.createElement("div");
  gate.id = ROOT_ID;
  gate.setAttribute("role", "dialog");
  gate.setAttribute("aria-modal", "true");
  gate.innerHTML = `
    <section class="czmg-card">
      <div class="czmg-hero">
        <div class="czmg-brand"><span aria-hidden="true">●</span> CRICZONE COMMUNITY</div>
        
        <h2>Join Telegram to Watch</h2>
        <p class="czmg-lead">Join our official public channel first, then sign in with Telegram so we can confirm your membership and unlock the player.</p>
      </div>
      <div class="czmg-steps" aria-label="How to unlock the player">
        <div class="czmg-step"><div class="czmg-num">1</div><div><strong>Join the channel</strong><span>Tap the button below and join the channel in Telegram.</span></div></div>
        <div class="czmg-step"><div class="czmg-num">2</div><div><strong>Verify your Telegram</strong><span>Open our Telegram bot and press Start. No phone number is entered on this website.</span></div></div>
        <div class="czmg-step"><div class="czmg-num">3</div><div><strong>Start watching</strong><span>We check your channel membership and unlock the player automatically.</span></div></div>
      </div>
      <a class="czmg-btn" href="${CHANNEL_URL}" target="_blank" rel="noopener noreferrer" id="czmg-join"><span aria-hidden="true">✈️</span> Join @criczonelive</a>
      <div class="czmg-divider">ALREADY A MEMBER?</div>
      <div class="czmg-login" id="czmg-login"><button class="czmg-btn" id="czmg-bot-login" type="button">✈️ Continue with Telegram Bot</button></div>
      <div class="czmg-status" id="czmg-status" role="status" aria-live="polite"></div>
      <button class="czmg-btn czmg-secondary" id="czmg-retry" type="button">✓ I am a member</button>
      <div class="czmg-secure"><span aria-hidden="true">✓</span> Membership checked securely with Telegram</div>
      <div class="czmg-note">Telegram will open in a new tab or app. Press Start in the bot and keep this page open while we verify your membership.</div>
    </section>`;
  gate.style.visibility = "hidden";
  document.body.appendChild(gate);

  const status = gate.querySelector("#czmg-status");
  const retry = gate.querySelector("#czmg-retry");
  let verified = false;
  let activeNonce = null;
  let pollTimer = null;
  const loginButton = gate.querySelector("#czmg-bot-login");

  function setStatus(message, isError = true) {
    status.textContent = message;
    status.style.color = isError ? "#ffd38a" : "#70f0bb";
  }

  async function startBotVerification() {
    if (loginButton.disabled) return;
    loginButton.disabled = true;
    loginButton.textContent = "Preparing Telegram…";
    setStatus("Creating a secure sign-in request…", false);
    // Open a blank tab synchronously to avoid popup blockers; navigate it after the API responds.
    const botTab = window.open("about:blank", "_blank");
    try {
      const response = await fetch("/api/telegram/start", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_url: window.location.href })
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.nonce || !result.bot_url) {
        if (botTab) botTab.close();
        setStatus(result.error || "Could not start Telegram verification.");
        return;
      }
      activeNonce = result.nonce;
      try { sessionStorage.setItem("cz_tg_login_nonce", activeNonce); } catch {}
      if (botTab) botTab.location.href = result.bot_url;
      else window.location.href = result.bot_url;
      setStatus("Telegram opened. Press Start in the bot; this page will verify your membership automatically.", false);
      beginPolling(activeNonce);
    } catch {
      if (botTab) botTab.close();
      setStatus("Could not reach the verification service. Please retry.");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "✈️ Continue with Telegram Bot";
    }
  }

  function beginPolling(nonce) {
    if (pollTimer) clearInterval(pollTimer);
    const startedAt = Date.now();
    pollTimer = setInterval(async () => {
      if (!document.getElementById(ROOT_ID)) { clearInterval(pollTimer); return; }
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        clearInterval(pollTimer);
        setStatus("Sign-in link expired. Tap Continue with Telegram Bot to try again.");
        return;
      }
      try {
        const response = await fetch("/api/telegram/status?nonce=" + encodeURIComponent(nonce), {
          method: "GET", credentials: "same-origin", cache: "no-store"
        });
        const result = await response.json();
        if (result.status === "verified" && response.ok && result.ok) {
          clearInterval(pollTimer);
          verified = true;
          try { sessionStorage.removeItem("cz_tg_login_nonce"); } catch {}
          gate.remove();
          document.dispatchEvent(new CustomEvent("criczone:membership-verified", { detail: { bot: true } }));
        } else if (result.status === "not_member") {
          clearInterval(pollTimer);
          setStatus("You haven't joined @criczonelive yet. Join the channel, then tap Continue with Telegram Bot again.");
        } else if (result.status === "expired") {
          clearInterval(pollTimer);
          setStatus("Sign-in link expired. Tap Continue with Telegram Bot to try again.");
        } else if (!response.ok && response.status !== 503) {
          clearInterval(pollTimer);
          setStatus(result.error || "Verification failed. Please try again.");
        } else if (result.error) {
          setStatus(result.error);
        }
      } catch {
        // Temporary network failures are retried until the challenge expires.
      }
    }, 1800);
  }

  loginButton.addEventListener("click", startBotVerification);
  retry.addEventListener("click", async () => {
    if (retry.disabled) return;
    retry.disabled = true;
    retry.textContent = "Checking membership…";
    setStatus("Checking your existing CRICZONE session…", false);
    try {
      const response = await fetch("/api/telegram/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok && result.member) {
        verified = true;
        if (pollTimer) clearInterval(pollTimer);
        gate.remove();
        document.dispatchEvent(new CustomEvent("criczone:membership-verified", {
          detail: { session: true, manualCheck: true }
        }));
      } else {
        setStatus("Membership cannot be checked until this browser is verified with Telegram. Use “Continue with Telegram Bot” once, then this button will check here without opening Telegram.");
      }
    } catch {
      setStatus("Could not check membership right now. Please try again.");
    } finally {
      retry.disabled = false;
      retry.textContent = "✓ I am a member";
    }
  });

  // Fail open to the visible login gate if the session endpoint is slow or unreachable.
  // A valid session still closes the gate as soon as the server confirms membership.
  let sessionResolved = false;
  const showGateFallback = window.setTimeout(() => {
    if (!sessionResolved && document.getElementById(ROOT_ID)) {
      gate.style.visibility = "visible";
    }
  }, 1800);

  fetch("/api/telegram/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store"
  }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    sessionResolved = true;
    window.clearTimeout(showGateFallback);
    if (response.ok && result.ok && result.member) {
      verified = true;
      gate.remove();
      // Keep this stylesheet active so legacy timed popups stay suppressed after verification.
      document.dispatchEvent(new CustomEvent("criczone:membership-verified", { detail: { session: true } }));
    }
    gate.style.visibility = "visible";
  }).catch(() => {
    sessionResolved = true;
    window.clearTimeout(showGateFallback);
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