import sys
from pathlib import Path

sys.path.insert(0, "/tmp/codex_qr")

from PIL import Image, ImageDraw, ImageFont
import qrcode


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "client" / "public" / "cover-qr.png"
ARROW = Path("/Users/khudob1n/Downloads/navigation.png")
URL = "https://krasnodar-transport.khudob1n.ru"
DOMAIN = "krasnodar-transport.khudob1n.ru"

W, H = 1920, 1080
RED = (197, 0, 0)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(ROOT / "client" / "assets" / "og" / name), size)


def centered_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font_obj, fill=BLACK) -> None:
    bbox = draw.textbbox((0, 0), text, font=font_obj)
    tw = bbox[2] - bbox[0]
    draw.text((xy[0] - tw / 2, xy[1]), text, font=font_obj, fill=fill)


def draw_arrow(image: Image.Image, center: tuple[int, int], size: int) -> None:
    source = Image.open(ARROW).convert("RGBA")
    alpha = source.getchannel("A")
    arrow = Image.new("RGBA", source.size, RED + (0,))
    arrow.putalpha(alpha)
    arrow = arrow.rotate(-45, expand=True, resample=Image.Resampling.BICUBIC)
    arrow = arrow.resize((size, size), Image.Resampling.LANCZOS)
    x = center[0] - arrow.width // 2
    y = center[1] - arrow.height // 2
    image.paste(arrow, (x, y), arrow)


def main() -> None:
    image = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(image)

    title_font = font("onest-cyrillic-700-normal.woff", 126)
    domain_font = font("onest-latin-400-normal.woff", 35)

    draw_arrow(image, (W // 2, 306), 270)

    centered_text(draw, (W // 2, 520), "Транспорт", title_font)
    centered_text(draw, (W // 2, 664), "Краснодара", title_font)

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=2,
    )
    qr.add_data(URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((166, 166), Image.Resampling.NEAREST)

    image.paste(qr_img, (W // 2 - 83, 836))
    centered_text(draw, (W // 2, 1018), DOMAIN, domain_font)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, quality=95)
    print(OUT)


if __name__ == "__main__":
    main()
