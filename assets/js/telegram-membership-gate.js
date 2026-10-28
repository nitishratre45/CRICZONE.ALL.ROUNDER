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
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,7,18,.94);backdrop-filter:blur(12px);font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#f4f8ff}
    #${ROOT_ID} [hidden]{display:none!important}
    #${ROOT_ID} .czmg-card{width:min(100%,430px);padding:28px 24px;text-align:center;border:1px solid #29435f;border-radius:22px;background:linear-gradient(145deg,#12243b,#070d18);box-shadow:0 24px 80px #000a}
    #${ROOT_ID} .czmg-icon{font-size:34px;margin-bottom:12px}
    #${ROOT_ID} h2{font-size:25px;line-height:1.2;margin:0 0 12px}
    #${ROOT_ID} p{font-size:14px;line-height:1.65;color:#b8c8db;margin:0 0 18px}
    #${ROOT_ID} .czmg-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;padding:12px 16px;margin:10px 0;border:0;border-radius:12px;background:linear-gradient(100deg,#65edc3,#55caff);color:#04111c;font-weight:850;text-decoration:none;cursor:pointer}
    #${ROOT_ID} .czmg-secondary{background:#17273b;border:1px solid #38516d;color:#edf6ff}
    #${ROOT_ID} .czmg-status{min-height:24px;margin-top:12px;font-size:13px;color:#ffd38a}
    #${ROOT_ID} .czmg-login{display:flex;justify-content:center;min-height:44px;margin-top:12px}
    #${ROOT_ID} .czmg-note{font-size:11px;color:#91a5bd;margin-top:16px}
  `;
  document.head.appendChild(style);

  const gate = document.createElement("div");
  gate.id = ROOT_ID;
  gate.setAttribute("role", "dialog");
  gate.setAttribute("aria-modal", "true");
  gate.innerHTML = `
    <section class="czmg-card">
      <div class="czmg-icon" aria-hidden="true">✈️</div>
      <h2>Join the CRICZONE community</h2>
      <p>Join our public Telegram channel, then verify your Telegram account to unlock the player on this page.</p>
      <a class="czmg-btn" href="${CHANNEL_URL}" target="_blank" rel="noopener noreferrer" id="czmg-join">✈ Join @criczonelive</a>
      <p>Already joined? Verify your Telegram identity below.</p>
      <div class="czmg-login" id="czmg-login"></div>
      <div class="czmg-status" id="czmg-status" role="status" aria-live="polite"></div>
      <button class="czmg-btn czmg-secondary" id="czmg-retry" type="button">Check membership again</button>
      <div class="czmg-note">Membership is checked with Telegram. If you just joined, wait a moment and retry.</div>
    </section>`;
  document.body.appendChild(gate);

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

  // If a previously verified tab is reopened, require fresh verification instead of trusting local storage.
  window.addEventListener("pageshow", () => {
    if (!verified && !document.getElementById(ROOT_ID)) return;
  });
})();