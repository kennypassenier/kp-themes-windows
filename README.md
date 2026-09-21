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
| `windows/launchers/`        | the double-click files of the Windows kit (`Themes\`, `Tools\`)         | the generator |
| `linux/`                    | the Linux scripts; see [linux/README.md](linux/README.md)               | hand          |
| `linux/themes/<theme>/`     | a KDE Plasma colour scheme and a Konsole colour scheme                  | the generator |
| `linux/wsl/`                | Arch in WSL: the root bootstrap and the clone into `~/Projects`         | hand          |

Fonts (`shared/fonts/`, TrueType from `fonts/`) and the PNG wallpapers are
built, not committed:

```sh
npm run build:desktop       # generate, fonts, wallpapers
npm run check:desktop       # part of npm run gates: refuses a generated file that drifted
```

## Which script, when

|                       | Once                                                                                          | To switch theme                 |
| --------------------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| Garuda / Arch         | `desktop/linux/install.sh`                                                                    | `kp-theme lapis`                |
| Windows               | `Tools\Setup WSL (Arch).cmd` (clones this repo into `~/Projects` in WSL and installs the kit) | double-click `Themes\Lapis.cmd` |
| Windows, after a pull | `Tools\Update from repo.cmd`                                                                  |                                 |

The Windows kit lives in `~\.config\kp-themes\`, the Linux command in
`~/.local/bin/kp-theme`. Both remember the last theme (`current.txt`,
`~/.config/kp-themes/current`).
