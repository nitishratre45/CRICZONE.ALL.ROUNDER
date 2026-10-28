// POST /api/telegram/start - create a short-lived Telegram bot sign-in challenge.
export async function onRequestPost({ env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ ok: false, error: "Telegram sign-in is not configured yet." }, 503);
  // Ensure the bot is connected to this Pages webhook without exposing BOT_TOKEN to the browser.\n  const webhookSecret = await deriveWebhookSecret(env.BOT_TOKEN);\n  const hook = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/setWebhook", {\n    method: "POST", headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({ url: "https://criczone.pages.dev/api/telegram/webhook", secret_token: webhookSecret, allowed_updates: ["message"], drop_pending_updates: false })\n  });\n  const hookResult = await hook.json();\n  if (!hook.ok || !hookResult.ok) return json({ ok: false, error: "Could not connect the Telegram bot. Check the bot token in Cloudflare Pages secrets." }, 503);\n  const nonce = crypto.randomUUID();
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

async function deriveWebhookSecret(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("criczone-telegram-webhook-v1:" + token)));
  let binary = ""; for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
}
