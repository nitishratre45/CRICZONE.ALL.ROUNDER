"""
Cricbuzz Live Score Extractor for GitHub Actions
"""

from datetime import datetime
import json
import os
from pathlib import Path
from bs4 import BeautifulSoup
from curl_cffi import requests

CONFIG = {
    "WEB_URL": "https://www.cricbuzz.com/live-cricket-scores",
    "OUTPUT_FILE": "scorecard.json",
    "BACKUP_DIR": "scorecard_backups",
}


def fetch_and_save_scorecard():
  Path(CONFIG["BACKUP_DIR"]).mkdir(parents=True, exist_ok=True)

  headers = {
      "User-Agent": (
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          " (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      ),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
  }

  try:
    print("Fetching live cricket scores from Cricbuzz...")
    response = requests.get(
        CONFIG["WEB_URL"], headers=headers, impersonate="chrome", timeout=30
    )

    if response.status_code != 200:
      print(f"Server returned status code: {response.status_code}")
      return False

    soup = BeautifulSoup(response.text, "html.parser")
    match_elements = soup.find_all("div", class_="cb-col-live")

    matches_data = []
    for match in match_elements:
      title = match.text.strip()
      matches_data.append({"match_info": title})

    data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "matches": matches_data,
        "raw_html_snippet": response.text[:5000],
    }

    with open(CONFIG["OUTPUT_FILE"], "w", encoding="utf-8") as f:
      json.dump(data, f, ensure_ascii=False, indent=4)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(
        CONFIG["BACKUP_DIR"], f"scorecard_{timestamp}.json"
    )
    with open(backup_path, "w", encoding="utf-8") as f:
      json.dump(data, f, ensure_ascii=False, indent=4)

    print("SUCCESS: Cricbuzz live score successfully saved!")
    return True

  except Exception as e:
    print(f"Error during fetch/extraction: {str(e)}")
    return False


if __name__ == "__main__":
  success = fetch_and_save_scorecard()
  if not success:
    exit(1)
