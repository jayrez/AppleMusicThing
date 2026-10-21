#!/bin/sh
# Builds the store upload zip for the browser extension.
# The Chrome Web Store and Edge Add-ons need manifest.json at the root of the zip.
# Usage: store/package.sh   (from anywhere)   →   store/dist/now-playing-bridge-v<version>.zip
set -e
cd "$(dirname "$0")/.."

VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' extension/manifest.json | head -1)
OUT="store/dist/now-playing-bridge-v$VERSION.zip"

mkdir -p store/dist
rm -f "$OUT"
(cd extension && zip -qr -X "../$OUT" . -x '.*' -x '*/.*' -x '__MACOSX/*')

echo "Built $OUT"
unzip -l "$OUT"
