// GET /api/admin/telegram-members - private bot/channel activity dashboard (no website login records).
export async function onRequestGet({ request, env }) {
  const supplied = request.headers.get("Authorization") || "";
  if (!env.ADMIN_DASHBOARD_KEY || !safeEqual(supplied, "Bearer " + env.ADMIN_DASHBOARD_KEY)) return json({ ok:false, error:"Unauthorized. Configure ADMIN_DASHBOARD_KEY in Cloudflare Production secrets." },401);
  if (!env.TELEGRAM_DB) return json({ ok:false, error:"TELEGRAM_DB database binding is missing." },503);
  try {
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_bot_starts (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT, language_code TEXT, start_payload TEXT, started_at TEXT NOT NULL, chat_type TEXT)").run();
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_channel_click_tokens (token TEXT PRIMARY KEY, telegram_id TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT, created_at TEXT NOT NULL, clicked_at TEXT)").run();
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_channel_activity (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL, first_name TEXT, last_name TEXT, username TEXT, event_type TEXT NOT NULL, event_at TEXT NOT NULL, old_status TEXT, new_status TEXT)").run();
    await env.TELEGRAM_DB.prepare("CREATE TABLE IF NOT EXISTS telegram_verified_members (telegram_id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, verified_at TEXT NOT NULL, channel_status TEXT NOT NULL, return_url TEXT)").run();
    const verifiedSummary = await env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS total_verified, MAX(verified_at) AS last_verified FROM telegram_verified_members").first();
    const verifiedMembers = await env.TELEGRAM_DB.prepare("SELECT telegram_id, first_name, last_name, username, verified_at, channel_status, return_url FROM telegram_verified_members ORDER BY verified_at DESC LIMIT 1000").all();
    const startsSummary = await env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS total_starts, COUNT(DISTINCT telegram_id) AS unique_starters, MAX(started_at) AS last_started FROM telegram_bot_starts WHERE COALESCE(start_payload, '') = ''").first();
    const starts = await env.TELEGRAM_DB.prepare("SELECT telegram_id, first_name, last_name, username, language_code, started_at, chat_type FROM telegram_bot_starts WHERE COALESCE(start_payload, '') = '' ORDER BY started_at DESC LIMIT 500").all();
    const clicksSummary = await env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS total_clicks, COUNT(DISTINCT telegram_id) AS unique_clickers, MAX(clicked_at) AS last_clicked FROM telegram_channel_click_tokens WHERE clicked_at IS NOT NULL").first();
    const clicks = await env.TELEGRAM_DB.prepare("SELECT telegram_id, first_name, last_name, username, created_at, clicked_at FROM telegram_channel_click_tokens WHERE clicked_at IS NOT NULL ORDER BY clicked_at DESC LIMIT 500").all();
    const joinsSummary = await env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS total_joins, COUNT(DISTINCT telegram_id) AS unique_joiners, MAX(event_at) AS last_joined FROM telegram_channel_activity WHERE event_type = 'joined'").first();
    const activity = await env.TELEGRAM_DB.prepare("SELECT telegram_id, first_name, last_name, username, event_type, event_at, old_status, new_status FROM telegram_channel_activity ORDER BY event_at DESC LIMIT 500").all();
    let channelMembers = null;
    if (env.BOT_TOKEN) { try { const tg=await fetch("https://api.telegram.org/bot"+env.BOT_TOKEN+"/getChatMemberCount?chat_id=%40criczonelive"); const data=await tg.json(); if(tg.ok&&data.ok) channelMembers=data.result; } catch {} }
    return json({ok:true,channel_members:channelMembers,verified_summary:verifiedSummary||{},verified_members:verifiedMembers.results||[],bot_start_summary:startsSummary||{},bot_starts:starts.results||[],channel_click_summary:clicksSummary||{},channel_clicks:clicks.results||[],channel_join_summary:joinsSummary||{},channel_activity:activity.results||[],membership_updates_enabled:true},200);
  } catch(error) { console.error("Admin activity dashboard query failed:",error?.message||error); return json({ok:false,error:"Could not load activity. Check the D1 database and Telegram webhook."},500); }
}
function safeEqual(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
