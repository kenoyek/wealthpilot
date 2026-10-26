#!/usr/bin/env python3
"""Deploy the committed web source plus the verified private Android artifact."""
import argparse, base64, hashlib, json, os, pathlib, subprocess, urllib.error, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJECT = os.environ.get("WEALTHPILOT_VERCEL_PROJECT_ID", "prj_S96Tc0y5Ann9xvxuNnyQvGnoYgdw")
def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)
def api(path, payload):
    req = urllib.request.Request("https://api.vercel.com" + path, data=json.dumps(payload).encode(), headers={"Authorization": "Bearer " + os.environ["VERCEL_TOKEN"], "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as response: return json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit("Vercel API request failed with HTTP " + str(error.code)) from None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--web-only", action="store_true", help="Pause Android delivery and deploy the web app without APK artifacts")
    args = parser.parse_args()
    if not os.environ.get("VERCEL_TOKEN"): raise SystemExit("VERCEL_TOKEN is required through secure environment settings.")
    if git("status", "--porcelain").strip(): raise SystemExit("Commit source changes before deployment; do not deploy an unreviewable working tree.")
    apk = ROOT / "artifacts/wealthpilot-debug.apk"
    if not args.web_only and not apk.exists(): raise SystemExit("Run npm run android:build first; the owner download requires the APK artifact.")
    if not args.web_only and apk.stat().st_size > 4 * 1024 * 1024: raise SystemExit("APK exceeds the private download response budget; build with code/resource shrinking.")
    if not args.web_only and apk.read_bytes()[:2] != b"PK": raise SystemExit("The APK is not a valid package archive.")
    tracked = git("ls-files", "-z").decode().strip("\0").split("\0")
    paths = [p for p in tracked if not p.startswith(".env")]
    if not args.web_only: paths.append("artifacts/wealthpilot-debug.apk")
    payload = {
        "name": "wealthpilot", "project": PROJECT, "target": "production",
        "files": [{"file": p, "data": base64.b64encode((ROOT / p).read_bytes()).decode(), "encoding": "base64"} for p in paths],
        "projectSettings": {"framework": "nextjs", "installCommand": "npm ci", "buildCommand": "npm run check:production && npm run build"},
        "meta": {"githubCommitSha": git("rev-parse", "HEAD").decode().strip(), "githubCommitOrg": "kenoyek", "githubCommitRepo": "wealthpilot", "githubCommitRef": "main", "wealthpilotApkSha256": "paused" if args.web_only else hashlib.sha256(apk.read_bytes()).hexdigest()},
    }
    env = api("/v10/projects/" + PROJECT + "/env?upsert=true", [{"key": "WEALTHPILOT_ANDROID_APK_AVAILABLE", "value": "false" if args.web_only else "true", "type": "plain", "target": ["production"]}])
    if env.get("failed"): raise SystemExit("Android availability environment update failed; deployment stopped.")
    result = api("/v13/deployments", payload)
    print(json.dumps({k: result.get(k) for k in ["id", "url", "readyState", "target"]}))
    if not args.web_only: print("APK SHA-256: " + hashlib.sha256(apk.read_bytes()).hexdigest())
if __name__ == "__main__": main()
