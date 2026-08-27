(function attachTriadCombatSfx(root) {
  'use strict';

  const ROOT = 'sounds/triad_run_sfx/combat/';
  const CATALOG = Object.freeze({
    playerSlash: ['player_slash_01.wav'],
    playerMagic: ['player_magic_01.wav'],
    enemyImpact: ['enemy_impact_01.wav', 'enemy_impact_02.wav'],
    playerHit: ['player_hit_01.wav', 'player_hit_02.wav'],
    shieldBlock: ['shield_block_01.wav'],
    ultimateImpact: ['ultimate_impact_01.wav'],
    healChime: ['heal_chime_01.wav'],
    rewardClaim: ['reward_claim_01.wav'],
  });
  const SUPPORT = new Set(['guard', 'counter', 'bastion']);
  const HEAL = new Set(['heal', 'renewal']);
  const MAGIC_OWNERS = new Set(['VOLT', 'BLOOM', 'RIFT']);
  const STORAGE_KEY = 'triad_bgm_volume';
  const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAgICA';

  class CombatSfxDirector {
    constructor(options = {}) {
      this.AudioCtor = options.AudioCtor || root.Audio;
      this.storage = options.storage || root.localStorage;
      this.document = options.document || root.document;
      this.setTimeout = options.setTimeout || root.setTimeout?.bind(root);
      this.masterVolume = this.readVolume();
      this.voiceCursor = Object.create(null);
      this.pools = new Map();
      this.debugLog = [];
      this.playedKeys = new Set();
      this.unlocked = false;
      this.playSuccessCount = 0;
      this.playErrorCount = 0;
      this.unlockVoice = this.AudioCtor ? new this.AudioCtor(SILENT_WAV) : null;
    }

    readVolume() {
      try {
        const raw = this.storage?.getItem(STORAGE_KEY);
        if (raw == null || raw === '') return 1;
        const value = Number(raw);
        return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1;
      } catch (_) { return 1; }
    }

    initialize({ volumeElement } = {}) {
      if (volumeElement) {
        this.setVolume(Number(volumeElement.value) / 100);
        volumeElement.addEventListener('input', event => this.setVolume(Number(event.target.value) / 100));
      }
      Object.keys(CATALOG).forEach(key => this.preload(key));
      const unlock = () => this.unlockFromGesture();
      this.document?.addEventListener('pointerdown', unlock, { capture: true });
      this.document?.addEventListener('keydown', unlock, { capture: true });
      this.publishState('ready');
      return this;
    }

    unlockFromGesture() {
      this.unlocked = true;
      const audio = this.unlockVoice;
      if (!audio) return true;
      audio.volume = 0;
      try {
        const result = audio.play();
        if (result?.then) result.then(() => { audio.pause(); audio.currentTime = 0; this.publishState('unlocked'); }).catch(() => this.publishState('gesture-ready'));
      } catch (_) { this.publishState('gesture-ready'); }
      return true;
    }

    publishState(state, event = null) {
      const rootNode = this.document?.documentElement;
      if (!rootNode) return;
      rootNode.dataset.combatSfxState = state;
      rootNode.dataset.combatSfxVolume = String(this.masterVolume);
      rootNode.dataset.combatSfxSuccess = String(this.playSuccessCount);
      rootNode.dataset.combatSfxErrors = String(this.playErrorCount);
      rootNode.dataset.combatSfxPlayedKeys = [...this.playedKeys].join(',');
      if (event?.error) rootNode.dataset.combatSfxError = event.error;
      else if (state === 'playing') delete rootNode.dataset.combatSfxError;
    }

    setVolume(value) {
      this.masterVolume = Math.max(0, Math.min(1, Number(value) || 0));
      return this.masterVolume;
    }

    preload(key) {
      if (!this.AudioCtor || this.pools.has(key)) return;
      const files = CATALOG[key] || [];
      const voices = files.flatMap(file => Array.from({ length: 3 }, () => {
        const audio = new this.AudioCtor(ROOT + file);
        audio.preload = 'auto'; audio.playsInline = true;
        if (typeof audio.load === 'function') audio.load();
        return { audio, file };
      }));
      this.pools.set(key, voices);
    }

    play(key, options = {}) {
      const delay = Math.max(0, Number(options.delay) || 0);
      if (delay && this.setTimeout) {
        this.setTimeout(() => this.play(key, { ...options, delay: 0 }), delay);
        return true;
      }
      this.preload(key);
      const voices = this.pools.get(key) || [];
      if (!voices.length) return false;
      const cursor = this.voiceCursor[key] = ((this.voiceCursor[key] || 0) + 1) % voices.length;
      const voice = voices[cursor], audio = voice.audio;
      audio.pause(); audio.currentTime = 0;
      audio.playbackRate = Math.max(0.84, Math.min(1.18, Number(options.rate) || 1));
      const requestedVolume = Number.isFinite(Number(options.volume)) ? Number(options.volume) : 1;
      audio.volume = Math.max(0, Math.min(1, requestedVolume * this.masterVolume));
      const event = { key, file: voice.file, delay, rate: audio.playbackRate, volume: audio.volume, status: 'requested', at: Date.now() };
      this.debugLog.push(event); this.debugLog = this.debugLog.slice(-60);
      const rootNode = root.document?.documentElement;
      if (rootNode) {
        rootNode.dataset.lastCombatSfx = key;
        rootNode.dataset.lastCombatSfxFile = voice.file;
        rootNode.dataset.combatSfxCount = String((Number(rootNode.dataset.combatSfxCount) || 0) + 1);
      }
      try {
        const result = audio.play();
        if (result?.then) result.then(() => {
          event.status = 'playing'; this.playSuccessCount += 1; this.playedKeys.add(key); this.publishState('playing', event);
        }).catch(error => {
          event.status = 'failed'; event.error = error?.name || 'PLAYBACK_FAILED'; this.playErrorCount += 1; this.publishState('failed', event);
        });
        else { event.status = 'playing'; this.playSuccessCount += 1; this.playedKeys.add(key); this.publishState('playing', event); }
      } catch (error) {
        event.status = 'failed'; event.error = error?.name || 'PLAYBACK_FAILED'; this.playErrorCount += 1; this.publishState('failed', event);
      }
      return true;
    }

    playCard(card, context = {}) {
      const key = card?.pattern?.key || '';
      if (HEAL.has(key)) return this.play('healChime', { volume: 0.68 });
      if (SUPPORT.has(key)) return this.play('shieldBlock', { volume: 0.72, rate: 1.06 });
      const hits = Math.max(1, Math.min(5, Number(context.hits) || 1));
      const signature = key === 'signature';
      const attackKey = signature ? 'ultimateImpact' : MAGIC_OWNERS.has(card?.owner) ? 'playerMagic' : 'playerSlash';
      this.play(attackKey, { volume: signature ? 0.92 : 0.72, rate: 0.98 });
      if (Number(context.damage) > 0) {
        const firstDelay = signature ? 330 : key === 'quick' || key === 'dot' || key === 'volley' ? 430 : 145;
        for (let i = 0; i < hits; i += 1) this.play('enemyImpact', { delay: firstDelay + i * 118, volume: signature ? 0.92 : 0.76, rate: 0.96 + i * 0.025 });
      }
      return true;
    }

    playEnemy(context = {}) {
      const hits = Math.max(1, Math.min(4, Number(context.hits) || 1));
      this.play('playerMagic', { volume: 0.58, rate: 0.82 });
      for (let i = 0; i < hits; i += 1) {
        const blocked = Boolean(context.results?.[i]?.blocked);
        this.play(blocked ? 'shieldBlock' : 'playerHit', { delay: 420 + i * 145, volume: blocked ? 0.78 : 0.82, rate: 0.94 + i * 0.035 });
      }
      return true;
    }

    reward() { return this.play('rewardClaim', { volume: 0.72 }); }
    debugState() { return { root: ROOT, masterVolume: this.masterVolume, unlocked: this.unlocked, playSuccessCount: this.playSuccessCount, playErrorCount: this.playErrorCount, catalog: CATALOG, log: [...this.debugLog] }; }
  }

  const director = new CombatSfxDirector();
  const api = Object.freeze({
    ROOT, CATALOG, CombatSfxDirector,
    initialize: elements => director.initialize(elements),
    setVolume: value => director.setVolume(value),
    play: (key, options) => director.play(key, options),
    playCard: (card, context) => director.playCard(card, context),
    playEnemy: context => director.playEnemy(context),
    reward: () => director.reward(),
    debugState: () => director.debugState(),
  });
  root.TRIAD_SFX = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
