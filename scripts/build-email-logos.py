"""One-off asset build for the BS-3 email logo PNGs (public/email/*@2x.png).

Usage (from the repo root):
  python -m pip install --user pillow
  # render the SVG mark to 2000x2000 PNG with any tool, e.g.
  #   npm i @resvg/resvg-js (outside this repo) and Resvg(svg, {fitTo:{mode:'width',value:2000}})
  python scripts/build-email-logos.py <icon-2000.png>

Recolour = keep the source alpha, set RGB to the target colour. Only alpha is
resampled (Lanczos, from the full-size source), so there is no colour halo.
"""
import sys
from PIL import Image, ImageChops

INK, PAPER = (0xF6, 0xF1, 0xE7), (0x10, 0x0D, 0x08)  # glyph colour on ink / on paper


def mark_alpha(src):
    """The icon SVG is a black disc with the glyph drawn in white. The mark is the
    disc with the glyph knocked out, so the glyph shows the background behind it."""
    r, a = src.convert("RGBA").getchannel("R"), src.convert("RGBA").getchannel("A")
    return ImageChops.multiply(a, ImageChops.invert(r))


def build(src, size, colour, out, alpha_of=lambda im: im.convert("RGBA").getchannel("A")):
    alpha = alpha_of(src).resize(size, Image.LANCZOS)
    img = Image.new("RGBA", size, colour + (0,))
    img.putalpha(alpha)
    img.save(out, optimize=True)


wordmark = Image.open("public/peakhour-logo.png")
h = 44
w = round(wordmark.width * h / wordmark.height)
mark = Image.open(sys.argv[1])
for name, colour in (("on-ink", INK), ("on-paper", PAPER)):
    build(wordmark, (w, h), colour, f"public/email/wordmark-{name}@2x.png")
    build(mark, (32, 32), colour, f"public/email/mark-{name}@2x.png", mark_alpha)
