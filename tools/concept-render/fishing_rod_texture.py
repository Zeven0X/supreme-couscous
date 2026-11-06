import math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
N = 128          # real Galaxium texture size
FR = 16          # preview frames (final: 60)

RAMP = [(0.00, (10, 12, 48)), (0.35, (36, 24, 110)), (0.60, (110, 56, 210)),
        (0.80, (205, 60, 160)), (1.00, (255, 170, 220))]
OUTLINE = (6, 6, 22)
GOLD = (255, 205, 96)
GOLD_D = (170, 110, 35)
WHITE = (255, 248, 230)

def ramp(v):
    v = max(0.0, min(1.0, v))
    for (a, ca), (b, cb) in zip(RAMP, RAMP[1:]):
        if v <= b:
            t = (v - a) / (b - a)
            return tuple(int(ca[i] + (cb[i] - ca[i]) * t) for i in range(3))
    return RAMP[-1][1]

rng = np.random.default_rng(11)
WAVES = [(int(rng.integers(1, 5)), int(rng.integers(1, 5)), rng.uniform(0, 6.28), rng.uniform(.5, 1)) for _ in range(9)]
STARS = [(int(rng.integers(0, N)), int(rng.integers(0, N)), rng.uniform(0, 6.28)) for _ in range(700)]

def nebula(x, y, f):
    ph = 2 * math.pi * f / FR
    v = 0.0
    for kx, ky, p, a in WAVES:
        v += a * math.sin(2 * math.pi * (kx * x + ky * y) / N + p + ph * (1 if (kx + ky) % 2 else -1))
    return 0.5 + v / 8.0

# rod: vanilla-like silhouette (handle bottom-left, gentle bend, tip top-right), tapering
P0, P1, P2 = (16, 116), (54, 58), (108, 14)

def bez(t):
    return ((1-t)**2*P0[0] + 2*(1-t)*t*P1[0] + t*t*P2[0],
            (1-t)**2*P0[1] + 2*(1-t)*t*P1[1] + t*t*P2[1])

def build_masks():
    rod = np.zeros((N, N), bool); handle = np.zeros((N, N), bool); tval = np.full((N, N), -1.0)
    for i in range(801):
        t = i / 800
        x, y = bez(t)
        w = 6.2 - 4.4 * t
        r = int(math.ceil(w))
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if dx*dx + dy*dy <= w*w:
                    xi, yi = int(round(x+dx)), int(round(y+dy))
                    if 0 <= xi < N and 0 <= yi < N:
                        rod[yi, xi] = True
                        tval[yi, xi] = max(tval[yi, xi], t)
                        if t < 0.30:
                            handle[yi, xi] = True
    return rod, handle, tval

ROD, HANDLE, TV = build_masks()
TIP = bez(1.0)

def put(px, x, y, c, a=255, over=True):
    xi, yi = int(round(x)), int(round(y))
    if 0 <= xi < N and 0 <= yi < N and (over or px[xi, yi][3] == 0):
        px[xi, yi] = tuple(c) + (a,)

def outline(px, mask):
    for y in range(N):
        for x in range(N):
            if not mask[y, x] and px[x, y][3] == 0:
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    if 0 <= x+dx < N and 0 <= y+dy < N and mask[y+dy, x+dx]:
                        px[x, y] = OUTLINE + (255,)
                        break

def draw_rod(px, f):
    for y in range(N):
        for x in range(N):
            if ROD[y, x]:
                v = nebula(x, y, f)
                if HANDLE[y, x]:
                    v *= 0.42
                # soft edge shading so the rod reads as round
                px[x, y] = ramp(v) + (255,)
    # gold grip bands (perpendicular to the rod)
    for tb in (0.10, 0.17, 0.24):
        bx, by = bez(tb)
        ex, ey = bez(tb + 0.01)
        dx, dy = ex - bx, ey - by
        L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
        for s in np.linspace(-8, 8, 60):
            for o in (0, 1):
                X, Y = bx + nx * s + dx / L * o, by + ny * s + dy / L * o
                xi, yi = int(round(X)), int(round(Y))
                if 0 <= xi < N and 0 <= yi < N and ROD[yi, xi]:
                    px[xi, yi] = (GOLD if o == 0 else GOLD_D) + (255,)
    # stars (twinkle)
    for sx, sy, p in STARS:
        if ROD[sy, sx] and not HANDLE[sy, sx]:
            b = 0.5 + 0.5 * math.sin(p + 4 * math.pi * f / FR)
            if b > 0.6:
                px[sx, sy] = (GOLD if b < 0.88 else WHITE) + (255,)
    # small gold tip ring (line guide)
    tx, ty = TIP
    for a in np.linspace(0, 2 * math.pi, 40):
        put(px, tx + 2.6 * math.cos(a), ty + 2.6 * math.sin(a), GOLD)
    outline(px, ROD | (np.array([[px[x, y][3] > 0 for x in range(N)] for y in range(N)])))

def comet(px, cx, cy, f, tail=True):
    if tail:
        for k in range(4, 26):
            a = int(255 * (1 - k / 26) ** 0.9)
            w = 4.2 * (1 - k / 32)
            bx, by = cx + k * 0.75, cy - k * 0.55
            r = int(math.ceil(w))
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if dx*dx + dy*dy <= w*w:
                        put(px, bx + dx, by + dy, (235, 90, 200) if k < 15 else (150, 70, 220), a, over=False)
    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * f / FR)
    for dx in range(-7, 8):
        for dy in range(-7, 8):
            r2 = dx*dx + dy*dy
            if r2 <= 5 + 3 * pulse:
                put(px, cx+dx, cy+dy, WHITE)
            elif r2 <= 20:
                put(px, cx+dx, cy+dy, GOLD)
            elif r2 <= 30:
                put(px, cx+dx, cy+dy, GOLD_D)
            elif r2 <= 42:
                put(px, cx+dx, cy+dy, OUTLINE, over=False)

