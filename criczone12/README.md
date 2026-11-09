# CRICZONE12

Static channel directory and HLS-capable web player for streams you are authorized to use.

## 1. Import playlist metadata
Set the GitHub repository variable `CRICZONE12_PLAYLIST_URL` to an authorized M3U/M3U8 playlist URL. Then run **Actions → CRICZONE12 Playlist Refresh → Run workflow**. The workflow also refreshes every six hours.

For local testing:
```bash
python criczone12/tools/extract_playlist.py --source ./my-authorized-playlist.m3u
```

The extractor writes `criczone12/data/channels.json`. The site reads that JSON at runtime.

## 2. Publish
Configure the repository's static hosting to publish the repository root. Open `/criczone12/`.

## 3. Playback notes
The player supports browser-native HLS and hls.js for compatible HLS streams. Playback can still fail because of CORS, expired URLs, unsupported codecs, region restrictions, or provider authentication. Use only streams for which you have distribution and playback rights. This project does not bypass DRM, login, paywalls, or access controls.
