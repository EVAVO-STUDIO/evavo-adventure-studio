from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont

# Original 320x200 construction art for The Red Ledger. Everything is drawn on
# the native grid: no high-resolution source, resampling, blur or anti-aliasing.
COLOURS: tuple[tuple[int, int, int], ...] = (
    (0, 0, 0),        # 0 transparent / absolute black
    (5, 7, 11),       # 1 deepest ink
    (9, 12, 18),      # 2 blue-black
    (14, 19, 27),     # 3 deep navy
    (20, 27, 37),     # 4 midnight slate
    (27, 36, 47),     # 5 dark slate
    (37, 48, 60),     # 6 slate
    (50, 63, 75),     # 7 light slate
    (67, 80, 91),     # 8 storm grey
    (86, 100, 110),   # 9 mist grey
    (111, 124, 130),  # 10 pale mist
    (145, 151, 150),  # 11 cold highlight
    (190, 185, 166),  # 12 paper shadow
    (222, 210, 179),  # 13 paper
    (242, 229, 191),  # 14 paper highlight
    (59, 39, 33),     # 15 deep wood
    (82, 54, 41),     # 16 wood
    (112, 77, 53),    # 17 warm wood
    (154, 112, 67),   # 18 brass shadow
    (198, 157, 88),   # 19 brass
    (235, 197, 120),  # 20 brass highlight
    (52, 17, 26),     # 21 dried crimson
    (100, 28, 43),    # 22 ledger red
    (151, 43, 57),    # 23 crimson
    (204, 72, 73),    # 24 red highlight
    (23, 39, 48),     # 25 rain blue
    (35, 58, 69),     # 26 window blue
    (52, 78, 87),     # 27 wet stone
    (78, 105, 108),   # 28 cold light
    (118, 137, 132),  # 29 window highlight
    (42, 36, 35),     # 30 charcoal brown
    (65, 53, 49),     # 31 warm grey
    (93, 75, 63),     # 32 warm stone
    (126, 102, 80),   # 33 warm stone highlight
    (41, 46, 43),     # 34 moss shadow
    (57, 67, 58),     # 35 moss
    (83, 92, 72),     # 36 moss highlight
    (111, 83, 66),    # 37 skin shadow
    (153, 116, 90),   # 38 skin
    (195, 153, 116),  # 39 skin highlight
    (31, 27, 33),     # 40 coat deepest
    (43, 48, 61),     # 41 coat shadow
    (57, 68, 84),     # 42 coat
    (81, 91, 104),    # 43 coat highlight
    (25, 21, 22),     # 44 black cloth
    (61, 48, 45),     # 45 clerk suit shadow
    (84, 64, 56),     # 46 clerk suit
    (116, 88, 69),    # 47 clerk suit highlight
)


def _palette() -> list[int]:
    values = [component for colour in COLOURS for component in colour]
    return values + [0] * (768 - len(values))


def canvas(size: tuple[int, int], colour: int = 1) -> Image.Image:
    image = Image.new("P", size, colour)
    image.putpalette(_palette())
    return image


def save(image: Image.Image, path: Path, *, transparent: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    options = {"optimize": True}
    if transparent:
        options["transparency"] = 0
    image.save(path, format="PNG", **options)


def checker(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], a: int, b: int, step: int = 2) -> None:
    x0, y0, x1, y1 = box
    for y in range(y0, y1 + 1, step):
        for x in range(x0, x1 + 1, step):
            draw.point((x, y), fill=a if ((x // step) + (y // step)) % 2 == 0 else b)


def stipple(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], colour: int, modulus: int = 5, seed: int = 0) -> None:
    x0, y0, x1, y1 = box
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x * 11 + y * 17 + seed) % modulus == 0:
                draw.point((x, y), fill=colour)


def brick_wall(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], base: int, mortar: int, highlight: int | None = None, brick_w: int = 22, brick_h: int = 10) -> None:
    x0, y0, x1, y1 = box
    draw.rectangle(box, fill=base)
    for row, y in enumerate(range(y0, y1 + 1, brick_h)):
        draw.line((x0, y, x1, y), fill=mortar)
        offset = 0 if row % 2 == 0 else brick_w // 2
        for x in range(x0 - offset, x1 + brick_w, brick_w):
            draw.line((x, y, x, min(y + brick_h, y1)), fill=mortar)
        if highlight is not None and y + 1 <= y1:
            draw.line((x0, y + 1, x1, y + 1), fill=highlight)


