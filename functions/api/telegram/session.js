const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
async function sign(value, token) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export async function onRequestGet({ request, env }) {
  const raw = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith("cz_tg_session="))?.slice("cz_tg_session=".length);
  if (!raw || !env.BOT_TOKEN) return json({ verified: false });
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || signature !== await sign(payload, env.BOT_TOKEN)) return json({ verified: false }, 401, { "Set-Cookie": "cz_tg_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax" });
  try {
    const data = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/")));
    if (!data.uid || !data.exp || data.exp <= Math.floor(Date.now() / 1000)) throw new Error("expired");
    return json({ verified: true, expires_at: data.exp });
  } catch {
    return json({ verified: false }, 401, { "Set-Cookie": "cz_tg_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax" });
  }
}
export function onRequestPost() { return json({ error: "Method not allowed" }, 405); }
