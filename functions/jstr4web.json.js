// Compatibility endpoint for the legacy JioTV+ page.
// The page requests /jstr4web.json and expects a JSON array.
// The canonical catalogue endpoint returns { source, total, channels }.
export async function onRequestGet({ request }) {
  try {
    const catalogueUrl = new URL("/api/channel-catalog", request.url);
    const upstream = await fetch(catalogueUrl.toString(), {
      headers: { "Accept": "application/json" },
      cf: { cacheTtl: 60 }
    });

    if (!upstream.ok) {
      return Response.json(
        { error: "Channel catalogue unavailable", status: upstream.status },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = await upstream.json();
    const rows = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload.channels) ? payload.channels : null);

    if (!rows) {
      return Response.json(
        { error: "Unexpected channel catalogue format" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Preserve the legacy page's array contract and fields it reads.
    const channels = rows.map((item, index) => {
      const streamUrl = String(item.url || item.stream_url || item.mpd || "");
      return {
        id: String(item.id || item.tvg_id || "channel-" + (index + 1)),
        name: String(item.name || item.title || "Unnamed channel"),
        category: String(item.category || item.group || "Others"),
        language: String(item.language || ""),
        logo: String(item.logo || item.tvg_logo || ""),
        url: streamUrl,
        mpd: streamUrl
      };
    }).filter(item => item.name);

    return Response.json(channels, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return Response.json(
      { error: "Could not load channel JSON" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
