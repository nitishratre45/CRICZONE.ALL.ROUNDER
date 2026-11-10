export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("u");

  if (!targetUrl) {
    return new Response("Missing target URL parameter 'u'", { status: 400 });
  }

  try {
    const clientUserAgent = request.headers.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    const modifiedRequest = new Request(targetUrl, {
      headers: {
        "User-Agent": clientUserAgent,
        "Referer": "https://www.sonyliv.com/",
        "Origin": "https://www.sonyliv.com/",
        "Accept": "*/*"
      },
      method: request.method,
      redirect: "follow"
    });

    const response = await fetch(modifiedRequest);
    const contentType = response.headers.get("content-type") || "";

    // Intercept and rewrite HLS playlists (.m3u8)
    if (contentType.includes("mpegurl")  contentType.includes("vnd.apple.mpegurl")  targetUrl.includes(".m3u8")) {
      let m3u8Text = await response.text();
      const targetObj = new URL(targetUrl);
      const baseUrl = targetObj.origin + targetObj.pathname.substring(0, targetObj.pathname.lastIndexOf('/') + 1);
      const proxyDomain = url.origin + url.pathname;

      const lines = m3u8Text.split('\n');
      const rewrittenLines = lines.map(line => {
        let trimmed = line.trim();
        if (!trimmed) return line;

        // Handle tags containing URI attributes (like #EXT-X-KEY encryption keys, #EXT-X-MAP, etc.)
        if (trimmed.startsWith('#')) {
          if (trimmed.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/, (match, uri) => {
              let absoluteUri = uri;
              if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
                absoluteUri = new URL(uri, baseUrl).toString();
              }
              return URI="${proxyDomain}?u=${encodeURIComponent(absoluteUri)}";
            });
          }
          return line;
        }

        // Handle regular segment lines or variant stream playlist links
        let absoluteSegmentUrl = trimmed;
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          absoluteSegmentUrl = new URL(trimmed, baseUrl).toString();
        }
        return ${proxyDomain}?u=${encodeURIComponent(absoluteSegmentUrl)};
      });

      const newBody = rewrittenLines.join('\n');
      const newResponse = new Response(newBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST");
      newResponse.headers.set("Access-Control-Allow-Headers", "*");
      newResponse.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      return newResponse;
    }

    // Pass through actual video chunks (.ts, .m4s, .mp4) smoothly
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });

    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST");
    newResponse.headers.set("Access-Control-Allow-Headers", "*");
    newResponse.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return newResponse;
  } catch (err) {
    return new Response("Proxy fetch error: " + err.message, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
      "Access-Control-Allow-Headers": "*"
    }
  });
}
