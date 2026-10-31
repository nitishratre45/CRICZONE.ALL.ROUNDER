const BOT = "CRICZONE_ADMIN_BOT";
const CHANNEL = "@criczonelive";
const TTL = 5 * 60;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "Method not allowed", allowed: ["POST"], received: request.method }, 405);
  const origin = new URL(request.url).origin;
  if (request.headers.get("Origin") !== origin) return json({ error: "Cross-origin request blocked" }, 403);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) return json({ error: "Content-Type must be application/json" }, 415);
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ error: "Server configuration missing", bot_token: !!env.BOT_TOKEN, telegram_db: !!env.TELEGRAM_DB }, 500);
  let body; try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  let target; try { target = new URL(body.return_url); } catch { return json({ error: "Invalid return URL" }, 400); }
  if (target.origin !== origin || !["https:", "http:"].includes(target.protocol)) return json({ error: "Return URL must be on this website" }, 400);
  await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_login_requests (nonce TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', return_url TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, telegram_user_id TEXT, verified_at INTEGER)").run();
  for (const column of ["telegram_user_id TEXT", "verified_at INTEGER"]) {
    try { await env.TELEGRAM_DB.prepare(`ALTER TABLE telegram_login_requests ADD COLUMN ${column}`).run(); }
    catch (error) { if (!/duplicate column/i.test(String(error))) throw error; }
  }
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const now = Math.floor(Date.now() / 1000);
  await env.TELEGRAM_DB.prepare("INSERT INTO telegram_login_requests (nonce,status,return_url,created_at,expires_at) VALUES (?, 'pending', ?, ?, ?)").bind(nonce, target.href, now, now + TTL).run();
  return json({ ok: true, nonce, bot_url: `https://t.me/${BOT}?start=${nonce}`, expires_in: TTL });
}
