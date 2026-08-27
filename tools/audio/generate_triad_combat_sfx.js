'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BIT_DEPTH = 24;
const BYTES_PER_SAMPLE = BIT_DEPTH / 8;
const TAU = Math.PI * 2;
const OUTPUT = path.resolve(__dirname, '..', '..', 'assets', 'audio', 'sfx', 'combat');

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };
}

function dbToGain(db) { return 10 ** (db / 20); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function pulse(t, onset = 0, attack = 0.002, decay = 12) {
  const local = t - onset;
  if (local < 0) return 0;
  return Math.min(1, local / Math.max(0.0001, attack)) * Math.exp(-local * decay);
}

// Integrating the phase keeps a linear pitch sweep linear. The common
// sin(2*pi*f(t)*t) shortcut doubles the sweep slope and sounds arcade-like.
function chirp(t, onset, startHz, endHz, duration, phase = 0) {
  const local = t - onset;
  if (local < 0 || local > duration) return 0;
  const slope = (endHz - startHz) / Math.max(0.0001, duration);
  return Math.sin(TAU * (startHz * local + 0.5 * slope * local * local) + phase);
}

function tone(t, onset, hz, decay, phase = 0, attack = 0.001) {
  const local = t - onset;
  if (local < 0) return 0;
  return Math.sin(TAU * hz * local + phase) * pulse(t, onset, attack, decay);
}

function resonators(t, onset, frequencies, decay, phaseOffset = 0) {
  return frequencies.reduce((sum, hz, index) => (
    sum + tone(t, onset, hz, decay + index * 0.9, phaseOffset + index * 0.71) / (1 + index * 0.34)
  ), 0);
}

function noiseBands(state) {
  const rawL = state.random();
  const rawR = state.random();
  state.slowL += (rawL - state.slowL) * 0.022;
  state.slowR += (rawR - state.slowR) * 0.022;
  state.fastL += (rawL - state.fastL) * 0.42;
  state.fastR += (rawR - state.fastR) * 0.42;
  return {
    lowL: state.slowL,
    lowR: state.slowR,
    midL: state.fastL - state.slowL,
    midR: state.fastR - state.slowR,
    highL: rawL - state.fastL,
    highR: rawR - state.fastR,
  };
}

function impactLayer(t, noise, options = {}) {
  const onset = Number(options.onset) || 0;
  if (t < onset) return [0, 0];
  const weight = Number(options.weight) || 1;
  const subStart = Number(options.subStart) || 72;
  const subEnd = Number(options.subEnd) || 38;
  const bodyStart = Number(options.bodyStart) || 184;
  const bodyEnd = Number(options.bodyEnd) || 82;
  const metal = options.metal || [430, 690, 1060, 1710];
  const sub = chirp(t, onset, subStart, subEnd, 0.34, options.phase || 0) * pulse(t, onset, 0.0015, options.subDecay || 7.2);
  const boom = chirp(t, onset, bodyStart, bodyEnd, 0.24, 0.35 + (options.phase || 0)) * pulse(t, onset, 0.001, options.bodyDecay || 11);
  const lowNoiseL = Math.tanh(noise.lowL * 4.6) * pulse(t, onset, 0.001, options.debrisDecay || 8.2);
  const lowNoiseR = Math.tanh(noise.lowR * 4.6) * pulse(t, onset, 0.001, options.debrisDecay || 8.2);
  const ringL = resonators(t, onset, metal, options.metalDecay || 8.1, options.phase || 0);
  const ringR = resonators(t, onset, metal.map((hz, index) => hz * (1.007 + index * 0.003)), options.metalDecay || 8.1, 0.43 + (options.phase || 0));
  const crackEnv = pulse(t, onset, 0.00035, options.crackDecay || 58);
  const debrisEnv = pulse(t, onset + 0.012, 0.002, options.debrisDecay || 8.2);
  const common = sub * 0.68 + boom * 0.43;
  const left = common + lowNoiseL * 0.34 + ringL * 0.22 + noise.highL * crackEnv * 0.82 + noise.midL * debrisEnv * 0.26;
  const right = common + lowNoiseR * 0.34 + ringR * 0.22 + noise.highR * crackEnv * 0.82 + noise.midR * debrisEnv * 0.26;
  return [left * weight, right * weight];
}

function addPair(a, b) { return [a[0] + b[0], a[1] + b[1]]; }

function highPassInPlace(samples, cutoff = 18) {
  const coefficient = Math.exp(-TAU * cutoff / SAMPLE_RATE);
  let previousInput = 0, previousOutput = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const input = samples[index];
    const output = coefficient * (previousOutput + input - previousInput);
    samples[index] = output;
    previousInput = input;
    previousOutput = output;
  }
}

