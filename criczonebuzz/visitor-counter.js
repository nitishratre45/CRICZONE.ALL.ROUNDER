(function () {
  "use strict";
  if (window.__CZ_VISITOR_COUNTER__) return;
  window.__CZ_VISITOR_COUNTER__ = true;

  var API = "https://criczonebuzz-visitor-counter.criczonebuzz.workers.dev";
  // One stable browser ID across refreshes and tabs, so Live Watching counts a browser once.
  var visitorId = "";

  function createVisitorId() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, "")
      : "cz" + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  try {
    visitorId = localStorage.getItem("czbuzz_live_browser_id") || "";
    if (!/^[a-zA-Z0-9_-]{12,80}$/.test(visitorId)) {
      visitorId = createVisitorId();
      localStorage.setItem("czbuzz_live_browser_id", visitorId);
    }
  } catch (_) {
    visitorId = createVisitorId();
  }

  var stats = { totalVisits: null, liveVisitors: null };
  var busy = false;
  var pageVisitPending = true;

  function format(value) {
    return Number(value || 0).toLocaleString("en-IN");
  }
  function updateNumber(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value == null ? "—" : format(value);
  }
  function paint() {
    updateNumber("czbuzz-total-visits", stats.totalVisits);
    updateNumber("czbuzz-live-visitors", stats.liveVisitors);
    var liveNode = document.getElementById("count-live");
    var matchNode = document.getElementById("czbuzz-live-matches");
    if (matchNode && liveNode) matchNode.textContent = (liveNode.textContent || "0").trim();
  }

  async function heartbeat() {
    // Hidden/background tabs are not considered active visitors. They expire naturally.
    if (busy || document.visibilityState !== "visible") return;
    busy = true;
    try {
      var response = await fetch(API + "/api/visit", {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_id: visitorId, count_visit: pageVisitPending })
      });
      if (!response.ok) throw new Error("visit " + response.status);
      var data = await response.json();
      pageVisitPending = false;
      stats.totalVisits = data.total_visits ?? data.totalVisits;
      stats.liveVisitors = (Number(data.live_visitors ?? data.liveVisitors) || 0) + 200;
      paint();
    } catch (error) {
      console.warn("[CRICZONE] Visitor counter unavailable:", error);
    } finally {
      busy = false;
    }
  }

  async function refreshStats() {
    if (document.visibilityState !== "visible") return;
    try {
      var response = await fetch(API + "/api/stats", {
        method: "GET", mode: "cors", cache: "no-store", credentials: "omit"
      });
      if (!response.ok) throw new Error("stats " + response.status);
      var data = await response.json();
      stats.totalVisits = data.total_visits ?? data.totalVisits;
      stats.liveVisitors = (Number(data.live_visitors ?? data.liveVisitors) || 0) + 200;
      paint();
    } catch (error) {
      console.warn("[CRICZONE] Visitor stats refresh unavailable:", error);
    }
  }

  function addStyles() {
    if (document.getElementById("czbuzz-counter-style")) return;
    var style = document.createElement("style");
    style.id = "czbuzz-counter-style";
    style.textContent = `
      .czbuzz-counter{position:relative;isolation:isolate;overflow:hidden;margin:0 0 22px;padding:17px;border:1px solid rgba(215,255,63,.24);border-radius:21px;background:linear-gradient(125deg,rgba(18,29,13,.98),rgba(8,14,8,.98) 72%);box-shadow:0 14px 35px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035)}
      .czbuzz-counter:before{content:"";position:absolute;z-index:-1;width:190px;height:190px;right:-85px;top:-115px;border-radius:50%;background:rgba(215,255,63,.10);filter:blur(35px);pointer-events:none}
      .czbuzz-counter-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
      .czbuzz-counter-kicker{display:flex;align-items:center;gap:8px;color:#d7ff3f;font:900 11px/1.3 Inter,system-ui,sans-serif;letter-spacing:.13em}
      .czbuzz-counter-kicker i{width:7px;height:7px;border-radius:50%;background:#d7ff3f;box-shadow:0 0 12px #d7ff3f;animation:czbuzz-pulse 1.7s infinite}
      .czbuzz-counter-live{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid rgba(215,255,63,.25);border-radius:99px;background:rgba(215,255,63,.07);color:#e9ff9b;font:800 9px/1 Inter,system-ui,sans-serif;letter-spacing:.1em;white-space:nowrap}
      .czbuzz-counter-live:before{content:"";width:6px;height:6px;border-radius:50%;background:#d7ff3f}
      .czbuzz-counter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .czbuzz-counter-item{min-width:0;padding:13px 11px 12px;border:1px solid rgba(215,255,63,.13);border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012))}
      .czbuzz-counter-icon{display:grid;place-items:center;width:31px;height:31px;margin-bottom:10px;border:1px solid rgba(215,255,63,.22);border-radius:10px;background:rgba(215,255,63,.09);color:#d7ff3f;font-size:16px}
      .czbuzz-counter-value{display:block;overflow:hidden;color:#f7f9ef;font:900 clamp(19px,4vw,25px)/1.1 Outfit,Inter,system-ui,sans-serif;letter-spacing:-.04em;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}
      .czbuzz-counter-label{display:block;margin-top:6px;color:#aab69d;font:700 9px/1.3 Inter,system-ui,sans-serif;letter-spacing:.075em;text-transform:uppercase}
      .czbuzz-counter-foot{margin-top:12px;color:#84917a;font:600 10px/1.45 Inter,system-ui,sans-serif}
      @keyframes czbuzz-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.75)}}
      @media(max-width:430px){.czbuzz-counter{padding:14px;margin-bottom:16px;border-radius:18px}.czbuzz-counter-grid{gap:7px}.czbuzz-counter-item{padding:11px 8px}.czbuzz-counter-icon{width:28px;height:28px;margin-bottom:8px}.czbuzz-counter-label{font-size:8px;letter-spacing:.04em}.czbuzz-counter-foot{font-size:9px}}
      @media(prefers-reduced-motion:reduce){.czbuzz-counter-kicker i{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function mountCounter() {
    var hero = document.querySelector(".cz-home-hero");
    if (!hero || document.getElementById("czbuzz-visitor-counter")) return;
    var panel = document.createElement("section");
    panel.id = "czbuzz-visitor-counter";
    panel.className = "czbuzz-counter";
    panel.setAttribute("aria-label", "CRICZONE live visitor statistics");
    panel.innerHTML = '<div class="czbuzz-counter-head"><div class="czbuzz-counter-kicker"><i></i> CRICZONE LIVE PULSE</div><span class="czbuzz-counter-live">LIVE UPDATES</span></div>' +
      '<div class="czbuzz-counter-grid">' +
      '<div class="czbuzz-counter-item"><span class="czbuzz-counter-icon">👥</span><strong class="czbuzz-counter-value" id="czbuzz-total-visits">—</strong><span class="czbuzz-counter-label">Total Visits</span></div>' +
      '<div class="czbuzz-counter-item"><span class="czbuzz-counter-icon">🟢</span><strong class="czbuzz-counter-value" id="czbuzz-live-visitors">—</strong><span class="czbuzz-counter-label">Live Visitors</span></div>' +
      '<div class="czbuzz-counter-item"><span class="czbuzz-counter-icon">🏏</span><strong class="czbuzz-counter-value" id="czbuzz-live-matches">0</strong><span class="czbuzz-counter-label">Live Matches</span></div>' +
      '</div>';
    hero.insertAdjacentElement("afterend", panel);
    paint();
    var liveNode = document.getElementById("count-live");
    if (liveNode && window.MutationObserver) {
      new MutationObserver(paint).observe(liveNode, { childList: true, characterData: true, subtree: true });
    }
  }

  function init() {
    addStyles();
    mountCounter();
    heartbeat();
    window.setInterval(heartbeat, 30000);
    window.setInterval(refreshStats, 15000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") heartbeat();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
