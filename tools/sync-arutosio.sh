#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║  SYNC → arutosio.com                                      ║
# ║  Mirrors this repo into the arutosio.com repo and swaps   ║
# ║  the "Aruta.sh" brand for "Arutosio". Files that belong   ║
# ║  only to arutosio.com (CNAME, workflow, site-config.js,   ║
# ║  Backgrounds/, Brand/, …) are never touched.              ║
# ║                                                           ║
# ║  Usage: tools/sync-arutosio.sh [target-dir] [--force]     ║
# ║  Default target: ../arutosio.com next to this repo.       ║
# ╚══════════════════════════════════════════════════════════╝
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$(cd "$SRC/.." && pwd)/arutosio.com"
FORCE=0
for arg in "$@"; do
    case "$arg" in
        --force) FORCE=1 ;;
        *) DEST="$(cd "$arg" && pwd)" ;;
    esac
done

[ -d "$DEST/.git" ] || { echo "✗ $DEST is not a git repository" >&2; exit 1; }
[ "$SRC" != "$DEST" ] || { echo "✗ source and target are the same directory" >&2; exit 1; }

# rsync --delete is destructive: only run on a clean target so every change is reviewable/revertable.
if [ "$FORCE" -eq 0 ] && [ -n "$(git -C "$DEST" status --porcelain)" ]; then
    echo "✗ $DEST has uncommitted changes — commit/stash them or pass --force" >&2
    exit 1
fi

echo "→ Syncing $SRC → $DEST"
rsync -a --delete \
    --exclude '.git/' \
    --exclude '.github/' \
    --exclude '.claude/' \
    --exclude '.mcp.json' \
    --exclude '.nojekyll' \
    --exclude 'CNAME' \
    --exclude 'LICENSE' \
    --exclude 'README.md' \
    --exclude 'tools/' \
    --exclude 'Backgrounds/' \
    --exclude 'Brand/' \
    --exclude 'JavaScript/site-config.js' \
    "$SRC/" "$DEST/"

echo "→ Rebranding Aruta.sh → Arutosio"
# Social handles (twitch/youtube/twitter "aruta.sh"), the Package Store repo URL,
# "Stefano Aruta" and the internal aruta_* storage keys are intentionally left alone.
BRANDED=("$DEST/index.html" "$DEST/manifest.json" "$DEST"/JavaScript/*.js)
perl -CSD -Mutf8 -pi -e '
    s#https://aruta\.sh#https://arutosio.com#g;
    s#Aruta\.sh#Arutosio#g;
    s#ARUTA\.SH#ARUTOSIO#g;
    s#⚜ aruta:~#⚜ arutosio:~#g;
    s#\b(Reame di|Realm of|Reino de|Terminale|Terminal) Aruta\b#$1 Arutosio#g;
    s#\bAruta (Terminal|ターミナル)#Arutosio $1#g;
    s#alt="Aruta"#alt="Arutosio"#g;
' "${BRANDED[@]}"

echo "→ Swapping icons for Brand/ArutosioIcon.ico"
perl -pi -e 's#<link rel="icon" href="data:[^"]*">#<link rel="icon" href="Brand/ArutosioIcon.ico">#' "$DEST/index.html"
perl -0pi -e 's#"src": "data:image/svg\+xml,[^"]*",(\s*)"sizes": "any",(\s*)"type": "image/svg\+xml"#"src": "/Brand/ArutosioIcon.ico",$1"sizes": "256x256 128x128 64x64 48x48 32x32 16x16",$2"type": "image/x-icon"#' "$DEST/manifest.json"

for f in Brand/ArutosioIcon.ico JavaScript/site-config.js CNAME; do
    [ -e "$DEST/$f" ] || echo "⚠ missing $DEST/$f — arutosio.com needs its own copy"
done

echo
echo "→ Remaining aruta.sh mentions (expected: social handles, Package Store URL, comments):"
grep -rnI --exclude-dir=.git --exclude-dir=defaultPackages --exclude-dir=packages --exclude-dir=docs \
    -e 'aruta\.sh' -e 'Aruta\.sh' "$DEST" || echo "  (none)"
echo
echo "✓ Done. Review with: git -C \"$DEST\" status && git -C \"$DEST\" diff --stat"
