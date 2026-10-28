// GET /api/telegram/status?nonce=<challenge> - poll bot verification.
const CHANNEL = "@criczonelive";
export async function onRequestGet({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ ok: false, error: "Telegram sign-in is not configured yet." }, 503);
  const nonce = new URL(request.url).searchParams.get("nonce") || "";
  if (!/^[a-f0-9-]{36}$/i.test(nonce)) return json({ ok: false, error: "Invalid sign-in request." }, 400);
  try {
    const row = await env.TELEGRAM_DB.prepare(
      "SELECT status, telegram_id, expires_at FROM telegram_login_requests WHERE nonce = ?"
    ).bind(nonce).first();
    if (!row || row.expires_at <= Date.now()) return json({ ok: false, status: "expired", error: "Sign-in link expired. Try again." }, 410);
    if (row.status === "pending") return json({ ok: true, status: "pending" });
    if (row.status === "not_member") return json({ ok: true, status: "not_member", error: "Join @criczonelive first, then try again." });
    if (row.status !== "verified" || !row.telegram_id) return json({ ok: false, error: "Verification failed. Try again." }, 401);

    // Recheck live membership before granting the browser session.
    const tgResponse = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(row.telegram_id) })
    });
    const tg = await tgResponse.json();
    if (!tgResponse.ok || !tg.ok || !tg.result) return json({ ok: false, error: "Telegram membership check failed. Try again." }, 502);
    const s = tg.result.status;
    const member = ["creator", "administrator", "member"].includes(s) || (s === "restricted" && tg.result.is_member === true);
    if (!member) return json({ ok: true, status: "not_member", error: "Join @criczonelive first, then try again." });

    const cookie = await createSessionCookie(env.BOT_TOKEN, String(row.telegram_id));
    await env.TELEGRAM_DB.prepare("DELETE FROM telegram_login_requests WHERE nonce = ?").bind(nonce).run();
    return new Response(JSON.stringify({ ok: true, status: "verified" }), { status: 200, headers: {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "Set-Cookie": cookie
    }});
  } catch {
    return json({ ok: false, error: "Could not verify sign-in. Check database setup and try again." }, 503);
  }
}
async function createSessionCookie(secret, id) {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ id, exp: Math.floor(Date.now()/1000)+8*60*60 })));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const signature = base64UrlEncode(sig);
  return "cz_tg_session=" + payload + "." + signature + "; Max-Age=28800; Path=/; Secure; HttpOnly; SameSite=Lax";
}
function base64UrlEncode(bytes) {
  let b=""; for (const x of bytes) b+=String.fromCharCode(x);
  return btoa(b).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"
  }});
}
