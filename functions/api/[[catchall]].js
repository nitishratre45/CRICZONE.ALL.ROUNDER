import { onRequest as channels } from "./channels.js";
import { onRequest as telegramStart } from "./telegram/start.js";
import { onRequest as telegramSetup } from "./telegram/setup.js";
import { onRequestPost as telegramWebhook } from "./telegram/webhook.js";
import { onRequestGet as telegramComplete } from "./telegram/complete.js";
import { onRequestGet as telegramSession } from "./telegram/session.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequest(context) {
  const { request } = context;
  const path = new URL(request.url).pathname;
  const method = request.method;
  try {
    if (path === "/api/channels") return await channels(context);
    if (path === "/api/telegram/start") return await telegramStart(context);
    if (path === "/api/telegram/setup") return await telegramSetup(context);
    if (path === "/api/telegram/webhook") {
      if (method === "POST") return await telegramWebhook(context);
      return json({ ok: false, error: "Method not allowed", allowed: ["POST"] }, 405);
    }
    if (path === "/api/telegram/complete") {
      if (method === "GET") return await telegramComplete(context);
      return json({ ok: false, error: "Method not allowed", allowed: ["GET"] }, 405);
    }
    if (path === "/api/telegram/session") {
      if (method === "GET") return await telegramSession(context);
      return json({ ok: false, error: "Method not allowed", allowed: ["GET"] }, 405);
    }
    return json({ ok: false, error: "Unknown API route", path }, 404);
  } catch (error) {
    console.error("CRICZONE API catch-all error", path, method, error);
    return json({ ok: false, error: String(error?.message || error || "Internal API error"), path }, 500);
  }
}
