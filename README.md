# kp-themes-windows

The twenty-two [kp-themes](https://github.com/kennypassenier/kp-themes) themes
as a Windows 11 desktop: Windows Terminal and the PowerShell prompt,
FireDragon, Mica For Everyone, the accent colour, the wallpaper, the lock and
sign-in screen, and through Windhawk the taskbar, start menu, notification
centre, Explorer and ordinary windows and dialogs.

| Folder                    | What                                                                    | Written by    |
| ------------------------- | ----------------------------------------------------------------------- | ------------- |
| `windows/`                | the scripts; see [windows/README.md](windows/README.md)                 | hand          |
| `windows/themes/<theme>/` | Windows Terminal, Oh My Posh, Mica For Everyone, `.reg` files, Windhawk | the generator |
| `windows/launchers/`      | the double-click files, `Themes\` and `Tools\`                          | the generator |
| `shared/<theme>/`         | FireDragon, Starship, fish colours, the wallpapers                      | the generator |
| `wsl/`                    | Arch in WSL: the root bootstrap and the clone into `~/Projects`         | hand          |

The Linux half, and the fish and Konsole setup inside WSL, is
[kp-themes-linux](https://github.com/kennypassenier/kp-themes-linux); the VS
Code themes are [kp-themes-vscode](https://github.com/kennypassenier/kp-themes-vscode).

## Use

Pin `windows\launchers\` in Explorer and double-click a theme. On a fresh
machine, `windows\launchers\Tools\Setup WSL (Arch).cmd` from a copy of this
repository sets up Arch in WSL, clones this repository and kp-themes-linux into
`~/Projects` and applies a theme; [windows/README.md](windows/README.md) has the
whole story.

## Where the colours come from

Nothing here is typed by hand. `gates/generate-desktop.mjs` reads the tokens of
[kp-themes](https://github.com/kennypassenier/kp-themes) from
`vendor/kp-themes/`: the unpacked `tokens.tar` of the release `vendor/PIN`
names, with its sha256. `npm run check` rebuilds that tar from the copy and
refuses a mismatch, then refuses any generated file that drifted from the
tokens. A colour change in kp-themes reaches this repository only when the pin
moves:

```sh
npm run vendor -- 8.1.0     # download, verify, unpack, rewrite vendor/PIN
npm run generate            # then read the diff and commit
```

The fonts and the PNG wallpapers are built, not committed:
`npm run build` (generate, `scripts/fetch-fonts.sh` checks every face against
the pinned release's `SHA256SUMS`, TrueType, wallpapers). It needs node,
python-fonttools, python-brotli and librsvg.

The commit hook runs `npm run check`; enable it once per clone with
`git config core.hooksPath .githooks`.

## History

This repository was split out of kp-themes at 8.0.0 (2026-09-29) with its
history: `git log` shows the kp-themes commits that touched these files, with
their original messages and IDs.
