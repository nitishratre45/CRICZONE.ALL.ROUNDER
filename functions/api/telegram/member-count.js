const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=30",
    "Access-Control-Allow-Origin": "*"
  }
});

let cachedCount = null;
let cachedAt = 0;

export async function onRequestGet({ env }) {
  const chatId = "-1003970810524";
  if (!env.BOT_TOKEN) {
    return json({ ok: false, error: "Telegram bot is not configured" }, 503);
  }

  const now = Date.now();
  if (cachedCount !== null && now - cachedAt < 60_000) {
    return json({ ok: true, count: cachedCount, cached: true });
  }

  try {
    const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/getChatMemberCount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
      signal: AbortSignal.timeout(7000)
    });
    const result = await response.json();
    if (!response.ok || !result.ok || !Number.isFinite(Number(result.result))) {
      console.error("Telegram member count request failed", result);
      return json({ ok: false, error: "Unable to retrieve Telegram member count" }, 502);
    }

    cachedCount = Number(result.result);
    cachedAt = now;
    return json({ ok: true, count: cachedCount, cached: false });
  } catch (error) {
    console.error("Telegram member count endpoint failed", error);
    return json({ ok: false, error: "Telegram count service unavailable" }, 502);
  }
}
