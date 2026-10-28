// GET /api/telegram/open - bridge normal Telegram bot channel links into a browser session.
const CHANNEL = "@criczonelive";
const ALLOWED_HOSTS = new Set(["criczone.pages.dev", "criczone.online", "www.criczone.online"]);

export async function onRequestGet({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ ok: false, error: "Telegram access is not configured." }, 503);
  const url = new URL(request.url);
  const uid = url.searchParams.get("uid") || "";
  const exp = Number(url.searchParams.get("exp"));
  const targetValue = url.searchParams.get("target") || "";
  const signature = url.searchParams.get("sig") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!/^\\d{1,24}$/.test(uid) || !Number.isSafeInteger(exp) || exp <= now || exp > now + 10 * 60 || !signature) {
    return json({ ok: false, error: "This channel link expired. Send /start to the bot again." }, 401);
  }
  let target;
  try { target = new URL(targetValue); } catch { return json({ ok: false, error: "Invalid channel link." }, 400); }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname.toLowerCase()) || target.username || target.password) {
    return json({ ok: false, error: "This channel link is not allowed." }, 403);
  }
  try {
    const canonical = uid + "\\n" + String(exp) + "\\n" + target.href;
    const expected = await sign(env.BOT_TOKEN, canonical);
    if (!constantTimeEqual(expected, signature)) return json({ ok: false, error: "Invalid channel access signature." }, 403);

    const session = await env.TELEGRAM_DB.prepare(
      "SELECT expires_at FROM telegram_category_sessions WHERE telegram_id = ?"
    ).bind(uid).first();
    if (!session || Number(session.expires_at) <= Date.now()) {
      return json({ ok: false, error: "Your 12-hour bot session expired. Send /start to the bot again." }, 401);
    }

    const memberResponse = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(uid) })
    });
    const memberData = await memberResponse.json();
    const status = memberData?.result?.status;
    const member = memberResponse.ok && memberData.ok && memberData.result &&
      (["creator", "administrator", "member"].includes(status) || (status === "restricted" && memberData.result.is_member === true));
    if (!member) return json({ ok: false, error: "Membership is no longer active. Send /start after joining the channel." }, 401);

    const cookie = await createSessionCookie(env.BOT_TOKEN, uid, Math.min(Number(session.expires_at), Date.now() + 12 * 60 * 60 * 1000));
    return new Response(null, {
      status: 302,
      headers: {
        "Location": target.href,
        "Set-Cookie": cookie,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Telegram channel access bridge failed:", error?.message || error);
    return json({ ok: false, error: "Could not establish your browser session. Try again." }, 503);
  }
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
}
async function createSessionCookie(secret, id, expiresAtMs) {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ id, exp: Math.floor(expiresAtMs / 1000) })));
  const signature = await sign(secret, payload);
  const maxAge = Math.max(0, Math.floor(expiresAtMs / 1000) - Math.floor(Date.now() / 1000));
  return "cz_tg_session=" + payload + "." + signature + "; Max-Age=" + maxAge + "; Path=/; Secure; HttpOnly; SameSite=Lax";
}
function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }});
}
