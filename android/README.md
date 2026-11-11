# CRICZONE Android

Native Android app built with Kotlin, Jetpack Compose, Android WebView and Coil.

## Open in Android Studio
1. Open the `android/` directory.
2. Use JDK 17 and Android SDK 35.
3. Allow Gradle sync to complete.
4. Run the `app` configuration on an Android 6.0+ device or emulator.

## Repository catalogue imported
The app bundles `app/src/main/assets/channel-catalog.json`, generated from:
- `criczone34/channels.json`
- `criczone12/data/channels.json`
- `criczone/links.json`
- `criczone/stream.js`
- `criczone10/stream.js`

The merged catalogue currently contains 2,386 unique channel metadata records across 47 categories. It includes stable app IDs, primary and alternate source IDs, names, categories, languages, logo URLs and source labels. Search also matches app IDs and source IDs. The matching `criczonojiotv/channels.json` is a mirror of the CRICZONE12 catalogue and is not duplicated. `fancodeweb/` and `criczonefancode/` are intentionally excluded from this pass.

The import intentionally excludes raw upstream playback URLs, DRM keys, cookies, request headers, playlist directives and expiring tokens. Telegram bot/admin state JSON is not a television channel catalogue and is not copied into the APK.

## Player behaviour
The Android app opens first-party CRICZONE player pages inside an in-app WebView iframe. Only matching HTTPS player pages from the configured CRICZONE host allowlist are wired at this stage. The remaining imported channels are visible as catalogue entries but show "player URL not configured" until a CRICZONE-owned, embed-compatible and distribution-authorized player page is assigned.

The embedded page must permit framing by its configured origin. The app does not bypass X-Frame-Options, Content-Security-Policy frame-ancestors, DRM, authentication, geo-restrictions or provider access controls.

## Features
- Home, Search, Favorites and Telegram tabs
- 2,386 imported channel metadata records
- Category filter chips and channel logos
- Locally stored favorites
- Embedded WebView iframe player with JavaScript and DOM storage
- Fullscreen custom-view handling and landscape orientation
- HTTPS-only first-party player-page allowlist

## Build status
Source changes are committed on `android-app-foundation`. A GitHub Actions workflow at `.github/workflows/android-build.yml` now runs unit tests and assembles a debug APK on pushes/PRs affecting `android/`, then uploads `criczone-debug-apk` as a 14-day artifact. The workflow has been added but no run result is available yet; the project has not yet been confirmed built or tested, and no APK artifact is currently verified.
