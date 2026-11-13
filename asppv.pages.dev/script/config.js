var CNPTV_CONF = {
  siteName: "CRICZONE",
  build: "32",
  heroSlideDuration: 8000,
  maxHeroMatches: 8,
  heroFeedUrl: "data/hero.json",
  eventRefreshMs: 120000,

  apis: {
    football: "https://sonujson-v7.pages.dev/Data/events/football.json",
    footballFallback: "https://sonujson-v5.pages.dev/Data/events/football.json",
    cricket: "https://sonujson-v7.pages.dev/Data/events/cricket.json",
    cricketFallback: "https://sonujson-v5.pages.dev/Data/events/cricket.json",
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
    sony: "https://raw.githubusercontent.com/kajju027/SonyLiv-Events-Json/refs/heads/main/sonyliv.json",
    proxy: "/api/proxy?u=",
    backupProxy: "https://stream-through-spark.lovable.app/api/proxy?u="
  },

  sections: {
    football: { link: "/asppv.pages.dev/watch/football/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/football/" },
    cricket: { link: "/asppv.pages.dev/watch/cricket/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/cricket/" },
    willow: { link: "/asppv.pages.dev/watch/willow/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/willow/" },
    fancode: { link: "/asppv.pages.dev/watch/fancode/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/fancode/" },
    worldSports: { link: "/asppv.pages.dev/watch/wwsports/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/wwsports/" },
    sonyLiv: { link: "/asppv.pages.dev/watch/sliv/", idMode: "param", idKey: "id", viewAllLink: "/asppv.pages.dev/watch/sliv/" }
  },

  cardLimit: 12,
  upcomingClickable: true,
  siteBase: "",

  labels: {
    watchNow: "Watch Now",
    comingSoon: "Coming Soon",
    viewAll: "View All Events"
  },

  playerBase: "",

  routes: {
    willowPlayer: "/asppv.pages.dev/watch/willow/",
    fancodePlayer: "/asppv.pages.dev/watch/fancode/",
    sonyPlayer: "/asppv.pages.dev/watch/sliv/"
  },

  willowPlayerMode: "stream",

  heroMatches: [
    {
      tournament: "UEFA NATIONS LEAGUE 2026-27",
      homeTeam: { name: "Italy", logo: "" },
      awayTeam: { name: "France", logo: "" },
      poster: "https://origin-staticv2.sonyliv.com/videoasset_images/manage_file/1000027664/1793257198950508_UNL26_MD5_Italy-vs-France_live_landscape_thumb.jpg",
      date: "LIVE NOW — SONY LIV HD",
      watchUrl: "/asppv.pages.dev/watch/sliv/?id=1090553578_ENG"
    },
    {
      tournament: "UEFA NATIONS LEAGUE 2026-27",
      homeTeam: { name: "England", logo: "" },
      awayTeam: { name: "Croatia", logo: "" },
      poster: "https://origin-staticv2.sonyliv.com/videoasset_images/manage_file/1000027677/1793257674840871_UNL26_MD5_England-vs-Croatia_live_landscape_thumb.jpg",
      date: "LIVE NOW — SONY LIV HD",
      watchUrl: "/asppv.pages.dev/watch/sliv/?id=1090553579_ENG"
    },
    {
      tournament: "UEFA NATIONS LEAGUE 2026-27",
      homeTeam: { name: "Czechia", logo: "" },
      awayTeam: { name: "Spain", logo: "" },
      poster: "https://origin-staticv2.sonyliv.com/videoasset_images/manage_file/1000027664/1793254891164508_UNL26_MD5_Czechia-vs-Spain_live_landscape_thumb.jpg",
      date: "LIVE NOW — SONY LIV HD",
      watchUrl: "/asppv.pages.dev/watch/sliv/?id=1090553573_ENG"
    },
    {
      tournament: "AFRICA CUP OF NATIONS QUAL.",
      homeTeam: { name: "Benin", logo: "https://img.sofascore.com/api/v1/team/4744/image" },
      awayTeam: { name: "Central African Republic", logo: "https://img.sofascore.com/api/v1/team/23470/image" },
      poster: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1920&auto=format&fit=crop",
      date: "LIVE NOW 24×7",
      watchUrl: "/asppv.pages.dev/watch/football/?id=14876"
    },
    {
      tournament: "ONE DAY INTERNATIONAL",
      homeTeam: { name: "New Zealand", logo: "https://img.sofascore.com/api/v1/team/187755/image" },
      awayTeam: { name: "India", logo: "https://img.sofascore.com/api/v1/team/187765/image" },
      poster: "https://imgh.in/host/l3k0qd",
      date: "2026-11-13 07:30 IST",
      watchUrl: "/asppv.pages.dev/watch/cricket/?id=14888"
    },
    {
      tournament: "ONE DAY INTERNATIONAL",
      homeTeam: { name: "Australia", logo: "https://img.sofascore.com/api/v1/team/187746/image" },
      awayTeam: { name: "England", logo: "https://img.sofascore.com/api/v1/team/187757/image" },
      poster: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1920&auto=format&fit=crop",
      date: "2026-11-13 09:00 IST",
      watchUrl: "/asppv.pages.dev/watch/cricket/?id=14822"
    }
  ]
};

window.CNPTV_CONFIG = CNPTV_CONF;
window.MATCHDEKHO_CONFIG = CNPTV_CONF;

window.CnpTVHelper = (function () {
  function buildUrl(sectionCfg, eventId) {
    var cfg = window.CNPTV_CONFIG || window.MATCHDEKHO_CONFIG || {};
    var siteBase = String(cfg.siteBase || "").replace(/\/+$/, "");
    var base = String(sectionCfg && sectionCfg.link || "");
    if (!base) return "";
    var resolved = (base.indexOf("://") === -1 && siteBase) ? siteBase + base : base;
    if (!eventId) return resolved;
    var mode = String(sectionCfg.idMode || "param");
    var key = String(sectionCfg.idKey || "id");
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