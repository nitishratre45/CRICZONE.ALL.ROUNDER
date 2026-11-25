const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestGet({ request, env }) {
  const expected = String(env.TELEGRAM_ADMIN_DASHBOARD_KEY || "");
  if (!expected) return json({ ok: false, error: "Telegram dashboard key is not configured" }, 503);
  const authorization = request.headers.get("Authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!safeEqual(supplied, expected)) return json({ ok: false, error: "Unauthorized. Enter the dashboard access key." }, 401);
  if (!env.TELEGRAM_DB) return json({ ok: false, error: "Telegram D1 database binding is unavailable" }, 503);

  const url = new URL(request.url);
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
  const offset = (page - 1) * limit;

  try {
    const [total, active, inactive, users] = await Promise.all([
      env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS count FROM telegram_broadcast_users").first(),
      env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS count FROM telegram_broadcast_users WHERE active = 1").first(),
      env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS count FROM telegram_broadcast_users WHERE active = 0").first(),
      env.TELEGRAM_DB.prepare(
        "SELECT user_id, first_name, last_name, username, started_at, last_seen_at, active FROM telegram_broadcast_users ORDER BY started_at DESC, user_id ASC LIMIT ? OFFSET ?"
      ).bind(limit, offset).all()
    ]);
    const totalRegistered = Number(total?.count || 0);
    const rows = (users.results || []).map(row => ({
      user_id: String(row.user_id || ""),
      first_name: String(row.first_name || ""),
      last_name: String(row.last_name || ""),
      username: String(row.username || ""),
      started_at: Number(row.started_at || 0),
      last_seen_at: Number(row.last_seen_at || 0),
      status: Number(row.active) === 1 ? "active" : "blocked_or_inactive"
    }));
    return json({
      ok: true,
      total_registered: totalRegistered,
      active: Number(active?.count || 0),
      inactive: Number(inactive?.count || 0),
      users: rows,
      page,
      limit,
      has_more: offset + rows.length < totalRegistered,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Telegram admin stats query failed", error);
    return json({ ok: false, error: "Unable to read Telegram aggregate statistics" }, 500);
  }
}
