"""Audit reference/plan delivery without declaring missing sprites production-ready."""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--strict', action='store_true', help='Exit 2 until every final sprite sheet meets technical checks.')
args = parser.parse_args()
folder = Path(__file__).resolve().parents[1] / 'assets/mobs/fire_salamander'
plan = json.loads((folder / 'animation_plan.json').read_text())
assert plan['directions'] == ['down', 'up', 'left', 'right']
assert sum(a['totalFrames'] for a in plan['animations'].values()) == 108
assert plan['projectile']['frames'] == 4
assert plan['plannedTotalFrames'] == 112
references = []
for filename in [plan['approvedReference'], plan['generatedStudy']]:
    file = folder / filename
    image = Image.open(file)
    rgba = image.convert('RGBA')
    colors = rgba.getcolors(image.width * image.height)
    alpha = rgba.getchannel('A')
    histogram = alpha.histogram()
    references.append({
        'file': filename, 'width': image.width, 'height': image.height, 'mode': image.mode,
        'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
        'rgbaColors': len(colors), 'hasAlphaChannel': 'A' in image.getbands(),
        'fullyTransparentPixels': histogram[0], 'partiallyTransparentPixels': sum(histogram[1:255]),
        'divisibleByNative64': image.width % 64 == 0 and image.height % 64 == 0,
        'productionSheet': False,
    })
checks = []
for item in [*plan['animations'].values(), plan['projectile']]:
    file = folder / item['file']
    result = {'file': item['file'], 'expectedDimensions': [item['width'], item['height']], 'exists': file.exists(), 'technicalChecksPassed': False}
    assert len(item['frameDurationsMs']) == item['columns']
    if file.exists():
        image = Image.open(file)
        alpha = image.convert('RGBA').getchannel('A').histogram()
        frame_width = item.get('frameWidth', 64)
        frame_height = item.get('frameHeight', 64)
        missing_cells = []
        for row in range(item['rows']):
            for col in range(item['columns']):
                bounds = (col * frame_width, row * frame_height, (col + 1) * frame_width, (row + 1) * frame_height)
                if not image.convert('RGBA').crop(bounds).getchannel('A').getbbox():
                    missing_cells.append([row, col])
        result.update({'actualDimensions': list(image.size), 'rgba': image.mode == 'RGBA',
                       'hasTransparentPixels': alpha[0] > 0, 'hasPartialAlpha': sum(alpha[1:255]) > 0,
                       'emptyCells': missing_cells})
        result['technicalChecksPassed'] = (image.size == (item['width'], item['height']) and image.mode == 'RGBA'
                                           and alpha[0] > 0 and sum(alpha[1:255]) == 0 and not missing_cells)
    checks.append(result)
technical_ready = all(check['technicalChecksPassed'] for check in checks)
production_ready = technical_ready and not plan['manualValidationPending']
report = {'deliveryStatus': 'final_sheets_reviewed' if production_ready else 'reference_and_animation_plan_only', 'referenceAndPlanAudited': True,
          'runtimeReady': production_ready, 'referenceImages': references, 'finalSpriteSheets': checks,
          'allFinalSheetTechnicalChecksPassed': technical_ready,
          'manualVisualValidation': 'pending; technical checks cannot prove anatomy, direction or seamless animation',
          'gameplayModified': False}
(folder / 'VALIDACAO.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('Reference and 112-frame production plan audited.')
for reference in references:
    print(f"REFERENCE {reference['file']}: {reference['width']}x{reference['height']}, {reference['mode']}, partial-alpha pixels={reference['partiallyTransparentPixels']}")
for check in checks:
    print(f"{'TECHNICAL PASS' if check['technicalChecksPassed'] else 'PENDING'} {check['file']}: {check['expectedDimensions']}")
print('Production-ready sheets: YES.' if production_ready else 'Production-ready sheets: NO. Manual frame/pixel correction is required.')
if args.strict and not production_ready:
    raise SystemExit(2)
