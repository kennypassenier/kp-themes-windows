"""Rename a subset face so it carries none of its Reserved Font Name [R6-Q1].

The OFL lets anyone subset a font, but a subset is a Modified Version and
"no Modified Version of the Font Software may use the Reserved Font
Name(s)" — not even as part of a new name (OFL FAQ 2.7). So the shipped
face is renamed at build: family (1), subfamily-qualified full name (4),
PostScript name (6), typographic family (16) and the unique id (3), plus
the variable-font instance names when the file is variable. The reserved
word never appears in the result, which gates/check-fonts.mjs measures on
the file itself.

Usage: python3 gates/rename-font.py <file.woff2> "<Old Family>" "<New Family>" "<Reserved word>"

fontTools is the tool the subsetter already depends on (pyftsubset).
"""

import sys

from fontTools.ttLib import TTFont


def main(path, old, new, reserved):
    font = TTFont(path)
    name = font["name"]
    ps_new = new.replace(" ", "")
    for record in name.names:
        try:
            text = record.toUnicode()
        except UnicodeDecodeError:
            continue
        if record.nameID in (1, 16):
            if text == old or reserved in text:
                record.string = new
        elif record.nameID == 4:
            record.string = text.replace(old, new)
        elif record.nameID == 6:
            record.string = text.replace(old.replace(" ", ""), ps_new).replace(reserved.replace(" ", ""), ps_new)
        elif record.nameID == 3:
            record.string = text.replace(old, new).replace(reserved, ps_new)
        elif reserved in text and record.nameID not in (0, 7, 8, 9, 11, 13, 14):
            # A subfamily or instance name that carries the family word.
            record.string = text.replace(old, new).replace(reserved, ps_new)
    # The licence notice (13) and the copyright (0) stay as the authors wrote
    # them: the OFL requires the notice to travel with the file.
    font.flavor = "woff2"
    font.save(path)
    remaining = [r.nameID for r in name.names if r.nameID not in (0, 7, 8, 9, 11, 13, 14) and reserved in r.toUnicode()]
    if remaining:
        print(f"{path}: the reserved word is still in name records {remaining}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    main(*sys.argv[1:])
