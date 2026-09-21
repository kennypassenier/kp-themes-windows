"""The shipped fonts as TrueType, for the Windows and Linux desktop.

Windows and fontconfig want .ttf or .otf, not .woff2, so the desktop scripts cannot use
fonts/ as it is. This decompresses every face in fonts/families.json into
desktop/shared/fonts/<file>.ttf (ignored by git: they are rebuilt from fonts/, which
is the source) and writes desktop/shared/fonts/fonts.json, which maps each family
name a theme's font stack can name to its files.

The family name is the one the themes' font stacks use: families.json's
`renamed` for the faces renamed over a Reserved Font Name (KP Tech Mono,
KP Outrun Display, KP Ticker Mono), else its `family`. Each file gets that
name as its typographic family (name ID 16), because a variable font's plain
family (ID 1) names its default instance ("Big Shoulders Display Thin"), and
Windows would register the family under that.

Usage: python3 gates/desktop-fonts.py        (needs fonttools and brotli)
"""

import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "fonts"
OUT = ROOT / "desktop" / "shared" / "fonts"


def set_family(font: TTFont, family: str) -> None:
    """Name the typographic family, so every face of it lands in one family."""
    font["name"].setName(family, 16, 3, 1, 0x409)


def main() -> None:
    families = json.loads((SRC / "families.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    index: dict[str, list[str]] = {}
    for slug, entry in families.items():
        if slug.startswith("//") or not isinstance(entry, dict):
            continue
        for face in entry.get("faces", []):
            source = SRC / slug / f"{face['file']}.woff2"
            if not source.exists():
                continue
            family = entry.get("renamed") or entry["family"]
            font = TTFont(str(source))
            font.flavor = None
            set_family(font, family)
            target = OUT / f"{face['file']}.ttf"
            font.save(str(target))
            index.setdefault(family, []).append(target.name)
    (OUT / "fonts.json").write_text(json.dumps(dict(sorted(index.items())), indent=4) + "\n", encoding="utf-8")
    print(f"wrote {sum(len(v) for v in index.values())} faces in {len(index)} families to desktop/shared/fonts/")


if __name__ == "__main__":
    main()
