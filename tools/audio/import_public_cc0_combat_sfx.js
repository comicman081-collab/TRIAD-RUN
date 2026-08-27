'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.resolve(process.argv[2] || path.join(PROJECT_ROOT, '.tmp_external_audio'));
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'assets', 'audio', 'sfx', 'combat', 'reference');
const PROVENANCE_ROOT = path.join(OUTPUT_ROOT, 'provenance');
const OUTPUT_RATE = 48000;
const OUTPUT_DEPTH = 24;

const packs = Object.freeze({
  firearm: Object.freeze({
    title: 'The Free Firearm Sound Library — Prepared SFX Library',
    author: 'Ben Jaszczak, Brian Nelson, Kevin Heras, and Matthew Nanney',
    pageUrl: 'https://opengameart.org/content/the-free-firearm-sound-library',
    downloadUrl: 'https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z',
    archive: 'Prepared SFX Library.7z',
    base: path.join('free_firearm_library', 'Prepared SFX Library'),
    licenseName: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceType: 'FIELD_RECORDING',
  }),
  impact: Object.freeze({
    title: 'Medieval sound effects — Weapon impacts (part 1 of 2)',
    author: 'Ben Jaszczak and Brian Nelson',
    pageUrl: 'https://opengameart.org/content/medieval-sound-effects-weapon-impacts',
    downloadUrl: 'https://opengameart.org/sites/default/files/medieval_sfx_weapon_on_weapon_1_of_2.7z',
    archive: 'medieval_sfx_weapon_on_weapon_1_of_2.7z',
    base: 'medieval_impacts_1',
    licenseName: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceType: 'FIELD_RECORDING',
  }),
  ruok: Object.freeze({
    title: 'Action Game/SHMUP SFX Pack',
    author: 'RUOK',
    pageUrl: 'https://opengameart.org/content/action-gameshmup-sfx-pack',
    downloadUrl: 'https://opengameart.org/sites/default/files/ruok_sfxpack.zip',
    archive: 'ruok_sfxpack.zip',
    base: path.join('ruok_sfxpack', 'SFXPack'),
    licenseName: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceType: 'DESIGNED_FROM_ORIGINAL_RECORDINGS_AND_SYNTHESIS',
  }),
});

const variant = (pack, file, start, duration, targetPeakDb = -1.5, fadeOutMs = 90) =>
  Object.freeze({ pack, file, start, duration, targetPeakDb, fadeOutMs });

