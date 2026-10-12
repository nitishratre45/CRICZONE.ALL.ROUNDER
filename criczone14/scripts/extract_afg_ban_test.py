#!/usr/bin/env python3
"""Extract the Afghanistan vs Bangladesh Only Test from live_matches.json.

Usage:
  python scripts/extract_afg_ban_test.py
  python scripts/extract_afg_ban_test.py --input live_matches.json --output afg_ban_test_1555116.json
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

MATCH_ID = "1555116"
SERIES_ID = "1555106"
SOURCE_URL = (
    "https://www.cricinfo.com/series/afghanistan-v-bangladesh-2026-27-1555106/"
    "afghanistan-vs-bangladesh-only-test-1555116/live-cricket-score"
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="live_matches.json")
    parser.add_argument("--output", default="afg_ban_test_1555116.json")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.exists():
        raise SystemExit(f"Input JSON not found: {input_path}")

    try:
        data = json.loads(input_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Could not read valid JSON from {input_path}: {exc}")

    matches = data.get("matches", []) if isinstance(data, dict) else []
    match = next(
        (
            item for item in matches
            if str(item.get("objectId", "")) == MATCH_ID
            or str(item.get("id", "")) == MATCH_ID
            or str(item.get("scribeId", "")) == MATCH_ID
        ),
        None,
    )
    if match is None:
        raise SystemExit(
            f"Match {MATCH_ID} was not found in {input_path}. "
            "Refresh live_matches.json from the upstream data source first."
        )

    payload = {
        "source": "CRICZONE live_matches.json",
        "sourceUrl": SOURCE_URL,
        "matchId": int(MATCH_ID),
        "seriesId": int(SERIES_ID),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "match": match,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Saved match JSON: {output_path}")
    print(f"Match: {match.get('slug', 'unknown')}")
    print(f"Status: {match.get('statusText', match.get('status', 'unknown'))}")


if __name__ == "__main__":
    main()
