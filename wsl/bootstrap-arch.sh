#!/usr/bin/env bash
# The root half of turning a fresh Arch Linux WSL distro into a Garuda-like
# dev shell: pacman settings, Chaotic-AUR and paru, the CLI tools a Garuda
# install ships, the user, and /etc/wsl.conf. Run as root, once, by
# desktop/windows/setup-wsl.ps1:
#
#   wsl -d archlinux -u root --cd <this folder> -- bash ./bootstrap-arch.sh <user>
#
# The user half (fish config, fonts, the theme) is desktop/linux/install.sh,
# which setup-wsl.ps1 runs from the clone in ~/Projects/kp-themes afterwards.
# Safe to run again: steps check before they change anything.
set -euo pipefail

USERNAME="${1:-kenny}"
say() { printf '\n\033[1;35m==>\033[0m \033[1m%s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
    echo "run as root (wsl -u root)" >&2
    exit 1
fi

say "pacman: keyring, colour, parallel downloads"
pacman-key --init >/dev/null 2>&1 || true
pacman-key --populate archlinux >/dev/null
sed -i 's/^#Color/Color/; s/^#\?ParallelDownloads.*/ParallelDownloads = 8/' /etc/pacman.conf
grep -q '^ILoveCandy' /etc/pacman.conf || sed -i '/^Color/a ILoveCandy' /etc/pacman.conf
pacman -Syu --noconfirm

say "base tools"
pacman -S --needed --noconfirm \
    base-devel git github-cli openssh sudo man-db man-pages less which wget curl unzip zip \
    fish starship eza bat expac fastfetch ripgrep fd zoxide fzf btop micro neovim tealdeer \
    python python-pip nodejs npm rustup \
    python-fonttools python-brotli librsvg

say "locale"
sed -i 's/^#en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen
locale-gen >/dev/null
echo 'LANG=en_US.UTF-8' >/etc/locale.conf

say "Chaotic-AUR (the repo Garuda builds on)"
if ! grep -q '^\[chaotic-aur\]' /etc/pacman.conf; then
    pacman-key --recv-key 3056513887B78AEB --keyserver keyserver.ubuntu.com
    pacman-key --lsign-key 3056513887B78AEB
    pacman -U --noconfirm \
        'https://cdn-mirror.chaotic.cx/chaotic-aur/chaotic-keyring.pkg.tar.zst' \
        'https://cdn-mirror.chaotic.cx/chaotic-aur/chaotic-mirrorlist.pkg.tar.zst'
    printf '\n[chaotic-aur]\nInclude = /etc/pacman.d/chaotic-mirrorlist\n' >>/etc/pacman.conf
fi
pacman -Syu --noconfirm
pacman -S --needed --noconfirm paru
pacman -S --needed --noconfirm fnm || echo "fnm not found; install a Node manager later with paru"

say "user $USERNAME"
if ! id -u "$USERNAME" >/dev/null 2>&1; then
    useradd -m -G wheel -s /usr/bin/fish "$USERNAME"
    echo "Choose a Linux password for $USERNAME (used by sudo):"
    passwd "$USERNAME"
else
    usermod -aG wheel -s /usr/bin/fish "$USERNAME"
fi
echo '%wheel ALL=(ALL:ALL) ALL' >/etc/sudoers.d/10-wheel
chmod 440 /etc/sudoers.d/10-wheel

say "/etc/wsl.conf: systemd, default user"
cat >/etc/wsl.conf <<EOF
[boot]
systemd=true

[user]
default=$USERNAME

[interop]
appendWindowsPath=true
EOF

say "done"
echo "Root setup done; setup-wsl.ps1 continues as $USERNAME."
