#!/usr/bin/env bash
# Clones kp-themes into ~/Projects inside WSL, as the user, and runs its Linux
# install. Called by desktop/windows/setup-wsl.ps1 after bootstrap-arch.sh:
#
#   wsl -d archlinux -u <user> --cd <this folder> -- bash ./clone-kp-themes.sh [bundle] [theme]
#
# bundle: "none", or a git bundle with work that is not on GitHub yet (a branch), fetched
# into the clone and checked out. Push it from there with `gh auth login` and
# `git push -u origin <branch>`.
set -euo pipefail

BUNDLE="${1:-}"
# setup-wsl.ps1 passes a Windows path.
case "$BUNDLE" in none) BUNDLE="" ;; *:\\*) BUNDLE="$(wslpath -u "$BUNDLE")" ;; esac
THEME="${2:-}"
URL="${KP_THEMES_URL:-https://github.com/kennypassenier/kp-themes.git}"
DEST="$HOME/Projects/kp-themes"
say() { printf '\n\033[1;35m==>\033[0m \033[1m%s\033[0m\n' "$*"; }

say "$DEST"
mkdir -p "$HOME/Projects"
if [ -d "$DEST/.git" ]; then
    echo "    already cloned; fetching"
    git -C "$DEST" fetch --quiet origin
else
    git clone "$URL" "$DEST"
fi

# Git in WSL signs commits as the same person as Git on Windows, if that is set up.
for key in user.name user.email; do
    if [ -z "$(git config --global "$key" || true)" ] && command -v git.exe >/dev/null 2>&1; then
        value="$(git.exe config --global "$key" 2>/dev/null | tr -d '\r' || true)"
        [ -n "$value" ] && git config --global "$key" "$value" && echo "    git $key: $value (from Git for Windows)"
    fi
done

if [ -n "$BUNDLE" ] && [ -f "$BUNDLE" ]; then
    say "work from the bundle"
    # Every branch in the bundle, under its own name; the first one is checked out.
    branches="$(git bundle list-heads "$BUNDLE" | awk '{print $2}' | sed -n 's#^refs/heads/##p')"
    for b in $branches; do
        if [ "$(git -C "$DEST" rev-parse --abbrev-ref HEAD)" = "$b" ]; then
            git -C "$DEST" pull --ff-only "$BUNDLE" "$b"
        else
            git -C "$DEST" fetch "$BUNDLE" "+$b:$b"
        fi
        echo "    branch $b"
    done
    first="$(printf '%s\n' "$branches" | head -n 1)"
    [ -n "$first" ] && git -C "$DEST" checkout --quiet "$first" && echo "    checked out $first"
fi

bash "$DEST/desktop/linux/install.sh" ${THEME:+--theme "$THEME"}
