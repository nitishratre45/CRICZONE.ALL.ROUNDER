// GET /api/admin/telegram-members
// Requires Cloudflare secrets ADMIN_DASHBOARD_KEY and a D1 binding TELEGRAM_DB.
export async function onRequestGet({ request, env }) {
  const supplied = request.headers.get("Authorization") || "";
  if (!env.ADMIN_DASHBOARD_KEY || !safeEqual(supplied, "Bearer " + env.ADMIN_DASHBOARD_KEY)) {
    return json({ ok: false, error: "Unauthorized. Configure ADMIN_DASHBOARD_KEY in Cloudflare Production secrets." }, 401);
  }
  if (!env.TELEGRAM_DB) {
    return json({ ok: false, error: "Database is not configured. Create a D1 database, bind it as TELEGRAM_DB, and run schema.sql." }, 503);
  }
  try {
    const summary = await env.TELEGRAM_DB.prepare(
      "SELECT COUNT(*) AS verified_users, COUNT(DISTINCT telegram_id) AS unique_users, MAX(verified_at) AS last_verified FROM telegram_members"
    ).first();
    const rows = await env.TELEGRAM_DB.prepare(
      "SELECT telegram_id, first_name, username, membership_status, verified_at FROM telegram_members ORDER BY verified_at DESC LIMIT 500"
    ).all();
    let channelMembers = null;
    if (env.BOT_TOKEN) {
      try {
        const tg = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMemberCount?chat_id=%40criczonelive");
        const data = await tg.json();
        if (tg.ok && data.ok) channelMembers = data.result;
      } catch {}
    }
    return json({
      ok: true,
      summary: summary || {},
      channel_members: channelMembers,
      bot_configured: Boolean(env.BOT_TOKEN),
      configuration_warnings: [
        ...(!env.BOT_TOKEN ? ["BOT_TOKEN is missing in Cloudflare Production secrets; channel member count cannot be fetched."] : []),
        ...((summary?.unique_users || 0) === 0 ? ["No successful membership verifications have been saved yet. Existing Telegram subscribers are not automatically imported into this database."] : [])
      ],
      users: rows.results || []
    }, 200);
  } catch (error) {
    return json({ ok: false, error: "Could not read dashboard data. Check that schema.sql has been applied." }, 500);
  }
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }});
}
