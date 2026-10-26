# Android delivery status — 2026-10-26

User selected Android/APK as the next phase after confirming the production owner dashboard opens. This advances mobile work before the freelancer/invoicing roadmap phase.

Implemented source: Android Browser Helper launcher, Android 36 target / Android 7 minimum, separate debug/release package identities, pinned Gradle wrapper and verified local tool installer, optional secure release signing, manual CI artifact workflow, installable web manifest/icons, owner-protected APK download route and install page. Website financial pages/session tokens are not cached by a service worker or copied into native storage.

Verified locally:

- Android debug APK compiles, shrinks and passes APK v2 signature verification (one signer).
- Final APK is about 803 KiB. SHA-256: `f0e24cbd49c8d7594b770d501b140b21909a09fe2b0033d6607701785e82891e`.
- Compiled manifest confirms the exact production HTTPS login URL, debug package identity, minimum SDK 24 / target 36, no cleartext traffic, and disabled backups. Only Internet and AndroidX's app-scoped internal receiver permission are declared.
- Android lint passes with no issues. The unsigned release AAB builds successfully; it has not been signed for Play distribution.
- 44 unit tests passed. Type checking, ESLint, formatting and the web production build passed.
- One Chromium mobile browser test passed: page advertises its manifest, manifest/icons load, mobile layout fits, unconfigured signing association trusts no app, and signed-out APK requests redirect to login.

A debug-signed APK is a private test deliverable; unsigned release bundles, source files and a workflow definition are not proof of a Play Store release or device validation. No emulator or physical-device journey has been run. Owner-authenticated APK download still requires the owner's device check after deployment.

Production signing, trusted full-screen association, physical device/emulator tests, offline synchronization and Play submission remain distinct outstanding work. The first test APK deliberately falls back to a browser tab until a permanent release certificate is configured.
