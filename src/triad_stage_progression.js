(function (global) {
  'use strict';

  const ACT_LENGTH = 10;
  const LEGACY_CONTENT_ACTS = 3;
  const BATTLE_BACKGROUND_COUNT = 10;
  const BATTLE_BACKGROUND_SPAN = 3;
  // JavaScript cannot represent consecutive integers beyond MAX_SAFE_INTEGER.
  // Keep a ten-node map inside the safe range so hostile/corrupt stage values
  // cannot produce duplicate node IDs or non-finite scaled combat stats.
  const MAX_STAGE = Number.MAX_SAFE_INTEGER - ACT_LENGTH;

  const positiveStage = value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 1;
    return Math.min(MAX_STAGE, Math.max(1, Math.floor(numeric)));
  };

  function stageInfo(value) {
    const stage = positiveStage(value);
    const act = Math.ceil(stage / ACT_LENGTH);
    const stageInAct = ((stage - 1) % ACT_LENGTH) + 1;
    const mapStart = (act - 1) * ACT_LENGTH + 1;
    const contentAct = Math.min(LEGACY_CONTENT_ACTS, act);
    const overflowTier = Math.max(0, act - LEGACY_CONTENT_ACTS);
    const battleBackgroundIndex = ((Math.ceil(stage / BATTLE_BACKGROUND_SPAN) - 1) % BATTLE_BACKGROUND_COUNT) + 1;
    return {
      stage,
      act,
      stageInAct,
      isBoss: stageInAct === ACT_LENGTH,
      mapStart,
      mapEnd: mapStart + ACT_LENGTH - 1,
      contentAct,
      overflowTier,
      battleBackgroundIndex
    };
  }

  function mapStages(stage) {
    const info = stageInfo(stage);
    return Array.from({ length: ACT_LENGTH }, (_, index) => info.mapStart + index);
  }

  function enemyScale(stage) {
    const { overflowTier } = stageInfo(stage);
    return {
      hp: 1 + overflowTier * 0.18,
      damage: 1 + overflowTier * 0.10
    };
  }

  function scaleMonster(monster, stage) {
    if (!monster || typeof monster !== 'object') return monster;
    const scale = enemyScale(stage);
    if (scale.hp === 1 && scale.damage === 1) return monster;
    return {
      ...monster,
      maxHp: Math.max(1, Math.round(Number(monster.maxHp || 1) * scale.hp)),
      skills: (Array.isArray(monster.skills) ? monster.skills : []).map(skill => ({
        ...skill,
        medianDamage: Math.max(0, Math.round(Number(skill.medianDamage || 0) * scale.damage))
      })),
      progression: { sourceAct: monster.act || null, overflowTier: stageInfo(stage).overflowTier, hpScale: scale.hp, damageScale: scale.damage }
    };
  }

  const api = Object.freeze({
    ACT_LENGTH,
    LEGACY_CONTENT_ACTS,
    BATTLE_BACKGROUND_COUNT,
    BATTLE_BACKGROUND_SPAN,
    MAX_STAGE,
    stageInfo,
    mapStages,
    enemyScale,
    scaleMonster
  });

  global.TRIAD_STAGE_PROGRESSION = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
