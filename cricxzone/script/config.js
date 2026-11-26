var CRICZONE_CONF = {
  siteName: "CRICZONE",

  build: "24",
  heroSlideDuration: 10000,
  maxHeroMatches: 8,
  heroFeedUrl: "",
  eventRefreshMs: 300000,

  apis: {
    football:            "https://sonujson-v5.pages.dev/Data/events/football.json",
    cricket:             "https://sonujson-v5.pages.dev/Data/events/cricket.json",
    willow:              "https://sonujson-v5.pages.dev/Data/willow.json",
    willowLive:          "https://sonujson-v5.pages.dev/Data/willow.json",
    willowSnapshot:      "",
    fancode:             "https://raw.githubusercontent.com/ARYANBHAIcool/ascode/main/data/fancode.json",
    fanCode:             "https://raw.githubusercontent.com/ARYANBHAIcool/ascode/main/data/fancode.json",
    fancodeSnapshot:     "",
    fanCodeSnapshot:     "",
    worldSports:         "https://matchdekho.in/api/world-sports.json",
    worldSportsSnapshot: "",
    sonyLiv:             "https://raw.githubusercontent.com/kajju027/SonyLiv-Events-Json/refs/heads/main/sonyliv.json",
    sony:                "https://raw.githubusercontent.com/kajju027/SonyLiv-Events-Json/refs/heads/main/sonyliv.json"
  },

  sections: {
    football:    { link: "/cricxzone/watch/football/",   idMode: "param", idKey: "id", viewAllLink: "/cricxzone/watch/football/"  },
    cricket:     { link: "/cricxzone/watch/cricket/",    idMode: "param", idKey: "id", viewAllLink: "/cricxzone/watch/cricket/"   },
    willow:      { link: "/cricxzone/watch/willow/",     idMode: "param", idKey: "", viewAllLink: "/cricxzone/watch/willow/"    },
    fancode:     { link: "/fancodeweb/fc-play.html", idMode: "param", idKey: "id", viewAllLink: "/cricxzone/watch/fancode/" },
    worldSports: { link: "/cricxzone/watch/wwsports/",   idMode: "param", idKey: "id", viewAllLink: "/cricxzone/watch/wwsports/"  },
    sonyLiv:     { link: "/cricxzone/watch/sliv/",       idMode: "param", idKey: "id", viewAllLink: "/cricxzone/watch/sliv/"      }
  },

  cardLimit: 10,
  upcomingClickable: true,

  siteBase: "",

  labels: {
    watchNow:   "Watch Now",
    comingSoon: "Coming Soon",
    viewAll:    "View All Events"
  },

  playerBase: "",

  routes: {
    willowPlayer:  "/cricxzone/watch/willow/",
    fancodePlayer: "/fancodeweb/fc-play.html",
    fancodePage:   "/cricxzone/watch/fancode/",
    sonyPlayer:    "/cricxzone/watch/sliv/"
  },

  willowPlayerMode: "stream",

  heroMatches: []
};

window.CRICZONE_CONFIG      = CRICZONE_CONF;
window.CRICZONE_CONFIG = CRICZONE_CONF;

window.CRICZONEHelper = (function () {
  function buildUrl(sectionCfg, eventId) {
    var cfg = window.CRICZONE_CONFIG || window.CRICZONE_CONFIG || {};
    var siteBase = String(cfg.siteBase || "").replace(/\/+$/, "");
    var base = String(sectionCfg && sectionCfg.link || "");
    if (!base) return "";
    var resolved = (base.indexOf("://") === -1 && siteBase) ? (siteBase + base) : base;
    if (!eventId) return resolved;
    var mode = String(sectionCfg.idMode || "param");
    var key  = String(sectionCfg.idKey  || "id");
    if (mode === "path") {
      return resolved.replace(/\/$/, "") + "/" + encodeURIComponent(eventId);
    }
    var sep = resolved.indexOf("?") > -1 ? "&" : "?";
    return resolved + sep + encodeURIComponent(key) + "=" + encodeURIComponent(eventId);
  }

  function extractId(item) {
    if (!item || typeof item !== "object") return "";
    return String(item.id || item.matchId || item.match_id || item.matchID || item.stream_id || "");
  }

  function toTitleCase(str) {
    return String(str || "").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  return { buildUrl: buildUrl, extractId: extractId, toTitleCase: toTitleCase };
})();

if(typeof CRICZONE_CONF!=='undefined'&&CRICZONE_CONF){
  CRICZONE_CONF.heroMatches = [
    {
      "tournament": "ASIA CUP RISING STARS 2026 - SEMI-FINAL",
      "homeTeam": {
        "name": "INDIA A",
        "logo": "https://flagpedia.net/data/flags/w1160/in.webp"
      },
      "awayTeam": {
        "name": "SRI LANKA A",
        "logo": "https://flagpedia.net/data/flags/w1160/lk.webp"
      },
      "poster": "https://i.ibb.co/ksTy0Cr9/photo-2026-11-26-10-08-23.jpg",
      "date": "26 NOVEMBER 2026 - 3:30 AM",
      "watchUrl": "/cricxzone/home/live/asiacup.html"
    },
    {
      "tournament": "ASIA CUP RISING STARS 2026",
      "homeTeam": {
        "name": "INDIA A",
        "logo": "https://flagpedia.net/data/flags/w1160/in.webp"
      },
      "awayTeam": {
        "name": "UAE",
        "logo": "https://flagpedia.net/data/flags/w1160/lk.webp"
      },
      "poster": "https://imgh.in/host/bj7cji",
      "date": "24 NOVEMBER 2026 - 11:30 AM",
      "watchUrl": "/cricxzone/home/live/asiacup.html"
    },
    {
      "tournament": "INDIA TOUR OF NEW ZEALAND 2026 - 1ST TEST",
      "homeTeam": {
        "name": "India",
        "logo": "https://flagpedia.net/data/flags/w1160/in.webp"
      },
      "awayTeam": {
        "name": "New Zealand",
        "logo": "https://flagpedia.net/data/flags/w1160/nz.webp"
      },
      "poster": "https://imgh.in/host/x98v9c",
      "date": "1ST TEST MATCH - 3:30 AM",
      "watchUrl": "/cricxzone/home/live/ind-vs-nz.html"
    }
  ];
}
