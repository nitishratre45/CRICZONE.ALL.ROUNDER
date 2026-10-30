const BOT = "CRICZONE_ADMIN_BOT";
const CHANNEL = "@criczonelive";
const TTL = 5 * 60;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
async function webhookSecret(token) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))); }
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "Method not allowed", allowed: ["POST"], received: request.method }, 405);
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ error: "Server configuration missing", bot_token: !!env.BOT_TOKEN, telegram_db: !!env.TELEGRAM_DB }, 500);
  let body; try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  let target; try { target = new URL(body.return_url); } catch { return json({ error: "Invalid return URL" }, 400); }
  const origin = new URL(request.url).origin;
  if (target.origin !== origin || !["https:", "http:"].includes(target.protocol)) return json({ error: "Return URL must be on this website" }, 400);
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const now = Math.floor(Date.now() / 1000);
  await env.TELEGRAM_DB.prepare("INSERT INTO telegram_login_requests (nonce,status,return_url,created_at,expires_at) VALUES (?, 'pending', ?, ?, ?)").bind(nonce, target.href, now, now + TTL).run();
  const secret = await webhookSecret(env.BOT_TOKEN);
  const hook = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: `${origin}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message", "callback_query"] }) });
  const hookData = await hook.json();
  if (!hook.ok || !hookData.ok) return json({ error: "Could not configure Telegram webhook", detail: hookData.description || "Telegram error" }, 502);
  return json({ ok: true, nonce, bot_url: `https://t.me/${BOT}?start=${nonce}`, expires_in: TTL });
}
