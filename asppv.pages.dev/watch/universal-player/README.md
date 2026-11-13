# CRICZONE Universal Player

A standalone, responsive HLS player page.

## Open the player

`/asppv.pages.dev/watch/universal-player/?src=ENCODED_HLS_URL&name=CHANNEL_NAME`

Example with a stream you own or are authorized to use:

`https://criczone.pages.dev/asppv.pages.dev/watch/universal-player/?src=https%3A%2F%2Fexample.com%2Flive.m3u8&name=My%20Live%20Channel`

## Included

- HLS.js playback for browsers with Media Source Extensions
- Native HLS fallback for Safari
- Plyr controls, fullscreen and picture-in-picture where supported
- Mobile-responsive layout and accessible status messages
- Reload and share controls
- No popunder, smartlink, redirect, or injected advertising scripts

## Limitations

- Accepts HLS `.m3u8` playlists only.
- The stream host must permit playback from this site (CORS/access policy).
- Does not extract provider tokens, bypass DRM, decrypt protected streams, or proxy restricted content.
- Use only streams you own or are authorized to distribute.
