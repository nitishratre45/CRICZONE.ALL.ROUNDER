// CricZone Cloudflare Pages HLS proxy.
// Uses the existing ?u= parameter and rewrites HLS playlist, key and segment URLs.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Accept, Origin, Content-Type, If-Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  "Cache-Control": "no-store"
};

function proxyError(message, status = 400) {
  return new Response(message, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" }
  });
}

function proxiedUrl(target, endpoint) {
  return endpoint + "?u=" + encodeURIComponent(target);
}

function rewriteHlsPlaylist(body, playlistUrl, proxyEndpoint) {
  const baseUrl = new URL(playlistUrl);

  return body.split(/\r?\n/).map((originalLine) => {
    const line = originalLine.trim();
    if (!line) return originalLine;

    // Rewrite URI attributes used by encryption keys, init maps and alternate renditions.
    if (line.startsWith("#")) {
      return originalLine.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
          const absoluteUri = new URL(uri, baseUrl).toString();
          return 'URI="' + proxiedUrl(absoluteUri, proxyEndpoint) + '"';
        } catch {
          return match;
        }
      });
    }

    // Rewrite variant playlists and media segments, including relative URLs.
    try {
      const absoluteUrl = new URL(line, baseUrl).toString();
      return proxiedUrl(absoluteUrl, proxyEndpoint);
    } catch {
      return originalLine;
    }
  }).join("\n");
}

 
function rewriteDashManifest(body, manifestUrl, proxyEndpoint) {
  // Rewrite concrete DASH resource URLs (SegmentURL, Initialization, Location and
  // non-template BaseURL references) through this same-origin proxy. Template
  // placeholders such as $Number$ are preserved for the DASH player.
  const rewrite = (value) => {
    if (!value || /^data:/i.test(value) || value.startsWith("#")) return value;
    try {
      const absolute = new URL(value, manifestUrl).toString();
      return proxiedUrl(absolute, proxyEndpoint).replace(/%24/gi, "$");
    } catch {
      return value;
    }
  };

  let output = body.replace(/<(BaseURL|Location)(\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>/gi,
    (whole, tag, attrs = "", rawValue) => {
      const value = rawValue.trim();
      if (!value || value.includes("$")) return whole;
      return "<" + tag + (attrs || "") + ">" + rewrite(value) + "</" + tag + ">";
    });

  output = output.replace(/\\b(media|initialization|sourceURL|index|href)="([^"]+)"/gi,
    (whole, attribute, value) => attribute + '="' + rewrite(value) + '"');

  return output;
}

export async function onRequest(context) {
  const request = context.request;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return proxyError("Method not allowed", 405);
  }

  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get("u") || requestUrl.searchParams.get("url");

  if (!targetUrl) {
    return proxyError("Missing target URL parameter 'u'", 400);
  }

  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    return proxyError("Invalid target URL", 400);
  }

  // Require HTTPS to prevent proxying insecure or non-web schemes.
  if (target.protocol !== "https:" || target.username || target.password) {
    return proxyError("Only valid HTTPS stream URLs are supported", 400);
  }

  try {
    const incomingHeaders = request.headers;
    const upstreamHeaders = new Headers();
    upstreamHeaders.set("Accept", incomingHeaders.get("Accept") || "*/*");
    upstreamHeaders.set(
      "User-Agent",
      incomingHeaders.get("User-Agent") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    );

    const range = incomingHeaders.get("Range");
    if (range) upstreamHeaders.set("Range", range);
    const ifRange = incomingHeaders.get("If-Range");
    if (ifRange) upstreamHeaders.set("If-Range", ifRange);

    const isSony = target.hostname === "sonyliv.com" || target.hostname.endsWith(".sonyliv.com") || target.hostname === "sonyeventsglobal.akamaized.net" || target.hostname.endsWith(".sonyeventsglobal.akamaized.net");
    upstreamHeaders.set(
      "Referer",
      isSony ? "https://www.sonyliv.com/" : target.origin + "/"
    );
    upstreamHeaders.set(
      "Origin",
      isSony ? "https://www.sonyliv.com" : target.origin
    );

    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "follow"
    });

    const finalUrl = upstream.url || target.toString();
    const contentType = upstream.headers.get("content-type") || "";
    const isPlaylist =
      /mpegurl|vnd\.apple\.mpegurl/i.test(contentType) ||
      /\.m3u8?($|[?#])/i.test(finalUrl);

    const responseHeaders = new Headers(CORS_HEADERS);
    for (const name of [
      "Content-Type",
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "ETag",
      "Last-Modified"
    ]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    const isDash = /dash\\+xml|application\\/xml|text\\/xml/i.test(contentType) || /\\.mpd($|[?#])/i.test(finalUrl);
    if ((isPlaylist || isDash) && upstream.ok && request.method !== "HEAD") {
      const manifestText = await upstream.text();
      const proxyEndpoint = requestUrl.origin + requestUrl.pathname;
      const rewritten = isPlaylist
        ? rewriteHlsPlaylist(manifestText, finalUrl, proxyEndpoint)
        : rewriteDashManifest(manifestText, finalUrl, proxyEndpoint);

      responseHeaders.set(
        "Content-Type",
        isPlaylist ? "application/vnd.apple.mpegurl; charset=utf-8" : "application/dash+xml; charset=utf-8"
      );
      responseHeaders.delete("Content-Length");
      responseHeaders.delete("Content-Range");

      return new Response(rewritten, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders
      });
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return proxyError("Proxy fetch error: " + String(error?.message || error), 502);
  }
}
