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
    #telegramPopup,#tgOverlay,#telegramModal,#czTelegramPopup,.cz-tg-backdrop,.tg-overlay,.telegram-popup-overlay,.telegram-modal-overlay{display:none!important;visibility:hidden!important;pointer-events:none!important}
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(ellipse at 50% 0%,rgba(21,105,179,.24),transparent 52%),rgba(2,6,15,.88);backdrop-filter:blur(18px) saturate(125%);-webkit-backdrop-filter:blur(18px) saturate(125%);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f4f8ff;overflow-y:auto}
    /* Mobile: full-screen membership sheet; keep the page behind it locked and blurred. */
    html.czmg-page-locked,html.czmg-page-locked body{overflow:hidden!important;overscroll-behavior:none!important}
    html.czmg-page-locked body{touch-action:none}
    #${ROOT_ID}{overscroll-behavior:contain;touch-action:pan-y}
    @media(max-width:600px){
      #${ROOT_ID}{inset:0;width:100%;height:100%;height:100dvh;padding:0;align-items:stretch;justify-content:flex-start;overflow:hidden;background:rgba(2,6,15,.66);backdrop-filter:blur(14px) saturate(115%);-webkit-backdrop-filter:blur(14px) saturate(115%)}
      #${ROOT_ID} .czmg-card{width:100%;max-width:none;height:100%;height:100dvh;max-height:100dvh;min-height:0;flex:1 1 auto;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:calc(12px + env(safe-area-inset-top)) 14px calc(16px + env(safe-area-inset-bottom));border-radius:0;border-left:0;border-right:0;border-top:0;border-bottom:0}
      #${ROOT_ID} .czmg-hero{margin:calc(-12px - env(safe-area-inset-top)) -14px 14px;padding:calc(94px + env(safe-area-inset-top)) 14px 18px;min-height:245px;border-radius:0 0 20px 20px;background-position:center,center 48%}
      #${ROOT_ID} .czmg-profile{top:calc(15px + env(safe-area-inset-top));width:62px;height:62px}
      #${ROOT_ID} .czmg-brand{margin-bottom:10px}
      #${ROOT_ID} h2{font-size:clamp(23px,6.2vw,29px)}
      #${ROOT_ID} .czmg-steps{gap:7px;margin-bottom:11px}
      #${ROOT_ID} .czmg-step{padding:10px}
      #${ROOT_ID} .czmg-btn{min-height:46px;margin:7px 0;padding:11px 12px}
      #${ROOT_ID} .czmg-login{min-height:52px;margin:7px 0 3px}
      #${ROOT_ID} .czmg-divider{margin:11px 0}
      #${ROOT_ID} .czmg-secure{margin-top:9px}
      #${ROOT_ID} .czmg-note{margin-top:10px;padding-bottom:4px}
    }
    @media(max-width:380px){
      #${ROOT_ID} .czmg-hero{min-height:220px;padding-top:calc(84px + env(safe-area-inset-top));background-position:center,center 52%}
      #${ROOT_ID} .czmg-profile{width:56px;height:56px;top:calc(12px + env(safe-area-inset-top))}
      #${ROOT_ID} .czmg-card{padding-left:12px;padding-right:12px}
      #${ROOT_ID} .czmg-hero{margin-left:-12px;margin-right:-12px}
    }
    #${ROOT_ID} [hidden]{display:none!important}
    #${ROOT_ID} .czmg-card{position:relative;width:min(100%,440px);max-height:calc(100dvh - 28px);overflow:auto;padding:14px 17px 19px;text-align:center;border:1px solid rgba(121,190,255,.32);border-radius:28px;background:linear-gradient(155deg,#101f33 0%,#07111e 55%,#050a12 100%);box-shadow:0 32px 100px #000e,0 0 0 1px #ffffff08,0 0 42px #168bff1b;scrollbar-width:thin;scrollbar-color:#31536f transparent}
    #${ROOT_ID} .czmg-hero{position:relative;isolation:isolate;overflow:hidden;margin:-14px -17px 17px;padding:22px 16px 20px;border-radius:27px 27px 19px 19px;background:linear-gradient(180deg,rgba(2,9,20,.04) 0%,rgba(2,9,20,.18) 27%,rgba(3,10,20,.78) 68%,#081321 100%),url("https://criczone.pages.dev/photos/photo_2026-10-28_14-52-23.jpg") center 28%/cover no-repeat;border-bottom:1px solid #4b9fff55;min-height:236px;display:flex;flex-direction:column;justify-content:flex-end;animation:czmgHeroIn .55s ease both}
    #${ROOT_ID} .czmg-hero:after{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse at 50% 30%,#42b8ff22,transparent 60%)}
    #${ROOT_ID} .czmg-brand{display:inline-flex;align-items:center;gap:7px;margin-bottom:18px;padding:7px 11px;border:1px solid #284c6a;border-radius:999px;background:#10243a;color:#b8e7ff;font-size:10px;font-weight:850;letter-spacing:1.5px;text-transform:uppercase;box-shadow:0 8px 26px #0005}
    #${ROOT_ID} .czmg-icon{display:none!important} @keyframes czmgHeroIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} #${ROOT_ID} .czmg-card{animation:czmgCardIn .32s cubic-bezier(.2,.8,.2,1) both} @keyframes czmgCardIn{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    /* Premium profile header and blue-violet palette, consistent on desktop and mobile. */
    #${ROOT_ID} .czmg-hero{min-height:292px;padding-top:112px;background-image:linear-gradient(180deg,rgba(3,8,22,.18) 0%,rgba(3,8,22,.42) 35%,rgba(3,8,22,.92) 72%,#081321 100%),url("https://criczone.pages.dev/photos/photo_2026-10-28_14-52-23.jpg");background-position:center,center 28%;background-size:cover,cover}
    #${ROOT_ID} .czmg-profile{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:76px;height:76px;padding:4px;border-radius:50%;border:1px solid #9cbaff;box-shadow:0 0 0 5px rgba(102,126,234,.15),0 10px 32px #0009;background:linear-gradient(135deg,#8b5cf6,#38bdf8);z-index:2}
    #${ROOT_ID} .czmg-profile img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 25%;border-radius:50%;border:2px solid #07111e}
    #${ROOT_ID} .czmg-brand{align-self:center;margin-bottom:13px;border-color:#415b91;background:rgba(15,27,52,.88);color:#d4dcff}
    #${ROOT_ID} .czmg-join-display{background:linear-gradient(110deg,#7567f8 0%,#4b8cff 54%,#36bce8 100%);color:#fff;border-color:#9bb7ff80;box-shadow:0 10px 30px #526dff30,inset 0 1px #ffffff50}
    #${ROOT_ID} .czmg-join-display:before{background:linear-gradient(110deg,#ffffff25,transparent 45%)}
    #${ROOT_ID} .czmg-btn{box-shadow:0 8px 24px #536dff20}
    #${ROOT_ID} #czmg-bot-login{background:linear-gradient(115deg,#1c2d50,#13243e);border-color:#536b9b;color:#f4f6ff}
    #${ROOT_ID} #czmg-bot-login:hover{border-color:#a5b4fc;box-shadow:0 0 24px #818cf830}
    #${ROOT_ID} .czmg-secondary{background:linear-gradient(135deg,#1b3155,#13233e);border-color:#536b9b;color:#f4f6ff}
    #${ROOT_ID} .czmg-divider:before,#${ROOT_ID} .czmg-divider:after{background:#344567}
    #${ROOT_ID} .czmg-login{border-color:#465b85;background:linear-gradient(90deg,rgba(4,10,25,.86),rgba(4,10,25,.72)),url("https://criczone.pages.dev/photos/photo_2026-10-28_14-52-23.jpg") center 35%/cover no-repeat}
    #${ROOT_ID} .czmg-secure{color:#a5b4fc}
    #${ROOT_ID} .czmg-num{background:linear-gradient(145deg,#465bb5,#263d70);color:#e0e7ff}
    #${ROOT_ID} .czmg-step{border-color:#34466d;background:linear-gradient(110deg,rgba(20,34,62,.95),rgba(9,19,38,.95))}
    #${ROOT_ID} .czmg-card{border-color:#465b85;box-shadow:0 32px 100px #000e,0 0 0 1px #ffffff08,0 0 42px #536dff20;scrollbar-color:#465b85 transparent}
    @media(max-width:600px){#${ROOT_ID} .czmg-hero{min-height:270px;padding-top:104px;background-position:center,center 25%}#${ROOT_ID} .czmg-profile{width:68px;height:68px;top:15px}}
    @media(max-width:380px){#${ROOT_ID} .czmg-hero{min-height:252px;padding-top:94px}#${ROOT_ID} .czmg-profile{width:60px;height:60px;top:13px}}
    #${ROOT_ID} h2{font-size:clamp(25px,6vw,31px);line-height:1.1;letter-spacing:-.9px;margin:0 0 10px;color:#fff;text-wrap:balance;text-shadow:0 3px 18px #000b}
    #${ROOT_ID} .czmg-lead{font-size:13px;line-height:1.55;color:#e0eaf7;text-shadow:0 2px 8px #000;margin:0 auto 2px;max-width:330px}
    #${ROOT_ID} .czmg-step{backdrop-filter:blur(10px);background:linear-gradient(110deg,#10243be8,#0a1728e8);border-color:#34516d}
    #${ROOT_ID} .czmg-btn{min-height:54px;border-radius:16px;font-size:14px;letter-spacing:.15px;font-weight:850;display:flex;align-items:center;justify-content:center;gap:9px;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
    #${ROOT_ID} .czmg-join-display{cursor:default;user-select:none;-webkit-user-select:none;background:linear-gradient(110deg,#61f0c3 0%,#4fd8ee 58%,#59cfff 100%);color:#031724;border:1px solid #a4ffeb70;box-shadow:0 10px 30px #32d5c52b,inset 0 1px #ffffff75;position:relative;overflow:hidden}
    #${ROOT_ID} .czmg-join-display:before{content:"";position:absolute;inset:1px;border-radius:15px;background:linear-gradient(110deg,#ffffff20,transparent 45%);pointer-events:none}
    #${ROOT_ID} .czmg-join-display span{font-size:17px;filter:drop-shadow(0 2px 3px #0002)}
    #${ROOT_ID} #czmg-bot-login{background:linear-gradient(110deg,#162b42,#102137);color:#eaf7ff;border:1px solid #345879;box-shadow:inset 0 1px #ffffff0b}
    #${ROOT_ID} #czmg-bot-login:hover{border-color:#58c8ed;box-shadow:0 0 22px #31b7ff19}
    #${ROOT_ID} .czmg-secondary{border:1px solid #345879;color:#d9efff;box-shadow:inset 0 1px #ffffff0b}
    #${ROOT_ID} .czmg-btn:focus-visible{outline:3px solid #8be8ff;outline-offset:3px}
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
    #${ROOT_ID} .czmg-login{display:flex;justify-content:center;align-items:center;min-height:60px;margin:9px 0 4px;padding:7px 8px;border:1px solid #345b7b;border-radius:16px;background:linear-gradient(90deg,rgba(4,13,26,.78),rgba(4,13,26,.6)),url("https://criczone.pages.dev/photos/photo_2026-10-28_14-52-23.jpg") center 35%/cover no-repeat;box-shadow:inset 0 0 24px #0007}
    #${ROOT_ID} .czmg-status{min-height:22px;margin-top:10px;font-size:12px;line-height:1.5;color:#ffd38a;overflow-wrap:anywhere}
    #${ROOT_ID} .czmg-note{font-size:11px;line-height:1.5;color:#849ab2;margin-top:15px}
    #${ROOT_ID} .czmg-secure{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;color:#78c9a7;font-size:11px}
    @media(max-width:600px){#${ROOT_ID}{padding:10px}#${ROOT_ID} .czmg-hero{min-height:205px;background-position:center 25%} #${ROOT_ID} .czmg-card{width:min(100%,440px);max-height:calc(100dvh - 20px)}} @media(max-width:380px){#${ROOT_ID}{padding:8px}#${ROOT_ID} .czmg-card{padding:12px 13px 16px;max-height:calc(100dvh - 16px);border-radius:21px}#${ROOT_ID} .czmg-hero{margin:-12px -13px 15px;padding:20px 13px 17px}#${ROOT_ID} .czmg-icon{width:52px;height:52px;font-size:26px}#${ROOT_ID} .czmg-step{padding:10px}}
    /* Latest hero crop + compact mobile layout: keep the batter's helmet/head visible. */
    #${ROOT_ID} .czmg-hero{background-position:center,center 48%}
    @media(max-width:600px){
      #${ROOT_ID}{padding:8px;align-items:center}
      #${ROOT_ID} .czmg-card{width:100%;max-width:440px;max-height:calc(100dvh - 16px);padding:11px 12px 14px;border-radius:22px;overscroll-behavior:contain}
      #${ROOT_ID} .czmg-hero{min-height:218px;margin:-11px -12px 12px;padding:84px 12px 14px;background-position:center,center 52%;border-radius:21px 21px 16px 16px}
      #${ROOT_ID} .czmg-profile{width:60px;height:60px;top:12px}
      #${ROOT_ID} .czmg-brand{margin-bottom:9px;padding:6px 9px;font-size:9px;letter-spacing:1.1px}
      #${ROOT_ID} h2{font-size:clamp(22px,6vw,27px);line-height:1.12;margin-bottom:7px;letter-spacing:-.6px}
      #${ROOT_ID} .czmg-lead{font-size:12px;line-height:1.42}
      #${ROOT_ID} .czmg-steps{gap:6px;margin-bottom:10px}
      #${ROOT_ID} .czmg-step{gap:9px;padding:9px 10px;border-radius:13px}
      #${ROOT_ID} .czmg-num{flex-basis:24px;width:24px;height:24px}
      #${ROOT_ID} .czmg-step strong{font-size:12px}
      #${ROOT_ID} .czmg-step span{font-size:11px;line-height:1.38}
      #${ROOT_ID} .czmg-btn{min-height:44px;padding:10px 12px;margin:7px 0;font-size:13px;border-radius:12px}
      #${ROOT_ID} .czmg-divider{margin:10px 0;font-size:10px}
      #${ROOT_ID} .czmg-login{min-height:52px;margin:7px 0 3px;padding:5px 7px}
      #${ROOT_ID} .czmg-secure{margin-top:8px;font-size:10px}
      #${ROOT_ID} .czmg-note{margin-top:9px;font-size:10px}
    }
    @media(max-width:380px){
      #${ROOT_ID} .czmg-hero{min-height:202px;padding-top:78px;background-position:center,center 55%}
      #${ROOT_ID} .czmg-profile{width:54px;height:54px;top:10px}
      #${ROOT_ID} h2{font-size:22px}
      #${ROOT_ID} .czmg-step span{font-size:10.5px}
    }
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
        <div class="czmg-profile" aria-label="CRICZONE community profile"><img src="https://criczone.pages.dev/photos/photo_2026-10-28_14-52-23.jpg" alt="CRICZONE community profile" loading="eager"></div>
        <div class="czmg-brand"><span aria-hidden="true">●</span> CRICZONE COMMUNITY</div>
        
        <h2>Unlock Stream for 12 Hours</h2>
        <p class="czmg-lead">Join our official Telegram channel to unlock the stream for 12 hours. Sign in with Telegram so we can confirm your membership.</p>
      </div>
      <div class="czmg-steps" aria-label="How to unlock the player">
        <div class="czmg-step"><div class="czmg-num">1</div><div><strong>Join the channel</strong><span>Tap the button below and join the channel in Telegram.</span></div></div>
        <div class="czmg-step"><div class="czmg-num">2</div><div><strong>Verify your Telegram</strong><span>Open our Telegram bot and press Start. No phone number is entered on this website.</span></div></div>
        <div class="czmg-step"><div class="czmg-num">3</div><div><strong>Start watching</strong><span>We check your channel membership and unlock the player automatically.</span></div></div>
      </div>
      <div class="czmg-btn czmg-join-display" id="czmg-join" aria-label="Official channel: @criczonelive"><span aria-hidden="true">✈️</span> Join @criczonelive</div>
      <div class="czmg-divider">ALREADY A MEMBER?</div>
      <div class="czmg-login" id="czmg-login"><button class="czmg-btn" id="czmg-bot-login" type="button">✈️ Continue with Telegram Bot</button></div>
      <div class="czmg-status" id="czmg-status" role="status" aria-live="polite"></div>
      <button class="czmg-btn czmg-secondary" id="czmg-retry" type="button">✓ I am a member</button>
      <div class="czmg-secure"><span aria-hidden="true">✓</span> Membership checked securely with Telegram</div>
      <div class="czmg-note">Telegram will open in a new tab or app. Press Start in the bot and keep this page open while we verify your membership.</div>
    </section>`;
  gate.style.visibility = "hidden";
  // Freeze page scrolling while the membership overlay is open; restore exact prior styles when it closes.
  const pageRoot = document.documentElement;
  const previousScrollLock = {
    rootClass: pageRoot.classList.contains("czmg-page-locked"),
    rootOverflow: pageRoot.style.overflow,
    bodyOverflow: document.body.style.overflow,
    bodyTouchAction: document.body.style.touchAction
  };
  pageRoot.classList.add("czmg-page-locked");
  pageRoot.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";
  const restorePageScroll = () => {
    if (document.getElementById(ROOT_ID)) return;
    if (!previousScrollLock.rootClass) pageRoot.classList.remove("czmg-page-locked");
    pageRoot.style.overflow = previousScrollLock.rootOverflow;
    document.body.style.overflow = previousScrollLock.bodyOverflow;
    document.body.style.touchAction = previousScrollLock.bodyTouchAction;
    pageLockObserver.disconnect();
  };
  const pageLockObserver = new MutationObserver(restorePageScroll);
  pageLockObserver.observe(document.documentElement, { childList: true, subtree: true });
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
    let checkingStatus = false;

    // Check immediately and whenever the user returns from Telegram/browser app.
    // This avoids relying only on a throttled background-tab interval to set the
    // HttpOnly session cookie and remove the membership gate.
    const checkStatus = async () => {
      if (!document.getElementById(ROOT_ID)) {
        if (pollTimer) clearInterval(pollTimer);
        return;
      }
      if (checkingStatus) return;
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        if (pollTimer) clearInterval(pollTimer);
        setStatus("Sign-in link expired. Tap Continue with Telegram Bot to try again.");
        return;
      }
      checkingStatus = true;
      try {
        const response = await fetch("/api/telegram/status?nonce=" + encodeURIComponent(nonce), {
          method: "GET", credentials: "same-origin", cache: "no-store"
        });
        const result = await response.json();
        if (result.status === "verified" && response.ok && result.ok) {
          if (pollTimer) clearInterval(pollTimer);
          verified = true;
          hasValidSession = true;
          try { sessionStorage.removeItem("cz_tg_login_nonce"); } catch {}
          gate.remove();
          document.dispatchEvent(new CustomEvent("criczone:membership-verified", { detail: { bot: true } }));
        } else if (result.status === "not_member") {
          if (pollTimer) clearInterval(pollTimer);
          setStatus("You haven't joined @criczonelive yet. Join the channel, then tap Continue with Telegram Bot again.");
        } else if (result.status === "expired") {
          if (pollTimer) clearInterval(pollTimer);
          setStatus("Sign-in link expired. Tap Continue with Telegram Bot to try again.");
        } else if (!response.ok && response.status !== 503) {
          if (pollTimer) clearInterval(pollTimer);
          setStatus(result.error || "Verification failed. Please try again.");
        } else if (result.error) {
          setStatus(result.error);
        }
      } catch {
        // Temporary network failures are retried until the challenge expires.
      } finally {
        checkingStatus = false;
      }
    };

    checkStatus();
    pollTimer = setInterval(checkStatus, 1800);
    const resumeCheck = () => {
      if (document.visibilityState === "visible") checkStatus();
    };
    document.addEventListener("visibilitychange", resumeCheck);
    window.addEventListener("pageshow", resumeCheck);
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
        hasValidSession = true;
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

  // Start the 60-second delay on page load. If the user is watching fullscreen,
  // wait until fullscreen ends and then show the gate immediately if the minute elapsed.
  let hasValidSession = false;
  let gateDelayElapsed = false;

  function isVideoFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) return true;
    return Array.from(document.querySelectorAll("video")).some((video) =>
      video.webkitDisplayingFullscreen === true ||
      video.webkitPresentationMode === "fullscreen"
    );
  }

  function revealGateIfDue() {
    if (!gateDelayElapsed || hasValidSession || !document.getElementById(ROOT_ID)) return;

    // Fullscreen mode renders only the fullscreen element and its descendants.
    // Shaka's container can host the gate; native video/iframe fullscreen cannot.
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    const nativeFullscreenVideo = Array.from(document.querySelectorAll("video")).find((video) =>
      video.webkitDisplayingFullscreen === true ||
      video.webkitPresentationMode === "fullscreen"
    );
    const fullscreenTag = fullscreenElement?.tagName || "";
    const nativeOnlyFullscreen = fullscreenTag === "VIDEO" || fullscreenTag === "IFRAME" || Boolean(nativeFullscreenVideo);

    if (nativeOnlyFullscreen) {
      // Move the gate back to the document before leaving native fullscreen.
      if (gate.parentElement !== document.body) document.body.appendChild(gate);
      gate.style.visibility = "visible";
      try {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch {}
      try {
        if (nativeFullscreenVideo && typeof nativeFullscreenVideo.webkitExitFullscreen === "function") {
          nativeFullscreenVideo.webkitExitFullscreen();
        }
        if (nativeFullscreenVideo && nativeFullscreenVideo.webkitPresentationMode === "fullscreen") {
          nativeFullscreenVideo.webkitSetPresentationMode("inline");
        }
      } catch {}
      return;
    }

    if (fullscreenElement && fullscreenElement !== gate) {
      if (gate.parentElement !== fullscreenElement) fullscreenElement.appendChild(gate);
    } else if (!fullscreenElement && gate.parentElement !== document.body) {
      document.body.appendChild(gate);
    }
    gate.style.visibility = "visible";
  }

  const showGateAfterDelay = window.setTimeout(() => {
    gateDelayElapsed = true;
    revealGateIfDue();
  }, 5 * 1000);

  ["fullscreenchange", "webkitfullscreenchange", "orientationchange", "pageshow", "visibilitychange"].forEach((eventName) => {
    document.addEventListener(eventName, () => {
      if (eventName === "pageshow" || eventName === "visibilitychange" || eventName === "orientationchange") {
        window.setTimeout(revealGateIfDue, 150);
      } else {
        revealGateIfDue();
      }
    });
  });
  document.querySelectorAll("video").forEach((video) => {
    video.addEventListener("webkitpresentationmodechanged", revealGateIfDue);
    video.addEventListener("webkitendfullscreen", revealGateIfDue);
  });

  // A bot return link may open in a fresh tab before the original tab's polling finishes.
  // Exchange its short-lived nonce on this origin so this browser receives the HttpOnly session cookie.
  const returnUrl = new URL(window.location.href);
  const returnNonce = returnUrl.searchParams.get("cz_tg_login_nonce");
  if (returnNonce && /^[a-f0-9-]{36}$/i.test(returnNonce)) {
    fetch("/api/telegram/status?nonce=" + encodeURIComponent(returnNonce), {
      method: "GET", credentials: "same-origin", cache: "no-store"
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok && result.status === "verified") {
        returnUrl.searchParams.delete("cz_tg_login_nonce");
        window.history.replaceState({}, document.title, returnUrl.pathname + returnUrl.search + returnUrl.hash);
        hasValidSession = true;
        window.clearTimeout(showGateAfterDelay);
        gate.remove();
        document.dispatchEvent(new CustomEvent("criczone:membership-verified", { detail: { session: true, botReturn: true } }));
      }
    }).catch(() => {});
  }

  fetch("/api/telegram/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store"
  }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok && result.member) {
      hasValidSession = true;
      window.clearTimeout(showGateAfterDelay);
      gate.remove();
      document.dispatchEvent(new CustomEvent("criczone:membership-verified", { detail: { session: true } }));
    }
  }).catch(() => {
    // If session verification fails, the delayed gate still works.
  });

  // Recheck membership while playback is open. If the user leaves the channel,
  // stop page playback and put the membership gate back on screen.
  let membershipHeartbeatBusy = false;
  async function enforceLiveMembership() {
    if (!hasValidSession || membershipHeartbeatBusy || document.visibilityState === "hidden") return;
    membershipHeartbeatBusy = true;
    try {
      const response = await fetch("/api/telegram/session", {
        method: "GET", credentials: "same-origin", cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok && result.member) return;
      hasValidSession = false;
      verified = false;
      if (pollTimer) clearInterval(pollTimer);
      // Stop native media and common embedded players on this page.
      document.querySelectorAll("video, audio").forEach((media) => {
        try { media.pause(); } catch {}
        try { media.removeAttribute("src"); media.querySelectorAll("source").forEach((source) => source.removeAttribute("src")); media.load(); } catch {}
      });
      document.querySelectorAll("iframe").forEach((frame) => {
        try {
          const src = frame.getAttribute("src") || "";
          if (/youtube|youtu\.be|player|stream|embed|hls|dash/i.test(src)) {
            frame.setAttribute("src", "about:blank");
          }
        } catch {}
      });
      if (gate.parentElement !== document.body) document.body.appendChild(gate);
      gate.style.visibility = "visible";
      setStatus("Channel membership is no longer active. Playback stopped. Rejoin @criczonelive and verify again.");
      document.dispatchEvent(new CustomEvent("criczone:membership-lost"));
    } catch {
      // Network errors do not revoke access by themselves; retry on the next heartbeat.
    } finally {
      membershipHeartbeatBusy = false;
    }
  }
  window.setInterval(enforceLiveMembership, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") enforceLiveMembership();
  });

  // If the browser restores this page from its back-forward cache after a Telegram
  // login/navigation, make sure the gate is mounted again rather than leaving a blank page.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !document.getElementById(ROOT_ID)) {
      window.location.reload();
    }
  });
})();