// CRICZONE authorized, single-origin HLS proxy for Vercel.
// Only the owner's declared upstream host is accepted. DRM/license requests are blocked.
const UPSTREAM_HOST = "sportlink-jtv.pages.dev";
const ALLOWED_ORIGINS = new Set([
  "https://criczonelive.vercel.app",
  "https://criczone-black.vercel.app",
  "https://criczoneall.vercel.app",
  "https://criczone.pages.dev"
]);
const SEGMENT_EXT = /\.(?:m3u8?|ts|m4s|mp4|aac|mp3|vtt|webvtt|jpg|jpeg|png|key)$/i;

function parseTarget(raw) {
  if (!raw || typeof raw !== "string" || raw.length > 4096) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== UPSTREAM_HOST ||
      u.username || u.password || u.port) return null;
  if (/license|widevine|playready|fairplay|drm/i.test(u.pathname + u.search)) return null;
  return u;
}

function proxyUrl(target, requestUrl) {
  const out = new URL(requestUrl);
  out.search = "";
  out.searchParams.set("u", target.href);
  return out.href;
}

module.exports = async function handler(req, res) {
  const origin = String(req.headers.origin || "");
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Accept, Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  }
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({error:"Forbidden origin"});
    return res.status(204).end();
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    return res.status(405).json({error:"Method not allowed"});
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({error:"Forbidden origin"});
  const raw = Array.isArray(req.query?.u) ? req.query.u[0] : req.query?.u;
  const target = parseTarget(raw);
  if (!target) return res.status(400).json({error:"Invalid or unsupported upstream URL"});
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Referer": target.origin + "/",
      "Origin": target.origin
    };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(target.href, {
      method: req.method,
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    const finalUrl = new URL(upstream.url || target.href);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname.toLowerCase() !== UPSTREAM_HOST ||
        finalUrl.username || finalUrl.password || finalUrl.port) {
      return res.status(502).json({error:"Upstream redirected outside the authorized host"});
    }
    if (!upstream.ok) return res.status(upstream.status).json({error:"Upstream request failed"});
    const type = upstream.headers.get("content-type") || "application/octet-stream";
    const isPlaylist = /mpegurl/i.test(type) || /\.m3u8?$/i.test(target.pathname);
    if (isPlaylist) {
      let body = await upstream.text();
      // Reject encrypted/DRM playlists rather than forwarding key/license requests.
      if (/#EXT-X-(?:KEY|SESSION-KEY)\s*:/i.test(body)) {
        return res.status(415).json({error:"Encrypted/DRM playlists are not supported"});
      }
      const base = finalUrl;
      const rewrite = (value) => {
        const trimmed = value.trim();
        if (!trimmed || trimmed.startsWith("#")) return value;
        let child;
        try { child = new URL(trimmed, base); } catch { return value; }
        if (child.protocol !== "https:" || child.hostname.toLowerCase() !== UPSTREAM_HOST ||
            /license|widevine|playready|fairplay|drm/i.test(child.pathname + child.search)) return "";
        return proxyUrl(child, req.url);
      };
      body = body.split(/\r?\n/).map(line => {
        if (!line.trim()) return line;
        if (line.trim().startsWith("#")) {
          // URI attributes are rewritten only for same-host, non-DRM references.
          return line.replace(/URI="([^"]+)"/g, (match, value) => {
            const next = rewrite(value);
            return next ? 'URI="' + next.replace(/&/g, "&amp;") + '"' : "";
          });
        }
        return rewrite(line);
      }).join("\n");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(body);
    }
    if (!SEGMENT_EXT.test(finalUrl.pathname)) return res.status(415).json({error:"Unsupported media resource"});
    res.setHeader("Content-Type", type);
    res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    const length = upstream.headers.get("content-length");
    const range = upstream.headers.get("content-range");
    if (length) res.setHeader("Content-Length", length);
    if (range) res.setHeader("Content-Range", range);
    if (req.method === "HEAD") return res.status(upstream.status).end();
    const data = Buffer.from(await upstream.arrayBuffer());
    return res.status(upstream.status).send(data);
  } catch (error) {
    console.error("CRICZONE proxy error:", error?.message || error);
    return res.status(502).json({error:"Upstream unavailable"});
  }
};
