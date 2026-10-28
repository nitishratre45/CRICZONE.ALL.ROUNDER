// GET/POST /api/admin/telegram-categories
// Admin-managed category links shown by the Telegram bot after live membership verification.
export async function onRequest({ request, env }) {
  const supplied = request.headers.get("Authorization") || "";
  if (!env.ADMIN_DASHBOARD_KEY || !safeEqual(supplied, "Bearer " + env.ADMIN_DASHBOARD_KEY)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }
  if (!env.TELEGRAM_DB) return json({ ok: false, error: "TELEGRAM_DB database binding is missing." }, 503);
  try {
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_category_links (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, channel_name TEXT NOT NULL, url TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
    if (request.method === "GET") {
      const rows = await env.TELEGRAM_DB.prepare("SELECT id, category, channel_name, url FROM telegram_category_links ORDER BY category, channel_name").all();
      return json({ ok: true, links: rows.results || [] });
    }
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON." }, 400); }
    if (!Array.isArray(body.links) || body.links.length > 200) return json({ ok: false, error: "Provide up to 200 channel links." }, 400);
    const allowed = new Set(["sony", "fancode", "star-sports", "willow"]);
    const clean = [];
    for (const item of body.links) {
      const category = String(item?.category || "").trim().toLowerCase();
      const channel_name = String(item?.channel_name || "").trim().slice(0, 100);
      const rawUrl = String(item?.url || "").trim();
      if (!allowed.has(category) || !channel_name || !rawUrl) return json({ ok: false, error: "Each row needs a valid category, channel name, and URL." }, 400);
      let u;
      try { u = new URL(rawUrl); } catch { return json({ ok: false, error: "One or more URLs are invalid." }, 400); }
      if (u.protocol !== "https:" || !["criczone.pages.dev", "criczone.online"].includes(u.hostname.toLowerCase())) {
        return json({ ok: false, error: "Links must use https://criczone.pages.dev or https://criczone.online." }, 400);
      }
      clean.push({ category, channel_name, url: u.href });
    }
    await env.TELEGRAM_DB.prepare("DELETE FROM telegram_category_links").run();
    for (const item of clean) {
      await env.TELEGRAM_DB.prepare("INSERT INTO telegram_category_links (category, channel_name, url, updated_at) VALUES (?, ?, ?, ?)").bind(item.category, item.channel_name, item.url, new Date().toISOString()).run();
    }
    return json({ ok: true, saved: clean.length });
  } catch (error) {
    console.error("Telegram category link settings failed:", error?.message || error);
    return json({ ok: false, error: "Could not save category links." }, 500);
  }
}
function safeEqual(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
