#!/usr/bin/env bash
# The theme fonts, from the kp-themes release vendor/PIN names: its fonts.tar,
# every face checked against that release's SHA256SUMS, whose own sha256 is
# pinned. Unpacked into vendor/fonts/ (ignored by git); gates/desktop-fonts.py
# turns them into TrueType under shared/fonts/.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pin() { awk -v k="$1" '$1 == k { print $2 }' "$root/vendor/PIN"; }
v="$(pin version)"; sums="$(pin sums)"
base="https://github.com/kennypassenier/kp-themes/releases/download/v$v"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS"
echo "$sums  $tmp/SHA256SUMS" | sha256sum -c --quiet - || { echo "SHA256SUMS of kp-themes $v does not match vendor/PIN" >&2; exit 1; }
curl -fsSL "$base/fonts.tar" -o "$tmp/fonts.tar"
mkdir -p "$tmp/x"
tar -xf "$tmp/fonts.tar" -C "$tmp/x"
(cd "$tmp/x" && grep ' fonts/' "$tmp/SHA256SUMS" | sha256sum -c --quiet -) || { echo "a face in fonts.tar does not match SHA256SUMS" >&2; exit 1; }
rm -rf "$root/vendor/fonts"
mv "$tmp/x/fonts" "$root/vendor/fonts"
echo "vendor/fonts: $(find "$root/vendor/fonts" -type f | wc -l) files from kp-themes $v, checked"