function addRoom(left, right, wet = 0.12) {
  const dryLeft = left.slice();
  const dryRight = right.slice();
  const taps = [[0.029, 0.14], [0.047, 0.10], [0.073, 0.075], [0.109, 0.045]];
  for (const [seconds, gain] of taps) {
    const delay = Math.round(seconds * SAMPLE_RATE);
    for (let index = delay; index < left.length; index += 1) {
      left[index] += dryRight[index - delay] * gain * wet;
      right[index] += dryLeft[index - delay] * gain * wet * 0.94;
    }
  }
}

function master(left, right, options) {
  highPassInPlace(left);
  highPassInPlace(right);
  addRoom(left, right, options.room ?? 0.12);

  const threshold = dbToGain(-10);
  const ratio = 4;
  const drive = options.drive ?? 1.45;
  const driveNorm = Math.tanh(drive);
  let envelopeFollower = 0;
  let compressorGain = 1;
  for (let index = 0; index < left.length; index += 1) {
    const level = Math.max(Math.abs(left[index]), Math.abs(right[index]));
    const smoothing = level > envelopeFollower ? 0.19 : 0.0018;
    envelopeFollower += (level - envelopeFollower) * smoothing;
    let desired = 1;
    if (envelopeFollower > threshold) {
      const compressed = threshold * ((envelopeFollower / threshold) ** (1 / ratio));
      desired = compressed / envelopeFollower;
    }
    compressorGain += (desired - compressorGain) * (desired < compressorGain ? 0.16 : 0.0025);
    left[index] = Math.tanh(left[index] * compressorGain * drive) / driveNorm;
    right[index] = Math.tanh(right[index] * compressorGain * drive) / driveNorm;
  }

  const fadeFrames = Math.min(left.length, Math.round(SAMPLE_RATE * 0.035));
  for (let offset = 0; offset < fadeFrames; offset += 1) {
    const gain = (fadeFrames - offset) / fadeFrames;
    const index = left.length - fadeFrames + offset;
    left[index] *= gain;
    right[index] *= gain;
  }

  let sum = 0, peak = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] ** 2 + right[index] ** 2;
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  const rms = Math.sqrt(sum / Math.max(1, left.length * CHANNELS));
  const targetRms = dbToGain(options.targetRmsDb ?? -16);
  const targetPeak = dbToGain(options.targetPeakDb ?? -1);
  const gain = Math.min(targetRms / Math.max(rms, 1e-9), targetPeak / Math.max(peak, 1e-9));
  for (let index = 0; index < left.length; index += 1) {
    left[index] *= gain;
    right[index] *= gain;
  }
}

function wav24(left, right, seed) {
  const frames = left.length;
  const pcm = Buffer.alloc(frames * CHANNELS * BYTES_PER_SAMPLE);
  const dither = rng(seed ^ 0x9e3779b9);
  const maximum = 8388607;
  for (let index = 0; index < frames; index += 1) {
    const offset = index * CHANNELS * BYTES_PER_SAMPLE;
    const leftDither = (dither() + dither()) * 0.5 / maximum;
    const rightDither = (dither() + dither()) * 0.5 / maximum;
    pcm.writeIntLE(Math.round(clamp(left[index] + leftDither, -1, 1) * maximum), offset, BYTES_PER_SAMPLE);
    pcm.writeIntLE(Math.round(clamp(right[index] + rightDither, -1, 1) * maximum), offset + BYTES_PER_SAMPLE, BYTES_PER_SAMPLE);
  }

  const header = Buffer.alloc(44);
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;
  const byteRate = SAMPLE_RATE * blockAlign;
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22); header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28); header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BIT_DEPTH, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function render(spec) {
  const frames = Math.ceil(spec.duration * SAMPLE_RATE);
  const left = new Float64Array(frames);
  const right = new Float64Array(frames);
  const state = { random: rng(spec.seed), slowL: 0, slowR: 0, fastL: 0, fastR: 0 };
  for (let index = 0; index < frames; index += 1) {
    const pair = spec.synth(index / SAMPLE_RATE, spec.duration, state);
    left[index] = pair[0];
    right[index] = pair[1];
  }
  master(left, right, spec);
  return wav24(left, right, spec.seed);
}

