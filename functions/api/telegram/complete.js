const json = (data, status = 400) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
async function sign(value, token) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export async function onRequestGet({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ error: "Server configuration missing" }, 500);
  const url = new URL(request.url), nonce = url.searchParams.get("nonce") || "";
  if (!/^[a-f0-9]{32}$/i.test(nonce)) return json({ error: "Invalid verification link" });
  const row = await env.TELEGRAM_DB.prepare("SELECT return_url,status,expires_at,telegram_user_id FROM telegram_login_requests WHERE nonce=?").bind(nonce).first();
  const now = Math.floor(Date.now() / 1000);
  if (!row || row.status !== "verified" || row.expires_at < now || !row.telegram_user_id) return json({ error: "Membership not verified or link expired. Return to website and try again." });
  const target = new URL(row.return_url);
  if (target.origin !== url.origin) return json({ error: "Invalid return destination" });
  const expires = now + 12 * 60 * 60;
  const payload = btoa(JSON.stringify({ uid: row.telegram_user_id, exp: expires })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const cookieValue = `${payload}.${await sign(payload, env.BOT_TOKEN)}`;
  await env.TELEGRAM_DB.prepare("DELETE FROM telegram_login_requests WHERE nonce=?").bind(nonce).run();
  return new Response(null, { status: 302, headers: { "Location": target.href, "Set-Cookie": `cz_tg_session=${cookieValue}; Max-Age=43200; Path=/; HttpOnly; Secure; SameSite=Lax`, "Cache-Control": "no-store" } });
}
