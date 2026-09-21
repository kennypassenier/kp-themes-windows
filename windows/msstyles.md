# The classic Win32 layer: visual styles

Everything the generator writes is a colour a program reads from a file it
owns. The parts of Windows that are older than that — the file list in
Explorer, the navigation pane, the scrollbars, the old dialogs — are drawn
from a **visual style** (`.msstyles`), which is a compiled resource, not a
stylesheet. It cannot be generated from tokens, so this layer means picking an
existing theme and accepting what its author chose.

## What it costs

- Windows only loads a visual style that Microsoft signed. Third-party styles
  need a patcher: [SecureUxTheme](https://github.com/namazso/SecureUxTheme),
  which hooks the theme service in memory rather than patching system files.
  That is the least invasive of the patchers, but it is still a hook into a
  system service, and it needs administrator rights.
- A Windows feature update can break a visual style, or SecureUxTheme itself,
  and the desktop then falls back to the default theme. Make a restore point
  first.
- Visual styles are made for one Windows build. A style for 22H2 on 25H2 gives
  wrong metrics and black rectangles. Always check the build the author names.

## Steps, if you want it

1. Make a restore point: `Create a restore point` in the start menu → `Create`.
2. Install SecureUxTheme from its
   [releases](https://github.com/namazso/SecureUxTheme/releases), tick
   "Patch" and reboot.
3. Copy the style's `.theme` file and its folder into `C:\Windows\Resources\Themes`.
4. Pick it under Settings → Personalisation → Themes, or in SecureUxTheme itself.

## Styles worth looking at for a Garuda-like desktop

Dark and purple, which is what synthwave and cyberpunk need:

- [Windows 11 dark-purple by Thakesh](https://www.deviantart.com/thakesh/art/Windows-11-dark-purple-1049013443) —
  closest to Garuda's Dr460nized in hue.
- [Full Dark Theme for Windows 11 and 10 by protheme](https://www.deviantart.com/protheme/art/Full-Dark-Theme-for-Windows-11-and-10-1263891809) —
  neutral black, safer with a light accent, and pairs with any of the 22 themes.
- [10ThemeFor11 by Sand216](https://github.com/Sand216/10ThemeFor11) — not
  purple, but open source, so you can see what it changes before you run it.

None of these follow the accent colour the way the Windhawk layer does, so the
match with a theme is approximate: pick one dark style and leave it, and let the
accent colour carry the theme.

## The cheaper half

Two things give most of the effect without a patcher, and both are already
generated:

- **Mica For Everyone** puts the backdrop and a dark title bar on old windows.
- **The accent colour** (`accent.reg`) colours selection, focus, and the
  highlight in the file list, which is most of what the eye reads as "themed".
