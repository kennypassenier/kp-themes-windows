// Renders the SVG pictures of desktop/ to PNG, for the scripts that set them:
//
//   desktop/shared/<theme>/wallpaper.svg        → wallpaper.png       3840x2160
//   desktop/shared/<theme>/wallpaper-lock.svg   → wallpaper-lock.png  3840x2160
//   desktop/windows/themes/<theme>/start.svg    → start.png           64x64
//
// Windows cannot use an SVG as a wallpaper, and 22 pairs of PNGs are 25 MB
// nobody should commit, so they are built here and ignored by git.
//
// rsvg-convert (librsvg, on every KDE desktop) is used when it is there, so a
// Garuda or WSL clone needs no browser; otherwise Playwright's Chromium, or the
// one KP_CHROMIUM points at.
//
// Usage:
//   npm run render:wallpapers               all themes
//   npm run render:wallpapers -- synthwave  one theme

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DESK = new URL('../desktop/', import.meta.url);
const all = JSON.parse(readFileSync(new URL('shared/themes.json', DESK), 'utf8')).map((/** @type {{name: string}} */ t) => t.name);
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = wanted.length > 0 ? wanted : all;

/** @type {{svg: URL, png: URL, width: number, height: number, transparent: boolean}[]} */
const jobs = [];
for (const name of names) {
    // The desktop, the calmer picture the lock and sign-in screens draw their
    // clock on, and the start button: a 64px glyph on nothing.
    for (const kind of ['wallpaper', 'wallpaper-lock']) {
        jobs.push({
            svg: new URL(`shared/${name}/${kind}.svg`, DESK),
            png: new URL(`shared/${name}/${kind}.png`, DESK),
            width: 3840,
            height: 2160,
            transparent: false,
        });
    }
    jobs.push({
        svg: new URL(`windows/themes/${name}/start.svg`, DESK),
        png: new URL(`windows/themes/${name}/start.png`, DESK),
        width: 64,
        height: 64,
        transparent: true,
    });
}
const missing = jobs.filter((j) => !existsSync(j.svg));
if (missing.length > 0) {
    console.error(`${fileURLToPath(missing[0].svg)} is missing; run \`npm run generate:desktop\` first.`);
    process.exit(1);
}

let rsvg = false;
try {
    execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' });
    rsvg = true;
} catch {
    rsvg = false;
}

if (rsvg) {
    for (const j of jobs) {
        execFileSync('rsvg-convert', ['-w', String(j.width), '-h', String(j.height), '-o', fileURLToPath(j.png), fileURLToPath(j.svg)]);
        console.log(`wrote ${fileURLToPath(j.png)}`);
    }
} else {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch(process.env.KP_CHROMIUM ? { executablePath: process.env.KP_CHROMIUM } : {});
    const page = await browser.newPage({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
    for (const j of jobs) {
        await page.setViewportSize({ width: j.width, height: j.height });
        await page.goto(pathToFileURL(fileURLToPath(j.svg)).href);
        await page.screenshot({ path: fileURLToPath(j.png), omitBackground: j.transparent });
        console.log(`wrote ${fileURLToPath(j.png)}`);
    }
    await browser.close();
}
