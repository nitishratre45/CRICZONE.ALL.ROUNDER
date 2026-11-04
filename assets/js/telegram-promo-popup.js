(() => {
  "use strict";
  if (window.__czPromoPopupInstalled) return;
  window.__czPromoPopupInstalled = true;

  const selectors = [
    "#telegramOverlay",
    "#telegramPop",
    "#tgPopup",
    "#tgOverlay",
    ".cz-tg-backdrop"
  ];
  let target = null;
  let targetClass = "show";
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      target = el;
      if (selector === ".cz-tg-backdrop") targetClass = "cz-show";
      break;
    }
  }

  let fallback;
  function showPromo() {
    if (window.__czPromoShown) return;
    window.__czPromoShown = true;
    if (target && target.isConnected) {
      target.classList.add(targetClass);
      target.setAttribute("aria-hidden", "false");
      return;
    }
    if (!fallback) {
      fallback = document.createElement("div");
      fallback.id = "cz-global-telegram-promo";
      fallback.innerHTML = `
        <div class="cz-global-tg-card" role="dialog" aria-modal="true" aria-label="Join CRICZONE Telegram">
          <button type="button" class="cz-global-tg-close" aria-label="Close">×</button>
          <div class="cz-global-tg-icon">✈</div>
          <div class="cz-global-tg-kicker">CRICZONE COMMUNITY</div>
          <h2>Stay connected with <span>CRICZONE</span></h2>
          <p>Get live match updates, channel news and important announcements directly on Telegram.</p>
          <a href="https://t.me/+UTSbOtaqVmE2ZWVl" target="_blank" rel="noopener noreferrer">JOIN TELEGRAM CHANNEL</a>
        </div>`;
      const style = document.createElement("style");
      style.textContent = `
        #cz-global-telegram-promo{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,7,16,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
        #cz-global-telegram-promo .cz-global-tg-card{position:relative;box-sizing:border-box;width:min(420px,100%);padding:30px 24px 25px;border:1px solid rgba(100,190,255,.28);border-radius:22px;background:linear-gradient(150deg,#14243a,#080f1d);box-shadow:0 24px 80px #000b;color:#f5f9ff;text-align:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
        #cz-global-telegram-promo .cz-global-tg-close{position:absolute;top:10px;right:12px;width:34px;height:34px;border:1px solid #ffffff2a;border-radius:50%;background:#ffffff10;color:#fff;font-size:24px;cursor:pointer}
        #cz-global-telegram-promo .cz-global-tg-icon{display:grid;place-items:center;width:62px;height:62px;margin:0 auto 14px;border-radius:18px;background:linear-gradient(135deg,#36bafa,#1674d4);font-size:30px}
        #cz-global-telegram-promo .cz-global-tg-kicker{margin-bottom:8px;color:#79d5ff;font-size:10px;font-weight:900;letter-spacing:2px}
        #cz-global-telegram-promo h2{margin:0 0 10px;font-size:24px;line-height:1.2;font-weight:850}
        #cz-global-telegram-promo h2 span{color:#66caff}
        #cz-global-telegram-promo p{margin:0 auto 20px;max-width:310px;color:#b7c6d9;font-size:14px;line-height:1.6}
        #cz-global-telegram-promo a{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:12px;background:linear-gradient(100deg,#56c8ff,#1689df);color:#031321;text-decoration:none;font-size:13px;font-weight:900}
      `;
      document.head.appendChild(style);
      document.body.appendChild(fallback);
      fallback.querySelector(".cz-global-tg-close").addEventListener("click", () => fallback.remove());
      fallback.addEventListener("click", e => { if (e.target === fallback) fallback.remove(); });
    }
  }

  // Both entry points use the same one-time guard, so they cannot create duplicates.
  window.setTimeout(showPromo, 5000);
  document.addEventListener("playing", () => window.setTimeout(showPromo, 5000), true);
  document.addEventListener("cz:stream-start", () => window.setTimeout(showPromo, 5000), true);
})();