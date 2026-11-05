export async function onRequest({ request, env }) {
  return new Response(JSON.stringify({
    ok: true,
    service: "criczone-pages-functions",
    path: new URL(request.url).pathname,
    method: request.method,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
