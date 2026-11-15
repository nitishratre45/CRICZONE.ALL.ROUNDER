/* CRICZONE Global Visitor Counter
 * Injected by functions/_middleware.js on HTML pages that do not already
 * contain the legacy counter. Does not modify player or Telegram behavior.
 */
(function () {
  "use strict";
  if (window.__CRICZONE_TOTAL_COUNTER__) return;
  window.__CRICZONE_TOTAL_COUNTER__ = true;

  var API_PRIMARY = "https://criczone-visitor-counter.criczone-nitish.workers.dev";
  var API_BACKUP2 = "https://criczone-visitor-counter-backup.nitish-2.workers.dev";
  var API_BACKUP3 = "https://criczone-visitor-counter-backup-3.nitish-3.workers.dev";
  var API_BACKUP4 = "https://criczone-visitor-counter-backup-4.nitish-4.workers.dev";
  var API_BACKUP5 = "https://criczone-visitor-counter-backup-5.nitish-5.workers.dev";
  var API_LIST = [API_PRIMARY, API_BACKUP2, API_BACKUP3, API_BACKUP4, API_BACKUP5];
  var ROUTE_KEY = "cz_counter_backup_until_local_v2";
  var ROUTE_STATE_KEY = "cz_counter_route_local_v2";
  var TOTAL_KEY = "cz_counter_total_floor_v2";
  var activeIndex = 0;
  var retryAt = 0;
  var totalFloor = 0;
  try {
    var savedRoute = JSON.parse(localStorage.getItem(ROUTE_STATE_KEY) || "null");
    if (savedRoute && Number.isInteger(savedRoute.level) && savedRoute.level >= 1 && savedRoute.level <= 5 &&
        Number(savedRoute.retryAt) > Date.now()) {
      activeIndex = savedRoute.level - 1;
      retryAt = Number(savedRoute.retryAt);
    }
    totalFloor = Math.max(0, Number(localStorage.getItem(TOTAL_KEY) || 0) || 0);
  } catch (_) {}
  var routePromise = null;

  // Keep counter state out of Session Storage. Remove keys written by older builds.
  try {
    ["cz_counter_failover_state_v1", "criczone_live_tab_id_v1",
     "cz_counter_backup_until_tab_v1", "cz_counter_route_tab_v1"]
      .forEach(function (key) { sessionStorage.removeItem(key); });
  } catch (_) {}

  // Every fresh page load begins with PRIMARY. Backup selection is only
  // made after a live request to the current endpoint fails in this page session.

  function saveRoute() {
    try {
      localStorage.setItem(ROUTE_STATE_KEY, JSON.stringify({ level: activeIndex + 1, retryAt: retryAt }));
      if (activeIndex > 0) localStorage.setItem(ROUTE_KEY, String(retryAt));
      else localStorage.removeItem(ROUTE_KEY);
    } catch (_) {}
  }

  function setActive(index) {
    activeIndex = index;
    retryAt = index === 0 ? 0 : Date.now() + 12 * 60 * 60 * 1000;
    saveRoute();
  }

  function saveEndpointHealth(index, status, error) {
    var names = ["PRIMARY", "BACKUP_2", "BACKUP_3", "BACKUP_4", "BACKUP_5"];
    var keys = ["cz_counter_primary_status_v1", "cz_counter_backup2_status_v1", "cz_counter_backup3_status_v1", "cz_counter_backup4_status_v1", "cz_counter_backup5_status_v1"];
    var record = {
      level: index + 1,
      endpoint: names[index],
      status: status,
      checkedAt: new Date().toISOString()
    };
    if (error) record.error = String(error).slice(0, 180);
    try {
      localStorage.setItem(keys[index], JSON.stringify(record));
      var all = JSON.parse(localStorage.getItem("cz_counter_endpoint_health_v1") || "{}");
      all[names[index]] = record;
      localStorage.setItem("cz_counter_endpoint_health_v1", JSON.stringify(all));
    } catch (_) {}
  }

  async function requestAPI(base, path, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 5000);
    try {
      var response = await fetch(base + path, Object.assign({}, options || {}, {
        mode: "cors", cache: "no-store", credentials: "omit", signal: controller.signal
      }));
      if (!response.ok) throw new Error("Counter HTTP " + response.status);
      var data = await response.clone().json();
      if (path === "/api/stats") {
        if (!data || !Number.isFinite(Number(data.total_visits)) || !Number.isFinite(Number(data.live_visitors))) {
          throw new Error("Invalid counter stats response");
        }
      } else if (path === "/api/visit" && (!data || data.ok !== true)) {
        throw new Error("Counter visit write was not acknowledged");
      }
      var endpointIndex = API_LIST.indexOf(base);
      if (endpointIndex >= 0) saveEndpointHealth(endpointIndex, "READY");
      return { response: response, data: data };
    } catch (error) {
      var failedIndex = API_LIST.indexOf(base);
      if (failedIndex >= 0) saveEndpointHealth(failedIndex, "FAILED", error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function probeAPI(index) {
    var result = await requestAPI(API_LIST[index], "/api/stats", { method: "GET" });
    return result.data;
  }

  async function ensureRoute() {
    if (activeIndex === 0 || Date.now() < retryAt) return;
    if (routePromise) return routePromise;
    routePromise = (async function () {
      for (var i = 0; i < API_LIST.length; i++) {
        try {
          await probeAPI(i);
          setActive(i);
          return;
        } catch (_) {}
      }
    })();
    try { await routePromise; }
    finally { routePromise = null; }
  }

  async function apiFetch(path, options) {
    await ensureRoute();
    var order = API_LIST.map(function (_, index) { return (activeIndex + index) % API_LIST.length; });
    var lastError = null;
    for (var n = 0; n < order.length; n++) {
      var index = order[n];
      try {
        var result = await requestAPI(API_LIST[index], path, options);
        if (index !== activeIndex) setActive(index);
        return result.response;
      } catch (error) {
        lastError = error;
        if (n < order.length - 1) setActive(order[n + 1]);
      }
    }
    throw lastError || new Error("All five visitor counter endpoints are unavailable");
  }

  function makeBadge() {
    var badge = document.getElementById("viewerBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "viewerBadge";
      badge.setAttribute("aria-live", "polite");
      badge.setAttribute("aria-label", "CRICZONE visitor statistics");
      (document.body || document.documentElement).appendChild(badge);
    }
    var total = document.getElementById("totalVisits");
    var live = document.getElementById("liveWatching");
    if (!total || !live) {
      badge.innerHTML = '<span class="cz-global-total">TOTAL <strong id="totalVisits">Loading…</strong></span><span class="cz-global-live">LIVE <strong id="liveWatching">—</strong></span>';
    }
    if (!document.getElementById("cz-global-counter-style")) {
      var style = document.createElement("style");
      style.id = "cz-global-counter-style";
      style.textContent =
        "#viewerBadge{position:fixed!important;z-index:2147483000!important;top:12px!important;right:12px!important;left:auto!important;display:inline-flex!important;flex-direction:row!important;align-items:center!important;gap:0!important;width:auto!important;height:auto!important;margin:0!important;padding:3px 5px!important;border:1px solid rgba(70,235,210,.48)!important;border-radius:8px!important;background:rgba(3,15,23,.94)!important;color:#d9f8f2!important;font:800 8px/1.2 system-ui,sans-serif!important;letter-spacing:.35px!important;white-space:nowrap!important;box-shadow:0 4px 14px rgba(0,0,0,.35)!important;pointer-events:auto!important;cursor:grab!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;backdrop-filter:blur(12px)!important}" +
        "#viewerBadge .cz-global-total,#viewerBadge .cz-global-live{display:flex!important;align-items:center!important;gap:3px!important;padding:1px 3px!important;font:800 7px/1.2 system-ui,sans-serif!important}" +
        "#viewerBadge .cz-global-live{border-left:1px solid rgba(70,235,210,.25)!important}" +
        "#viewerBadge #totalVisits,#viewerBadge #liveWatching{display:inline-block!important;min-width:14px!important;padding:1px 3px!important;border-radius:4px!important;background:linear-gradient(135deg,#8fffea,#2bd9b7)!important;color:#071b20!important;font:950 8px/1.1 system-ui,sans-serif!important;text-align:center!important;font-variant-numeric:tabular-nums!important}" +
        "@media(max-width:480px){#viewerBadge{top:8px!important;right:8px!important;padding:2px 4px!important}#viewerBadge .cz-global-total,#viewerBadge .cz-global-live{font-size:6px!important}}";
      style.textContent += "@keyframes czCounterSweep{from{transform:translateX(0)}to{transform:translateX(calc(-1 * (100vw - 100% - 24px)))}}";
      document.head.appendChild(style);
    }
    // Auto-sweep horizontally every 10 seconds until the user manually places it.
    // A saved manual position disables the automatic movement for this page.
    if (!badge.__czDraggable) {
      badge.__czDraggable = true;
      var positionKey = "cz_counter_position_v1:" + location.pathname;
      var manuallyPlaced = false;
      try {
        var saved = JSON.parse(localStorage.getItem(positionKey) || "null");
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          manuallyPlaced = true;
          badge.style.setProperty("left", Math.max(0, Math.min(saved.x, innerWidth - badge.offsetWidth)) + "px", "important");
          badge.style.setProperty("top", Math.max(0, Math.min(saved.y, innerHeight - badge.offsetHeight)) + "px", "important");
          badge.style.setProperty("right", "auto", "important");
        }
      } catch (_) {}
      if (!manuallyPlaced) {
        badge.classList.add("cz-counter-auto-move");
        badge.style.setProperty("animation", "czCounterSweep 20s ease-in-out infinite alternate", "important");
      }
      badge.setAttribute("title", manuallyPlaced ? "Drag to move counter" : "Automatically moves; drag to set position");
      var drag = null;
      badge.addEventListener("pointerdown", function (event) {
        if (event.button !== undefined && event.button !== 0) return;
        var rect = badge.getBoundingClientRect();
        badge.style.setProperty("animation", "none", "important");
        drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top, startX: rect.left, startY: rect.top, moved: false };
        badge.style.setProperty("left", rect.left + "px", "important");
        badge.style.setProperty("top", rect.top + "px", "important");
        badge.style.setProperty("right", "auto", "important");
        badge.style.setProperty("bottom", "auto", "important");
        badge.style.setProperty("cursor", "grabbing", "important");
        try { badge.setPointerCapture(event.pointerId); } catch (_) {}
        event.preventDefault();
      });
      badge.addEventListener("pointermove", function (event) {
        if (!drag || event.pointerId !== drag.id) return;
        var x = Math.max(0, Math.min(event.clientX - drag.dx, innerWidth - badge.offsetWidth));
        var y = Math.max(0, Math.min(event.clientY - drag.dy, innerHeight - badge.offsetHeight));
        if (Math.abs(x - drag.startX) > 5 || Math.abs(y - drag.startY) > 5) drag.moved = true;
        badge.style.setProperty("left", x + "px", "important");
        badge.style.setProperty("top", y + "px", "important");
      });
      function finishDrag(event) {
        if (!drag || (event && event.pointerId !== drag.id)) return;
        var wasMoved = drag.moved;
        var rect = badge.getBoundingClientRect();
        if (wasMoved) {
          manuallyPlaced = true;
          badge.classList.remove("cz-counter-auto-move");
          badge.style.setProperty("animation", "none", "important");
          try { localStorage.setItem(positionKey, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) })); } catch (_) {}
          badge.setAttribute("title", "Drag to move counter");
        } else if (!manuallyPlaced) {
          badge.style.setProperty("left", "", "important");
          badge.style.setProperty("top", "", "important");
          badge.style.setProperty("right", "12px", "important");
          badge.style.setProperty("animation", "czCounterSweep 20s ease-in-out infinite alternate", "important");
        }
        drag = null;
        badge.style.setProperty("cursor", "grab", "important");
      }
      badge.addEventListener("pointerup", finishDrag);
      badge.addEventListener("pointercancel", finishDrag);
      window.addEventListener("resize", function () {
        if (!manuallyPlaced && !drag) badge.style.setProperty("animation", "czCounterSweep 20s ease-in-out infinite alternate", "important");
      });
    }
    return { total: document.getElementById("totalVisits"), live: document.getElementById("liveWatching") };
  }

  function createId() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, "")
      : "cz" + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  // Background-only Backup-5 readiness check: once per browser/origin per hour.
  // It is deliberately not awaited, so normal counter requests never wait for it.
  function checkBackup3ReadyInBackground() {
    var key = "cz_backup5_ready_check_at_v1";
    var now = Date.now();
    try {
      var last = Number(localStorage.getItem(key) || 0);
      if (last && now - last < 60 * 60 * 1000) return;
      localStorage.setItem(key, String(now));
    } catch (_) {
      // If storage is unavailable, still make one best-effort check for this page load.
    }
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 4000);
    fetch(API_BACKUP5 + "/api/ready?source=global-counter-hourly", {
      method: "GET", mode: "cors", cache: "no-store", credentials: "omit",
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }).then(function (data) {
      var isReady = !!(data && data.status === "ready" && data.database === "connected");
      try {
        localStorage.setItem("cz_backup5_readiness_status_v1", JSON.stringify({
          level: 5,
          status: isReady ? "READY" : "NOT_READY",
          database: data && data.database ? data.database : "unknown",
          checkedAt: new Date().toISOString()
        }));
      } catch (_) {}
      if (isReady) {
        console.info("[CRICZONE] BACKUP-5 READY", data);
      } else {
        console.warn("[CRICZONE] BACKUP-5 NOT READY", data);
      }
    }).catch(function (error) {
      try {
        localStorage.setItem("cz_backup3_status_v1", JSON.stringify({
          level: 5, status: "CHECK_FAILED", checkedAt: new Date().toISOString(),
          error: String(error)
        }));
      } catch (_) {}
      console.warn("[CRICZONE] BACKUP-5 readiness check failed", String(error));
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  function start() {
    var els = makeBadge();
    checkBackup3ReadyInBackground();
    if (!els.total || !els.live) return;
    // Keep the live visitor ID in memory only; do not persist it in browser storage.
    var visitorId = createId();

    var pageVisitPending = true;
    var pageVisitRequestId = createId();
    var busy = false;

    function paint(data) {
      var total = data && (data.total_visits != null ? data.total_visits : data.totalVisits);
      if (Number.isFinite(Number(total))) {
        totalFloor = Math.max(totalFloor, Number(total));
        try { localStorage.setItem(TOTAL_KEY, String(totalFloor)); } catch (_) {}
        els.total.textContent = totalFloor.toLocaleString("en-IN");
      }
    }

    async function heartbeat() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        var response = await apiFetch("/api/visit", {
          method: "POST", mode: "cors", cache: "no-store", credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitor_id: visitorId,
            count_visit: pageVisitPending,
            request_id: pageVisitRequestId
          })
        });
        var data = await response.json();
        pageVisitPending = false;
        paint(data);
      } catch (error) {
        console.warn("[CRICZONE] Global visitor counter unavailable:", error);
      } finally { busy = false; }
    }

    // Per-page memory cache: only sync a backup when the observed total changes.
    var lastSyncedTotals = [-1, -1, -1, -1, -1];

    async function syncBackupTotals(floor) {
      if (!Number.isFinite(floor) || floor < 0) return;
      var jobs = [];
      for (var i = 1; i < API_LIST.length; i++) {
        if (i === activeIndex || floor <= lastSyncedTotals[i]) continue;
        (function (index) {
          jobs.push(fetch(API_LIST[index] + "/api/sync-total", {
            method: "POST", mode: "cors", cache: "no-store", credentials: "omit",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ total_visits: floor })
          }).then(function (response) {
            if (response.ok) lastSyncedTotals[index] = floor;
          }).catch(function () {}));
        })(i);
      }
      await Promise.all(jobs);
    }

    async function refreshCombinedLive(activeStats) {
      if (document.visibilityState !== "visible") return;
      var active = activeIndex;
      var results = await Promise.all(API_LIST.map(async function (base, index) {
        try {
          // Reuse the active worker's /api/stats response; query only the other workers.
          var data = index === active ? activeStats :
            (await requestAPI(base, "/api/stats", { method: "GET" })).data;
          var value = Number(data && data.live_visitors);
          return Number.isFinite(value) && value > 0 ? value : 0;
        } catch (_) {
          // An unavailable/limited worker contributes zero; other workers still count.
          return 0;
        }
      }));
      var combined = results.reduce(function (sum, value) { return sum + value; }, 0);
      els.live.textContent = (combined + 345).toLocaleString("en-IN");
    }

    async function refreshStats() {
      if (document.visibilityState !== "visible") return;
      try {
        var response = await apiFetch("/api/stats", {
          method: "GET", mode: "cors", cache: "no-store", credentials: "omit"
        });
        var data = await response.json();
        paint(data);
        await refreshCombinedLive(data);
        // Sync only backups whose stored total has not yet reached this value.
        await syncBackupTotals(totalFloor);
      } catch (error) {
        console.warn("[CRICZONE] Global visitor stats unavailable:", error);
      }
    }

    heartbeat();
    refreshStats();
    window.setInterval(heartbeat, 30000);
    window.setInterval(refreshStats, 60000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") { heartbeat(); refreshStats(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();