// POST /api/telegram/start - create a short-lived Telegram bot sign-in challenge.
export async function onRequestPost({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) {
    return json({ ok: false, error: "Telegram sign-in is not configured yet." }, 503);
  }

  try {
    const webhookSecret = await deriveWebhookSecret(env.BOT_TOKEN);
    const hook = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/setWebhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://criczone.pages.dev/api/telegram/webhook",
        secret_token: webhookSecret,
        allowed_updates: ["message"],
        drop_pending_updates: false
      })
    });
    const hookResult = await hook.json();
    if (!hook.ok || !hookResult.ok) {
      console.error("Telegram setWebhook failed:", hookResult.description || hook.status);
      return json({ ok: false, error: "Could not connect the Telegram bot. Check the bot token and webhook configuration." }, 503);
    }

    const nonce = crypto.randomUUID();
    const now = Date.now();
    await env.TELEGRAM_DB.prepare(
      "INSERT INTO telegram_login_requests (nonce, status, telegram_id, created_at, updated_at, expires_at, return_url) VALUES (?, 'pending', NULL, ?, ?, ?, ?)"
    ).bind(nonce, now, now, now + 5 * 60 * 1000, returnUrl || null).run();

    return json({
      ok: true,
      nonce,
      bot_url: "https://t.me/CRICZONE_ADMIN_BOT?start=" + nonce,
      expires_in: 300
    });
  } catch (error) {
    console.error("Telegram sign-in start failed:", error?.message || error);
    return json({ ok: false, error: "Could not start Telegram sign-in. Check the bot token and database configuration." }, 503);
  }
}

async function deriveWebhookSecret(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("criczone-telegram-webhook-v1:" + token)
  ));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
