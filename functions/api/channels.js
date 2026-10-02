// ============================================================
// CRICZONE - CLOUDFLARE PAGES CHANNEL API
// ============================================================

const FEEDS = {
    sports: "https://sonujson-v5.pages.dev/Data/sports.json",
    directory: "https://allrounderid2.pages.dev/id.json",
    select: "https://raw.githubusercontent.com/sportlive18/playlist/refs/heads/main/jtv2.json"
};

const ALLOWED_ORIGINS = new Set([
    "https://criczoneall.vercel.app",
    "https://criczone.pages.dev"
]);

function corsHeaders(origin) {
    const headers = {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "Vary": "Origin"
    };

    if (ALLOWED_ORIGINS.has(origin)) {
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

    const origin =
        context.request.headers.get("Origin") || "";

    if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response(
            JSON.stringify({
                error: "Forbidden origin"
            }),
            {
                status: 403,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders(origin)
                }
            }
        );
    }

    return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
    });
}


// ============================================================
// GET /api/channels?feed=sports
// ============================================================

export async function onRequestGet(context) {

    const request = context.request;

    const origin =
        request.headers.get("Origin") || "";

    const url =
        new URL(request.url);

    const feedName =
        url.searchParams.get("feed") || "sports";

    const feedUrl =
        FEEDS[feedName];


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
                    ...corsHeaders(origin)
                }
            }
        );
    }


    // ----------------------------------------------------------
    // Fetch channel feed
    // ----------------------------------------------------------

    try {

        const upstream =
            await fetch(feedUrl, {
                headers: {
                    "Accept": "application/json"
                }
            });


        // ------------------------------------------------------
        // Upstream error
        // ------------------------------------------------------

        if (!upstream.ok) {

            return new Response(
                JSON.stringify({
                    error: "Channel feed unavailable"
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        ...corsHeaders(origin)
                    }
                }
            );
        }


        // ------------------------------------------------------
        // Read response
        // ------------------------------------------------------

        const body =
            await upstream.text();


        // ------------------------------------------------------
        // Validate JSON
        // ------------------------------------------------------

        try {

            JSON.parse(body);

        } catch {

            return new Response(
                JSON.stringify({
                    error: "Invalid channel feed"
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        ...corsHeaders(origin)
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

                    ...corsHeaders(origin)
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
                    ...corsHeaders(origin)
                }
            }
        );
    }
      }
