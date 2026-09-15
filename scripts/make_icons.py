"""PWA アイコンを生成する。暗い角丸背景に琥珀色の実と「実」の字。"""
# 実行: python scripts/make_icons.py（リポジトリ直下で。Windows の游ゴシックを使う）
from PIL import Image, ImageDraw, ImageFont

BACKGROUND = (24, 24, 27)      # zinc-900
FRUIT = (245, 158, 11)         # amber-500
LEAF = (34, 197, 94)           # green-500
TEXT = (24, 24, 27)
FONT_PATH = r"C:\Windows\Fonts\YuGothB.ttc"
SUPERSAMPLE = 4

def draw_icon(size: int, content_scale: float, rounded: bool) -> Image.Image:
    canvas = size * SUPERSAMPLE
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = int(canvas * 0.22) if rounded else 0
    draw.rounded_rectangle([0, 0, canvas - 1, canvas - 1], radius=radius, fill=BACKGROUND)

    # maskable は中央 80% が安全領域なので、中身を縮めて置く
    content = canvas * content_scale
    offset = (canvas - content) / 2
    fruit_diameter = content * 0.72
    fruit_left = offset + (content - fruit_diameter) / 2
    fruit_top = offset + content * 0.2
    draw.ellipse([fruit_left, fruit_top, fruit_left + fruit_diameter, fruit_top + fruit_diameter], fill=FRUIT)

    leaf_width = content * 0.26
    leaf_height = content * 0.14
    leaf_left = offset + content * 0.5
    leaf_top = fruit_top - leaf_height * 0.55
    draw.ellipse([leaf_left, leaf_top, leaf_left + leaf_width, leaf_top + leaf_height], fill=LEAF)

    font = ImageFont.truetype(FONT_PATH, int(fruit_diameter * 0.58))
    center = (fruit_left + fruit_diameter / 2, fruit_top + fruit_diameter / 2)
    draw.text(center, "実", font=font, fill=TEXT, anchor="mm")

    return image.resize((size, size), Image.LANCZOS)

outputs = [
    ("public/icons/icon-192.png", 192, 1.0, True),
    ("public/icons/icon-512.png", 512, 1.0, True),
    ("public/icons/icon-maskable-512.png", 512, 0.78, False),
    ("src/app/apple-icon.png", 180, 0.9, False),
    ("src/app/icon.png", 64, 1.0, True),
]
for path, size, scale, rounded in outputs:
    icon = draw_icon(size, scale, rounded)
    if not rounded:
        icon = icon.convert("RGB")
    icon.save(path, optimize=True)
    print(path, icon.size, icon.mode)
