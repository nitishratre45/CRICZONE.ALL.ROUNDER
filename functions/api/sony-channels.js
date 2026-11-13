// Server-side Sony channel JSON aggregator. Keeps upstream JSON off the browser/CORS path.
const SOURCES = [
  "https://sonujson-v5.pages.dev/loura.json",
  "https://sportlink-tv10.pages.dev/id.json",
  "https://sportlink-tv10.pages.dev/Data.json"
];

export async function onRequestGet() {
  const results = await Promise.allSettled(SOURCES.map(async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json,text/plain;q=0.9,*/*;q=0.8" },
      cf: { cacheTtl: 30, cacheEverything: true }
    });
    if (!response.ok) throw new Error("Upstream HTTP " + response.status);
    const text = await response.text();
    try { return JSON.parse(text); }
    catch (_) { throw new Error("Upstream returned invalid JSON"); }
  }));

  const feeds = results.filter(x => x.status === "fulfilled").map(x => x.value);
  if (!feeds.length) {
    return Response.json({
      error: "Sony channel JSON feeds unavailable",
      attempts: results.map((x, i) => ({
        source: SOURCES[i],
        error: x.status === "rejected" ? String(x.reason?.message || x.reason) : null
      }))
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ feeds }, {
    headers: {
      "Cache-Control": "public, max-age=15, s-maxage=30",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
