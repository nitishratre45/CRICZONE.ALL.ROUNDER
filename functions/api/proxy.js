// CRICZONE Cloudflare Pages stream proxy.
// Security: HTTPS-only host allowlist, redirect validation, bounded requests and rate limiting.
// Optional Cloudflare binding: PROXY_RATE_LIMIT (KV namespace). A Durable Object is preferred
// for strict atomic rate limiting; KV mode is best-effort because KV writes are eventually consistent.

const BASE_ALLOWED_HOSTS = [
  "sportlink-jtv.pages.dev",
  "raw.githubusercontent.com",
  "sonyliv.com",
  "sonyeventsglobal.akamaized.net",
  "slivcdn.com",
  "dishmt.slivcdn.com"
];

const MAX_URL_LENGTH = 8192;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 12000;
const RATE_WINDOW_SECONDS = 60;
const RATE_LIMIT = 90;
const memoryRate = new Map();

export function allowedHosts(env) {
  const configured = String(env?.PROXY_ALLOWED_HOSTS || "")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return new Set([...BASE_ALLOWED_HOSTS, ...configured]);
}

function hostAllowed(hostname, allowlist) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Match exact hosts or subdomains of explicitly trusted roots; never allow broad shared suffixes such as pages.dev.
  return allowlist.has(host) || [...allowlist].some((root) => host.endsWith("." + root));
}

function isPrivateIpLiteral(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "::" || host === "::1" || host.startsWith("fc") ||
      host.startsWith("fd") || host.startsWith("fe80:") || host.startsWith("::ffff:")) return true;
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return false;
  const [a,b] = parts.map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export function validateTarget(raw, allowlist) {
  if (typeof raw !== "string" || raw.length > MAX_URL_LENGTH) throw new Error("Invalid or oversized target URL");
  let url;
  try { url = new URL(raw); } catch { throw new Error("Invalid target URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") {
    throw new Error("Only standard-port HTTPS URLs are supported");
  }
  if (isPrivateIpLiteral(url.hostname) || !hostAllowed(url.hostname, allowlist)) {
    throw new Error("Target hostname is not allowlisted");
  }
  url.hash = "";
  return url;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const origins = String(env?.PROXY_ALLOWED_ORIGINS || "https://criczone.pages.dev,https://criczone.online,https://www.criczone.online")
    .split(",").map((x) => x.trim()).filter(Boolean);
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Accept, Origin, Content-Type, If-Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
    "X-Content-Type-Options": "nosniff"
  });
  if (!origin || origins.includes(origin)) headers.set("Access-Control-Allow-Origin", origin || "*");
  return headers;
}

function proxyError(message, status, headers) {
  const out = new Headers(headers);
  out.set("Content-Type", "text/plain; charset=utf-8");
  out.set("Cache-Control", "no-store");
  return new Response(message, { status, headers: out });
}

function proxiedUrl(target, endpoint) {
  return endpoint + "?u=" + encodeURIComponent(target);
}

export function rewriteHlsPlaylist(body, playlistUrl, proxyEndpoint) {
  const baseUrl = new URL(playlistUrl);
  return body.split(/\r?\n/).map((originalLine) => {
    const line = originalLine.trim();
    if (!line) return originalLine;
    if (line.startsWith("#")) {
      return originalLine.replace(/URI="([^"]+)"/g, (match, uri) => {
        try { return 'URI="' + proxiedUrl(new URL(uri, baseUrl).toString(), proxyEndpoint) + '"'; }
        catch { return match; }
      });
    }
    try { return proxiedUrl(new URL(line, baseUrl).toString(), proxyEndpoint); }
    catch { return originalLine; }
  }).join("\n");
}

export function rewriteDashManifest(body, manifestUrl, proxyEndpoint) {
  const rewrite = (value) => {
    if (!value || /^data:/i.test(value) || value.startsWith("#")) return value;
    try { return proxiedUrl(new URL(value, manifestUrl).toString(), proxyEndpoint).replace(/%24/gi, "$"); }
    catch { return value; }
  };
  let output = body.replace(/<(BaseURL|Location)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
    (whole, tag, attrs = "", rawValue) => {
      const value = rawValue.trim();
      return value ? "<" + tag + (attrs || "") + ">" + rewrite(value) + "</" + tag + ">" : whole;
    });
  return output.replace(/\b(media|initialization|sourceURL|index|href)="([^"]+)"/gi,
    (whole, attribute, value) => attribute + '="' + rewrite(value) + '"');
}

async function readTextLimited(response, maxBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("Manifest size limit exceeded");
        throw new Error("Manifest exceeds size limit");
      }
      output += decoder.decode(value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    reader.releaseLock();
  }
}

async function checkRateLimit(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("True-Client-IP") || "unknown";
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / RATE_WINDOW_SECONDS);
  const key = "proxy-rate:" + ip + ":" + bucket;
  if (env?.PROXY_RATE_LIMIT && typeof env.PROXY_RATE_LIMIT.get === "function" &&
      typeof env.PROXY_RATE_LIMIT.put === "function") {
    const current = Number(await env.PROXY_RATE_LIMIT.get(key) || 0) + 1;
    if (current > RATE_LIMIT) return false;
    await env.PROXY_RATE_LIMIT.put(key, String(current), { expirationTtl: RATE_WINDOW_SECONDS * 2 });
    return true;
  }
  // Best-effort fallback only. Configure PROXY_RATE_LIMIT KV or a Durable Object for production.
  for (const [k, v] of memoryRate) if (v.expires <= now) memoryRate.delete(k);
  const current = memoryRate.get(key) || { count: 0, expires: (bucket + 1) * RATE_WINDOW_SECONDS };
  current.count++;
  memoryRate.set(key, current);
  return current.count <= RATE_LIMIT;
}

