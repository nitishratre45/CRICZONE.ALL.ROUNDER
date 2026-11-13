module.exports = async function handler(req, res) {
  const source = "https://giotv-6op.pages.dev/jstr4web.json";
  try {
    const upstream = await fetch(source, { headers: { Accept: "application/json", "User-Agent": "CRICZONE12-Catalogue/1.0" }, redirect: "follow" });
    if (!upstream.ok) return res.status(502).json({ error: "Upstream catalogue unavailable", status: upstream.status });
    const rows = await upstream.json();
    if (!Array.isArray(rows)) return res.status(502).json({ error: "Unexpected catalogue format" });
    const channels = rows.map((item, index) => ({
      id: String(item.id || "remote-" + (index + 1)),
      tvg_id: String(item.id || ""),
      name: String(item.name || "Unnamed channel"),
      category: String(item.category || "Others"),
      language: String(item.language || ""),
      logo: String(item.logo || ""),
      url: String(item.url || "")
    })).filter(item => item.name && item.url);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).json({ source: "remote-catalogue", total: channels.length, channels });
  } catch (_) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "Could not load remote catalogue" });
  }
};