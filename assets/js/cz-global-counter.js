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
  var API_BACKUP6 = "https://criczone-visitor-counter-backup-6.nitish-6.workers.dev";
  var API_BACKUP7 = "https://criczone-visitor-counter-backup-7.nitish-7.workers.dev";
  var API_LIST = [API_PRIMARY, API_BACKUP2, API_BACKUP3, API_BACKUP4, API_BACKUP5, API_BACKUP6, API_BACKUP7];
  var ROUTE_KEY = "cz_counter_backup_until_local_v2";
  var ROUTE_STATE_KEY = "cz_counter_route_local_v2";
  var FAILOVER_LOCK_KEY = "cz_counter_failover_lock_v1";
  var activeIndex = 0;
  var retryAt = 0;
  var totalFloor = 0;
  var routePromise = null;
  var tabId = createId();

  function readSharedRoute() {
    try {
      var saved = JSON.parse(localStorage.getItem(ROUTE_STATE_KEY) || "null");
      if (saved && Number.isInteger(saved.level) && saved.level >= 1 && saved.level <= 7) {
        activeIndex = saved.level - 1;
        retryAt = Number(saved.retryAt) || 0;
      }
    } catch (_) {}
  }
  readSharedRoute();

  // Reset routing to PRIMARY once per India-local day at/after 06:00.
  // This lets the morning traffic start on PRIMARY while preserving automatic
  // failover for the rest of the day if the active worker becomes unavailable.
  function applyDailyPrimaryStart() {
    try {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date());
      var values = {};
      parts.forEach(function (part) { values[part.type] = part.value; });
      var hour = Number(values.hour);
      var dayKey = values.year + "-" + values.month + "-" + values.day;
      var savedDay = localStorage.getItem("cz_counter_primary_daily_start_ist_v1");
      if (hour >= 6 && savedDay !== dayKey) {
        activeIndex = 0;
        retryAt = 0;
        saveRoute();
        localStorage.setItem("cz_counter_primary_daily_start_ist_v1", dayKey);
      }
    } catch (_) {}
  }
  applyDailyPrimaryStart();

  // Re-check at the next 06:00 IST even when a tab stays open overnight.
  function scheduleDailyPrimaryStart() {
    try {
      var now = new Date();
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
      }).formatToParts(now);
      var v = {};
      parts.forEach(function (part) { v[part.type] = part.value; });
      var hour = Number(v.hour), minute = Number(v.minute), second = Number(v.second);
      var ms = ((6 - hour + 24) % 24) * 3600000 - minute * 60000 - second * 1000;
      if (ms < 1000) ms += 24 * 3600000;
      window.setTimeout(function () {
        // At 06:00 IST, test PRIMARY before switching traffic back.
        // Its own D1 total remains untouched; only a healthy PRIMARY becomes active.
        (async function () {
          try {
            await probeAPI(0);
            setActive(0);
          } catch (_) {
            // PRIMARY is still unavailable: continue from the next backup,
            // preserving that backup's own independently saved total.
            await coordinateFailover(0);
          }
          try {
            var p = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
            var d = {};
            p.forEach(function (part) { d[part.type] = part.value; });
            localStorage.setItem("cz_counter_primary_daily_start_ist_v1", d.year + "-" + d.month + "-" + d.day);
          } catch (_) {}
        })();
        scheduleDailyPrimaryStart();
      }, ms);
    } catch (_) {}
  }
  scheduleDailyPrimaryStart();

  // Remove the misnamed Backup-5 readiness key written by the first S6 build.
  try { localStorage.removeItem("cz_backup5_readiness_status_v1"); } catch (_) {}

  // Route changes are shared by every page/tab on criczone.pages.dev.
  window.addEventListener("storage", function (event) {
    if (event.key === ROUTE_STATE_KEY && event.newValue) readSharedRoute();
  });
  var routeChannel = null;
  try {
    if ("BroadcastChannel" in window) {
      routeChannel = new BroadcastChannel("criczone-counter-route-v1");
      routeChannel.onmessage = function (event) {
        if (event.data && event.data.type === "route-updated") readSharedRoute();
      };
    }
  } catch (_) {}

  // Keep counter state out of Session Storage. Remove keys written by older builds.
  try {
    ["cz_counter_failover_state_v1", "criczone_live_tab_id_v1",
     "cz_counter_backup_until_tab_v1", "cz_counter_route_tab_v1"]
      .forEach(function (key) { sessionStorage.removeItem(key); });
  } catch (_) {}

  function saveRoute() {
    try {
      localStorage.setItem(ROUTE_STATE_KEY, JSON.stringify({
        level: activeIndex + 1, retryAt: retryAt, updatedAt: Date.now(), updatedBy: tabId
      }));
      if (activeIndex > 0) localStorage.setItem(ROUTE_KEY, String(retryAt));
      else localStorage.removeItem(ROUTE_KEY);
      if (routeChannel) routeChannel.postMessage({ type: "route-updated" });
    } catch (_) {}
  }

  function setActive(index) {
    activeIndex = index;
    retryAt = index === 0 ? 0 : Date.now() + 12 * 60 * 60 * 1000;
    saveRoute();
  }

  function saveEndpointHealth(index, status, error) {
    var names = ["PRIMARY", "BACKUP_2", "BACKUP_3", "BACKUP_4", "BACKUP_5", "BACKUP_6", "BACKUP_7"];
    var keys = ["cz_counter_primary_status_v1", "cz_counter_backup2_status_v1", "cz_counter_backup3_status_v1", "cz_counter_backup4_status_v1", "cz_counter_backup5_status_v1", "cz_counter_backup6_status_v1", "cz_counter_backup7_status_v1"];
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

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function coordinateFailover(failedIndex) {
    if (routePromise) return routePromise;
    routePromise = (async function () {
      var now = Date.now();
      var lease = null;
      try { lease = JSON.parse(localStorage.getItem(FAILOVER_LOCK_KEY) || "null"); } catch (_) {}

      if (lease && lease.expiresAt > now && lease.owner !== tabId) {
        // Wait for the current tab's full seven-endpoint check (up to ~35s),
        // not just 12 seconds, then adopt its shared route.
        var deadline = Math.max(lease.expiresAt + 3000, now + 30000);
        while (Date.now() < deadline) {
          await wait(250);
          readSharedRoute();
          try {
            var currentLease = JSON.parse(localStorage.getItem(FAILOVER_LOCK_KEY) || "null");
            if (!currentLease || currentLease.expiresAt <= Date.now()) break;
          } catch (_) { break; }
        }
        readSharedRoute();
        return activeIndex;
      }

      // Claim a short lease so only one tab performs the failover probes.
      var myLease = { owner: tabId, expiresAt: Date.now() + 45000 };
      try {
        localStorage.setItem(FAILOVER_LOCK_KEY, JSON.stringify(myLease));
        var confirmed = JSON.parse(localStorage.getItem(FAILOVER_LOCK_KEY) || "null");
        if (!confirmed || confirmed.owner !== tabId) {
          await wait(500);
          readSharedRoute();
          return activeIndex;
        }
      } catch (_) {}

      // Start with the server AFTER the failed route, wrapping around only
      // after all later backups have been checked. Never jump back to PRIMARY
      // before trying the next configured backup (especially S6 -> S7).
      for (var step = 1; step <= API_LIST.length; step++) {
        // A retry-window expiry passes -1, making PRIMARY (index 0) the first probe.
        var i = (failedIndex + step) % API_LIST.length;
        try {
          await probeAPI(i);
          setActive(i);
          return i;
        } catch (_) {}
      }
      return -1;
    })();
    try { return await routePromise; }
    finally {
      try {
        var current = JSON.parse(localStorage.getItem(FAILOVER_LOCK_KEY) || "null");
        if (current && current.owner === tabId) localStorage.removeItem(FAILOVER_LOCK_KEY);
      } catch (_) {}
      routePromise = null;
    }
  }

  async function apiFetch(path, options) {
    readSharedRoute();
    // Once a backup's 12-hour retry time expires, the coordinated check starts
    // from PRIMARY. If the active worker fails earlier, use the same B order.
    if (activeIndex > 0 && Date.now() >= retryAt) {
      await coordinateFailover(-1);
      readSharedRoute();
    }

    var attemptedIndex = activeIndex;
    try {
      return (await requestAPI(API_LIST[attemptedIndex], path, options)).response;
    } catch (error) {
      var selected = await coordinateFailover(attemptedIndex);
      readSharedRoute();
      if (selected < 0) throw error;

      // A probe may confirm that the same worker recovered. Retry the actual
      // request once against the selected worker instead of failing immediately.
      var targetIndex = activeIndex;
      // A failed POST may have reached the old server even if its response was
      // lost. Never replay a counted visit into a different independent D1 DB.
      // This gives at-most-once counting across failover rather than duplicates.
      if (path === "/api/visit" && options && options.method === "POST" && targetIndex !== attemptedIndex) {
        var ambiguous = new Error("Visit was not replayed after switching counter servers");
        ambiguous.counterVisitNotReplayed = true;
        throw ambiguous;
      }
      return (await requestAPI(API_LIST[targetIndex], path, options)).response;
    }
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
    // Show the shared active Worker label on every page using this global counter.
    var server = document.getElementById("counterServer");
    if (!server) {
      server = document.createElement("span");
      server.id = "counterServer";
      server.textContent = "S1";
      server.title = "Connected counter server: Primary";
      badge.appendChild(server);
    }
    function updateCounterServer() {
      var names = ["Primary", "Backup 2", "Backup 3", "Backup 4", "Backup 5", "Backup 6", "Backup 7"];
      var level = 1;
      try {
        var route = JSON.parse(localStorage.getItem("cz_counter_route_local_v2") || "null");
        if (route && Number.isInteger(route.level) && route.level >= 1 && route.level <= 7) level = route.level;
      } catch (_) {}
      server.textContent = "S" + level;
      server.title = "Connected counter server: " + names[level - 1];
      server.setAttribute("aria-label", server.title);
    }
    updateCounterServer();
    window.addEventListener("storage", function (event) {
      if (event.key === "cz_counter_route_local_v2") updateCounterServer();
    });
    try {
      if ("BroadcastChannel" in window) {
        var serverChannel = new BroadcastChannel("criczone-counter-route-v1");
        serverChannel.onmessage = updateCounterServer;
      }
    } catch (_) {}
    if (!badge.__czServerLabelTimer) {
      badge.__czServerLabelTimer = window.setInterval(updateCounterServer, 2000);
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


  function start() {
    var els = makeBadge();
    if (!els.total || !els.live) return;
    // One stable visitor ID per browser profile: shared by tabs and page refreshes.
    // A new request_id is still created for every page load, so each visit counts once.
    var visitorId;
    try {
      visitorId = localStorage.getItem("cz_counter_visitor_id_v2");
      if (!visitorId || !/^[A-Za-z0-9._:-]{8,128}$/.test(visitorId)) {
        visitorId = createId();
        localStorage.setItem("cz_counter_visitor_id_v2", visitorId);
      }
    } catch (_) {
      visitorId = createId();
    }

    var pageVisitPending = true;
    var pageVisitRequestId = createId();
    var busy = false;
    var heartbeatLeaseKey = "cz_counter_live_heartbeat_lease_v1";

    function claimHeartbeatLease() {
      try {
        var now = Date.now();
        var lease = JSON.parse(localStorage.getItem(heartbeatLeaseKey) || "null");
        if (lease && lease.expiresAt > now && lease.owner !== tabId) return false;
        localStorage.setItem(heartbeatLeaseKey, JSON.stringify({
          owner: tabId,
          expiresAt: now + 45000
        }));
        var confirmed = JSON.parse(localStorage.getItem(heartbeatLeaseKey) || "null");
        return !!confirmed && confirmed.owner === tabId;
      } catch (_) {
        return true;
      }
    }

    function paint(data) {
      var total = data && (data.total_visits != null ? data.total_visits : data.totalVisits);
      if (Number.isFinite(Number(total))) {
        // Each worker owns its own total. Never carry a larger value from a
        // different worker into this worker's display after failover.
        els.total.textContent = Number(total).toLocaleString("en-IN");
      }
    }

    async function heartbeat() {
      if (busy || document.visibilityState !== "visible") return;
      // Every new page load sends its own counted visit. Routine live heartbeats
      // are sent by only one tab for this browser profile.
      if (!pageVisitPending && !claimHeartbeatLease()) return;
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
        if (error && error.counterVisitNotReplayed) pageVisitPending = false;
        console.warn("[CRICZONE] Global visitor counter unavailable:", error);
      } finally { busy = false; }
    }

    // Keep visitor-counter traffic on the active worker only.
    // Polling every database and syncing totals from every page multiplies API usage.
    async function refreshCombinedLive(activeStats) {
      if (document.visibilityState !== "visible" || !activeStats) return;
      var live = Number(activeStats.live_visitors);
      if (Number.isFinite(live)) {
        // LIVE is local to the currently active worker; no fan-out polling.
        els.live.textContent = (live + 345).toLocaleString("en-IN");
      }
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
      } catch (error) {
        console.warn("[CRICZONE] Global visitor stats unavailable:", error);
      }
    }

    heartbeat();
    refreshStats();
    window.setInterval(heartbeat, 30000);
    window.setInterval(refreshStats, 120000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        applyDailyPrimaryStart();
        heartbeat();
        refreshStats();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();