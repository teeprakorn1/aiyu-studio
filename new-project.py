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

# engine: render/publish/mux/mix/measure scripts
for f in os.listdir(os.path.join(HERE, 'engine')):
    shutil.copy2(os.path.join(HERE, 'engine', f), target)

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
  2. npm install                        (install playwright-core)
  3. py mix_studio.py --stub            (estimated talk.js — lets you build scenes before audio exists)
  4. node render.mjs stills 1,3,5 --page=index.html   (see the demo scenes in stills/sheet.jpg)
  5. Write your story: edit dialogue.txt / segments.json / srchips.js / style.js
     (never edit rig.js — for extra props/scenes see examples/jensen-legend/style-v4.js in the main repo)
  6. Drop real voice files into vo/ per segments.json names, then run py mix_studio.py again (real mode)
  7. Full render: node publish-v4.mjs --duration=<TALK.dur+1> --chunks=6 --page=index.html --out=v1
  8. Mux:         node mux-v4.mjs --concat=out/v1concat.txt --out=final-v1.mp4
  9. QC per docs/qc-publish.md, then watch once on a real phone before publishing
""")
