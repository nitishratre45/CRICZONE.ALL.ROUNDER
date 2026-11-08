#!/usr/bin/env python3
"""Import the complete available M3U metadata into CRICZONE34 JSON."""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

from urllib.request import Request, urlopen

SOURCE_URL = os.environ.get(
    "CRICZONE34_PLAYLIST_URL",
    "https://sportlink-playlist.pages.dev/Combined.m3u",
)
OUTPUT = Path("criczone34/channels.json")
ATTR_RE = re.compile(r'([A-Za-z0-9_-]+)\s*=\s*"((?:\\.|[^"])*)"')
DURATION_RE = re.compile(r"^#EXTINF:\s*(-?\d+(?:\.\d+)?)")
HEADER_KEYS = {"user-agent", "referer", "origin", "cookie", "authorization", "accept"}


def unescape_attr(value):
    return value.replace(r'\"', '"').replace(r'\\', '\\')


def split_extinf_name(line):
    quoted = False
    escaped = False
    comma = -1
    for i, char in enumerate(line):
        if escaped:
            escaped = False
            continue
        if char == "\\" and quoted:
            escaped = True
            continue
        if char == '"':
            quoted = not quoted
        elif char == "," and not quoted:
            comma = i
    return line[comma + 1:].strip() if comma >= 0 else "Untitled channel"


def parse_extinf(line):
    prefix = line.split(",", 1)[0]
    attrs = {}
    for match in ATTR_RE.finditer(prefix):
        attrs[match.group(1)] = unescape_attr(match.group(2))
    duration_match = DURATION_RE.match(line)
    duration = float(duration_match.group(1)) if duration_match else None
    name = split_extinf_name(line)
    item = {
        "name": name or "Untitled channel",
        "tvg_id": attrs.get("tvg-id", ""),
        "tvg_name": attrs.get("tvg-name", ""),
        "logo": attrs.get("tvg-logo", ""),
        "group": attrs.get("group-title", "Other") or "Other",
        "url": "",
        "stream_type": "unknown",
        "duration": duration,
        "attributes": attrs,
        "directives": [],
        "url_options": {},
        "request_headers": {},
        "raw_url_line": "",
    }
    return item


def parse_url_options(raw_options):
    options = {}
    for token in raw_options.split("&"):
        if not token:
            continue
        if "=" in token:
            key, value = token.split("=", 1)
        else:
            key, value = token, ""
        key = unquote(key.strip())
        value = unquote(value.strip())
        if key:
            options[key] = value
    return options


def finalize_channel(item, raw_url_line):
    item["raw_url_line"] = raw_url_line
    parts = raw_url_line.split("|", 1)
    url = parts[0].strip()
    item["url"] = url
    if len(parts) > 1:
        item["url_options"] = parse_url_options(parts[1])
        for key, value in item["url_options"].items():
            if key.lower() in HEADER_KEYS:
                item["request_headers"][key] = value
    low = url.lower()
    item["stream_type"] = (
        "hls" if ".m3u8" in low else
        "dash" if ".mpd" in low else
        "unknown"
    )
    return item


def parse_playlist(text):
    channels = []
    current = None
    playlist_directives = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#EXTINF:"):
            current = parse_extinf(line)
        elif line.startswith("#"):
            # Keep all per-channel tags (e.g. EXTVLCOPT, KODIPROP, EXTHTTP,
            # catch-up and unknown provider tags) exactly as received.
            if current is not None:
                current["directives"].append(line)
            else:
                playlist_directives.append(line)
        elif current is not None:
            item = finalize_channel(current, line)
            if item["url"].startswith(("https://", "http://")):
                channels.append(item)
            current = None
    return channels, playlist_directives


def main():
    req = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "CRICZONE34-Playlist-Updater/2.0",
            "Accept": "application/vnd.apple.mpegurl, text/plain, */*",
        },
    )
    with urlopen(req, timeout=60) as response:
        body = response.read().decode("utf-8-sig", errors="replace")
    if "#EXTM3U" not in body[:500]:
        raise RuntimeError("Source did not return a valid M3U playlist")
    channels, playlist_directives = parse_playlist(body)
    if len(channels) < 10:
        raise RuntimeError(
            f"Only {len(channels)} valid channels found; keeping previous JSON"
        )

    groups = {}
    for channel in channels:
        group = channel["group"]
        groups[group] = groups.get(group, 0) + 1

    payload = {
        "schema_version": 2,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE_URL,
        "total": len(channels),
        "group_counts": dict(sorted(groups.items())),
        "playlist_directives": playlist_directives,
        "channels": channels,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUTPUT.with_suffix(".json.tmp")
    temp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temp.replace(OUTPUT)
    print(f"CRICZONE34: saved {len(channels)} channels with full available metadata")
    print(f"Groups: {len(groups)} | Playlist directives: {len(playlist_directives)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
