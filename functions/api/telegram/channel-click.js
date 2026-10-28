// GET /api/telegram/channel-click?t=<per-user-token>
// Records that a user opened the channel link supplied by the bot, then redirects to Telegram.
export async function onRequestGet({ request, env }) {
  const target = "https://t.me/criczonelive";
  const token = new URL(request.url).searchParams.get("t") || "";
  if (!env.TELEGRAM_DB || !/^[a-f0-9-]{36}$/i.test(token)) return Response.redirect(target, 302);
  try {
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_channel_click_tokens (token TEXT PRIMARY KEY, telegram_id TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT, created_at TEXT NOT NULL, clicked_at TEXT)").run();
    await env.TELEGRAM_DB.prepare("UPDATE telegram_channel_click_tokens SET clicked_at = ? WHERE token = ? AND clicked_at IS NULL").bind(new Date().toISOString(), token).run();
  } catch (error) {
    console.error("Telegram channel click tracking failed:", error?.message || error);
  }
  return Response.redirect(target, 302);
}
