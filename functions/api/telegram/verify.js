// POST /api/telegram/verify
// Verifies Telegram Login Widget payload and checks membership in @criczonelive.
const CHANNEL = "@criczonelive";
const MAX_AUTH_AGE_SECONDS = 86400;

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  const requestUrl = new URL(request.url);
  if (origin && origin !== requestUrl.origin) {
    return json({ ok: false, error: "Forbidden origin" }, 403);
  }
  if (!env.BOT_TOKEN) {
    return json({ ok: false, error: "Membership verification is not configured." }, 503);
  }

  let user;
  try {
    user = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON." }, 400);
  }

  if (!user || typeof user !== "object" || !user.hash || !user.id || !user.auth_date) {
    return json({ ok: false, error: "Missing Telegram login fields." }, 400);
  }

  const authDate = Number(user.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate > now + 60 || now - authDate > MAX_AUTH_AGE_SECONDS) {
    return json({ ok: false, error: "Telegram login expired. Please sign in again." }, 401);
  }

  const fields = Object.keys(user)
    .filter((key) => key !== "hash" && user[key] !== undefined && user[key] !== null)
    .sort()
    .map((key) => key + "=" + user[key]);
  const checkString = fields.join("\n");

  const encoder = new TextEncoder();
  const tokenHash = await crypto.subtle.digest("SHA-256", encoder.encode(env.BOT_TOKEN));
  const hmacKey = await crypto.subtle.importKey(
    "raw", tokenHash, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(checkString)));
  const expectedHash = Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");

  if (!constantTimeEqual(expectedHash, String(user.hash).toLowerCase())) {
    return json({ ok: false, error: "Telegram identity could not be verified." }, 401);
  }

  try {
    const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(user.id) })
    });
    const result = await response.json();
    if (!response.ok || !result.ok || !result.result) {
      return json({ ok: false, error: "Telegram membership check failed. Please try again." }, 502);
    }

    const status = result.result.status;
    const isMember = ["creator", "administrator", "member"].includes(status) ||
      (status === "restricted" && result.result.is_member === true);

    if (!isMember) {
      return json({ ok: false, member: false, error: "Join @criczonelive, then verify again." }, 403);
    }

    // Persist successful verifications when a Cloudflare D1 binding named TELEGRAM_DB is configured.
    // Never log bot tokens or raw Telegram login hashes.
    if (env.TELEGRAM_DB) {
      try {
        await env.TELEGRAM_DB.prepare(
          "INSERT INTO telegram_members (telegram_id, first_name, username, membership_status, verified_at, auth_date) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name, username=excluded.username, membership_status=excluded.membership_status, verified_at=excluded.verified_at, auth_date=excluded.auth_date"
        ).bind(
          String(user.id),
          String(user.first_name || "").slice(0, 80),
          String(user.username || "").slice(0, 80),
          status,
          new Date().toISOString(),
          authDate
        ).run();
      } catch (error) {
        console.error("Telegram verification audit write failed", error && error.message);
      }
    }

    const response = json({
      ok: true,
      member: true,
      user: { id: Number(user.id), first_name: String(user.first_name || "").slice(0, 80) }
    }, 200);
    // Short-lived, signed HttpOnly session avoids asking verified members to log in on every page load.
    response.headers.append("Set-Cookie", await createSessionCookie(env.BOT_TOKEN, String(user.id)));
    return response;
  } catch {
    return json({ ok: false, error: "Unable to contact Telegram. Please retry." }, 502);
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Use POST with a Telegram Login Widget response." }, 405);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}


async function createSessionCookie(botToken, telegramId) {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    id: telegramId,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  })));
  const signature = await signSession(botToken, payload);
  return "cz_tg_session=" + payload + "." + signature +
    "; Max-Age=28800; Path=/; Secure; HttpOnly; SameSite=Lax";
}

async function signSession(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return base64UrlEncode(signature);
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
}