def perspective_floor(draw: ImageDraw.ImageDraw, horizon: int, bottom: int, base: int, seam: int, glint: int | None = None) -> None:
    draw.rectangle((0, horizon, 319, bottom), fill=base)
    for y in (horizon + 4, horizon + 10, horizon + 19, horizon + 31, horizon + 46):
        if y <= bottom:
            draw.line((0, y, 319, y), fill=seam)
            if glint is not None and y + 1 <= bottom:
                for x in range((y * 3) % 17, 320, 29):
                    draw.line((x, y + 1, min(x + 8, 319), y + 1), fill=glint)
    vanishing = (160, horizon)
    for x in (-120, -50, 16, 66, 106, 136, 160, 184, 214, 254, 304, 370, 440):
        draw.line((vanishing[0], vanishing[1], x, bottom), fill=seam)


def rain(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], dark: int, light: int, seed: int = 0, spacing: int = 9) -> None:
    x0, y0, x1, y1 = box
    for x in range(x0 - 20 + seed % spacing, x1 + 20, spacing):
        y = y0 + ((x * 13 + seed * 7) % max(1, y1 - y0))
        draw.line((x, y, x - 4, min(y + 15, y1)), fill=dark)
        if (x + seed) % (spacing * 2) == 0:
            draw.point((x - 2, min(y + 7, y1)), fill=light)


def glow_dither(draw: ImageDraw.ImageDraw, center: tuple[int, int], radii: Iterable[int], colours: Iterable[int]) -> None:
    cx, cy = center
    for radius, colour in zip(radii, colours):
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius * 2, cx + radius * 2 + 1):
                dx = (x - cx) / 2
                dy = y - cy
                distance = dx * dx + dy * dy
                if distance <= radius * radius and (x + y + radius) % 3 == 0:
                    draw.point((x, y), fill=colour)


