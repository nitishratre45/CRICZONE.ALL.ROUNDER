#!/usr/bin/env python3
"""Refresh CRICZONE34's public M3U catalogue into a validated JSON file."""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

from urllib.request import Request, urlopen

SOURCE_URL = os.environ.get("CRICZONE34_PLAYLIST_URL", "https://sportlink-playlist.pages.dev/Combined.m3u")
OUTPUT = Path("criczone34/channels.json")
ATTR = {
    "tvg_id": re.compile(r'tvg-id="([^"]*)"'),
    "tvg_name": re.compile(r'tvg-name="([^"]*)"'),
    "logo": re.compile(r'tvg-logo="([^"]*)"'),
    "group": re.compile(r'group-title="([^"]*)"'),
}


def parse_extinf(line):
    name = line.rsplit(",", 1)[-1].strip() or "Untitled channel"
    item = {"name": name, "tvg_id": "", "tvg_name": "", "logo": "",
            "group": "Other", "url": "", "stream_type": "unknown",
            "request_headers": {}}
    for key, pattern in ATTR.items():
        match = pattern.search(line)
        if match:
            item[key] = match.group(1).strip()
    if not item["group"]:
        item["group"] = "Other"
    return item


def parse_playlist(text):
    channels, current = [], None
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("#EXTINF:"):
            current = parse_extinf(line)
        elif line and not line.startswith("#") and current:
            parts = line.split("|", 1)
            url = parts[0].strip()
            current["url"] = url
            if len(parts) == 2:
                # Preserve M3U per-stream metadata instead of silently discarding it.
                for token in parts[1].split("&"):
                    if "=" not in token:
                        continue
                    key, value = token.split("=", 1)
                    current["request_headers"][unquote(key.strip())] = unquote(value.strip())
            low = url.lower()
            current["stream_type"] = ("hls" if ".m3u8" in low else
                                      "dash" if ".mpd" in low else "unknown")
            if url.startswith(("https://", "http://")):
                channels.append(current)
            current = None
    return channels


def main():
    req = Request(SOURCE_URL, headers={
        "User-Agent": "CRICZONE34-Playlist-Updater/1.1",
        "Accept": "application/vnd.apple.mpegurl, text/plain, */*",
    })
    with urlopen(req, timeout=45) as response:
        body = response.read().decode("utf-8-sig", errors="replace")
    if "#EXTM3U" not in body[:500]:
        raise RuntimeError("Source did not return a valid M3U playlist")
    channels = parse_playlist(body)
    if not channels:
        raise RuntimeError("No valid channels found; previous JSON was preserved")
    # Reject suspiciously truncated upstream responses before replacing good data.
    if len(channels) < 10:
        raise RuntimeError(f"Only {len(channels)} channels found; refusing to overwrite catalogue")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE_URL,
        "total": len(channels),
        "channels": channels,
    }
    temp = OUTPUT.with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(OUTPUT)
    print("CRICZONE34 updated:", len(channels), "channels")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("ERROR:", exc, file=sys.stderr)
        raise
