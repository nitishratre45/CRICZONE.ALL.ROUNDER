const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const adminKey = env.ADMIN_DASHBOARD_KEY || env.TELEGRAM_ADMIN_KEY;
  if (!adminKey || request.headers.get("X-Admin-Key") !== adminKey) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!env.BOT_TOKEN) return json({ ok: false, error: "BOT_TOKEN secret is missing" }, 500);
  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/api/telegram/webhook`;
  const secret = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.BOT_TOKEN)));
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ["message", "callback_query", "chat_member", "chat_join_request"], drop_pending_updates: false })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) return json({ ok: false, step: "setWebhook", error: result.description || "Telegram rejected webhook setup" }, 502);
    const infoResponse = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getWebhookInfo`);
    const info = await infoResponse.json();
    return json({
      ok: true,
      message: "Telegram webhook registered",
      webhook_url: info.result?.url || webhookUrl,
      pending_update_count: info.result?.pending_update_count ?? null,
      last_error_message: info.result?.last_error_message || null,
      allowed_updates: info.result?.allowed_updates || ["message", "chat_join_request"]
    });
  } catch (error) {
    return json({ ok: false, error: error.message || "Webhook setup failed" }, 502);
  }
}