function weaponWhoosh(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const speed = 0.28 + variant * 0.018;
    const airEnvelope = pulse(t, 0.008, 0.018, 7.2 + variant * 0.4);
    const edge = chirp(t, 0.015, 1680 + variant * 90, 230 + variant * 24, speed, variant * 0.37) * pulse(t, 0.015, 0.008, 8.8);
    const body = chirp(t, 0.06, 214 - variant * 9, 74 + variant * 4, 0.32, 0.4) * pulse(t, 0.06, 0.01, 10.5);
    return [
      noise.highL * airEnvelope * 0.78 + noise.midL * airEnvelope * 0.36 + edge * 0.27 + body * 0.23,
      noise.highR * airEnvelope * 0.78 + noise.midR * airEnvelope * 0.36 + edge * 0.25 + body * 0.23,
    ];
  };
}

function magicCast(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const rise = chirp(t, 0, 96 + variant * 7, 540 + variant * 76, 0.53, variant * 0.41) * pulse(t, 0, 0.055, 3.8);
    const bloom = chirp(t, 0.18, 182 + variant * 12, 76, 0.42, 0.6) * pulse(t, 0.18, 0.01, 7.1);
    const arcL = resonators(t, 0.12, [610 + variant * 35, 970, 1470], 6.4, 0.2);
    const arcR = resonators(t, 0.12, [631 + variant * 37, 1010, 1535], 6.5, 0.8);
    const electricEnvelope = pulse(t, 0.08, 0.02, 4.9);
    return [
      rise * 0.42 + bloom * 0.31 + arcL * 0.16 + noise.midL * electricEnvelope * 0.38 + noise.highL * electricEnvelope * 0.18,
      rise * 0.42 + bloom * 0.31 + arcR * 0.16 + noise.midR * electricEnvelope * 0.38 + noise.highR * electricEnvelope * 0.18,
    ];
  };
}

function impactSynth(variant, heavy = false, player = false) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const metalBase = player ? [330, 535, 870, 1360] : [420, 670, 1040, 1660];
    return impactLayer(t, noise, {
      subStart: (heavy ? 76 : 104) - variant * 4,
      subEnd: (heavy ? 35 : 52) + variant * 2,
      bodyStart: (heavy ? 188 : 226) + variant * 11,
      bodyEnd: (heavy ? 76 : 106) + variant * 5,
      subDecay: heavy ? 5.8 + variant * 0.3 : 10.8 + variant * 0.7,
      bodyDecay: heavy ? 7.4 + variant * 0.4 : 13.8 + variant * 0.8,
      debrisDecay: heavy ? 5.6 + variant * 0.35 : 11.2 + variant * 0.6,
      crackDecay: player ? 43 + variant * 3 : 55 + variant * 4,
      metalDecay: heavy ? 5.8 + variant * 0.4 : 9.4 + variant * 0.5,
      metal: metalBase.map((hz, index) => hz * (1 + variant * 0.037 + index * 0.004)),
      phase: variant * 0.63,
    });
  };
}

function shieldRise(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const swell = chirp(t, 0, 72 + variant * 6, 218 + variant * 16, 0.62, 0.2) * pulse(t, 0, 0.08, 3.2);
    const glassL = resonators(t, 0.08, [286, 431, 719, 1148].map(hz => hz * (1 + variant * 0.028)), 4.5, 0.1);
    const glassR = resonators(t, 0.08, [301, 455, 758, 1207].map(hz => hz * (1 + variant * 0.028)), 4.6, 0.8);
    const air = pulse(t, 0.025, 0.06, 3.7);
    return [swell * 0.34 + glassL * 0.22 + noise.midL * air * 0.30, swell * 0.34 + glassR * 0.22 + noise.midR * air * 0.30];
  };
}

