/**
 * @file skills.test.mjs — structural validation for the Agent Skills pack scaffolded into every project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { declaration } from '../helpers/source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..');
const SKILLS = path.join(ROOT, 'template', 'skills');
const readNorm = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const skillDirs = readdirSync(SKILLS)
  .filter(d => statSync(path.join(SKILLS, d)).isDirectory());

test('skills pack contains the three documented skills', () => {
  assert.deepEqual([...skillDirs].sort(), ['aiyu-authoring', 'aiyu-cinematic', 'aiyu-pipeline']);
});

for (const dir of skillDirs) {
  test(`skill ${dir}: valid frontmatter and structure`, () => {
    const file = path.join(SKILLS, dir, 'SKILL.md');
    assert.ok(existsSync(file), `${dir}/SKILL.md must exist`);
    const src = readNorm(file);
    const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(fm, `${dir} SKILL.md must start with YAML frontmatter`);
    const name = fm[1].match(/^name:\s*(\S+)\s*$/m);
    const desc = fm[1].match(/^description:\s*(.+)$/m);
    assert.equal(name && name[1], dir, 'frontmatter name must match the directory name');
    assert.ok(desc && desc[1].trim().length >= 40, 'description must be a real sentence, not a token');
    assert.match(src, /^# /m, 'must have a top-level heading');
    assert.ok(src.length > 2000, `${dir} skill looks suspiciously thin (${src.length} chars)`);
    // no broken relative links to sibling files inside the skills tree
    for (const m of src.matchAll(/\]\(([^)#\s]+)\)/g)) {
      const url = m[1];
      if (/^https?:/.test(url) || url.startsWith('#')) continue;
      assert.ok(existsSync(path.resolve(SKILLS, dir, url)), `${dir} links to missing file ${url}`);
    }
  });
}

test('skills teach the non-negotiable invariants', () => {
  const authoring = readNorm(path.join(SKILLS, 'aiyu-authoring', 'SKILL.md'));
  const pipeline = readNorm(path.join(SKILLS, 'aiyu-pipeline', 'SKILL.md'));
  // the failure modes these skills exist to prevent must be explicitly covered
  assert.match(authoring, /Math\.random\(\)/, 'authoring must forbid Math.random');
  assert.match(authoring, /talk\.js/, 'authoring must teach the talk.js timing law');
  assert.match(authoring, /defineScenes/, 'authoring must teach the registry API');
  assert.match(authoring, /mouthFor/, 'authoring must teach the lip-sync contract');
  assert.match(pipeline, /npm run mix/, 'pipeline must teach npm scripts, not raw engine invocations');
  assert.match(pipeline, /never hand-edit talk\.js/i, 'pipeline must forbid hand-editing talk.js');
});

test('skills README explains discovery and usage', () => {
  const src = readNorm(path.join(SKILLS, 'README.md'));
  for (const dir of skillDirs) assert.ok(src.includes(dir), `README must list ${dir}`);
});

const mdIn = dir => readdirSync(dir).filter(f => f.endsWith('.md')).map(f => path.join(dir, f));
const TEACHING = [
  path.join(SKILLS, 'README.md'), ...skillDirs.map(d => path.join(SKILLS, d, 'SKILL.md')),
  path.join(ROOT, 'template', 'README.md'),
  ...['authoring', 'getting-started', 'delivery'].flatMap(d => mdIn(path.join(ROOT, 'docs', d))),
];
const RETIRED = [
  [/translucent layers/i, 'depth comes from opaque color-mixed layers, not translucent layers'],
  [/--range=/, 'render takes a positional range: npm run render -- video from,to'],
  [/mux -- --verify-tp(?!=)/, 'mux --verify-tp needs a value: --verify-tp=<db>'],
  [/\bTXT\([^)]*maxW/, 'TXT takes weight as its last argument; use fitTXT for maxW'],
  [/\bpop\([^)]*maxW/, 'pop takes size as its last argument'],
  [/grain → scrim → vig/, 'frame treatments: captionScrim inside the scene, then screenVig and grainLayer last'],
  [/v0\.5\.0/, 'these features shipped in 0.4.0'],
];

test('skills and authoring docs never teach retired or wrong forms', () => {
  const hits = [];
  for (const file of TEACHING) {
    const src = readFileSync(file, 'utf8');
    for (const [re, why] of RETIRED) if (re.test(src)) hits.push(`${path.relative(ROOT, file)}: ${why}`);
  }
  assert.deepEqual(hits, []);
});

const API = [
  ['template/core/base.js', ['TXT', 'fitTXT', 'srnd', 'RRECT', 'CIRC', 'LINE', 'LIMB', 'PATH', 'SHAPE']],
  ['template/features/cards.js', ['pop', 'chip', 'quoteCard', 'chartCard']],
  ['template/features/environment.js', ['rain', 'wall', 'floorY', 'city', 'stars', 'glow', 'win', 'lamp', 'rim', 'circuitField', 'tint', 'vig']],
];
const callsOf = (src, name) => [...src.matchAll(new RegExp(`(?<![\\w$])${name}\\(([^()]*)\\)`, 'g'))].map(m => m[1]);

test('documented call signatures use the runtime parameter names, in order', () => {
  const problems = [];
  for (const [file, names] of API) {
    const code = readFileSync(path.join(ROOT, file), 'utf8');
    for (const name of names) {
      const decl = declaration(code, name);
      if (!decl) { problems.push(`${file}: ${name} is not declared`); continue; }
      for (const doc of TEACHING) {
        for (const args of callsOf(readFileSync(doc, 'utf8'), name)) {
          const parts = args.trim() === '' ? [] : args.split(',').map(a => a.trim().replace(/\?$/, ''));
          if (!parts.every(p => /^[A-Za-z_$][\w$]*$/.test(p))) continue;
          const ok = parts.length <= decl.params.length && parts.every((p, i) => p === decl.params[i]);
          if (!ok) problems.push(`${path.relative(ROOT, doc)}: ${name}(${args}) — runtime is ${name}(${decl.params.join(', ')})`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});
