// POST /api/telegram/webhook
// Set Telegram webhook URL to https://criczone.pages.dev/api/telegram/webhook
// using BOT_TOKEN and secret_token=TELEGRAM_WEBHOOK_SECRET via Telegram setWebhook.
const CHANNEL = "@criczonelive";

export async function onRequestPost({ request, env }) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) {
    return json({ ok: false }, 503);
  }
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== await webhookSecret(env.BOT_TOKEN)) {
    return json({ ok: false }, 401);
  }
  let update;
  try { update = await request.json(); } catch { return json({ ok: false }, 400); }
  const message = update?.message;
  const chatId = message?.chat?.id;
  const from = message?.from;
  const userId = from?.id;
  const text = String(message?.text || "");
  if (!chatId || !userId) return json({ ok: true });

  // Save every /start event, even when it was not launched from the website.
  const startMatch = text.match(/^\/start(?:\s+(.+))?$/i);
  if (startMatch && env.TELEGRAM_DB) {
    try {
      await env.TELEGRAM_DB.prepare(
        "INSERT INTO telegram_bot_starts (telegram_id, first_name, last_name, username, language_code, start_payload, started_at, chat_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        String(userId),
        String(from.first_name || "").slice(0, 80),
        String(from.last_name || "").slice(0, 80),
        String(from.username || "").slice(0, 80),
        String(from.language_code || "").slice(0, 20),
        String(startMatch[1] || "").slice(0, 100),
        new Date().toISOString(),
        String(message.chat.type || "").slice(0, 30)
      ).run();
    } catch (error) {
      console.error("Telegram bot-start audit write failed:", error?.message || error);
    }
  }

  const match = text.match(/^\/start\s+([a-f0-9-]{36})$/i);
  if (!match) return json({ ok: true });
  const nonce = match[1];
  try {
    const pending = await env.TELEGRAM_DB.prepare(
      "SELECT nonce FROM telegram_login_requests WHERE nonce = ? AND status = 'pending' AND expires_at > ?"
    ).bind(nonce, Date.now()).first();
    if (!pending) {
      await sendMessage(env.BOT_TOKEN, chatId, "This sign-in link expired. Return to CRICZONE and try again.");
      return json({ ok: true });
    }

    const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL, user_id: Number(userId) })
    });
    const data = await response.json();
    if (!response.ok || !data.ok || !data.result) {
      await sendMessage(env.BOT_TOKEN, chatId, "I couldn't check your channel membership. Please try again in CRICZONE.");
      return json({ ok: true });
    }
    const status = data.result.status;
    const member = ["creator", "administrator", "member"].includes(status) ||
      (status === "restricted" && data.result.is_member === true);
    if (!member) {
      await env.TELEGRAM_DB.prepare(
        "UPDATE telegram_login_requests SET status = 'not_member', telegram_id = ?, updated_at = ? WHERE nonce = ? AND status = 'pending'"
      ).bind(String(userId), Date.now(), nonce).run();
      await sendMessage(env.BOT_TOKEN, chatId, "Please join @criczonelive first, then return to CRICZONE and check again.");
      return json({ ok: true });
    }
    await env.TELEGRAM_DB.prepare(
      "UPDATE telegram_login_requests SET status = 'verified', telegram_id = ?, updated_at = ? WHERE nonce = ? AND status = 'pending'"
    ).bind(String(userId), Date.now(), nonce).run();
    await sendMessage(env.BOT_TOKEN, chatId, "Membership verified ✅ Return to CRICZONE; your player access will unlock automatically.");
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 500);
  }
}

async function sendMessage(token, chatId, text) {
  await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"
  }});
}

async function webhookSecret(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("criczone-telegram-webhook-v1:" + token)));
  let binary = ""; for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
