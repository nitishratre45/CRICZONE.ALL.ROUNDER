import { onRequest as channels } from "./api/channels.js";
import { onRequest as telegramStart } from "./api/telegram/start.js";
import { onRequest as telegramSetup } from "./api/telegram/setup.js";
import { onRequestPost as telegramWebhook } from "./api/telegram/webhook.js";
import { onRequestGet as telegramComplete } from "./api/telegram/complete.js";
import { onRequestGet as telegramSession } from "./api/telegram/session.js";

const apiError = (error, path, method) => new Response(JSON.stringify({
  ok: false, source: "criczone-pages-middleware", path, method,
  error: String(error?.message || error || "Unknown runtime error")
}), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequest(context) {
  const { request } = context;
  const path = new URL(request.url).pathname;
  const method = request.method;
  try {
    if (path === "/api/channels") return await channels(context);
    if (path === "/api/telegram/start") return await telegramStart(context);
    if (path === "/api/telegram/setup") return await telegramSetup(context);
    if (path === "/api/telegram/webhook" && method === "POST") return await telegramWebhook(context);
    if (path === "/api/telegram/complete" && method === "GET") return await telegramComplete(context);
    if (path === "/api/telegram/session" && method === "GET") return await telegramSession(context);
    const response = await context.next();
    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("text/html") || method !== "GET") return response;
    const script = `<script src="/assets/js/telegram-membership-gate.js?v=3" defer></script>`;
    return new HTMLRewriter().on("body", { element(element) { element.append(script, { html: true }); } }).transform(response);
  } catch (error) {
    console.error("CRICZONE Pages middleware error", path, method, error);
    return apiError(error, path, method);
  }
}
