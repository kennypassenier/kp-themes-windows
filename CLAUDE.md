# kp-themes-windows

The kp-themes themes on Windows 11 (Windows Terminal, Oh My Posh, Windhawk, Mica For Everyone, accent, wallpaper, lock screen) and the Arch-in-WSL setup. Split out of kp-themes at 8.0.0 (2026-09-29, kp-themes scope-139).

- Everything user-facing Kenny reads in a conversation is Dutch; code,
  comments, commits and these docs are English.
- The tokens are vendored, never edited: `vendor/kp-themes/` is the unpacked
  `tokens.tar` of the kp-themes release in `vendor/PIN`. Move it with
  `npm run vendor -- <version>`, then `npm run generate`.
- Generated files are never edited by hand: change `gates/generate-desktop.mjs`
  and run `npm run generate`. `npm run check` is the gate (and the commit hook).
- The generator is the same file in kp-themes-windows and kp-themes-linux,
  apart from `PLATFORM`; a change to one belongs in the other too.
- Releases: a `v*` tag; the version is in `package.json` and in every
  generated file's stamp, so bump it and regenerate first.
