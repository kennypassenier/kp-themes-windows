// kp-themes: begin (written by desktop/windows/apply.ps1 or desktop/linux/apply.sh; delete this block to undo)
// Read userChrome.css and userContent.css from the profile's chrome/ folder.
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
// Browser and pages follow the system's dark or light mode, which the theme sets (2 = follow the system).
user_pref("browser.theme.toolbar-theme", 2);
user_pref("browser.theme.content-theme", 2);
user_pref("layout.css.prefers-color-scheme.content-override", 2);
// Windows only: let the Windows backdrop (Mica For Everyone) show through the tab strip.
user_pref("widget.windows.mica", true);
// kp-themes: end
