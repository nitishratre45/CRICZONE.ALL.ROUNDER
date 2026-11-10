// CricZone HLS proxy — restricted to explicitly approved streaming/feed hosts.
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Accept, Origin, Content-Type, If-Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  "Cache-Control": "no-store"
};

function responseError(message, status = 400, detail) {
  return new Response(JSON.stringify({
    ok: false,
    error: message,
    ...(detail ? { detail } : {})
  }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" }
  });
}

function isAllowed(value) {
  let parsed;
  try {
    parsed = value instanceof URL ? value : new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  const exactPath = host + parsed.pathname;
  if (EXACT_FEEDS.has(exactPath)) return true;

  return [...ALLOWED_HOST_SUFFIXES].some((suffix) =>
    host === suffix || host.endsWith("." + suffix)
  );
}

function makeProxyUrl(target, proxyEndpoint) {
  return proxyEndpoint + "?u=" + encodeURIComponent(target.href);
}

function isSonyHost(hostname) {
  return hostname === "sonyliv.com" || hostname.endsWith(".sonyliv.com");
}

async function fetchUpstream(initialUrl, request) {
  let target = initialUrl;

  for (let hop = 0; hop < 6; hop++) {
    // Validate every redirect destination; never turn this into an open proxy.
    if (!isAllowed(target)) {
      throw new Error("Redirect target is not on the approved proxy host list: " + target.hostname);
    }

    const headers = new Headers();
    for (const name of ["Accept", "Accept-Language", "User-Agent", "Range", "If-Range"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    if (!headers.has("Accept")) headers.set("Accept", "*/*");
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    }

    // Sony endpoints commonly require Sony's web origin; other hosts get their own origin.
    if (isSonyHost(target.hostname)) {
      headers.set("Referer", "https://www.sonyliv.com/");
      headers.set("Origin", "https://www.sonyliv.com");
    } else {
      headers.set("Referer", target.origin + "/");
      headers.set("Origin", target.origin);
    }

    const upstream = await fetch(target.href, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      redirect: "manual"
    });

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get("Location");
      if (!location) return { response: upstream, finalUrl: target };
      target = new URL(location, target);
      continue;
    }

    return { response: upstream, finalUrl: target };
  }

  throw new Error("Too many upstream redirects");
}

function rewritePlaylist(playlistText, finalPlaylistUrl, proxyEndpoint) {
  const base = new URL(finalPlaylistUrl);

  return playlistText.split(/\r?\n/).map((originalLine) => {
    const line = originalLine.trim();
    if (!line) return originalLine;

    // Rewrite key, map, media and other HLS tag URI attributes.
    if (line.startsWith("#")) {
      return originalLine.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
          const absolute = new URL(uri, base);
          return isAllowed(absolute)
            ? 'URI="' + makeProxyUrl(absolute, proxyEndpoint) + '"'
            : match;
        } catch {
          return match;
        }
      });
    }

    // Rewrite variant playlists and media segment URLs (relative or absolute).
    try {
      const absolute = new URL(line, base);
      return isAllowed(absolute) ? makeProxyUrl(absolute, proxyEndpoint) : originalLine;
    } catch {
      return originalLine;
    }
  }).join("\n");
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return responseError("Method not allowed", 405);
  }

  const requestUrl = new URL(request.url);
  // Accept both parameter names for compatibility; generated playlist links use ?u=.
  const rawTarget = requestUrl.searchParams.get("u") || requestUrl.searchParams.get("url");
  if (!rawTarget) return responseError("Missing target URL parameter 'u'", 400);

  let target;
  try {
    target = new URL(rawTarget);
  } catch {
    return responseError("Invalid target URL", 400);
  }

  if (!isAllowed(target)) {
    return responseError("Target host is not approved for the CricZone proxy", 403, target.hostname);
  }

  try {
    const { response: upstream, finalUrl } = await fetchUpstream(target, request);
    const contentType = upstream.headers.get("Content-Type") || "";
    const isPlaylist = /mpegurl|vnd\.apple\.mpegurl/i.test(contentType) || /\.m3u8?$/i.test(finalUrl.pathname);

    const headers = new Headers(CORS_HEADERS);
    for (const name of [
      "Content-Type",
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "ETag",
      "Last-Modified"
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    if (isPlaylist && upstream.ok && request.method !== "HEAD") {
      const playlistText = await upstream.text();
      const proxyEndpoint = requestUrl.origin + requestUrl.pathname;
      const rewritten = rewritePlaylist(playlistText, finalUrl.href, proxyEndpoint);
      headers.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      headers.delete("Content-Length");
      headers.delete("Content-Range");

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
    return responseError(
      "CricZone proxy fetch failed",
      502,
      String(error?.message || error)
    );
  }
}
