#!/usr/bin/env python3
"""CricZone17: local cricket dashboard with JSON persistence.

The browser checks the local server every 20 seconds. Upstream API polling is
configurable (default 15 minutes) to avoid exhausting the provider quota.
"""
import json
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import urllib.error
import urllib.parse
import urllib.request

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
JSON_PATH = BASE_DIR / "live_scores.json"
API_URL = "https://api.cricapi.com/v1/currentMatches"
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8765"))

def load_config():
    config = {"api_key": os.environ.get("CRICKET_API_KEY", "").strip(), "poll_seconds": 900}
    if CONFIG_PATH.exists():
        try:
            file_config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            config.update({k: v for k, v in file_config.items() if k in ("api_key", "poll_seconds")})
        except (OSError, json.JSONDecodeError) as exc:
            print("config.json could not be read:", exc)
    config["api_key"] = str(config.get("api_key") or "").strip()
    try:
        config["poll_seconds"] = max(30, int(config.get("poll_seconds", 900)))
    except (TypeError, ValueError):
        config["poll_seconds"] = 900
    return config

CONFIG = load_config()
STATE_LOCK = threading.Lock()
STATE = {
    "provider": "CricketData API",
    "sourceUrl": "https://cricketdata.org/",
    "updatedAt": None,
    "nextRefreshSeconds": CONFIG["poll_seconds"],
    "matches": [],
    "error": "API key missing. Add your key to config.json.",
    "configured": bool(CONFIG["api_key"]),
}

def load_saved_json():
    """Restore the last saved data so the dashboard can show it after restart."""
    if not JSON_PATH.exists():
        return
    try:
        saved = json.loads(JSON_PATH.read_text(encoding="utf-8"))
        if isinstance(saved, dict) and isinstance(saved.get("matches"), list):
            STATE.update(saved)
            STATE["nextRefreshSeconds"] = CONFIG["poll_seconds"]
            if not CONFIG["api_key"]:
                STATE["configured"] = False
                STATE["error"] = "API key missing. Showing last saved JSON data, if available."
    except (OSError, json.JSONDecodeError) as exc:
        print("Saved live_scores.json could not be read:", exc)

def save_state_json():
    """Atomically write the current dashboard state to live_scores.json."""
    with STATE_LOCK:
        snapshot = dict(STATE)
        snapshot["nextRefreshSeconds"] = CONFIG["poll_seconds"]
        content = json.dumps(snapshot, ensure_ascii=False, indent=2)
    temp_path = JSON_PATH.with_suffix(".json.tmp")
    temp_path.write_text(content + "\n", encoding="utf-8")
    temp_path.replace(JSON_PATH)

def normalise_match(item):
    if not isinstance(item, dict):
        return None
    teams = item.get("teams") if isinstance(item.get("teams"), list) else []
    scores = item.get("score") if isinstance(item.get("score"), list) else []
    clean_scores = []
    for score in scores:
        if not isinstance(score, dict):
            continue
        clean_scores.append({
            "innings": str(score.get("inning") or score.get("innings") or ""),
            "runs": score.get("r"),
            "wickets": score.get("w"),
            "overs": score.get("o"),
        })
    name = str(item.get("name") or "Cricket match")
    return {
        "id": str(item.get("id") or name),
        "name": name,
        "matchType": str(item.get("matchType") or ""),
        "status": str(item.get("status") or "Score not available"),
        "venue": str(item.get("venue") or ""),
        "date": str(item.get("date") or item.get("dateTimeGMT") or ""),
        "teams": [str(team) for team in teams],
        "teamInfo": item.get("teamInfo") if isinstance(item.get("teamInfo"), list) else [],
        "score": clean_scores,
        "matchStarted": bool(item.get("matchStarted")),
        "matchEnded": bool(item.get("matchEnded")),
    }

def refresh_from_api():
    if not CONFIG["api_key"]:
        with STATE_LOCK:
            STATE["configured"] = False
            STATE["error"] = "API key missing. Add your key to config.json."
        try:
            save_state_json()
        except OSError as exc:
            print("Could not save live_scores.json:", exc)
        return
    query = urllib.parse.urlencode({"apikey": CONFIG["api_key"], "offset": 0})
    request = urllib.request.Request(
        API_URL + "?" + query,
        headers={"User-Agent": "CricZone17/1.0 (personal cricket score dashboard)", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("status") not in (None, "success"):
            raise RuntimeError(str(payload.get("reason") or payload.get("message") or payload.get("status")))
        raw_matches = payload.get("data") or []
        matches = [normalise_match(item) for item in raw_matches]
        matches = [item for item in matches if item]
        with STATE_LOCK:
            STATE["matches"] = matches
            STATE["updatedAt"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            STATE["error"] = None
            STATE["configured"] = True
            STATE["provider"] = "CricketData API"
            STATE["sourceUrl"] = "https://cricketdata.org/"
            STATE["nextRefreshSeconds"] = CONFIG["poll_seconds"]
        save_state_json()
        print("Saved", len(matches), "matches to live_scores.json at", STATE["updatedAt"])
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError, OSError) as exc:
        with STATE_LOCK:
            STATE["error"] = "API update failed: " + str(exc)
            STATE["configured"] = True
        try:
            save_state_json()
        except OSError as save_exc:
            print("Could not save live_scores.json:", save_exc)
        print(STATE["error"])

def background_updater():
    while True:
        refresh_from_api()
        time.sleep(CONFIG["poll_seconds"])

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Access-Control-Allow-Origin", "null")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/matches" or path == "/live_scores.json":
            try:
                if path == "/live_scores.json" and JSON_PATH.exists():
                    body = JSON_PATH.read_bytes()
                else:
                    with STATE_LOCK:
                        body = json.dumps(STATE, ensure_ascii=False, indent=2).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except OSError as exc:
                self.send_error(500, "Could not read saved JSON: " + str(exc))
            return
        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        print("[HTTP]", fmt % args)

if __name__ == "__main__":
    load_saved_json()
    print("CricZone17 server: http://127.0.0.1:" + str(PORT))
    print("JSON file: " + str(JSON_PATH))
    print("Dashboard refresh: every 20 seconds | API refresh: every " + str(CONFIG["poll_seconds"]) + " seconds")
    if not CONFIG["api_key"]:
        print("Add your CricketData API key to criczone17/config.json before expecting fresh scores.")
    threading.Thread(target=background_updater, daemon=True).start()
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nCricZone17 stopped.")
