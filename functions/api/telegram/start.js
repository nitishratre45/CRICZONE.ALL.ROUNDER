// POST /api/telegram/start - create a short-lived Telegram bot sign-in challenge.
export async function onRequestPost({ env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ ok: false, error: "Telegram sign-in is not configured yet." }, 503);
  const nonce = crypto.randomUUID();
  const now = Date.now();
  try {
    await env.TELEGRAM_DB.prepare(
      "INSERT INTO telegram_login_requests (nonce, status, telegram_id, created_at, updated_at, expires_at) VALUES (?, 'pending', NULL, ?, ?, ?)"
    ).bind(nonce, now, now, now + 5 * 60 * 1000).run();
    return json({ ok: true, nonce, bot_url: "https://t.me/CRICZONE_ADMIN_BOT?start=" + nonce, expires_in: 300 });
  } catch {
    return json({ ok: false, error: "Could not start Telegram sign-in. Database setup may be incomplete." }, 503);
  }
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"
  }});
}