function shieldBlock(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    let pair = impactLayer(t, noise, {
      subStart: 92 - variant * 3, subEnd: 46, bodyStart: 236 + variant * 12, bodyEnd: 104,
      subDecay: 7.8, bodyDecay: 10.2, debrisDecay: 7.2, crackDecay: 48,
      metalDecay: 4.9, metal: [355, 548, 802, 1216, 1810].map(hz => hz * (1 + variant * 0.029)), phase: variant * 0.5,
    });
    const echoOneL = resonators(t, 0.076, [421, 654, 1018], 8.8, 0.3) * 0.22;
    const echoOneR = resonators(t, 0.076, [439, 683, 1065], 8.8, 0.9) * 0.22;
    const echoTwoL = resonators(t, 0.164, [382, 596, 932], 10.2, 0.7) * 0.14;
    const echoTwoR = resonators(t, 0.164, [401, 625, 974], 10.2, 0.1) * 0.14;
    pair = addPair(pair, [echoOneL + echoTwoL, echoOneR + echoTwoR]);
    return pair;
  };
}

function ultimateCharge(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const rise = chirp(t, 0, 44 + variant * 3, 306 + variant * 25, 0.88, variant * 0.5) * pulse(t, 0, 0.12, 2.15);
    const sub = chirp(t, 0.08, 88, 47, 0.7, 0.4) * pulse(t, 0.08, 0.06, 3.4);
    const vortex = pulse(t, 0.02, 0.08, 2.55);
    return [rise * 0.46 + sub * 0.34 + noise.lowL * vortex * 0.75 + noise.midL * vortex * 0.29,
      rise * 0.46 + sub * 0.34 + noise.lowR * vortex * 0.75 + noise.midR * vortex * 0.29];
  };
}

function ultimateImpact(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const first = impactLayer(t, noise, {
      onset: 0, weight: 1, subStart: 68 - variant * 3, subEnd: 31, bodyStart: 168, bodyEnd: 68,
      subDecay: 4.2, bodyDecay: 6.2, debrisDecay: 3.9, crackDecay: 46,
      metalDecay: 4.6, metal: [318, 497, 782, 1240, 1960], phase: variant * 0.57,
    });
    const second = impactLayer(t, noise, {
      onset: 0.084 + variant * 0.006, weight: 0.72, subStart: 58, subEnd: 28, bodyStart: 142, bodyEnd: 59,
      subDecay: 4.7, bodyDecay: 6.8, debrisDecay: 4.2, crackDecay: 51,
      metalDecay: 5.1, metal: [287, 461, 736, 1168], phase: 0.8 + variant * 0.4,
    });
    const third = impactLayer(t, noise, {
      onset: 0.162 + variant * 0.008, weight: 0.43, subStart: 52, subEnd: 25, bodyStart: 126, bodyEnd: 54,
      subDecay: 5.1, bodyDecay: 7.5, debrisDecay: 4.5, crackDecay: 57,
      metalDecay: 5.8, metal: [264, 423, 675, 1071], phase: 1.2 + variant * 0.3,
    });
    return addPair(addPair(first, second), third);
  };
}

function healWave(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const notes = variant ? [293.66, 392, 493.88, 587.33] : [261.63, 349.23, 440, 523.25];
    let left = 0, right = 0;
    for (let index = 0; index < notes.length; index += 1) {
      const onset = 0.06 + index * 0.092;
      left += tone(t, onset, notes[index], 3.2 + index * 0.22, index * 0.38, 0.018) / (1 + index * 0.22);
      right += tone(t, onset, notes[index] * 1.006, 3.25 + index * 0.22, 0.61 + index * 0.38, 0.018) / (1 + index * 0.22);
    }
    const warm = chirp(t, 0, 96, 142, 0.76, 0.2) * pulse(t, 0, 0.11, 2.6);
    const air = pulse(t, 0.04, 0.08, 2.9);
    return [left * 0.24 + warm * 0.25 + noise.midL * air * 0.19, right * 0.24 + warm * 0.25 + noise.midR * air * 0.19];
  };
}

function utilityPulse(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const low = chirp(t, 0, 84 + variant * 8, 176 + variant * 16, 0.46, 0.3) * pulse(t, 0, 0.045, 4.6);
    const click = resonators(t, 0.15, [342, 518, 784].map(hz => hz * (1 + variant * 0.035)), 7.2, variant * 0.6);
    const air = pulse(t, 0.03, 0.035, 4.2);
    return [low * 0.37 + click * 0.18 + noise.midL * air * 0.29, low * 0.37 + click * 0.18 + noise.midR * air * 0.29];
  };
}

