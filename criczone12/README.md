# CRICZONE12

Responsive channel directory with category filters, search, logos and an HLS-capable player.

## Import an authorized playlist

1. Open repository **Settings → Secrets and variables → Actions → Secrets**.
2. Add a repository secret named `CRICZONE12_PLAYLIST_URL`.
3. Set its value to an M3U playlist URL you own or are authorized to use.
4. Open **Actions → CRICZONE12 Playlist Refresh → Run workflow**.

The workflow also refreshes the catalogue every six hours. It writes metadata to `criczone12/data/channels.json`. The website reads this file automatically.

For local testing:

```bash
python criczone12/tools/extract_playlist.py --source ./authorized-playlist.m3u
```

## Publish

Publish the repository root using the existing static hosting setup, then open `/criczone12/`.

## Playback limitations

The player supports browser-native HLS and hls.js where supported. A stream may still fail due to CORS, expired links, unsupported codecs, region restrictions, or provider authentication. Use only streams for which you have playback and distribution rights. This project does not bypass DRM, logins, paywalls, or access controls.