const families = Object.freeze([
  Object.freeze({ assetId: 'SFX_WPN_PISTOL_FIRE_001', category: 'weapons', subtype: 'pistol', variants: Object.freeze([
    variant('firearm', path.join('1911', 'A_42P.wav'), 0.90, 1.45, -1.5, 120),
    variant('firearm', path.join('Walther PPQ', 'X_39P.wav'), 1.365, 1.45, -1.5, 120),
    variant('firearm', path.join('Smith & Wesson 642', 'V_27P.wav'), 0.765, 1.45, -1.5, 120),
  ]) }),
  Object.freeze({ assetId: 'SFX_WPN_RIFLE_FIRE_001', category: 'weapons', subtype: 'rifle', variants: Object.freeze([
    variant('firearm', path.join('AK-47', 'C_28P.wav'), 0.57, 1.75, -1.5, 140),
    variant('firearm', path.join('AR-15', 'D_32P.wav'), 0.66, 1.75, -1.5, 140),
    variant('firearm', path.join('SKS', 'U_14P.wav'), 3.535, 1.75, -1.5, 140),
  ]) }),
  Object.freeze({ assetId: 'SFX_WPN_BURST_RIFLE_FIRE_001', category: 'weapons', subtype: 'short-burst', variants: Object.freeze([
    variant('firearm', path.join('AK-47', 'C_29P.wav'), 1.025, 1.55, -1.8, 150),
    variant('firearm', path.join('Carl Gustav M45', 'G_33P.wav'), 0.25, 1.65, -1.8, 150),
    variant('firearm', path.join('PPSh', 'P_32P.wav'), 0.76, 1.45, -1.8, 150),
  ]) }),
  Object.freeze({ assetId: 'SFX_WPN_MACHINEGUN_FIRE_001', category: 'weapons', subtype: 'automatic-burst', variants: Object.freeze([
    variant('firearm', path.join('AK-47', 'C_27P.wav'), 0.225, 2.15, -2.0, 180),
    variant('firearm', path.join('Carl Gustav M45', 'G_35P.wav'), 0.21, 2.35, -2.0, 180),
    variant('firearm', path.join('PPSh', 'P_34P.wav'), 0.68, 2.20, -2.0, 180),
  ]) }),
  Object.freeze({ assetId: 'SFX_WPN_SHOTGUN_FIRE_001', category: 'weapons', subtype: 'shotgun', variants: Object.freeze([
    variant('firearm', path.join('CD', 'H_21P.wav'), 0.42, 1.80, -1.3, 160),
    variant('firearm', path.join('Model 12', 'K_22P.wav'), 0.80, 1.80, -1.3, 160),
    variant('firearm', path.join('Nova', 'O_21P.wav'), 0.39, 1.80, -1.3, 160),
  ]) }),
  Object.freeze({ assetId: 'SFX_WPN_HEAVY_CANNON_FIRE_001', category: 'weapons', subtype: 'heavy-rifle-cannon', variants: Object.freeze([
    variant('firearm', path.join('1917', 'B_24P.wav'), 1.265, 2.25, -1.2, 190),
    variant('firearm', path.join('Mosin Nagant', 'M_21P.wav'), 0.99, 2.10, -1.2, 190),
    variant('firearm', path.join('Tikka', 'W_29P.wav'), 0.535, 2.35, -1.2, 190),
  ]) }),
  Object.freeze({ assetId: 'SFX_PRJ_BULLET_FLYBY_001', category: 'projectile', subtype: 'ballistic-energy-travel', variants: Object.freeze([
    variant('ruok', path.join('Laser', 'LaserShot2.wav'), 0, 2.00, -3.0, 100),
    variant('ruok', path.join('Laser', 'LaserShot7.wav'), 0, 0.82, -3.0, 80),
    variant('ruok', path.join('Laser', 'LaserShot8.wav'), 0, 2.46, -3.0, 120),
  ]) }),
  Object.freeze({ assetId: 'SFX_IMPACT_METAL_001', category: 'impact', subtype: 'blade-on-metal', variants: Object.freeze([
    variant('impact', 'Axe Norse Sword Blade on Blade.wav', 2.075, 0.75, -1.8, 100),
    variant('impact', 'Axe Spear Blade on Blade.wav', 0.82, 0.75, -1.8, 100),
    variant('impact', 'Dagger Axe Blade on Blade.wav', 0.56, 0.75, -1.8, 100),
  ]) }),
  Object.freeze({ assetId: 'SFX_IMPACT_HEAVY_001', category: 'impact', subtype: 'mace-on-metal', variants: Object.freeze([
    variant('impact', 'Mace Axe Blade and Haft.wav', 1.555, 0.90, -1.5, 120),
    variant('impact', 'Mace Norse Sword Blade.wav', 0.57, 0.90, -1.5, 120),
    variant('impact', 'Mace Spear Blade.wav', 3.155, 0.90, -1.5, 120),
  ]) }),
  Object.freeze({ assetId: 'SFX_IMPACT_ARMOR_001', category: 'impact', subtype: 'weapon-on-armor', variants: Object.freeze([
    variant('impact', 'Axe Norse Sword Blade on Blade.wav', 4.03, 0.85, -1.7, 110),
    variant('impact', 'Axe Spear Blade on Blade.wav', 2.50, 0.85, -1.7, 110),
    variant('impact', 'Dagger Axe Blade on Blade.wav', 4.295, 0.85, -1.7, 110),
  ]) }),
  Object.freeze({ assetId: 'SFX_IMPACT_SHIELD_001', category: 'impact', subtype: 'weapon-on-shield', variants: Object.freeze([
    variant('impact', 'Axe Sabre Blade on Hilt.wav', 1.05, 0.90, -1.6, 120),
    variant('impact', 'Axe Sabre Haft on Blade.wav', 0.64, 0.90, -1.6, 120),
    variant('impact', 'Mace Spear Haft.wav', 2.97, 0.90, -1.6, 120),
  ]) }),
  Object.freeze({ assetId: 'SFX_EXP_MEDIUM_EXPLOSION_001', category: 'explosion', subtype: 'medium', variants: Object.freeze([
    variant('ruok', path.join('Explosions', 'Explosion1.wav'), 0, 2.00, -1.5, 220),
    variant('ruok', path.join('Explosions', 'Explosion2.wav'), 0, 2.20, -1.5, 240),
    variant('ruok', path.join('Explosions', 'Explosion4.wav'), 0, 2.20, -1.5, 240),
  ]) }),
  Object.freeze({ assetId: 'SFX_EXP_LARGE_EXPLOSION_001', category: 'explosion', subtype: 'large', variants: Object.freeze([
    variant('ruok', path.join('Explosions', 'Explosion3.wav'), 0.03, 3.20, -1.2, 320),
    variant('ruok', path.join('Explosions', 'Explosion2.wav'), 0, 3.60, -1.3, 340),
    variant('ruok', path.join('Explosions', 'Explosion4.wav'), 0, 3.60, -1.3, 340),
  ]) }),
  Object.freeze({ assetId: 'SFX_EXP_MECHANICAL_EXPLOSION_001', category: 'explosion', subtype: 'mechanical-destruction', variants: Object.freeze([
    variant('ruok', path.join('Bullets', 'BigShot1.wav'), 0, 1.80, -1.5, 180),
    variant('ruok', path.join('Bullets', 'BigShot2.wav'), 0, 1.80, -1.5, 180),
    variant('ruok', path.join('Bullets', 'BigShot4.wav'), 0, 1.55, -1.5, 160),
  ]) }),
]);

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

