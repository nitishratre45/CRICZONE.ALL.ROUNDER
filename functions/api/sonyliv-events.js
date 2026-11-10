// SonyLiv feed proxy with recovery for an upstream JSON file that is sometimes truncated.
function recoverSonyLivPayload(text) {
  const marker = '"matches"';
  const keyAt = text.indexOf(marker);
  if (keyAt < 0) throw new Error("matches array not found");
  const arrayStart = text.indexOf("[", keyAt + marker.length);
  if (arrayStart < 0) throw new Error("matches array is invalid");

  const matches = [];
  let depth = 0, inString = false, escaped = false, objectStart = -1;
  for (let i = arrayStart + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objectStart >= 0) {
        try { matches.push(JSON.parse(text.slice(objectStart, i + 1))); } catch (_) {}
        objectStart = -1;
      }
    } else if (ch === "]" && depth === 0) {
      break;
    }
  }
  const timeMatch = text.match(/"last update time"\s*:\s*"([^"]*)"/);
  if (!matches.length) throw new Error("No complete event records in upstream JSON");
  return { "last update time": timeMatch ? timeMatch[1] : null, matches, recovered: true };
}

export async function onRequestGet() {
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
      let payload;
      try { payload = JSON.parse(text); }
      catch (_) { payload = recoverSonyLivPayload(text); }
      const matches = Array.isArray(payload) ? payload : payload.matches;
      if (!Array.isArray(matches) || !matches.length) { failures.push("empty feed"); continue; }
      return Response.json({
        "last update time": payload["last update time"] || null,
        matches,
        recovered: payload.recovered === true
      }, { headers: { "Cache-Control": "public, max-age=15, s-maxage=30", "X-Content-Type-Options": "nosniff" } });
    } catch (error) {
      failures.push(String(error && error.message || "fetch failed"));
    }
  }
  return Response.json({ error: "SonyLiv feed unavailable", attempts: failures }, { status: 502, headers: { "Cache-Control": "no-store" } });
}