const ALLOWED_HOST = "criczone.pages.dev";
const ALLOWED_ORIGIN = `https://${ALLOWED_HOST}`;

const FEEDS = {
    sports: "https://sonujson-v5.pages.dev/Data/sports.json",
    directory: "https://allrounderid2.pages.dev/id.json",
    select: "https://raw.githubusercontent.com/sportlive18/playlist/refs/heads/main/jtv2.json"
};

function isFirstPartyRequest(request) {
    const forwardedHost =
        request.headers["x-forwarded-host"] || request.headers.host || "";
    const host = String(forwardedHost)
        .split(",")[0]
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, "");
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const fetchSite = request.headers["sec-fetch-site"];
    let firstPartyReferer = false;

    try {
        firstPartyReferer = new URL(referer).origin === ALLOWED_ORIGIN;
    } catch (error) {}

    return host === ALLOWED_HOST && (
        origin === ALLOWED_ORIGIN ||
        (!origin && (fetchSite === "same-origin" || firstPartyReferer))
    );
}

module.exports = async function handler(request, response) {
    response.setHeader("Vary", "Origin");
    response.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");

    if (!isFirstPartyRequest(request)) {
        return response.status(403).json({ error: "Forbidden" });
    }

    if (request.headers.origin === ALLOWED_ORIGIN) {
        response.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
        response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
    }

    if (request.method === "OPTIONS") {
        return response.status(204).end();
    }

    if (request.method !== "GET") {
        response.setHeader("Allow", "GET, OPTIONS");
        return response.status(405).json({ error: "Method not allowed" });
    }

    const feedName = Array.isArray(request.query?.feed)
        ? request.query.feed[0]
        : request.query?.feed;
    const feedUrl = FEEDS[feedName];

    if (!feedUrl) {
        return response.status(400).json({ error: "Unknown feed" });
    }

    try {
        const upstream = await fetch(feedUrl, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(10000)
        });

        if (!upstream.ok) {
            return response.status(502).json({ error: "Channel feed unavailable" });
        }

        const body = await upstream.text();
        JSON.parse(body);

        response.setHeader("Content-Type", "application/json; charset=utf-8");
        return response.status(200).send(body);
    } catch (error) {
        console.error("Channel feed proxy failed:", error);
        return response.status(502).json({ error: "Channel feed unavailable" });
    }
};
