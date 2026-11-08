#!/usr/bin/env python3
import json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE_URL = os.environ.get("CRICZONE34_PLAYLIST_URL", "https://sportlink-playlist.pages.dev/Combined.m3u")
OUTPUT = Path("criczone34/channels.json")
ATTR = {
 "tvg_id": re.compile(r'tvg-id="([^"]*)"'),
 "tvg_name": re.compile(r'tvg-name="([^"]*)"'),
 "logo": re.compile(r'tvg-logo="([^"]*)"'),
 "group": re.compile(r'group-title="([^"]*)"')
}

def parse_playlist(text):
    channels, current = [], None
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("#EXTINF:"):
            current = {"name": line.rsplit(",", 1)[-1].strip() or "Untitled channel",
                       "tvg_id":"", "tvg_name":"", "logo":"", "group":"Other",
                       "url":"", "stream_type":""}
            for key, pattern in ATTR.items():
                match = pattern.search(line)
                if match: current[key] = match.group(1).strip()
            if not current["group"]: current["group"] = "Other"
        elif line and not line.startswith("#") and current:
            url = line.split("|", 1)[0].strip()
            current["url"] = url
            current["stream_type"] = "hls" if ".m3u8" in url.lower() else "dash" if ".mpd" in url.lower() else "unknown"
            if url.startswith(("https://", "http://")): channels.append(current)
            current = None
    return channels

def main():
    req = Request(SOURCE_URL, headers={"User-Agent":"CRICZONE34-Playlist-Updater/1.0","Accept":"application/vnd.apple.mpegurl, text/plain, */*"})
    with urlopen(req, timeout=45) as response:
        body = response.read().decode("utf-8-sig", errors="replace")
    if "#EXTM3U" not in body[:500]: raise RuntimeError("Source did not return a valid M3U playlist")
    channels = parse_playlist(body)
    if not channels: raise RuntimeError("No valid channels found; previous JSON was preserved")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"updated_at":datetime.now(timezone.utc).isoformat(),"source":SOURCE_URL,"total":len(channels),"channels":channels}
    temp = OUTPUT.with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(OUTPUT)
    print("CRICZONE34 updated:", len(channels), "channels")

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print("ERROR:", exc, file=sys.stderr)
        raise