def build_archive(path: Path) -> None:
    image = canvas((320, 200), 3)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, 319, 18), fill=1)
    d.rectangle((0, 18, 319, 139), fill=4)
    d.rectangle((0, 22, 319, 26), fill=6)
    d.line((0, 27, 319, 27), fill=2)
    stipple(d, (0, 28, 319, 139), 5, 17, 2)
    perspective_floor(d, 140, 199, 2, 5, 8)

    # Foreground framing shelves and priority occluders.
    d.rectangle((0, 34, 33, 177), fill=1, outline=7)
    d.rectangle((5, 39, 29, 169), fill=15, outline=6)
    for y in (59, 86, 113, 140):
        d.rectangle((6, y, 28, y + 3), fill=17)
    book_colours = (12, 22, 18, 8, 13, 23, 32)
    for shelf, y in enumerate((42, 63, 90, 117, 144)):
        x = 8
        for index in range(5):
            width = 2 + (index * 3 + shelf) % 4
            height = 11 + (index * 5 + shelf * 2) % 9
            colour = book_colours[(index + shelf) % len(book_colours)]
            d.rectangle((x, y + 17 - height, x + width, y + 17), fill=colour)
            if colour in (12, 13):
                d.point((x + 1, y + 15 - height // 2), fill=22)
            x += width + 2

    # Rain window, city and leaded frame.
    d.rectangle((75, 29, 185, 112), fill=1, outline=8)
    d.rectangle((80, 34, 180, 106), fill=25)
    d.rectangle((80, 70, 180, 106), fill=3)
    skyline = [(82, 83, 94, 106), (96, 75, 111, 106), (113, 87, 124, 106),
               (126, 66, 144, 106), (146, 79, 159, 106), (161, 71, 178, 106)]
    for i, box in enumerate(skyline):
        d.rectangle(box, fill=2 + i % 3)
        x0, y0, x1, _ = box
        for wy in range(y0 + 5, 102, 8):
            for wx in range(x0 + 4, x1, 7):
                if (wx + wy + i) % 3 == 0:
                    d.point((wx, wy), fill=19 if i % 2 else 10)
    rain(d, (81, 35, 179, 105), 28, 29, 3, 8)
    d.rectangle((128, 34, 132, 106), fill=7)
    d.rectangle((80, 68, 180, 72), fill=7)
    d.line((80, 34, 180, 106), fill=6)

    # File wall with irregular records.
    d.rectangle((198, 25, 271, 133), fill=1, outline=7)
    for shelf, y in enumerate((31, 54, 77, 100, 123)):
        if y < 123:
            d.rectangle((203, y, 266, y + 17), fill=15, outline=6)
            x = 205
            for item in range(8):
                width = 4 + (item + shelf) % 3
                height = 10 + ((item * 3 + shelf) % 6)
                colour = (12, 13, 32, 18, 22)[(item + shelf) % 5]
                d.rectangle((x, y + 15 - height, x + width, y + 15), fill=colour)
                x += width + 2
        d.line((201, y + 18, 268, y + 18), fill=17)

    # Brass-framed chapel exit.
    d.rectangle((275, 40, 319, 177), fill=1, outline=19)
    d.rectangle((280, 48, 314, 174), fill=5)
    d.rectangle((283, 51, 311, 171), outline=7)
    for y in (72, 96, 120, 144):
        d.line((284, y, 310, y), fill=6)
    d.ellipse((303, 106, 307, 110), fill=20)

    # Service alley door and red evidence motif.
    d.rectangle((0, 72, 29, 178), fill=1, outline=22)
    d.rectangle((5, 78, 25, 174), fill=30)
    d.rectangle((9, 88, 21, 112), outline=22)
    d.line((10, 100, 20, 100), fill=23)
    d.line((15, 89, 15, 111), fill=23)

    # Archive desk and lamp light pool.
    glow_dither(d, (158, 125), (43, 31, 20), (17, 18, 19))
    d.rectangle((91, 112, 221, 151), fill=15, outline=18)
    d.rectangle((85, 107, 228, 115), fill=17, outline=20)
    d.rectangle((101, 119, 211, 145), fill=16)
    d.rectangle((146, 128, 168, 133), fill=15, outline=18)
    d.rectangle((117, 112, 167, 130), fill=12, outline=14)
    d.polygon(((119, 114), (162, 113), (167, 128), (121, 129)), fill=13)
    for y, width in ((117, 36), (120, 31), (123, 39), (126, 27)):
        d.line((124, y, 124 + width, y), fill=22)
    d.ellipse((144, 118, 154, 126), outline=22)
    d.line((149, 119, 149, 125), fill=23)

    d.rectangle((198, 78, 202, 107), fill=19)
    d.rectangle((190, 75, 211, 81), fill=21, outline=20)
    d.rectangle((193, 70, 208, 75), fill=22)
    d.rectangle((188, 106, 212, 109), fill=18)
    d.line((194, 83, 207, 83), fill=20)

    # Floor shadows, paper scraps and rainy glints.
    d.polygon(((44, 155), (109, 147), (134, 163), (65, 174)), fill=1)
    d.polygon(((218, 151), (282, 153), (312, 177), (240, 172)), fill=1)
    d.rectangle((45, 161, 58, 167), fill=12)
    d.line((47, 163, 55, 163), fill=22)
    for x in range(10, 320, 31):
        d.line((x, 183 + (x % 3), min(x + 13, 319), 183 + (x % 3)), fill=7)
        if x % 2 == 0:
            d.point((x + 4, 184 + (x % 3)), fill=10)

    save(image, path)


def build_chapel(path: Path) -> None:
    image = canvas((320, 200), 3)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, 319, 141), fill=4)
    brick_wall(d, (0, 24, 319, 141), 5, 3, 6, 28, 12)
    perspective_floor(d, 142, 199, 2, 6, 9)

    # Deep gothic arches and columns.
    for center in (62, 258):
        d.rectangle((center - 31, 51, center + 31, 142), fill=3, outline=8)
        d.ellipse((center - 31, 18, center + 31, 84), fill=3, outline=8)
        d.rectangle((center - 25, 53, center + 25, 139), fill=25)
        d.ellipse((center - 25, 25, center + 25, 74), fill=25)
        d.polygon(((center, 25), (center - 25, 61), (center + 25, 61)), fill=22)
        d.line((center, 27, center, 132), fill=7)
        d.line((center - 24, 61, center + 24, 61), fill=7)
        for y in range(69, 130, 15):
            d.line((center - 23, y, center + 23, y), fill=6)
        rain(d, (center - 23, 63, center + 23, 132), 28, 29, center, 11)

    # Central registry apse.
    d.rectangle((105, 38, 215, 143), fill=3, outline=9)
    d.polygon(((105, 38), (160, 11), (215, 38)), fill=3, outline=9)
    d.rectangle((116, 51, 204, 128), fill=5)
    for y in (61, 72, 83, 94, 105, 116):
        d.line((121, y, 199, y), fill=7)
    d.line((129, 52, 129, 126), fill=6)
    d.line((191, 52, 191, 126), fill=6)

    # Carved pillars and foreground framing.
    for x in (95, 218):
        d.rectangle((x, 37, x + 10, 149), fill=6, outline=3)
        d.rectangle((x - 3, 34, x + 13, 42), fill=8)
        d.rectangle((x - 4, 143, x + 14, 151), fill=8)
        for y in range(49, 139, 13):
            d.line((x + 2, y, x + 8, y), fill=7)

    # Registry desk and open vellum.
    glow_dither(d, (164, 124), (36, 25, 15), (17, 18, 20))
    d.rectangle((132, 111, 220, 151), fill=15, outline=19)
    d.polygon(((139, 104), (213, 104), (222, 113), (130, 113)), fill=17, outline=20)
    d.polygon(((145, 106), (176, 103), (179, 128), (145, 130)), fill=13)
    d.polygon(((177, 103), (208, 106), (208, 130), (179, 128)), fill=12)
    d.line((177, 104, 178, 128), fill=22)
    for y in (109, 114, 119, 124):
        d.line((149, y, 171, y), fill=31)
        d.line((184, y, 204, y), fill=31)
    d.ellipse((168, 116, 184, 132), outline=22)
    d.line((171, 124, 181, 124), fill=23)

    # Candles and restrained warm pools.
    for x in (121, 228):
        d.rectangle((x, 111, x + 3, 136), fill=13)
        d.point((x + 1, 109), fill=20)
        d.point((x + 1, 108), fill=24)
        glow_dither(d, (x + 1, 111), (15, 9), (18, 19))

    # Return door and chapel details.
    d.rectangle((0, 58, 30, 177), fill=1, outline=19)
    d.rectangle((5, 64, 25, 174), fill=30)
    d.ellipse((18, 112, 22, 116), fill=20)
    d.rectangle((283, 83, 319, 151), fill=3, outline=8)
    d.polygon(((301, 58), (282, 86), (320, 86)), fill=3, outline=8)
    d.rectangle((291, 93, 312, 141), fill=34)
    d.ellipse((295, 70, 307, 84), fill=32)
    d.rectangle((297, 82, 305, 110), fill=32)

    # Floor reflections and dust-motes rendered as sparse pixels.
    d.polygon(((132, 153), (219, 153), (245, 199), (104, 199)), fill=3)
    checker(d, (132, 155, 219, 163), 4, 5, 3)
    for x, y in ((76, 50), (88, 83), (234, 62), (253, 108), (174, 42), (153, 76)):
        d.point((x, y), fill=11)

    save(image, path)


