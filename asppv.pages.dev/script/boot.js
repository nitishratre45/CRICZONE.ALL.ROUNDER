(function () {
  "use strict";

  var STAMP = String(Date.now());
  var FILE_MODE = location.protocol === "file:";

  var FILES = [
    "app.js",
    "live-events.js",
    "willow-live.js",
    "fancode.js",
    "world-sports.js",
    "sony-liv.js",
    "scroll-anim.js"
  ];

  var STARTED = false;

  var FALLBACK = {
    siteName: "CRICZONE",
    heroSlideDuration: 8000,
    maxHeroMatches: 8,
    heroFeedUrl: "data/hero.json",
    apis: {
      football: "https://sonujson-v7.pages.dev/Data/events/football.json",
      cricket: "https://sonujson-v7.pages.dev/Data/events/cricket.json",
      willow: "https://sonujson-v5.pages.dev/Data/willow.json",
      willowLive: "https://sonujson-v5.pages.dev/Data/willow.json",
      willowSnapshot: "",
      fancode: "https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/refs/heads/main/fancode.json",
      fanCode: "https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/refs/heads/main/fancode.json",
      fancodeSnapshot: "",
      fanCodeSnapshot: "",
      worldSports: "https://matchdekho.in/api/world-sports.json",
      worldSportsSnapshot: "",
      sonyLiv: "https://raw.githubusercontent.com/kajju027/SonyLiv-Events-Json/refs/heads/main/sonyliv.json",
      sony: "https://raw.githubusercontent.com/kajju027/SonyLiv-Events-Json/refs/heads/main/sonyliv.json"
    },
    sections: {
      football: { link: "/asppv.pages.dev/watch/football/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/football/" },
      cricket: { link: "/asppv.pages.dev/watch/cricket/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/cricket/" },
      willow: { link: "/asppv.pages.dev/watch/willow/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/willow/" },
      fancode: { link: "/asppv.pages.dev/watch/fancode/pz/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/fancode/" },
      worldSports: { link: "/asppv.pages.dev/watch/wwsports/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/wwsports/" },
      sonyLiv: { link: "/asppv.pages.dev/watch/sliv/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/sliv/" }
    },
    cardLimit: 10,
    upcomingClickable: true,
    siteBase: "",
    labels: { watchNow: "Watch Now", comingSoon: "Coming Soon", viewAll: "View All Events" },
    playerBase: "",
    routes: {
      willowPlayer: "/asppv.pages.dev/watch/willow/",
      fancodePlayer: "/asppv.pages.dev/watch/fancode/pz/",
      sonyPlayer: "/asppv.pages.dev/watch/sliv/"
    },
    willowPlayerMode: "stream",
    heroMatches: []
  };

  function load(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      var finished = false;
      var timeout;

      function finish(error) {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        script.onload = null;
        script.onerror = null;
        if (error) reject(error);
        else resolve();
      }

      script.src = url;
      script.onload = function () { finish(); };
      script.onerror = function () { finish(new Error("Script failed to load: " + url)); };
      timeout = window.setTimeout(function () {
        finish(new Error("Script timed out: " + url));
      }, 10000);
      document.head.appendChild(script);
    });
  }

  function startScripts() {
    if (STARTED) return;
    STARTED = true;

    // Sequential loading keeps shared config/helpers available before dependent scripts.
    var chain = Promise.resolve();
    FILES.forEach(function (name) {
      chain = chain.then(function () {
        return load("script/" + name + (FILE_MODE ? "" : "?v=" + STAMP));
      }).catch(function (error) {
        if (window.console && console.error) console.error("[CRICZONE boot] " + name, error);
      });
    });
  }

  function installHelper() {
    if (window.CnpTVHelper) return;

    window.CnpTVHelper = (function () {
      function buildUrl(sectionConfig, eventId) {
        var config = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG || {};
        var siteBase = String(config.siteBase || "").replace(/\/+$/, "");
        var base = String(sectionConfig && sectionConfig.link || "");
        if (!base) return "";

        var resolved = (base.indexOf("://") === -1 && siteBase) ? siteBase + base : base;
        if (!eventId) return resolved;

        var mode = String(sectionConfig.idMode || "param");
        var key = String(sectionConfig.idKey || "id");
        if (mode === "path") return resolved.replace(/\/$/, "") + "/" + encodeURIComponent(eventId);

        var separator = resolved.indexOf("?") > -1 ? "&" : "?";
        return resolved + separator + encodeURIComponent(key) + "=" + encodeURIComponent(eventId);
      }

      function extractId(item) {
        if (!item || typeof item !== "object") return "";
        return String(item.id || item.matchId || item.match_id || item.matchID || item.stream_id || "");
      }

      function toTitleCase(value) {
        return String(value || "").replace(/\b\w/g, function (character) { return character.toUpperCase(); });
      }

      return { buildUrl: buildUrl, extractId: extractId, toTitleCase: toTitleCase };
    })();
  }

  function boot() {
    var config = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG;
    if (!config || typeof config !== "object") config = FALLBACK;

    // Merge safe defaults so a partial config does not break the event scripts.
    config.apis = Object.assign({}, FALLBACK.apis, config.apis || {});
    config.sections = Object.assign({}, FALLBACK.sections, config.sections || {});
    config.routes = Object.assign({}, FALLBACK.routes, config.routes || {});
    config.labels = Object.assign({}, FALLBACK.labels, config.labels || {});
    if (!config.siteName) config.siteName = "CRICZONE";

    window.CNPTV_CONFIG = config;
    window.MATCHDEKHO_CONFIG = config;
    installHelper();
    startScripts();
  }

  load("script/config.js" + (FILE_MODE ? "" : "?v=" + STAMP))
    .then(boot)
    .catch(function (error) {
      if (window.console && console.warn) console.warn("[CRICZONE boot] config.js unavailable; using fallback configuration.", error);
      boot();
    });
})();