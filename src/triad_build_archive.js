/* TRIAD // RUN build archive.
 *
 * When an act boss falls, the player can archive the build they grew in that
 * run: the party (characters and breakthroughs), the deck with every card's
 * run level (upgrades earned on the map), the signature cards, the artifacts
 * and the account energy bonus.  Archived builds are what the periodic event
 * boss is fought with, so a build is a self-contained, hashable record that
 * the browser and a verifier (tools/verify_event_boss_submission.js) restore
 * identically.  DOM-free; the profile object is never mutated in place.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TRIAD_BUILD_ARCHIVE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = 'build-archive-1.0.0';
  const SCHEMA = 1;
  const SLOT_LIMIT = 3;
  // Inline visuals larger than this (for example imported illustrations) are
  // not copied into the profile; the runtime falls back to the production art.
  const MAX_INLINE_VISUAL_CHARS = 4096;

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));

  /* Key-sorted JSON so equal builds always hash equally. */
  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }

  /* FNV-1a 32-bit.  An integrity fingerprint, not a signature: ranking trust
     comes from server-side replay, never from this hash. */
  function fnv1a(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  function combatPayload(build) {
    return {
      party: build.party.map(member => ({ id: member.id, characterId: member.characterId, breakthrough: member.breakthrough })),
      deck: build.deck.map(card => ({ id: card.id, level: card.level })),
      artifacts: build.artifacts.slice(),
      baseEnergyBonus: build.baseEnergyBonus
    };
  }

  function hashBuild(build) { return fnv1a(canonical(combatPayload(build))); }

  function smallVisual(visual) {
    if (!visual || typeof visual !== 'object') return null;
    const text = JSON.stringify(visual);
    return text.length <= MAX_INLINE_VISUAL_CHARS ? JSON.parse(text) : null;
  }

  function sortDeck(deck) {
    return deck.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.level - b.level);
  }

  /* Snapshot the growth of a live run.  `cards` is the card catalogue used to
     tag signatures and owners for the summary. */
  function snapshot(run, { cards = {}, now = Date.now(), engineVersion = '', reason = 'ACT_CLEAR', act } = {}) {
    if (!run || !Array.isArray(run.party) || !Array.isArray(run.deck)) throw new Error('build snapshot requires a run with party and deck');
    const party = run.party.map(member => ({
      id: String(member.id), characterId: String(member.characterId || member.id), name: String(member.name || member.id),
      breakthrough: clampInt(member.breakthrough, 0, 5), visual: smallVisual(member.visual)
    }));
    const partyIds = new Set(party.map(member => member.id));
    const deck = sortDeck(run.deck.filter(card => card && cards[card.id] ? partyIds.has(cards[card.id].owner) : Boolean(card?.id))
      .map(card => ({ id: String(card.id), level: clampInt(card.level || 1, 1, 5) })));
    const build = {
      schema: SCHEMA, archiveVersion: VERSION, engineVersion: String(engineVersion || ''),
      createdAt: new Date(now).toISOString(),
      source: {
        runId: String(run.id || ''), seed: Number(run.seed) >>> 0, stage: clampInt(run.stage, 1, 9999),
        act: clampInt(act ?? run.act ?? Math.ceil((Number(run.stage) || 1) / 10), 1, 999), difficulty: run.difficulty === 'hard' ? 'hard' : 'normal', reason
      },
      party, deck,
      artifacts: Array.from(new Set((run.artifacts || []).map(String))).sort(),
      baseEnergyBonus: clampInt(run.accountSnapshot?.baseEnergyBonus, 0, 9)
    };
    build.hash = hashBuild(build);
    build.id = `BUILD-${build.hash}-${fnv1a(`${build.source.runId}:${build.createdAt}`).slice(0, 4)}`;
    build.summary = summarize(build, cards);
    return build;
  }

  function summarize(build, cards = {}) {
    const byOwner = {};
    let upgraded = 0, maxed = 0;
    for (const card of build.deck) {
      const owner = cards[card.id]?.owner || card.id.split('_')[0];
      byOwner[owner] = (byOwner[owner] || 0) + 1;
      if (card.level > 1) upgraded++;
      if (card.level >= 5) maxed++;
    }
    const signatures = build.deck.filter(card => cards[card.id]?.pattern?.key === 'signature' || /_15$/.test(card.id)).map(card => ({ id: card.id, level: card.level }));
    return { cards: build.deck.length, upgraded, maxed, artifacts: build.artifacts.length, byOwner, signatures, label: `${build.party.map(member => member.name).join(' · ')}` };
  }

  /* Validate a stored or submitted build; returns the problems found. */
  function validate(build, { cards } = {}) {
    const problems = [];
    if (!build || typeof build !== 'object') return ['NOT_OBJECT'];
    if (build.schema !== SCHEMA) problems.push('SCHEMA');
    if (!Array.isArray(build.party) || build.party.length < 1 || build.party.length > 3) problems.push('PARTY');
    if (!Array.isArray(build.deck) || build.deck.length < 1) problems.push('DECK');
    if (!Array.isArray(build.artifacts)) problems.push('ARTIFACTS');
    if (problems.length) return problems;
    if (build.hash !== hashBuild(build)) problems.push('HASH');
    if (cards) {
      const partyIds = new Set(build.party.map(member => member.id));
      if (build.deck.some(card => !cards[card.id])) problems.push('UNKNOWN_CARD');
      else if (build.deck.some(card => !partyIds.has(cards[card.id].owner))) problems.push('FOREIGN_CARD');
    }
    if (build.deck.some(card => card.level < 1 || card.level > 5)) problems.push('CARD_LEVEL');
    return problems;
  }

  // ---- profile storage --------------------------------------------------
  function normalizeArchive(profile) {
    const source = profile?.buildArchive && typeof profile.buildArchive === 'object' ? profile.buildArchive : {};
    const slots = Array.from({ length: SLOT_LIMIT }, (_, index) => {
      const build = Array.isArray(source.slots) ? source.slots[index] : null;
      return build && typeof build === 'object' && !validate(build).length ? build : null;
    });
    return { version: VERSION, slots };
  }

  function listBuilds(profile) { return normalizeArchive(profile).slots; }
  function findBuild(profile, buildId) { return listBuilds(profile).find(build => build && build.id === buildId) || null; }

  /* Store `build` in `slot` (overwriting).  Idempotent per transaction id. */
  function saveBuild(profile, build, { slot, transactionId, now = Date.now() } = {}) {
    const index = clampInt(slot, 0, SLOT_LIMIT - 1);
    if (!Number.isInteger(Number(slot)) || Number(slot) !== index) return { profile, saved: false, reason: 'SLOT' };
    const problems = validate(build);
    if (problems.length) return { profile, saved: false, reason: problems[0] };
    const next = clone(profile) || {};
    next.transactionLedger = next.transactionLedger && typeof next.transactionLedger === 'object' ? next.transactionLedger : {};
    if (transactionId && next.transactionLedger[transactionId]) return { profile, saved: false, reason: 'DUPLICATE' };
    const archive = normalizeArchive(next);
    const replaced = archive.slots[index];
    archive.slots[index] = clone(build);
    next.buildArchive = archive;
    if (transactionId) next.transactionLedger[transactionId] = { kind: 'BUILD_SAVE', buildId: build.id, slot: index, replaced: replaced?.id || null, committedAt: now };
    return { profile: next, saved: true, slot: index, replaced };
  }

  return Object.freeze({ VERSION, SCHEMA, SLOT_LIMIT, canonical, fnv1a, hashBuild, snapshot, summarize, validate, normalizeArchive, listBuilds, findBuild, saveBuild });
});
