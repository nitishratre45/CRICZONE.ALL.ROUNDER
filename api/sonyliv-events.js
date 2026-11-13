function recoverSonyLivPayload(text) {
  const marker = '"matches"', keyAt = text.indexOf(marker);
  if (keyAt < 0) throw new Error("matches array not found");
  const start = text.indexOf("[", keyAt + marker.length);
  if (start < 0) throw new Error("matches array is invalid");
  const matches = []; let depth = 0, inString = false, escaped = false, objectStart = -1;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') inString = false; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") { if (depth === 0) objectStart = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && objectStart >= 0) { try { matches.push(JSON.parse(text.slice(objectStart, i + 1))); } catch (_) {} objectStart = -1; } }
    else if (ch === "]" && depth === 0) break;
  }
  const timeMatch = text.match(/"last update time"\\s*:\\s*"([^"]*)"/);
  if (!matches.length) throw new Error("No complete event records in upstream JSON");
  return { "last update time": timeMatch ? timeMatch[1] : null, matches, recovered: true };
}
module.exports = async function handler(req, res) {
  const sources = [
    "https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json",
    "https://cdn.jsdelivr.net/gh/drmlive/sliv-live-events@main/sonyliv.json"
  ];
  const failures = [];
  for (const url of sources) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, redirect: "follow" });
      if (!response.ok) { failures.push("HTTP " + response.status); continue; }
      const text = await response.text();
      let payload; try { payload = JSON.parse(text); } catch (_) { payload = recoverSonyLivPayload(text); }
      const matches = Array.isArray(payload) ? payload : payload.matches;
      if (!Array.isArray(matches) || !matches.length) { failures.push("empty feed"); continue; }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).json({ "last update time": payload["last update time"] || null, matches, recovered: payload.recovered === true });
    } catch (e) { failures.push(String(e && e.message || "fetch failed")); }
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(502).json({ error: "SonyLiv feed unavailable", attempts: failures });
};