# CricZone17 — Live Cricket Centre

A responsive cricket score dashboard with a Python local server. The browser UI checks the local JSON endpoint every 10 seconds; the server obtains score data from CricketData API.

## Important source note

This project does **not** scrape or republish Indian Express pages. Indian Express's published terms prohibit automated scraping and displaying/storing its content on another platform without permission. Use a provider API you are authorized to access.

## Setup (Android / PyDroid)

1. Open the CricketData website and create your own API key: https://cricketdata.org/
2. Copy \`config.example.json\` to a new file named \`config.json\` in this folder.
3. Put your API key in \`config.json\`. Do not commit that file or share your key.
4. Open \`server.py\` in PyDroid and press Run.
5. Open this address in the same phone's browser: http://127.0.0.1:8765/

Example \`config.json\`:

    {
      "api_key": "YOUR_PRIVATE_API_KEY",
      "poll_seconds": 900
    }

## Refresh behaviour

- Dashboard: checks the local Python server every **10 seconds**.
- Upstream score API: defaults to **900 seconds (15 minutes)** to keep usage low.
- The provider's free API has a daily request quota. Do not set an aggressive upstream interval unless your plan permits it. The code enforces a minimum of 30 seconds.
- With no API key, the dashboard starts but explains the missing setup; it cannot invent live scores.

## Files

- \`index.html\` — responsive score dashboard, search and Live / Upcoming / Completed filters.
- \`server.py\` — local HTTP server, API polling and JSON endpoint at \`/api/matches\`.
- \`config.example.json\` — safe template; copy to ignored \`config.json\` and add your own key.
- \`requirements.txt\` — no third-party Python packages needed.

## Hosting

GitHub Pages can serve the static HTML, but it cannot run this Python server or keep a 10-second background process alive. For a public live site, deploy \`server.py\` to an always-on Python host and configure a secure server-side API key. Do not put the API key in browser JavaScript or a public repository.

## References

- CricketData API and signup: https://cricketdata.org/
- Python API examples: https://cricketdata.org/python-code-samples/
- Indian Express terms: https://indianexpress.com/terms-and-conditions/
