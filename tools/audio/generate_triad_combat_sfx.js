'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const OUTPUT = path.resolve(__dirname, '..', '..', 'sounds', 'triad_run_sfx', 'combat');

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };
}

function envelope(t, attack, decay) {
  return Math.min(1, t / Math.max(0.0001, attack)) * Math.exp(-t * decay);
}

function softClip(value) {
  return Math.tanh(value * 1.22) * 0.82;
}

function render(duration, seed, synth) {
  const frames = Math.ceil(duration * SAMPLE_RATE);
  const left = new Float64Array(frames);
  const right = new Float64Array(frames);
  const random = rng(seed);
  const state = { random, previousNoise: 0, lowNoise: 0 };
  for (let i = 0; i < frames; i += 1) {
    const t = i / SAMPLE_RATE;
    const [l, r] = synth(t, duration, state);
    left[i] = l;
    right[i] = r;
  }
  const delayA = Math.round(SAMPLE_RATE * 0.037);
  const delayB = Math.round(SAMPLE_RATE * 0.071);
  for (let i = 0; i < frames; i += 1) {
    if (i >= delayA) {
      left[i] += right[i - delayA] * 0.13;
      right[i] += left[i - delayA] * 0.11;
    }
    if (i >= delayB) {
      left[i] += left[i - delayB] * 0.065;
      right[i] += right[i - delayB] * 0.075;
    }
  }
  let peak = 0;
  for (let i = 0; i < frames; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const gain = peak > 0 ? 0.92 / peak : 1;
  const pcm = Buffer.alloc(frames * CHANNELS * 2);
  for (let i = 0; i < frames; i += 1) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, softClip(left[i] * gain))) * 32767), i * 4);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, softClip(right[i] * gain))) * 32767), i * 4 + 2);
  }
  return wav(pcm, frames);
}

function wav(pcm, frames) {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * CHANNELS * 2;
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22); header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28); header.writeUInt16LE(CHANNELS * 2, 32);
  header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(frames * CHANNELS * 2, 40);
  return Buffer.concat([header, pcm]);
}

function noiseBands(state) {
  const raw = state.random();
  state.lowNoise += (raw - state.lowNoise) * 0.075;
  const high = raw - state.previousNoise * 0.86;
  state.previousNoise = raw;
  return { raw, low: state.lowNoise, high };
}

