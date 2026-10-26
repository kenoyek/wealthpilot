#!/usr/bin/env bash
# Avoid vfs copying a multi-GB base layer dozens of times. No registry writes.
set -euo pipefail
cd "$(dirname "$0")/.."
image=supabase/postgres:17.6.1.075
if [[ "$(docker info --format '{{.Driver}}')" != vfs ]]; then exit 0; fi
if docker image inspect "$image" >/dev/null 2>&1; then exit 0; fi
bash scripts/install-image-tool.sh
case "$(uname -m)" in x86_64) platform=linux/amd64;; aarch64|arm64) platform=linux/arm64;; *) exit 1;; esac
digest=$(.tools/crane digest --platform "$platform" "registry-1.docker.io/$image")
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid image digest' >&2; exit 1; }
reference="registry-1.docker.io/supabase/postgres@$digest"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
.tools/crane config --platform "$platform" "$reference" > "$scratch/config.json"
.tools/crane export --platform "$platform" "$reference" "$scratch/rootfs.tar"
python3 scripts/prepare-db-image.py "$scratch/config.json" "$scratch/rootfs.tar" "$image" "$reference"
