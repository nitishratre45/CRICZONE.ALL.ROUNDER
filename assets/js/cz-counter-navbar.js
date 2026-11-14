/* CRICZONE shared compact counter bar.
 * Moves the existing Total/Live badge above each page's original navbar.
 * Counter logic and player/stream controls are not changed.
 */
(function () {
  "use strict";
  if (window.__CZ_COUNTER_NAVBAR__) return;
  window.__CZ_COUNTER_NAVBAR__ = true;

  function findOriginalNav() {
    return document.querySelector("#ch-header, .cz-header, header, nav, .header, .navbar");
  }

  function ensureBar(badge) {
    if (!badge || !document.body) return;
    var bar = document.getElementById("cz-global-counter-nav");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "cz-global-counter-nav";
      bar.setAttribute("role", "status");
      bar.setAttribute("aria-label", "CRICZONE total visits and live visitors");
      bar.innerHTML = '<span class="cz-counter-brand"><i></i> CRICZONE LIVE</span><span class="cz-counter-caption">VISITORS</span>';
      var originalNav = findOriginalNav();
      if (originalNav && originalNav.parentNode) {
        originalNav.parentNode.insertBefore(bar, originalNav);
      } else {
        document.body.insertBefore(bar, document.body.firstChild);
      }
    }
    if (badge.parentNode !== bar) bar.appendChild(badge);
  }

  function addStyles() {
    if (document.getElementById("cz-global-counter-nav-style")) return;
    var style = document.createElement("style");
    style.id = "cz-global-counter-nav-style";
    style.textContent =
      "#cz-global-counter-nav{position:sticky!important;top:0!important;z-index:2147483646!important;box-sizing:border-box!important;width:100%!important;min-height:32px!important;padding:3px clamp(9px,2vw,18px)!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:9px!important;background:linear-gradient(100deg,#07120d 0%,#101a12 55%,#07120d 100%)!important;border-bottom:1px solid rgba(215,255,63,.28)!important;box-shadow:0 3px 12px rgba(0,0,0,.22)!important;font:700 9px/1.2 system-ui,sans-serif!important;color:#d9f8f2!important}" +
      "#cz-global-counter-nav .cz-counter-brand{margin-right:auto!important;display:inline-flex!important;align-items:center!important;gap:6px!important;color:#d7ff3f!important;font-weight:900!important;letter-spacing:.7px!important;white-space:nowrap!important}" +
      "#cz-global-counter-nav .cz-counter-brand i{width:6px!important;height:6px!important;border-radius:50%!important;background:#d7ff3f!important;box-shadow:0 0 8px #d7ff3f!important}" +
      "#cz-global-counter-nav .cz-counter-caption{color:#91a79a!important;font-size:8px!important;letter-spacing:.6px!important}" +
      "#cz-global-counter-nav #viewerBadge{position:static!important;inset:auto!important;z-index:auto!important;display:inline-flex!important;flex:0 0 auto!important;flex-direction:row!important;align-items:center!important;gap:2px!important;width:auto!important;height:auto!important;max-width:none!important;margin:0!important;padding:1px 4px!important;border:1px solid rgba(70,235,210,.35)!important;border-radius:7px!important;background:rgba(3,15,23,.82)!important;color:#d9f8f2!important;box-shadow:none!important;pointer-events:none!important;backdrop-filter:none!important;white-space:nowrap!important}" +
      "#cz-global-counter-nav #viewerBadge .cz-global-total,#cz-global-counter-nav #viewerBadge .cz-global-live,#cz-global-counter-nav #viewerBadge .watching-total-label,#cz-global-counter-nav #viewerBadge .watching-live-label{display:inline-flex!important;flex-direction:row!important;align-items:center!important;gap:4px!important;width:auto!important;height:auto!important;min-width:0!important;margin:0!important;padding:2px 4px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#d9f8f2!important;font:800 8px/1.2 system-ui,sans-serif!important;letter-spacing:.2px!important;box-shadow:none!important}" +
      "#cz-global-counter-nav #viewerBadge .cz-global-live,#cz-global-counter-nav #viewerBadge .watching-live-label{border-left:1px solid rgba(70,235,210,.25)!important}" +
      "#cz-global-counter-nav #viewerBadge #totalVisits,#cz-global-counter-nav #viewerBadge #liveWatching{display:inline-block!important;min-width:18px!important;width:auto!important;height:auto!important;margin:0!important;padding:2px 4px!important;border:0!important;border-radius:4px!important;background:linear-gradient(135deg,#8fffea,#2bd9b7)!important;color:#071b20!important;font:950 9px/1.1 system-ui,sans-serif!important;text-align:center!important;box-shadow:none!important}" +
      "@media(max-width:480px){#cz-global-counter-nav{min-height:29px!important;padding:2px 7px!important;gap:5px!important}#cz-global-counter-nav .cz-counter-caption{display:none!important}#cz-global-counter-nav .cz-counter-brand{font-size:8px!important}#cz-global-counter-nav #viewerBadge .cz-global-total,#cz-global-counter-nav #viewerBadge .cz-global-live,#cz-global-counter-nav #viewerBadge .watching-total-label,#cz-global-counter-nav #viewerBadge .watching-live-label{font-size:7px!important;padding:2px 3px!important}}";
    document.head.appendChild(style);
  }

  function scan() {
    var badge = document.getElementById("viewerBadge");
    if (badge) ensureBar(badge);
  }

  function init() {
    addStyles();
    scan();
    var observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(scan, 300);
    window.setTimeout(scan, 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();