function rewardClaim(variant) {
  return (t, duration, state) => {
    const noise = noiseBands(state);
    const notes = variant ? [349.23, 440, 587.33, 698.46, 880] : [329.63, 415.3, 523.25, 659.25, 830.61];
    let left = 0, right = 0;
    for (let index = 0; index < notes.length; index += 1) {
      const onset = 0.035 + index * 0.094;
      left += tone(t, onset, notes[index], 2.7 + index * 0.2, index * 0.31, 0.012) / (1 + index * 0.2);
      right += tone(t, onset, notes[index] * 1.004, 2.75 + index * 0.2, 0.53 + index * 0.31, 0.012) / (1 + index * 0.2);
    }
    const bloom = chirp(t, 0, 74, 118, 0.92, 0.4) * pulse(t, 0, 0.1, 2.25);
    const air = pulse(t, 0.04, 0.06, 2.7);
    return [left * 0.25 + bloom * 0.29 + noise.midL * air * 0.14, right * 0.25 + bloom * 0.29 + noise.midR * air * 0.14];
  };
}

const specs = [];
function series(prefix, count, duration, seed, targetRmsDb, synthFactory, options = {}) {
  for (let index = 0; index < count; index += 1) {
    specs.push({
      name: `${prefix}_${String(index + 1).padStart(2, '0')}.wav`,
      duration: typeof duration === 'function' ? duration(index) : duration,
      seed: (seed + index * 0x45d9f3b) >>> 0,
      targetRmsDb,
      synth: synthFactory(index),
      ...options,
    });
  }
}

series('weapon_whoosh', 3, index => 0.62 + index * 0.04, 0x1742aa11, -17.0, weaponWhoosh, { room: 0.10, drive: 1.32 });
series('magic_cast', 3, index => 0.84 + index * 0.05, 0x64c28109, -16.2, magicCast, { room: 0.18, drive: 1.36 });
series('impact_light', 4, index => 0.38 + index * 0.025, 0x21b4cf22, -15.2, index => impactSynth(index, false, false), { room: 0.08, drive: 1.66 });
series('impact_heavy', 3, index => 0.86 + index * 0.06, 0x492ad830, -14.4, index => impactSynth(index, true, false), { room: 0.17, drive: 1.72 });
series('player_hit_light', 3, index => 0.41 + index * 0.035, 0xa7705d19, -15.7, index => impactSynth(index, false, true), { room: 0.08, drive: 1.58 });
series('player_hit_heavy', 2, index => 0.82 + index * 0.08, 0xf0bca731, -14.8, index => impactSynth(index, true, true), { room: 0.14, drive: 1.70 });
series('shield_rise', 2, index => 0.78 + index * 0.06, 0x88c10f54, -17.0, shieldRise, { room: 0.22, drive: 1.28 });
series('shield_block', 3, index => 0.86 + index * 0.05, 0x18c10f54, -14.7, shieldBlock, { room: 0.19, drive: 1.61 });
series('ultimate_charge', 2, index => 1.02 + index * 0.08, 0x2add4012, -16.0, ultimateCharge, { room: 0.24, drive: 1.45 });
series('ultimate_impact', 2, index => 1.48 + index * 0.10, 0xbadd4012, -13.9, ultimateImpact, { room: 0.30, drive: 1.82 });
series('heal_wave', 2, index => 1.05 + index * 0.08, 0x67da21f0, -17.2, healWave, { room: 0.26, drive: 1.25 });
series('utility_pulse', 2, index => 0.72 + index * 0.06, 0x39ba84e1, -17.5, utilityPulse, { room: 0.16, drive: 1.32 });
series('reward_claim', 2, index => 1.18 + index * 0.08, 0x57aa903c, -16.8, rewardClaim, { room: 0.28, drive: 1.24 });

fs.mkdirSync(OUTPUT, { recursive: true });
for (const spec of specs) fs.writeFileSync(path.join(OUTPUT, spec.name), render(spec));
process.stdout.write(JSON.stringify({
  output: OUTPUT,
  sampleRate: SAMPLE_RATE,
  channels: CHANNELS,
  bitDepth: BIT_DEPTH,
  files: specs.map(spec => spec.name),
}, null, 2));
