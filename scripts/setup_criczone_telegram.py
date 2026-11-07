#!/usr/bin/env python3
"""Scan CRICZONE repository feed URLs and refresh telegram-sources.json."""
import os, re, json, base64, urllib.request, sys, urllib.parse

OWNER, REPO, BRANCH = "nitishratre45", "CRICZONE.ALL.ROUNDER", "main"
API = f"https://api.github.com/repos/{OWNER}/{REPO}"
MANIFEST = "telegram-sources.json"
KNOWN = [
 ["sports_v7","criczone","sports","https://sonujson-v7.pages.dev/Data/sports.json"],
 ["directory_v3","criczone2","channels","https://allrounder3-0.pages.dev/id.json"],
 ["directory_v1","criczone1","channels","https://sportlink-json.pages.dev/id.json"],
 ["sports_v5","criczone3","sports","https://sonujson-v5.pages.dev/Data/sports.json"],
 ["willow_v4","criczonebuzz","channels","https://sonujson-v4.pages.dev/Data/willow.json"],
 ["prime_v4","criczonebuzz","channels","https://sonujson-v4.pages.dev/Data/prime.json"],
 ["willow_v5","criczonebuzz","channels","https://sonujson-v5.pages.dev/Data/willow.json"],
 ["fancode","criczonefancode","matches","https://sportlink-fancode10.pages.dev/fan.json"],
 ["sony_star","criczonesony","channels","https://sportlink-tv11.pages.dev/Star3.json"],
 ["sony_playlist","sony","m3u","https://sportlink-jtv.pages.dev/sony3.m3u"],
 ["sony_playlist_backup","criczonesony","m3u","https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sony.m3u"],
 ["jtv2","criczone2","channels","https://cdn.jsdelivr.net/gh/sportlive18/jio-tv-auto-update-playlist@main/jtv2.json"],
 ["sports_logos","criczonesony","logos","https://aryanstreams2.pages.dev/data/sports.json"],
]
TOKEN = os.getenv("GITHUB_TOKEN","").strip()

def http(url, method="GET", payload=None):
    headers={"User-Agent":"CRICZONE-Telegram-Setup","Accept":"application/vnd.github+json"}
    if TOKEN: headers["Authorization"]="Bearer "+TOKEN
    data=None
    if payload is not None:
        data=json.dumps(payload).encode()
        headers["Content-Type"]="application/json"
    req=urllib.request.Request(url,data=data,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=25) as r: return r.read()

def kind(url):
    u=url.lower()
    if ".m3u" in u: return "m3u"
    if any(w in u for w in ("fixture","match","score","event","fancode")): return "matches"
    if any(w in u for w in ("logo","image","badge")): return "logos"
    if any(w in u for w in ("sport","team","schedule")): return "sports"
    return "channels"

def main():
    if not TOKEN: raise SystemExit("GITHUB_TOKEN is required (GitHub Actions provides secrets.GITHUB_TOKEN).")
    tree=json.loads(http(API+"/git/trees/"+BRANCH+"?recursive=1"))
    if tree.get("truncated"): raise SystemExit("GitHub tree was truncated; aborting.")
    urls={}
    for item in tree.get("tree",[]):
        path=item.get("path","")
        if item.get("type")!="blob" or not path.endswith((".js",".mjs",".html",".py")) or item.get("size",0)>1500000: continue
        try: text=http("https://raw.githubusercontent.com/"+OWNER+"/"+REPO+"/"+BRANCH+"/"+urllib.parse.quote(path)).decode("utf-8","replace")
        except Exception as e:
            print("[WARN] skipped",path,e); continue
        for u in re.findall(r'https?://[^\s"\'<>]+',text):
            u=u.rstrip("),;]}\\")
            if re.search(r"\.(json|m3u8?)([?#].*)?$",u,re.I) and "criczone.pages.dev" not in urllib.parse.urlparse(u).netloc:
                urls.setdefault(u,{"key":"","folder":path.split("/")[0] if "/" in path else "criczone","kind":kind(u),"url":u,"enabled":True,"discovered_from":path})
    sources=[{"key":k,"folder":f,"kind":t,"url":u,"enabled":True} for k,f,t,u in KNOWN]
    used={x["key"] for x in sources}; known_urls={x["url"] for x in sources}
    for u,x in sorted(urls.items()):
        if u in known_urls: continue
        base=re.sub(r"[^a-z0-9]+","_",urllib.parse.urlparse(u).path.rsplit("/",1)[-1].split(".")[0].lower()).strip("_") or "feed"
        key=base; n=2
        while key in used: key=f"{base}_{n}"; n+=1
        used.add(key); x["key"]=key; sources.append(x)
    manifest={"version":1,"description":"Auto-discovered CRICZONE Telegram data sources","repository":OWNER+"/"+REPO,"sources":sources}
    try:
        current=json.loads(http(API+"/contents/"+MANIFEST+"?ref="+BRANCH))
        sha=current["sha"]
    except Exception: sha=None
    body={"message":"Auto-refresh Telegram source registry","branch":BRANCH,"content":base64.b64encode((json.dumps(manifest,indent=2,ensure_ascii=False)+"\n").encode()).decode()}
    if sha: body["sha"]=sha
    http(API+"/contents/"+MANIFEST,"PUT",body)
    print(f"[OK] Updated {MANIFEST}: {len(sources)} source entries.")
    print("[INFO] Cloudflare Pages will deploy the updated registry from main.")

if __name__=="__main__":
    try: main()
    except Exception as e:
        print("[ERROR]",e,file=sys.stderr); sys.exit(1)
