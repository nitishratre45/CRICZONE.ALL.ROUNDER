export async function onRequestGet(context) {
  const upstream = "https://cinearena-movies-api.asifadmincinearena.workers.dev/";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(upstream, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
      cf: { cacheTtl: 60, cacheEverything: true }
    });
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Movie catalogue upstream returned HTTP " + response.status }), {
        status: 502, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); }
    catch (_) {
      return new Response(JSON.stringify({ error: "Movie catalogue returned invalid JSON" }), {
        status: 502, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    const rows = Array.isArray(data) ? data :
      (data && (Array.isArray(data.matches) ? data.matches :
       Array.isArray(data.movies) ? data.movies :
       Array.isArray(data.data) ? data.data :
       Array.isArray(data.results) ? data.results : null));
    if (!rows) {
      return new Response(JSON.stringify({ error: "Movie catalogue format is not recognized" }), {
        status: 502, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    const message = error && error.name === "AbortError" ? "Movie catalogue request timed out" : "Movie catalogue is temporarily unavailable";
    return new Response(JSON.stringify({ error: message }), {
      status: 502, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  } finally {
    clearTimeout(timeout);
  }
}