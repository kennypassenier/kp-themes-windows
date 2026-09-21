// The twenty-two themes as a desktop, on Windows and on Garuda/Arch Linux.
//
//   desktop/shared/<theme>/          both platforms: FireDragon's userChrome and
//                                    userContent, Starship, fish colours, wallpapers
//   desktop/windows/themes/<theme>/  Windows Terminal, Oh My Posh, Mica For Everyone,
//                                    accent and lock screen .reg, Windhawk styles
//   desktop/linux/themes/<theme>/    a KDE Plasma colour scheme, a Konsole colour scheme
//
// The pattern is the one ha/, vscode/ and tui/ already follow: a fixed
// vocabulary on the far side, our token names on the near side, no colour
// typed twice, and a `--check` that refuses a copy that has drifted from
// the tokens. Two sources are read, never re-derived:
//
//   css/themes.css           every token and derived state, via derivedBlock()
//   vscode/kp-*.json         the sixteen ANSI colours, so VS Code, Windows
//                            Terminal and Konsole show the same palette
//
// What is NOT generated is hand-written beside the output: the install and
// apply scripts of each platform (desktop/windows/*.ps1, desktop/linux/*.sh)
// and desktop/shared/firedragon-user.js.
//
// Usage:
//   node gates/generate-desktop.mjs           write desktop/
//   node gates/generate-desktop.mjs --check   exit 1 if anything would change

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { themes } from './check-invariants.mjs';
import { derivedBlock, rgbOf } from './generate-tui-palette.mjs';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('../desktop/', import.meta.url);
const VERSION = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8')).version;

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

/** @typedef {[number, number, number]} Rgb */