def build_alley(path: Path) -> None:
    image = canvas((320, 200), 2)
    d = ImageDraw.Draw(image)
    brick_wall(d, (0, 15, 319, 144), 5, 3, 6, 24, 10)
    d.rectangle((0, 0, 319, 17), fill=1)
    perspective_floor(d, 145, 199, 1, 5, 9)

    # Window recesses and drain pipes.
    for x in (50, 224):
        d.rectangle((x, 29, x + 48, 91), fill=1, outline=8)
        d.rectangle((x + 5, 34, x + 43, 86), fill=25)
        d.line((x + 24, 35, x + 24, 85), fill=7)
        d.line((x + 6, 60, x + 42, 60), fill=7)
        rain(d, (x + 6, 35, x + 42, 85), 28, 29, x, 8)
    for x in (116, 300):
        d.rectangle((x, 12, x + 5, 153), fill=7, outline=3)
        for y in range(28, 145, 24):
            d.rectangle((x - 2, y, x + 7, y + 3), fill=8)

    # Fire escape gives a strong foreground silhouette.
    d.rectangle((149, 28, 213, 34), fill=30, outline=8)
    d.rectangle((143, 69, 207, 75), fill=30, outline=8)
    for x in range(148, 211, 10):
        d.line((x, 34, x - 7, 69), fill=8)
    d.line((208, 31, 185, 113), fill=8)
    d.line((198, 31, 175, 113), fill=8)
    for y in range(39, 106, 9):
        d.line((194 - (y - 39) // 4, y, 204 - (y - 39) // 4, y), fill=7)

    # Archive return door.
    d.rectangle((0, 49, 31, 178), fill=1, outline=19)
    d.rectangle((5, 56, 26, 174), fill=30)
    d.rectangle((9, 66, 22, 94), outline=22)
    d.ellipse((19, 112, 23, 116), fill=20)

    # Ledger cache with a readable crimson focal point.
    glow_dither(d, (240, 126), (26, 18, 10), (21, 22, 23))
    d.rectangle((203, 98, 274, 151), fill=15, outline=22)
    d.rectangle((209, 104, 267, 144), fill=13, outline=23)
    d.line((214, 112, 261, 112), fill=22)
    d.line((214, 119, 255, 119), fill=22)
    d.line((214, 126, 263, 126), fill=22)
    d.line((214, 133, 248, 133), fill=22)
    d.ellipse((229, 115, 250, 136), outline=23)
    d.line((234, 125, 245, 125), fill=24)
    d.line((239, 119, 239, 132), fill=24)

    # Wet refuse, puddles and reflected lights.
    d.polygon(((35, 151), (115, 151), (138, 178), (12, 178)), fill=25)
    d.polygon(((177, 157), (307, 151), (319, 188), (159, 188)), fill=25)
    for box in ((52, 156, 105, 157), (35, 167, 126, 168), (200, 163, 289, 164), (181, 178, 310, 179)):
        d.rectangle(box, fill=28)
    d.rectangle((125, 122, 151, 151), fill=30, outline=7)
    d.rectangle((130, 116, 146, 122), fill=31)
    d.polygon(((87, 136), (106, 142), (101, 153), (80, 149)), fill=34)
    d.line((83, 142, 103, 146), fill=36)

    rain(d, (0, 0, 319, 166), 8, 10, 11, 9)
    for x in range(12, 315, 23):
        y = 187 + (x * 7) % 7
        d.line((x, y, min(x + 9, 319), y), fill=9)

    save(image, path)


def _draw_archivist_frame(sheet: Image.Image, origin_x: int, phase: int) -> None:
    d = ImageDraw.Draw(sheet)
    ox = origin_x
    # Ground shadow.
    d.ellipse((ox + 7, 59, ox + 25, 63), fill=1)
    # Legs and shoes, shifted for walk phases.
    left_shift = -2 if phase == 1 else (2 if phase == 2 else 0)
    right_shift = 2 if phase == 1 else (-2 if phase == 2 else 0)
    d.rectangle((ox + 10 + left_shift, 43, ox + 14 + left_shift, 58), fill=40)
    d.rectangle((ox + 18 + right_shift, 43, ox + 22 + right_shift, 58), fill=40)
    d.rectangle((ox + 8 + left_shift, 58, ox + 14 + left_shift, 61), fill=44)
    d.rectangle((ox + 18 + right_shift, 58, ox + 25 + right_shift, 61), fill=44)
    # Coat tails and torso.
    d.polygon(((ox + 9, 19), (ox + 23, 19), (ox + 25, 46), (ox + 19, 51), (ox + 16, 45), (ox + 13, 51), (ox + 7, 46)), fill=41)
    d.rectangle((ox + 11, 20, ox + 22, 42), fill=42)
    d.line((ox + 12, 22, ox + 12, 41), fill=43)
    d.line((ox + 21, 22, ox + 21, 42), fill=40)
    d.line((ox + 16, 21, ox + 16, 40), fill=40)
    # Shirt, waistcoat, tie/scarf accent.
    d.polygon(((ox + 14, 19), (ox + 19, 19), (ox + 18, 31), (ox + 15, 31)), fill=12)
    d.rectangle((ox + 16, 21, ox + 17, 32), fill=22)
    d.point((ox + 17, 22), fill=24)
    # Arms with readable swing.
    arm_l = -2 if phase == 1 else (1 if phase == 2 else 0)
    arm_r = 2 if phase == 1 else (-1 if phase == 2 else 0)
    d.line((ox + 10, 23, ox + 6 + arm_l, 41), fill=40, width=3)
    d.line((ox + 22, 23, ox + 26 + arm_r, 41), fill=40, width=3)
    d.point((ox + 6 + arm_l, 42), fill=38)
    d.point((ox + 26 + arm_r, 42), fill=38)
    # Head, face, hair and fedora.
    d.rectangle((ox + 12, 8, ox + 21, 18), fill=38)
    d.rectangle((ox + 13, 9, ox + 20, 12), fill=39)
    d.point((ox + 20, 13), fill=1)
    d.line((ox + 12, 8, ox + 20, 8), fill=44)
    d.rectangle((ox + 9, 5, ox + 24, 8), fill=40)
    d.rectangle((ox + 12, 1, ox + 21, 5), fill=41)
    d.line((ox + 13, 2, ox + 20, 2), fill=43)
    # Pixel rim light from wet rooms.
    d.point((ox + 23, 24), fill=43)
    d.point((ox + 24, 30), fill=43)
    d.point((ox + 21, 45), fill=43)


def build_archivist(path: Path) -> None:
    sheet = canvas((96, 64), 0)
    for frame, phase in enumerate((0, 1, 2)):
        _draw_archivist_frame(sheet, frame * 32, phase)
    save(sheet, path, transparent=True)


def build_clerk(path: Path) -> None:
    image = canvas((32, 64), 0)
    d = ImageDraw.Draw(image)
    d.ellipse((7, 59, 25, 63), fill=1)
    d.rectangle((10, 45, 14, 59), fill=44)
    d.rectangle((18, 45, 22, 59), fill=44)
    d.rectangle((8, 58, 15, 61), fill=1)
    d.rectangle((18, 58, 25, 61), fill=1)
    d.polygon(((8, 19), (24, 19), (25, 47), (19, 50), (16, 44), (13, 50), (7, 47)), fill=45)
    d.rectangle((11, 21, 22, 43), fill=46)
    d.line((12, 23, 12, 41), fill=47)
    d.polygon(((14, 20), (19, 20), (18, 31), (15, 31)), fill=13)
    d.rectangle((16, 22, 17, 31), fill=19)
    d.line((9, 23, 6, 43), fill=45, width=3)
    d.line((23, 23, 26, 43), fill=45, width=3)
    d.rectangle((12, 8, 21, 18), fill=38)
    d.rectangle((13, 9, 20, 12), fill=39)
    d.point((20, 13), fill=1)
    d.line((11, 12, 22, 12), fill=20)
    d.point((14, 12), fill=1)
    d.point((19, 12), fill=1)
    d.rectangle((10, 4, 22, 8), fill=44)
    d.rectangle((12, 2, 20, 5), fill=45)
    save(image, path, transparent=True)


def build_ui_font(path: Path, characters: str, columns: int = 16, cell_w: int = 8, cell_h: int = 10) -> tuple[int, int]:
    rows = (len(characters) + columns - 1) // columns
    image = canvas((columns * cell_w, rows * cell_h), 0)
    font = ImageFont.load_default()
    for index, char in enumerate(characters):
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        # Draw into a 1-bit mask first so the atlas remains strictly binary.
        mask = Image.new("1", (cell_w, cell_h), 0)
        md = ImageDraw.Draw(mask)
        md.text((0, -2), char, font=font, fill=1)
        for py in range(cell_h):
            for px in range(cell_w):
                if mask.getpixel((px, py)):
                    image.putpixel((x + px, y + py), 13)
    save(image, path, transparent=True)
    return image.size



def build_account(path: Path) -> None:
    image = canvas((32, 18), 0)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, 31, 17), fill=22)
    d.rectangle((2, 2, 29, 15), fill=13)
    d.line((5, 5, 26, 5), fill=31)
    d.line((5, 9, 23, 9), fill=31)
    d.line((5, 13, 27, 13), fill=22)
    d.ellipse((22, 8, 28, 14), outline=23)
    save(image, path, transparent=True)


