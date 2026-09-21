# desktop/

The twenty-two themes as a whole desktop, on Windows and on Garuda or Arch
Linux: the terminal, the prompt, FireDragon, the colours of the system, the
wallpaper and the lock screen. Everything a theme sets is generated from
`themes/<name>/tokens.json` by `gates/generate-desktop.mjs`; the scripts that
put it in place are hand-written.

| Folder                      | What                                                                    | Written by    |
| --------------------------- | ----------------------------------------------------------------------- | ------------- |
| `shared/<theme>/`           | FireDragon's userChrome and userContent, Starship, fish, the wallpapers | the generator |
| `shared/firedragon-user.js` | the prefs both platforms add to FireDragon's `user.js`                  | hand          |
| `windows/`                  | the Windows scripts; see [windows/README.md](windows/README.md)         | hand          |
| `windows/themes/<theme>/`   | Windows Terminal, Oh My Posh, Mica For Everyone, `.reg` files, Windhawk | the generator |
| `windows/launchers/`        | the double-click files, `Themes\` and `Tools\`                          | the generator |
| `linux/`                    | the Linux scripts; see [linux/README.md](linux/README.md)               | hand          |
| `linux/themes/<theme>/`     | a KDE Plasma colour scheme and a Konsole colour scheme                  | the generator |
| `linux/wsl/`                | Arch in WSL: the root bootstrap and the clone into `~/Projects`         | hand          |

Fonts (`shared/fonts/`, TrueType from `fonts/`) and the PNG wallpapers are
built, not committed:

```sh
npm run build:desktop       # generate, fonts, wallpapers
npm run check:desktop       # refuses a generated file that drifted (one of the gates)
```

## Which script, when

|                  | Once                                                                                               | To switch theme                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Garuda / Arch    | `desktop/linux/install.sh`                                                                         | `kp-theme lapis`                                          |
| Windows          | `desktop\windows\launchers\Tools\Setup WSL (Arch).cmd` (clones this repo into `~/Projects` in WSL) | double-click `desktop\windows\launchers\Themes\Lapis.cmd` |
| After a git pull | `desktop/linux/install.sh --build-only` (fonts and wallpapers)                                     |                                                           |

On Windows the launchers run straight from the clone in WSL
(`\\wsl.localhost\archlinux\home\<you>\Projects\kp-themes`); `apply.ps1`
copies what a switch needs to `%LOCALAPPDATA%\kp-themes\run` and runs from
there, so its administrator half never depends on WSL. That folder also holds
the theme applied last, the Oh My Posh config and the logs. The Linux command
is `~/.local/bin/kp-theme`; it remembers the theme in `~/.config/kp-themes/current`.
