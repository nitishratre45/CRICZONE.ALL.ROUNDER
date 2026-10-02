// ============================================================
// CRICZONE CHANNEL API
// Multi-domain / CORS fixed version
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
    directory: "https://allrounderid2.pages.dev/id.json",
    select: "https://raw.githubusercontent.com/sportlive18/playlist/refs/heads/main/jtv2.json"
};


// ============================================================
// GET REQUEST HOST
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
// GET REQUEST ORIGIN
// ============================================================

function getRequestOrigin(request) {

    const origin = request.headers.origin;

    if (origin) {
        return String(origin).trim().replace(/\/$/, "");
    }

    return "";
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
// FIRST PARTY / ALLOWED REQUEST CHECK
// ============================================================

function isFirstPartyRequest(request) {

    const host = getRequestHost(request);

    const origin = getRequestOrigin(request);

    const refererOrigin = getRefererOrigin(request);

    const fetchSite =
        request.headers["sec-fetch-site"] || "";

    const hostAllowed =
        ALLOWED_HOSTS.includes(host);

    const originAllowed =
        ALLOWED_ORIGINS.includes(origin);

    const refererAllowed =
        ALLOWED_ORIGINS.includes(refererOrigin);


    // Host of API itself must be one of our allowed hosts
    if (!hostAllowed) {
        return false;
    }


    // Normal browser request with Origin
    if (origin) {
        return originAllowed;
    }


    // Requests without Origin
    return (
        fetchSite === "same-origin" ||
        refererAllowed
    );
}


// ============================================================
// MAIN API HANDLER
// ============================================================

module.exports = async function handler(request, response) {

    const origin = getRequestOrigin(request);


    // --------------------------------------------------------
    // CACHE
    // --------------------------------------------------------

    response.setHeader(
        "Vary",
        "Origin"
    );

    response.setHeader(
        "Cache-Control",
        "public, s-maxage=30, stale-while-revalidate=60"
    );


    // --------------------------------------------------------
    // CORS
    // --------------------------------------------------------

    if (ALLOWED_ORIGINS.includes(origin)) {

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


    // --------------------------------------------------------
    // OPTIONS / PREFLIGHT
    // --------------------------------------------------------

    if (request.method === "OPTIONS") {

        if (!ALLOWED_ORIGINS.includes(origin)) {

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


    // --------------------------------------------------------
    // DOMAIN / ORIGIN SECURITY
    // --------------------------------------------------------

    if (!isFirstPartyRequest(request)) {

        return response
            .status(403)
            .json({
                error: "Forbidden"
            });
    }


    // --------------------------------------------------------
    // ONLY GET ALLOWED
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // GET FEED NAME
    // --------------------------------------------------------

    const feedName =
        Array.isArray(request.query?.feed)
            ? request.query.feed[0]
            : request.query?.feed;


    // --------------------------------------------------------
    // FIND FEED URL
    // --------------------------------------------------------

    const feedUrl =
        FEEDS[feedName];


    if (!feedUrl) {

        return response
            .status(400)
            .json({
                error: "Unknown feed"
            });
    }


    // --------------------------------------------------------
    // FETCH UPSTREAM CHANNEL FEED
    // --------------------------------------------------------

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


        // ----------------------------------------------------
        // UPSTREAM ERROR
        // ----------------------------------------------------

        if (!upstream.ok) {

            return response
                .status(502)
                .json({
                    error: "Channel feed unavailable"
                });
        }


        // ----------------------------------------------------
        // READ RESPONSE
        // ----------------------------------------------------

        const body =
            await upstream.text();


        // ----------------------------------------------------
        // VALIDATE JSON
        // ----------------------------------------------------

        try {

            JSON.parse(body);

        } catch (jsonError) {

            return response
                .status(502)
                .json({
                    error: "Invalid channel feed"
                });
        }


        // ----------------------------------------------------
        // RESPONSE
        // ----------------------------------------------------

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
                error: "Channel feed unavailable"
            });
    }
};
