'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('dedicated local launcher enables audible title autoplay without an in-page click', () => {
  const launcher = fs.readFileSync(path.join(root, 'TRIAD_RUN_AUTOPLAY.ps1'), 'utf8');
  const command = fs.readFileSync(path.join(root, 'TRIAD_RUN_자동음악_시작.cmd'), 'utf8');
  assert.match(launcher, /--autoplay-policy=no-user-gesture-required/);
  assert.match(launcher, /--app=\$triadUrl/);
  assert.match(launcher, /\.triad_runtime_profile/);
  assert.match(launcher, /TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY\.html/);
  assert.match(command, /TRIAD_RUN_AUTOPLAY\.ps1/);
});
