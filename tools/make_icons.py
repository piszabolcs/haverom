"""Build Haverom's icons from the mascot artwork.

Input : public/haverom_mascot.png  (the mascot on a transparent background)
Output: public/haverom_icon.png    (512 px app tile, for the README and the About card)
        public/haverom_icon.ico    (16-256 px, window and tray icon)
        public/haverom_tray.png    (32 px tile, tray fallback)

The tile is a rounded square: a deep teal to navy gradient with a soft mint
glow behind the mascot and a mint inner rim - the same colours as the UI
(see the --haverom-* variables in src/styles/globals.css).

Run with any Python that has Pillow:  python tools/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SIZE = 1024
RADIUS = 232                      # ~22.5 %, a Windows 11 style squircle
TOP = (23, 57, 58)                # #17393A deep teal
BOTTOM = (9, 21, 45)              # #09152D navy
MINT = (98, 236, 190)             # #62ECBE mascot glow
MASCOT_SCALE = 0.74               # mascot width relative to the tile


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
    return mask


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        draw.line([(0, y), (size, y)],
                  fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)))
    return img.convert("RGBA")


def glow(size: int, center_y: float, radius: float, alpha: int) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx, cy, r = size / 2, size * center_y, size * radius
    ImageDraw.Draw(layer).ellipse((cx - r, cy - r, cx + r, cy + r), fill=MINT + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(size * 0.12))


def inner_rim(size: int, radius: int) -> Image.Image:
    """A mint glow along the inside of the tile edge."""
    rim = Image.new("L", (size, size), 0)
    ImageDraw.Draw(rim).rounded_rectangle((6, 6, size - 7, size - 7), radius - 6,
                                          outline=255, width=14)
    rim = rim.filter(ImageFilter.GaussianBlur(18))
    rim = ImageChops.multiply(rim, rounded_mask(size, radius))
    layer = Image.new("RGBA", (size, size), MINT + (0,))
    layer.putalpha(rim.point(lambda v: int(v * 0.75)))
    edge = Image.new("L", (size, size), 0)
    ImageDraw.Draw(edge).rounded_rectangle((1, 1, size - 2, size - 2), radius - 1,
                                           outline=150, width=4)
    edge_layer = Image.new("RGBA", (size, size), MINT + (0,))
    edge_layer.putalpha(edge)
    layer.alpha_composite(edge_layer)
    return layer


def trimmed_mascot() -> Image.Image:
    art = Image.open(PUBLIC / "haverom_mascot.png").convert("RGBA")
    return art.crop(art.getchannel("A").getbbox())


def build_tile() -> Image.Image:
    tile = gradient(SIZE)
    tile.alpha_composite(glow(SIZE, 0.54, 0.34, 120))
    mascot = trimmed_mascot()
    width = int(SIZE * MASCOT_SCALE)
    height = int(mascot.height * width / mascot.width)
    if height > SIZE * MASCOT_SCALE:              # very tall art: fit by height
        height = int(SIZE * MASCOT_SCALE)
        width = int(mascot.width * height / mascot.height)
    mascot = mascot.resize((width, height), Image.LANCZOS)
    pos = ((SIZE - width) // 2, (SIZE - height) // 2 + SIZE // 40)
    # a soft mint halo that follows the mascot's outline
    halo_mask = Image.new("L", (SIZE, SIZE), 0)
    halo_mask.paste(mascot.getchannel("A"), pos)
    halo_mask = halo_mask.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(34))
    halo = Image.new("RGBA", (SIZE, SIZE), MINT + (0,))
    halo.putalpha(halo_mask.point(lambda v: int(v * 0.85)))
    tile.alpha_composite(halo)
    tile.alpha_composite(mascot, pos)
    tile.alpha_composite(inner_rim(SIZE, RADIUS))
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(tile, (0, 0), rounded_mask(SIZE, RADIUS))
    return out


def main() -> None:
    tile = build_tile()
    tile.resize((512, 512), Image.LANCZOS).save(PUBLIC / "haverom_icon.png", optimize=True)
    tile.resize((32, 32), Image.LANCZOS).save(PUBLIC / "haverom_tray.png", optimize=True)
    sizes = [(s, s) for s in (16, 20, 24, 32, 40, 48, 64, 128, 256)]
    tile.resize((256, 256), Image.LANCZOS).save(PUBLIC / "haverom_icon.ico", sizes=sizes)
    for name in ("haverom_icon.png", "haverom_tray.png", "haverom_icon.ico"):
        print("wrote", PUBLIC / name)


if __name__ == "__main__":
    main()
