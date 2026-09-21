// Renders windows/<theme>/wallpaper.svg to wallpaper.png at 3840x2160, for
// windows/apply.ps1. Windows cannot use an SVG as a wallpaper, and 22 PNGs
// are 25 MB nobody should commit, so the PNGs are built here and ignored.
//
// Usage:
//   npm run render:wallpapers               all themes
//   npm run render:wallpapers -- synthwave  one theme

import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = new URL('../windows/', import.meta.url);
const all = JSON.parse(readFileSync(new URL('themes.json', OUT), 'utf8')).map((/** @type {{name: string}} */ t) => t.name);
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = wanted.length > 0 ? wanted : all;

// KP_CHROMIUM points at a Chromium when Playwright's own download is not there.
const browser = await chromium.launch(process.env.KP_CHROMIUM ? { executablePath: process.env.KP_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
for (const name of names) {
    // Two pictures per theme: the desktop, and the calmer one the lock and
    // sign-in screens draw their clock on.
    for (const kind of ['wallpaper', 'wallpaper-lock', 'start']) {
        const svg = new URL(`${name}/${kind}.svg`, OUT);
        if (!existsSync(svg)) {
            console.error(`${name}: no ${kind}.svg; run \`npm run generate:windows\` first.`);
            process.exitCode = 1;
            continue;
        }
        // The start button is a 64px glyph on nothing, drawn at twice its size.
        const small = kind === 'start';
        await page.setViewportSize(small ? { width: 64, height: 64 } : { width: 3840, height: 2160 });
        await page.goto(pathToFileURL(svg.pathname).href);
        await page.screenshot({ path: new URL(`${name}/${kind}.png`, OUT).pathname, omitBackground: small, scale: small ? 'device' : 'css' });
        console.log(`wrote windows/${name}/${kind}.png`);
    }
}
await browser.close();
