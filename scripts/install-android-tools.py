#!/usr/bin/env python3
"""Install checksum-verified Linux x64 Android build tools below ignored .tools/."""
import hashlib, pathlib, shutil, tarfile, urllib.request, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOLS = ROOT / ".tools"
PACKAGES = [
    ("jdk.tar.gz", 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13+9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz', "sha256", 'd7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c'),
    ("gradle.zip", "https://downloads.gradle.org/distributions/gradle-8.14.3-bin.zip", "sha256", "bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531"),
    ("android-cli.zip", "https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip", "sha1", "e025545c62a8e64c7559119566a569fb1dec5f60"),
]
def download(name, url, algorithm, expected):
    target = TOOLS / name
    if not target.exists():
        temporary = target.with_suffix(target.suffix + ".download")
        with urllib.request.urlopen(url, timeout=120) as response, temporary.open("wb") as output:
            shutil.copyfileobj(response, output)
        temporary.rename(target)
    digest = hashlib.new(algorithm)
    with target.open("rb") as data:
        for chunk in iter(lambda: data.read(1048576), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        raise SystemExit("Checksum mismatch for " + name + "; remove the archive and retry")
    return target

def main():
    TOOLS.mkdir(exist_ok=True)
    for name, url, algorithm, expected in PACKAGES:
        archive = download(name, url, algorithm, expected)
        if name == "jdk.tar.gz":
            destination = TOOLS / "android-jdk"
            if not destination.exists():
                destination.mkdir()
                with tarfile.open(archive) as source:
                    source.extractall(destination, filter="data")
        elif name == "gradle.zip":
            if not (TOOLS / "gradle-8.14.3").exists():
                with zipfile.ZipFile(archive) as source: source.extractall(TOOLS)
        else:
            destination = TOOLS / "android-sdk/cmdline-tools/latest"
            if not destination.exists():
                destination.parent.mkdir(parents=True, exist_ok=True)
                with zipfile.ZipFile(archive) as source: source.extractall(destination.parent)
                (destination.parent / "cmdline-tools").rename(destination)
    for executable in [TOOLS / "gradle-8.14.3/bin/gradle", *list((TOOLS / "android-sdk/cmdline-tools/latest/bin").iterdir())]:
        executable.chmod(0o755)
    print("Verified JDK 21, Gradle 8.14.3 and Android CLI installed. Install SDK packages as documented in android/README.md.")
if __name__ == "__main__": main()
