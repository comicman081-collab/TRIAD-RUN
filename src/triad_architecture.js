/* TRIAD // RUN architecture adapter: deterministic, offline, and UI-agnostic. */
(function attachTriadArchitecture(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TRIAD_ARCH = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function triadArchitectureFactory() {
  'use strict';

  const SAVE_VERSION = 2;
  const RNG_ALGORITHM = 'mulberry32-v1';
  const TEAM = Object.freeze({ PLAYER: 'PLAYER', ENEMY: 'ENEMY' });
  const SCOPE = Object.freeze({ SINGLE: 'SINGLE', ALL: 'ALL' });
  const SELECTOR = Object.freeze({ SELF: 'SELF', EXPLICIT: 'EXPLICIT', FIRST: 'FIRST', RANDOM: 'RANDOM', LOWEST_HP: 'LOWEST_HP' });
  const EFFECT_TYPES = Object.freeze(['DAMAGE', 'SHIELD', 'HEAL', 'DRAW', 'DISCARD', 'APPLY_STATUS', 'REMOVE_STATUS', 'MODIFY_ENERGY', 'MULTI_HIT', 'CONDITIONAL', 'CHAIN', 'RANDOM_TARGET', 'SCALE', 'REPEAT', 'SCHEDULE']);
  const ALLOWED_PHASES = Object.freeze(['PLAYER_START', 'PLAYER', 'ENEMY', 'TURN_END']);

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const asUInt = value => (Number(value) >>> 0) || 0x6d2b79f5;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

  class SeededRng {
    constructor(seed, state) {
      this.state = asUInt(state == null ? seed : state);
    }

    nextUint32() {
      let value = this.state += 0x6D2B79F5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return (value ^ value >>> 14) >>> 0;
    }

    next() {
      return this.nextUint32() / 4294967296;
    }

    int(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new Error('RNG maxExclusive must be a positive integer');
      return Math.floor(this.next() * maxExclusive);
    }

    snapshot() {
      return this.state >>> 0;
    }
  }

  function seedFromEntropy() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return asUInt(values[0]);
    }
    return asUInt((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  }

  function ensureRng(context) {
    if (!isObject(context)) throw new Error('Deterministic RNG requires a run or setup context');
    if (!context.__triadRng) {
      Object.defineProperty(context, '__triadRng', {
        configurable: true,
        enumerable: false,
        value: new SeededRng(context.seed, context.rngState)
      });
    }
    return context.__triadRng;
  }

  function random(context) {
    const rng = ensureRng(context);
    const value = rng.next();
    context.rngAlgorithm = RNG_ALGORITHM;
    context.rngState = rng.snapshot();
    context.rngCursor = Number.isSafeInteger(context.rngCursor) && context.rngCursor >= 0
      ? context.rngCursor + 1
      : 1;
    return value;
  }

  function pick(context, values) {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    return values[Math.floor(random(context) * values.length)];
  }

  function shuffle(context, values) {
    const result = Array.isArray(values) ? values.slice() : [];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random(context) * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function uid() {
    return `triad-${seedFromEntropy().toString(36)}-${Date.now().toString(36)}`;
  }

  function validationError(code, message, path) {
    return { code, message, path: path || '' };
  }

  function validateTargetSpec(spec, path = 'target') {
    const errors = [];
    if (!isObject(spec)) return [validationError('TARGET_REQUIRED', 'TargetSpec must be an object', path)];
    if (!Object.values(TEAM).includes(spec.sourceTeam)) errors.push(validationError('INVALID_SOURCE_TEAM', 'sourceTeam must be PLAYER or ENEMY', `${path}.sourceTeam`));
    if (!Object.values(TEAM).includes(spec.targetTeam)) errors.push(validationError('INVALID_TARGET_TEAM', 'targetTeam must be PLAYER or ENEMY', `${path}.targetTeam`));
    if (!Object.values(SCOPE).includes(spec.scope)) errors.push(validationError('INVALID_SCOPE', 'scope must be SINGLE or ALL', `${path}.scope`));
    if (!Object.values(SELECTOR).includes(spec.selector)) errors.push(validationError('INVALID_SELECTOR', 'selector is not supported', `${path}.selector`));
    if (spec.scope === SCOPE.ALL && spec.selector === SELECTOR.EXPLICIT) errors.push(validationError('INVALID_TARGET_COMBINATION', 'ALL scope cannot use EXPLICIT selector', path));
    if (spec.selector === SELECTOR.SELF && spec.sourceTeam !== spec.targetTeam) errors.push(validationError('INVALID_SELF_TARGET', 'SELF must target the source team', path));
    if (spec.count != null && (!Number.isInteger(spec.count) || spec.count < 1)) errors.push(validationError('INVALID_TARGET_COUNT', 'count must be a positive integer', `${path}.count`));
    return errors;
  }

  function living(units, allowDead) {
    return (Array.isArray(units) ? units : []).filter(unit => allowDead || Number(unit.hp) > 0);
  }

  function resolveTargets(state, spec) {
    const errors = validateTargetSpec(spec);
    if (errors.length) throw new Error(errors.map(error => error.code).join(', '));
    const source = state && state.source;
    const pools = state && state.teams;
    const candidates = living(pools && pools[spec.targetTeam], Boolean(spec.allowDead));
    if (spec.selector === SELECTOR.SELF) return source && source.team === spec.targetTeam ? [source] : [];
    if (spec.scope === SCOPE.ALL) return candidates;
    let selected;
    if (spec.selector === SELECTOR.EXPLICIT) selected = candidates.find(unit => unit.id === spec.explicitTargetId);
    else if (spec.selector === SELECTOR.FIRST) selected = candidates[0];
    else if (spec.selector === SELECTOR.LOWEST_HP) selected = candidates.slice().sort((left, right) => (left.hp / Math.max(1, left.maxHp || left.hp)) - (right.hp / Math.max(1, right.maxHp || right.hp)) || String(left.id).localeCompare(String(right.id)))[0];
    else if (spec.selector === SELECTOR.RANDOM) {
      if (!state || !state.rngContext) throw new Error('Random target resolution requires rngContext');
      selected = pick(state.rngContext, candidates);
    }
    if (!selected) return [];
    if (spec.allowSelf === false && source && selected.id === source.id) return [];
    return [selected];
  }

  class EffectRegistry {
    constructor() {
      this.handlers = new Map();
    }

    register(type, handler) {
      if (!EFFECT_TYPES.includes(type)) throw new Error(`Unsupported TRIAD effect type: ${type}`);
      if (typeof handler !== 'function') throw new Error(`Effect handler must be a function: ${type}`);
      this.handlers.set(type, handler);
      return this;
    }

    has(type) {
      return this.handlers.has(type);
    }

    resolve(effect, context) {
      const errors = validateEffectSpec(effect, this);
      if (errors.length) throw new Error(errors.map(error => `${error.path}:${error.code}`).join(', '));
      return this.handlers.get(effect.type)(effect, context);
    }
  }

  function validateEffectSpec(effect, registry, path = 'effect') {
    const errors = [];
    if (!isObject(effect)) return [validationError('EFFECT_REQUIRED', 'EffectSpec must be an object', path)];
    if (!EFFECT_TYPES.includes(effect.type)) errors.push(validationError('INVALID_EFFECT', 'Unknown effect type', `${path}.type`));
    if (registry && effect.type && !registry.has(effect.type)) errors.push(validationError('UNREGISTERED_EFFECT', 'Effect type is not registered', `${path}.type`));
    if (effect.target) errors.push(...validateTargetSpec(effect.target, `${path}.target`));
    if (effect.amount != null && (!isFiniteNumber(effect.amount) || effect.amount < 0)) errors.push(validationError('INVALID_EFFECT_AMOUNT', 'amount must be a non-negative finite number', `${path}.amount`));
    if (effect.type === 'SCHEDULE' && !isObject(effect.resolvedEffect)) errors.push(validationError('SCHEDULED_EFFECT_REQUIRED', 'SCHEDULE must contain resolvedEffect', `${path}.resolvedEffect`));
    return errors;
  }

  function addCombatLog(run, kind, payload = {}) {
    if (!isObject(run)) return null;
    run.combatLog = Array.isArray(run.combatLog) ? run.combatLog : [];
    const record = {
      sequence: run.combatLog.length + 1,
      seed: run.seed,
      stage: run.stage,
      turn: run.combat && run.combat.turn || 0,
      phase: run.combat ? 'COMBAT' : 'ROUTE',
      rngState: run.rngState,
      kind,
      ...clone(payload)
    };
    run.combatLog.push(record);
    return record;
  }

  function makeScheduledEffect(input) {
    if (!isObject(input) || !Number.isInteger(input.executeAtTurn) || input.executeAtTurn < 1 || !ALLOWED_PHASES.includes(input.executeAtPhase) || !isObject(input.resolvedEffect)) {
      throw new Error('Invalid ScheduledEffect');
    }
    if (input.resolvedEffect.type === 'SCHEDULE') throw new Error('ScheduledEffect resolvedEffect cannot itself be SCHEDULE');
    return {
      id: input.id || uid(),
      executeAtTurn: input.executeAtTurn,
      executeAtPhase: input.executeAtPhase,
      resolvedEffect: clone(input.resolvedEffect),
      sourceId: String(input.sourceId || ''),
      targetSpec: clone(input.targetSpec || null),
      payload: clone(input.payload || {})
    };
  }

  function scheduleEffect(run, input) {
    if (!isObject(run)) throw new Error('Cannot schedule without a run');
    run.scheduledEffects = Array.isArray(run.scheduledEffects) ? run.scheduledEffects : [];
    const scheduled = makeScheduledEffect(input);
    run.scheduledEffects.push(scheduled);
    addCombatLog(run, 'SCHEDULED_EFFECT', { scheduledEffectId: scheduled.id, executeAtTurn: scheduled.executeAtTurn, executeAtPhase: scheduled.executeAtPhase, sourceId: scheduled.sourceId });
    return scheduled;
  }

  function executeScheduledEffects(run, turn, phase, resolver) {
    if (!isObject(run) || !Array.isArray(run.scheduledEffects)) return [];
    const due = run.scheduledEffects.filter(effect => effect.executeAtTurn === turn && effect.executeAtPhase === phase);
    run.scheduledEffects = run.scheduledEffects.filter(effect => !due.includes(effect));
    for (const scheduled of due) {
      resolver(clone(scheduled.resolvedEffect), scheduled);
      addCombatLog(run, 'SCHEDULED_EFFECT_EXECUTED', { scheduledEffectId: scheduled.id, sourceId: scheduled.sourceId });
    }
    return due;
  }

  function battleSnapshot(run, gameVersion = 'TRIAD_RUN_V0_8') {
    if (!isObject(run)) throw new Error('BattleSnapshot requires a run');
    return {
      gameVersion,
      dataVersion: run.dataVersion || 'TRIAD_RUNTIME_V0_8',
      saveVersion: run.saveVersion || 1,
      seed: run.seed,
      stage: run.stage,
      party: clone(run.party || []),
      deck: clone(run.deck || []),
      drawPile: clone(run.combat && run.combat.draw || []),
      discardPile: clone(run.combat && run.combat.discard || []),
      hand: clone(run.combat && run.combat.hand || []),
      artifacts: clone(run.artifacts || []),
      enemyState: clone(run.combat && run.combat.enemy || null),
      turn: run.combat && run.combat.turn || 0,
      phase: run.combat ? 'COMBAT' : 'ROUTE',
      rngAlgorithm: run.rngAlgorithm || RNG_ALGORITHM,
      rngState: run.rngState,
      rngCursor: Number.isSafeInteger(run.rngCursor) ? run.rngCursor : 0,
      scheduledEffects: clone(run.scheduledEffects || [])
    };
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }

  function hash(value) {
    const input = stableStringify(value);
    let result = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      result ^= input.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (`00000000${(result >>> 0).toString(16)}`).slice(-8);
  }

  function migrateSave(input) {
    if (!isObject(input)) throw new Error('SaveSpec must be an object');
    const save = clone(input);
    const fromVersion = Number.isInteger(save.saveVersion) ? save.saveVersion : 1;
    if (fromVersion > SAVE_VERSION) throw new Error(`Unsupported future save version: ${fromVersion}`);
    if (!Number.isInteger(save.seed) || save.seed < 0) save.seed = asUInt(seedFromEntropy());
    if (fromVersion < 2) {
      save.rngAlgorithm = RNG_ALGORITHM;
      save.rngState = Number.isInteger(save.rngState) ? asUInt(save.rngState) : asUInt(save.seed);
      save.combatLog = Array.isArray(save.combatLog) ? save.combatLog : [];
      save.scheduledEffects = Array.isArray(save.scheduledEffects) ? save.scheduledEffects : [];
      save.dataVersion = save.dataVersion || 'TRIAD_RUNTIME_V0_8';
    }
    save.rngCursor = Number.isSafeInteger(save.rngCursor) && save.rngCursor >= 0 ? save.rngCursor : 0;
    save.saveVersion = SAVE_VERSION;
    return { save, fromVersion, migrated: fromVersion !== SAVE_VERSION };
  }

  function validateUnique(records, label, errors) {
    const seen = new Set();
    for (const [index, record] of (Array.isArray(records) ? records : []).entries()) {
      const id = record && record.id;
      if (!id) errors.push(validationError('MISSING_ID', `${label} is missing id`, `${label}[${index}]`));
      else if (seen.has(id)) errors.push(validationError('DUPLICATE_ID', `Duplicate ${label} id: ${id}`, `${label}[${index}].id`));
      else seen.add(id);
    }
    return seen;
  }

  function validateDatabase(database, registry) {
    const errors = [];
    const characters = Array.isArray(database.characters) ? database.characters : [];
    const cards = Array.isArray(database.cards) ? database.cards : [];
    const statuses = Array.isArray(database.statuses) ? database.statuses : [];
    const artifacts = Array.isArray(database.artifacts) ? database.artifacts : [];
    const enemies = Array.isArray(database.enemies) ? database.enemies : [];
    const bosses = Array.isArray(database.bosses) ? database.bosses : [];
    const events = Array.isArray(database.events) ? database.events : [];
    const characterIds = validateUnique(characters, 'characters', errors);
    validateUnique(cards, 'cards', errors);
    const statusIds = validateUnique(statuses, 'statuses', errors);
    validateUnique(artifacts, 'artifacts', errors);
    validateUnique(enemies, 'enemies', errors);
    validateUnique(bosses, 'bosses', errors);
    validateUnique(events, 'events', errors);
    cards.forEach((card, index) => {
      if (!characterIds.has(card.owner)) errors.push(validationError('INVALID_OWNER', `Unknown card owner: ${card.owner}`, `cards[${index}].owner`));
      if (!isFiniteNumber(card.cost) || card.cost < 0) errors.push(validationError('INVALID_COST', 'Card cost must be finite and non-negative', `cards[${index}].cost`));
      (card.effects || []).forEach((effect, effectIndex) => {
        errors.push(...validateEffectSpec(effect, registry, `cards[${index}].effects[${effectIndex}]`));
        if (effect.statusId && !statusIds.has(effect.statusId)) errors.push(validationError('INVALID_STATUS', `Unknown status: ${effect.statusId}`, `cards[${index}].effects[${effectIndex}].statusId`));
      });
    });
    return errors;
  }

  return Object.freeze({
    SAVE_VERSION, RNG_ALGORITHM, TEAM, SCOPE, SELECTOR, EFFECT_TYPES, SeededRng,
    seedFromEntropy, ensureRng, random, pick, shuffle, uid,
    validateTargetSpec, resolveTargets, EffectRegistry, validateEffectSpec,
    addCombatLog, makeScheduledEffect, scheduleEffect, executeScheduledEffects,
    battleSnapshot, stableStringify, hash, migrateSave, validateDatabase
  });
});
