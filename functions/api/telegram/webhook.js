const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function telegramSendMessage(token, chatId, text, replyToMessageId) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId, allow_sending_without_reply: true } : {})
    })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    console.error("Telegram sendMessage failed", result);
  }
  return result;
}

export async function onRequestPost({ request, env }) {
  const configuredSecret = env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");

  if (!configuredSecret) {
    return json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET is not configured" }, 503);
  }
  if (!receivedSecret || receivedSecret !== configuredSecret) {
    return json({ ok: false, error: "Unauthorized webhook request" }, 401);
  }
  if (!env.BOT_TOKEN) {
    return json({ ok: false, error: "BOT_TOKEN is not configured" }, 503);
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON update" }, 400);
  }

  const message = update?.message ?? update?.edited_message;
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;

  // Ignore non-text updates, messages without a chat, and messages sent by bots.
  if (!chatId || !text || message?.from?.is_bot) {
    return json({ ok: true, ignored: true });
  }

  // Initial connectivity check only. AI conversation handling will be added
  // after the webhook is verified; ordinary group messages are not answered yet.
  const command = text.split(/\\s+/)[0].split("@")[0].toLowerCase();
  if (command === "/start" || command === "/ping") {
    await telegramSendMessage(
      env.BOT_TOKEN,
      chatId,
      "🤖 CRICZONE AI webhook connected! AI assistant setup is the next step.",
      messageId
    );
  }

  return json({ ok: true, received: true });
}

export async function onRequestGet() {
  return json({ ok: true, service: "CRICZONE Telegram webhook", status: "ready_for_telegram_updates" });
}
