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
  // Record channel membership changes when Telegram sends chat_member updates.
  const memberUpdate = update?.chat_member;
  if (memberUpdate && String(memberUpdate.chat?.username || "").toLowerCase() === "criczonelive") {
    const from = memberUpdate.new_chat_member?.user || memberUpdate.from;
    const oldStatus = String(memberUpdate.old_chat_member?.status || "");
    const newStatus = String(memberUpdate.new_chat_member?.status || "");
    const joined = ["member", "administrator", "creator"].includes(newStatus) || (newStatus === "restricted" && memberUpdate.new_chat_member?.is_member === true);
    const wasMember = ["member", "administrator", "creator"].includes(oldStatus) || (oldStatus === "restricted" && memberUpdate.old_chat_member?.is_member === true);
    try {
      await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_channel_activity (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT, event_type TEXT NOT NULL, event_at TEXT NOT NULL, old_status TEXT, new_status TEXT)").run();
      await env.TELEGRAM_DB.prepare("INSERT INTO telegram_channel_activity (telegram_id, first_name, last_name, username, event_type, event_at, old_status, new_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(String(from?.id || memberUpdate.new_chat_member?.user?.id || ""), String(from?.first_name || "").slice(0,80), String(from?.last_name || "").slice(0,80), String(from?.username || "").slice(0,80), joined && !wasMember ? "joined" : (!joined && wasMember ? "left" : "membership_changed"), new Date().toISOString(), oldStatus, newStatus).run();
    } catch (error) { console.error("Channel membership audit write failed:", error?.message || error); }
    return json({ ok: true });
  }

  const callback = update?.callback_query;
  if (callback?.id) {
    try { await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/answerCallbackQuery", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({callback_query_id:callback.id}) }); } catch {}
    return json({ ok: true });
  }

  const message = update?.message;
  const chatId = message?.chat?.id;
  const from = message?.from;
  const userId = from?.id;
  const text = String(message?.text || "");
  if (!chatId || !userId) return json({ ok: true });

  // Save every /start event, even when it was not launched from the website.
  const startMatch = text.match(/^\/start(?:\s+(.+))?$/i);
  if (startMatch && !startMatch[1] && env.TELEGRAM_DB) {
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
  if (!match) {
    if (startMatch && !startMatch[1]) {
      try {
        await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_channel_click_tokens (token TEXT PRIMARY KEY, telegram_id TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT, created_at TEXT NOT NULL, clicked_at TEXT)").run();
        const token = crypto.randomUUID();
        await env.TELEGRAM_DB.prepare("INSERT INTO telegram_channel_click_tokens (token, telegram_id, first_name, last_name, username, created_at, clicked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)").bind(token, String(userId), String(from.first_name || "").slice(0,80), String(from.last_name || "").slice(0,80), String(from.username || "").slice(0,80), new Date().toISOString()).run();
        await sendMessage(env.BOT_TOKEN, chatId, "Welcome to CRICZONE! Tap below to open our official channel.", { inline_keyboard: [[{ text: "📢 Join @criczonelive", url: "https://criczone.pages.dev/api/telegram/channel-click?t=" + token }]] });
      } catch (error) { console.error("Telegram start welcome failed:", error?.message || error); }
    }
    return json({ ok: true });
  }
  const nonce = match[1];
  try {
    const pending = await env.TELEGRAM_DB.prepare(
      "SELECT nonce, return_url FROM telegram_login_requests WHERE nonce = ? AND status = 'pending' AND expires_at > ?"
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
    await sendMessage(env.BOT_TOKEN, chatId, "Membership verified ✅ Return to CRICZONE; your player access will unlock automatically.", pending.return_url ? { inline_keyboard: [[{ text: "↩️ Return to the website", url: pending.return_url }]] } : undefined);
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 500);
  }
}

async function sendMessage(token, chatId, text, replyMarkup) {
  await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) })
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
