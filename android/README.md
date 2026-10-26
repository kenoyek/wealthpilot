# WealthPilot Android

This is an Android Browser Helper launcher for the existing HTTPS app, not a static export or a WebView with a JavaScript bridge. The supported browser owns sign-in cookies, TLS, navigation and downloads. The backend remains Vercel + Neon with the existing verified-owner checks. No database, provider management or user session credentials are embedded in the APK.

## First private build

The debug package is `com.wealthpilot.app.debug` and is labelled **WealthPilot Test**. It uses a local debug certificate, and is for direct-install testing only. The production website does not trust that debug certificate: Chrome will show its normal Custom Tab toolbar. This is expected. Do not publish a shared/debug signing fingerprint as the release identity.

Requires Android 7+ and an installed compatible browser (current Chrome recommended), network access, and the existing owner account. There is no offline ledger, background sync, push or biometric lock. The app opens the same live site; web releases take effect there without rebuilding Android. Native changes require a new APK.

On the owner’s Android device, open the website in Chrome, sign in, then open **Settings → Install WealthPilot on your phone** and download the test APK. Permit installation from that browser if Android requests it. The downloaded app uses the same owner sign-in. Keep the original test key in the ignored local tools directory to preserve debug updates; a lost key requires uninstalling the previous debug build. Website data remains on the server.

## Linux x64 build

Node 24, Python 3, network access and about 3 GB free disk are needed. The tool installer verifies fixed official JDK/Gradle/Android CLI archives against published checksums. It does not disable TLS or change system installations.

```sh
npm run android:tools
npm run android:sdk
npm run android:build
npm run android:lint
npm run android:bundle
```

The SDK command accepts the licenses for the explicitly selected SDK 36/platform-tools/build-tools packages. Review the Android SDK terms before using them if your organization requires it. SDK/tool caches are under `.tools/` and are ignored. `WEALTHPILOT_ANDROID_JAVA_HOME` can select a full external JDK; `ANDROID_HOME` can select an existing SDK. The runner uses the platform Java CA store when available and the configured HTTPS proxy. Signing keys must never be committed.

Outputs:

- `artifacts/wealthpilot-debug.apk`: signature-verified private test APK.
- `android/app/build/outputs/bundle/release/app-release.aab`: **unsigned** unless all release signing variables are configured. This is not upload-ready without release signing and Play setup.
- Android lint results: `android/app/build/reports/lint-results-debug.html`.

The manual **Android private test build** GitHub workflow can produce downloadable build artifacts. Each fresh CI debug key differs, so those APKs are not a stable release/update channel. No CI run, Play submission, emulator test or physical device test should be inferred from the workflow file.

## Production signing and trusted full-screen mode

The release application ID is `com.wealthpilot.app`. A permanent app signing key and its secure recoverable backup must be established before distribution. Supply these only through secure signing tooling:

- `WEALTHPILOT_ANDROID_KEYSTORE`: path to the keystore.
- `WEALTHPILOT_ANDROID_STORE_PASSWORD`.
- `WEALTHPILOT_ANDROID_KEY_ALIAS`.
- `WEALTHPILOT_ANDROID_KEY_PASSWORD`.

With all four configured, `node scripts/android.mjs assembleRelease` and `npm run android:bundle` sign release artifacts. A partial configuration fails. Without them, release outputs remain unsigned. With Play App Signing, website association must use the **app signing certificate**, not merely the upload certificate.

Set the public `ANDROID_APP_SHA256_CERTIFICATES` Vercel variable to a comma-separated list of colon-delimited SHA-256 release certificate fingerprints. The website publishes only valid values at `/.well-known/assetlinks.json`, for the fixed release package. With no certificate, it returns `[]` (no trusted Android app). Malformed configuration returns 503 instead of trusting a partial list. The manifest’s HTTPS intent filter and app-side web association both point only to `wealthpilot-sand.vercel.app`.

Before a release, verify domain association, same-origin login and email recovery links, Android Back behavior, sign-out, CSV export/downloads, keyboard/insets, accessibility, and unavailable-network behavior on real supported devices. Test future signed APK updates with the same key and increasing `versionCode`. Changing production domain requires coordinated web manifest, Android manifest/default URL and associations. The current APK is not a Play Store release.

## Web deployment with the private APK download

After a verified Android build and committed source, run `python3 scripts/deploy-vercel.py` with the securely injected Vercel management credential. It packages tracked source (excluding environment files) plus the local APK, enables the production download flag, and creates a production deployment. The APK stays outside Git; the server route checks the owner session before streaming it with private/no-store headers. Every future deployment using that flag must include the APK artifact. This script does not change Neon settings or bypass the existing production preflight. It prints only deployment metadata and the public artifact checksum.