function readWav(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`Invalid WAV: ${file}`);
  let format = 0, channels = 0, sampleRate = 0, bitDepth = 0, dataOffset = 0, dataBytes = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      format = buffer.readUInt16LE(offset + 8);
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitDepth = buffer.readUInt16LE(offset + 22);
    }
    if (id === 'data') { dataOffset = offset + 8; dataBytes = Math.min(size, buffer.length - dataOffset); break; }
    offset += 8 + size + (size % 2);
  }
  if (!dataOffset || !channels || !sampleRate || !bitDepth) throw new Error(`Malformed WAV: ${file}`);
  const bytes = bitDepth / 8;
  const frames = Math.floor(dataBytes / (channels * bytes));
  const channelData = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const offset = dataOffset + (frame * channels + channel) * bytes;
      let value;
      if (format === 3 && bitDepth === 32) value = buffer.readFloatLE(offset);
      else if (format === 1 && bitDepth === 16) value = buffer.readInt16LE(offset) / 32768;
      else if (format === 1 && bitDepth === 24) value = buffer.readIntLE(offset, 3) / 8388608;
      else if (format === 1 && bitDepth === 32) value = buffer.readInt32LE(offset) / 2147483648;
      else throw new Error(`Unsupported WAV ${format}/${bitDepth}: ${file}`);
      channelData[channel][frame] = value;
    }
  }
  return { buffer, channels, sampleRate, bitDepth, frames, channelData };
}

function sinc(value) { return Math.abs(value) < 1e-9 ? 1 : Math.sin(Math.PI * value) / (Math.PI * value); }

function resampleSegment(source, startSeconds, durationSeconds) {
  const ratio = source.sampleRate / OUTPUT_RATE;
  const startFrame = Math.max(0, Math.round(startSeconds * source.sampleRate));
  const outputFrames = Math.max(1, Math.round(durationSeconds * OUTPUT_RATE));
  const radius = Math.max(16, Math.round(12 * ratio));
  const cutoff = 0.47 / ratio;
  const result = Array.from({ length: source.channels }, () => new Float32Array(outputFrames));
  for (let outputFrame = 0; outputFrame < outputFrames; outputFrame++) {
    const position = startFrame + outputFrame * ratio;
    const center = Math.floor(position);
    for (let channel = 0; channel < source.channels; channel++) {
      let sample = 0;
      let weightSum = 0;
      for (let tap = -radius; tap <= radius; tap++) {
        const index = center + tap;
        if (index < 0 || index >= source.frames) continue;
        const delta = index - position;
        const normalized = delta / (radius + 1);
        const window = 0.42 + 0.5 * Math.cos(Math.PI * normalized) + 0.08 * Math.cos(2 * Math.PI * normalized);
        const weight = 2 * cutoff * sinc(2 * cutoff * delta) * window;
        sample += source.channelData[channel][index] * weight;
        weightSum += weight;
      }
      result[channel][outputFrame] = weightSum ? sample / weightSum : 0;
    }
  }
  return result;
}

function finishAudio(channels, targetPeakDb, fadeOutMs) {
  const frames = channels[0].length;
  const fadeInFrames = Math.min(frames, Math.round(OUTPUT_RATE * 0.004));
  const fadeOutFrames = Math.min(frames, Math.round(OUTPUT_RATE * fadeOutMs / 1000));
  for (const channel of channels) {
    for (let i = 0; i < fadeInFrames; i++) channel[i] *= i / Math.max(1, fadeInFrames - 1);
    for (let i = 0; i < fadeOutFrames; i++) channel[frames - 1 - i] *= i / Math.max(1, fadeOutFrames - 1);
  }
  let peak = 0;
  for (const channel of channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  const target = Math.pow(10, targetPeakDb / 20);
  const gain = Math.min(6, target / Math.max(peak, 1e-9));
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] = Math.max(-0.999999, Math.min(0.999999, channel[i] * gain));
  return gain;
}

