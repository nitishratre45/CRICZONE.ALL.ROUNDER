// Same-origin JSON proxy for the public SonyLiv events feed.
export async function onRequestGet() {
  const source = "https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json";
  try {
    const upstream = await fetch(source, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 30, cacheEverything: true }
    });
    if (!upstream.ok) {
      return Response.json({ error: "SonyLiv feed unavailable", upstreamStatus: upstream.status }, { status: 502 });
    }
    const payload = await upstream.json();
    const matches = Array.isArray(payload) ? payload : Array.isArray(payload.matches) ? payload.matches : null;
    if (!matches) {
      return Response.json({ error: "Unexpected SonyLiv feed format" }, { status: 502 });
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
    return Response.json({ error: "Could not retrieve SonyLiv feed" }, { status: 502 });
  }
}