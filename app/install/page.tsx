import { androidTestBuild } from "@/lib/android/package";
import Link from "next/link";
export default function Install() {
  return (
    <main className="auth">
      <div className="brand">◈ WealthPilot</div>
      <section className="panel">
        <h1>Keep your money close.</h1>
        <p>
          Use WealthPilot from your home screen. Your account and financial
          records stay on the same secure website.
        </p>
        <h2>Android app</h2>
        {process.env.WEALTHPILOT_ANDROID_APK_AVAILABLE === "true" ? (
          <>
            <p>
              Android test build {androidTestBuild.version}. Opens WealthPilot
              in your browser. An internet connection and your owner sign-in are
              required.
            </p>
            <p>
              If the app does not open the website automatically, tap Open in
              browser instead on its launcher screen.
            </p>
            <a className="button" href="/api/android/download">
              Download Android test APK
            </a>
            <p className="muted fine">
              Sign in before downloading. Android may ask you to allow
              installation from your browser. This is a test build, outside
              Google Play.
            </p>
          </>
        ) : (
          <p>
            Android downloads are paused while we focus on the web experience.
            Add the website to your home screen below.
          </p>
        )}
        <h2>Install the website</h2>
        <ol>
          <li>Open WealthPilot in Chrome on Android, or Safari on iPhone.</li>
          <li>Open the browser menu or Share menu.</li>
          <li>Choose Install app or Add to Home Screen.</li>
        </ol>
        <p>
          Internet access is required. Offline financial entry and push
          notifications are not available.
        </p>
        <Link className="button secondary" href="/dashboard">
          Back to WealthPilot
        </Link>
      </section>
    </main>
  );
}
