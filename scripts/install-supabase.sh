#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
version=2.75.0
case "$(uname -m)" in x86_64) architecture=amd64;; aarch64|arm64) architecture=arm64;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
if [[ -x .tools/supabase ]] && [[ "$(.tools/supabase --version 2>/dev/null)" == "$version" ]]; then exit 0; fi
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
asset="supabase_linux_${architecture}.tar.gz"
curl -fsSL "https://github.com/supabase/cli/releases/download/v${version}/supabase_${version}_checksums.txt" -o "$scratch/checksums"
curl -fsSL "https://github.com/supabase/cli/releases/download/v${version}/${asset}" -o "$scratch/$asset"
python3 - "$scratch" "$asset" <<'PY'
import hashlib,sys
from pathlib import Path
p=Path(sys.argv[1]);name=sys.argv[2]
entries=[r.split()[0] for r in (p/'checksums').read_text().splitlines() if r.split()[-1]==name]
assert len(entries)==1 and hashlib.sha256((p/name).read_bytes()).hexdigest()==entries[0], 'Supabase CLI checksum mismatch'
print('Supabase CLI checksum verified.')
PY
mkdir -p .tools
tar -xzf "$scratch/$asset" -C .tools supabase
