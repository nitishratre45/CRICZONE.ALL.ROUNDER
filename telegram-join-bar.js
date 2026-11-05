(function () {
  "use strict";
  if (window.__CZ_TELEGRAM_JOIN_BAR__) return;
  window.__CZ_TELEGRAM_JOIN_BAR__ = true;

  var invite = "https://t.me/+pN15_8gc54s2NDU1";
  function mount() {
    if (!document.body || document.getElementById("cz-telegram-join-bar")) return;
    var bar = document.createElement("aside");
    bar.id = "cz-telegram-join-bar";
    bar.className = "cz-tg-bar";
    bar.setAttribute("aria-label", "CRICZONE official Telegram community");
    bar.innerHTML =
      '<a class="cz-tg-brand" href="' + invite + '" target="_blank" rel="noopener noreferrer" aria-label="Join CRICZONE official Telegram">' +
        '<span class="cz-tg-icon"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="120" fill="#fff"/><path d="M49 116.5 183.8 64.6c6.3-2.3 11.8 1.5 9.8 11l-23 108.4c-1.7 7.7-6.3 9.6-12.8 6l-35.4-26.1-17.1 16.5c-1.9 1.9-3.5 3.5-7.2 3.5l2.5-36 65.5-59.2c2.9-2.5-.6-3.9-4.4-1.4l-81 51-34.9-10.9c-7.6-2.4-7.8-7.6 1.2-10.9Z" fill="#1769e8"/></svg></span>' +
        '<span class="cz-tg-copy"><strong>JOIN OFFICIAL TELEGRAM</strong><small>🏏 Live match updates • Cricket news • CRICZONE community</small></span>' +
      '</a>' +
      '<a class="cz-tg-action" href="' + invite + '" target="_blank" rel="noopener noreferrer">TAP HERE <span aria-hidden="true">👉</span></a>';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/telegram-join-bar.css?v=1";
  document.head.appendChild(css);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();