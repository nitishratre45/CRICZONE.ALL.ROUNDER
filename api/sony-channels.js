module.exports = async function handler(req, res) {
  const sources = [
    "https://sonujson-v5.pages.dev/loura.json",
    "https://sportlink-tv10.pages.dev/id.json",
    "https://sportlink-tv10.pages.dev/Data.json"
  ];
  const results = await Promise.allSettled(sources.map(async (url) => {
    const response = await fetch(url, { headers: { Accept: "application/json,text/plain;q=0.9,*/*;q=0.8" }, redirect: "follow" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return JSON.parse(await response.text());
  }));
  const feeds = results.filter(x => x.status === "fulfilled").map(x => x.value);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!feeds.length) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "Sony channel JSON feeds unavailable", attempts: results.map((x,i) => ({ source: sources[i], error: x.status === "rejected" ? String(x.reason?.message || x.reason) : null })) });
  }
  res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30");
  return res.status(200).json({ feeds });
};