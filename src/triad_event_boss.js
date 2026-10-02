/* TRIAD // RUN periodic event boss - foundation.
 *
 * A weekly season rotates one boss with a rule modifier.  The boss has
 * infinite HP (the engine refills its HP bar and counts bars); the score is
 * the total damage dealt before the turn limit or a party wipe.  Players fight
 * it with a build archived at an act clear (src/triad_build_archive.js).
 *
 * Every attempt produces a submission that carries the build, the season and
 * the exact action list.  Because the combat engine is deterministic for a
 * given build + season seed, a ranking server (or
 * tools/verify_event_boss_submission.js) can replay the actions and recompute
 * the score instead of trusting the client.  The remote adapter here is an
 * offline stub: nothing is sent anywhere until a server exists.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TRIAD_EVENT_BOSS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = 'event-boss-1.0.0';
  const SUBMISSION_SCHEMA = 1;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  // Season 1 opens Monday 2026-09-28 00:00 KST; every season lasts one week.
  const EPOCH_MS = Date.UTC(2026, 8, 27, 15, 0, 0);
  // damageScale keeps a grown act-3 build alive to the turn limit (score is
  // then pure damage) while an act-1 build usually falls around turn 8-9.
  const BASE_RULES = Object.freeze({ turnLimit: 10, barPower: 0.1, powerPerTurn: 0.05, barHpScale: 1, damageScale: 0.6 });
  const MODIFIERS = Object.freeze([
    Object.freeze({ id: 'STANDARD', name: '표준 규칙', text: '10턴 동안 가한 총 피해가 점수입니다.', rules: Object.freeze({}) }),
    Object.freeze({ id: 'FRENZY', name: '격앙', text: '보스 공격력이 매 턴 +10%씩 오릅니다.', rules: Object.freeze({ powerPerTurn: 0.1 }) }),
    Object.freeze({ id: 'REGEN_ARMOR', name: '재생 장갑', text: 'HP 바는 1.5배, 격파할 때마다 보스 공격력 +20%.', rules: Object.freeze({ barHpScale: 1.5, barPower: 0.2 }) }),
    Object.freeze({ id: 'BLITZ', name: '속전속결', text: '턴 제한 7 · 보스 공격력 상승 없음.', rules: Object.freeze({ turnLimit: 7, powerPerTurn: 0 }) })
  ]);
  const ELEMENT_ORDER = Object.freeze(['EMBER', 'VOLT', 'AEGIS', 'SHADE', 'BLOOM', 'RIFT']);
  const TIER_ORDER = Object.freeze(['M15', 'M14', 'M13']);
  const LEADERBOARD_SIZE = 10;
  const SEASON_HISTORY = 12;

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));

  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }
  function fnv1a(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0; }
    return hash >>> 0;
  }
  const hex = value => (value >>> 0).toString(16).padStart(8, '0');

  // ---- season schedule ----------------------------------------------------
  function seasonIndex(now = Date.now()) { return Math.max(0, Math.floor((Number(now) - EPOCH_MS) / WEEK_MS)); }

  /* The season active at `now`.  Pure function of the date, so every client
     and the server agree on the boss, the seed and the rules. */
  function seasonFor(now = Date.now(), index = seasonIndex(now)) {
    const element = ELEMENT_ORDER[index % ELEMENT_ORDER.length];
    const tier = TIER_ORDER[Math.floor(index / ELEMENT_ORDER.length) % TIER_ORDER.length];
    const modifier = MODIFIERS[index % MODIFIERS.length];
    const seasonId = `EB-${String(index + 1).padStart(3, '0')}`;
    const startsAt = EPOCH_MS + index * WEEK_MS;
    return {
      version: VERSION, seasonId, index, bossId: `${element}_${tier}`,
      startsAt: new Date(startsAt).toISOString(), endsAt: new Date(startsAt + WEEK_MS).toISOString(),
      seed: fnv1a(`TRIAD_EVENT_BOSS:${seasonId}`) || 1,
      modifier: { id: modifier.id, name: modifier.name, text: modifier.text },
      rules: { ...BASE_RULES, ...modifier.rules }
    };
  }

  /* Tuned boss record for a season (act-3 tuning for every tier). */
  function bossData(deps, season) {
    const source = deps.combatData.MONSTER_BY_ID?.[season.bossId] || deps.combatData.MONSTERS.find(monster => monster.id === season.bossId);
    if (!source) throw new Error(`event boss ${season.bossId} missing from the catalogue`);
    const tuned = deps.engine.tuneMonster({ ...source, act: 3 }, { difficulty: 'normal' });
    const damage = Number.isFinite(season.rules.damageScale) ? season.rules.damageScale : 1;
    return {
      ...tuned, maxHp: Math.max(1, Math.round(tuned.maxHp * (season.rules.barHpScale || 1))),
      skills: tuned.skills.map(skill => ({ ...skill, medianDamage: Math.max(1, Math.round(skill.medianDamage * damage)) }))
    };
  }

  // ---- combat -------------------------------------------------------------
  /* A combat-only run restored from an archived build.  Full HP, no shields,
     seeded by the season so every replay draws the same cards. */
  function createEventRun(deps, build, season) {
    const party = build.party.map(member => {
      const stats = deps.cardData.characterStats(member.id, member.breakthrough || 0);
      return { id: member.id, characterId: member.characterId, name: member.name, visual: clone(member.visual) || null, breakthrough: member.breakthrough || 0, stats, maxHp: stats.maxHp, hp: stats.maxHp, shield: 0 };
    });
    return {
      id: `EVENT-${season.seasonId}-${build.hash}`, eventBoss: { seasonId: season.seasonId, buildId: build.id, buildHash: build.hash, season: clone(season) },
      seed: season.seed, rngState: season.seed, rngCursor: 0, stage: 30, act: 3, difficulty: 'normal', nightmareMode: false,
      characters: build.party.map(member => ({ id: member.characterId, coreId: member.id, name: member.name, visual: clone(member.visual) || null, breakthrough: member.breakthrough || 0, confirmed: true })),
      party, deck: build.deck.map(card => ({ id: card.id, level: card.level })), artifacts: build.artifacts.slice(),
      accountSnapshot: { baseEnergyBonus: build.baseEnergyBonus || 0 }, lastOwner: null, wins: 0, path: [], combat: null,
      stats: { damage: 0, healing: 0, cardsPlayed: 0, maxTurnDamage: 0 }, tutorial: { completed: true, status: 'COMPLETE' }
    };
  }

  function beginEventCombat(deps, e, season) {
    const enemyData = bossData(deps, season);
    const enemy = deps.engine.createEnemy(e, enemyData, { mode: 'eventBoss', name: `${enemyData.name} · EVENT` });
    return deps.engine.beginCombat(e, {
      type: 'eventBoss', mode: 'eventBoss', enemy, encounterVariant: 'normal', zoneTier: 1, difficulty: 'normal',
      drawPile: e.shuffle(e.run.deck.map(card => ({ ...card }))), eventRules: clone(season.rules)
    });
  }

  function turnsUsed(combat) { return clampInt(combat?.turn, 1, 999); }

  /* Replay an action list against a fresh event run.  Returns the recomputed
     score or the first desync. */
  function replay(deps, { build, season, actions }) {
    const run = createEventRun(deps, build, season);
    const e = deps.makeEnv(run);
    const opening = beginEventCombat(deps, e, season);
    const c = run.combat;
    let ended = opening.timeUp ? 'TIME' : null;
    const list = Array.isArray(actions) ? actions : [];
    for (let at = 0; at < list.length && !ended; at++) {
      const action = list[at];
      if (action?.t === 'card') {
        if (c.hand[action.index]?.id !== action.id) return { ok: false, reason: 'DESYNC_CARD', at };
        const result = deps.engine.playCard(e, action.index);
        if (!result.ok) return { ok: false, reason: `ILLEGAL_${result.reason}`, at };
      } else if (action?.t === 'end') {
        if (action.turn !== c.turn) return { ok: false, reason: 'DESYNC_TURN', at };
        deps.engine.resolveEnemyTurn(e);
        if (deps.engine.partyDefeated(e)) { ended = 'WIPE'; break; }
        const report = deps.engine.startPlayerTurn(e);
        if (report.timeUp) ended = 'TIME';
      } else return { ok: false, reason: 'UNKNOWN_ACTION', at };
    }
    return { ok: true, score: c.score || 0, bars: c.enemy.bars, turns: turnsUsed(c), ended: ended || 'OPEN', run };
  }

  // ---- submissions --------------------------------------------------------
  function submissionChecksum(submission) {
    return hex(fnv1a(canonical({ seasonId: submission.seasonId, buildHash: submission.buildHash, engineVersion: submission.engineVersion, eventVersion: submission.eventVersion, actions: submission.actions, score: submission.score })));
  }

  function createSubmission({ season, build, combat, engineVersion, ended, now = Date.now() }) {
    const submission = {
      schema: SUBMISSION_SCHEMA, eventVersion: VERSION, engineVersion: String(engineVersion || ''),
      seasonId: season.seasonId, bossId: season.bossId, seed: season.seed,
      buildId: build.id, buildHash: build.hash, build: clone(build),
      actions: clone(combat.actionLog || []), score: Math.max(0, Math.round(combat.score || 0)), bars: combat.enemy?.bars || 0,
      turns: turnsUsed(combat), ended: ended || 'OPEN', submittedAt: new Date(now).toISOString()
    };
    submission.checksum = submissionChecksum(submission);
    return submission;
  }

  /* Full verification: season identity, build integrity, replayed score. */
  function verify(deps, submission, { archive } = {}) {
    if (!submission || submission.schema !== SUBMISSION_SCHEMA) return { ok: false, reason: 'SCHEMA' };
    if (submission.checksum !== submissionChecksum(submission)) return { ok: false, reason: 'CHECKSUM' };
    if (submission.engineVersion !== deps.engine.VERSION) return { ok: false, reason: 'ENGINE_VERSION' };
    const index = Number(String(submission.seasonId).replace('EB-', '')) - 1;
    if (!Number.isInteger(index) || index < 0) return { ok: false, reason: 'SEASON' };
    const season = seasonFor(EPOCH_MS + index * WEEK_MS, index);
    if (season.bossId !== submission.bossId || season.seed !== submission.seed) return { ok: false, reason: 'SEASON' };
    const problems = archive ? archive.validate(submission.build, { cards: deps.cards }) : [];
    if (problems.length) return { ok: false, reason: `BUILD_${problems[0]}` };
    if (submission.build.hash !== submission.buildHash) return { ok: false, reason: 'BUILD_HASH' };
    const result = replay(deps, { build: submission.build, season, actions: submission.actions });
    if (!result.ok) return result;
    if (result.score !== submission.score) return { ok: false, reason: 'SCORE_MISMATCH', expected: result.score, claimed: submission.score };
    return { ok: true, score: result.score, bars: result.bars, turns: result.turns, ended: result.ended };
  }

  // ---- local leaderboard ----------------------------------------------------
  function normalizeBoard(profile) {
    const source = profile?.eventBoss && typeof profile.eventBoss === 'object' ? profile.eventBoss : {};
    const seasons = {};
    for (const [seasonId, entry] of Object.entries(source.seasons || {})) {
      if (!/^EB-\d{3,}$/.test(seasonId) || !entry || typeof entry !== 'object') continue;
      const entries = (Array.isArray(entry.entries) ? entry.entries : []).filter(item => item && Number.isFinite(item.score)).slice(0, LEADERBOARD_SIZE);
      seasons[seasonId] = { attempts: clampInt(entry.attempts, 0, 1e6), entries };
    }
    const kept = Object.keys(seasons).sort().slice(-SEASON_HISTORY);
    return { version: VERSION, seasons: Object.fromEntries(kept.map(id => [id, seasons[id]])) };
  }

  const rankOrder = (a, b) => b.score - a.score || a.turns - b.turns || String(a.submittedAt).localeCompare(String(b.submittedAt));

  /* Record an attempt in the profile's local leaderboard.  The stored entry
     omits the embedded build and actions; `pending` keeps the full submission
     for a future upload. */
  function recordLocal(profile, submission, { transactionId, now = Date.now() } = {}) {
    const next = clone(profile) || {};
    next.transactionLedger = next.transactionLedger && typeof next.transactionLedger === 'object' ? next.transactionLedger : {};
    const txnId = transactionId || `EVENT_BOSS:${submission.seasonId}:${submission.checksum}:${submission.submittedAt}`;
    if (next.transactionLedger[txnId]) return { profile, recorded: false, reason: 'DUPLICATE' };
    const board = normalizeBoard(next);
    const season = board.seasons[submission.seasonId] || { attempts: 0, entries: [] };
    const entry = { score: submission.score, bars: submission.bars, turns: submission.turns, ended: submission.ended, buildId: submission.buildId, buildHash: submission.buildHash, label: submission.build?.summary?.label || '', checksum: submission.checksum, submittedAt: submission.submittedAt };
    season.attempts++;
    season.entries = [...season.entries, entry].sort(rankOrder).slice(0, LEADERBOARD_SIZE);
    board.seasons[submission.seasonId] = season;
    next.eventBoss = normalizeBoard({ eventBoss: board });
    next.eventBoss.pending = [...(Array.isArray(profile?.eventBoss?.pending) ? profile.eventBoss.pending : []), submission].slice(-5);
    next.transactionLedger[txnId] = { kind: 'EVENT_BOSS_SCORE', seasonId: submission.seasonId, score: submission.score, committedAt: now };
    const rank = season.entries.findIndex(item => item.checksum === entry.checksum && item.submittedAt === entry.submittedAt);
    return { profile: next, recorded: true, rank: rank >= 0 ? rank + 1 : null, best: season.entries[0] || null, attempts: season.attempts };
  }

  function localBoard(profile, seasonId) { return normalizeBoard(profile).seasons[seasonId] || { attempts: 0, entries: [] }; }

  /* Offline ranking adapter.  A real server would verify() each submission by
     replay and rank verified scores; until then nothing leaves the device. */
  function createRemoteAdapter({ endpoint = null } = {}) {
    return Object.freeze({
      endpoint,
      online: false,
      submit(submission) { return Promise.resolve({ status: 'OFFLINE', seasonId: submission?.seasonId || null, queued: true }); },
      fetchLeaderboard(seasonId) { return Promise.resolve({ status: 'OFFLINE', seasonId, entries: [] }); }
    });
  }

  return Object.freeze({
    VERSION, SUBMISSION_SCHEMA, EPOCH_MS, WEEK_MS, BASE_RULES, MODIFIERS, LEADERBOARD_SIZE,
    seasonIndex, seasonFor, bossData, createEventRun, beginEventCombat, replay,
    submissionChecksum, createSubmission, verify, normalizeBoard, recordLocal, localBoard, createRemoteAdapter
  });
});
