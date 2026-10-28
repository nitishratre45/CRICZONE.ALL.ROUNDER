import { validSession } from "./session.js";
// GET/POST /api/admin/telegram-categories
// Admin-managed Telegram categories and their channel links.
const DEFAULT_CATEGORIES = [
  { slug: "sony", name: "Sony", emoji: "📺" },
  { slug: "fancode", name: "FanCode", emoji: "🏏" },
  { slug: "star-sports", name: "Star Sports", emoji: "⭐" },
  { slug: "willow", name: "Willow", emoji: "🇺🇸" }
];
export async function onRequest({ request, env }) {
  const supplied = request.headers.get("Authorization") || "";
  const authorized = !!env.ADMIN_DASHBOARD_KEY && (safeEqual(supplied, "Bearer " + env.ADMIN_DASHBOARD_KEY) || await validSession(request, env.ADMIN_DASHBOARD_KEY));
  if (!authorized) return json({ ok:false, error:"Unauthorized. Sign in again or check the Production admin key." },401);
  if (!env.TELEGRAM_DB) return json({ ok: false, error: "TELEGRAM_DB database binding is missing." }, 503);
  try {
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_category_links (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, channel_name TEXT NOT NULL, url TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_categories (slug TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '📁', created_at TEXT NOT NULL)").run();
    const existing = await env.TELEGRAM_DB.prepare("SELECT slug FROM telegram_categories LIMIT 1").first();
    if (!existing) for (const c of DEFAULT_CATEGORIES) await env.TELEGRAM_DB.prepare("INSERT OR IGNORE INTO telegram_categories (slug,name,emoji,created_at) VALUES (?,?,?,?)").bind(c.slug,c.name,c.emoji,new Date().toISOString()).run();
    if (request.method === "GET") {
      const [cats, rows] = await Promise.all([
        env.TELEGRAM_DB.prepare("SELECT slug,name,emoji FROM telegram_categories ORDER BY name COLLATE NOCASE").all(),
        env.TELEGRAM_DB.prepare("SELECT id,category,channel_name,url FROM telegram_category_links ORDER BY category,channel_name").all()
      ]);
      return json({ ok: true, categories: cats.results || [], links: rows.results || [] });
    }
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON." }, 400); }
    if (!Array.isArray(body.links) || body.links.length > 200) return json({ ok: false, error: "Provide up to 200 channel links." }, 400);
    let categories;
    if (Array.isArray(body.categories)) {
      if (body.categories.length < 1 || body.categories.length > 30) return json({ ok: false, error: "Create between 1 and 30 categories." }, 400);
      const seen = new Set(); categories = [];
      for (const item of body.categories) {
        const name = String(item?.name || "").trim().slice(0,50);
        const emoji = String(item?.emoji || "📁").trim().slice(0,8) || "📁";
        const slug = String(item?.slug || name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")).trim().toLowerCase();
        if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(slug)) return json({ ok:false,error:"Each category needs a unique name and a-z/0-9 slug." },400);
        seen.add(slug); categories.push({slug,name,emoji});
      }
    } else {
      const result = await env.TELEGRAM_DB.prepare("SELECT slug,name,emoji FROM telegram_categories").all();
      categories = result.results || [];
    }
    const allowed = new Set(categories.map(c => c.slug)), clean = [];
    for (const item of body.links) {
      const category = String(item?.category || "").trim().toLowerCase();
      const channel_name = String(item?.channel_name || "").trim().slice(0,100);
      const rawUrl = String(item?.url || "").trim();
      if (!allowed.has(category) || !channel_name || !rawUrl) return json({ok:false,error:"Each link needs a valid category, channel name, and URL."},400);
      let u; try { u = new URL(rawUrl); } catch { return json({ok:false,error:"One or more URLs are invalid."},400); }
      if (u.protocol !== "https:" || !["criczone.pages.dev","criczone.online"].includes(u.hostname.toLowerCase())) return json({ok:false,error:"Links must use https://criczone.pages.dev or https://criczone.online."},400);
      clean.push({category,channel_name,url:u.href});
    }
    if (Array.isArray(body.categories)) {
      await env.TELEGRAM_DB.prepare("DELETE FROM telegram_categories").run();
      for (const c of categories) await env.TELEGRAM_DB.prepare("INSERT INTO telegram_categories (slug,name,emoji,created_at) VALUES (?,?,?,?)").bind(c.slug,c.name,c.emoji,new Date().toISOString()).run();
      await env.TELEGRAM_DB.prepare("DELETE FROM telegram_category_links").run();
    } else {
      await env.TELEGRAM_DB.prepare("DELETE FROM telegram_category_links").run();
    }
    for (const item of clean) await env.TELEGRAM_DB.prepare("INSERT INTO telegram_category_links (category,channel_name,url,updated_at) VALUES (?,?,?,?)").bind(item.category,item.channel_name,item.url,new Date().toISOString()).run();
    return json({ok:true,saved:clean.length,categories:categories.length});
  } catch (error) {
    console.error("Telegram category settings failed:", error?.message || error);
    return json({ok:false,error:"Could not save category settings."},500);
  }
}
function safeEqual(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
