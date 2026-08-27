'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const SFX = require('../src/triad_combat_sfx.js');

const root = path.resolve(__dirname, '..');
const audioRoot = path.join(root, ...SFX.ROOT.split('/').filter(Boolean));

class FakeAudio {
  static instances = [];
  constructor(src = '') {
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
    this.volume = 1;
    this.playbackRate = 1;
    this.loadCount = 0;
    this.playCount = 0;
    FakeAudio.instances.push(this);
  }
  load() { this.loadCount += 1; }
  pause() { this.paused = true; }
  play() { this.paused = false; this.playCount += 1; return Promise.resolve(); }
}

function scheduler() {
  const tasks = [];
  return {
    tasks,
    setTimeout(fn, delay) { tasks.push({ fn, delay }); return tasks.length; },
    flush() { tasks.splice(0).sort((a, b) => a.delay - b.delay).forEach(task => task.fn()); },
  };
}

function director(options = {}) {
  return new SFX.CombatSfxDirector({
    AudioCtor: FakeAudio,
    storage: { getItem: () => '1' },
    ...options,
  });
}

function inspectWav(file) {
  const buffer = fs.readFileSync(file);
  let channels = 0, sampleRate = 0, bitDepth = 0, dataOffset = 0, dataBytes = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      assert.equal(buffer.readUInt16LE(offset + 8), 1, `${path.basename(file)} PCM format`);
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitDepth = buffer.readUInt16LE(offset + 22);
    }
    if (id === 'data') { dataOffset = offset + 8; dataBytes = size; break; }
    offset += 8 + size + (size % 2);
  }
  assert.ok(dataOffset > 0 && channels > 0 && sampleRate > 0 && bitDepth > 0, `${path.basename(file)} valid WAV chunks`);
  const bytesPerSample = bitDepth / 8;
  const frames = dataBytes / (channels * bytesPerSample);
  const maximum = bitDepth === 24 ? 8388608 : 32768;
  let peak = 0, energy = 0;
  let sumL = 0, sumR = 0, squareL = 0, squareR = 0, product = 0;
  let lowPass = 0, lowEnergy = 0, monoEnergy = 0;
  const lowPassCoefficient = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
  for (let frame = 0; frame < frames; frame += 1) {
    const offset = dataOffset + frame * channels * bytesPerSample;
    const left = buffer.readIntLE(offset, bytesPerSample) / maximum;
    const right = channels > 1 ? buffer.readIntLE(offset + bytesPerSample, bytesPerSample) / maximum : left;
    const mono = (left + right) * 0.5;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    energy += left * left + (channels > 1 ? right * right : 0);
    sumL += left; sumR += right;
    squareL += left * left; squareR += right * right; product += left * right;
    lowPass += (mono - lowPass) * lowPassCoefficient;
    lowEnergy += lowPass * lowPass;
    monoEnergy += mono * mono;
  }
  const covariance = product - sumL * sumR / frames;
  const varianceL = squareL - sumL * sumL / frames;
  const varianceR = squareR - sumR * sumR / frames;
  return {
    buffer,
    channels,
    sampleRate,
    bitDepth,
    duration: frames / sampleRate,
    peakDb: 20 * Math.log10(Math.max(peak, 1e-9)),
    rmsDb: 20 * Math.log10(Math.sqrt(energy / Math.max(1, frames * channels))),
    correlation: covariance / Math.sqrt(Math.max(1e-12, varianceL * varianceR)),
    lowRatio: lowEnergy / Math.max(1e-12, monoEnergy),
    hash: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

test('cinematic catalog has distinct multi-variant families', () => {
  const minimums = {
    weaponWhoosh: 3, magicCast: 3, impactLight: 4, impactHeavy: 3,
    playerHitLight: 3, playerHitHeavy: 2, shieldRise: 2, shieldBlock: 3,
    ultimateCharge: 2, ultimateImpact: 2, healWave: 2, utilityPulse: 2, rewardClaim: 2,
    pistolFire: 3, rifleFire: 3, burstRifleFire: 3, machineGunFire: 3, shotgunFire: 3, heavyCannonFire: 3,
    bulletFlyby: 3, impactMetalRef: 3, impactHeavyRef: 3, impactArmorRef: 3, impactShieldRef: 3,
    explosionMedium: 3, explosionLarge: 3, explosionMechanical: 3,
  };
  assert.deepEqual(Object.keys(SFX.CATALOG).sort(), Object.keys(minimums).sort());
  for (const [key, minimum] of Object.entries(minimums)) assert.ok(SFX.CATALOG[key].length >= minimum, `${key} variants`);
  assert.equal(new Set(Object.values(SFX.CATALOG).flat()).size, 75);
  assert.equal(SFX.ROOT, 'assets/audio/sfx/combat/');
  assert.equal(SFX.CACHE_VERSION, '1.4.0-public-cc0-cinematic');
  assert.equal(SFX.REFERENCE_KEYS.length, 14);
});

test('generated pack is deterministic-quality 48 kHz 24-bit stereo with real width', () => {
  const reference = new Set(SFX.REFERENCE_KEYS);
  const files = [...new Set(Object.entries(SFX.CATALOG).filter(([key]) => !reference.has(key)).flatMap(([, names]) => names))];
  const hashes = new Set();
  for (const name of files) {
    const file = path.join(audioRoot, name);
    const header = fs.readFileSync(file).subarray(0, 44);
    assert.equal(header.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(header.toString('ascii', 8, 12), 'WAVE', name);
    const metrics = inspectWav(file);
    assert.equal(metrics.channels, 2, `${name} channels`);
    assert.equal(metrics.sampleRate, 48000, `${name} sample rate`);
    assert.equal(metrics.bitDepth, 24, `${name} bit depth`);
    assert.ok(metrics.duration >= 0.38 && metrics.duration <= 1.60, `${name} duration ${metrics.duration}`);
    assert.ok(metrics.peakDb > -6.5 && metrics.peakDb <= -0.7, `${name} peak ${metrics.peakDb}`);
    assert.ok(metrics.rmsDb > -19 && metrics.rmsDb < -12, `${name} rms ${metrics.rmsDb}`);
    assert.ok(Math.abs(metrics.correlation) < 0.98, `${name} stereo correlation ${metrics.correlation}`);
    assert.ok(fs.statSync(file).size > 100000, `${name} is unexpectedly small`);
    hashes.add(metrics.hash);
  }
  assert.equal(hashes.size, files.length, 'every catalog variant must have unique PCM');
});

test('public CC0 firearm, metal and explosion derivatives retain verified 48 kHz 24-bit PCM and provenance', () => {
  const files = SFX.REFERENCE_KEYS.flatMap(key => SFX.CATALOG[key]);
  assert.equal(files.length, 42);
  const hashes = new Set();
  for (const name of files) {
    const metrics = inspectWav(path.join(audioRoot, name));
    assert.ok([1, 2].includes(metrics.channels), `${name} channels`);
    assert.equal(metrics.sampleRate, 48000, `${name} sample rate`);
    assert.equal(metrics.bitDepth, 24, `${name} bit depth`);
    assert.ok(metrics.duration >= 0.70 && metrics.duration <= 3.65, `${name} duration ${metrics.duration}`);
    assert.ok(metrics.peakDb >= -3.1 && metrics.peakDb <= -1.0, `${name} peak ${metrics.peakDb}`);
    assert.ok(metrics.rmsDb > -36 && metrics.rmsDb < -7, `${name} rms ${metrics.rmsDb}`);
    const [, assetId, filename] = name.split('/');
    const manifest = JSON.parse(fs.readFileSync(path.join(audioRoot, 'reference', 'provenance', `${assetId}.manifest.json`), 'utf8'));
    const license = JSON.parse(fs.readFileSync(path.join(audioRoot, 'reference', 'provenance', `${assetId}.license.json`), 'utf8'));
    const variant = filename.match(/_([ABC])\.wav$/)?.[1];
    const manifestVariant = manifest.variants.find(entry => entry.id === variant);
    const sourceRecord = license.externalSources.find(entry => entry.id === variant);
    assert.equal(manifestVariant?.sha256, metrics.hash, `${name} output hash`);
    assert.equal(manifestVariant?.outputSampleRate, 48000, `${name} manifest sample rate`);
    assert.equal(manifestVariant?.outputBitDepth, 24, `${name} manifest bit depth`);
    assert.match(manifestVariant?.sourceFile || '', /\.(wav)$/i, `${name} source file`);
    assert.match(manifestVariant?.sourcePageUrl || '', /^https:\/\/opengameart\.org\/content\//, `${name} source page`);
    assert.equal(sourceRecord?.sourceArchiveSha256, manifestVariant?.sourceArchiveSha256, `${name} archive hash`);
    assert.equal(manifest.qaStatus, 'PASS');
    assert.equal(manifest.sourceType, 'PUBLIC_CC0_DERIVATIVE');
    assert.equal(manifest.licenseName, 'CC0-1.0');
    assert.equal(license.licenseName, 'CC0-1.0');
    assert.equal(license.externalSources.length, 3);
    assert.equal(license.attributionRequired, false);
    assert.equal(license.commercialUseAllowed, true);
    assert.equal(license.redistributionAllowed, true);
    hashes.add(metrics.hash);
  }
  assert.equal(hashes.size, files.length, 'every reference variant must be unique');
});

test('heavy, ultimate and shield impacts retain cinematic low-frequency body', () => {
  for (const key of ['impactHeavy', 'ultimateImpact']) {
    for (const name of SFX.CATALOG[key]) {
      const metrics = inspectWav(path.join(audioRoot, name));
      assert.ok(metrics.lowRatio > 0.45, `${name} low ratio ${metrics.lowRatio}`);
      assert.ok(metrics.peakDb > -2.2, `${name} impact peak ${metrics.peakDb}`);
    }
  }
  for (const name of SFX.CATALOG.shieldBlock) {
    const metrics = inspectWav(path.join(audioRoot, name));
    assert.ok(metrics.lowRatio > 0.30, `${name} low ratio ${metrics.lowRatio}`);
  }
});

test('variant cursor alternates source files before reusing a variant', () => {
  const instance = director();
  for (let index = 0; index < 5; index += 1) instance.play('impactLight');
  assert.deepEqual(instance.debugState().log.map(event => event.file), [
    'impact_light_01.wav', 'impact_light_02.wav', 'impact_light_03.wav', 'impact_light_04.wav', 'impact_light_01.wav',
  ]);
  assert.deepEqual(instance.debugState().log.map(event => event.voice), [0, 0, 0, 0, 1]);
});

test('card damage type, support, heal and utility actions use separate families', () => {
  assert.equal(SFX.resolveDamageType({ owner: 'EMBER', pattern: { key: 'strike' } }, { damageType: 'magic' }), 'magic');
  assert.equal(SFX.resolveDamageType({ owner: 'VOLT', pattern: { key: 'volley' } }), 'physical');
  assert.equal(SFX.resolveDamageType({ owner: 'EMBER', pattern: { key: 'signature' } }), 'magic');
  assert.equal(SFX.resolveDamageType({ owner: 'AEGIS', pattern: { key: 'signature' } }), 'physical');

  const instance = director({ setTimeout: () => 1 });
  instance.playCard({ owner: 'EMBER', pattern: { key: 'strike' } }, { damage: 12, hits: 1, damageType: 'magic' });
  instance.playCard({ owner: 'AEGIS', pattern: { key: 'guard' } }, { damage: 0, hits: 1, damageType: 'utility' });
  instance.playCard({ owner: 'BLOOM', pattern: { key: 'heal' } }, { damage: 0, hits: 1, damageType: 'utility' });
  instance.playCard({ owner: 'RIFT', pattern: { key: 'battery' } }, { damage: 0, hits: 1, damageType: 'utility' });
  const keys = instance.debugState().log.map(event => event.key);
  assert.ok(keys.includes('magicCast'));
  assert.ok(keys.includes('impactLight'));
  assert.ok(keys.includes('shieldRise'));
  assert.ok(keys.includes('healWave'));
  assert.ok(keys.includes('utilityPulse'));
  assert.ok(!keys.includes('shieldBlock'), 'raising a shield is not a block impact');
});

test('multi-hit cards preserve authored pa-pa-pak and ta-ta-tak timing', () => {
  assert.deepEqual(SFX.hitOffsets('burst', 6), [0, 62, 126, 205, 290, 392]);
  assert.deepEqual(SFX.hitOffsets('volley', 3), [0, 96, 214]);
  const clock = scheduler();
  const instance = director({ setTimeout: clock.setTimeout });
  instance.playCard({ owner: 'VOLT', pattern: { key: 'volley' } }, { damage: 18, hits: 3, damageType: 'physical', impactDelay: 500 });
  const impacts = instance.debugState().log.filter(event => event.key === 'impactLight');
  assert.deepEqual(impacts.map(event => event.delay), [500, 596, 714]);
  assert.deepEqual(impacts.map(event => event.status), ['scheduled', 'scheduled', 'scheduled']);
  assert.deepEqual(impacts.map(event => event.rate), [0.97, 1.025, 0.985]);
  assert.ok(instance.debugState().log.some(event => event.key === 'burstRifleFire' && event.delay === 0));
  assert.equal(instance.debugState().log.filter(event => event.key === 'burstRifleFire').length, 1, 'recorded burst already contains its authored shots');
  assert.ok(instance.debugState().log.some(event => event.key === 'bulletFlyby' && event.delay === 0));
  assert.ok(instance.debugState().log.some(event => event.key === 'impactMetalRef' && event.delay === 500));
});

test('signature separates charge from delayed cinematic impact', () => {
  const clock = scheduler();
  const instance = director({ setTimeout: clock.setTimeout });
  instance.playCard({ owner: 'RIFT', pattern: { key: 'signature' } }, { damage: 42, hits: 1, damageType: 'magic', impactDelay: 440 });
  const log = instance.debugState().log;
  assert.equal(log.find(event => event.key === 'ultimateCharge').delay, 0);
  assert.equal(log.find(event => event.key === 'ultimateImpact').delay, 440);
  assert.equal(log.find(event => event.key === 'ultimateImpact').status, 'scheduled');
  assert.equal(log.find(event => event.key === 'explosionLarge').delay, 440);
});

test('physical card families choose authored firearm launch layers before impact', () => {
  assert.equal(SFX.cardFirearmKey('quick'), 'pistolFire');
  assert.equal(SFX.cardFirearmKey('ambush'), 'pistolFire');
  assert.equal(SFX.cardFirearmKey('strike'), 'rifleFire');
  assert.equal(SFX.cardFirearmKey('combo'), 'rifleFire');
  assert.equal(SFX.cardFirearmKey('burst'), 'machineGunFire');
  assert.equal(SFX.cardFirearmKey('volley'), 'burstRifleFire');
  assert.equal(SFX.cardFirearmKey('heavy'), 'shotgunFire');
  assert.equal(SFX.cardFirearmKey('execute'), 'heavyCannonFire');
});

test('enemy archetype and skill select heavy, magic, flurry and block layers', () => {
  assert.equal(SFX.resolveEnemyStyle({ enemy: { archetypeKey: 'BRUTE' }, skillId: 'EMBER_BRUTE_CRUSH' }).heavy, true);
  assert.equal(SFX.resolveEnemyStyle({ enemy: { archetypeKey: 'CASTER' }, skillId: 'VOLT_CASTER_BOLT' }).magic, true);
  assert.equal(SFX.resolveEnemyStyle({ enemy: { archetypeKey: 'SCOUT' }, skillId: 'SHADE_SCOUT_FLURRY' }).flurry, true);

  const clock = scheduler();
  const instance = director({ setTimeout: clock.setTimeout });
  instance.playEnemy({ enemy: { archetypeKey: 'BRUTE', rank: 'normal' }, skillId: 'EMBER_BRUTE_CRUSH', hits: 1, results: [{ blocked: 0 }], impactDelay: 360 });
  instance.playEnemy({ enemy: { archetypeKey: 'CASTER', rank: 'normal' }, skillId: 'VOLT_CASTER_BOLT', hits: 1, results: [{ blocked: 0 }], impactDelay: 520 });
  instance.playEnemy({ enemy: { archetypeKey: 'SCOUT', rank: 'normal' }, skillId: 'SHADE_SCOUT_FLURRY', hits: 2, results: [{ blocked: 7 }, { blocked: 0 }], impactDelay: 400 });
  const keys = instance.debugState().log.map(event => event.key);
  assert.ok(keys.includes('weaponWhoosh'));
  assert.ok(keys.includes('magicCast'));
  assert.ok(keys.includes('playerHitHeavy'));
  assert.ok(keys.includes('playerHitLight'));
  assert.ok(keys.includes('shieldBlock'));
  assert.ok(keys.includes('impactHeavyRef'));
  assert.ok(keys.includes('impactArmorRef'));
  assert.ok(keys.includes('impactShieldRef'));
  assert.ok(keys.includes('explosionMedium'));
  const scoutImpacts = instance.debugState().log.filter(event => ['shieldBlock', 'playerHitLight'].includes(event.key)).slice(-2);
  assert.deepEqual(scoutImpacts.map(event => event.delay), [400, 492]);
});

test('fresh profiles start combat SFX at full volume and sync the visible slider', () => {
  const handlers = {};
  const volumeElement = { value: '100', addEventListener(type, handler) { handlers[type] = handler; } };
  const instance = new SFX.CombatSfxDirector({
    AudioCtor: FakeAudio,
    storage: { getItem: () => null },
    document: { addEventListener() {} },
  }).initialize({ volumeElement });
  assert.equal(instance.debugState().masterVolume, 1);
  handlers.input({ target: { value: '65' } });
  assert.equal(instance.debugState().masterVolume, 0.65);
});

test('canonical runtime still loads and invokes the combat SFX director', () => {
  const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');
  assert.match(html, /src\/triad_combat_sfx\.js/);
  assert.match(html, /SFX\.playCard\(card,/);
  assert.match(html, /defeated\}\);/);
  assert.match(html, /SFX\.playEnemy\(\{/);
  assert.match(html, /triad_combat_sfx\.js\?v=1\.4\.0-public-cc0-cinematic/);
});
