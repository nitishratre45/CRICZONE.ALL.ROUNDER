export async function onRequest() {
  const upstream = "https://aryanstreams.pages.dev/data/sony_m3u8.json";
  try {
    const response = await fetch(upstream, {
      headers: { "Accept": "application/json" },
      cf: { cacheTtl: 60, cacheEverything: true }
    });
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Sony source returned HTTP " + response.status }), {
        status: 502, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" }
      });
    }
    const body = await response.text();
    JSON.parse(body);
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60",
        "access-control-allow-origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Unable to retrieve valid Sony JSON", detail: String(error) }), {
      status: 502, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" }
    });
  }
}