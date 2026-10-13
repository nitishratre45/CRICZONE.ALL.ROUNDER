"""
Cricinfo Next.js Extractor Scraper for GitHub Actions (Single Run)
"""

from datetime import datetime
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

CONFIG = {
    "WEB_URL": (
        "https://www.espncricinfo.com/series/1525634/match/1525659/scorecard"
    ),
    "OUTPUT_FILE": "scorecard.json",
    "BACKUP_DIR": "scorecard_backups",
}


def fetch_and_save_scorecard():
  Path(CONFIG["BACKUP_DIR"]).mkdir(parents=True, exist_ok=True)

  with sync_playwright() as p:
    # GitHub Actions ke liye headless=True zaroori hai
    browser = p.chromium.launch(
        headless=True,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
        ],
    )

    context = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            " (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1920, "height": 1080},
    )
    page = context.new_page()

    try:
      print("Opening Cricinfo scorecard page...")
      page.goto(
          CONFIG["WEB_URL"], timeout=60000, wait_until="domcontentloaded"
      )

      print("Waiting for Next.js data element to attach...")
      page.wait_for_selector("#__NEXT_DATA__", state="attached", timeout=30000)

      next_data_str = page.locator("#__NEXT_DATA__").inner_text()
      data = json.loads(next_data_str)

      # Save primary JSON file
      with open(CONFIG["OUTPUT_FILE"], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

      # Save timestamped backup file
      timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
      backup_path = os.path.join(
          CONFIG["BACKUP_DIR"], f"scorecard_{timestamp}.json"
      )
      with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

      print("SUCCESS: Scorecard JSON successfully saved!")
      browser.close()
      return True
    except Exception as e:
      print(f"Error extracting scorecard data: {str(e)}")
      browser.close()
      return False


if __name__ == "__main__":
  success = fetch_and_save_scorecard()
  if not success:
    exit(1)