def build_drawer(path: Path, *, opened: bool) -> None:
    size = (40, 30) if opened else (40, 24)
    image = canvas(size, 0)
    d = ImageDraw.Draw(image)
    y = 7 if opened else 0
    d.rectangle((0, y, 39, size[1] - 1), fill=18)
    d.rectangle((2, y + 2, 37, size[1] - 3), fill=16)
    d.rectangle((5, y + 6, 34, size[1] - 6), fill=15)
    d.rectangle((17, y + 9, 22, y + 11), fill=20)
    if opened:
        d.polygon(((2, 7), (7, 0), (33, 0), (38, 7)), fill=30, outline=19)
        d.rectangle((8, 12, 31, 21), fill=13)
        d.line((10, 15, 28, 15), fill=22)
        d.line((10, 18, 25, 18), fill=31)
    save(image, path, transparent=True)


def build_door(path: Path, size: tuple[int, int], *, red: bool = False, opened: bool = False) -> None:
    image = canvas(size, 0)
    d = ImageDraw.Draw(image)
    w, h = size
    frame = 22 if red else 19
    d.rectangle((0, 0, w - 1, h - 1), fill=frame)
    d.rectangle((2, 2, w - 3, h - 3), fill=1 if opened else 30)
    if opened:
        d.polygon(((5, 5), (w - 7, 11), (w - 7, h - 8), (5, h - 4)), fill=3)
        d.line((6, 7, w - 8, h - 9), fill=8)
    else:
        d.rectangle((6, 8, w - 7, h - 9), fill=5)
        for y in range(16, h - 12, 19):
            d.line((7, y, w - 8, y), fill=7)
        d.ellipse((w - 11, h // 2 - 2, w - 7, h // 2 + 2), fill=20)
        if red:
            d.rectangle((w // 2 - 4, h // 2 - 7, w // 2 + 4, h // 2 + 6), fill=1, outline=23)
    save(image, path, transparent=True)


def build_registry(path: Path) -> None:
    image = canvas((54, 38), 0)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, 53, 37), fill=19)
    d.rectangle((2, 2, 51, 35), fill=13)
    d.line((6, 8, 46, 8), fill=31)
    d.line((6, 14, 41, 14), fill=31)
    d.line((6, 20, 47, 20), fill=31)
    d.line((6, 26, 35, 26), fill=31)
    d.ellipse((38, 23, 48, 33), outline=22)
    d.line((40, 28, 46, 28), fill=23)
    save(image, path, transparent=True)


def build_ledger(path: Path) -> None:
    image = canvas((68, 50), 0)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, 67, 49), fill=22)
    d.rectangle((3, 3, 64, 46), fill=21)
    d.rectangle((9, 8, 58, 40), fill=13)
    for y, x2 in ((14, 52), (20, 47), (26, 55), (32, 43)):
        d.line((15, y, x2, y), fill=22)
    d.ellipse((39, 24, 54, 39), outline=23)
    d.line((43, 31, 50, 31), fill=24)
    d.line((47, 27, 47, 35), fill=24)
    save(image, path, transparent=True)


