'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SFX = require('../src/triad_combat_sfx.js');

const root = path.resolve(__dirname, '..');

class FakeAudio {
  constructor(src = '') { this.src = src; this.paused = true; this.currentTime = 0; this.volume = 1; this.playbackRate = 1; }
  pause() { this.paused = true; }
  play() { this.paused = false; return Promise.resolve(); }
}

test('original 48 kHz stereo combat SFX pack is complete and valid', () => {
  const files = [...new Set(Object.values(SFX.CATALOG).flat())];
  assert.equal(files.length, 10);
  for (const name of files) {
    const file = path.join(root, 'sounds', 'triad_run_sfx', 'combat', name);
    const header = fs.readFileSync(file).subarray(0, 44);
    assert.equal(header.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(header.toString('ascii', 8, 12), 'WAVE', name);
    assert.equal(header.readUInt16LE(22), 2, `${name} channels`);
    assert.equal(header.readUInt32LE(24), 48000, `${name} sample rate`);
    assert.equal(header.readUInt16LE(34), 16, `${name} bit depth`);
    assert.ok(fs.statSync(file).size > 80000, `${name} is unexpectedly small`);
  }
});

test('card and enemy actions layer attack, impact, pain and block sounds', () => {
  const director = new SFX.CombatSfxDirector({
    AudioCtor: FakeAudio,
    storage: { getItem: () => '1' },
    setTimeout: fn => { fn(); return 1; },
  });
  director.playCard({ owner: 'EMBER', pattern: { key: 'strike' } }, { damage: 12, hits: 1 });
  director.playCard({ owner: 'VOLT', pattern: { key: 'volley' } }, { damage: 18, hits: 3 });
  director.playEnemy({ hits: 2, results: [{ blocked: 4 }, { blocked: 0 }] });
  const keys = director.debugState().log.map(event => event.key);
  assert.ok(keys.includes('playerSlash'));
  assert.ok(keys.includes('playerMagic'));
  assert.ok(keys.filter(key => key === 'enemyImpact').length >= 4);
  assert.ok(keys.includes('shieldBlock'));
  assert.ok(keys.includes('playerHit'));
});

test('fresh profiles start combat SFX at full volume and sync the visible slider', () => {
  const handlers = {};
  const volumeElement = { value: '100', addEventListener(type, handler) { handlers[type] = handler; } };
  const director = new SFX.CombatSfxDirector({
    AudioCtor: FakeAudio,
    storage: { getItem: () => null },
    document: { addEventListener() {} },
  }).initialize({ volumeElement });
  assert.equal(director.debugState().masterVolume, 1);
  handlers.input({ target: { value: '65' } });
  assert.equal(director.debugState().masterVolume, 0.65);
});

test('canonical runtime triggers SFX on resolved player and enemy damage', () => {
  const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');
  assert.match(html, /src\/triad_combat_sfx\.js\?v=1\.1\.1-volume-unlock-telemetry/);
  assert.match(html, /SFX\.playCard\(card,\{damage:damageDealt,hits\}\)/);
  assert.match(html, /SFX\.playEnemy\(\{hits:enemyResults\.length,results:enemyResults\}\)/);
  assert.match(html, /enemyVfxTarget=enemyResults\[0\]\?\.targetId/);
});