const files = {
  'player_slash_01.wav': render(0.48, 0x1742aa11, (t, d, s) => {
    const n = noiseBands(s), sweep = Math.sin(Math.PI * Math.min(1, t / 0.18));
    const air = n.high * envelope(t, 0.006, 10) * (0.65 + sweep * 0.7);
    const blade = Math.sin(2 * Math.PI * (980 - 640 * t / d) * t) * envelope(t, 0.004, 13);
    const body = Math.sin(2 * Math.PI * (148 - 72 * t / d) * t) * envelope(t, 0.002, 16);
    return [air * 0.54 + blade * 0.31 + body * 0.28, air * 0.38 + blade * 0.4 + body * 0.3];
  }),
  'player_magic_01.wav': render(0.62, 0x64c28109, (t, d, s) => {
    const n = noiseBands(s), pitch = 260 + 760 * Math.min(1, t / 0.24);
    const charge = Math.sin(2 * Math.PI * pitch * t + Math.sin(t * 31) * 1.5) * envelope(t, 0.015, 6.3);
    const shimmer = (Math.sin(2 * Math.PI * 1320 * t) + Math.sin(2 * Math.PI * 1840 * t) * 0.55) * envelope(t, 0.025, 8.8);
    const spark = n.high * envelope(t, 0.004, 8.5);
    return [charge * 0.42 + shimmer * 0.22 + spark * 0.22, charge * 0.38 + shimmer * 0.29 + spark * 0.18];
  }),
  'enemy_impact_01.wav': render(0.56, 0x21b4cf22, (t, d, s) => {
    const n = noiseBands(s), sub = Math.sin(2 * Math.PI * (132 - 78 * t / d) * t) * envelope(t, 0.002, 12);
    const armor = [410, 615, 920, 1370].reduce((sum, f, i) => sum + Math.sin(2 * Math.PI * f * t + i) * envelope(t, 0.001, 8 + i * 2) / (i + 1), 0);
    const crack = n.high * envelope(t, 0.001, 24);
    return [sub * 0.62 + armor * 0.31 + crack * 0.48, sub * 0.58 + armor * 0.37 + crack * 0.4];
  }),
  'enemy_impact_02.wav': render(0.61, 0x492ad830, (t, d, s) => {
    const n = noiseBands(s), sub = Math.sin(2 * Math.PI * (118 - 54 * t / d) * t) * envelope(t, 0.002, 10.5);
    const tear = n.high * envelope(t, 0.003, 18) + n.low * envelope(t, 0.003, 8);
    const metal = Math.sin(2 * Math.PI * 730 * t) * envelope(t, 0.001, 7.2) + Math.sin(2 * Math.PI * 1110 * t) * envelope(t, 0.002, 11) * 0.45;
    return [sub * 0.64 + tear * 0.42 + metal * 0.27, sub * 0.58 + tear * 0.34 + metal * 0.35];
  }),
  'player_hit_01.wav': render(0.52, 0xa7705d19, (t, d, s) => {
    const n = noiseBands(s), thud = Math.sin(2 * Math.PI * (104 - 52 * t / d) * t) * envelope(t, 0.002, 13);
    const plate = (Math.sin(2 * Math.PI * 520 * t) + Math.sin(2 * Math.PI * 860 * t) * 0.5) * envelope(t, 0.001, 10.2);
    return [thud * 0.68 + plate * 0.27 + n.low * envelope(t, 0.001, 18) * 0.38, thud * 0.61 + plate * 0.34 + n.high * envelope(t, 0.001, 22) * 0.24];
  }),
  'player_hit_02.wav': render(0.58, 0xf0bca731, (t, d, s) => {
    const n = noiseBands(s), thud = Math.sin(2 * Math.PI * (92 - 39 * t / d) * t) * envelope(t, 0.002, 11.5);
    const fracture = n.high * envelope(t, 0.001, 19) + Math.sin(2 * Math.PI * 680 * t) * envelope(t, 0.001, 9) * 0.35;
    return [thud * 0.7 + fracture * 0.42, thud * 0.63 + fracture * 0.5];
  }),
  'shield_block_01.wav': render(0.72, 0x88c10f54, (t, d, s) => {
    const n = noiseBands(s), body = Math.sin(2 * Math.PI * (126 - 42 * t / d) * t) * envelope(t, 0.001, 11);
    const ring = [390, 585, 810, 1230, 1640].reduce((sum, f, i) => sum + Math.sin(2 * Math.PI * f * t + i * 0.7) * envelope(t, 0.001, 4.8 + i * 0.8) / (i + 1), 0);
    return [body * 0.47 + ring * 0.49 + n.high * envelope(t, 0.001, 23) * 0.23, body * 0.45 + ring * 0.55 + n.high * envelope(t, 0.001, 23) * 0.2];
  }),
  'ultimate_impact_01.wav': render(0.94, 0xbadd4012, (t, d, s) => {
    const n = noiseBands(s), sub = Math.sin(2 * Math.PI * (82 - 34 * t / d) * t) * envelope(t, 0.002, 6.8);
    const boom = Math.sin(2 * Math.PI * (178 - 96 * t / d) * t) * envelope(t, 0.001, 9.4);
    const crystal = [560, 840, 1260, 1890].reduce((sum, f, i) => sum + Math.sin(2 * Math.PI * f * t + i) * envelope(t, 0.002, 5.2 + i) / (i + 1), 0);
    const blast = n.low * envelope(t, 0.001, 7.5) + n.high * envelope(t, 0.001, 16) * 0.55;
    return [sub * 0.7 + boom * 0.45 + crystal * 0.25 + blast * 0.42, sub * 0.68 + boom * 0.42 + crystal * 0.32 + blast * 0.38];
  }),
  'heal_chime_01.wav': render(0.86, 0x67da21f0, (t, d, s) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const bells = notes.reduce((sum, f, i) => {
      const local = Math.max(0, t - i * 0.075);
      return sum + (local > 0 ? Math.sin(2 * Math.PI * f * local) * Math.exp(-local * (3.7 + i * 0.3)) : 0) / (1 + i * 0.24);
    }, 0);
    const air = noiseBands(s).high * envelope(t, 0.02, 4.8) * 0.08;
    return [bells * 0.38 + air, bells * 0.44 - air * 0.4];
  }),
  'reward_claim_01.wav': render(1.08, 0x57aa903c, (t, d, s) => {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    const chord = notes.reduce((sum, f, i) => {
      const local = t - i * 0.085;
      return sum + (local > 0 ? Math.sin(2 * Math.PI * f * local) * Math.exp(-local * (2.7 + i * 0.2)) : 0) / (1 + i * 0.18);
    }, 0);
    const bloom = Math.sin(2 * Math.PI * (128 + 36 * t) * t) * envelope(t, 0.08, 2.9);
    return [chord * 0.38 + bloom * 0.14, chord * 0.44 + bloom * 0.12];
  }),
};

fs.mkdirSync(OUTPUT, { recursive: true });
for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(OUTPUT, name), data);
process.stdout.write(JSON.stringify({ output: OUTPUT, sampleRate: SAMPLE_RATE, channels: CHANNELS, files: Object.keys(files) }, null, 2));

