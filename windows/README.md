# desktop/windows/

A kp-themes theme on Windows 11: Windows Terminal and the PowerShell prompt,
FireDragon, Mica For Everyone, the accent colour, the wallpaper, the lock and
sign-in screen, and through Windhawk the taskbar, start menu, notification
centre and Explorer.

## Where it runs

Everything runs from the repo, which lives in WSL
(`\\wsl.localhost\archlinux\home\<you>\Projects\kp-themes`): pin
`desktop\windows\launchers\` in Explorer and double-click from there.

```
desktop\windows\launchers\
  Themes\   one .cmd per theme: the whole desktop in that theme
  Tools\    Install VS Code themes, Context menu (Windows 10 / 11 style), Setup WSL (Arch)
```

A switch copies `desktop\windows` and `desktop\shared` to
`%LOCALAPPDATA%\kp-themes\run` (only what changed) and runs from that copy, so
the elevated half (Windhawk, the lock screen) never reads from WSL.
`%LOCALAPPDATA%\kp-themes\` also keeps `current.txt`, the Oh My Posh config
`prompt.omp.json` and `logs\`.

## First time

1. From a copy of this repo on the Windows disk (a zip from GitHub will do):
   `desktop\windows\launchers\Tools\Setup WSL (Arch).cmd`. The first run
   installs WSL (administrator, then reboot); run it again. It installs Arch,
   bootstraps it like Garuda, clones this repo into `~/Projects/kp-themes`,
   builds the fonts and wallpapers there and applies the theme from the clone.
2. After a `git pull` in WSL: `desktop/linux/install.sh --build-only`.

Projects live in WSL, where Linux tools are fast and nothing needs Windows
permissions; VS Code opens them with the WSL extension.

## Files

| File                 | What                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| `apply.ps1`          | a theme switch; `kp.ps1` is a short name for it                                      |
| `setup-wsl.ps1`      | Arch in WSL and the clone in `~/Projects`                                            |
| `context-menu.ps1`   | `-Style Classic` (Windows 10: everything at once) or `-Style Modern`; HKCU, no admin |
| `install-vscode.ps1` | the 22 VS Code themes as one extension; the active theme stays yours                 |
| `install-fonts.ps1`  | the theme fonts, per user                                                            |
| `msstyles.md`        | what the Windhawk layer cannot reach, and what it costs to go there                  |
| `themes/<theme>/`    | generated, see below                                                                 |
| `windhawk-accent/`   | generated: one Windhawk set that follows the accent colour instead of a theme        |
| `launchers/`         | generated: the double-click files, `Themes\` and `Tools\`                            |

| Generated per theme   | Read by                      | Where `apply.ps1` puts it                                        |
| --------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `terminal.json`       | Windows Terminal             | merged into `settings.json`: scheme, window theme, defaults      |
| `prompt.omp.json`     | Oh My Posh                   | `%LOCALAPPDATA%\kp-themes\prompt.omp.json`, loaded by `$PROFILE` |
| `mica-settings.json`  | Mica For Everyone            | its `LocalState\settings.json`                                   |
| `accent.reg`          | Windows                      | imported: accent colour, dark or light mode, transparency        |
| `personalization.reg` | Windows (PersonalizationCSP) | imported: desktop and lock screen picture (needs admin)          |
| `windhawk.reg`        | Windhawk's styler mods       | imported under HKLM (needs admin)                                |
| `windhawk/*.yaml`     | you, by hand                 | the same styles as `windhawk.reg`, to paste                      |
| `start.svg`           | the taskbar styler           | rendered to `start.png`, the start button                        |

`apply.ps1 -Skip accent,wallpaper` leaves steps out, `-Only terminal` runs one,
`-DryRun` shows what would change. Every file it replaces that kp-themes did not
write is kept once as `<file>.kp-backup-<timestamp>`.

## What a theme cannot reach

The classic Win32 parts (the file list in old dialogs, scrollbars) are drawn
from a `.msstyles` visual style, which is not generated here; see
[msstyles.md](msstyles.md).
