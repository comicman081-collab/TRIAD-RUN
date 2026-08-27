(function attachTriadCombatSfx(root) {
  'use strict';

  const ROOT = 'assets/audio/sfx/combat/';
  const CACHE_VERSION = '1.4.0-public-cc0-cinematic';
  const frozenFiles = (...names) => Object.freeze(names);
  const CATALOG = Object.freeze({
    weaponWhoosh: frozenFiles('weapon_whoosh_01.wav', 'weapon_whoosh_02.wav', 'weapon_whoosh_03.wav'),
    magicCast: frozenFiles('magic_cast_01.wav', 'magic_cast_02.wav', 'magic_cast_03.wav'),
    impactLight: frozenFiles('impact_light_01.wav', 'impact_light_02.wav', 'impact_light_03.wav', 'impact_light_04.wav'),
    impactHeavy: frozenFiles('impact_heavy_01.wav', 'impact_heavy_02.wav', 'impact_heavy_03.wav'),
    playerHitLight: frozenFiles('player_hit_light_01.wav', 'player_hit_light_02.wav', 'player_hit_light_03.wav'),
    playerHitHeavy: frozenFiles('player_hit_heavy_01.wav', 'player_hit_heavy_02.wav'),
    shieldRise: frozenFiles('shield_rise_01.wav', 'shield_rise_02.wav'),
    shieldBlock: frozenFiles('shield_block_01.wav', 'shield_block_02.wav', 'shield_block_03.wav'),
    ultimateCharge: frozenFiles('ultimate_charge_01.wav', 'ultimate_charge_02.wav'),
    ultimateImpact: frozenFiles('ultimate_impact_01.wav', 'ultimate_impact_02.wav'),
    healWave: frozenFiles('heal_wave_01.wav', 'heal_wave_02.wav'),
    utilityPulse: frozenFiles('utility_pulse_01.wav', 'utility_pulse_02.wav'),
    rewardClaim: frozenFiles('reward_claim_01.wav', 'reward_claim_02.wav'),
    pistolFire: frozenFiles('reference/SFX_WPN_PISTOL_FIRE_001/SFX_WPN_PISTOL_FIRE_001_A.wav', 'reference/SFX_WPN_PISTOL_FIRE_001/SFX_WPN_PISTOL_FIRE_001_B.wav', 'reference/SFX_WPN_PISTOL_FIRE_001/SFX_WPN_PISTOL_FIRE_001_C.wav'),
    rifleFire: frozenFiles('reference/SFX_WPN_RIFLE_FIRE_001/SFX_WPN_RIFLE_FIRE_001_A.wav', 'reference/SFX_WPN_RIFLE_FIRE_001/SFX_WPN_RIFLE_FIRE_001_B.wav', 'reference/SFX_WPN_RIFLE_FIRE_001/SFX_WPN_RIFLE_FIRE_001_C.wav'),
    burstRifleFire: frozenFiles('reference/SFX_WPN_BURST_RIFLE_FIRE_001/SFX_WPN_BURST_RIFLE_FIRE_001_A.wav', 'reference/SFX_WPN_BURST_RIFLE_FIRE_001/SFX_WPN_BURST_RIFLE_FIRE_001_B.wav', 'reference/SFX_WPN_BURST_RIFLE_FIRE_001/SFX_WPN_BURST_RIFLE_FIRE_001_C.wav'),
    machineGunFire: frozenFiles('reference/SFX_WPN_MACHINEGUN_FIRE_001/SFX_WPN_MACHINEGUN_FIRE_001_A.wav', 'reference/SFX_WPN_MACHINEGUN_FIRE_001/SFX_WPN_MACHINEGUN_FIRE_001_B.wav', 'reference/SFX_WPN_MACHINEGUN_FIRE_001/SFX_WPN_MACHINEGUN_FIRE_001_C.wav'),
    shotgunFire: frozenFiles('reference/SFX_WPN_SHOTGUN_FIRE_001/SFX_WPN_SHOTGUN_FIRE_001_A.wav', 'reference/SFX_WPN_SHOTGUN_FIRE_001/SFX_WPN_SHOTGUN_FIRE_001_B.wav', 'reference/SFX_WPN_SHOTGUN_FIRE_001/SFX_WPN_SHOTGUN_FIRE_001_C.wav'),
    heavyCannonFire: frozenFiles('reference/SFX_WPN_HEAVY_CANNON_FIRE_001/SFX_WPN_HEAVY_CANNON_FIRE_001_A.wav', 'reference/SFX_WPN_HEAVY_CANNON_FIRE_001/SFX_WPN_HEAVY_CANNON_FIRE_001_B.wav', 'reference/SFX_WPN_HEAVY_CANNON_FIRE_001/SFX_WPN_HEAVY_CANNON_FIRE_001_C.wav'),
    bulletFlyby: frozenFiles('reference/SFX_PRJ_BULLET_FLYBY_001/SFX_PRJ_BULLET_FLYBY_001_A.wav', 'reference/SFX_PRJ_BULLET_FLYBY_001/SFX_PRJ_BULLET_FLYBY_001_B.wav', 'reference/SFX_PRJ_BULLET_FLYBY_001/SFX_PRJ_BULLET_FLYBY_001_C.wav'),
    impactMetalRef: frozenFiles('reference/SFX_IMPACT_METAL_001/SFX_IMPACT_METAL_001_A.wav', 'reference/SFX_IMPACT_METAL_001/SFX_IMPACT_METAL_001_B.wav', 'reference/SFX_IMPACT_METAL_001/SFX_IMPACT_METAL_001_C.wav'),
    impactHeavyRef: frozenFiles('reference/SFX_IMPACT_HEAVY_001/SFX_IMPACT_HEAVY_001_A.wav', 'reference/SFX_IMPACT_HEAVY_001/SFX_IMPACT_HEAVY_001_B.wav', 'reference/SFX_IMPACT_HEAVY_001/SFX_IMPACT_HEAVY_001_C.wav'),
    impactArmorRef: frozenFiles('reference/SFX_IMPACT_ARMOR_001/SFX_IMPACT_ARMOR_001_A.wav', 'reference/SFX_IMPACT_ARMOR_001/SFX_IMPACT_ARMOR_001_B.wav', 'reference/SFX_IMPACT_ARMOR_001/SFX_IMPACT_ARMOR_001_C.wav'),
    impactShieldRef: frozenFiles('reference/SFX_IMPACT_SHIELD_001/SFX_IMPACT_SHIELD_001_A.wav', 'reference/SFX_IMPACT_SHIELD_001/SFX_IMPACT_SHIELD_001_B.wav', 'reference/SFX_IMPACT_SHIELD_001/SFX_IMPACT_SHIELD_001_C.wav'),
    explosionMedium: frozenFiles('reference/SFX_EXP_MEDIUM_EXPLOSION_001/SFX_EXP_MEDIUM_EXPLOSION_001_A.wav', 'reference/SFX_EXP_MEDIUM_EXPLOSION_001/SFX_EXP_MEDIUM_EXPLOSION_001_B.wav', 'reference/SFX_EXP_MEDIUM_EXPLOSION_001/SFX_EXP_MEDIUM_EXPLOSION_001_C.wav'),
    explosionLarge: frozenFiles('reference/SFX_EXP_LARGE_EXPLOSION_001/SFX_EXP_LARGE_EXPLOSION_001_A.wav', 'reference/SFX_EXP_LARGE_EXPLOSION_001/SFX_EXP_LARGE_EXPLOSION_001_B.wav', 'reference/SFX_EXP_LARGE_EXPLOSION_001/SFX_EXP_LARGE_EXPLOSION_001_C.wav'),
    explosionMechanical: frozenFiles('reference/SFX_EXP_MECHANICAL_EXPLOSION_001/SFX_EXP_MECHANICAL_EXPLOSION_001_A.wav', 'reference/SFX_EXP_MECHANICAL_EXPLOSION_001/SFX_EXP_MECHANICAL_EXPLOSION_001_B.wav', 'reference/SFX_EXP_MECHANICAL_EXPLOSION_001/SFX_EXP_MECHANICAL_EXPLOSION_001_C.wav'),
  });
  const REFERENCE_KEYS = Object.freeze(['pistolFire', 'rifleFire', 'burstRifleFire', 'machineGunFire', 'shotgunFire', 'heavyCannonFire', 'bulletFlyby', 'impactMetalRef', 'impactHeavyRef', 'impactArmorRef', 'impactShieldRef', 'explosionMedium', 'explosionLarge', 'explosionMechanical']);

  const RHYTHMS = Object.freeze({
    single: frozenFiles(0),
    double: frozenFiles(0, 148),
    flurry: frozenFiles(0, 92, 205),
    volley: frozenFiles(0, 96, 214),
    burst: frozenFiles(0, 62, 126, 205, 290, 392),
  });
  const RATE_PATTERN = Object.freeze([0.97, 1.025, 0.985, 1.055, 0.95, 1.01, 0.975, 1.04]);
  const SUPPORT = new Set(['guard', 'counter', 'bastion']);
  const HEAL = new Set(['heal', 'renewal']);
  const UTILITY = new Set(['focus', 'battery']);
  const PHYSICAL = new Set(['strike', 'quick', 'heavy', 'burst', 'combo', 'counter', 'execute', 'volley', 'bastion', 'ambush']);
  const MAGIC = new Set(['mark', 'dot', 'scale', 'inferno', 'overload']);
  const HEAVY_CARDS = new Set(['heavy', 'execute', 'scale', 'inferno', 'overload']);
  const PROJECTILE_CARDS = new Set(['quick', 'dot', 'burst', 'volley']);
  const RECORDED_BURST_FAMILIES = new Set(['burstRifleFire', 'machineGunFire']);
  const PHYSICAL_SIGNATURE_OWNERS = new Set(['VOLT', 'AEGIS', 'SHADE']);
  const HEAVY_ARCHETYPES = new Set(['BRUTE', 'SENTINEL', 'COLOSSUS', 'SOVEREIGN']);
  const MAGIC_ARCHETYPES = new Set(['CASTER', 'WEAVER', 'SENTINEL', 'APOSTLE', 'OVERMIND', 'SOVEREIGN']);
  const FLURRY_SKILLS = new Set(['FLURRY', 'SURGE', 'REND', 'FRENZY', 'CROSS', 'SYNAPSE', 'END']);
  const HEAVY_SKILLS = new Set(['BASH', 'CLUB', 'CRUSH', 'FIST', 'QUAKE', 'JUDGMENT', 'COLLAPSE']);
  const MAGIC_SKILLS = new Set(['WAVE', 'BOLT', 'SURGE', 'WEB', 'PULSE', 'EDICT', 'JUDGMENT', 'SYNAPSE', 'DOMINION', 'COLLAPSE']);
  const FIREARM_SKILLS = new Set(['SHOT', 'VOLLEY']);
  const ARCHETYPE_BY_CATALOG = Object.freeze(['SCOUT', 'HOUND', 'WARDEN', 'CASTER', 'HUNTER', 'BRUTE', 'WEAVER', 'RAVAGER', 'SENTINEL', 'VANGUARD', 'REAPER', 'COLOSSUS', 'APOSTLE', 'OVERMIND', 'SOVEREIGN']);
  const POOL_VOICES = Object.freeze({ impactLight: 8, playerHitLight: 8, shieldBlock: 6, impactHeavy: 5, playerHitHeavy: 5, pistolFire: 3, rifleFire: 3, burstRifleFire: 3, machineGunFire: 3, shotgunFire: 3, heavyCannonFire: 3, bulletFlyby: 3, impactMetalRef: 5, impactHeavyRef: 4, impactArmorRef: 5, impactShieldRef: 5, explosionMedium: 3, explosionLarge: 2, explosionMechanical: 2 });
  const STORAGE_KEY = 'triad_bgm_volume';
  const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAgICA';

  function normalizeCardKey(card) { return String(card?.pattern?.key || card?.key || '').toLowerCase(); }
  function assetUrl(file) { return `${ROOT}${file}?v=${CACHE_VERSION}`; }

  function cardFirearmKey(key) {
    if (key === 'quick' || key === 'ambush') return 'pistolFire';
    if (key === 'strike' || key === 'combo') return 'rifleFire';
    if (key === 'burst') return 'machineGunFire';
    if (key === 'volley') return 'burstRifleFire';
    if (key === 'heavy') return 'shotgunFire';
    if (key === 'execute') return 'heavyCannonFire';
    return '';
  }

  function resolveDamageType(card, context = {}) {
    const explicit = String(context.damageType || '').toLowerCase();
    if (explicit === 'physical' || explicit === 'magic' || explicit === 'utility') return explicit;
    const key = normalizeCardKey(card);
    if (PHYSICAL.has(key)) return 'physical';
    if (MAGIC.has(key)) return 'magic';
    if (key === 'signature') return PHYSICAL_SIGNATURE_OWNERS.has(String(card?.owner || '').toUpperCase()) ? 'physical' : 'magic';
    return 'utility';
  }

  function resolveEnemyArchetype(enemy = {}) {
    const direct = String(enemy.archetypeKey || enemy.data?.archetypeKey || '').toUpperCase();
    if (direct) return direct;
    const id = String(enemy.id || enemy.data?.id || '').toUpperCase();
    const match = id.match(/_(SCOUT|HOUND|WARDEN|CASTER|HUNTER|BRUTE|WEAVER|RAVAGER|SENTINEL|VANGUARD|REAPER|COLOSSUS|APOSTLE|OVERMIND|SOVEREIGN)_/);
    if (match) return match[1];
    const catalogNo = Number(enemy.catalogNo || enemy.data?.catalogNo);
    return ARCHETYPE_BY_CATALOG[Math.max(0, Math.min(ARCHETYPE_BY_CATALOG.length - 1, (catalogNo || 1) - 1))] || 'SCOUT';
  }

  function skillToken(skillId) {
    const parts = String(skillId || '').toUpperCase().split('_').filter(Boolean);
    return parts.at(-1) || '';
  }

  function resolveEnemyStyle(context = {}) {
    const enemy = context.enemy || {};
    const archetype = resolveEnemyArchetype(enemy);
    const skill = skillToken(context.skillId);
    const rank = String(enemy.rank || enemy.data?.rank || '').toLowerCase();
    const flurry = FLURRY_SKILLS.has(skill);
    const heavy = rank === 'boss' || HEAVY_ARCHETYPES.has(archetype) || HEAVY_SKILLS.has(skill);
    const magic = MAGIC_ARCHETYPES.has(archetype) || MAGIC_SKILLS.has(skill);
    return Object.freeze({ archetype, skill, rank, flurry, heavy, magic });
  }

  function hitOffsets(patternKey, hits) {
    const count = Math.max(1, Math.min(8, Math.floor(Number(hits) || 1)));
    const key = String(patternKey || '').toLowerCase();
    let source = key === 'burst' ? RHYTHMS.burst : key === 'volley' ? RHYTHMS.volley : key === 'flurry' ? RHYTHMS.flurry : count === 2 ? RHYTHMS.double : count > 2 ? RHYTHMS.flurry : RHYTHMS.single;
    const result = [...source];
    while (result.length < count) result.push((result.at(-1) || 0) + (key === 'burst' ? 96 : 112));
    return result.slice(0, count);
  }

  function cardImpactDelay(key, context = {}) {
    if (Number.isFinite(Number(context.impactDelay))) return Math.max(0, Number(context.impactDelay));
    if (key === 'signature') return 420;
    if (PROJECTILE_CARDS.has(key)) return 520;
    if (HEAVY_CARDS.has(key)) return 250;
    if (key === 'inferno' || key === 'ambush') return 280;
    return 160;
  }

  class CombatSfxDirector {
    constructor(options = {}) {
      this.AudioCtor = options.AudioCtor || root.Audio;
      this.storage = options.storage || root.localStorage;
      this.document = options.document || root.document;
      this.setTimeout = options.setTimeout || root.setTimeout?.bind(root);
      this.masterVolume = this.readVolume();
      this.variantCursor = Object.create(null);
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
      const count = POOL_VOICES[key] || 4;
      const variants = (CATALOG[key] || []).map(file => ({
        file,
        voices: Array.from({ length: count }, () => {
          const audio = new this.AudioCtor(assetUrl(file));
          audio.preload = 'auto'; audio.playsInline = true;
          if (typeof audio.load === 'function') audio.load();
          return audio;
        }),
      }));
      this.pools.set(key, variants);
    }

    remember(event) {
      this.debugLog.push(event);
      this.debugLog = this.debugLog.slice(-120);
      return event;
    }

    playNow(key, options = {}, scheduledEvent = null) {
      this.preload(key);
      const variants = this.pools.get(key) || [];
      if (!variants.length) return false;
      const requestedVariant = Number(options.variant);
      let variantIndex;
      if (Number.isInteger(requestedVariant)) variantIndex = ((requestedVariant % variants.length) + variants.length) % variants.length;
      else {
        variantIndex = (this.variantCursor[key] || 0) % variants.length;
        this.variantCursor[key] = variantIndex + 1;
      }
      const variant = variants[variantIndex];
      const voiceKey = `${key}:${variantIndex}`;
      const voiceIndex = (this.voiceCursor[voiceKey] || 0) % variant.voices.length;
      this.voiceCursor[voiceKey] = voiceIndex + 1;
      const audio = variant.voices[voiceIndex];
      audio.pause(); audio.currentTime = 0;
      audio.playbackRate = Math.max(0.84, Math.min(1.18, Number(options.rate) || 1));
      const requestedVolume = Number.isFinite(Number(options.volume)) ? Number(options.volume) : 1;
      audio.volume = Math.max(0, Math.min(1, requestedVolume * this.masterVolume));
      const event = scheduledEvent || this.remember({ key, delay: Number(options.scheduledDelay) || 0, status: 'requested', at: Date.now() });
      Object.assign(event, { key, file: variant.file, variant: variantIndex, voice: voiceIndex, rate: audio.playbackRate, volume: audio.volume, status: 'requested', playedAt: Date.now() });
      const rootNode = this.document?.documentElement;
      if (rootNode) {
        rootNode.dataset.lastCombatSfx = key;
        rootNode.dataset.lastCombatSfxFile = variant.file;
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

    play(key, options = {}) {
      const delay = Math.max(0, Number(options.delay) || 0);
      if (delay && this.setTimeout) {
        this.preload(key);
        if (!(this.pools.get(key) || []).length) return false;
        const event = this.remember({ key, file: '', delay, rate: Number(options.rate) || 1, volume: Number(options.volume) || 1, status: 'scheduled', at: Date.now() });
        this.setTimeout(() => this.playNow(key, { ...options, delay: 0, scheduledDelay: delay }, event), delay);
        return true;
      }
      return this.playNow(key, options);
    }

    playCard(card, context = {}) {
      const key = normalizeCardKey(card);
      if (HEAL.has(key)) {
        this.play('healWave', { volume: 0.72 });
        if (key === 'renewal') this.play('shieldRise', { delay: 180, volume: 0.56, rate: 1.02 });
        return true;
      }
      if (SUPPORT.has(key)) return this.play('shieldRise', { volume: 0.75, rate: 0.98 });
      if (UTILITY.has(key)) return this.play('utilityPulse', { volume: 0.64, rate: key === 'battery' ? 1.04 : 0.97 });

      const hits = Math.max(1, Math.min(8, Math.floor(Number(context.hits) || 1)));
      const delay = cardImpactDelay(key, context);
      const signature = key === 'signature';
      const damageType = resolveDamageType(card, context);
      if (signature) {
        this.play('ultimateCharge', { volume: 0.78, rate: 0.96 });
        if (Number(context.damage) > 0) {
          this.play('ultimateImpact', { delay, volume: 0.18, rate: 0.99 });
          this.play('explosionLarge', { delay, volume: 0.52, rate: 0.99 });
          this.play('impactHeavyRef', { delay, volume: 0.42, rate: 1 });
          if (context.defeated) this.play('explosionMechanical', { delay: delay + 34, volume: 0.42, rate: 0.99 });
        }
        const owner = String(card?.owner || '').toUpperCase();
        if (owner === 'BLOOM') this.play('healWave', { delay: delay + 130, volume: 0.48, rate: 0.94 });
        if (owner === 'AEGIS') this.play('shieldRise', { delay: delay + 105, volume: 0.55, rate: 0.91 });
        return true;
      }

      const firearmKey = damageType === 'physical' ? cardFirearmKey(key) : '';
      this.play(damageType === 'magic' ? 'magicCast' : firearmKey || 'weaponWhoosh', { volume: damageType === 'magic' ? 0.42 : firearmKey ? 0.58 : 0.34, rate: damageType === 'magic' ? 0.99 : 1 });
      if (PROJECTILE_CARDS.has(key)) this.play('bulletFlyby', { volume: damageType === 'physical' ? 0.24 : 0.18, rate: 1 });
      if (Number(context.damage) <= 0) return true;
      const impactKey = HEAVY_CARDS.has(key) ? 'impactHeavy' : 'impactLight';
      const offsets = hitOffsets(key, hits);
      if (firearmKey && !RECORDED_BURST_FAMILIES.has(firearmKey) && offsets.length > 1) offsets.slice(1).forEach((offset, index) => this.play(firearmKey, { delay: offset, volume: index === offsets.length - 2 ? 0.46 : 0.38, rate: Math.max(0.97, Math.min(1.03, RATE_PATTERN[(index + 1) % RATE_PATTERN.length])) }));
      const baseVolume = impactKey === 'impactHeavy' ? 0.11 : hits >= 4 ? 0.05 : hits >= 2 ? 0.07 : 0.09;
      offsets.forEach((offset, index) => this.play(impactKey, {
        delay: delay + offset,
        volume: baseVolume,
        rate: Math.max(0.97, Math.min(1.03, RATE_PATTERN[index % RATE_PATTERN.length])),
      }));
      offsets.forEach((offset, index) => {
        const finalHit = index === offsets.length - 1;
        const referenceKey = HEAVY_CARDS.has(key) ? 'impactHeavyRef' : damageType === 'physical' ? 'impactMetalRef' : 'impactArmorRef';
        this.play(referenceKey, { delay: delay + offset, volume: HEAVY_CARDS.has(key) ? 0.56 : hits > 2 ? 0.40 : 0.52, rate: Math.max(0.97, Math.min(1.03, RATE_PATTERN[index % RATE_PATTERN.length])) });
        if (HEAVY_CARDS.has(key) && finalHit) this.play('explosionMedium', { delay: delay + offset + 12, volume: 0.34, rate: 0.99 });
        if (context.defeated && finalHit) this.play('explosionMechanical', { delay: delay + offset + 34, volume: 0.44, rate: 1 });
      });
      return true;
    }

    playEnemy(context = {}) {
      const style = resolveEnemyStyle(context);
      const hits = Math.max(1, Math.min(8, Math.floor(Number(context.hits) || 1)));
      const impactDelay = Number.isFinite(Number(context.impactDelay)) ? Math.max(0, Number(context.impactDelay)) : style.heavy ? 360 : style.magic ? 520 : 420;
      const firearm = FIREARM_SKILLS.has(style.skill) || (style.flurry && !style.magic);
      const attackKey = style.rank === 'boss' ? 'ultimateCharge' : firearm ? style.skill === 'SHOT' ? 'rifleFire' : 'machineGunFire' : style.magic ? 'magicCast' : 'weaponWhoosh';
      this.play(attackKey, { volume: style.rank === 'boss' ? 0.60 : firearm ? 0.58 : style.heavy ? 0.38 : 0.34, rate: style.heavy ? 0.97 : style.magic ? 0.99 : 1 });
      if (firearm) this.play('bulletFlyby', { volume: 0.24, rate: 1 });
      const offsets = hitOffsets(style.flurry ? 'flurry' : '', hits);
      offsets.forEach((offset, index) => {
        const blocked = Number(context.results?.[index]?.blocked) > 0;
        const hitKey = blocked ? 'shieldBlock' : style.heavy ? 'playerHitHeavy' : 'playerHitLight';
        const finalHit = index === offsets.length - 1;
        const baseVolume = blocked ? 0.07 : style.heavy ? 0.10 : 0.07;
        const rate = Math.max(0.97, Math.min(1.03, RATE_PATTERN[index % RATE_PATTERN.length]));
        this.play(hitKey, { delay: impactDelay + offset, volume: baseVolume, rate });
        this.play(blocked ? 'impactShieldRef' : style.heavy ? 'impactHeavyRef' : 'impactArmorRef', { delay: impactDelay + offset, volume: blocked ? 0.60 : style.heavy ? 0.56 : hits > 1 ? 0.42 : 0.54, rate });
        if (style.heavy && finalHit) this.play('explosionMedium', { delay: impactDelay + offset + 12, volume: 0.32, rate: 0.99 });
        if (style.rank === 'boss' && finalHit) this.play('explosionLarge', { delay: impactDelay + offset + 20, volume: 0.42, rate: 0.99 });
      });
      return true;
    }

    reward() { return this.play('rewardClaim', { volume: 0.72 }); }

    debugState() {
      return {
        root: ROOT,
        cacheVersion: CACHE_VERSION,
        masterVolume: this.masterVolume,
        unlocked: this.unlocked,
        playSuccessCount: this.playSuccessCount,
        playErrorCount: this.playErrorCount,
        catalog: CATALOG,
        rhythms: RHYTHMS,
        log: [...this.debugLog],
      };
    }
  }

  const director = new CombatSfxDirector();
  const api = Object.freeze({
    ROOT, CACHE_VERSION, CATALOG, REFERENCE_KEYS, RHYTHMS, CombatSfxDirector, resolveDamageType, resolveEnemyArchetype, resolveEnemyStyle, hitOffsets, cardFirearmKey,
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
