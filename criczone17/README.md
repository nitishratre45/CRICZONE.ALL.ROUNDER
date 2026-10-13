# CricZone17 — Live Cricket Centre

A responsive cricket score dashboard with a Python local server. It saves the latest provider data into `live_scores.json` and displays it on the dashboard.

## Important source note

This project uses CricketData API to build the JSON. It does **not** automatically scrape or republish Indian Express pages; obtain written permission before automated collection from that website.

## Setup (Android / PyDroid)

1. Create your own API key at https://cricketdata.org/
2. Copy `config.example.json` to a new file named `config.json` in this folder.
3. Put your API key in `config.json`. Do not commit that file or share your key.
4. Open `server.py` in PyDroid and press Run. Keep it running.
5. Open this address in the same phone's browser: http://127.0.0.1:8765/

Example `config.json`:

    {
      "api_key": "YOUR_PRIVATE_API_KEY",
      "poll_seconds": 900
    }

## Refresh and JSON

- Dashboard refreshes from the local Python server every **20 seconds**.
- Python keeps running in the background while the app is active.
- Fresh provider data is fetched every **900 seconds (15 minutes)** by default, then saved to `live_scores.json`.
- Open the saved JSON directly at http://127.0.0.1:8765/live_scores.json
- The dashboard data endpoint is http://127.0.0.1:8765/api/matches
- The provider may have request quotas. Do not lower the upstream interval unless your plan permits it; the code enforces a minimum of 30 seconds.
- If the API key is missing or a fetch fails, the last successfully saved JSON is retained where available.

## Files

- `index.html` — responsive dashboard, search and Live / Upcoming / Completed filters.
- `server.py` — local server, provider polling and JSON persistence.
- `live_scores.json` — generated score data, updated automatically by Python.
- `config.example.json` — safe template; copy to ignored `config.json` and add your key.
- `requirements.txt` — no third-party Python packages needed.

## Hosting

GitHub Pages can serve static HTML but cannot run this Python server or keep a 20-second background process alive. For a public live site, deploy `server.py` to an always-on Python host and configure the API key securely. Do not put the API key in browser JavaScript or a public repository.

## References

- CricketData API and signup: https://cricketdata.org/
- Indian Express terms: https://indianexpress.com/terms-and-conditions/
