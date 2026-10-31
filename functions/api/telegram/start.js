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
  if (!env.BOT_TOKEN || !env.TELEGRAM_DB) return json({ error: "Server configuration missing" }, 500);
  // Per-IP login-start rate limit: 8 requests per 10-minute window.
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
  const ipHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
  const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/600)*600;
  await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_login_rate_limits (ip_hash TEXT PRIMARY KEY, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL DEFAULT 0)").run();
  await env.TELEGRAM_DB.prepare("INSERT INTO telegram_login_rate_limits(ip_hash,window_start,request_count) VALUES(?,?,1) ON CONFLICT(ip_hash) DO UPDATE SET request_count=CASE WHEN telegram_login_rate_limits.window_start<? THEN 1 ELSE telegram_login_rate_limits.request_count+1 END,window_start=CASE WHEN telegram_login_rate_limits.window_start<? THEN excluded.window_start ELSE telegram_login_rate_limits.window_start END").bind(ipHash,windowStart,windowStart,windowStart).run();
  const rate=await env.TELEGRAM_DB.prepare("SELECT request_count FROM telegram_login_rate_limits WHERE ip_hash=?").bind(ipHash).first();
  if((rate?.request_count||0)>8)return json({error:"Too many login attempts. Please wait a few minutes and try again."},429);
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
