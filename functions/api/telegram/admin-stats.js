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

  try {
    const [total, active, inactive] = await Promise.all([
      env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS count FROM telegram_broadcast_users").first(),
      env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS count FROM telegram_broadcast_users WHERE active = 1").first(),
      env.TELEGRAM_DB.prepare("SELECT COUNT(*) AS count FROM telegram_broadcast_users WHERE active = 0").first()
    ]);
    return json({
      ok: true,
      total_registered: Number(total?.count || 0),
      active: Number(active?.count || 0),
      inactive: Number(inactive?.count || 0),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Telegram admin stats query failed", error);
    return json({ ok: false, error: "Unable to read Telegram aggregate statistics" }, 500);
  }
}
