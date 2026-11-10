// Same-origin resilient proxy for the public SonyLiv events feed.
export async function onRequestGet() {
  const sources = [
    {
      url: "https://api.github.com/repos/drmlive/sliv-live-events/contents/sonyliv.json",
      headers: { Accept: "application/vnd.github.raw+json", "User-Agent": "CRICZONE-Pages" }
    },
    {
      url: "https://cdn.jsdelivr.net/gh/drmlive/sliv-live-events@main/sonyliv.json",
      headers: { Accept: "application/json" }
    },
    {
      url: "https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json",
      headers: { Accept: "application/json" }
    }
  ];
  const failures = [];
  for (const source of sources) {
    try {
      const upstream = await fetch(source.url, {
        method: "GET",
        headers: source.headers,
        redirect: "follow"
      });
      if (!upstream.ok) {
        failures.push(upstream.status);
        continue;
      }
      const payload = await upstream.json();
      const matches = Array.isArray(payload) ? payload : Array.isArray(payload.matches) ? payload.matches : null;
      if (!matches) {
        failures.push("invalid-json-shape");
        continue;
      }
      return Response.json({
        "last update time": payload["last update time"] || payload.last_updated || null,
        matches
      }, {
        headers: {
          "Cache-Control": "public, max-age=15, s-maxage=30",
          "X-Content-Type-Options": "nosniff"
        }
      });
    } catch (_) {
      failures.push("fetch-error");
    }
  }
  return Response.json({
    error: "All SonyLiv feed sources failed",
    attempts: failures
  }, { status: 502, headers: { "Cache-Control": "no-store" } });
}