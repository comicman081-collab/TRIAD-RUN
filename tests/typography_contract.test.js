'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const fontPath = path.join(root, 'assets', 'fonts', 'NotoSansKR-VF.ttf');
const licensePath = path.join(root, 'assets', 'fonts', 'NotoSansKR-OFL.txt');
const serverPath = path.join(root, 'tools', 'serve_local_runtime.js');
const html = fs.readFileSync(runtimePath, 'utf8');

test('canonical runtime self-hosts the complete Korean variable font', () => {
  assert.ok(fs.existsSync(fontPath), 'the runtime font asset must exist');
  assert.ok(fs.statSync(fontPath).size > 10_000_000, 'the full Korean glyph set must be bundled');
  assert.match(html, /rel="preload" href="assets\/fonts\/NotoSansKR-VF\.ttf\?v=2\.04"/);
  assert.match(html, /@font-face\s*\{[\s\S]*?font-family:"TRIAD Sans"[\s\S]*?font-weight:100 900[\s\S]*?font-display:swap/);
  assert.doesNotMatch(html, /src:local\(/, 'public rendering must use the bundled font instead of a machine-specific local font');
  assert.match(html, /--font-ui:"TRIAD Sans"/);
  assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/i, 'font loading must remain local');
});

test('the redistributed font carries its OFL license', () => {
  assert.ok(fs.existsSync(licensePath));
  const license = fs.readFileSync(licensePath, 'utf8');
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/i);
});

test('microcopy and tutorial instructions keep readable production sizes', () => {
  assert.match(html, /\.hand-jrpg \.card-desc\{font-size:12\.5px/);
  assert.match(html, /\.tutorial-lesson p,\.tutorial-ap-core span,\.tutorial-combat-copy span\{font-size:12\.5px/);
  assert.match(html, /\.tutorial-party-chip small,\.tutorial-card-chip small\{font-size:10\.5px/);
  assert.match(html, /\.tutorial-check\{font-size:11px/);
  assert.match(html, /\.wallet-label\{white-space:nowrap\}/);
});

test('keyboard focus and reduced-motion contracts remain visible and safe', () => {
  assert.match(html, /:where\(button,input,select,textarea,\[tabindex\]\):focus-visible/);
  assert.match(html, /outline:3px solid #a7efff/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html, /animation-duration:\.01ms!important/);
});

test('local runtime serves fonts correctly and mobile combat remains readable', () => {
  const server = fs.readFileSync(serverPath, 'utf8');
  assert.match(server, /'\.ttf': 'font\/ttf'/);
  assert.match(html, /\.hand-jrpg\{justify-content:safe center/);
  assert.match(html, /@media\(max-width:720px\)[\s\S]*?\.battle-info-grid\{position:static/);
  assert.match(html, /\.ally-side \.sd-card\{width:calc\(\(100% - 4px\)\/3\);flex-basis:calc\(\(100% - 4px\)\/3\)\}/);
  assert.match(html, /\.enemy-side \.sd-name,\.enemy-side \.sd-mini-bar\{display:none\}/);
  assert.match(html, /\.hand-jrpg\{justify-content:flex-start;padding-inline:12px/);
  assert.match(html, /\.profile-wallet\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(html, /@media\(max-width:520px\)\{\.profile-wallet\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /@media\(min-width:851px\)\{\.lobby-actions\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}\}/);
  assert.match(html, /@media\(min-width:851px\) and \(max-height:900px\)\{\.lobby-command\{padding-block:40px\}\}/);
});

test('production-facing lobby copy and volume semantics avoid internal QA language', () => {
  assert.match(html, /aria-label="전체 음량"/);
  assert.match(html, /TACTICAL DECK RPG · CHARACTER COMMAND/);
  assert.match(html, /현재 모집 가능한 신규 캐릭터를 모두 보유했습니다/);
  assert.doesNotMatch(html, /<span id="saveState"[^>]*>[^<]*IMAGE-FIRST/);
  assert.doesNotMatch(html, /summary\.textContent='[^']*(?:GPU|PASS_ACTIVE_FINAL|정본 로스터)/);
});
