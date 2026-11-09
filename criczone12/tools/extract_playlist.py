#!/usr/bin/env python3
"""Build the CRICZONE12 channel catalogue from an M3U/M3U8 playlist.

Use only a playlist URL/file that you own or are authorized to access.
This extracts playlist metadata; it does not bypass DRM, authentication,
geoblocking, paywalls, or provider restrictions.
"""
import argparse, json, os, re, sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "channels.json"

def read_source(source: str) -> str:
    if source.startswith(("https://", "http://")):
        req = Request(source, headers={"User-Agent": "CRICZONE12-Playlist-Importer/1.0"})
        with urlopen(req, timeout=45) as response:
            return response.read().decode("utf-8-sig", errors="replace")
    return Path(source).read_text(encoding="utf-8-sig", errors="replace")

def attrs(line: str) -> dict:
    return {k.lower(): v for k, v in re.findall(r'([\w-]+)="([^"]*)"', line)}

def parse(text: str) -> list:
    rows, pending = [], None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#EXTINF:"):
            meta = attrs(line)
            name = line.split(",", 1)[1].strip() if "," in line else meta.get("tvg-name", "Unknown")
            pending = {
                "name": name or meta.get("tvg-name", "Unknown"),
                "tvg_id": meta.get("tvg-id", ""),
                "logo": meta.get("tvg-logo", ""),
                "category": meta.get("group-title", "Others") or "Others",
                "language": meta.get("tvg-language", ""),
                "url": ""
            }
        elif not line.startswith("#") and pending is not None:
            pending["url"] = line
            pending["id"] = pending["tvg_id"] or str(len(rows) + 1)
            rows.append(pending)
            pending = None
    return rows

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", default=os.getenv("PLAYLIST_URL") or os.getenv("PLAYLIST_FILE"),
                   help="Authorized M3U URL or local M3U file; alternatively set PLAYLIST_URL")
    args = p.parse_args()
    if not args.source:
        sys.exit("Set PLAYLIST_URL to an authorized playlist URL, or pass --source /path/to/list.m3u")
    text = read_source(args.source)
    if "#EXTM3U" not in text[:500]:
        sys.exit("Source does not look like an M3U playlist.")
    channels = parse(text)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"updated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                               "total": len(channels), "channels": channels},
                              ensure_ascii=False, indent=2), encoding="utf-8")
    cats = sorted({c["category"] for c in channels})
    print(f"Saved {len(channels)} channel records across {len(cats)} categories to {OUT}")

if __name__ == "__main__":
    main()