def build_inventory_icon(path: Path, *, copy: bool) -> None:
    image = canvas((18, 18), 0)
    d = ImageDraw.Draw(image)
    d.rectangle((1, 0, 16, 17), fill=19 if copy else 22)
    d.rectangle((3, 2, 14, 15), fill=13)
    d.line((5, 5, 12, 5), fill=31)
    d.line((5, 8, 12, 8), fill=31)
    d.line((5, 11, 10, 11), fill=31)
    if copy:
        d.ellipse((10, 10, 14, 14), fill=22)
    else:
        d.point((12, 13), fill=23)
    save(image, path, transparent=True)


def build_small_pixel_assets(asset_directory: Path) -> dict[str, tuple[int, int]]:
    build_account(asset_directory / "account.png")
    build_drawer(asset_directory / "drawer-closed.png", opened=False)
    build_drawer(asset_directory / "drawer-open.png", opened=True)
    build_door(asset_directory / "chapel-door.png", (42, 104))
    build_door(asset_directory / "alley-door-locked.png", (34, 98), red=True)
    build_door(asset_directory / "alley-door-open.png", (34, 98), red=True, opened=True)
    build_registry(asset_directory / "registry.png")
    build_door(asset_directory / "return-door.png", (30, 94))
    build_ledger(asset_directory / "alley-ledger.png")
    build_inventory_icon(asset_directory / "record-icon.png", copy=False)
    build_inventory_icon(asset_directory / "chapel-copy-icon.png", copy=True)
    return {
        "account.png": (32, 18),
        "drawer-closed.png": (40, 24),
        "drawer-open.png": (40, 30),
        "chapel-door.png": (42, 104),
        "alley-door-locked.png": (34, 98),
        "alley-door-open.png": (34, 98),
        "registry.png": (54, 38),
        "return-door.png": (30, 94),
        "alley-ledger.png": (68, 50),
        "record-icon.png": (18, 18),
        "chapel-copy-icon.png": (18, 18),
    }

def generate_red_ledger_pixel_art(asset_directory: Path, font_characters: str | None = None) -> dict[str, tuple[int, int]]:
    asset_directory.mkdir(parents=True, exist_ok=True)
    build_archive(asset_directory / "archive.png")
    build_chapel(asset_directory / "chapel.png")
    build_alley(asset_directory / "alley.png")
    build_archivist(asset_directory / "archivist-sheet.png")
    build_clerk(asset_directory / "clerk-sheet.png")
    sizes: dict[str, tuple[int, int]] = {
        "archive.png": (320, 200),
        "chapel.png": (320, 200),
        "alley.png": (320, 200),
        "archivist-sheet.png": (96, 64),
        "clerk-sheet.png": (32, 64),
        **build_small_pixel_assets(asset_directory),
    }
    if font_characters is not None:
        sizes["ui-font.png"] = build_ui_font(asset_directory / "ui-font.png", font_characters)
    return sizes


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "payload/apps/player/public/demos/the-red-ledger/assets"
    print(generate_red_ledger_pixel_art(target))
