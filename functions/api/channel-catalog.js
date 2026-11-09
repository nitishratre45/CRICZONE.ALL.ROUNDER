// Cloudflare Pages Function: same-origin channel metadata endpoint.
// Only public catalogue fields are returned. DRM keys/key IDs are never forwarded.
export async function onRequestGet() {
  const source = "https://giotv-6op.pages.dev/jstr4web.json";
  try {
    const upstream = await fetch(source, {
      headers: { "Accept": "application/json", "User-Agent": "CRICZONE12-Catalogue/1.0" },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (!upstream.ok) {
      return Response.json({ error: "Upstream catalogue unavailable", status: upstream.status }, { status: 502 });
    }
    const rows = await upstream.json();
    if (!Array.isArray(rows)) {
      return Response.json({ error: "Unexpected catalogue format" }, { status: 502 });
    }
    const channels = rows.map((item, index) => ({
      id: String(item.id || "remote-" + (index + 1)),
      tvg_id: String(item.id || ""),
      name: String(item.name || "Unnamed channel"),
      category: String(item.category || "Others"),
      language: String(item.language || ""),
      logo: String(item.logo || ""),
      url: String(item.url || "")
    })).filter(item => item.name && item.url);
    return Response.json({
      source: "remote-catalogue",
      total: channels.length,
      channels
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return Response.json({ error: "Could not load remote catalogue" }, { status: 502 });
  }
}