/** @param {Rgb} rgb */
const hex = ([r, g, b]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** @param {string} value  #RRGGBB or #RRGGBBAA @returns {{rgb: Rgb, alpha: number}} */
function parseHex(value) {
    const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
    if (m === null) throw new Error(`not a hex colour: ${value}`);
    const n = Number.parseInt(m[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: m[2] ? Number.parseInt(m[2], 16) / 255 : 1 };
}

/** A translucent colour laid over an opaque ground, as the eye sees it. @param {string} top @param {Rgb} ground @returns {Rgb} */
function over(top, ground) {
    const { rgb, alpha } = parseHex(top);
    return /** @type {Rgb} */ (rgb.map((c, i) => Math.round(c * alpha + ground[i] * (1 - alpha))));
}

/** @param {Rgb} rgb @param {number} a */
const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

/** Move towards white (amount > 0) or black (amount < 0), 0..1. @param {Rgb} rgb @param {number} amount @returns {Rgb} */
function shade(rgb, amount) {
    const target = amount > 0 ? 255 : 0;
    const t = Math.abs(amount);
    return /** @type {Rgb} */ (rgb.map((c) => Math.round(c + (target - c) * t)));
}

/* ------------------------------------------------------------------ */
/* The theme as the desktop sees it                                    */
/* ------------------------------------------------------------------ */

/**
 * The roles a desktop paints, each one token. The left side is ours to
 * name; the right side is the package's vocabulary.
 */
const ROLES = {
    ground: 'background', // the desktop, the terminal, the bar's glass
    deep: 'sidebar-background', // one step below the ground: tab rows, title bars
    ink: 'foreground',
    muted: 'muted-foreground',
    surface: 'card',
    raised: 'popover',
    hover: 'secondary-hover',
    line: 'border',
    lineStrong: 'border-strong',
    signal: 'primary', // Garuda's pink: the one colour that says "this is the theme"
    signalInk: 'primary-foreground',
    signalHover: 'primary-hover',
    accent: 'accent', // Garuda's cyan
    violet: 'chart-4', // the third meter colour
    ok: 'success-foreground',
    warn: 'warning-foreground',
    danger: 'destructive',
    heroInk: 'surface-hero-fg-2',
};

/**
 * @param {{name: string, tokens: Record<string, string>}} theme
 */
function load(theme) {
    const values = { ...theme.tokens, ...derivedBlock(theme.name) };
    /** @type {Record<keyof typeof ROLES, Rgb>} */
    const c = /** @type {any} */ ({});
    for (const [role, token] of Object.entries(ROLES)) {
        const value = values[token];
        if (value === undefined) throw new Error(`${theme.name}: --${token} is missing (role ${role})`);
        c[/** @type {keyof typeof ROLES} */ (role)] = rgbOf(value);
    }
    const raw = JSON.parse(readFileSync(new URL(`themes/${theme.name}/tokens.json`, ROOT), 'utf8'));
    const vscodePath = new URL(`vscode/kp-${theme.name}-color-theme.json`, ROOT);
    let vscode;
    try {
        vscode = JSON.parse(readFileSync(vscodePath, 'utf8')).colors;
    } catch {
        throw new Error(`${theme.name}: vscode/kp-${theme.name}-color-theme.json is missing. Run \`npm run generate:vscode\` first.`);
    }
    return {
        name: theme.name,
        label: raw.label ?? theme.name,
        dark: values['color-scheme'] === 'dark',
        shape: shapeOf(values),
        c,
        vscode,
    };
}

/**
 * The theme's geometry, read from the same tokens the web register reads:
 * the corner radius, the notch cut into buttons and plates (0 when the theme
 * has none), and the first family of each font stack, which is the one the
 * theme is drawn in (desktop/shared/fonts/ carries it as TrueType).
 * @param {Record<string, string>} values
 */
function shapeOf(values) {
    /** A length in px; rem is 16px, the browser default the themes assume. @param {string | undefined} v */
    const px = (v) => {
        const m = /^(-?[\d.]+)(px|rem)?$/.exec(String(v ?? '0').trim());
        if (m === null) return 0;
        return Math.round(Number(m[1]) * (m[2] === 'rem' ? 16 : 1));
    };
    /** The first family of a CSS font stack. @param {string | undefined} stack */
    const first = (stack) =>
        String(stack ?? '')
            .split(',')[0]
            .trim()
            .replace(/^['"]|['"]$/g, '');
    return {
        radius: px(values.radius),
        notch: px(values['fx-notch']),
        body: first(values['theme-font-body']),
        display: first(values['theme-font-display']),
        mono: first(values['theme-font-mono']),
    };
}

/** @typedef {ReturnType<typeof load>} Desk */

/* ------------------------------------------------------------------ */
/* Windows Terminal                                                    */
/* ------------------------------------------------------------------ */

const ANSI = [
    ['black', 'Black'],
    ['red', 'Red'],
    ['green', 'Green'],
    ['yellow', 'Yellow'],
    ['blue', 'Blue'],
    ['purple', 'Magenta'],
    ['cyan', 'Cyan'],
    ['white', 'White'],
];

/** @param {Desk} d */
function terminal(d) {
    const v = d.vscode;
    const ground = parseHex(v['terminal.background']).rgb;
    /** @type {Record<string, string>} */
    const scheme = {
        name: `KP ${d.label}`,
        background: hex(ground),
        foreground: hex(parseHex(v['terminal.foreground']).rgb),
        cursorColor: hex(parseHex(v['terminalCursor.foreground']).rgb),
        // Windows Terminal takes no alpha here: lay it over the ground.
        selectionBackground: hex(over(v['terminal.selectionBackground'], ground)),
    };
    for (const [wt, code] of ANSI) {
        scheme[wt] = hex(parseHex(v[`terminal.ansi${code}`]).rgb);
        scheme[`bright${wt[0].toUpperCase()}${wt.slice(1)}`] = hex(parseHex(v[`terminal.ansiBright${code}`]).rgb);
    }
    const { c } = d;
    // The window around the scheme: tab row one step below the ground,
    // the selected tab on the ground itself, so the tab reads as a
    // continuation of the terminal under it.
    const theme = {
        name: `KP ${d.label}`,
        tab: {
            background: `${hex(c.ground)}FF`,
            unfocusedBackground: `${hex(c.deep)}FF`,
            showCloseButton: 'hover',
            iconStyle: 'default',
        },
        tabRow: { background: `${hex(c.deep)}FF`, unfocusedBackground: `${hex(c.deep)}FF` },
        window: {
            applicationTheme: d.dark ? 'dark' : 'light',
            useMica: false,
            rainbowFrame: false,
            frame: `${hex(c.signal)}FF`,
            unfocusedFrame: `${hex(c.line)}FF`,
        },
    };
    return { $generated: `kp-themes ${VERSION} (gates/generate-desktop.mjs). Do not edit.`, scheme, theme };
}

/* ------------------------------------------------------------------ */
/* FireDragon / Firefox                                                */
/* ------------------------------------------------------------------ */

/** @param {Desk} d */
function userChrome(d) {
    const { c } = d;
    return `/* GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) — KP ${d.label}. Do not edit.
   Needs toolkit.legacyUserProfileCustomizations.stylesheets = true (desktop/shared/firedragon-user.js). */

:root,
:root[lwtheme],
:root[lwtheme-image],
:root[lwt-default-theme-in-dark-mode] {
    --kp-ground: ${hex(c.ground)};
    --kp-deep: ${hex(c.deep)};
    --kp-surface: ${hex(c.surface)};
    --kp-raised: ${hex(c.raised)};
    --kp-hover: ${hex(c.hover)};
    --kp-ink: ${hex(c.ink)};
    --kp-muted: ${hex(c.muted)};
    --kp-line: ${hex(c.line)};
    --kp-signal: ${hex(c.signal)};
    --kp-signal-ink: ${hex(c.signalInk)};
    --kp-accent: ${hex(c.accent)};

    /* An installed theme (about:addons) sets these inline on :root; a user sheet's
       !important beats that, so the kp colours win whichever theme is active. */
    --lwt-header-image: none !important;
    --lwt-additional-images: none !important;
    --lwt-accent-color: var(--kp-deep) !important;
    --lwt-accent-color-inactive: var(--kp-deep) !important;
    --lwt-inactive-accent-color: var(--kp-deep) !important;
    --lwt-text-color: var(--kp-ink) !important;
    --lwt-tab-line-color: var(--kp-signal) !important;
    --lwt-toolbarbutton-icon-fill: var(--kp-ink) !important;
    --lwt-toolbarbutton-hover-background: var(--kp-hover) !important;
    --lwt-toolbarbutton-active-background: var(--kp-raised) !important;
    --lwt-sidebar-background-color: var(--kp-deep) !important;
    --lwt-sidebar-text-color: var(--kp-ink) !important;
    --toolbox-bgcolor: var(--kp-deep) !important;
    --toolbox-bgcolor-inactive: var(--kp-deep) !important;
    --toolbox-textcolor: var(--kp-ink) !important;
    --toolbox-textcolor-inactive: var(--kp-muted) !important;
    --toolbox-non-lwt-bgcolor: var(--kp-deep) !important;
    --toolbox-non-lwt-textcolor: var(--kp-ink) !important;
    --toolbar-bgcolor: var(--kp-ground) !important;
    --toolbar-color: var(--kp-ink) !important;
    --toolbarbutton-icon-fill: var(--kp-ink) !important;
    --toolbarbutton-icon-fill-attention: var(--kp-signal) !important;
    --toolbarbutton-hover-background: var(--kp-hover) !important;
    --toolbarbutton-active-background: var(--kp-raised) !important;
    --toolbar-field-background-color: var(--kp-surface) !important;
    --toolbar-field-color: var(--kp-ink) !important;
    --toolbar-field-border-color: var(--kp-line) !important;
    --toolbar-field-focus-background-color: var(--kp-raised) !important;
    --toolbar-field-focus-color: var(--kp-ink) !important;
    --toolbar-field-focus-border-color: var(--kp-accent) !important;
    --urlbar-box-bgcolor: var(--kp-raised) !important;
    --urlbar-box-hover-bgcolor: var(--kp-hover) !important;
    --urlbar-box-text-color: var(--kp-ink) !important;
    --tab-selected-bgcolor: var(--kp-ground) !important;
    --tab-selected-textcolor: var(--kp-ink) !important;
    --tab-hover-background-color: var(--kp-hover) !important;
    --tab-loading-fill: var(--kp-signal) !important;
    --tabs-navbar-separator-color: var(--kp-line) !important;
    --tabpanel-background-color: var(--kp-ground) !important;
    --arrowpanel-background: var(--kp-raised) !important;
    --arrowpanel-color: var(--kp-ink) !important;
    --arrowpanel-border-color: var(--kp-line) !important;
    --panel-separator-color: var(--kp-line) !important;
    --urlbarView-highlight-background: var(--kp-signal) !important;
    --urlbarView-highlight-color: var(--kp-signal-ink) !important;
    --focus-outline-color: var(--kp-accent) !important;
    --button-primary-bgcolor: var(--kp-signal) !important;
    --button-primary-color: var(--kp-signal-ink) !important;
    --sidebar-background-color: var(--kp-deep) !important;
    --sidebar-text-color: var(--kp-ink) !important;
    --sidebar-border-color: var(--kp-line) !important;
    --chrome-content-separator-color: var(--kp-line) !important;
}

/* The tab strip on deep, the toolbars on ground, no theme image over either. */
#navigator-toolbox,
#titlebar,
#TabsToolbar,
#sidebar-main,
#sidebar-box {
    background-color: var(--kp-deep) !important;
    background-image: none !important;
    color: var(--kp-ink) !important;
}
#nav-bar,
#PersonalToolbar,
#toolbar-menubar {
    background-color: var(--kp-ground) !important;
    background-image: none !important;
    color: var(--kp-ink) !important;
}
/* The signal hairline under the toolbox, the way the taskbar carries it. */
#navigator-toolbox {
    border-bottom: 2px solid var(--kp-signal) !important;
}
#tabbrowser-tabpanels,
#tabbrowser-tabbox {
    background-color: var(--kp-ground) !important;
}

/* The selected tab carries the signal colour as a hairline, the way the bar does. */
.tab-background[selected] {
    background: var(--kp-ground) !important;
    box-shadow: inset 0 -2px 0 var(--kp-signal) !important;
    outline: 1px solid var(--kp-line) !important;
}
.tabbrowser-tab:not([selected]) .tab-label {
    color: var(--kp-muted) !important;
}
.tabbrowser-tab[selected] .tab-label {
    color: var(--kp-ink) !important;
}

#urlbar-background {
    background-color: var(--kp-surface) !important;
    border: 1px solid var(--kp-line) !important;
}
#urlbar[focused] > #urlbar-background {
    border-color: var(--kp-accent) !important;
    outline: 1px solid var(--kp-accent) !important;
}

menupopup,
panel {
    --panel-background: var(--kp-raised) !important;
    --panel-color: var(--kp-ink) !important;
    --panel-border-color: var(--kp-line) !important;
}

/* Shape: radius ${d.shape.radius}px, notch ${d.shape.notch}px, ${d.shape.body} and ${d.shape.mono}. */
:root {
    --tab-border-radius: ${d.shape.radius}px !important;
    --toolbarbutton-border-radius: ${d.shape.radius}px !important;
    --arrowpanel-border-radius: ${d.shape.radius}px !important;
    --panel-border-radius: ${d.shape.radius}px !important;
    --urlbar-icon-border-radius: ${d.shape.radius}px !important;
    --toolbar-field-border-radius: ${d.shape.radius}px !important;
}
.tab-label {
    font-family: "${d.shape.body}", system-ui !important;
    font-weight: 600 !important;
${d.shape.notch > 0 ? '    text-transform: uppercase !important;\n    letter-spacing: 0.08em !important;\n' : ''}}
#urlbar-input,
.urlbarView-row {
    font-family: "${d.shape.mono}", ui-monospace, monospace !important;
}
.tab-background,
#urlbar-background,
toolbarbutton .toolbarbutton-icon,
toolbarbutton .toolbarbutton-badge-stack,
menupopup,
panel {
    border-radius: ${d.shape.radius}px !important;
}
${
    d.shape.notch > 0
        ? `/* The notch: the selected tab and the address bar lose their bottom-right corner. */
.tab-background[selected],
#urlbar-background {
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - ${Math.min(d.shape.notch, 10)}px), calc(100% - ${Math.min(d.shape.notch, 10)}px) 100%, 0 100%) !important;
}
`
        : ''
}`;
}

/** @param {Desk} d */
function userContent(d) {
    const { c } = d;
    return `/* GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) — KP ${d.label}. Do not edit. */

@-moz-document url("about:newtab"), url("about:home"), url("about:blank"), url("about:privatebrowsing") {
    :root, body {
        --newtab-background-color: ${hex(c.ground)} !important;
        --newtab-background-color-secondary: ${hex(c.surface)} !important;
        --newtab-text-primary-color: ${hex(c.ink)} !important;
        --newtab-primary-action-background: ${hex(c.signal)} !important;
        --in-content-page-background: ${hex(c.ground)} !important;
        background-color: ${hex(c.ground)} !important;
    }
}

@-moz-document url-prefix("about:") {
    :root {
        --in-content-page-background: ${hex(c.ground)} !important;
        --in-content-page-color: ${hex(c.ink)} !important;
        --in-content-box-background: ${hex(c.surface)} !important;
        --in-content-border-color: ${hex(c.line)} !important;
        --in-content-primary-button-background: ${hex(c.signal)} !important;
        --in-content-primary-button-text-color: ${hex(c.signalInk)} !important;
        --in-content-accent-color: ${hex(c.signal)} !important;
        --in-content-focus-outline-color: ${hex(c.accent)} !important;
    }
}
`;
}

/* ------------------------------------------------------------------ */
/* Windhawk: the shell's WinUI surfaces                                */
/* ------------------------------------------------------------------ */

/**
 * Windhawk's styler mods take a list of XAML targets and property
 * assignments. Every target below is one the styling guides document
 * (ramensoftware/windows-11-{file-explorer,taskbar,start-menu}-styling-guide);
 * nothing here hides or moves a control, so a theme changes colour only and
 * a Windows update that renames a control loses a colour, never a button.
 *
 * `Prop=value` sets a value, `Prop:=<Xaml/>` sets an object. Colours are
 * #RRGGBB or #AARRGGBB.
 *
 * @param {{target: string, styles: string[]}[]} rules
 * @param {string} title
 */
function yaml(title, rules) {
    let out = `# GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs). Do not edit.\n`;
    out += `# ${title}\n`;
    out += '# desktop/windows/apply.ps1 writes this into Windhawk for you; to do it by hand, paste it into\n';
    out += '# the mod\'s Settings tab in "Textual mode" and save.\n';
    out += 'controlStyles:\n';
    /** @type {[string, string | number][]} */
    const settings = [];
    rules.forEach((rule, i) => {
        out += `  - target: ${rule.target}\n    styles:\n`;
        settings.push([`controlStyles[${i}].target`, rule.target]);
        rule.styles.forEach((style, j) => {
            out += `      - ${JSON.stringify(style)}\n`;
            settings.push([`controlStyles[${i}].styles[${j}]`, style]);
        });
    });
    return { text: out, settings };
}

/**
 * Windhawk keeps what "Textual mode" saves as flat registry values under
 * HKLM\\SOFTWARE\\Windhawk\\Engine\\Mods\\<mod>\\Settings: a list item is
 * `controlStyles[3].styles[1]`, a nested key `RenderingMod.SysColors`, a
 * number a DWORD and anything else a string (read from a real install's
 * `reg export`). One .reg per theme replaces all five mods' settings; the
 * Settings key is deleted first so a longer theme leaves nothing behind.
 * apply.ps1 imports it and restarts the processes the mods live in.
 * @param {Record<string, {settings: [string, string | number][]}>} mods mod id → settings
 * @param {string} label
 */
function windhawkReg(mods, label) {
    const base = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Windhawk\\Engine\\Mods';
    const lines = [
        'Windows Registry Editor Version 5.00',
        '',
        `; GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) - ${label}. Do not edit.`,
        '; Windhawk mod settings, as the Settings tab would save them. Needs administrator rights.',
    ];
    for (const [mod, { settings }] of Object.entries(mods)) {
        lines.push('', `[-${base}\\${mod}\\Settings]`, `[${base}\\${mod}\\Settings]`);
        for (const [name, value] of settings) {
            const v =
                typeof value === 'number'
                    ? `dword:${value.toString(16).padStart(8, '0')}`
                    : `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
            lines.push(`"${name}"=${v}`);
        }
    }
    lines.push('');
    const text = lines.join('\r\n');
    // regedit reads a version-5 file as UTF-16 or plain ASCII: refuse anything else.
    if (/[^\x00-\x7f]/.test(text)) throw new Error(`${label}: windhawk.reg would not be ASCII`);
    return text;
}

/** The mods windhawkReg writes, in the order apply.ps1 reloads them. @param {Desk | null} d */
function windhawkMods(d) {
    return {
        'windows-11-taskbar-styler': windhawkTaskbar(d),
        'windows-11-start-menu-styler': windhawkStart(d),
        'windows-11-notification-center-styler': windhawkNotificationCentre(d),
        'windows-11-file-explorer-styler': windhawkExplorer(d),
        'translucent-windows': windhawkTranslucent(d),
    };
}

/** #AARRGGBB, which is the order XAML reads. @param {Rgb} rgb @param {number} alpha 0..1 */
const argb = (rgb, alpha) =>
    `#${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')}${hex(rgb).slice(1)}`.toUpperCase();

/**
 * The two ways to name a colour in a style: the theme's own hex, or the
 * Windows accent colour, which accent.reg has already set from the same
 * token. The accent flavour makes one set of styles follow every theme,
 * so a theme switch is one command and no pasting.
 * @param {Desk | null} d
 */
function palette(d) {
    if (d === null) {
        return {
            ground: '{ThemeResource SystemAccentColorDark3}',
            deep: '{ThemeResource SystemAccentColorDark3}',
            raised: '{ThemeResource SystemAccentColorDark2}',
            hover: '{ThemeResource SystemAccentColorDark1}',
            signal: '{ThemeResource SystemAccentColor}',
            ink: '{ThemeResource SystemAccentColorLight3}',
            solid: (/** @type {string} */ role, /** @type {number} */ alpha) => `<SolidColorBrush Color="${role}" Opacity="${alpha}" />`,
        };
    }
    return {
        ground: hex(d.c.ground),
        deep: hex(d.c.deep),
        raised: hex(d.c.raised),
        hover: hex(d.c.hover),
        signal: hex(d.c.signal),
        ink: hex(d.c.ink),
        solid: (/** @type {string} */ role, /** @type {number} */ alpha) => `<SolidColorBrush Color="${role}" Opacity="${alpha}" />`,
    };
}

/** @param {Desk | null} d */
function windhawkExplorer(d) {
    const p = palette(d);
    const blur = (/** @type {string} */ colour, /** @type {number} */ opacity) =>
        `<WindhawkBlur BlurAmount="30" TintColor="${colour}" TintOpacity="${opacity}" />`;
    const title = 'Windows 11 File Explorer Styler — https://windhawk.net/mods/windows-11-file-explorer-styler';
    const rules = [
        { target: 'Grid#NavigationBarControlGrid', styles: [`Background:=${blur(p.deep, 0.75)}`] },
        {
            target: 'TabViewItem > Grid#LayoutRoot > Canvas > Microsoft.UI.Xaml.Shapes.Path#SelectedBackgroundPath',
            styles: [`Fill:=${p.solid(p.ground, 0.9)}`],
        },
        { target: 'Grid#TabContainer > ContentPresenter > StackPanel > TextBlock', styles: [`Foreground:=${p.solid(p.ink, 1)}`] },
        { target: 'Grid#DetailsViewControlRootGrid', styles: [`Background:=${blur(p.ground, 0.82)}`] },
        { target: 'StackPanel#DetailsViewThumbnail', styles: [`Background:=${p.solid(p.ground, 0)}`] },
        { target: 'Grid#HomeViewRootGrid', styles: [`Background:=${blur(p.ground, 0.82)}`] },
        {
            target: 'CommandBarOverflowPresenter#SecondaryItemsControl > Grid#LayoutRoot > Border',
            styles: [`BorderBrush:=${p.solid(p.signal, 0.55)}`, 'BorderThickness=1'],
        },
    ];
    if (d === null) return yaml(title, rules);

    // The theme's own Explorer: the tab strip sits on a signal hairline, the
    // command bar is a plate with a hairline under it, the address and search
    // fields are the theme's fields (its radius, a framed face), and the tab
    // titles are set in the body face. Every target is one the mod's own
    // built-in themes style, which is the best evidence it exists.
    const { c, shape } = d;
    const r = shape.radius;
    const field = [`Background:=${p.solid(p.raised, 0.95)}`, `BorderBrush:=${p.solid(p.signal, 0.35)}`, 'BorderThickness=1', `CornerRadius=${r}`];
    return yaml(`${title} — KP ${d.label}`, [
        ...rules,
        { target: 'Grid#TabContainer > ContentPresenter > StackPanel > TextBlock', styles: [`FontFamily=${shape.body}`, 'FontWeight=SemiBold'] },
        { target: 'TabViewItem > Grid#LayoutRoot', styles: [`CornerRadius=${r}`] },
        { target: 'Grid#TabContainerGrid > Border#LeftBottomBorderLine', styles: [`Background:=${p.solid(p.signal, 1)}`, 'Height=2'] },
        { target: 'Grid#TabContainerGrid > Border#RightBottomBorderLine', styles: [`Background:=${p.solid(p.signal, 1)}`, 'Height=2'] },
        {
            target: 'CommandBar#FileExplorerCommandBar',
            styles: [
                `Background:=${p.solid(hex(c.surface), 0.92)}`,
                `BorderBrush:=${p.solid(p.signal, 0.22)}`,
                'BorderThickness=0,0,0,1',
                `CornerRadius=${r}`,
            ],
        },
        { target: 'Grid#FileExplorerAddressBarGrid > Grid#LayoutRoot > TextBox > Grid@CommonStates > Border#BorderElement', styles: field },
        { target: 'AutoSuggestBox#FileExplorerSearchBox > Grid#LayoutRoot > TextBox > Grid@CommonStates > Border#BorderElement', styles: field },
        {
            target: 'CommandBarOverflowPresenter#SecondaryItemsControl > Grid#LayoutRoot > Border',
            styles: [`Background:=${p.solid(p.raised, 0.97)}`, `CornerRadius=${r}`],
        },
    ]);
}

/** @param {Desk | null} d */
function windhawkTaskbar(d) {
    const p = palette(d);
    const radius = d === null ? 6 : d.shape.radius;
    /** @type {{target: string, styles: string[]}[]} */
    const rules = [
        {
            target: 'Taskbar.TaskbarFrame > Grid#RootGrid > Taskbar.TaskbarBackground > Grid > Rectangle#BackgroundFill',
            styles: [`Fill:=<WindhawkBlur BlurAmount="30" TintColor="${p.deep}" TintOpacity="0.72" />`],
        },
        { target: 'Taskbar.TaskListButton', styles: [`CornerRadius=${radius}`] },
        { target: 'Taskbar.ExperienceToggleButton', styles: [`CornerRadius=${radius}`] },
        { target: 'Taskbar.SearchBoxButton', styles: [`CornerRadius=${radius}`] },
        {
            target: 'Grid#IconPanel > Border#BackgroundElement, Taskbar.TaskListLabeledButtonPanel > Border#BackgroundElement',
            styles: [`Background:=${p.solid(p.hover, 0.85)}`, `CornerRadius=${radius}`],
        },
        {
            target: 'Taskbar.TaskbarBackground#HoverFlyoutBackgroundControl > Grid > Rectangle#BackgroundFill',
            styles: [`Fill:=${p.solid(p.raised, 0.95)}`],
        },
        { target: 'Border#OverflowFlyoutBackgroundBorder', styles: [`Background:=${p.solid(p.raised, 0.95)}`, `CornerRadius=${radius}`] },
        { target: 'Windows.UI.Xaml.Controls.Border#BackgroundDimmingLayer', styles: [`Background:=${p.solid(p.ground, 0.8)}`] },
    ];
    if (d === null) return yaml('Windows 11 Taskbar Styler — https://windhawk.net/mods/windows-11-taskbar-styler', rules);

    // The theme's own taskbar: the pieces the web register draws, in the
    // parts of the taskbar the styling guide names. A button is a plate on the
    // void with a hairline frame in the signal; the running app is marked in
    // the signal; the clock is set in the display face with the mono date
    // under it and an accent edge beside it; the start button is the theme's
    // primary plate, drawn by desktop/windows/themes/<theme>/start.svg.
    const { c, shape } = d;
    const base = rules.filter((r) => !r.target.startsWith('Grid#IconPanel'));
    return yaml(`Windows 11 Taskbar Styler — KP ${d.label} — https://windhawk.net/mods/windows-11-taskbar-styler`, [
        ...base,
        { target: 'Rectangle#BackgroundStroke', styles: [`Fill:=${p.solid(p.signal, 1)}`, 'Height=2'] },
        {
            target: 'Grid#IconPanel > Border#BackgroundElement, Taskbar.TaskListLabeledButtonPanel > Border#BackgroundElement',
            styles: [
                `Background:=${p.solid(hex(c.surface), 0.9)}`,
                `BorderBrush:=${p.solid(p.signal, 0.22)}`,
                'BorderThickness=1',
                `CornerRadius=${radius}`,
            ],
        },
        {
            target: 'Grid#IconPanel@RunningIndicatorStates > Rectangle#RunningIndicator, Taskbar.TaskListLabeledButtonPanel@RunningIndicatorStates > Rectangle#RunningIndicator',
            styles: [
                `Fill:=${p.solid(hex(c.muted), 1)}`,
                'Height=2',
                `RadiusX=${Math.min(radius, 1)}`,
                `RadiusY=${Math.min(radius, 1)}`,
                `Fill@ActiveRunningIndicator:=${p.solid(p.signal, 1)}`,
                'Width@ActiveRunningIndicator=24',
                `Fill@RequestingAttentionRunningIndicator:=${p.solid(hex(c.danger), 1)}`,
            ],
        },
        { target: 'TextBlock#LabelControl', styles: [`FontFamily=${shape.body}`, 'FontWeight=SemiBold'] },
        {
            target: 'SystemTray.DateTimeIconContent > Grid#ContainerGrid',
            styles: [`BorderBrush:=${p.solid(hex(c.accent), 1)}`, 'BorderThickness=3,0,0,0', 'Padding=8,0,6,0'],
        },
        {
            target: 'SystemTray.DateTimeIconContent > Grid#ContainerGrid > StackPanel > TextBlock#TimeInnerTextBlock',
            styles: [`FontFamily=${shape.display}`, 'FontSize=15', 'FontWeight=ExtraBold', `Foreground:=${p.solid(p.ink, 1)}`],
        },
        {
            target: 'SystemTray.DateTimeIconContent > Grid#ContainerGrid > StackPanel > TextBlock#DateInnerTextBlock',
            styles: [`FontFamily=${shape.mono}`, 'FontSize=11', `Foreground:=${p.solid(hex(c.muted), 1)}`],
        },
        { target: 'SystemTray.OmniButton > Grid > Border', styles: [`CornerRadius=${radius}`] },
        {
            target: 'WindowsInternal.ComposableShell.Experiences.Switcher.AltTab > Grid#ModalRootGrid > Border#BackgroundElement',
            styles: ['Background=Transparent'],
        },
        {
            target: 'WindowsInternal.ComposableShell.Experiences.Switcher.AltTab > Grid#ModalRootGrid > Border#BackgroundElement > WindowsInternal.ComposableShell.Experiences.Switcher.SwitchItemList',
            styles: [`Background:=${p.solid(p.raised, 0.95)}`, `CornerRadius=${radius}`],
        },
        {
            target: 'Taskbar.ExperienceToggleButton#LaunchListButton[AutomationProperties.AutomationId=StartButton] > Taskbar.TaskListButtonPanel > Grid > Border#BackgroundElement, Taskbar.ExperienceToggleButton#LaunchListButton[AutomationProperties.AutomationId=StartButton] > Taskbar.TaskListButtonPanel > Border#BackgroundElement',
            styles: [`Background:=<ImageBrush Stretch="Uniform" ImageSource="${START_DIR}/${d.name}.png" />`],
        },
        {
            target: 'Taskbar.ExperienceToggleButton#LaunchListButton[AutomationProperties.AutomationId=StartButton] > Taskbar.TaskListButtonPanel > Grid > Microsoft.UI.Xaml.Controls.AnimatedVisualPlayer#Icon, Taskbar.ExperienceToggleButton#LaunchListButton[AutomationProperties.AutomationId=StartButton] > Taskbar.TaskListButtonPanel > Microsoft.UI.Xaml.Controls.AnimatedVisualPlayer#Icon',
            styles: ['Visibility=Collapsed'],
        },
    ]);
}

/** Where apply.ps1 puts the rendered start buttons; the taskbar reads them from there. */
const START_DIR = 'C:/Users/Public/Pictures/kp-themes/start';

/**
 * The start button as the theme's primary plate: the signal, the ink on it,
 * and the theme's corner, a notch when it has one and a radius when not. The
 * mark is three ink bars stepping up, a drawn glyph rather than a logo.
 * @param {Desk} d
 */
function startButton(d) {
    const { c, shape } = d;
    const S = 64;
    const n = shape.notch > 0 && shape.radius === 0 ? 14 : 0;
    const r = Math.min(shape.radius * 2, 16);
    const plate =
        n > 0
            ? `<polygon points="4,4 60,4 60,${60 - n} ${60 - n},60 4,60" fill="${hex(c.signal)}"/>`
            : `<rect x="4" y="4" width="56" height="56" rx="${r}" fill="${hex(c.signal)}"/>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) — KP ${d.label}. Do not edit. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${plate}
  <g fill="${hex(c.signalInk)}">
    <rect x="16" y="36" width="8" height="12"/>
    <rect x="28" y="28" width="8" height="20"/>
    <rect x="40" y="18" width="8" height="30"/>
  </g>
</svg>
`;
}

/** @param {Desk | null} d */
function windhawkStart(d) {
    const p = palette(d);
    const acrylic = (/** @type {string} */ colour, /** @type {number} */ opacity) =>
        `<AcrylicBrush BackgroundSource="Backdrop" TintColor="${colour}" TintOpacity="${opacity}" />`;
    const title = 'Windows 11 Start Menu Styler — https://windhawk.net/mods/windows-11-start-menu-styler';
    if (d === null) {
        return yaml(title, [
            { target: 'Border#AcrylicBorder', styles: [`Background:=${acrylic(p.ground, 0.85)}`] },
            { target: 'Border#AppBorder', styles: [`Background:=${acrylic(p.ground, 0.85)}`] },
            { target: 'StartDocked.SearchBoxToggleButton', styles: [`Background:=${p.solid(p.raised, 0.9)}`, 'CornerRadius=8'] },
        ]);
    }
    // The theme's start menu: the panel is the void behind acrylic with the
    // theme's corner and a signal frame; the tint layer Windows draws over it
    // is cleared so the theme's own tint is what shows; the search field and
    // the context menus are the theme's fields and panels; the power button
    // and the app tiles take its corner.
    const { shape } = d;
    const r = shape.radius;
    const frame = [`BorderBrush:=${p.solid(p.signal, 0.55)}`, 'BorderThickness=1', `CornerRadius=${r}`];
    return yaml(`${title} — KP ${d.label}`, [
        { target: 'Border#AcrylicBorder', styles: [`Background:=${acrylic(p.ground, 0.88)}`, ...frame] },
        { target: 'Border#AcrylicOverlay', styles: ['Background=Transparent'] },
        { target: 'Border#AppBorder', styles: [`Background:=${acrylic(p.ground, 0.88)}`, ...frame] },
        {
            target: 'StartDocked.SearchBoxToggleButton',
            styles: [`Background:=${p.solid(p.raised, 0.95)}`, `BorderBrush:=${p.solid(p.signal, 0.35)}`, 'BorderThickness=1', `CornerRadius=${r}`],
        },
        {
            target: 'StartMenu.SearchBoxToggleButton',
            styles: [`Background:=${p.solid(p.raised, 0.95)}`, `BorderBrush:=${p.solid(p.signal, 0.35)}`, 'BorderThickness=1', `CornerRadius=${r}`],
        },
        { target: 'StartDocked.NavigationPaneButton#PowerButton', styles: [`CornerRadius=${r}`] },
        { target: 'Border#ContentBorder', styles: [`CornerRadius=${r}`] },
        { target: 'MenuFlyoutPresenter', styles: [`Background:=${p.solid(p.raised, 0.97)}`, ...frame] },
    ]);
}

/** @param {Desk | null} d */
function windhawkNotificationCentre(d) {
    const p = palette(d);
    const blur = (/** @type {string} */ colour, /** @type {number} */ opacity) =>
        `<WindhawkBlur BlurAmount="30" TintColor="${colour}" TintOpacity="${opacity}" />`;
    const title = 'Windows 11 Notification Center Styler — https://windhawk.net/mods/windows-11-notification-center-styler';
    const panels = ['Grid#NotificationCenterGrid', 'Grid#CalendarCenterGrid', 'Grid#ControlCenterRegion'];
    if (d === null)
        return yaml(
            title,
            panels.map((target) => ({ target, styles: [`Background:=${blur(p.ground, 0.8)}`] })),
        );
    // The theme's panels: the void behind blur with the theme's corner and a
    // signal frame, notifications and menus with the same corner.
    const r = d.shape.radius;
    const frame = [`BorderBrush:=${p.solid(p.signal, 0.45)}`, 'BorderThickness=1', `CornerRadius=${r}`];
    return yaml(`${title} — KP ${d.label}`, [
        ...panels.map((target) => ({ target, styles: [`Background:=${blur(p.ground, 0.85)}`, ...frame] })),
        { target: 'ActionCenter.FlexibleItemView', styles: [`CornerRadius=${r}`] },
        { target: 'MenuFlyoutPresenter', styles: [`Background:=${p.solid(p.raised, 0.97)}`, ...frame] },
    ]);
}

/**
 * Translucent Windows is not a styler: it takes one settings document, and
 * it is what gives ordinary windows, menus and tooltips their backdrop. The
 * keys follow the mod's own settings block as of 1.8.2 (read from
 * ProgramData\\Windhawk\\ModsSource on a real install); 1.8 dropped the
 * border and title bar colours older theme write-ups still carry.
 *
 * AccentBlurBehind is the tint laid over the blur, as AARRGGBB. The theme
 * flavour uses the theme's ground; the accent flavour cannot name the accent
 * here (the mod takes a hex, not a ThemeResource), so it uses a neutral dark.
 * @param {Desk | null} d
 */
function windhawkTranslucent(d) {
    const tint = d === null ? '66101010' : `${d.dark ? '80' : '66'}${hex(d.c.ground).slice(1)}`;
    const text = `# GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs). Do not edit.
# Translucent Windows 1.8 — https://windhawk.net/mods/translucent-windows
# desktop/windows/apply.ps1 writes this into Windhawk for you; to do it by hand, paste it into
# the mod's Settings tab in "Textual mode" and save.
# Menus, tooltips and ordinary windows: blurred backdrop, tinted ${d === null ? 'neutral dark' : `with KP ${d.label}'s ground`}.
RenderingMod:
  ThemeBackground: 1
  SysColors: 0
  AccentColorControls: 1
BackgroundEffects:
  type: acrylicblur
  AccentBlurBehind: '${tint}'
FlyoutsEffects: 1
RuledPrograms: []
`;
    /** @type {[string, string | number][]} */
    const settings = [
        ['RenderingMod.ThemeBackground', 1],
        ['RenderingMod.SysColors', 0],
        ['RenderingMod.AccentColorControls', 1],
        ['BackgroundEffects.type', 'acrylicblur'],
        ['BackgroundEffects.AccentBlurBehind', tint],
        ['FlyoutsEffects', 1],
    ];
    return { text, settings };
}

/* ------------------------------------------------------------------ */
/* Mica For Everyone, accent colour                                    */
/* ------------------------------------------------------------------ */

/** @param {Desk} d */
function mica(d) {
    const bar = d.dark ? 'Dark' : 'Light';
    // A theme with no radius asks Windows for square window corners too.
    // Names from Mica For Everyone 2's CornerPreference enum (Default, Square,
    // Rounded, RoundedSmall); it reads them as strings and refuses the file otherwise.
    const corner = d.shape.radius === 0 ? 'Square' : d.shape.radius <= 4 ? 'RoundedSmall' : 'Rounded';
    return {
        rules: [
            { type: 'global', titleBarColor: bar, backdropPreference: 'Acrylic', cornerPreference: corner, extendFrameIntoClientArea: false },
            {
                type: 'process',
                processName: 'explorer',
                titleBarColor: bar,
                backdropPreference: 'Acrylic',
                cornerPreference: corner,
                extendFrameIntoClientArea: true,
            },
            {
                type: 'process',
                processName: 'notepad',
                titleBarColor: bar,
                backdropPreference: 'Acrylic',
                cornerPreference: corner,
                extendFrameIntoClientArea: true,
            },
        ],
    };
}

/** A DWORD in the byte order the registry value wants. @param {number[]} bytes most significant first */
const dword = (bytes) => `dword:${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`;

/** @param {Desk} d */
function accentReg(d) {
    const { c } = d;
    const [r, g, b] = c.signal;
    const abgr = (/** @type {Rgb} */ [rr, gg, bb]) => dword([0xff, bb, gg, rr]);
    // Windows keeps eight shades of the accent, lightest first; the fourth
    // is the accent itself and the Start menu uses the sixth.
    const steps = [0.45, 0.3, 0.15, 0, -0.2, -0.4, -0.6, -0.75];
    const palette = steps.map((s) => shade(c.signal, s));
    const bytes = palette.flatMap(([pr, pg, pb]) => [pr, pg, pb, 0]).map((n) => n.toString(16).padStart(2, '0'));
    const light = d.dark ? 0 : 1;
    return [
        'Windows Registry Editor Version 5.00',
        '',
        // regedit reads a version-5 file as UTF-16 or plain ASCII: keep it ASCII.
        `; GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) - KP ${d.label}. Do not edit.`,
        `; Accent ${hex(c.signal)}, ${d.dark ? 'dark' : 'light'} mode, transparency on. Current user only, no admin needed.`,
        '',
        '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize]',
        `"AppsUseLightTheme"=${dword([0, 0, 0, light])}`,
        `"SystemUsesLightTheme"=${dword([0, 0, 0, light])}`,
        '"EnableTransparency"=dword:00000001',
        '"ColorPrevalence"=dword:00000000',
        '',
        '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent]',
        `"AccentPalette"=hex:${bytes.join(',')}`,
        `"AccentColorMenu"=${abgr(c.signal)}`,
        `"StartColorMenu"=${abgr(palette[5])}`,
        '',
        '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\DWM]',
        `"AccentColor"=${abgr(c.signal)}`,
        `"ColorizationColor"=${dword([0xc4, r, g, b])}`,
        `"ColorizationAfterglow"=${dword([0xc4, r, g, b])}`,
        '"ColorPrevalence"=dword:00000000',
        '"EnableWindowColorization"=dword:00000000',
        '',
    ].join('\r\n');
}

/**
 * The desktop and lock screen pictures, through PersonalizationCSP: the one
 * place that works on every edition of Windows 11 and that the sign-in screen
 * reads too, because the sign-in screen shows the lock screen picture.
 *
 * It needs administrator rights and the pictures must live where SYSTEM can
 * read them, which is why apply.ps1 copies them to Public\Pictures first.
 * While these keys exist, Settings cannot change the two pictures; deleting
 * the key gives Windows its own choice back.
 * @param {Desk} d
 */
function personalizationReg(d) {
    const dir = 'C:\\\\Users\\\\Public\\\\Pictures\\\\kp-themes';
    return [
        'Windows Registry Editor Version 5.00',
        '',
        `; GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) - KP ${d.label}. Do not edit.`,
        `; Desktop and lock screen pictures. Needs administrator rights. apply.ps1 -Skip lockscreen leaves them alone.`,
        '',
        '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PersonalizationCSP]',
        `"DesktopImagePath"="${dir}\\\\${d.name}.png"`,
        `"DesktopImageUrl"="${dir}\\\\${d.name}.png"`,
        '"DesktopImageStatus"=dword:00000001',
        `"LockScreenImagePath"="${dir}\\\\${d.name}-lock.png"`,
        `"LockScreenImageUrl"="${dir}\\\\${d.name}-lock.png"`,
        '"LockScreenImageStatus"=dword:00000001',
        '',
        '; The sign-in screen blurs the picture by default; 1 shows it as it is.',
        '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\System]',
        '"DisableAcrylicBackgroundOnLogon"=dword:00000001',
        '',
    ].join('\r\n');
}

/* ------------------------------------------------------------------ */
/* The shell in WSL: Starship and fish                                 */
/* ------------------------------------------------------------------ */

/** @param {Desk} d */
function starship(d) {
    const { c } = d;
    return `# GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) — KP ${d.label}. Do not edit.
# Two lines, Garuda-style: who and where on the first, the prompt on the second.
"$schema" = 'https://starship.rs/config-schema.json'

palette = "kp"
add_newline = true
command_timeout = 800

format = """
[╭─](signal)$os$username[@](muted)$hostname $directory$git_branch$git_status$python$nodejs$rust$cmd_duration
[╰─](signal)$character"""

[palettes.kp]
signal = "${hex(c.signal)}"
accent = "${hex(c.accent)}"
violet = "${hex(c.violet)}"
ok = "${hex(c.ok)}"
warn = "${hex(c.warn)}"
danger = "${hex(c.danger)}"
ink = "${hex(c.ink)}"
muted = "${hex(c.muted)}"

[os]
disabled = false
style = "bold signal"
format = "[$symbol]($style)"

[os.symbols]
Arch = "\\uf303 "
Linux = "\\uf17c "
Windows = "\\ue70f "

[username]
show_always = true
style_user = "bold accent"
style_root = "bold danger"
format = "[$user]($style)"

[hostname]
ssh_only = false
style = "bold violet"
format = "[$hostname]($style)"

[directory]
style = "bold warn"
read_only = " \\uf023"
truncation_length = 4
truncate_to_repo = true
format = "[\\uf07c $path]($style)[$read_only]($read_only_style) "

[git_branch]
symbol = "\\ue725 "
style = "bold violet"
format = "on [$symbol$branch]($style) "

[git_status]
style = "bold danger"

[python]
style = "ok"
format = "[\${symbol}\${pyenv_prefix}(\${version} )(\\\\($virtualenv\\\\) )]($style)"

[nodejs]
style = "ok"

[rust]
style = "signal"

[cmd_duration]
min_time = 2000
style = "muted"
format = "took [$duration]($style) "

[character]
success_symbol = "[❯](bold ok)"
error_symbol = "[❯](bold danger)"
vimcmd_symbol = "[❮](bold accent)"
`;
}

/**
 * The Windows prompt: an Oh My Posh config in the shape the desktop already
 * had (╭─ os user@host path git time, then ╰─λ), with the theme's palette.
 * apply.ps1 copies it to ~/.config/kp-themes/prompt.omp.json, the one path
 * the PowerShell profile reads, so the prompt changes with every switch.
 * Version 2 of the schema, which every Oh My Posh since 14 reads.
 * @param {Desk} d
 */
function ohMyPosh(d) {
    const { c } = d;
    // Text on the terminal's ground: a role colour that does not reach 3:1
    // there (dark's accent is a plate, not an ink) falls back to the ink.
    const lum = (/** @type {Rgb} */ rgb) => {
        const [r, g, b] = rgb.map((v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (/** @type {Rgb} */ a, /** @type {Rgb} */ b) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
        return (x + 0.05) / (y + 0.05);
    };
    const ink = (/** @type {Rgb} */ rgb, /** @type {Rgb} */ fallback = c.ink) => hex(ratio(rgb, c.ground) >= 3 ? rgb : fallback);
    const config = {
        $schema: 'https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/schema.json',
        version: 2,
        final_space: true,
        palette: {
            signal: ink(c.signal),
            accent: ink(c.accent, c.signal),
            violet: ink(c.violet),
            ok: ink(c.ok),
            warn: ink(c.warn),
            danger: ink(c.danger),
            ink: hex(c.ink),
            muted: ink(c.muted),
        },
        blocks: [
            {
                type: 'prompt',
                alignment: 'left',
                segments: [
                    { type: 'text', style: 'plain', foreground: 'p:signal', template: '\u256d\u2500' },
                    { type: 'os', style: 'plain', foreground: 'p:signal', template: ' {{ .Icon }} ' },
                    { type: 'session', style: 'plain', foreground: 'p:accent', template: '{{ .UserName }}<p:muted>@</>{{ .HostName }} ' },
                    {
                        type: 'path',
                        style: 'plain',
                        foreground: 'p:warn',
                        template: ' {{ .Path }} ',
                        properties: { style: 'agnoster_short', max_depth: 4, folder_separator_icon: ' \ue0b1 ' },
                    },
                    { type: 'git', style: 'plain', foreground: 'p:violet', template: '{{ .HEAD }}{{ if .Working.Changed }} *{{ end }} ' },
                    {
                        type: 'executiontime',
                        style: 'plain',
                        foreground: 'p:muted',
                        template: ' {{ .FormattedMs }} ',
                        properties: { threshold: 500, style: 'austin' },
                    },
                ],
            },
            {
                type: 'prompt',
                alignment: 'left',
                newline: true,
                segments: [
                    { type: 'text', style: 'plain', foreground: 'p:signal', template: '\u2570\u2500' },
                    {
                        type: 'status',
                        style: 'plain',
                        foreground: 'p:ok',
                        foreground_templates: ['{{ if gt .Code 0 }}p:danger{{ end }}'],
                        template: '\u03bb',
                        properties: { always_enabled: true },
                    },
                ],
            },
        ],
    };
    return `${JSON.stringify(config, null, 4)}\n`;
}

/** @param {Desk} d */
function fish(d) {
    const { c } = d;
    const h = (/** @type {Rgb} */ rgb) => hex(rgb).slice(1);
    return `# GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) — KP ${d.label}. Do not edit.
# fish syntax colours; lives in ~/.config/fish/conf.d/, read at every start.
set -g fish_color_normal ${h(c.ink)}
set -g fish_color_command ${h(c.accent)}
set -g fish_color_keyword ${h(c.signal)}
set -g fish_color_quote ${h(c.warn)}
set -g fish_color_redirection ${h(c.violet)}
set -g fish_color_end ${h(c.violet)}
set -g fish_color_error ${h(c.danger)}
set -g fish_color_param ${h(c.ink)}
set -g fish_color_option ${h(c.muted)}
set -g fish_color_comment ${h(c.muted)}
set -g fish_color_operator ${h(c.signal)}
set -g fish_color_escape ${h(c.accent)}
set -g fish_color_autosuggestion ${h(c.muted)}
set -g fish_color_valid_path --underline
set -g fish_color_selection --background=${h(c.hover)}
set -g fish_color_search_match --background=${h(c.hover)}
set -g fish_pager_color_prefix ${h(c.signal)} --bold
set -g fish_pager_color_completion ${h(c.ink)}
set -g fish_pager_color_description ${h(c.muted)}
set -g fish_pager_color_progress ${h(c.accent)}
`;
}

/* ------------------------------------------------------------------ */
/* Wallpaper                                                           */
/* ------------------------------------------------------------------ */

/** A horizon, a striped sun and a floor grid in the theme's own hero colours. @param {Desk} d @param {boolean} [lock] */
function wallpaper(d, lock = false) {
    const { c } = d;
    const W = 3840;
    const H = 2160;
    // The lock screen carries a clock and a date across its upper half, so
    // its horizon sits lower and its sun is smaller: the same picture, with
    // room left for the text Windows draws on top.
    const horizon = lock ? 1560 : 1300;
    const cx = W / 2;
    const r = lock ? 380 : 560;
    let stripes = '';
    for (let i = 0; i < 7; i++) {
        const y = horizon - (lock ? 40 : 60) - i * (lock ? 40 : 58);
        const h = (lock ? 16 : 22) - i * (lock ? 2 : 3);
        if (h > 0) stripes += `        <rect x="0" y="${y}" width="${W}" height="${h}" fill="black"/>\n`;
    }
    let grid = '';
    for (let i = 1; i <= 12; i++) {
        const y = horizon + Math.round(((H - horizon) * (i * i)) / 144);
        grid += `    <line x1="0" y1="${y}" x2="${W}" y2="${y}"/>\n`;
    }
    for (let i = -16; i <= 16; i++) {
        grid += `    <line x1="${cx + i * 40}" y1="${horizon}" x2="${cx + i * 520}" y2="${H}"/>\n`;
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) — KP ${d.label}. Do not edit. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hex(c.deep)}"/>
      <stop offset="1" stop-color="${hex(c.ground)}"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hex(c.warn)}"/>
      <stop offset="1" stop-color="${hex(c.signal)}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hex(c.ground)}"/>
      <stop offset="1" stop-color="${hex(c.deep)}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="${(horizon / H).toFixed(3)}" r="0.45">
      <stop offset="0" stop-color="${hex(c.signal)}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${hex(c.signal)}" stop-opacity="0"/>
    </radialGradient>
    <mask id="cut">
      <rect width="${W}" height="${H}" fill="white"/>
${stripes}    </mask>
    <clipPath id="above"><rect width="${W}" height="${horizon}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${horizon - 80}" r="${r}" fill="url(#sun)" mask="url(#cut)" clip-path="url(#above)"/>
  <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#floor)"/>
  <g stroke="${hex(c.lineStrong)}" stroke-width="3" stroke-opacity="${lock ? 0.3 : 0.55}">
${grid}  </g>
  <line x1="0" y1="${horizon}" x2="${W}" y2="${horizon}" stroke="${hex(c.accent)}" stroke-width="4"/>
</svg>
`;
}

/* ------------------------------------------------------------------ */
/* KDE Plasma and Konsole                                              */
/* ------------------------------------------------------------------ */

/** KDE writes a colour as "r,g,b". @param {Rgb} rgb */
const kde = ([r, g, b]) => `${r},${g},${b}`;

/**
 * A Plasma colour scheme (~/.local/share/color-schemes/). Every Qt and KDE
 * program reads it: the window, the lists inside it, buttons, the selection,
 * tooltips, the title bar. Same roles as the Windows side: the window on
 * ground, content one step down on deep, the selection in the signal colour.
 * @param {Desk} d
 */
function kdeColors(d) {
    const { c } = d;
    // The state colours come from the terminal palette: some themes draw
    // success and warning in the ink itself, which says nothing in a list.
    const ansi = terminal(d).scheme;
    const state = (/** @type {string} */ name) => parseHex(ansi[name]).rgb;
    /** @param {Rgb} bg @param {Rgb} alt @param {Rgb} ink @param {Rgb} [inkInactive] */
    const set = (bg, alt, ink, inkInactive = c.muted) =>
        [
            `BackgroundAlternate=${kde(alt)}`,
            `BackgroundNormal=${kde(bg)}`,
            `DecorationFocus=${kde(c.signal)}`,
            `DecorationHover=${kde(c.accent)}`,
            `ForegroundActive=${kde(c.accent)}`,
            `ForegroundInactive=${kde(inkInactive)}`,
            `ForegroundLink=${kde(c.signal)}`,
            `ForegroundNegative=${kde(state('red'))}`,
            `ForegroundNeutral=${kde(state('yellow'))}`,
            `ForegroundNormal=${kde(ink)}`,
            `ForegroundPositive=${kde(state('green'))}`,
            `ForegroundVisited=${kde(c.violet)}`,
        ].join('\n');
    const sections = [
        ['Colors:Button', set(c.raised, c.hover, c.ink)],
        ['Colors:Complementary', set(c.deep, c.surface, c.ink)],
        ['Colors:Header', set(c.deep, c.surface, c.ink)],
        ['Colors:Header][Inactive', set(c.deep, c.surface, c.muted)],
        ['Colors:Selection', set(c.signal, c.signalHover, c.signalInk, c.signalInk)],
        ['Colors:Tooltip', set(c.raised, c.surface, c.ink)],
        ['Colors:View', set(c.deep, c.surface, c.ink)],
        ['Colors:Window', set(c.ground, c.surface, c.ink)],
    ];
    const body = sections.map(([name, keys]) => `[${name}]\n${keys}`).join('\n\n');
    return `# GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) — KP ${d.label}. Do not edit.
${body}

[General]
ColorScheme=KP${d.label.replace(/[^A-Za-z0-9]/g, '')}
Name=KP ${d.label}
shadeSortColumn=true

[KDE]
contrast=4

[WM]
activeBackground=${kde(c.deep)}
activeBlend=${kde(c.signal)}
activeForeground=${kde(c.ink)}
inactiveBackground=${kde(c.deep)}
inactiveBlend=${kde(c.line)}
inactiveForeground=${kde(c.muted)}
`;
}

/**
 * A Konsole colour scheme (~/.local/share/konsole/), the same sixteen colours
 * as Windows Terminal and VS Code's terminal.
 * @param {Desk} d
 */
function konsoleScheme(d) {
    const t = terminal(d).scheme;
    const rgb = (/** @type {string} */ h) => kde(parseHex(h).rgb);
    const names = ['black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white'];
    const bright = (/** @type {string} */ n) => t[`bright${n[0].toUpperCase()}${n.slice(1)}`];
    const blocks = [
        ['Background', t.background],
        ['BackgroundFaint', t.background],
        ['BackgroundIntense', t.background],
        ['Foreground', t.foreground],
        ['ForegroundFaint', t.foreground],
        ['ForegroundIntense', t.foreground],
        ...names.flatMap((n, i) => [
            [`Color${i}`, t[n]],
            [`Color${i}Faint`, t[n]],
            [`Color${i}Intense`, bright(n)],
        ]),
    ];
    return `# GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs) — KP ${d.label}. Do not edit.
${blocks.map(([k, v]) => `[${k}]\nColor=${rgb(v)}`).join('\n\n')}

[General]
Anchor=0.5,0.5
Blur=false
ColorRandomization=false
Description=KP ${d.label}
FillStyle=Tile
Opacity=1
Wallpaper=
`;
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

/** @param {Desk} d @returns {{shared: Record<string, string>, windows: Record<string, string>, linux: Record<string, string>}} */
export function files(d) {
    const json = (/** @type {unknown} */ v) => `${JSON.stringify(v, null, 4)}\n`;
    return {
        shared: {
            'firedragon/userChrome.css': userChrome(d),
            'firedragon/userContent.css': userContent(d),
            'starship.toml': starship(d),
            'kp-colors.fish': fish(d),
            'wallpaper.svg': wallpaper(d),
            'wallpaper-lock.svg': wallpaper(d, true),
        },
        windows: {
            'terminal.json': json(terminal(d)),
            'prompt.omp.json': ohMyPosh(d),
            'mica-settings.json': json(mica(d)),
            'accent.reg': accentReg(d),
            'personalization.reg': personalizationReg(d),
            'windhawk/file-explorer-styler.yaml': windhawkExplorer(d).text,
            'windhawk/taskbar-styler.yaml': windhawkTaskbar(d).text,
            'windhawk/start-menu-styler.yaml': windhawkStart(d).text,
            'windhawk/notification-center-styler.yaml': windhawkNotificationCentre(d).text,
            'windhawk/translucent-windows.yaml': windhawkTranslucent(d).text,
            'windhawk.reg': windhawkReg(windhawkMods(d), `KP ${d.label}`),
            'start.svg': startButton(d),
        },
        linux: {
            'kde.colors': kdeColors(d),
            'konsole.colorscheme': konsoleScheme(d),
        },
    };
}

/** A double-click file in desktop/windows/launchers/. @param {string} what @param {string} command */
const launcher = (what, command) =>
    ['@echo off', `rem GENERATED by kp-themes ${VERSION} (gates/generate-desktop.mjs). ${what}`, command, ''].join('\r\n');

/** @returns {Map<string, string>} path under desktop/ → content */
export function render() {
    /** @type {Map<string, string>} */
    const out = new Map();
    const all = themes().map(load);
    for (const d of all) {
        const f = files(d);
        for (const [path, text] of Object.entries(f.shared)) out.set(`shared/${d.name}/${path}`, text);
        for (const [path, text] of Object.entries(f.windows)) out.set(`windows/themes/${d.name}/${path}`, text);
        for (const [path, text] of Object.entries(f.linux)) out.set(`linux/themes/${d.name}/${path}`, text);
    }
    // One set of styles for every theme: they read the Windows accent colour,
    // which accent.reg sets per theme, so a theme switch needs no pasting.
    out.set('windows/windhawk-accent/file-explorer-styler.yaml', windhawkExplorer(null).text);
    out.set('windows/windhawk-accent/taskbar-styler.yaml', windhawkTaskbar(null).text);
    out.set('windows/windhawk-accent/start-menu-styler.yaml', windhawkStart(null).text);
    out.set('windows/windhawk-accent/notification-center-styler.yaml', windhawkNotificationCentre(null).text);
    out.set('windows/windhawk-accent/translucent-windows.yaml', windhawkTranslucent(null).text);
    out.set('windows/windhawk-accent/windhawk.reg', windhawkReg(windhawkMods(null), 'accent-following'));

    // The double-click files, in the repo: launchers\Themes\ holds one per theme,
    // launchers\Tools\ the one-off jobs. They run the scripts two folders up.
    const ps = (/** @type {string} */ script, /** @type {string} */ args = '') =>
        `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\\..\\${script}"${args ? ` ${args}` : ''}`;
    for (const d of all) {
        out.set(
            `windows/launchers/Themes/${d.label}.cmd`,
            launcher(`Double-click: the whole desktop in KP ${d.label}.`, ps('apply.ps1', `-Theme ${d.name} -Pause`)),
        );
    }
    out.set(
        'windows/launchers/Tools/Install VS Code themes.cmd',
        launcher('All KP themes in VS Code; the active theme is left alone.', ps('install-vscode.ps1', '-Pause')),
    );
    out.set(
        'windows/launchers/Tools/Context menu - Windows 10 style.cmd',
        launcher('The full right-click menu at once, as in Windows 10.', ps('context-menu.ps1', '-Style Classic -Pause')),
    );
    out.set(
        'windows/launchers/Tools/Context menu - Windows 11 style.cmd',
        launcher('Back to the Windows 11 right-click menu.', ps('context-menu.ps1', '-Style Modern -Pause')),
    );
    out.set(
        'windows/launchers/Tools/Setup WSL (Arch).cmd',
        launcher('Arch Linux in WSL, Garuda-style, with ~/Projects/kp-themes cloned.', ps('setup-wsl.ps1', '-Pause')),
    );

    out.set(
        'shared/themes.json',
        `${JSON.stringify(
            all.map((/** @type {Desk} */ d) => ({ name: d.name, label: d.label, dark: d.dark })),
            null,
            4,
        )}\n`,
    );
    // The same list for the shell scripts, which should not need jq: name, label, dark|light.
    out.set('shared/themes.tsv', all.map((/** @type {Desk} */ d) => `${d.name}\t${d.label}\t${d.dark ? 'dark' : 'light'}\n`).join(''));
    return out;
}

function main() {
    const out = render();
    if (process.argv.includes('--check')) {
        const drift = [];
        for (const [path, text] of out) {
            let current = null;
            try {
                current = readFileSync(new URL(path, OUT), 'utf8');
            } catch {
                current = null;
            }
            if (current !== text) drift.push(path);
        }
        if (drift.length > 0) {
            console.error(`desktop/: ${drift.length} file(s) do not match their source, first: ${drift.slice(0, 3).join(', ')}`);
            console.error('Run `npm run generate:desktop` and commit the result.');
            process.exit(1);
        }
        console.log(`desktop/: ${out.size} files for ${themes().length} themes match their source.`);
        process.exit(0);
    }
    for (const [path, text] of out) {
        const url = new URL(path, OUT);
        mkdirSync(new URL('.', url), { recursive: true });
        writeFileSync(url, text);
    }
    console.log(`wrote ${out.size} files under desktop/ from ${themes().length} themes.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
