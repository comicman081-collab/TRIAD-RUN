/* TRIAD // RUN combat engine.
 *
 * Every rule that changes a combat number lives here: card effects, statuses,
 * shields, enemy behaviour (intents, guard, buffs, debuffs, charge/break,
 * boss phases, enrage) and event-boss scoring.  The module is DOM-free and
 * deterministic: it only mutates the `run` object it is given and draws
 * randomness from the injected `random`/`shuffle` (the persisted run RNG).
 * The browser runtime keeps input fences and presentation; the balance
 * simulator, the tests and a future ranking server run this same code.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TRIAD_COMBAT_ENGINE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = 'combat-engine-1.0.1';

  const RULES = Object.freeze({
    baseEnergy: 3,
    openingDraw: 4,
    // Party defence lasts through one enemy action, then expires.
    shieldRetainArtifact: 0.5,
    // Enemy statuses.  Mark and shock no longer stack forever.
    markPerStack: 0.07,
    markCap: 10,
    markDecay: 1,
    burnDecay: 1,
    shockDecay: 0.5,
    shockBreakBonus: 0.05,
    // Party debuffs applied by enemies.
    weakMultiplier: 0.75,
    exposedMultiplier: 1.25,
    // Break: interrupting a charged attack stuns the enemy and exposes it.
    breakVulnerability: 1.3,
    breakPlayerTurns: 2,
    weaknessBreakMultiplier: 1.5,
    // Soft timer for long fights.
    enrageTurn: Object.freeze({ boss: 12, elite: 14 }),
    enragePerTurn: 0.12,
    hardEnrageShift: 2
  });

  // Enemy stat tuning over the authored catalogue (combat_data.js keeps the
  // catalogue values; this is the live balance layer).
  const TUNING = Object.freeze({
    rank: Object.freeze({
      normal: Object.freeze({ hp: 2.2, damage: 2.0 }),
      elite: Object.freeze({ hp: 1.5, damage: 1.6 }),
      boss: Object.freeze({ hp: 1.4, damage: 1.35 }),
      training: Object.freeze({ hp: 1, damage: 1 })
    }),
    // ACT 1 is the onboarding act for a fresh account; overflow acts use ACT 3.
    act: Object.freeze({
      1: Object.freeze({ hp: 0.88, damage: 0.85 }),
      2: Object.freeze({ hp: 1, damage: 1 }),
      3: Object.freeze({ hp: 1.05, damage: 1.05 })
    }),
    difficulty: Object.freeze({
      normal: Object.freeze({ hp: 1, damage: 1 }),
      hard: Object.freeze({ hp: 1.2, damage: 1.15 })
    })
  });

  // ---- enemy behaviour --------------------------------------------------
  // A step is one enemy action.  `skill` indexes the monster's two authored
  // skills (presentation keys off the skill id).  Riders on an attack:
  // guard (ratio of max HP), power (+damage), weak/exposed (turns),
  // lifesteal (ratio of HP damage), target ('random'|'lowest'|'strongest').
  const hit = (skill, options = {}) => Object.freeze({ kind: 'attack', skill, ...options });
  const guard = (ratio, options = {}) => Object.freeze({ kind: 'guard', guard: ratio, ...options });
  const buff = (power, options = {}) => Object.freeze({ kind: 'buff', power, ...options });
  const charge = (skill, mult, threshold, options = {}) => Object.freeze({ kind: 'charge', skill, mult, threshold, ...options });
  const phase = (at, steps, onEnter = null) => Object.freeze({ at, steps: Object.freeze(steps), onEnter: onEnter && Object.freeze(onEnter) });

  // Break thresholds are ratios of max HP sized to roughly one focused turn of
  // party damage for that rank (normal ~4 turns, elite ~6, boss ~8 per fight).
  const PROFILES = Object.freeze({
    TRAINING: [phase(1, [hit(0), hit(1)])],
    // ACT 1 - one twist each.
    SCOUT: [phase(1, [hit(1), hit(0, { target: 'lowest', exposed: 1, label: '약점 탐지' }), hit(0)])],
    HOUND: [phase(1, [hit(0, { target: 'lowest' }), hit(1, { target: 'lowest' }), buff(0.2, { label: '사냥 본능' })])],
    WARDEN: [phase(1, [hit(0, { guard: 0.16, label: '방패 태세' }), hit(1), hit(0)])],
    // ACT 2 - debuffs and the first breakable charges.
    CASTER: [phase(1, [hit(0), hit(1, { weak: 2, label: '마력 교란' }), charge(0, 1.8, 0.3)])],
    HUNTER: [phase(1, [hit(0, { target: 'strongest' }), hit(1, { exposed: 1 }), charge(0, 1.9, 0.28, { target: 'strongest', label: '저격 조준' })])],
    BRUTE: [phase(1, [hit(0), buff(0.25, { guard: 0.1, label: '분노 축적' }), hit(1)])],
    // ACT 3 - combined riders.
    WEAVER: [phase(1, [hit(0), hit(1, { weak: 1, label: '구속' }), hit(0, { guard: 0.12 })])],
    RAVAGER: [phase(1, [hit(0), hit(1), buff(0.2, { label: '광란' })])],
    SENTINEL: [phase(1, [hit(0, { guard: 0.12 }), charge(1, 1.8, 0.28), hit(0)])],
    // Elites - a breakable charge in every cycle.
    VANGUARD: [phase(1, [hit(1), charge(0, 1.9, 0.2, { label: '전선 붕괴' }), hit(0, { guard: 0.1 })])],
    REAPER: [phase(1, [hit(0, { target: 'lowest' }), hit(1, { lifesteal: 0.5, label: '생명 수확' }), charge(0, 1.9, 0.19)])],
    COLOSSUS: [phase(1, [hit(0, { guard: 0.1 }), charge(1, 1.8, 0.18), buff(0.2, { label: '거신의 분노' })])],
    // Bosses - two phases.
    APOSTLE: [
      phase(1, [hit(0, { target: 'lowest' }), hit(1), charge(0, 1.8, 0.15, { label: '파멸 선고' })]),
      phase(0.55, [hit(1, { weak: 1 }), charge(1, 1.6, 0.14), hit(0, { guard: 0.08 })], { power: 0.15, cleanse: 0.5, label: '심판의 날' })
    ],
    OVERMIND: [
      phase(1, [hit(0), hit(1, { weak: 2, label: '정신 교란' }), charge(0, 1.8, 0.14)]),
      phase(0.55, [hit(1, { exposed: 1 }), hit(0, { lifesteal: 0.4, label: '신경 흡수' }), charge(1, 1.7, 0.13)], { power: 0.15, cleanse: 0.5, label: '군집 각성' })
    ],
    SOVEREIGN: [
      phase(1, [hit(0), charge(1, 1.6, 0.13), hit(0, { guard: 0.08 }), buff(0.15, { label: '군주의 위엄' })]),
      phase(0.55, [hit(1, { weak: 1 }), hit(0, { exposed: 1 }), charge(0, 1.9, 0.13, { label: '종말 선고' })], { power: 0.2, cleanse: 0.5, label: '종말의 서곡' })
    ]
  });

  const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
  const noop = () => {};

  // ---- environment ------------------------------------------------------
  function env(options) {
    if (!options || !options.run) throw new Error('TRIAD combat engine requires a run');
    return {
      run: options.run,
      cards: options.cards || {},
      cardData: options.cardData,
      combatData: options.combatData,
      artifactDefs: options.artifactDefs || [],
      random: options.random || (() => 0.5),
      shuffle: options.shuffle || (values => values.slice()),
      log: options.log || noop,
      emit: options.emit || noop,
      baseEnergy: Number.isFinite(options.baseEnergy) ? options.baseEnergy : RULES.baseEnergy
    };
  }

  function hasArtifact(e, type) {
    const owned = e.run.artifacts || [];
    return owned.some(id => e.artifactDefs.find(artifact => artifact.id === id)?.type === type);
  }

  function combatOf(e) { return e.run.combat; }
  function alive(e) { return e.run.party.filter(member => member.hp > 0); }
  function memberStats(e, member) { return member?.stats || e.cardData.characterStats(member?.id, member?.breakthrough || 0); }

  // ---- card state helpers ---------------------------------------------
  function starFor(e, card, level = 1) {
    const owner = e.run.party.find(member => member.id === card.owner);
    return Math.max(0, Math.min(5, (Number(level) || 1) - 1 + (Number(owner?.breakthrough) || 0)));
  }
  function cardValue(e, card, level) { return e.cardData.value(card.pattern.key, starFor(e, card, level)); }
  function cardCost(e, card) {
    const c = combatOf(e);
    return c?.firstCard && hasArtifact(e, 'firstZero') ? 0 : card.cost;
  }
  function isPlayableOwner(e, ownerId) { return e.run.party.some(member => member.id === ownerId && member.hp > 0); }
  function cardTurnBlocked(e, card) {
    const c = combatOf(e);
    return Boolean(c && isLimitedFreeAttack(card) && c.freeActionTurns?.[card.owner + ':' + card.pattern.key] === c.turn);
  }
  function isLimitedFreeAttack(card) { return card?.cost === 0 && card.pattern?.kind === 'attack'; }

  function retireKoOwnerCards(e, ownerId) {
    const c = combatOf(e); if (!c) return 0;
    c.exhaust = Array.isArray(c.exhaust) ? c.exhaust : [];
    let retired = 0;
    for (const pileName of ['hand', 'draw', 'discard']) {
      const pile = Array.isArray(c[pileName]) ? c[pileName] : [];
      const removed = pile.filter(state => e.cards[state.id]?.owner === ownerId);
      if (!removed.length) continue;
      c[pileName] = pile.filter(state => e.cards[state.id]?.owner !== ownerId);
      c.exhaust.push(...removed); retired += removed.length;
    }
    if (retired) { const owner = e.run.party.find(member => member.id === ownerId); e.log(`${owner?.name || ownerId} 전투불능: 보유 카드 ${retired}장 비활성화`); }
    return retired;
  }
  function enforceKoCardInvariant(e) {
    if (!combatOf(e)) return 0;
    let retired = 0;
    for (const member of e.run.party.filter(item => item.hp <= 0)) retired += retireKoOwnerCards(e, member.id);
    return retired;
  }

  function drawOne(e) {
    const c = combatOf(e); if (!c) return null;
    c.exhaust = Array.isArray(c.exhaust) ? c.exhaust : [];
    const attempts = Math.max(0, (c.draw?.length || 0) + (c.discard?.length || 0));
    for (let i = 0; i < attempts; i++) {
      if (!c.draw.length) {
        if (!c.discard.length) return null;
        c.draw = e.shuffle(c.discard.splice(0));
        e.emit('triad:deck-reshuffled', { count: c.draw.length });
      }
      const state = c.draw.pop(); if (!state) continue;
      if (isPlayableOwner(e, e.cards[state.id]?.owner)) { c.hand.push(state); return state; }
      c.exhaust.push(state);
    }
    return null;
  }
  function drawCards(e, count) { for (let i = 0; i < count; i++) drawOne(e); }
  function settleResolvedCard(e, state, card, exhaust) {
    const c = combatOf(e);
    c.exhaust = Array.isArray(c.exhaust) ? c.exhaust : []; c.discard = Array.isArray(c.discard) ? c.discard : [];
    const destination = exhaust || !isPlayableOwner(e, card.owner) ? 'exhaust' : 'discard';
    c[destination].push(state);
    e.emit('triad:card-settled', { cardId: state.id, destination });
  }
  // One consumed card creates one refill.  Unplayed cards stay in hand.
  function replacePlayedCard(e, state, card, exhaust) { settleResolvedCard(e, state, card, exhaust); drawCards(e, 1); }

  // ---- party side -----------------------------------------------------
  function addShieldToMember(e, member, amount) {
    if (!member || member.hp <= 0) return 0;
    const applied = Math.max(0, Math.round(Number(amount) || 0)); member.shield += applied; return applied;
  }
  function addShield(e, amount) {
    const applied = Math.max(0, Math.round(Number(amount) || 0));
    alive(e).forEach(member => addShieldToMember(e, member, applied));
    if (applied) e.log(`아군 전체 보호막 +${applied}`);
    return applied;
  }
  function healLowest(e, amount) {
    const candidates = e.run.party.filter(member => member.hp > 0 && member.hp < member.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (!candidates.length) return null;
    const member = candidates[0], before = member.hp;
    member.hp = Math.min(member.maxHp, member.hp + Math.max(0, Math.round(Number(amount) || 0)));
    const healed = member.hp - before; e.run.stats.healing += healed; if (healed) e.log(`${member.name} HP +${healed}`);
    return member;
  }
  function healAllies(e, amount) {
    const value = Math.max(0, Math.round(Number(amount) || 0)); let total = 0;
    e.run.party.filter(member => member.hp > 0 && member.hp < member.maxHp).forEach(member => {
      const before = member.hp; member.hp = Math.min(member.maxHp, member.hp + value); const healed = member.hp - before; total += healed;
      if (healed) e.log(`${member.name} HP +${healed}`);
    });
    e.run.stats.healing += total; return total;
  }

  // ---- enemy side -----------------------------------------------------
  function archetypeKey(e, data) {
    if (data?.behaviour) return data.behaviour;
    const archetype = e.combatData?.ARCHETYPES?.[Number(data?.catalogNo) - 1];
    return archetype?.key || 'SCOUT';
  }
  function profileFor(e, enemy) { return PROFILES[enemy.behaviour] || PROFILES[archetypeKey(e, enemy.data)] || PROFILES.SCOUT; }

  /* Which catalogue rank an encounter draws from.  Unusual variants on the
     ordinary battle lane only become elites from zone 3 onward, so an early
     "battle" node can no longer hide an elite with variant scaling on top. */
  function encounterRank(type, variant = 'normal', zoneTier = 1) {
    if (type === 'ambush') return 'elite';
    if ((type === 'battle' || type === 'event') && variant !== 'normal') return type === 'event' || zoneTier >= 3 ? 'elite' : 'normal';
    return type === 'boss' || type === 'elite' ? type : 'normal';
  }

  /* Apply live tuning to a scaled monster record.  Returns a new record; the
     catalogue object is never mutated. */
  function tuneMonster(data, { difficulty = 'normal', rank } = {}) {
    if (!data || typeof data !== 'object') return data;
    const rankTuning = TUNING.rank[rank || data.rank] || TUNING.rank.normal;
    const difficultyTuning = TUNING.difficulty[difficulty] || TUNING.difficulty.normal;
    const actTuning = rank === 'training' ? { hp: 1, damage: 1 } : TUNING.act[Math.max(1, Math.min(3, Number(data.act) || 1))];
    const hp = rankTuning.hp * difficultyTuning.hp * actTuning.hp, damage = rankTuning.damage * difficultyTuning.damage * actTuning.damage;
    return {
      ...data,
      maxHp: Math.max(1, Math.round(Number(data.maxHp || 1) * hp)),
      skills: (data.skills || []).map(skill => ({ ...skill, medianDamage: Math.max(1, Math.round(Number(skill.medianDamage || 0) * damage)) })),
      tuning: { engine: VERSION, difficulty, hp, damage }
    };
  }

  /* Combat-ready enemy record from monster data. */
  function createEnemy(e, data, { variant = 'normal', name, icon, behaviour, mode } = {}) {
    return {
      data, id: data.id, name: name || data.name, elementId: data.elementId,
      maxHp: data.maxHp, hp: data.maxHp, baseDmg: data.skills?.[0]?.medianDamage || 0,
      burn: 0, shock: 0, mark: 0, guard: 0, power: 0, broken: 0, stunned: false, phase: 1,
      boss: data.rank === 'boss', elite: data.rank === 'elite', icon: icon || data.icon, skills: data.skills, variant,
      behaviour: behaviour || archetypeKey(e, data), mode: mode || 'run', bars: 0
    };
  }

  function normalizeEnemy(e, enemy) {
    for (const key of ['burn', 'shock', 'mark', 'guard', 'power', 'broken', 'bars']) enemy[key] = Math.max(0, Number(enemy[key]) || 0);
    enemy.phase = Math.max(1, Math.floor(Number(enemy.phase) || 1));
    enemy.stunned = Boolean(enemy.stunned);
    enemy.behaviour = enemy.behaviour || archetypeKey(e, enemy.data);
    enemy.mode = enemy.mode || 'run';
    return enemy;
  }

  /* Upgrade a combat saved by an older build so the engine can resume it. */
  function normalizeCombat(e) {
    const c = combatOf(e); if (!c) return null;
    normalizeEnemy(e, c.enemy);
    c.partyStatus = { weak: Math.max(0, Number(c.partyStatus?.weak) || 0), exposed: Math.max(0, Number(c.partyStatus?.exposed) || 0) };
    c.scriptIndex = Math.max(0, Math.floor(Number(c.scriptIndex) || 0));
    c.counter = Math.max(0, Number(c.counter) || 0);
    if (!c.freeActionTurns || typeof c.freeActionTurns !== 'object' || Array.isArray(c.freeActionTurns)) c.freeActionTurns = {};
    c.mode = c.mode || c.enemy.mode || 'run';
    if (c.intent && !c.intent.kind) c.intent = { ...c.intent, kind: 'attack', base: c.intent.damage, targetId: null };
    if (!c.engineVersion) c.engineVersion = VERSION;
    return c;
  }

  function currentPhase(e, enemy) {
    const phases = profileFor(e, enemy);
    return phases[Math.min(phases.length, enemy.phase) - 1] || phases[0];
  }

  function enemyDamageMultiplier(enemy) { return 1 + Math.max(0, enemy.power || 0); }

  function pickTarget(e, rule) {
    const living = alive(e); if (!living.length) return null;
    if (rule === 'lowest') return living.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.hp - b.hp)[0];
    if (rule === 'strongest') {
      const power = member => { const stats = memberStats(e, member); return Math.max(stats?.physicalAttack || 0, stats?.magicAttack || 0); };
      return living.slice().sort((a, b) => power(b) - power(a))[0];
    }
    return living[Math.floor(e.random() * living.length)];
  }

  function stepForTurn(e, c) {
    const steps = currentPhase(e, c.enemy).steps;
    const offset = c.encounterVariant === 'special' && c.enemy.phase === 1 ? 1 : 0;
    return steps[(c.scriptIndex + offset) % steps.length];
  }

  /* Telegraph this round's enemy action.  Single-target attacks lock their
     target now so the player can respond to it. */
  function planIntent(e) {
    const c = combatOf(e), enemy = c.enemy;
    if (enemy.stunned) {
      c.intent = { kind: 'stunned', skillId: '', skillName: '브레이크', damage: 0, base: 0, hits: 0, target: 'single', targetId: null, elementId: enemy.elementId, label: '행동 불가' };
      c.breakGauge = null; return c.intent;
    }
    const step = stepForTurn(e, c);
    const skill = enemy.skills?.[step.skill ?? 0] || enemy.skills?.[0] || { id: '', name: '공격', medianDamage: enemy.baseDmg || 1, hits: 1, target: 'single' };
    const intent = {
      kind: step.kind, step: c.scriptIndex, skillId: skill.id, skillName: skill.name, elementId: skill.elementId || enemy.elementId,
      hits: 0, target: 'single', targetId: null, base: 0, damage: 0,
      guard: 0, power: step.power || 0, weak: step.weak || 0, exposed: step.exposed || 0, lifesteal: step.lifesteal || 0,
      label: step.label || '', effectLabel: ''
    };
    if (step.kind === 'attack' || step.kind === 'charge') {
      const surge = c.encounterVariant === 'rare' && c.turn % 3 === 0;
      intent.hits = Math.max(1, Number(skill.hits) || 1) + (surge && skill.target !== 'all' ? 1 : 0);
      intent.target = skill.target === 'all' ? 'all' : 'single';
      intent.base = Number(skill.medianDamage || 1) * (step.mult || 1) * (surge ? 1.15 : 1);
      if (intent.target === 'single') intent.targetId = pickTarget(e, step.target || 'random')?.id || null;
      if (c.encounterVariant === 'rare') intent.effectLabel = surge ? '희귀종 · 연쇄 공격' : '희귀종 · 강화';
      if (c.encounterVariant === 'special' && enemy.phase === 1) intent.effectLabel = '변이 패턴';
    }
    if (step.guard) intent.guard = Math.max(1, Math.round(enemy.maxHp * step.guard));
    if (step.kind === 'charge') {
      intent.threshold = Math.max(8, Math.round(enemy.maxHp * step.threshold));
      c.breakGauge = { threshold: intent.threshold, dealt: 0, broken: false };
    } else c.breakGauge = null;
    intent.damage = Math.max(0, Math.round(intent.base * enemyDamageMultiplier(enemy)));
    c.intent = intent;
    return intent;
  }

  /* Re-evaluate damage numbers after the enemy's power changed mid-turn. */
  function refreshIntent(e) {
    const c = combatOf(e), intent = c?.intent; if (!intent) return;
    if (intent.base) intent.damage = Math.max(0, Math.round(intent.base * enemyDamageMultiplier(c.enemy)));
  }

  function statusDamage(e, amount, label) {
    const c = combatOf(e), enemy = c.enemy, before = enemy.hp;
    const value = Math.max(0, Math.round(amount * markMultiplier(enemy)));
    applyEnemyHpLoss(e, value);
    e.run.stats.damage += value;
    e.log(`${label}: ${value} 피해`);
    return { amount: value, hpBefore: before, hpAfter: enemy.hp };
  }

  function markMultiplier(enemy) { return 1 + Math.min(RULES.markCap, enemy.mark || 0) * RULES.markPerStack; }

  function applyEnemyHpLoss(e, amount) {
    const c = combatOf(e), enemy = c.enemy;
    if (enemy.mode === 'eventBoss') {
      c.score = (c.score || 0) + amount;
      enemy.hp -= amount;
      while (enemy.hp <= 0) {
        enemy.hp += enemy.maxHp; enemy.bars++;
        enemy.power += c.eventRules?.barPower || 0;
        e.emit('triad:event-boss-bar', { bars: enemy.bars });
      }
      return;
    }
    enemy.hp = Math.max(0, enemy.hp - amount);
    checkPhase(e);
  }

  function checkPhase(e) {
    const c = combatOf(e), enemy = c.enemy; if (enemy.hp <= 0) return false;
    const phases = profileFor(e, enemy);
    const next = phases[enemy.phase];
    if (!next || enemy.hp / enemy.maxHp > next.at) return false;
    enemy.phase++; c.phaseReset = true;
    const effect = next.onEnter || {};
    if (effect.power) enemy.power += effect.power;
    if (effect.cleanse) for (const key of ['burn', 'shock', 'mark']) enemy[key] = Math.floor(enemy[key] * (1 - effect.cleanse));
    if (effect.guard) enemy.guard += Math.round(enemy.maxHp * effect.guard);
    refreshIntent(e);
    e.log(`${enemy.name}: ${effect.label || `${enemy.phase}페이즈`}`);
    e.emit('triad:enemy-phase', { phase: enemy.phase, label: effect.label || '' });
    return true;
  }

  function triggerBreak(e) {
    const c = combatOf(e), enemy = c.enemy;
    c.breakGauge.broken = true;
    enemy.stunned = true; enemy.broken = RULES.breakPlayerTurns;
    c.intent = { kind: 'stunned', skillId: '', skillName: '브레이크', damage: 0, base: 0, hits: 0, target: 'single', targetId: null, elementId: enemy.elementId, label: '행동 불가', brokeFrom: c.intent?.skillName || '' };
    c.breaks = (c.breaks || 0) + 1;
    e.log(`${enemy.name}: 브레이크! 충전 공격 저지`);
    e.emit('triad:enemy-break', { enemyId: enemy.id });
  }

  // ---- damage ---------------------------------------------------------
  function dealDamage(e, amount, label, ownerId = null, cardKey = '', options = {}) {
    const c = combatOf(e), enemy = c.enemy, active = c.activeCard || {};
    const actorId = ownerId || active.ownerId || alive(e)[0]?.id || 'EMBER';
    const actor = e.run.party.find(member => member.id === actorId), stats = memberStats(e, actor || { id: actorId });
    const type = e.cardData.damageType(cardKey || active.cardKey, actorId), hpBefore = enemy.hp;
    const critChance = Math.max(0, Math.min(1, Number(stats?.critChance || 0) + Math.max(0, Number(options.critChanceBonus) || 0)));
    const weaknessMultiplier = Math.max(1, Number(e.combatData.RULES?.weaknessMultiplier) || 1) + Math.max(0, Number(options.weaknessBonus) || 0);
    const hit = e.combatData.resolveHit({ medianDamage: amount, attackElementId: actorId, targetElementId: enemy.elementId, critChance, critMultiplier: stats?.critMultiplier, weaknessMultiplier, modifier: e.cardData.damageMultiplier(stats, type), rng: e.random, canCrit: Boolean(ownerId || active.ownerId) });
    const weak = c.partyStatus?.weak > 0 ? RULES.weakMultiplier : 1;
    const vulnerable = enemy.broken > 0 ? RULES.breakVulnerability : 1;
    const raw = Math.max(0, Math.round(hit.amount * markMultiplier(enemy) * weak * vulnerable));
    const absorbed = Math.min(enemy.guard || 0, raw);
    enemy.guard -= absorbed;
    const dealt = raw - absorbed;
    applyEnemyHpLoss(e, dealt);
    e.run.stats.damage += dealt; c.turnDamage += dealt; e.run.stats.maxTurnDamage = Math.max(e.run.stats.maxTurnDamage || 0, c.turnDamage);
    let broke = false;
    if (c.breakGauge && !c.breakGauge.broken && c.phase === 'PLAYER' && enemy.hp > 0 && dealt > 0) {
      const shockBonus = 1 + Math.min(RULES.markCap, enemy.shock || 0) * RULES.shockBreakBonus;
      c.breakGauge.dealt += Math.round(dealt * (hit.weakness ? RULES.weaknessBreakMultiplier : 1) * shockBonus);
      if (c.breakGauge.dealt >= c.breakGauge.threshold) { triggerBreak(e); broke = true; }
    }
    e.log(`${label}: ${dealt} 피해${absorbed ? ` (방어막 ${absorbed})` : ''}${hit.weakness ? ' · 약점' : ''}${hit.critical ? ' · 치명타' : ''}`);
    return { amount: dealt, raw, absorbed, hpBefore, hpAfter: enemy.hp, weakness: hit.weakness, critical: hit.critical, broke };
  }

  function addEnemyStatus(e, key, amount) {
    const enemy = combatOf(e).enemy, value = Math.max(0, Math.round(Number(amount) || 0));
    if (!value) return 0;
    enemy[key] = key === 'mark' ? Math.min(RULES.markCap, enemy[key] + value) : enemy[key] + value;
    return value;
  }

  // ---- turn lifecycle -------------------------------------------------
  function createCombat(e, { type, enemy, encounterVariant = 'normal', zoneTier = 1, mode = 'run', difficulty = 'normal', drawPile = [], eventRules = null }) {
    return {
      engineVersion: VERSION, type, mode, difficulty, encounterVariant, zoneTier, phase: 'PLAYER', inputLocked: false, actionToken: 0,
      enemy, turn: 1, energy: e.baseEnergy, draw: drawPile, discard: [], hand: [], exhaust: [], firstCard: true, turnDamage: 0, freeActionTurns: {},
      intent: null, counter: 0, scriptIndex: 0, partyStatus: { weak: 0, exposed: 0 }, breakGauge: null, breaks: 0,
      score: mode === 'eventBoss' ? 0 : undefined, eventRules, actionLog: mode === 'eventBoss' ? [] : undefined
    };
  }

  /* Start a fight: shields reset, opening relics, opening draw, first intent. */
  function beginCombat(e, options) {
    const c = e.run.combat = createCombat(e, options);
    e.run.party.forEach(member => { member.shield = 0; });
    if (options.type !== 'tutorial') {
      if (hasArtifact(e, 'shieldStart')) e.run.party.forEach(member => { member.shield += 8; });
      if (c.enemy.boss && hasArtifact(e, 'bossGuard')) e.run.party.forEach(member => { member.shield += 15; });
    }
    return startPlayerTurn(e, { initial: true });
  }

  function startPlayerTurn(e, { initial = false } = {}) {
    const c = combatOf(e), enemy = c.enemy;
    c.energy = e.baseEnergy + (hasArtifact(e, 'energyPlus') ? 1 : 0);
    c.turnDamage = 0; c.firstCard = true; c.autoActionsThisTurn = 0;
    const report = { dots: [], shieldExpired: 0 };
    if (!initial) {
      c.turn++;
      const retain = hasArtifact(e, 'shieldRetain') ? RULES.shieldRetainArtifact : 0;
      for (const member of e.run.party) { const before = member.shield; member.shield = Math.floor(member.shield * retain); report.shieldExpired += before - member.shield; }
      c.counter = 0;
      enemy.broken = Math.max(0, enemy.broken - 1);
      if (enemy.mark > 0) enemy.mark = Math.max(0, enemy.mark - RULES.markDecay);
    }
    if (enemy.burn > 0) { report.dots.push({ kind: 'burn', ...statusDamage(e, enemy.burn, '화상') }); enemy.burn = Math.max(0, enemy.burn - RULES.burnDecay); }
    if (enemy.hp <= 0) { report.defeated = true; return report; }
    if (initial) drawCards(e, RULES.openingDraw + (hasArtifact(e, 'drawPlus') ? 1 : 0));
    if (c.mode === 'eventBoss' && c.eventRules?.turnLimit && c.turn > c.eventRules.turnLimit) { report.timeUp = true; return report; }
    planIntent(e);
    enforceKoCardInvariant(e);
    c.phase = 'PLAYER';
    return report;
  }

  function recordAction(c, entry) { if (Array.isArray(c.actionLog)) c.actionLog.push(entry); }

  /* Resolve the card at hand[index].  Validation failures return ok:false and
     leave the state untouched (KO cards are retired). */
  function playCard(e, index) {
    const c = combatOf(e), state = c.hand[index];
    if (!state) return { ok: false, reason: 'MISSING' };
    const card = e.cards[state.id]; if (!card) return { ok: false, reason: 'UNKNOWN' };
    const owner = e.run.party.find(member => member.id === card.owner);
    if (!owner || owner.hp <= 0) { retireKoOwnerCards(e, card.owner); return { ok: false, reason: 'KO', card, owner }; }
    if (cardTurnBlocked(e, card)) return { ok: false, reason: card.pattern.key === 'quick' ? 'QUICK_USED' : 'FREE_ACTION_USED', card, owner };
    const cost = cardCost(e, card);
    if (cost > c.energy) return { ok: false, reason: 'ENERGY', card, cost };
    recordAction(c, { t: 'card', turn: c.turn, index, id: state.id });
    const enemyHpBefore = c.enemy.hp;
    if (isLimitedFreeAttack(card)) { c.freeActionTurns ??= {}; c.freeActionTurns[card.owner + ':' + card.pattern.key] = c.turn; }
    c.energy -= cost; c.hand.splice(index, 1); e.run.stats.cardsPlayed++;
    const previousOwner = e.run.lastOwner; e.run.lastOwner = card.owner;
    c.activeCard = { ownerId: card.owner, cardKey: card.pattern.key };
    const key = card.pattern.key, level = starFor(e, card, state.level), v = cardValue(e, card, state.level);
    const secondary = e.cardData.secondary(key, level), statusBonus = hasArtifact(e, 'statusAmp') ? 1 : 0;
    const comboBonus = hasArtifact(e, 'triadChain') && previousOwner && previousOwner !== card.owner ? 4 : 0;
    const profile = e.cardData.signatureProfile(card.owner), perk = e.cardData.star5Perk(key, level);
    const ownerChanged = Boolean(previousOwner && previousOwner !== card.owner);
    const damageOptions = { critChanceBonus: (key === 'quick' ? secondary : 0) + (perk?.critChanceBonus || 0), weaknessBonus: perk?.weaknessBonus || 0 };
    const hitResults = [];
    let exhaust = false;
    const hitFor = (amount, label = card.name) => { const result = dealDamage(e, amount, label, card.owner, key, damageOptions); hitResults.push(result); return result; };
    const enemyAlive = () => c.enemy.hp > 0;
    switch (key) {
      case 'strike': case 'heavy': hitFor(v + comboBonus); break;
      case 'guard': addShield(e, v); break;
      case 'quick':
        hitFor(v + comboBonus); drawCards(e, 1); break;
      case 'focus': drawCards(e, v); if (secondary) addShield(e, secondary); break;
      case 'battery': c.energy += v; if (secondary) addShield(e, secondary); exhaust = true; break;
      case 'mark': hitFor(secondary + comboBonus); addEnemyStatus(e, 'mark', v + statusBonus + (perk?.statusBonus || 0)); break;
      case 'dot': hitFor(secondary + comboBonus); addEnemyStatus(e, card.owner === 'EMBER' || card.owner === 'RIFT' ? 'burn' : 'shock', v + statusBonus + (perk?.statusBonus || 0)); break;
      case 'burst': for (let i = 0; i < Math.max(1, v) && enemyAlive(); i++) hitFor(secondary + (i === 0 ? comboBonus : 0)); break;
      case 'heal': { const target = healLowest(e, v); if (target && perk?.targetShield) { addShieldToMember(e, target, perk.targetShield); e.log(`${target.name} 보호막 +${perk.targetShield}`); } break; }
      case 'combo': hitFor(v + (ownerChanged ? 7 + (perk?.chainDamage || 0) : 0) + comboBonus); break;
      case 'scale': hitFor(v + (c.enemy.burn + c.enemy.shock + c.enemy.mark) * Math.max(1, secondary + (perk?.statusScaleBonus || 0)) + comboBonus); break;
      case 'counter': addShield(e, v); c.counter += secondary + (perk?.counterDamage || 0); break;
      case 'execute': hitFor(v * (c.enemy.hp / c.enemy.maxHp <= (perk?.executeThreshold || 0.35) ? 2 : 1) + comboBonus); break;
      case 'signature':
        hitFor(Math.round(v * profile.damageMultiplier) + (ownerChanged ? (profile.chainBonus || 0) : 0) + comboBonus);
        addShield(e, Math.round(v * profile.shieldRatio));
        if (profile.healRatio) healAllies(e, Math.round(v * profile.healRatio));
        addEnemyStatus(e, 'burn', profile.burn || 0); addEnemyStatus(e, 'shock', profile.shock || 0); addEnemyStatus(e, 'mark', profile.mark || 0);
        if (profile.draw) drawCards(e, profile.draw);
        if (profile.counterRatio) c.counter += Math.round(v * profile.counterRatio);
        exhaust = true; // once per battle: the timing is the decision
        break;
      case 'inferno': hitFor(v + comboBonus); addEnemyStatus(e, 'burn', secondary + statusBonus + (perk?.statusBonus || 0)); break;
      case 'volley': for (let i = 0; i < Math.max(1, v) && enemyAlive(); i++) hitFor(secondary + (i === 0 ? comboBonus : 0)); break;
      case 'bastion': addShield(e, v); c.counter += secondary; break;
      case 'ambush': hitFor(v + c.enemy.mark * (secondary + (perk?.markScaleBonus || 0)) + comboBonus); break;
      case 'renewal': healAllies(e, v); if (secondary) addShield(e, secondary); break;
      case 'overload': {
        hitFor(v + comboBonus);
        const selfDamage = Math.max(0, perk?.selfDamage ?? secondary), before = owner.hp;
        owner.hp = Math.max(1, owner.hp - selfDamage);
        if (owner.hp < before) e.log(`${owner.name}: HP ${before - owner.hp} 소모`);
        exhaust = true; break;
      }
      default: hitFor(v + comboBonus);
    }
    if (perk?.shieldBonus) addShield(e, perk.shieldBonus);
    if (perk?.healBonus) healLowest(e, perk.healBonus);
    replacePlayedCard(e, state, card, exhaust);
    c.activeCard = null; c.firstCard = false;
    enforceKoCardInvariant(e);
    const defeated = c.enemy.mode !== 'eventBoss' && c.enemy.hp <= 0;
    return {
      ok: true, card, state, owner, cost, hitResults, exhaust, defeated,
      damageDealt: c.enemy.mode === 'eventBoss' ? hitResults.reduce((sum, hitResult) => sum + hitResult.amount, 0) : Math.max(0, enemyHpBefore - c.enemy.hp),
      broke: hitResults.some(hitResult => hitResult.broke)
    };
  }

  function incomingMultiplier(e, member) { return e.cardData.incomingDamageMultiplier(memberStats(e, member)); }

  /* End the player turn and resolve the enemy action.  Returns the per-hit
     results used by presentation plus a description of the action. */
  function resolveEnemyTurn(e) {
    const c = combatOf(e), enemy = c.enemy, intent = c.intent || {};
    recordAction(c, { t: 'end', turn: c.turn });
    c.phase = 'ENEMY';
    if (c.partyStatus.weak > 0) c.partyStatus.weak--;
    c.breakGauge = null;
    enemy.guard = 0;
    const action = { kind: intent.kind || 'attack', skillId: intent.skillId, skillName: intent.skillName, label: intent.label || '', shock: null, guardGained: 0, powerGained: 0, healed: 0, weak: 0, exposed: 0, enraged: false };
    const results = [];
    if (enemy.shock > 0) { action.shock = statusDamage(e, enemy.shock, '감전'); enemy.shock = Math.floor(enemy.shock * RULES.shockDecay); }
    if (enemy.mode !== 'eventBoss' && enemy.hp <= 0) { action.defeated = true; return { results, action }; }
    if (enemy.stunned) {
      enemy.stunned = false; action.kind = 'stunned';
      e.log(`${enemy.name}: 브레이크로 행동 불가`);
    } else {
      if (intent.kind === 'attack' || intent.kind === 'charge') {
        const living = alive(e);
        const targets = intent.target === 'all' ? living : null;
        const count = targets ? targets.length : Math.max(1, Number(intent.hits) || 1);
        const perHit = Math.max(0, Math.round((intent.base || intent.damage || 0) * enemyDamageMultiplier(enemy)));
        for (let hitIndex = 0; hitIndex < count && (enemy.mode === 'eventBoss' || enemy.hp > 0); hitIndex++) {
          const pool = alive(e); if (!pool.length) break;
          let member = targets ? targets[hitIndex] : pool.find(item => item.id === intent.targetId);
          if (!member || member.hp <= 0) member = targets ? null : pool[Math.floor(e.random() * pool.length)];
          if (!member) continue;
          const hpBefore = member.hp, shieldBefore = member.shield;
          const hitRoll = e.combatData.resolveHit({ medianDamage: perHit, attackElementId: enemy.elementId, targetElementId: member.id, critChance: enemy.data?.critChance, critMultiplier: enemy.data?.critMultiplier, rng: e.random });
          const exposed = c.partyStatus.exposed > 0 ? RULES.exposedMultiplier : 1;
          const incoming = Math.max(0, Math.round(hitRoll.amount * incomingMultiplier(e, member) * exposed));
          const blocked = Math.min(member.shield, incoming), damage = incoming - blocked;
          member.shield -= blocked; member.hp = Math.max(0, member.hp - damage);
          if (hpBefore > 0 && member.hp <= 0) retireKoOwnerCards(e, member.id);
          e.log(`${enemy.name} → ${member.name}: ${damage} 피해${blocked ? ` (${blocked} 방어)` : ''}`);
          const result = { targetId: member.id, damage, blocked, incoming, hpBefore, shieldBefore, hpAfter: member.hp, shieldAfter: member.shield, counterHit: null, critical: hitRoll.critical };
          if (c.counter && blocked > 0) result.counterHit = dealDamage(e, c.counter, '반격', member.id, 'counter');
          results.push(result);
        }
        if (intent.lifesteal) {
          const hpDamage = results.reduce((sum, result) => sum + result.damage, 0);
          const before = enemy.hp; enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.round(hpDamage * intent.lifesteal));
          action.healed = enemy.hp - before; if (action.healed) e.log(`${enemy.name}: HP ${action.healed} 흡수`);
        }
      }
      if (intent.guard) { enemy.guard += intent.guard; action.guardGained = intent.guard; e.log(`${enemy.name}: 방어막 +${intent.guard}`); }
      if (intent.power) { enemy.power += intent.power; action.powerGained = intent.power; e.log(`${enemy.name}: 공격력 +${Math.round(intent.power * 100)}%`); }
    }
    if (c.partyStatus.exposed > 0) c.partyStatus.exposed--;
    if (!enemy.stunned && action.kind !== 'stunned') {
      if (intent.weak) { c.partyStatus.weak = Math.max(c.partyStatus.weak, intent.weak); action.weak = intent.weak; }
      if (intent.exposed) { c.partyStatus.exposed = Math.max(c.partyStatus.exposed, intent.exposed); action.exposed = intent.exposed; }
    }
    const rank = enemy.boss ? 'boss' : enemy.elite ? 'elite' : null;
    const enrageAt = rank && RULES.enrageTurn[rank] ? RULES.enrageTurn[rank] - (c.difficulty === 'hard' ? RULES.hardEnrageShift : 0) : Infinity;
    if (c.mode !== 'eventBoss' && c.turn >= enrageAt) { enemy.power += RULES.enragePerTurn; action.enraged = true; e.log(`${enemy.name}: 광폭화 (+${Math.round(RULES.enragePerTurn * 100)}%)`); }
    if (c.mode === 'eventBoss' && c.eventRules?.powerPerTurn) enemy.power += c.eventRules.powerPerTurn;
    // A phase change restarts the new phase's script on the next action.
    c.scriptIndex = c.phaseReset ? 0 : c.scriptIndex + 1; c.phaseReset = false;
    return { results, action };
  }

  function partyDefeated(e) { return e.run.party.every(member => member.hp <= 0); }
  function enemyDefeated(e) { const c = combatOf(e); return Boolean(c && c.enemy.mode !== 'eventBoss' && c.enemy.hp <= 0); }

  // ---- display helpers -------------------------------------------------
  function describeIntent(e, intent = combatOf(e)?.intent) {
    if (!intent) return { text: '', tags: [] };
    const member = intent.targetId ? e.run.party.find(item => item.id === intent.targetId) : null;
    const tags = [];
    let text;
    if (intent.kind === 'stunned') text = `브레이크 · 이번 턴 행동 불가${intent.brokeFrom ? ` (${intent.brokeFrom} 저지)` : ''}`;
    else if (intent.kind === 'guard') text = `방어 태세 · 방어막 ${intent.guard}`;
    else if (intent.kind === 'buff') text = `강화 · 공격력 +${Math.round((intent.power || 0) * 100)}%${intent.guard ? ` · 방어막 ${intent.guard}` : ''}`;
    else {
      const who = intent.target === 'all' ? '아군 전체' : member ? `${member.name}` : '무작위 아군';
      text = `${intent.kind === 'charge' ? '⚠ 충전 공격 · ' : ''}${intent.skillName || '공격'} → ${who} ${intent.damage}${intent.hits > 1 ? ` × ${intent.hits}` : ''}`;
      if (intent.guard) tags.push(`방어막 ${intent.guard}`);
      if (intent.power) tags.push(`공격력 +${Math.round(intent.power * 100)}%`);
    }
    if (intent.weak) tags.push(`약화 ${intent.weak}턴`);
    if (intent.exposed) tags.push(`취약 ${intent.exposed}턴`);
    if (intent.lifesteal) tags.push('흡혈');
    if (intent.label) tags.unshift(intent.label);
    if (intent.effectLabel) tags.push(intent.effectLabel);
    return { text, tags };
  }

  function threatFor(e, intent = combatOf(e)?.intent) {
    // Expected HP loss per ally for the telegraphed action, after shields.
    const c = combatOf(e); if (!intent || !['attack', 'charge'].includes(intent.kind)) return { total: 0, byMember: {} };
    const exposed = c.partyStatus?.exposed > 0 ? RULES.exposedMultiplier : 1;
    const byMember = {}; let total = 0;
    const living = alive(e);
    const targets = intent.target === 'all' ? living : [living.find(member => member.id === intent.targetId) || living[0]].filter(Boolean);
    for (const member of targets) {
      const hits = intent.target === 'all' ? 1 : Math.max(1, intent.hits || 1);
      const incoming = Math.round(intent.damage * incomingMultiplier(e, member) * exposed) * hits;
      const loss = Math.max(0, incoming - member.shield);
      byMember[member.id] = { incoming, loss, lethal: loss >= member.hp };
      total += loss;
    }
    return { total, byMember };
  }

  // ---- AUTO battle policy ---------------------------------------------
  /* Greedy one-card scorer used by the in-game AUTO button.  It reads the
     telegraphed intent (defends against big hits, pushes a reachable break,
     finishes lethal) but does not plan whole turns - deliberate manual play
     still beats it on elites and bosses. */
  function estimateCardDamage(e, card, state) {
    const c = combatOf(e); if (!c || !card) return 0;
    const key = card.pattern.key, level = starFor(e, card, state?.level), v = cardValue(e, card, state?.level);
    const secondary = e.cardData.secondary(key, level), perk = e.cardData.star5Perk(key, level);
    const combo = hasArtifact(e, 'triadChain') && e.run.lastOwner && e.run.lastOwner !== card.owner ? 4 : 0;
    const ownerChanged = Boolean(e.run.lastOwner && e.run.lastOwner !== card.owner);
    // Same hit list the resolver would deal (multi-hits round per hit).
    let hits = [];
    if (['strike', 'heavy', 'quick', 'inferno', 'overload'].includes(key)) hits = [v + combo];
    else if (key === 'mark' || key === 'dot') hits = [secondary + combo];
    else if (key === 'burst' || key === 'volley') hits = Array.from({ length: Math.max(1, v) }, (_, index) => secondary + (index === 0 ? combo : 0));
    else if (key === 'combo') hits = [v + (ownerChanged ? 7 + (perk?.chainDamage || 0) : 0) + combo];
    else if (key === 'scale') hits = [v + (c.enemy.burn + c.enemy.shock + c.enemy.mark) * Math.max(1, secondary + (perk?.statusScaleBonus || 0)) + combo];
    else if (key === 'execute') hits = [v * (c.enemy.hp / c.enemy.maxHp <= (perk?.executeThreshold || 0.35) ? 2 : 1) + combo];
    else if (key === 'ambush') hits = [v + c.enemy.mark * (secondary + (perk?.markScaleBonus || 0)) + combo];
    else if (key === 'signature') { const profile = e.cardData.signatureProfile(card.owner); hits = [Math.round(v * profile.damageMultiplier) + (ownerChanged ? (profile.chainBonus || 0) : 0) + combo]; }
    if (!hits.length) return 0;
    const owner = e.run.party.find(member => member.id === card.owner), stats = memberStats(e, owner || { id: card.owner });
    const weakness = e.combatData.isWeakness(card.owner, c.enemy.elementId) ? Math.max(1, Number(e.combatData.RULES?.weaknessMultiplier) || 1) + Math.max(0, Number(perk?.weaknessBonus) || 0) : 1;
    const modifier = e.cardData.damageMultiplier(stats, e.cardData.damageType(key, card.owner));
    const after = markMultiplier(c.enemy) * (c.partyStatus?.weak > 0 ? RULES.weakMultiplier : 1) * (c.enemy.broken > 0 ? RULES.breakVulnerability : 1);
    const total = hits.reduce((sum, amount) => sum + Math.max(0, Math.round(Math.max(0, Math.round(Math.max(0, Math.round(amount)) * weakness * modifier)) * after)), 0);
    return Math.max(0, total - Math.min(c.enemy.guard || 0, total));
  }

  function cardShieldValue(e, card, state) {
    const key = card.pattern.key, level = starFor(e, card, state?.level), v = cardValue(e, card, state?.level), secondary = e.cardData.secondary(key, level);
    if (['guard', 'counter', 'bastion'].includes(key)) return v;
    if (['focus', 'battery', 'renewal'].includes(key)) return secondary;
    if (key === 'signature') return Math.round(v * e.cardData.signatureProfile(card.owner).shieldRatio);
    return 0;
  }

  function scoreAutoCard(e, card, state, index) {
    const c = combatOf(e), key = card.pattern.key, level = starFor(e, card, state.level), v = cardValue(e, card, state.level);
    const secondary = e.cardData.secondary(key, level), perk = e.cardData.star5Perk(key, level), cost = cardCost(e, card);
    const living = alive(e), lowest = Math.min(...living.map(member => member.hp / member.maxHp));
    const missing = living.reduce((sum, member) => sum + (member.maxHp - member.hp), 0);
    const threat = threatFor(e), damage = estimateCardDamage(e, card, state), shieldValue = cardShieldValue(e, card, state);
    const lethalTarget = Object.values(threat.byMember).some(entry => entry.lethal);
    let score = damage > 0 ? damage * 1.55 + (damage / Math.max(1, cost)) * 7 : 0;
    if (c.enemy.mode !== 'eventBoss' && damage >= c.enemy.hp && damage > 0) score += 10000;
    if (c.breakGauge && !c.breakGauge.broken && damage > 0) {
      const remaining = c.breakGauge.threshold - c.breakGauge.dealt;
      score += damage >= remaining ? 160 : damage * 1.4;
    }
    if (key === 'execute' && c.enemy.hp / c.enemy.maxHp <= (perk?.executeThreshold || 0.35)) score += 92;
    if (['mark', 'dot', 'inferno'].includes(key)) score += c.enemy.hp / c.enemy.maxHp > 0.32 ? 28 : 5;
    if (key === 'scale') score += (c.enemy.burn + c.enemy.shock + c.enemy.mark) * 9;
    if (key === 'heal' || key === 'renewal') score += missing ? missing * 1.7 + (1 - lowest) * 145 : -900;
    if (shieldValue > 0) {
      const covered = Math.min(threat.total, shieldValue * Math.max(1, Object.keys(threat.byMember).length));
      score += threat.total > 0 ? covered * 2.4 + (lethalTarget ? 120 : 0) : -140;
    }
    if (key === 'counter' || key === 'bastion') score += threat.total > 7 ? secondary * 1.4 : 0;
    if (key === 'focus') score += (c.hand.length <= 2 ? 58 : 24) + v * 8;
    if (key === 'battery') score += c.energy <= 1 ? 78 + v * 12 : 18;
    if (key === 'overload' && living.find(member => member.id === card.owner)?.hp <= (perk?.selfDamage ?? secondary) + 8) score -= 45;
    if (key === 'quick') score += 32;
    if (key === 'signature') score += (c.type === 'boss' || c.type === 'elite' ? 96 : 42) + v;
    if (cost === 0) score += 22;
    score -= cost * 3; score -= index * 0.001;
    return { index, card, state, cost, damage, score };
  }

  function chooseAutoCard(e) {
    const c = combatOf(e); if (!c) return null;
    return c.hand.map((state, index) => {
      const card = e.cards[state.id]; if (!card || !isPlayableOwner(e, card.owner)) return null;
      if (cardTurnBlocked(e, card) || cardCost(e, card) > c.energy) return null;
      return scoreAutoCard(e, card, state, index);
    }).filter(Boolean).sort((a, b) => b.score - a.score)[0] || null;
  }

  return Object.freeze({
    VERSION, RULES, TUNING, PROFILES,
    env, hasArtifact, starFor, cardValue, cardCost, isPlayableOwner, cardTurnBlocked,
    retireKoOwnerCards, enforceKoCardInvariant, drawOne, drawCards, settleResolvedCard, replacePlayedCard,
    addShieldToMember, addShield, healLowest, healAllies,
    archetypeKey, encounterRank, tuneMonster, createEnemy, normalizeCombat, planIntent, refreshIntent,
    dealDamage, statusDamage, addEnemyStatus, markMultiplier,
    createCombat, beginCombat, startPlayerTurn, playCard, resolveEnemyTurn, partyDefeated, enemyDefeated,
    describeIntent, threatFor, estimateCardDamage, scoreAutoCard, chooseAutoCard
  });
});
