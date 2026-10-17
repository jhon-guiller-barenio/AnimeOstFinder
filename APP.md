# SakuraSound apps

## Install the web app
Deploy this branch to the existing Vercel project. Open SakuraSound in Chrome or Edge, open the SakuraSound menu, and choose **Install app**. On iPhone use Safari → Share → Add to Home Screen. Search and music require internet; only a reconnect page is available offline. Existing login, favorites, APIs and playback stay on the live site.

## Android APK
The Android project uses Google's Android Browser Helper (Trusted Web Activity), keeping browser-based authentication and media support. A compatible browser such as Chrome must be installed. It opens the live production site, even when built from a preview branch.

Open GitHub → Actions → **Build SakuraSound Android** → the successful run → download **SakuraSound-Android-test** under Artifacts. Unzip it and install `app-debug.apk` on Android, allowing installation from that source when Android asks. This is a test-signed APK, not a Play Store release.

The artifact also includes `assetlinks.json`. Deploy that exact file to `/.well-known/assetlinks.json` on SakuraSound to verify ownership and remove the browser toolbar. Without verification the APK still opens with browser controls. The automatically generated test key changes between clean runners, so verification applies only to that APK. A replacement APK with another key may require uninstalling the old test app.

For distribution, create and securely retain a release signing key, configure release signing outside tracked source, increment versionCode for updates, build a signed release APK/AAB, and deploy assetlinks.json containing the release certificate SHA-256. For Google Play, use the Play App Signing certificate fingerprint. Never commit signing keys or passwords.

Local build: install Android SDK 35, Java 17 and Gradle 8.11.1, then run `gradle :app:assembleDebug` inside `android/`. Android Studio can also import that directory. No Android SDK or Gradle wrapper is bundled.

## Verification limits
Device checks are still required for Clerk login/logout, external provider redirects, embedded playback, downloads, back navigation, and reconnect behavior. This wrapper does not add native background playback, offline songs, or download permissions. It preserves browser handling of those features. Store publication requires separate signing and review.
