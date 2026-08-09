# Regenerate the home page's 4:5 portrait from the master in assets/images/.
#
# Run from the repo root:  python .tools/portrait.py
#
# The home hero draws the plate at 300px wide, 4:5, so it needs a 600px variant
# for retina — the square profile-200/400 files the old hero used are a
# different crop and are still used by the styleguide's .plate specimen.
#
# Dev-only, like everything in .tools/: the site ships the JPEGs and WebPs, not
# this script or the master it reads. Pillow only; nothing here is a build step.

from PIL import Image

src = Image.open('assets/images/profile.jpg')     # 3468 x 2789
W, H = src.size

h = H
w = int(round(h * 4 / 5))                          # full height, 4:5 wide

# Horizontal centre of the subject, measured off a downscaled preview rather
# than guessed — a centred crop puts the head noticeably left of centre.
cx = int(W * 0.562)
left = max(0, min(W - w, cx - w // 2))

crop = src.crop((left, 0, left + w, h))

for width in (300, 600):
    im = crop.resize((width, int(width * 5 / 4)), Image.LANCZOS)
    im.save(f'assets/images/portrait-{width}.jpg',
            quality=86, optimize=True, progressive=True)
    im.save(f'assets/images/portrait-{width}.webp', quality=82, method=6)
    print(f'portrait-{width}  {im.size[0]}x{im.size[1]}')
