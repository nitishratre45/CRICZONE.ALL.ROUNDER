const ALLOWED_HOST_SUFFIXES = new Set([
  "allinonereborn2.online",
  "fallinoreborn2.online",
  "sonyliv.com"
]);

const EXACT_FEEDS = new Set([
  "sonujson-v5.pages.dev/loura.json",
  "sportlink-tv10.pages.dev/id.json",
  "sportlink-tv10.pages.dev/Data.json",
  "sportlink-jtv.pages.dev/sony3.m3u"
]);

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

function isAllowed(value) {
  let url;
  try { url = value instanceof URL ? value : new URL(value); }
  catch (_) { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  const hostPath = host + url.pathname;
  if (EXACT_FEEDS.has(hostPath)) return true;

  return [...ALLOWED_HOST_SUFFIXES].some((suffix) =>
    host === suffix || host.endsWith("." + suffix)
  );
}

function proxyHref(target, proxyBase) {
  return proxyBase + "?u=" + encodeURIComponent(target.href);
}

async function fetchUpstream(initialUrl, request) {
  let target = initialUrl;

  for (let hop = 0; hop < 6; hop++) {
    if (!isAllowed(target)) throw new Error("Redirect target is not on the approved proxy host list");

    const headers = new Headers();
    headers.set("Accept", request.headers.get("Accept") || "*/*");
    headers.set("User-Agent", request.headers.get("User-Agent") ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    headers.set("Referer", target.hostname === "sonyliv.com" || target.hostname.endsWith(".sonyliv.com")
      ? "https://www.sonyliv.com/"
      : target.origin + "/");
    if (target.hostname === "sonyliv.com" || target.hostname.endsWith(".sonyliv.com")) {
      headers.set("Origin", "https://www.sonyliv.com");
    }

    const range = request.headers.get("Range");
    if (range) headers.set("Range", range);

    const response = await fetch(target.href, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      redirect: "manual"
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      if (!location) return { response, finalUrl: target };
      target = new URL(location, target);
      continue;
    }

    return { response, finalUrl: target };
  }

  throw new Error("Too many upstream redirects");
}

function rewritePlaylist(text, baseUrl, proxyBase) {
  const base = new URL(baseUrl);

  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
          const absolute = new URL(uri, base);
          return isAllowed(absolute)
            ? 'URI="' + proxyHref(absolute, proxyBase) + '"'
            : match;
        } catch (_) {
          return match;
        }
      });
    }

    try {
      const absolute = new URL(trimmed, base);
      return isAllowed(absolute) ? proxyHref(absolute, proxyBase) : line;
    } catch (_) {
      return line;
    }
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
  const rawTarget = requestUrl.searchParams.get("u");
  if (!rawTarget) return json({ ok: false, error: "Missing target URL parameter 'u'" }, 400);

  let target;
  try { target = new URL(rawTarget); }
  catch (_) { return json({ ok: false, error: "Invalid target URL" }, 400); }

  if (!isAllowed(target)) {
    return json({ ok: false, error: "Target host is not approved for the CricZone proxy" }, 403);
  }

  try {
    const { response: upstream, finalUrl } = await fetchUpstream(target, request);
    const contentType = upstream.headers.get("content-type") || "";
    const isPlaylist = /mpegurl|vnd\.apple\\.mpegurl/i.test(contentType) ||
      /\.m3u8?$/i.test(finalUrl.pathname);

    const headers = new Headers(CORS);
    for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    if (isPlaylist && upstream.ok && request.method !== "HEAD") {
      const playlistText = await upstream.text();
      const rewritten = rewritePlaylist(playlistText, finalUrl.href, requestUrl.origin + requestUrl.pathname);
      headers.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      headers.delete("Content-Length");
      return new Response(rewritten, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      });
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  } catch (error) {
    return json({ ok: false, error: "CricZone proxy fetch failed", detail: String(error?.message || error) }, 502);
  }
}
