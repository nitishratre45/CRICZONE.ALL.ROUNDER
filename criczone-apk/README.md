# CRICZONE Android APK

A separate Android WebView shell for the existing CRICZONE Buzz web experience.

## Preservation
- The original `/criczonebuzz` website folder is mirrored under `web-copy/criczonebuzz` without editing its source files.
- The Android app opens the deployed page at `https://criczone.pages.dev/criczonebuzz/`. This deliberately reuses the existing website's JavaScript, JSON/API calls, match selection, Shaka player and visitor-counter flow instead of reimplementing or changing that logic.
- The original website folder and its backend are not modified by this Android project.

## Build
Open this directory in Android Studio, or run:
`gradle :app:assembleDebug`

The debug APK is generated at:
`app/build/outputs/apk/debug/app-debug.apk`

## Change the hosted page
If the production URL changes, update `WEB_APP_URL` in `app/build.gradle.kts` and rebuild.

## Notes
This is a WebView APK wrapper, not a native Media3 player rewrite. Video playback continues through the existing web player. The Android WebView enables JavaScript, DOM storage, inline media playback and fullscreen video support.
