// ============================================================
// CRICZONE - CLOUDFLARE PAGES CHANNEL API
// ============================================================

const FEEDS = {
    sports: "https://sonujson-v5.pages.dev/Data/sports.json",
    directory: "https://allrounder3-0.pages.dev/id.json",
    select: [
        "https://cdn.jsdelivr.net/gh/sportlive18/jio-tv-auto-update-playlist@main/jtv2.json",
        "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/main/jtv2.json"
    ]
};

const ALLOWED_ORIGINS = new Set([
    "https://criczoneall.vercel.app",
    "https://criczone.pages.dev"
]);

function isAllowedOrigin(request, origin) {

    if (!origin) {
        return true;
    }

    if (origin && (ALLOWED_ORIGINS.has(origin) || (() => { try { return new URL(request.url).origin === origin; } catch { return false; } })())) {
        return true;
    }

    try {
        return new URL(request.url).origin === origin;
    } catch {
        return false;
    }
}

function corsHeaders(origin, request) {
    const headers = {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "Vary": "Origin"
    };

    if (origin && (ALLOWED_ORIGINS.has(origin) || (() => { try { return new URL(request.url).origin === origin; } catch { return false; } })())) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Accept, Content-Type";
        headers["Access-Control-Max-Age"] = "86400";
    }

    return headers;
}


// ============================================================
// OPTIONS
// ============================================================

export async function onRequestOptions(context) {

    const request = context.request;

    const origin =
        request.headers.get("Origin") || "";

    if (!isAllowedOrigin(context.request, origin)) {
        return new Response(
            JSON.stringify({
                error: "Forbidden origin"
            }),
            {
                status: 403,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders(origin, request)
                }
            }
        );
    }

    return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, request)
    });
}


// ============================================================
// GET /api/channels?feed=sports
// ============================================================

async function handleGet(context) {

    const request = context.request;

    const origin =
        request.headers.get("Origin") || "";

    const url =
        new URL(request.url);

    const feedName =
        url.searchParams.get("feed") || "sports";

    const feedUrl =
        FEEDS[feedName];


    if (!isAllowedOrigin(request, origin)) {
        return new Response(
            JSON.stringify({
                error: "Forbidden origin"
            }),
            {
                status: 403,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    ...corsHeaders(origin, request)
                }
            }
        );
    }


    // ----------------------------------------------------------
    // Invalid feed
    // ----------------------------------------------------------

    if (!feedUrl) {
        return new Response(
            JSON.stringify({
                error: "Unknown feed"
            }),
            {
                status: 400,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    ...corsHeaders(origin, request)
                }
            }
        );
    }


    // ----------------------------------------------------------
    // Fetch channel feed
    // ----------------------------------------------------------

    try {

        // Try the CDN mirror first, then GitHub Raw to tolerate transient outages.
        const candidates = Array.isArray(feedUrl) ? feedUrl : [feedUrl];
        let body = "";
        let lastFailure = "Channel feed unavailable";

        for (const candidate of candidates) {
            try {
                const upstream = await fetch(candidate, {
                    headers: { "Accept": "application/json" },
                    cf: { cacheTtl: 30, cacheEverything: true },
                    signal: AbortSignal.timeout(10000)
                });
                if (!upstream.ok) {
                    lastFailure = `Upstream returned HTTP ${upstream.status}`;
                    continue;
                }
                const candidateBody = await upstream.text();
                try {
                    JSON.parse(candidateBody);
                    body = candidateBody;
                    break;
                } catch {
                    lastFailure = "Upstream returned invalid JSON";
                }
            } catch (error) {
                lastFailure = String(error?.message || error || "Upstream request failed");
            }
        }

        if (!body) {
            console.error("Select/channel feed unavailable:", lastFailure);
            return new Response(
                JSON.stringify({ error: "Channel feed unavailable", detail: lastFailure }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        ...corsHeaders(origin, request)
                    }
                }
            );
        }


        // ------------------------------------------------------
        // Return JSON
        // ------------------------------------------------------

        return new Response(
            body,
            {
                status: 200,
                headers: {
                    "Content-Type":
                        "application/json; charset=utf-8",

                    ...corsHeaders(origin, request)
                }
            }
        );

    } catch (error) {

        console.error(
            "Channel feed proxy failed:",
            error
        );

        return new Response(
            JSON.stringify({
                error: "Channel feed unavailable"
            }),
            {
                status: 502,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    ...corsHeaders(origin, request)
                }
            }
        );
    }
      }


// Single Pages entry point: dispatch methods explicitly.
export async function onRequest(context) {
  if (context.request.method === "GET") return handleGet(context);
  if (context.request.method === "OPTIONS") return onRequestOptions(context);
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
