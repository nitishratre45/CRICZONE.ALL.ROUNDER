const cors = {
  "Access-Control-Allow-Origin": "https://criczone.pages.dev",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, max-age=0" }
  });
}

async function getStats(env, now) {
  const [total, active] = await Promise.all([
    env.DB.prepare("SELECT total_visits FROM visitor_totals WHERE id = 1").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM visitor_sessions WHERE last_seen >= ?").bind(now - 75).first()
  ]);
  return {
    totalVisits: Number(total?.total_visits || 0),
    liveVisitors: Number(active?.count || 0),
    updatedAt: now
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (origin && origin !== "https://criczone.pages.dev") return reply({ error: "Origin not allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (request.method === "GET" && url.pathname === "/api/stats") {
      try {
        return reply(await getStats(env, Math.floor(Date.now() / 1000)));
      } catch (error) {
        console.error("[visitor-stats] stats query failed", error);
        return reply({ error: "Stats temporarily unavailable" }, 503);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/visit") {
      try {
        const body = await request.json();
        const visitorId = String(body?.visitorId || "");
        if (!/^[a-zA-Z0-9_-]{12,80}$/.test(visitorId)) return reply({ error: "Invalid visitor id" }, 400);

        const now = Math.floor(Date.now() / 1000);
        const sessionCutoff = now - 1800;
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO visitor_sessions(visitor_id, first_seen, last_seen) VALUES(?,?,?) " +
            "ON CONFLICT(visitor_id) DO UPDATE SET " +
            "first_seen = CASE WHEN visitor_sessions.last_seen < ? THEN excluded.first_seen ELSE visitor_sessions.first_seen END, " +
            "last_seen = excluded.last_seen"
          ).bind(visitorId, now, now, sessionCutoff),
          env.DB.prepare(
            "INSERT OR IGNORE INTO visitor_visit_events(visitor_id, session_started_at) " +
            "SELECT visitor_id, first_seen FROM visitor_sessions WHERE visitor_id = ?"
          ).bind(visitorId)
        ]);

        if (now % 300 < 30) {
          await env.DB.batch([
            env.DB.prepare("DELETE FROM visitor_sessions WHERE last_seen < ?").bind(now - 172800),
            env.DB.prepare("DELETE FROM visitor_visit_events WHERE session_started_at < ?").bind(now - 172800)
          ]);
        }
        return reply({ ok: true, ...(await getStats(env, now)) });
      } catch (error) {
        console.error("[visitor-stats] visit write failed", error);
        return reply({ error: "Visit could not be recorded" }, 503);
      }
    }
    return reply({ error: "Not found" }, 404);
  }
};
