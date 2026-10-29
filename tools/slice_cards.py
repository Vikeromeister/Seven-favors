#!/usr/bin/env python3
"""Dev tool: slice art/ reference sheets into docs/assets card images. Requires Pillow."""
from pathlib import Path
from statistics import median
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ART, OUT = ROOT / 'art', ROOT / 'docs' / 'assets'
NAMES = ['chips_2pts', 'burger_2pts', 'spinner_2pts', 'cardigan_3pts',
         'sunglasses_3pts', 'ticket_4pts', 'phone_5pts']   # cards2 column order
TARGET_H = 480
INSET = 3          # px trimmed on every side to drop white rounded-corner fringe
WHITE = 232        # channel threshold for "gutter" pixels
GUTTER_FRAC = 0.90 # line is gutter if >= 90% of sampled pixels are white

def _line_is_gutter(img, axis, pos, lo, hi):
    box = (pos, lo, pos + 1, hi) if axis == 'x' else (lo, pos, hi, pos + 1)
    px = list(img.crop(box).getdata())
    white = sum(1 for r, g, b in px if min(r, g, b) >= WHITE)
    return white / max(1, len(px)) >= GUTTER_FRAC

def segments(img, axis, lo=0, hi=None, min_len=80):
    """Runs of non-gutter lines along axis ('x' = columns, 'y' = rows) within band [lo, hi)."""
    w, h = img.size
    hi = hi if hi is not None else (h if axis == 'x' else w)
    n = w if axis == 'x' else h
    runs, start = [], None
    for p in range(n):
        g = _line_is_gutter(img, axis, p, lo, hi)
        if not g and start is None: start = p
        if g and start is not None:
            if p - start >= min_len: runs.append((start, p))
            start = None
    if start is not None and n - start >= min_len: runs.append((start, n))
    return runs

def crop(img, x0, x1, y0, y1):
    return img.crop((x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET))

def main():
    s2 = Image.open(ART / 'cards2.png').convert('RGB')
    rows = segments(s2, 'y')
    assert len(rows) == 2, f'cards2: expected 2 rows, got {rows}'
    faces = {}
    for r, (y0, y1) in enumerate(rows):
        cols = segments(s2, 'x', y0, y1)
        assert len(cols) == 7, f'cards2 row {r}: expected 7 cols, got {cols}'
        prefix = 'woman_' if r == 0 else 'gift_'
        for c, (x0, x1) in enumerate(cols):
            faces[f'{prefix}{NAMES[c]}.png'] = crop(s2, x0, x1, y0, y1)
    W = int(median(im.width for im in faces.values()))
    H = int(median(im.height for im in faces.values()))
    tw = round(TARGET_H * W / H)
    for name, im in faces.items():
        ImageOps.fit(im, (tw, TARGET_H), Image.LANCZOS).save(OUT / name, optimize=True)

    s1 = Image.open(ART / 'cards1.png').convert('RGB')
    rows1 = segments(s1, 'y')
    y0, y1 = rows1[-1]
    cols1 = segments(s1, 'x', y0, y1)
    x0, x1 = cols1[-1]                       # bottom-right = card back
    back = crop(s1, x0, x1, y0, y1)
    ImageOps.fit(back, (tw, TARGET_H), Image.LANCZOS, centering=(0.5, 0.5)).save(
        OUT / 'background_card.png', optimize=True)
    print(f'--card-ar: {tw / TARGET_H:.4f};  size {tw}x{TARGET_H}')

if __name__ == '__main__':
    main()
