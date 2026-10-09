// CricZone All page feed API — Cloudflare Pages Function
// Keeps the upstream feed URL on the server side instead of exposing it in page JavaScript.

const UPSTREAM_FEED = "https://raw.githubusercontent.com/darkbyteprojects/iptv_png/refs/heads/main/provider_2/live_events.json";

export async function onRequestGet() {
  try {
    const upstream = await fetch(UPSTREAM_FEED, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 30, cacheEverything: true }
    });

    if (!upstream.ok) {
      return Response.json(
        { error: "Live events feed is temporarily unavailable" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await upstream.text();

    try {
      JSON.parse(body);
    } catch {
      return Response.json(
        { error: "Live events feed returned invalid JSON" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return Response.json(
      { error: "Unable to reach live events feed" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
