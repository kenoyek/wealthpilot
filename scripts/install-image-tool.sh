#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -x .tools/crane ]]; then exit 0; fi
case "$(uname -m)" in x86_64) architecture=x86_64;; aarch64|arm64) architecture=arm64;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
asset="go-containerregistry_Linux_${architecture}.tar.gz"
curl -fsSL https://github.com/google/go-containerregistry/releases/download/v0.20.3/checksums.txt -o "$scratch/checksums"
curl -fsSL "https://github.com/google/go-containerregistry/releases/download/v0.20.3/$asset" -o "$scratch/$asset"
python3 - "$scratch" "$asset" <<'PY'
from pathlib import Path
import hashlib,sys
p=Path(sys.argv[1]);name=sys.argv[2]
expected=[r.split()[0] for r in (p/'checksums').read_text().splitlines() if r.split()[-1]==name]
assert len(expected)==1 and hashlib.sha256((p/name).read_bytes()).hexdigest()==expected[0], 'crane checksum mismatch'
print('Registry tool checksum verified.')
PY
mkdir -p .tools
tar -xzf "$scratch/$asset" -C .tools crane