async function fetchValidated(url, init, allowlist) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const response = await fetch(current.toString(), { ...init, redirect: "manual", signal });
    if (![301,302,303,307,308].includes(response.status)) {
      return { response, finalUrl: current.toString() };
    }
    const location = response.headers.get("Location");
    if (!location || hop === MAX_REDIRECTS) return { response, finalUrl: current.toString() };
    const next = validateTarget(new URL(location, current).toString(), allowlist);
    current = next;
  }
  throw new Error("Too many upstream redirects");
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env || {};
  const headers = corsHeaders(request, env);

  if (request.method === "OPTIONS") {
    if (!headers.has("Access-Control-Allow-Origin")) return proxyError("Origin not allowed", 403, headers);
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET" && request.method !== "HEAD") return proxyError("Method not allowed", 405, headers);
  if (!headers.has("Access-Control-Allow-Origin")) return proxyError("Origin not allowed", 403, headers);
  if (request.url.length > 12000) return proxyError("Request URL too large", 414, headers);

  let target;
  const requestUrl = new URL(request.url);
  try {
    target = validateTarget(requestUrl.searchParams.get("u") || requestUrl.searchParams.get("url"), allowedHosts(env));
  } catch (error) {
    return proxyError(error.message, 403, headers);
  }

  try {
    if (!await checkRateLimit(request, env)) {
      headers.set("Retry-After", String(RATE_WINDOW_SECONDS));
      return proxyError("Rate limit exceeded", 429, headers);
    }

    const incoming = request.headers;
    const upstreamHeaders = new Headers();
    upstreamHeaders.set("Accept", incoming.get("Accept") || "*/*");
    upstreamHeaders.set("User-Agent", incoming.get("User-Agent") || "CRICZONE-Stream-Proxy/1.0");
    for (const name of ["Range", "If-Range"]) {
      const value = incoming.get(name);
      if (value) upstreamHeaders.set(name, value);
    }
    const isSony = target.hostname === "sonyliv.com" || target.hostname.endsWith(".sonyliv.com") ||
      target.hostname === "sonyeventsglobal.akamaized.net" || target.hostname.endsWith(".sonyeventsglobal.akamaized.net") ||
      target.hostname === "slivcdn.com" || target.hostname.endsWith(".slivcdn.com");
    upstreamHeaders.set("Referer", isSony ? "https://www.sonyliv.com/" : target.origin + "/");
    upstreamHeaders.set("Origin", isSony ? "https://www.sonyliv.com" : target.origin);

    let result = await fetchValidated(target, { method: request.method, headers: upstreamHeaders }, allowedHosts(env));
    let upstream = result.response;
    if (request.method === "HEAD" && !upstream.ok) {
      result = await fetchValidated(target, { method: "GET", headers: upstreamHeaders }, allowedHosts(env));
      upstream = result.response;
    }

    const finalUrl = result.finalUrl;
    const contentType = upstream.headers.get("content-type") || "";
    const isPlaylist = /mpegurl|vnd\.apple\.mpegurl/i.test(contentType) || /\.m3u8?($|[?#])/i.test(finalUrl);
    const isDash = /dash\+xml|application\/xml|text\/xml/i.test(contentType) || /\.mpd($|[?#])/i.test(finalUrl);

    for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    if ((isPlaylist || isDash) && upstream.ok && request.method !== "HEAD") {
      const length = Number(upstream.headers.get("Content-Length") || 0);
      if (length > MAX_MANIFEST_BYTES) return proxyError("Manifest exceeds size limit", 413, headers);
      let manifestText;
      try { manifestText = await readTextLimited(upstream, MAX_MANIFEST_BYTES); }
      catch (error) {
        if (String(error?.message || error).includes("size limit")) return proxyError("Manifest exceeds size limit", 413, headers);
        throw error;
      }
      const endpoint = requestUrl.origin + requestUrl.pathname;
      const rewritten = isPlaylist ? rewriteHlsPlaylist(manifestText, finalUrl, endpoint) :
        rewriteDashManifest(manifestText, finalUrl, endpoint);
      headers.set("Content-Type", isPlaylist ? "application/vnd.apple.mpegurl; charset=utf-8" : "application/dash+xml; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      headers.delete("Content-Length");
      headers.delete("Content-Range");
      return new Response(rewritten, { status: upstream.status, statusText: upstream.statusText, headers });
    }

    // Do not cache signed/tokenized URLs. Short shared cache for ordinary media chunks only.
    const hasAuthQuery = /(?:token|auth|sig|signature|hdnea|expires|exp|key)=/i.test(finalUrl);
    if (upstream.ok && !isPlaylist && !isDash && !hasAuthQuery && request.method === "GET") {
      headers.set("Cache-Control", "public, max-age=10, s-maxage=20");
    } else {
      headers.set("Cache-Control", "no-store");
    }
    if (request.method === "HEAD") return new Response(null, { status: upstream.status, statusText: upstream.statusText, headers });
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  } catch (error) {
    const timedOut = error?.name === "AbortError" || error?.name === "TimeoutError";
    console.error("CRICZONE proxy upstream failure", {
      targetHost: target.hostname,
      error: String(error?.message || error),
      timedOut
    });
    return proxyError(timedOut ? "Upstream request timed out" : "Proxy upstream request failed", 502, headers);
  }
}
