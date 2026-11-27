#!/usr/bin/env python3
# new-project.py — scaffold a new video project from the template
#   py new-project.py <target-dir>
# then follow the printed next steps
import os, shutil, sys

try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))

if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
    print(__doc__ or 'usage: py new-project.py <target-dir>')
    sys.exit(0 if len(sys.argv) >= 2 else 1)

target = os.path.abspath(sys.argv[1])
if os.path.exists(target) and os.listdir(target):
    print(f'error: {target} exists and is not empty — choose a new folder or clear it first')
    sys.exit(1)
os.makedirs(target, exist_ok=True)

# engine: render/publish/mux/mix/measure scripts + shared lib/ — copied as a tree,
# excluding noise like __pycache__
def ignore_noise(d, names):
    return [n for n in names if n == '__pycache__' or n.endswith('.pyc')]
shutil.copytree(os.path.join(HERE, 'engine'), os.path.join(target, 'engine'), ignore=ignore_noise)

# template: project skeleton (including Kanit fonts in assets/)
for item in os.listdir(os.path.join(HERE, 'template')):
    src = os.path.join(HERE, 'template', item)
    if os.path.isdir(src):
        shutil.copytree(src, os.path.join(target, item), dirs_exist_ok=True)
    else:
        shutil.copy2(src, target)

os.makedirs(os.path.join(target, 'vo'), exist_ok=True)

# root .gitignore — scaffolded projects get the same media-protection rules
shutil.copy2(os.path.join(HERE, '.gitignore'), target)

print(f"""scaffold complete at {target}

Next steps:
  1. cd {target}
  2. npm ci                             (install locked playwright-core)
  3. npm run stub                       (estimated talk.js — lets you build scenes before audio exists)
  4. open preview.html in Chrome        (live scrubbing: play/scrub animation+audio, waveform timeline)
     npm run stills -- 1,3,5            (see the demo scenes in stills/sheet.jpg)
  5. Write your story: edit story/dialogue.txt / story/segments.json / story/srchips.js / story/style.js
     (never edit core/ or features/ — for reference see examples/legacy/jensen-legend/ in the aiyu-studio repository)
     Optional modules already loaded by index.html:
       - features/atmosphere.js — cinematic skies, water, hills, weather, grain/vignette
       - features/people.js — personTH() realistic humans with knees/elbows and a walk cycle
       - features/globe.js — dotGlobe()/globeArc()/globeMark() rotating Earth with real lat/lon
       - features/tree.js — treeDiagram()/treeLayout() tidy lineage/succession tree diagrams
       (for a full production using both, see examples/legacy/thai-origins/ in the aiyu-studio repository)
     Working with a coding agent? Point it at skills/ — condensed rules for
     scene writing (aiyu-authoring), the pipeline (aiyu-pipeline), and cinematic
     features (aiyu-cinematic). See skills/README.md.
  6. Drop real voice files into vo/ per segments.json names, then run npm run mix (real mode)
  7. Full render: npm run publish -- --chunks=6 --out=v1   (duration auto-reads talk.js)
  8. Mux:         npm run mux -- --concat=out/v1concat.txt --out=final-v1.mp4
  9. QC per docs/delivery/01-qc-publish.md in the aiyu-studio repository (docs are not copied into projects), then watch once on a real phone before publishing
""")
