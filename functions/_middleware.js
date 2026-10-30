import { onRequest as channels } from "./api/channels.js";
import { onRequest as telegramStart } from "./api/telegram/start.js";
import { onRequest as telegramSetup } from "./api/telegram/setup.js";
import { onRequestPost as telegramWebhook } from "./api/telegram/webhook.js";
import { onRequestGet as telegramComplete } from "./api/telegram/complete.js";
import { onRequestGet as telegramSession } from "./api/telegram/session.js";

export async function onRequest(context) {
  const { request } = context;
  const path = new URL(request.url).pathname;
  const method = request.method;

  // Explicit API dispatch protects API endpoints from the static SPA fallback.
  if (path === "/api/channels") return channels(context);
  if (path === "/api/telegram/start") return telegramStart(context);
  if (path === "/api/telegram/setup") return telegramSetup(context);
  if (path === "/api/telegram/webhook" && method === "POST") return telegramWebhook(context);
  if (path === "/api/telegram/complete" && method === "GET") return telegramComplete(context);
  if (path === "/api/telegram/session" && method === "GET") return telegramSession(context);

  const response = await context.next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html") || method !== "GET") return response;
  const script = `<script src="/assets/js/telegram-membership-gate.js?v=2" defer></script>`;
  return new HTMLRewriter().on("body", { element(element) { element.append(script, { html: true }); } }).transform(response);
}
