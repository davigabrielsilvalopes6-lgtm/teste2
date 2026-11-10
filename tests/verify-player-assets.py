"""Verify fidelity to the provided images, independently of the crop generator."""
from pathlib import Path
import hashlib
import json
from PIL import Image

folder = Path(__file__).resolve().parents[1] / 'assets/characters/player'
meta = json.loads((folder / 'player_animations.json').read_text())
source_path = folder / 'source' / meta['source']
source = Image.open(source_path).convert('RGBA')
atlas = Image.open(folder / 'player-walk-atlas.png')
assert source.size == tuple(meta['sourceSize']) == (1330, 1182)
assert hashlib.sha256(source_path.read_bytes()).hexdigest() == meta['sourceSha256']
assert atlas.mode == 'RGBA' and atlas.size == (1152, 1088)
assert len(meta['frames']) == 24
seen = set()
for frame in meta['frames']:
    sx, sy, width, height = frame['sourceRect']
    ax, ay, aw, ah = frame['atlasRect']
    assert (width, height) == (aw, ah)
    copied = atlas.crop((ax, ay, ax + width, ay + height))
    original = source.crop((sx, sy, sx + width, sy + height))
    assert copied.tobytes() == original.tobytes(), frame
    row = meta['directions'].index(frame['direction'])
    col = frame['frame']
    assert col * 192 <= ax < ax + width <= (col + 1) * 192
    assert row * 272 <= ay < ay + height <= (row + 1) * 272
    cell = atlas.crop((col * 192, row * 272, (col + 1) * 192, (row + 1) * 272))
    assert cell.getchannel('A').getextrema() == (0, 255)
    # Main feet contact aligns to the same native pixel in every pose.
    main_bottom = frame['mainBounds'][3]
    source_cell_top = [0, 279, 575, 871][row]
    assert ay - row * 272 + main_bottom - (sy - source_cell_top) == 264
    seen.add(hashlib.sha256(cell.tobytes()).hexdigest())
assert len(seen) == 24, 'All supplied poses remain distinct; no fabricated duplicates.'
print('PASS: 24 exact RGBA copies, unique poses, bounds, transparency, fixed feet anchor and source hash')
