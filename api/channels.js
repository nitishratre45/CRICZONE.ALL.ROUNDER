// ============================================================
// CRICZONE - CHANNEL API
// Vercel + Cloudflare multi-domain version
// ============================================================

const ALLOWED_HOSTS = [
    "criczoneall.vercel.app",
    "criczone.pages.dev"
];

const ALLOWED_ORIGINS = [
    "https://criczoneall.vercel.app",
    "https://criczone.pages.dev"
];


// ============================================================
// CHANNEL FEEDS
// ============================================================

const FEEDS = {
    sports: "https://sonujson-v5.pages.dev/Data/sports.json",
    directory: "https://allrounder3-0.pages.dev/id.json",
    select: "https://raw.githubusercontent.com/sportlive18/playlist/refs/heads/main/jtv2.json"
};


// ============================================================
// GET HOST
// ============================================================

function getRequestHost(request) {

    const forwardedHost =
        request.headers["x-forwarded-host"] ||
        request.headers.host ||
        "";

    return String(forwardedHost)
        .split(",")[0]
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, "");
}


// ============================================================
// GET ORIGIN
// ============================================================

function getRequestOrigin(request) {

    const origin = request.headers.origin;

    if (!origin) {
        return "";
    }

    return String(origin)
        .trim()
        .replace(/\/$/, "");
}


// ============================================================
// GET REFERER ORIGIN
// ============================================================

function getRefererOrigin(request) {

    const referer = request.headers.referer;

    if (!referer) {
        return "";
    }

    try {

        return new URL(referer).origin;

    } catch (error) {

        return "";
    }
}


// ============================================================
// CHECK FIRST-PARTY REQUEST
// ============================================================

function isFirstPartyRequest(request) {

    const host =
        getRequestHost(request);

    const origin =
        getRequestOrigin(request);

    const refererOrigin =
        getRefererOrigin(request);

    const fetchSite =
        request.headers["sec-fetch-site"] || "";


    // Keep the existing allowlist exactly as-is.
    if (ALLOWED_HOSTS.includes(host)) {

        if (origin) {
            return ALLOWED_ORIGINS.includes(origin);
        }

        return (
            fetchSite === "same-origin" ||
            ALLOWED_ORIGINS.includes(refererOrigin)
        );
    }


    // Also support the same API when it is deployed behind
    // another HTTPS/custom domain, without changing any feed URL.
    // Only the API's own origin/host is accepted; cross-site
    // browser requests are still rejected.
    if (origin) {

        try {

            const parsedOrigin =
                new URL(origin);

            if (
                parsedOrigin.protocol === "https:" &&
                parsedOrigin.host === host
            ) {
                return true;
            }

        } catch (error) {

            return false;
        }

    }


    return (
        fetchSite === "same-origin" &&
        String(request.headers.origin || "") === ""
    );
}


// ============================================================
// MAIN HANDLER
// ============================================================

module.exports = async function handler(
    request,
    response
) {

    const origin =
        getRequestOrigin(request);


    // ========================================================
    // CACHE
    // ========================================================

    response.setHeader(
        "Vary",
        "Origin"
    );

    response.setHeader(
        "Cache-Control",
        "public, s-maxage=30, stale-while-revalidate=60"
    );


    // ========================================================
    // CORS
    // ========================================================

    if (
        ALLOWED_ORIGINS.includes(origin)
    ) {

        response.setHeader(
            "Access-Control-Allow-Origin",
            origin
        );

        response.setHeader(
            "Access-Control-Allow-Methods",
            "GET, OPTIONS"
        );

        response.setHeader(
            "Access-Control-Allow-Headers",
            "Accept, Content-Type"
        );

        response.setHeader(
            "Access-Control-Max-Age",
            "86400"
        );
    }


    // ========================================================
    // PREFLIGHT
    // ========================================================

    if (request.method === "OPTIONS") {

        if (
            !ALLOWED_ORIGINS.includes(origin)
        ) {

            return response
                .status(403)
                .json({
                    error: "Forbidden origin"
                });
        }

        return response
            .status(204)
            .end();
    }


    // ========================================================
    // FIRST-PARTY CHECK
    // ========================================================

    if (!isFirstPartyRequest(request)) {

        return response
            .status(403)
            .json({
                error: "Forbidden"
            });
    }


    // ========================================================
    // ONLY GET
    // ========================================================

    if (request.method !== "GET") {

        response.setHeader(
            "Allow",
            "GET, OPTIONS"
        );

        return response
            .status(405)
            .json({
                error: "Method not allowed"
            });
    }


    // ========================================================
    // GET FEED
    // ========================================================

    const feedName =
        Array.isArray(request.query?.feed)
            ? request.query.feed[0]
            : request.query?.feed;


    // ========================================================
    // FIND FEED
    // ========================================================

    const feedUrl =
        FEEDS[feedName];


    if (!feedUrl) {

        return response
            .status(400)
            .json({
                error: "Unknown feed"
            });
    }


    // ========================================================
    // FETCH CHANNEL FEED
    // ========================================================

    try {

        const upstream =
            await fetch(
                feedUrl,
                {
                    headers: {
                        Accept: "application/json"
                    },

                    signal:
                        AbortSignal.timeout(10000)
                }
            );


        // ====================================================
        // UPSTREAM ERROR
        // ====================================================

        if (!upstream.ok) {

            return response
                .status(502)
                .json({
                    error:
                        "Channel feed unavailable"
                });
        }


        // ====================================================
        // READ DATA
        // ====================================================

        const body =
            await upstream.text();


        // ====================================================
        // VALIDATE JSON
        // ====================================================

        try {

            JSON.parse(body);

        } catch (error) {

            return response
                .status(502)
                .json({
                    error:
                        "Invalid channel feed"
                });
        }


        // ====================================================
        // SEND JSON
        // ====================================================

        response.setHeader(
            "Content-Type",
            "application/json; charset=utf-8"
        );

        return response
            .status(200)
            .send(body);


    } catch (error) {

        console.error(
            "Channel feed proxy failed:",
            error
        );


        return response
            .status(502)
            .json({
                error:
                    "Channel feed unavailable"
            });
    }
};
