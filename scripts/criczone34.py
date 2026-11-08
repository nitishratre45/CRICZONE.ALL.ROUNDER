#!/usr/bin/env python3
"""Import the complete available M3U metadata into CRICZONE34 JSON."""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit, urlunsplit

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



def extract_drm_metadata(directives):
    """Extract non-secret DRM signalling metadata; never store content keys."""
    drm = {
        "required": False, "system": [], "license_url": "",
        "key_id": "", "pssh": "", "license_type": "",
        "metadata_available": False, "content_key_stored": False,
    }
    for directive in directives:
        low = directive.lower()
        if "inputstream.adaptive" not in low and "drm" not in low and "pssh" not in low:
            continue
        drm["required"] = True
        license_type = re.search(r"(?:license_type|drm_system)\s*[=:]\s*['\"]?([^'\"]+)", directive, re.I)
        if license_type:
            value = license_type.group(1).strip()
            drm["license_type"] = value
            if value.lower() not in drm["system"]:
                drm["system"].append(value.lower())
        key_id = re.search(r"(?:default_kid|key_id|kid)\s*[=:]\s*['\"]?([0-9a-fA-F-]{16,})", directive, re.I)
        if key_id:
            drm["key_id"] = key_id.group(1)
        pssh = re.search(r"(?:pssh)\s*[=:]\s*['\"]?([A-Za-z0-9+/=]{20,})", directive, re.I)
        if pssh:
            drm["pssh"] = pssh.group(1)
        # license_key may contain keys or credentials. Store only a sanitized
        # HTTP(S) endpoint, without query, fragment, headers, or key material.
        license_value = re.search(r"(?:license_key|license_url)\s*[=:]\s*['\"]?([^'\"]+)", directive, re.I)
        if license_value and not drm["license_url"]:
            candidate = license_value.group(1).strip().split("|", 1)[0]
            try:
                parsed = urlsplit(candidate)
                if parsed.scheme in ("http", "https") and parsed.netloc:
                    drm["license_url"] = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
            except ValueError:
                pass
    drm["metadata_available"] = bool(
        drm["license_type"] or drm["license_url"] or drm["key_id"] or drm["pssh"]
    )
    return drm


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
    item["drm"] = extract_drm_metadata(item["directives"])
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
