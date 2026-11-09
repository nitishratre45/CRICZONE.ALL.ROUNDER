#!/usr/bin/env python3
"""Import metadata from an M3U playlist you own or are authorized to use.

This tool does not bypass DRM, authentication, geoblocking, paywalls,
or provider restrictions.
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "channels.json"

ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')

def read_source(source: str) -> str:
    if source.startswith(("https://", "http://")):
        request = Request(source, headers={"User-Agent": "CRICZONE12-Playlist-Importer/1.1"})
        with urlopen(request, timeout=60) as response:
            return response.read().decode("utf-8-sig", errors="replace")
    return Path(source).read_text(encoding="utf-8-sig", errors="replace")

def parse_playlist(text: str) -> list:
    channels = []
    pending = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#EXTINF:"):
            metadata = {key.lower(): value for key, value in ATTR_RE.findall(line)}
            display_name = line.split(",", 1)[1].strip() if "," in line else ""
            pending = {
                "name": display_name or metadata.get("tvg-name") or "Unknown channel",
                "tvg_id": metadata.get("tvg-id", ""),
                "logo": metadata.get("tvg-logo", ""),
                "category": metadata.get("group-title", "Others") or "Others",
                "language": metadata.get("tvg-language", ""),
                "url": ""
            }
        elif pending is not None and not line.startswith("#"):
            pending["url"] = line
            pending["id"] = pending["tvg_id"] or f"channel-{len(channels) + 1}"
            channels.append(pending)
            pending = None
    return channels

def main():
    parser = argparse.ArgumentParser(description="Build CRICZONE12 channel JSON from an authorized M3U playlist.")
    parser.add_argument("--source", default=os.getenv("PLAYLIST_URL") or os.getenv("PLAYLIST_FILE"),
                        help="Authorized M3U URL or local playlist file")
    args = parser.parse_args()
    if not args.source:
        sys.exit("Missing playlist source. Set PLAYLIST_URL or pass --source.")
    source_text = read_source(args.source)
    if "#EXTM3U" not in source_text[:1000]:
        sys.exit("The source did not return an M3U playlist (#EXTM3U not found).")
    channels = parse_playlist(source_text)
    if not channels:
        sys.exit("No channel entries found; existing published JSON was left unchanged.")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(channels),
        "categories": sorted({item["category"] for item in channels}),
        "channels": channels
    }
    temporary = OUT.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(OUT)
    print(f"Imported {len(channels)} channels in {len(payload['categories'])} categories.")
    print(f"Output: {OUT}")

if __name__ == "__main__":
    main()
