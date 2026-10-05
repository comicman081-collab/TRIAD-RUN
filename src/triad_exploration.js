(function (global) {
  'use strict';

  const LANES = 3;
  const ACT_LENGTH = 10;
  const SIDE_TYPES = Object.freeze(['battle', 'elite', 'rest', 'event', 'battle', 'elite']);
  const LABELS = Object.freeze({
    battle: { icon: '⚔', name: '일반 전투', text: '카드 보상' },
    elite: { icon: '◆', name: '엘리트 전투', text: '강한 적 · 유물 기회' },
    rest: { icon: '✚', name: '안전 구역', text: '생존 아군 HP 25% 회복 · 전투불능 아군 HP 20%로 복귀' },
    event: { icon: '?', name: '미확인 구역', text: '사건 선택 · 보상 또는 전투' },
    boss: { icon: '☠', name: '보스 구역', text: '강적 · 희귀 유물' }
  });
  const EVENT_SCENARIOS = Object.freeze([
    Object.freeze({ id: 'SUPPLY_CACHE', title: '폐허 속 보급함', description: '봉인된 보급함 뒤에서 정체불명의 움직임이 감지됩니다. 보급품만 확보하거나 신호의 근원을 추적할 수 있습니다.', rewardKind: 'card', rewardLabel: '보급품 확보 · 카드 선택', fightLabel: '신호 추적 · 전투 후 카드 보상', enemyVariant: 'special' }),
    Object.freeze({ id: 'SEALED_RELIC', title: '봉인된 제식품', description: '잔해 속 제식품을 회수하려는 순간 경계 장치가 반응합니다. 유물을 회수하거나 장치의 주인을 제압할 수 있습니다.', rewardKind: 'artifact', rewardLabel: '제식품 회수 · 유물 선택', fightLabel: '경계 개체 제압 · 전투 후 카드 보상', enemyVariant: 'special' }),
    Object.freeze({ id: 'DISTRESS_SIGNAL', title: '끊긴 구조 신호', description: '구조 신호와 함께 남겨진 전술 데이터가 발견됐습니다. 데이터를 회수하거나 신호를 흉내 내는 개체를 조사할 수 있습니다.', rewardKind: 'card', rewardLabel: '전술 데이터 회수 · 카드 선택', fightLabel: '신호 조사 · 전투 후 카드 보상', enemyVariant: 'rare' })
  ]);

  function hash(input) {
    let value = 2166136261;
    for (const char of String(input)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
  }

  function tier(stageInAct) {
    return Math.min(4, Math.max(1, Math.ceil(Number(stageInAct || 1) / 3)));
  }

  function buildActMap(seed, mapStart) {
    const first = Math.max(1, Math.floor(Number(mapStart) || 1));
    const nodes = [];
    const edges = [];
    for (let index = 0; index < ACT_LENGTH; index++) {
      const stage = first + index;
      const boss = index === ACT_LENGTH - 1;
      // Sparse merge points interrupt the three-row lattice. Route edges below
      // are authoritative for both gameplay and the rendered road network.
      const narrow = index === 2 || index === 5 || index === 8;
      const omittedLane = narrow ? hash(`${seed}:${first}:${index}:gap`) % LANES : -1;
      for (let lane = 0; lane < LANES; lane++) {
        if (boss && lane !== 1) continue;
        if (narrow && lane === omittedLane) continue;
        const type = boss ? 'boss' : lane === 1 ? 'battle' : SIDE_TYPES[hash(`${seed}:${first}:${index}:${lane}`) % SIDE_TYPES.length];
        nodes.push({ id: `${stage}:${lane}`, stage, lane, type, tier: tier(index + 1) });
      }
    }
    for (let stage = first; stage < first + ACT_LENGTH - 1; stage++) {
      const fromNodes = nodes.filter(node => node.stage === stage);
      const toNodes = nodes.filter(node => node.stage === stage + 1);
      const add = (from, to) => {
        if (!edges.some(edge => edge.from === from.id && edge.to === to.id)) edges.push({ from: from.id, to: to.id });
      };
      for (const from of fromNodes) {
        const candidates = toNodes.filter(to => Math.abs(to.lane - from.lane) <= 1)
          .sort((a, b) => Math.abs(a.lane - from.lane) - Math.abs(b.lane - from.lane) || a.lane - b.lane);
        const primary = candidates[0] || toNodes[0];
        if (primary) add(from, primary);
        if (candidates[1] && hash(`${seed}:${stage}:${from.lane}:fork`) % 100 < 48) add(from, candidates[1]);
      }
      for (const to of toNodes) {
        if (edges.some(edge => edge.to === to.id)) continue;
        const source = fromNodes.slice().sort((a, b) => Math.abs(a.lane - to.lane) - Math.abs(b.lane - to.lane) || a.lane - b.lane)[0];
        if (source) add(source, to);
      }
    }
    return { version: 2, seed: String(seed), mapStart: first, mapEnd: first + ACT_LENGTH - 1, nodes, edges };
  }

  function reachable(map, stage, previousLane) {
    if (!map || !Array.isArray(map.nodes)) return [];
    const lane = Number(previousLane);
    const nodes = map.nodes.filter(node => node.stage === stage);
    if (stage === map.mapStart || !Number.isInteger(lane)) return nodes;
    if (Array.isArray(map.edges)) {
      const fromId = `${stage - 1}:${lane}`;
      const destinations = new Set(map.edges.filter(edge => edge.from === fromId).map(edge => edge.to));
      return nodes.filter(node => destinations.has(node.id));
    }
    return nodes.filter(node => Math.abs(node.lane - lane) <= 1);
  }

  function encounterVariant(seed, stage, lane, type) {
    if (!['battle', 'elite'].includes(type)) return 'normal';
    const roll = hash(`${seed}:${stage}:${lane}:encounter`) % 1000;
    return roll < 35 ? 'rare' : roll < 160 ? 'special' : 'normal';
  }

  function eventScenario(seed, stage, lane) {
    return EVENT_SCENARIOS[hash(`${seed}:${stage}:${lane}:event`) % EVENT_SCENARIOS.length];
  }

  function scaleEncounter(monster, zoneTier, variant = 'normal') {
    if (!monster || typeof monster !== 'object') return monster;
    const level = Math.max(1, Math.min(4, Number(zoneTier) || 1));
    const tierHp = 1 + (level - 1) * .10;
    const tierDamage = 1 + (level - 1) * .055;
    const variantHp = variant === 'rare' ? 1.35 : variant === 'special' ? 1.16 : 1;
    const variantDamage = variant === 'rare' ? 1.16 : variant === 'special' ? 1.07 : 1;
    return {
      ...monster,
      maxHp: Math.max(1, Math.round(monster.maxHp * tierHp * variantHp)),
      skills: (monster.skills || []).map(skill => ({ ...skill, medianDamage: Math.max(0, Math.round(skill.medianDamage * tierDamage * variantDamage)) })),
      exploration: { tier: level, variant }
    };
  }

  function intent(monster, turn, variant, ordinaryIntent) {
    if (variant === 'normal' || !monster?.skills?.length) return ordinaryIntent;
    if (variant === 'special') {
      const skill = monster.skills[turn % monster.skills.length];
      return { skillId: skill.id, skillName: skill.name, damage: skill.medianDamage, hits: skill.hits, target: skill.target, elementId: skill.elementId, effectLabel: '변이 패턴' };
    }
    const surge = turn % 3 === 0;
    return { ...ordinaryIntent, damage: surge ? Math.round(ordinaryIntent.damage * 1.15) : ordinaryIntent.damage, hits: surge && ordinaryIntent.target !== 'all' ? ordinaryIntent.hits + 1 : ordinaryIntent.hits, effectLabel: surge ? '희귀종 · 연쇄 공격' : '희귀종 · 강화' };
  }

  function ambush(seed, stage, lane, wins, enabled) {
    return Boolean(enabled && hash(`${seed}:${stage}:${lane}:${wins}:ambush`) % 1000 < 55);
  }

  const api = Object.freeze({ LANES, ACT_LENGTH, LABELS, EVENT_SCENARIOS, hash, tier, buildActMap, reachable, encounterVariant, eventScenario, scaleEncounter, intent, ambush });
  global.TRIAD_EXPLORATION = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
