// Same-origin backend proxy for the existing stream proxy provider.
// Set CRICZONE_STREAM_PROXY_URL in Cloudflare Pages Variables to:
// https://sportlink-10.lovable.app/api/public/proxy
export async function onRequestGet(context) {
  const base = String(context.env.CRICZONE_STREAM_PROXY_URL || "").trim();
  if (!base) {
    return Response.json({ error: "Stream proxy is not configured in Cloudflare Pages Variables" }, { status: 503 });
  }

  const incoming = new URL(context.request.url);
  const target = incoming.searchParams.get("url");
  if (!target) return Response.json({ error: "Missing url parameter" }, { status: 400 });

  let parsed;
  try { parsed = new URL(target); } catch {
    return Response.json({ error: "Invalid stream URL" }, { status: 400 });
  }
  if (parsed.protocol !== "https:") {
    return Response.json({ error: "Only HTTPS stream URLs are allowed" }, { status: 400 });
  }

  const proxy = new URL(base);
  proxy.searchParams.set("url", target);

  const headers = new Headers();
  for (const name of ["range", "accept", "user-agent"]) {
    const value = context.request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(proxy.toString(), {
      method: "GET",
      headers,
      redirect: "follow"
    });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("Access-Control-Allow-Origin", new URL(context.request.url).origin);
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch {
    return Response.json({ error: "Stream proxy request failed" }, { status: 502 });
  }
}
