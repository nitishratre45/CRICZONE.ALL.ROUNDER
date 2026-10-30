export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html") || context.request.method !== "GET") return response;
  const script = `<script src="/assets/js/telegram-membership-gate.js?v=2" defer></script>`;
  return new HTMLRewriter().on("body", { element(element) { element.append(script, { html: true }); } }).transform(response);
}
