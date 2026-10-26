# Android delivery status — 2026-10-26

User selected Android/APK as the next phase after confirming the production owner dashboard opens. This advances mobile work before the freelancer/invoicing roadmap phase.

Implemented source: visible AndroidX Custom Tabs launcher with normal-browser fallback (see the 1.0.1 startup replacement below), Android 36 target / Android 7 minimum, separate debug/release package identities, pinned Gradle wrapper and verified local tool installer, optional secure release signing, manual CI artifact workflow, installable web manifest/icons, owner-protected APK download route and install page. Website financial pages/session tokens are not cached by a service worker or copied into native storage.

Verified locally:

- Android debug APK compiles, shrinks and passes APK v2 signature verification (one signer).
- Final APK is about 805 KiB. SHA-256: `02f30a94589ecc17d6e9c82b2e1d59b6b6583f1fb2c5de2e572d969194cd755a`.
- Compiled manifest confirms the exact production HTTPS dashboard URL (redirecting to login when signed out), debug package identity, minimum SDK 24 / target 36, no cleartext traffic, and disabled backups. Only Internet and AndroidX's app-scoped internal receiver permission are declared.
- Android lint passes with no issues. The unsigned release AAB builds successfully; it has not been signed for Play distribution.
- 44 unit tests passed. Type checking, ESLint, formatting and the web production build passed.
- One Chromium mobile browser test passed: page advertises its manifest, manifest/icons load, mobile layout fits, unconfigured signing association trusts no app, and signed-out APK requests redirect to login.

A debug-signed APK is a private test deliverable; unsigned release bundles, source files and a workflow definition are not proof of a Play Store release or device validation. No emulator or physical-device journey has been run. Owner-authenticated APK download still requires the owner's device check after deployment.

Production signing, trusted full-screen association, physical device/emulator tests, offline synchronization and Play submission remain distinct outstanding work. The first test APK deliberately falls back to a browser tab until a permanent release certificate is configured.

## Website delivery

The first mobile web deployment `dpl_8CfRH7cnP3oJJusiJx8BCvfG2w77` completed on Vercel from source `231e722`. Live `/install` shows the Android download, the manifest has the proper content type, signing association remains `[]`, signed-out download returns 307 to login, and direct `/artifacts/wealthpilot-debug.apk` returns 404. A final follow-up build changes native launch to `/dashboard` so an existing browser session can open the dashboard directly, while signed-out users follow normal login.

Final delivery: Vercel production deployment `dpl_CpcgXw38TEqP7WLVgajiRiMExs89` is READY from source `c3f9649`. Deployment metadata records the final APK SHA-256 above, and the deployment-source APK digest matches the local signature-verified artifact. The live Chromium mobile check passes: install/download link, valid PNG icons, no overflow/browser errors and anonymous download denied. The owner can sign in and download at https://wealthpilot-sand.vercel.app/install. Physical-device installation and the owner-authenticated download remain for the owner's device check; no user credentials or sessions were extracted to simulate it.

## Startup replacement — 1.0.1-test

The owner reported that tapping the original APK did nothing. The original device-specific cause is not established from a crash log. The replacement removes the transparent auto-finishing Browser Helper activity in favor of an opaque native launcher with Open/normal-browser fallback controls and visible failure status. It does not register for website VIEW intents, preventing a fallback intent from routing back into this launcher.

- Package stays `com.wealthpilot.app.debug`; versionCode increases to 2 / versionName `1.0.1-test`.
- APK signature verifies, and certificate comparison against the original downloaded build confirms the **same signer**, permitting an in-place update.
- APK SHA-256: `cb0787a34832dd95ed71dbd5ca6540b00c62357c27ebe0396ac9d9952cff27e7` (about 96 KiB).
- Twelve Robolectric tests pass on simulated API 24 and 35: actual activity startup, protected website URL, retained visible launcher, missing browser, unavailable Custom Tabs provider, explicit normal-browser retry, and no repeated auto-open on recreation. These are Android framework simulation tests, not emulator or physical-device results.
- Android lint has zero errors and two minor layout warnings (an ignored pre-28 accessibility-heading attribute and background overdraw). Neither check is suppressed.
- Web type checking, lint, build and one Chromium install/download-boundary journey pass; the install page and filename clearly identify 1.0.1-test.

The replacement must still be installed on the owner's affected phone. No claim of physical-device repair is made until the owner confirms it. Server-side financial data, Neon ownership and credentials are unchanged.
