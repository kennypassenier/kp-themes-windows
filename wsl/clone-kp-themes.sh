#!/usr/bin/env bash
# Clones kp-themes-linux and kp-themes-windows into ~/Projects inside WSL, as
# the user, and runs the Linux
# install. Called by windows/setup-wsl.ps1 after bootstrap-arch.sh; a bundle
# (work not on GitHub yet) goes into the kp-themes-windows clone:
#
#   wsl -d archlinux -u <user> --cd <this folder> -e bash ./clone-kp-themes.sh [bundle] [theme]
#
# bundle: "none", or a git bundle with work that is not on GitHub yet (a branch), fetched
# into the clone and checked out. Push it from there with `gh auth login` and
# `git push -u origin <branch>`.
set -euo pipefail

# setup-wsl.ps1 hands over KP_LOG_DIR (%LOCALAPPDATA%\kp-themes\logs): keep a copy of everything.
if [ -n "${KP_LOG_DIR:-}" ] && mkdir -p "$KP_LOG_DIR" 2>/dev/null; then
    exec > >(tee -a "$KP_LOG_DIR/clone-kp-themes-$(date +%Y%m%d-%H%M%S).log") 2>&1
fi
# shellcheck disable=SC2154 # rc is set inside the trap
trap 'rc=$?; echo "clone-kp-themes.sh: stopped at line $LINENO: $BASH_COMMAND (exit $rc)" >&2' ERR

BUNDLE="${1:-}"
# setup-wsl.ps1 passes a Windows path.
case "$BUNDLE" in none) BUNDLE="" ;; *:\\*) BUNDLE="$(wslpath -u "$BUNDLE")" ;; esac
THEME="${2:-}"
BASE="${KP_THEMES_BASE:-https://github.com/kennypassenier}"
LINUX="$HOME/Projects/kp-themes-linux"
DEST="$HOME/Projects/kp-themes-windows"
say() { printf '\n\033[1;35m==>\033[0m \033[1m%s\033[0m\n' "$*"; }

mkdir -p "$HOME/Projects"
for repo in "$LINUX" "$DEST"; do
    say "$repo"
    if [ -d "$repo/.git" ]; then
        echo "    already cloned; fetching"
        git -C "$repo" fetch --quiet origin
    else
        git clone "$BASE/$(basename "$repo").git" "$repo"
    fi
done

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

say "build: kp-themes-windows' fonts and wallpapers"
(cd "$DEST" && node gates/generate-desktop.mjs --check >/dev/null && scripts/fetch-fonts.sh && python3 gates/desktop-fonts.py && node gates/render-wallpapers.mjs >/dev/null)

bash "$LINUX/linux/install.sh" ${THEME:+--theme "$THEME"}