function writeWav24(channels) {
  const channelCount = channels.length;
  const frames = channels[0].length;
  const dataBytes = frames * channelCount * 3;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22); buffer.writeUInt32LE(OUTPUT_RATE, 24);
  buffer.writeUInt32LE(OUTPUT_RATE * channelCount * 3, 28); buffer.writeUInt16LE(channelCount * 3, 32); buffer.writeUInt16LE(OUTPUT_DEPTH, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const value = Math.max(-8388608, Math.min(8388607, Math.round(channels[channel][frame] * 8388607)));
      buffer.writeIntLE(value, offset, 3); offset += 3;
    }
  }
  return buffer;
}

function metrics(channels) {
  let peak = 0, energy = 0;
  for (const channel of channels) for (const sample of channel) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  return {
    duration: +(channels[0].length / OUTPUT_RATE).toFixed(4),
    peakDb: +(20 * Math.log10(Math.max(peak, 1e-9))).toFixed(3),
    rmsDb: +(20 * Math.log10(Math.sqrt(energy / (channels.length * channels[0].length)))).toFixed(3),
  };
}

fs.mkdirSync(PROVENANCE_ROOT, { recursive: true });
const archiveHashes = Object.fromEntries(Object.entries(packs).map(([key, pack]) => [key, sha256(fs.readFileSync(path.join(SOURCE_ROOT, pack.archive)))]));

for (const family of families) {
  const familyDir = path.join(OUTPUT_ROOT, family.assetId);
  fs.mkdirSync(familyDir, { recursive: true });
  const manifestVariants = [];
  const externalSources = [];
  for (let index = 0; index < family.variants.length; index++) {
    const spec = family.variants[index];
    const pack = packs[spec.pack];
    const sourceFile = path.join(SOURCE_ROOT, pack.base, spec.file);
    const source = readWav(sourceFile);
    const processed = resampleSegment(source, spec.start, spec.duration);
    const gain = finishAudio(processed, spec.targetPeakDb, spec.fadeOutMs);
    const outputBuffer = writeWav24(processed);
    const id = String.fromCharCode(65 + index);
    const filename = `${family.assetId}_${id}.wav`;
    const outputFile = path.join(familyDir, filename);
    fs.writeFileSync(outputFile, outputBuffer);
    const values = metrics(processed);
    const sourceRecord = {
      id,
      sourcePack: pack.title,
      sourceAuthor: pack.author,
      sourcePageUrl: pack.pageUrl,
      sourceDownloadUrl: pack.downloadUrl,
      sourceArchiveSha256: archiveHashes[spec.pack],
      sourceFile: spec.file.replaceAll('\\', '/'),
      sourceFileSha256: sha256(source.buffer),
      sourceSampleRate: source.sampleRate,
      sourceChannels: source.channels,
      sourceBitDepth: source.bitDepth,
      sourceStartSeconds: spec.start,
      requestedDurationSeconds: spec.duration,
      modifications: [`trim ${spec.start}s–${+(spec.start + spec.duration).toFixed(3)}s`, `band-limited resample ${source.sampleRate} Hz to ${OUTPUT_RATE} Hz`, `peak normalize to ${spec.targetPeakDb} dBFS`, `${spec.fadeOutMs} ms fade-out`, `encode ${OUTPUT_DEPTH}-bit PCM`],
    };
    externalSources.push(sourceRecord);
    manifestVariants.push({
      ...sourceRecord,
      outputFile: `${family.assetId}/${filename}`,
      outputSampleRate: OUTPUT_RATE,
      outputChannels: processed.length,
      outputBitDepth: OUTPUT_DEPTH,
      ...values,
      gain: +gain.toFixed(6),
      qaStatus: values.peakDb <= -1.0 && values.peakDb >= -3.2 && values.duration >= 0.7 ? 'PASS' : 'REVIEW',
      sha256: sha256(outputBuffer),
    });
  }
  const manifest = {
    schemaVersion: '2.0.0',
    assetId: family.assetId,
    category: family.category,
    subtype: family.subtype,
    sourceType: 'PUBLIC_CC0_DERIVATIVE',
    licenseName: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    commercialUseAllowed: true,
    redistributionAllowed: true,
    outputSampleRate: OUTPUT_RATE,
    outputBitDepth: OUTPUT_DEPTH,
    variants: manifestVariants,
    qaStatus: manifestVariants.every(item => item.qaStatus === 'PASS') ? 'PASS' : 'REVIEW',
  };
  const license = {
    sourceType: 'PUBLIC_CC0_DERIVATIVE',
    licenseName: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    commercialUseAllowed: true,
    redistributionAllowed: true,
    externalSources,
  };
  fs.writeFileSync(path.join(PROVENANCE_ROOT, `${family.assetId}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(PROVENANCE_ROOT, `${family.assetId}.license.json`), `${JSON.stringify(license, null, 2)}\n`);
  console.log(`${family.assetId}: ${manifest.qaStatus} (${manifestVariants.map(item => `${item.id}:${item.duration}s/${item.peakDb}dB`).join(', ')})`);
}
