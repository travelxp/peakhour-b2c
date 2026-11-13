"""One-off asset build for the email Brand Shell logos (public/email/*@2x.png).

Two kinds of artwork, following src/components/shared/peakhour-logo.tsx:

* The LOCKUP (public/peakhour-logo.png: outline mark + "Peakhour.ai") is line art
  on transparency. It is recoloured per ground, the way the app uses
  `dark:invert`, and shipped at 28 CSS px tall (56 px file): below that the
  outline mark smudges. The email header shows it on the ink band.
* The MARK (public/peakhour-icon.svg) is the solid-disc cut: a dark disc with
  light radar arcs. It is never inverted (an inverted disc reads as a photo
  negative). It is shipped OPAQUE (disc and arcs both painted), so it stays
  legible when a mail client darkens the ground behind it, at 24 CSS px (48 px).

VERSIONS. Each palette writes its own file names, so an email already sent keeps
the image it was sent with (mail clients and image proxies cache by URL):
  v1  (no suffix)  cream on brown-black ink, the 1041 brand (cfg_email_brand peakhour-v1)
  v2  (-v2)        white on indigo ink, the Daylight brand (peakhour-mongodb 1046)
Pass the version as the second argument; it defaults to v2.

Usage, from the repo root:
  python -m pip install --user pillow
  # Render the SVG to a 2000x2000 PNG once, outside this repo, for example:
  #   npm i @resvg/resvg-js   (in a scratch folder)
  #   node -e "const {Resvg}=require('@resvg/resvg-js');const fs=require('fs');
  #     fs.writeFileSync('icon2000.png',new Resvg(fs.readFileSync('public/peakhour-icon.svg'),
  #     {fitTo:{mode:'width',value:2000}}).render().asPng())"
  python scripts/build-email-logos.py <icon2000.png> [v1|v2]
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "email"

CREAM = (0xF6, 0xF1, 0xE7)  # v1 --on-ink
INK = (0x10, 0x0D, 0x08)  # v1 --ink
INK_LIFTED = (0x2A, 0x22, 0x16)  # v1: a disc one step above ink, so its edge shows on the ink band

WHITE = (0xFF, 0xFF, 0xFF)  # v2 (Daylight) --on-ink
INDIGO = (0x0F, 0x11, 0x30)  # v2 (Daylight) --ink
INDIGO_LIFTED = (0x24, 0x28, 0x5C)  # v2: a disc one step above indigo, so its edge shows on the band

LOCKUP_HEIGHT = 56  # 2x of 28 CSS px
MARK_SIZE = 48  # 2x of 24 CSS px

# Per version: the file-name suffix, the lockup glyph colour keyed by the GROUND it
# sits on, and the mark's (disc colour, arc colour) keyed the same way.
PALETTES = {
    "v1": {
        "suffix": "",
        "lockup": {"on-ink": CREAM, "on-paper": INK},
        "mark": {"on-ink": (INK_LIFTED, CREAM), "on-paper": (INK, CREAM)},
    },
    "v2": {
        "suffix": "-v2",
        "lockup": {"on-ink": WHITE, "on-paper": INDIGO},
        "mark": {"on-ink": (INDIGO_LIFTED, WHITE), "on-paper": (INDIGO, WHITE)},
    },
}


def build_lockup(src: Image.Image, glyph, out: Path) -> None:
    """Keep the source alpha, paint it one colour, resample only alpha (no halo)."""
    w = round(src.width * LOCKUP_HEIGHT / src.height)
    w += w % 2  # even pixel width, so the 1x display width is a whole number
    alpha = src.getchannel("A").resize((w, LOCKUP_HEIGHT), Image.LANCZOS)
    img = Image.new("RGBA", (w, LOCKUP_HEIGHT), glyph + (0,))
    img.putalpha(alpha)
    img.save(out, optimize=True)


def build_mark(src: Image.Image, disc, arcs, out: Path) -> None:
    """Paint the disc and the arcs (both opaque), then downsample the RGBA image."""
    coverage = src.getchannel("A")  # where the disc is
    arcness = src.getchannel("R")  # inside the disc: 255 on the arcs, 0 on the disc
    rgb = Image.composite(Image.new("RGB", src.size, arcs), Image.new("RGB", src.size, disc), arcness)
    rgba = rgb.convert("RGBA")
    rgba.putalpha(coverage)
    rgba.resize((MARK_SIZE, MARK_SIZE), Image.LANCZOS).save(out, optimize=True)


def main(argv) -> int:
    if len(argv) not in (2, 3):
        print(__doc__, file=sys.stderr)
        return 2
    version = argv[2] if len(argv) == 3 else "v2"
    if version not in PALETTES:
        print(f"unknown version {version!r}; expected one of {', '.join(PALETTES)}", file=sys.stderr)
        return 2
    palette = PALETTES[version]
    sfx = palette["suffix"]
    icon = Image.open(argv[1]).convert("RGBA")
    if icon.size != (2000, 2000):
        print(f"expected a 2000x2000 render of peakhour-icon.svg, got {icon.size}", file=sys.stderr)
        return 2
    if icon.getpixel((1000, 1000))[3] == 0:
        print("the icon render has no disc at its centre; is it peakhour-icon.svg?", file=sys.stderr)
        return 2
    lockup = Image.open(ROOT / "public" / "peakhour-logo.png").convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)
    for ground, glyph in palette["lockup"].items():
        build_lockup(lockup, glyph, OUT / f"wordmark-{ground}{sfx}@2x.png")
    for ground, (disc, arcs) in palette["mark"].items():
        build_mark(icon, disc, arcs, OUT / f"mark-{ground}{sfx}@2x.png")
    for f in sorted(OUT.glob("*.png")):
        with Image.open(f) as im:
            print(f"{f.name}: {im.size[0]}x{im.size[1]}, {f.stat().st_size} B")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
