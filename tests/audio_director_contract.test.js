const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');
const audio = require(path.join(root, 'src', 'triad_audio_director.js'));

test('stage music changes every five stages and loops safely after fifty', () => {
  assert.equal(audio.STAGE_TRACKS.length, 10);
  for (let stage = 1; stage <= 5; stage++) assert.equal(audio.stageTrackIndex(stage), 0);
  for (let stage = 6; stage <= 10; stage++) assert.equal(audio.stageTrackIndex(stage), 1);
  assert.equal(audio.stageTrackIndex(46), 9);
  assert.equal(audio.stageTrackIndex(50), 9);
  assert.equal(audio.stageTrackIndex(51), 0);
  assert.equal(audio.stageTrackIndex(1051), 0);
});

test('only runtime-referenced selections live in the dedicated music folder', () => {
  const selectedRoot = path.join(root, 'sounds', 'triad_run_music');
  const referenced = [
    ...Object.values(audio.TRACKS).map(track => track.file),
    ...audio.STAGE_TRACKS.map(track => track.file),
  ];
  assert.equal(new Set(referenced).size, 21);
  for (const relative of referenced) {
    const target = path.join(selectedRoot, ...relative.split('/'));
    assert.equal(fs.existsSync(target), true, `missing selected track: ${relative}`);
    const header = fs.readFileSync(target).subarray(0, 3);
    const isId3 = header.toString('ascii') === 'ID3';
    const isMp3Frame = header[0] === 0xff && (header[1] & 0xe0) === 0xe0;
    assert.equal(isId3 || isMp3Frame, true, `${relative} must carry its real MP3 codec`);
  }
  const actual = fs.readdirSync(selectedRoot, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.mp3')).length;
  assert.equal(actual, referenced.length);
  assert.equal(audio.TRACKS.title.name, 'Below the Broken Moon');
  assert.equal(audio.TRACKS.title.file, 'title/roguelike_title_07_below_the_broken_moon.mp3');
  // The source library is deliberately gitignored: it is a local authoring
  // archive, not a public runtime dependency. Verify its move state whenever
  // that archive is available, while keeping clean Git checkouts testable.
  const sourceTitleRoot = path.join(root, 'sounds', 'roguelike_rpg_audio_pack', '01_title_songs');
  if (fs.existsSync(sourceTitleRoot)) {
    assert.equal(fs.existsSync(path.join(sourceTitleRoot, 'roguelike_title_07_below_the_broken_moon.wav')), false, 'new title must be removed from the source pack');
    assert.equal(fs.existsSync(path.join(sourceTitleRoot, 'roguelike_title_08_echoes_of_the_run.wav')), true, 'old title must be restored to the source pack');
  }
});

test('screen, meta-tab, ending and mute controls are wired into the canonical runtime', () => {
  assert.match(html, /src\/triad_audio_director\.js\?v=1\.2\.0-native-autoplay-gain20/);
  assert.match(html, /id="bgmToggle"[^>]+onclick="toggleBgm\(\)"/);
  assert.equal((html.match(/data-meta-tab-button=/g) || []).length, 5);
  assert.equal((html.match(/data-meta-tab-pane=/g) || []).length, 5);
  assert.match(html, /function showScreen\(id\)[^{]*\{[\s\S]*?AUDIO\.playScreen\(id,\{stage:run\?\.stage\|\|1,metaTab:metaShopTabId\}\)/);
  assert.match(html, /function setMetaShopTab\([\s\S]*?AUDIO\.playMetaTab\(metaShopTabId\)/);
  assert.match(html, /showHistory\('ending'\)/);
  assert.match(html, /if\(musicMode==='ending'\)AUDIO\.playEnding\(\)/);
  assert.match(html, /id="bgmVolume"[^>]+type="range"[^>]+max="100"/);
  assert.match(html, /id="bgmVolumeValue"/);
  assert.match(html, /AUDIO\.initialize\(\{toggleElement:document\.getElementById\('bgmToggle'\),volumeElement:document\.getElementById\('bgmVolume'\),volumeLabel:document\.getElementById\('bgmVolumeValue'\)\}\)/);
  assert.match(html, /AUDIO\.playTitleAutoplay\(\)/);
  assert.match(html, /rel="preload"[^>]+below_the_broken_moon\.mp3[^>]+as="audio"/);
  assert.ok(html.indexOf('AUDIO.playTitleAutoplay();') < html.indexOf("SFX.initialize({volumeElement:document.getElementById('bgmVolume')});"), 'title autoplay must start before the large combat SFX preload');
});

test('director switches tracks without recreating players and remembers mute state', () => {
  class FakeAudio {
    constructor() { this.src = ''; this.volume = 0; this.loop = false; this.preload = ''; this.currentTime = 0; this.paused = true; }
    play() { this.paused = false; }
    pause() { this.paused = true; }
  }
  const values = new Map();
  const director = new audio.AudioDirector({
    AudioCtor: FakeAudio,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    document: { addEventListener() {} },
    setInterval: () => 1,
    clearInterval() {},
  });
  director.unlocked = true;
  assert.equal(director.players.length, 2);
  assert.equal(director.playStage(1), true);
  assert.equal(director.currentKey, 'stage:0');
  assert.match(director.players[director.activeIndex].src, /roguelike_bgm_01_ancient_gate\.mp3$/);
  assert.equal(director.playStage(6), true);
  assert.equal(director.currentKey, 'stage:1');
  assert.equal(director.playMetaTab('breakthrough'), true);
  assert.equal(director.currentKey, 'breakthrough');
  assert.equal(director.setVolume(0.42), 0.42);
  assert.equal(values.get('triad_bgm_volume'), '0.42');
  assert.equal(director.toggle(), false);
  assert.equal(values.get('triad_bgm_enabled'), '0');
  assert.equal(director.players.every(player => player.paused), true);
});

test('native autoplay is armed and the shared output is twenty percent louder', () => {
  class FakeAudio {
    constructor() { this.src = ''; this.volume = 0; this.loop = false; this.preload = ''; this.currentTime = 0; this.paused = true; }
    play() { this.paused = false; }
    pause() { this.paused = true; }
  }
  const director = new audio.AudioDirector({
    AudioCtor: FakeAudio,
    storage: { getItem: () => null, setItem() {} },
    document: { addEventListener() {} },
  });
  assert.equal(audio.OUTPUT_GAIN_BOOST, 1.2);
  assert.equal(director.players.every(player => player.autoplay === true), true);
  assert.equal(director.playTitleAutoplay(), true);
  assert.ok(Math.abs(director.debugState().volume - 0.36) < 1e-9);
  director.setVolume(0.5);
  assert.ok(Math.abs(director.debugState().volume - 0.18) < 1e-9);
});

test('a deliberately silent slider remains a healthy autoplay transport', () => {
  class FakeAudio {
    constructor() { this.src = ''; this.volume = 0; this.currentTime = 0; this.paused = true; this.muted = false; }
    play() { this.paused = false; }
    pause() { this.paused = true; }
  }
  const toggle = { textContent: '', title: '', dataset: {}, setAttribute() {} };
  const director = new audio.AudioDirector({
    AudioCtor: FakeAudio,
    storage: { getItem: key => key === 'triad_bgm_volume' ? '0' : null, setItem() {} },
    document: { addEventListener() {} },
  }).initialize({ toggleElement: toggle });
  director.playTitleAutoplay();
  assert.equal(director.debugState().paused, false);
  assert.equal(director.debugState().audible, false);
  assert.equal(director.debugState().lastError, null);
  assert.equal(toggle.textContent, '♫ BGM ON');
});

test('audible title autoplay is attempted immediately and retries after a browser block', async () => {
  let attempts = 0;
  const timers = [];
  class FlakyAudio {
    constructor() { this.src = ''; this.volume = 0; this.loop = false; this.preload = ''; this.currentTime = 0; this.paused = true; }
    play() {
      attempts++;
      if (attempts === 1) {
        this.paused = true;
        const error = new Error('blocked');
        error.name = 'NotAllowedError';
        return Promise.reject(error);
      }
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  const handlers = {};
  const toggle = { textContent: '', title: '', dataset: {}, setAttribute() {} };
  const volume = { value: '', addEventListener() {} };
  const label = { textContent: '' };
  const director = new audio.AudioDirector({
    AudioCtor: FlakyAudio,
    storage: { getItem: () => null, setItem() {} },
    document: { addEventListener: (type, handler, options) => { handlers[type] = { handler, options }; } },
    setInterval: () => 1,
    clearInterval() {},
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
  }).initialize({ toggleElement: toggle, volumeElement: volume, volumeLabel: label });

  assert.equal(director.debugState().masterVolume, 1);
  assert.equal(director.debugState().unlocked, true);
  assert.equal(volume.value, '100');
  assert.equal(label.textContent, '100%');
  director.playTitleAutoplay();
  assert.equal(attempts, 1, 'title playback must be attempted without a click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 2, 'a blocked audible attempt must immediately bootstrap the same title track muted');
  assert.equal(director.debugState().currentKey, 'title');
  assert.equal(director.debugState().muted, true);
  assert.equal(toggle.textContent, '♫ BGM 시작');
  const promote = timers.find(timer => timer.delay === 80);
  assert.ok(promote);
  promote.fn();
  director.players[director.activeIndex].paused = true;
  const verify = timers.find(timer => timer.delay === 260);
  assert.ok(verify);
  verify.fn();
  assert.equal(director.debugState().lastError, 'AUTOPLAY_REQUIRES_USER_GESTURE');
  handlers.pointerdown.handler();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 3);
  assert.equal(handlers.pointerdown.options.once, undefined);
  assert.equal(director.debugState().currentKey, 'title');
  assert.equal(director.debugState().paused, false);
  assert.equal(toggle.textContent, '♫ BGM ON');
});
