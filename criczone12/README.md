# CRICZONE12

Responsive channel directory with category filters, search, logos and an HLS-capable player.

## Refresh channel data

No GitHub secret or repository variable is required. The workflow uses the configured public playlist endpoint directly:

`http://sflex.fun/Sflex-Jio/ZioTvPlus.php`

Open **Actions → CRICZONE12 Playlist Refresh → Run workflow** to refresh manually. It also runs every six hours and commits updated metadata to `criczone12/data/channels.json`.

For local testing:

```bash
python criczone12/tools/extract_playlist.py --source ./authorized-playlist.m3u
```

## Publish

Publish the repository root using the existing static hosting setup, then open `/criczone12/`.

## Playback limitations

The player supports browser-native HLS and hls.js where supported. A stream may still fail due to CORS, expired links, unsupported codecs, region restrictions, or provider authentication. Use only streams for which you have playback and distribution rights. This project does not bypass DRM, logins, paywalls, or access controls.
