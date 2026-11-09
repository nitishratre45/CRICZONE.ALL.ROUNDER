const ALLOWED_HOST_SUFFIXES = new Set(["allinonereborn2.online", "fallinoreborn2.online"]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Accept, Origin, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  "Cache-Control": "no-store"
};

function json(data, status = 400) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" }
  });
}

function isAllowed(url) {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  // Exact, read-only JSON feeds used by the Sony channel directory.
  const sonyJsonFeed =
    (host === "sonujson-v5.pages.dev" && path === "/loura.json") ||
    (host === "sportlink-tv10.pages.dev" && (path === "/id.json" || path === "/Data.json"));
  if (sonyJsonFeed) return true;

  // Existing restricted stream proxy remains limited to approved hosts/paths.
  return [...ALLOWED_HOST_SUFFIXES].some((suffix) => host === suffix || host.endsWith("." + suffix))
    && path.startsWith("/sony-new/");
}

function proxyHref(target) {
  return "/api/proxy?u=" + encodeURIComponent(target.href);
}

async function fetchUpstream(initialUrl, request) {
  let target = initialUrl;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowed(target)) throw new Error("Upstream host or path is not allowed");
    const headers = new Headers();
    const range = request.headers.get("Range");
    if (range) headers.set("Range", range);
    headers.set("Accept", request.headers.get("Accept") || "*/*");
    headers.set("User-Agent", "Mozilla/5.0 (compatible; CRICZONE-Stream-Proxy/1.0)");
    headers.set("Referer", target.origin + "/");
    const response = await fetch(target.href, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      redirect: "manual"
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      if (!location) return response;
      target = new URL(location, target);
      continue;
    }
    return response;
  }
  throw new Error("Too many upstream redirects");
}

function rewritePlaylist(text, baseUrl) {
  const base = new URL(baseUrl);
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
          const absolute = new URL(uri, base);
          return 'URI="' + (isAllowed(absolute) ? proxyHref(absolute) : uri) + '"';
        } catch (_) { return match; }
      });
    }
    try {
      const absolute = new URL(trimmed, base);
      return isAllowed(absolute) ? proxyHref(absolute) : line;
    } catch (_) { return line; }
  }).join("\n");
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const requestUrl = new URL(request.url);
  const raw = requestUrl.searchParams.get("u");
  if (!raw) return json({ ok: false, error: "Missing u parameter" }, 400);

  let target;
  try { target = new URL(raw); }
  catch (_) { return json({ ok: false, error: "Invalid upstream URL" }, 400); }
  if (!isAllowed(target)) {
    return json({ ok: false, error: "Upstream host/path is not allowed" }, 403);
  }

  try {
    const upstream = await fetchUpstream(target, request);
    const contentType = upstream.headers.get("Content-Type") || "";
    const looksLikePlaylist = /\.m3u8?(?:$|\?)/i.test(target.pathname)
      || /mpegurl|vnd\.apple\.mpegurl/i.test(contentType);

    const headers = new Headers(CORS);
    for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (looksLikePlaylist && upstream.ok && request.method !== "HEAD") {
      const playlist = await upstream.text();
      const rewritten = rewritePlaylist(playlist, target.href);
      headers.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      headers.delete("Content-Length");
      return new Response(rewritten, { status: upstream.status, headers });
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 502);
  }
}
