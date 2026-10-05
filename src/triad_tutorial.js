(function attachTriadTutorial(root) {
  'use strict';

  const VERSION = 1;
  const BASE_AP = 3;
  const MAX_AP_BONUS = 2;
  const LESSONS = Object.freeze(['ATTACK', 'SHIELD', 'END_TURN', 'HEAL']);
  const ATTACK_KEYS = new Set(['strike', 'quick', 'heavy', 'mark', 'dot', 'burst', 'combo', 'scale', 'execute', 'signature', 'inferno', 'volley', 'ambush', 'overload']);
  const SHIELD_KEYS = new Set(['guard', 'counter', 'bastion']);
  const HEAL_KEYS = new Set(['heal', 'renewal']);

  function defaultState() {
    return {
      version: VERSION,
      status: 'BRIEFING',
      completed: false,
      skipped: false,
      lessonIndex: 0,
      lessons: { attack: false, shield: false, heal: false },
    };
  }

  function normalize(input, options = {}) {
    if (!input || typeof input !== 'object') {
      if (!options.legacyComplete) return defaultState();
      return { ...defaultState(), status: 'COMPLETE', completed: true, skipped: true };
    }
    const base = defaultState();
    const lessons = {
      attack: Boolean(input.lessons?.attack),
      shield: Boolean(input.lessons?.shield),
      heal: Boolean(input.lessons?.heal),
    };
    const completed = Boolean(input.completed);
    const status = completed ? 'COMPLETE' : ['BRIEFING', 'COMBAT', 'DEBRIEF'].includes(input.status) ? input.status : 'BRIEFING';
    const rawLessonIndex = Number(input.lessonIndex);
    const lessonIndex = Number.isFinite(rawLessonIndex) ? Math.floor(rawLessonIndex) : 0;
    return {
      ...base,
      ...input,
      version: VERSION,
      status,
      completed,
      skipped: Boolean(input.skipped),
      lessonIndex: Math.max(0, Math.min(LESSONS.length, lessonIndex)),
      lessons,
    };
  }

  function cardCategory(card) {
    const key = String(card?.pattern?.key || '');
    if (ATTACK_KEYS.has(key)) return 'ATTACK';
    if (SHIELD_KEYS.has(key)) return 'SHIELD';
    if (HEAL_KEYS.has(key)) return 'HEAL';
    return 'UTILITY';
  }

  function requirement(input) {
    const state = normalize(input);
    return state.status === 'COMBAT' ? LESSONS[state.lessonIndex] || null : null;
  }

  function checkCard(input, card) {
    const required = requirement(input);
    const actual = cardCategory(card);
    if (!required || required === actual) return { allowed: true, recommended: true, required, actual, message: '' };
    const labels = { ATTACK: '공격', SHIELD: '보호막', END_TURN: '턴 종료', HEAL: '회복' };
    return {
      allowed: true,
      recommended: false,
      required,
      actual,
      message: `튜토리얼 안내: ${labels[required]} 카드를 사용해 보면 좋습니다.`,
    };
  }

  function recordCard(input, card) {
    const state = normalize(input);
    const category = cardCategory(card);
    const required = requirement(state);
    if (!required || category !== required) return state;
    const lessons = { ...state.lessons };
    if (category === 'ATTACK') lessons.attack = true;
    if (category === 'SHIELD') lessons.shield = true;
    if (category === 'HEAL') lessons.heal = true;
    return { ...state, lessonIndex: Math.min(LESSONS.length, state.lessonIndex + 1), lessons };
  }

  function checkEndTurn(input) {
    const required = requirement(input);
    if (!required || required === 'END_TURN') return { allowed: true, recommended: true, required, message: '' };
    const labels = { ATTACK: '공격', SHIELD: '보호막', HEAL: '회복' };
    return { allowed: true, recommended: false, required, message: `튜토리얼 안내: ${labels[required] || '추천된'} 카드를 사용해 보면 좋습니다.` };
  }

  function recordEndTurn(input) {
    const state = normalize(input);
    if (requirement(state) !== 'END_TURN') return state;
    return { ...state, lessonIndex: Math.min(LESSONS.length, state.lessonIndex + 1) };
  }

  // Keep the guided deck tied to semantic card effects.  Numeric card suffixes
  // are retained below for legacy callers only; the runtime resolves this plan
  // against the active card catalogue so a reordered card list cannot strand
  // the HEAL lesson with no playable recovery card.
  function trainingCardPlan(coreIds) {
    const cores = (Array.isArray(coreIds) ? coreIds : []).map(String).filter(Boolean);
    if (!cores.length) return [];
    const owner = index => cores[index] || cores[0];
    return [
      { owner: owner(0), key: 'strike' },
      { owner: owner(1), key: 'guard' },
      { owner: owner(0), key: 'quick' },
      { owner: owner(1), key: 'heavy' },
      { owner: owner(2), key: 'heal' },
    ];
  }

  function trainingCardIds(coreIds) {
    const legacySlots = { strike: '01', guard: '02', quick: '03', heavy: '04', heal: '10' };
    return trainingCardPlan(coreIds).map(step => `${step.owner}_${legacySlots[step.key]}`);
  }

  const api = Object.freeze({
    VERSION,
    BASE_AP,
    MAX_AP_BONUS,
    LESSONS,
    defaultState,
    normalize,
    cardCategory,
    requirement,
    checkCard,
    recordCard,
    checkEndTurn,
    recordEndTurn,
    trainingCardPlan,
    trainingCardIds,
  });

  root.TRIAD_TUTORIAL = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
