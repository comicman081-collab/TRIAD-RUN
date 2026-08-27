(function (root) {
  'use strict';

  const ROOT = 'sounds/triad_run_music/';
  const STORAGE_KEY = 'triad_bgm_enabled';
  const VOLUME_STORAGE_KEY = 'triad_bgm_volume';
  const OUTPUT_GAIN_BOOST = 1.2;
  const FADE_MS = 720;
  const TRACKS = Object.freeze({
    title: { name: 'Below the Broken Moon', file: 'title/roguelike_title_07_below_the_broken_moon.mp3', volume: 0.30 },
    ending: { name: 'The Run Becomes a Story', file: 'ending/roguelike_ending_10_the_run_becomes_a_story.mp3', volume: 0.32 },
    partySelect: { name: 'Ancient Gate · Camp Mix', file: 'ui/roguelike_bgm_018_ancient_gate_08_camp_mix.mp3', volume: 0.27 },
    startDraft: { name: 'Trap Gallery · Relic Mix', file: 'ui/roguelike_bgm_040_trap_gallery_03_relic_mix.mp3', volume: 0.27 },
    lobbyBackgrounds: { name: 'Safe Room Fire · Echo Mix', file: 'ui/roguelike_bgm_033_safe_room_fire_05_echo_mix.mp3', volume: 0.25 },
    history: { name: 'Endless Stairs · Camp Mix', file: 'ui/roguelike_bgm_099_endless_stairs_08_camp_mix.mp3', volume: 0.25 },
    recruitment: { name: 'Ancient Gate · Relic Mix', file: 'ui/roguelike_bgm_013_ancient_gate_03_relic_mix.mp3', volume: 0.26 },
    breakthrough: { name: 'Relic Awakened · Ascension Mix', file: 'ui/roguelike_bgm_091_relic_awakened_09_ascension_mix.mp3', volume: 0.27 },
    growthShop: { name: 'Safe Room Fire · Camp Mix', file: 'ui/roguelike_bgm_036_safe_room_fire_08_camp_mix.mp3', volume: 0.25 },
    cardShop: { name: 'Treasure Vault · Ascension Mix', file: 'ui/roguelike_bgm_082_treasure_vault_09_ascension_mix.mp3', volume: 0.27 },
    cardUpgrade: { name: 'Relic Awakened · Tactical Mix', file: 'ui/roguelike_bgm_086_relic_awakened_04_tactical_mix.mp3', volume: 0.27 },
  });
  const STAGE_TRACKS = Object.freeze([
    { name: 'Ancient Gate', file: 'stage/roguelike_bgm_01_ancient_gate.mp3', volume: 0.31 },
    { name: 'Cursed Corridor', file: 'stage/roguelike_bgm_02_cursed_corridor.mp3', volume: 0.31 },
    { name: 'Cursed Woods', file: 'stage/roguelike_bgm_05_cursed_woods.mp3', volume: 0.31 },
    { name: 'Trap Gallery', file: 'stage/roguelike_bgm_04_trap_gallery.mp3', volume: 0.31 },
    { name: 'Elite Chamber', file: 'stage/roguelike_bgm_06_elite_chamber.mp3', volume: 0.32 },
    { name: 'Boss Approach', file: 'stage/roguelike_bgm_07_boss_approach.mp3', volume: 0.33 },
    { name: 'Treasure Vault', file: 'stage/roguelike_bgm_08_treasure_vault.mp3', volume: 0.30 },
    { name: 'Relic Awakened', file: 'stage/roguelike_bgm_09_relic_awakened.mp3', volume: 0.31 },
    { name: 'Endless Stairs', file: 'stage/roguelike_bgm_10_endless_stairs.mp3', volume: 0.31 },
    { name: 'Safe Room Fire', file: 'stage/roguelike_bgm_03_safe_room_fire.mp3', volume: 0.28 },
  ]);
  const META_TRACK_KEYS = Object.freeze({
    recruitment: 'recruitment',
    breakthrough: 'breakthrough',
    growthShop: 'growthShop',
    cardShop: 'cardShop',
    cardUpgrade: 'cardUpgrade',
  });

  function stageTrackIndex(stage) {
    const normalized = Math.max(1, Math.floor(Number(stage) || 1));
    return Math.floor((normalized - 1) / 5) % STAGE_TRACKS.length;
  }

  class AudioDirector {
    constructor(options = {}) {
      this.AudioCtor = options.AudioCtor || root.Audio;
      this.storage = options.storage || root.localStorage;
      this.document = options.document || root.document;
      this.setInterval = options.setInterval || root.setInterval?.bind(root);
      this.clearInterval = options.clearInterval || root.clearInterval?.bind(root);
      this.setTimeout = options.setTimeout || root.setTimeout?.bind(root);
      this.enabled = this.readEnabled();
      this.masterVolume = this.readVolume();
      // Always make the real audible autoplay attempt on initial load. Browsers
      // that permit it start immediately; blocked environments retain the
      // pending track and retry on the next valid user gesture.
      this.unlocked = true;
      this.currentKey = null;
      this.pendingKey = null;
      this.lastError = null;
      this.activeIndex = 0;
      this.fadeTimer = null;
      this.currentBaseVolume = 0;
      this.fadeTargetVolume = 0;
      this.playRequestId = 0;
      this.toggleElement = null;
      this.volumeElement = null;
      this.volumeLabel = null;
      this.players = this.AudioCtor ? [this.createPlayer(), this.createPlayer()] : [];
    }

    readEnabled() {
      try { return this.storage?.getItem(STORAGE_KEY) !== '0'; } catch (_) { return true; }
    }

    readVolume() {
      try {
        const raw = this.storage?.getItem(VOLUME_STORAGE_KEY);
        if (raw == null || raw === '') return 1;
        const stored = Number(raw);
        return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 1;
      } catch (_) { return 1; }
    }

    createPlayer() {
      const player = new this.AudioCtor();
      player.preload = 'auto';
      // Preserve the explicit play() path for telemetry/recovery, while also
      // giving browsers that allow declarative audible autoplay the earliest
      // possible opportunity to start the title track without a page click.
      player.autoplay = true;
      player.playsInline = true;
      player.loop = true;
      player.muted = false;
      player.volume = 0;
      return player;
    }

    initialize(elements = {}) {
      this.toggleElement = elements.toggleElement || elements || null;
      this.volumeElement = elements.volumeElement || null;
      this.volumeLabel = elements.volumeLabel || null;
      if (this.document?.body) this.players.forEach(player => {
        if (typeof player?.nodeType === 'number' && !player.isConnected) {
          player.hidden = true;
          player.setAttribute?.('aria-hidden', 'true');
          this.document.body.appendChild(player);
        }
      });
      if (this.volumeElement) {
        this.volumeElement.value = String(Math.round(this.masterVolume * 100));
        this.volumeElement.addEventListener('input', event => this.setVolume(Number(event.target.value) / 100));
      }
      this.updateToggle();
      this.updateVolumeUi();
      const retry = event => {
        if (event?.target === this.toggleElement || event?.target?.closest?.('#bgmToggle')) return;
        this.unlockAndRetry();
      };
      this.document?.addEventListener('pointerdown', retry, { capture: true });
      this.document?.addEventListener('keydown', retry, { capture: true });
      return this;
    }

    unlockAndRetry() {
      this.unlocked = true;
      const active = this.players[this.activeIndex];
      if (active && !active.paused && active.muted) {
        active.muted = false;
        active.volume = this.outputVolume();
        this.lastError = null;
        this.updateToggle();
        if (this.isPlaying()) return true;
      }
      if (this.enabled && this.pendingKey && !this.isPlaying()) this.play(this.pendingKey, { force: true, immediate: true });
      return this.isPlaying();
    }

    // A user-selected master volume of 0 is still a healthy, unlocked
    // transport. Do not misreport it as an autoplay failure or restart it on
    // every pointer event merely because its current gain is silent.
    isPlaying() { return this.players.some(player => player && !player.paused && !player.muted); }
    isTransportPlaying() { return this.players.some(player => player && !player.paused); }

    outputVolume(baseVolume = this.currentBaseVolume) {
      return Math.max(0, Math.min(1, Number(baseVolume || 0) * this.masterVolume * OUTPUT_GAIN_BOOST));
    }

    resolve(key) {
      if (key.startsWith('stage:')) return STAGE_TRACKS[Number(key.split(':')[1])];
      return TRACKS[key] || null;
    }

    play(key, options = {}) {
      const track = this.resolve(key);
      if (!track) return false;
      this.pendingKey = key;
      if (!this.enabled || !this.unlocked || !this.players.length) {
        this.updateToggle(track);
        return false;
      }
      if (key === this.currentKey && !options.force) return true;
      const previous = this.players[this.activeIndex];
      const nextIndex = 1 - this.activeIndex;
      const next = this.players[nextIndex];
      next.pause();
      next.autoplay = true;
      next.muted = options.bootstrapMuted === true;
      next.defaultMuted = options.bootstrapMuted === true;
      next.src = ROOT + track.file;
      next.currentTime = 0;
      next.loop = true;
      next.volume = 0;
      const requestId = ++this.playRequestId;
      const commitPlayback = () => {
        if (requestId !== this.playRequestId || !this.enabled || this.pendingKey !== key) return;
        this.lastError = null;
        this.currentBaseVolume = track.volume;
        this.crossfade(previous, next, options.immediate === true);
        this.activeIndex = nextIndex;
        this.currentKey = key;
        this.updateToggle(track);
        if (options.bootstrapMuted === true) this.promoteMutedPlayback(next, key, requestId, track);
      };
      try {
        const playback = next.play();
        if (playback && typeof playback.then === 'function') {
          playback.then(commitPlayback).catch(error => {
            if (requestId !== this.playRequestId) return;
            next.pause();
            next.volume = 0;
            this.lastError = error?.name || 'PLAYBACK_FAILED';
            this.pendingKey = key;
            this.updateToggle(track);
            if (key === 'title' && options.autoplay === true && options.bootstrapMuted !== true) {
              this.play(key, { force: true, immediate: true, autoplay: true, bootstrapMuted: true });
            }
          });
        } else commitPlayback();
      } catch (error) {
        next.pause();
        next.volume = 0;
        this.lastError = error?.name || 'PLAYBACK_FAILED';
        this.updateToggle(track);
        if (key === 'title' && options.autoplay === true && options.bootstrapMuted !== true) {
          this.play(key, { force: true, immediate: true, autoplay: true, bootstrapMuted: true });
        }
        return false;
      }
      return true;
    }

    promoteMutedPlayback(player, key, requestId, track) {
      const promote = () => {
        if (requestId !== this.playRequestId || this.pendingKey !== key || !this.enabled) return;
        player.muted = false;
        player.defaultMuted = false;
        player.volume = this.outputVolume();
        const verify = () => {
          if (requestId !== this.playRequestId) return;
          if (!player.paused && !player.muted) this.lastError = null;
          else this.lastError = 'AUTOPLAY_REQUIRES_USER_GESTURE';
          this.updateToggle(track);
        };
        if (this.setTimeout) this.setTimeout(verify, 260); else verify();
      };
      if (this.setTimeout) this.setTimeout(promote, 80); else promote();
    }

    crossfade(previous, next, immediate) {
      if (this.fadeTimer) this.clearInterval?.(this.fadeTimer);
      this.fadeTargetVolume = this.outputVolume();
      if (immediate || !this.setInterval) {
        previous.pause();
        previous.volume = 0;
        next.volume = this.fadeTargetVolume;
        this.updateToggle();
        return;
      }
      const started = Date.now();
      const previousVolume = Number(previous.volume) || 0;
      this.fadeTimer = this.setInterval(() => {
        const progress = Math.min(1, (Date.now() - started) / FADE_MS);
        previous.volume = previousVolume * (1 - progress);
        next.volume = this.fadeTargetVolume * progress;
        if (progress >= 1) {
          this.clearInterval(this.fadeTimer);
          this.fadeTimer = null;
          previous.pause();
          previous.volume = 0;
          this.updateToggle();
        }
      }, 40);
    }

    playStage(stage) {
      return this.play(`stage:${stageTrackIndex(stage)}`);
    }

    playTitleAutoplay() {
      return this.play('title', { force: true, immediate: true, autoplay: true });
    }

    playMetaTab(tabId) {
      return this.play(META_TRACK_KEYS[tabId] || 'recruitment');
    }

    playScreen(screenId, context = {}) {
      if (screenId === 'home') return this.play('title');
      if (screenId === 'metaShop') return this.playMetaTab(context.metaTab || 'recruitment');
      if (screenId === 'partySelect' || screenId === 'buildSelect' || screenId === 'customize') return this.play('partySelect');
      if (screenId === 'startDraft') return this.play('startDraft');
      if (screenId === 'lobbyBackgrounds') return this.play('lobbyBackgrounds');
      if (screenId === 'history') return this.play('history');
      if (['route', 'combat', 'reward'].includes(screenId)) return this.playStage(context.stage);
      return false;
    }

    playEnding() { return this.play('ending', { force: true }); }

    toggle() {
      const activePlayer = this.players[this.activeIndex];
      if (this.enabled && (!this.isTransportPlaying() || activePlayer?.muted)) {
        this.unlocked = true;
        if (this.pendingKey) this.play(this.pendingKey, { force: true, immediate: true });
        this.updateToggle();
        return true;
      }
      this.enabled = !this.enabled;
      try { this.storage?.setItem(STORAGE_KEY, this.enabled ? '1' : '0'); } catch (_) {}
      if (!this.enabled) {
        this.playRequestId++;
        if (this.fadeTimer) this.clearInterval?.(this.fadeTimer);
        this.fadeTimer = null;
        this.players.forEach(player => { player.pause(); player.volume = 0; });
        this.currentKey = null;
      } else {
        this.unlocked = true;
        if (this.pendingKey) this.play(this.pendingKey, { force: true, immediate: true });
      }
      this.updateToggle();
      return this.enabled;
    }

    setVolume(value) {
      this.masterVolume = Math.max(0, Math.min(1, Number(value) || 0));
      this.fadeTargetVolume = this.outputVolume();
      const activePlayer = this.players[this.activeIndex];
      if (activePlayer && !activePlayer.paused && !this.fadeTimer) activePlayer.volume = this.fadeTargetVolume;
      try { this.storage?.setItem(VOLUME_STORAGE_KEY, String(this.masterVolume)); } catch (_) {}
      this.updateVolumeUi();
      return this.masterVolume;
    }

    updateVolumeUi() {
      const percent = Math.round(this.masterVolume * 100);
      if (this.volumeElement && Number(this.volumeElement.value) !== percent) this.volumeElement.value = String(percent);
      if (this.volumeLabel) this.volumeLabel.textContent = `${percent}%`;
    }

    updateToggle(track = this.resolve(this.pendingKey || '') || this.resolve(this.currentKey || '')) {
      if (!this.toggleElement) return;
      const playing = this.enabled && this.isPlaying();
      this.toggleElement.textContent = !this.enabled ? '♫ BGM OFF' : playing ? '♫ BGM ON' : '♫ BGM 시작';
      this.toggleElement.setAttribute('aria-pressed', this.enabled ? 'true' : 'false');
      this.toggleElement.dataset.audioState = !this.enabled ? 'off' : playing ? 'playing' : 'waiting';
      this.toggleElement.title = this.lastError ? `재생 실패(${this.lastError}) · 눌러서 재시도` : track ? `현재 곡: ${track.name}` : '배경음악 켜기/끄기';
      const rootNode = this.document?.documentElement;
      if (rootNode) {
        rootNode.dataset.bgmState = !this.enabled ? 'off' : playing ? 'playing' : 'waiting';
        rootNode.dataset.bgmError = this.lastError || '';
        rootNode.dataset.bgmKey = this.currentKey || this.pendingKey || '';
        const active = this.players[this.activeIndex];
        rootNode.dataset.bgmMuted = String(Boolean(active?.muted));
        rootNode.dataset.bgmVolume = String(Number(active?.volume || 0));
      }
    }

    debugState() {
      const track = this.resolve(this.currentKey || this.pendingKey || '');
      const activePlayer = this.players[this.activeIndex] || null;
      return {
        enabled: this.enabled,
        unlocked: this.unlocked,
        currentKey: this.currentKey,
        pendingKey: this.pendingKey,
        lastError: this.lastError,
        trackName: track?.name || null,
        activeSrc: activePlayer?.src || '',
        paused: activePlayer?.paused ?? true,
        volume: Number(activePlayer?.volume || 0),
        audible: Boolean(activePlayer && !activePlayer.paused && !activePlayer.muted && Number(activePlayer.volume) > 0),
        muted: Boolean(activePlayer?.muted),
        masterVolume: this.masterVolume,
        outputGainBoost: OUTPUT_GAIN_BOOST,
      };
    }
  }

  const director = new AudioDirector();
  const api = {
    ROOT,
    OUTPUT_GAIN_BOOST,
    TRACKS,
    STAGE_TRACKS,
    META_TRACK_KEYS,
    AudioDirector,
    stageTrackIndex,
    initialize: elements => director.initialize(elements),
    playTitleAutoplay: () => director.playTitleAutoplay(),
    playScreen: (screenId, context) => director.playScreen(screenId, context),
    playMetaTab: tabId => director.playMetaTab(tabId),
    playEnding: () => director.playEnding(),
    toggle: () => director.toggle(),
    setVolume: value => director.setVolume(value),
    debugState: () => director.debugState(),
  };

  root.TRIAD_AUDIO = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
