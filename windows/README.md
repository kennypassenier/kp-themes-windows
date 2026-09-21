# desktop/windows/

A kp-themes theme on Windows 11: Windows Terminal and the PowerShell prompt,
FireDragon, Mica For Everyone, the accent colour, the wallpaper, the lock and
sign-in screen, and through Windhawk the taskbar, start menu, notification
centre and Explorer.

## The kit

The double-click files run a copy of this folder, the kit, in
`~\.config\kp-themes\`, so a switch never depends on where the repo is.
`install.ps1` makes and refreshes it:

```
~\.config\kp-themes\
  Themes\     one .cmd per theme: the whole desktop in that theme
  Tools\      Install VS Code themes, Context menu (Windows 10 / 11 style),
              Setup WSL (Arch), Update from repo
  windows\    these scripts and themes\<theme>\
  shared\     ..\shared\: FireDragon, Starship, fish, wallpapers, fonts
  linux\wsl\  ..\linux\wsl\: the WSL setup
  vscode\     the VS Code themes
```

## First time

1. `Tools\Setup WSL (Arch).cmd`. The first run installs WSL (administrator,
   then reboot); run it again. It installs Arch, bootstraps it like Garuda,
   clones this repo into `~/Projects/kp-themes` in Arch (the work in
   `kp-themes.bundle` beside the kit is checked out if it is there), builds
   `desktop/` and installs the kit with `install.ps1 -FromWsl`.
2. After a `git pull` in WSL: `Tools\Update from repo.cmd`.

Projects live in WSL (`\\wsl.localhost\archlinux\home\<you>\Projects`), where
Linux tools are fast and nothing needs Windows permissions; VS Code opens them
with the WSL extension.

## Files

| File                 | What                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| `install.ps1`        | the kit, from the WSL clone (`-FromWsl`) or a folder; once, the Windows 10 menu      |
| `apply.ps1`          | a theme switch; `kp.ps1` is a short name for it                                      |
| `setup-wsl.ps1`      | Arch in WSL, the clone in `~/Projects`, the kit                                      |
| `context-menu.ps1`   | `-Style Classic` (Windows 10: everything at once) or `-Style Modern`; HKCU, no admin |
| `install-vscode.ps1` | the 22 VS Code themes as one extension; the active theme stays yours                 |
| `install-fonts.ps1`  | the theme fonts, per user                                                            |
| `msstyles.md`        | what the Windhawk layer cannot reach, and what it costs to go there                  |
| `themes/<theme>/`    | generated, see below                                                                 |
| `windhawk-accent/`   | generated: one Windhawk set that follows the accent colour instead of a theme        |
| `launchers/`         | generated: the kit's `Themes\` and `Tools\`                                          |

| Generated per theme   | Read by                      | Where `apply.ps1` puts it                                   |
| --------------------- | ---------------------------- | ----------------------------------------------------------- |
| `terminal.json`       | Windows Terminal             | merged into `settings.json`: scheme, window theme, defaults |
| `prompt.omp.json`     | Oh My Posh                   | `~\.config\kp-themes\prompt.omp.json`, loaded by `$PROFILE` |
| `mica-settings.json`  | Mica For Everyone            | its `LocalState\settings.json`                              |
| `accent.reg`          | Windows                      | imported: accent colour, dark or light mode, transparency   |
| `personalization.reg` | Windows (PersonalizationCSP) | imported: desktop and lock screen picture (needs admin)     |
| `windhawk.reg`        | Windhawk's styler mods       | imported under HKLM (needs admin)                           |
| `windhawk/*.yaml`     | you, by hand                 | the same styles as `windhawk.reg`, to paste                 |
| `start.svg`           | the taskbar styler           | rendered to `start.png`, the start button                   |

`apply.ps1 -Skip accent,wallpaper` leaves steps out, `-Only terminal` runs one,
`-DryRun` shows what would change. Every file it replaces that kp-themes did not
write is kept once as `<file>.kp-backup-<timestamp>`.

## What a theme cannot reach

The classic Win32 parts (the file list in old dialogs, scrollbars) are drawn
from a `.msstyles` visual style, which is not generated here; see
[msstyles.md](msstyles.md).
