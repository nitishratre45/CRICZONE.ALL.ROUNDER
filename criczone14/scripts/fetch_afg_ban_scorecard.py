#!/usr/bin/env python3
"""Refresh the AFG vs BAN Test match JSON from an accessible scorecard page.

This scraper uses the accessible Indian Express scorecard page because direct
requests to the supplied Cricinfo URL may return HTTP 403. It extracts the
page's scorecard text and stores a timestamped source snapshot. The curated
structured scorecard lives in ../afg_ban_test_1555116.json.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from html.parser import HTMLParser

MATCH_ID = "1555116"
CRICINFO_URL = (
    "https://www.cricinfo.com/series/afghanistan-v-bangladesh-2026-27-1555106/"
    "afghanistan-vs-bangladesh-only-test-1555116/live-cricket-score"
)
SCORECARD_URL = (
    "https://indianexpress.com/section/sports/cricket/live-score/"
    "afghanistan-vs-bangladesh-one-off-test-live-score-full-scorecard-highlights-"
    "afghanistan-and-bangladesh-in-uae-one-off-test-2026-afba10092026274655/"
)
OUT = Path(__file__).resolve().parents[1] / "afg_ban_test_1555116.json"


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        value = re.sub(r"\\s+", " ", data).strip()
        if value:
            self.parts.append(value)


def main():
    request = Request(
        SCORECARD_URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; CRICZONE-scorecard/1.0)"},
    )
    try:
        with urlopen(request, timeout=25) as response:
            status_code = response.status
            html = response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise SystemExit(f"Scorecard fetch failed: {exc}")

    parser = TextExtractor()
    parser.feed(html)
    text = parser.parts
    raw_snapshot = {
        "matchId": MATCH_ID,
        "cricinfoUrl": CRICINFO_URL,
        "fetchedFrom": SCORECARD_URL,
        "httpStatus": status_code,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "pageTitle": next((x for x in text if "Afghanistan vs Bangladesh" in x), ""),
        "pageText": text,
        "note": (
            "Raw page text snapshot. The structured scorecard section already in this JSON "
            "is a curated snapshot and is not automatically replaced by this raw text."
        ),
    }

    if OUT.exists():
        try:
            payload = json.loads(OUT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            payload = {"matchId": MATCH_ID}
    else:
        payload = {"matchId": MATCH_ID}

    payload["rawPageSnapshot"] = raw_snapshot
    payload["lastFetchedAt"] = raw_snapshot["fetchedAt"]
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    print(f"HTTP {status_code}")
    print(f"Saved {len(text)} extracted text blocks to {OUT}")
    print("Note: this saves source text; it does not guarantee live ball-by-ball parsing.")


if __name__ == "__main__":
    main()
