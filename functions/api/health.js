// GET /api/health - non-mutating connection diagnostics for CRICZONE.
async function handleGet({ env }) {
  const checks = {
    telegram_bot_token: false,
    telegram_db: false,
    telegram_api: false,
    telegram_channel_admin: false,
    telegram_webhook: false
  };

  if (!env.BOT_TOKEN) {
    return json({ ok: false, checks, error: "BOT_TOKEN is not configured" }, 503);
  }
  checks.telegram_bot_token = true;

  if (!env.TELEGRAM_DB) {
    return json({ ok: false, checks, error: "TELEGRAM_DB binding is missing" }, 503);
  }

  try {
    await env.TELEGRAM_DB.prepare("SELECT 1 AS connected").first();
    checks.telegram_db = true;
  } catch (error) {
    console.error("Health check D1 failed:", error?.message || error);
    return json({ ok: false, checks, error: "D1 database query failed" }, 503);
  }

  try {
    const [meResponse, webhookResponse] = await Promise.all([
      fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getMe"),
      fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getWebhookInfo")
    ]);
    const me = await meResponse.json();
    const webhook = await webhookResponse.json();
    if (!meResponse.ok || !me.ok || !me.result?.id) {
      return json({ ok: false, checks, error: "Telegram getMe failed" }, 503);
    }
    checks.telegram_api = true;

    const hookUrl = String(webhook.result?.url || "");
    checks.telegram_webhook = webhookResponse.ok && webhook.ok &&
      hookUrl === "https://criczone.pages.dev/api/telegram/webhook";

    const memberResponse = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMember", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: "@criczonelive", user_id: Number(me.result.id) })
    });
    const member = await memberResponse.json();
    checks.telegram_channel_admin = memberResponse.ok && member.ok &&
      ["administrator", "creator"].includes(String(member.result?.status || ""));

    const ok = Object.values(checks).every(Boolean);
    return json({
      ok,
      checks,
      bot: { username: me.result.username || null },
      webhook: { configured: checks.telegram_webhook },
      channel: { bot_is_admin: checks.telegram_channel_admin }
    }, ok ? 200 : 503);
  } catch (error) {
    console.error("CRICZONE health check failed:", error?.message || error);
    return json({ ok: false, checks, error: "Telegram connection check failed" }, 503);
  }
}

export async function onRequest(context) {
  if (context.request.method === "GET") return handleGet(context);
  return json({ ok: false, error: "Method not allowed" }, 405);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