def draw_line(px, f):
    tx, ty = TIP
    end_y = 98
    sway = math.sin(2 * math.pi * f / FR) * 1.2
    for i in range(400):
        t = i / 399
        x = tx + sway * t * t; y = ty + 3 + (end_y - ty - 3) * t
        glow = 0.6 + 0.4 * math.sin(2 * math.pi * (t * 3 - f / FR))
        put(px, x, y, (int(170 + 70 * glow), int(110 + 90 * glow), 255))
        put(px, x - 1, y, (90, 50, 170), 170, over=False)
        put(px, x + 1, y, (90, 50, 170), 170, over=False)
    return tx + sway, end_y + 7

def item(f, cast=False):
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0)); px = img.load()
    draw_rod(px, f)
    if not cast:
        bx, by = draw_line(px, f)
        comet(px, bx, by, f)
    return img

def bobber_on_lava(f):
    W = 128
    img = Image.new("RGBA", (W, W), (0, 0, 0, 255)); px = img.load()
    for y in range(W):
        for x in range(W):
            if y < 70:
                px[x, y] = (40, 14, 18, 255)
            else:
                v = 0.5 + 0.25 * math.sin(x / 9 + f / 2.5) + 0.25 * math.sin((x + y) / 13 - f / 3)
                px[x, y] = (int(200 + 55 * v), int(70 + 90 * v), int(10 + 20 * v), 255)
    bob = 1.5 * math.sin(2 * math.pi * f / FR)
    # line coming down from above
    for y in range(0, int(66 + bob)):
        px[64, y] = (210, 160, 255, 255)
    comet(px, 64, 72 + bob, f, tail=False)
    # ripple ring
    r = 10 + (f % 8) * 1.6
    for a in np.linspace(0, 2 * math.pi, 120):
        x, y = 64 + r * math.cos(a), 78 + 0.35 * r * math.sin(a)
        if y > 74:
            put(px, x, y, (255, 230, 150), int(200 * (1 - (f % 8) / 8)))
    return img

S = 3
W = N * S
PAD = 24
try:
    fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 17)
    fr = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
    ft = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
except OSError:
    fb = fr = ft = ImageFont.load_default()

def checker(d, x0, y0, w, h):
    d.rectangle([x0, y0, x0 + w - 1, y0 + h - 1], fill=(44, 40, 62))
    q = 24
    for gy in range(0, h, q):
        for gx in range(0, w, q):
            if (gx // q + gy // q) % 2:
                d.rectangle([x0 + gx, y0 + gy, min(x0 + gx + q, x0 + w) - 1, min(y0 + gy + q, y0 + h) - 1], fill=(50, 46, 70))

PANELS = [
    ("1. Item (in inventory / hand)", ["Vanilla rod shape, 128px Galaxium", "nebula body, gold grip bands,", "glowing violet line + comet bobber"]),
    ("2. Cast (while fishing)", ["Rod only, like vanilla's cast", "texture; the line and bobber are", "drawn out in the world"]),
    ("3. Bobber floating on lava", ["Comet bobber in Nether lava", "(needed for lava fishing);", "pulses, ripples when a fish bites"]),
    ("4. Real inventory size", ["How it looks at normal GUI", "scale (16px slot x3)"]),
]

frames = []
for f in range(FR):
    pw = [W, W, W, 200]
    sw = sum(pw) + PAD * (len(pw) + 1)
    sh = 56 + W + 92 + PAD
    sheet = Image.new("RGB", (sw, sh), (22, 20, 34)); d = ImageDraw.Draw(sheet)
    d.text((PAD, 16), "Galaxium Fishing Rod - concept B on the vanilla rod shape (128px)", font=ft, fill=(235, 230, 255))
    x = PAD; y0 = 56
    it = item(f); ca = item(f, cast=True); lv = bobber_on_lava(f)
    for i, (title, lines) in enumerate(PANELS):
        if i < 3:
            checker(d, x, y0, W, W) if i < 2 else None
            src = (it, ca, lv)[i].resize((W, W), Image.NEAREST)
            sheet.paste(src, (x, y0), src)
        else:
            checker(d, x, y0, 200, 200)
            slot = Image.new("RGB", (60, 60), (139, 139, 139)); sd = ImageDraw.Draw(slot)
            sd.rectangle([0, 0, 59, 59], outline=(55, 55, 55)); sd.rectangle([3, 3, 56, 56], fill=(139, 139, 139))
            small = it.resize((16, 16), Image.BOX).resize((48, 48), Image.NEAREST)
            slot.paste(small, (6, 6), small)
            sheet.paste(slot.resize((120, 120), Image.NEAREST), (x + 40, y0 + 40))
        d.text((x, y0 + W + 10), title, font=fb, fill=(255, 210, 120))
        for k, ln in enumerate(lines):
            d.text((x, y0 + W + 34 + k * 17), ln, font=fr, fill=(210, 205, 230))
        x += pw[i] + PAD
    frames.append(sheet)

frames[0].save(OUT + ".png")
frames[0].save(OUT + ".gif", save_all=True, append_images=frames[1:], duration=90, loop=0)
item(0).save(OUT + "-item-128.png"); item(0, cast=True).save(OUT + "-cast-128.png")
print("ok")
