// GET /api/telegram/session
// Validates the short-lived HttpOnly session and rechecks current channel membership.
const CHANNEL = "@criczonelive";

export async function onRequestGet({ request, env }) {
  if (!env.BOT_TOKEN) {
    return json({ ok: false, error: "Membership verification is not configured." }, 503);
  }
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)cz_tg_session=([^;]+)/);
  if (!match) return json({ ok: false, member: false }, 401);

  const token = match[1];
  const dot = token.lastIndexOf(".");
  if (dot < 1) return expired();
  const payloadPart = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  try {
    const expected = await signSession(env.BOT_TOKEN, payloadPart);
    if (!constantTimeEqual(expected, signature)) return expired();
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.id || !Number.isFinite(payload.exp) || payload.exp <= now || payload.exp > now + 12 * 60 * 60 + 60) {
      return expired();
    }

    const tgResponse = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(payload.id) })
    });
    const tg = await tgResponse.json();
    if (!tgResponse.ok || !tg.ok || !tg.result) {
      return json({ ok: false, error: "Telegram membership check failed." }, 502);
    }
    const status = tg.result.status;
    const member = ["creator", "administrator", "member"].includes(status) ||
      (status === "restricted" && tg.result.is_member === true);
    if (!member) {
      return new Response(JSON.stringify({ ok: false, member: false }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": "cz_tg_session=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax" }
      });
    }
    return json({ ok: true, member: true }, 200);
  } catch {
    return json({ ok: false, error: "Unable to verify Telegram session." }, 502);
  }
}

async function signSession(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return base64UrlEncode(bytes);
}
function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function expired() {
  return new Response(JSON.stringify({ ok: false, member: false }), {
    status: 401,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": "cz_tg_session=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax" }
  });
}
function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }});
}
