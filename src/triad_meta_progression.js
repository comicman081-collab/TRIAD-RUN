(function (global) {
  'use strict';

  const PROFILE_KEY = 'triad_profile_v1';
  const PROFILE_VERSION = 2;
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;
  const DAILY_RESET_OFFSET_HOURS = 9;
  const IDLE_FULL_RATE_HOURS = 24;
  const IDLE_REDUCED_RATE_HOURS = 24;
  const IDLE_MAX_HOURS = 48;
  const IDLE_RATES = Object.freeze({ credits: 40, signal: 1, cardMatrices: 1, memory: 12 });
  const GACHA_SINGLE_COST = 100;
  const GACHA_MULTI_COUNT = 10;
  // Recruit banner rates: SSR characters share 2% equally, cards share the rest equally.
  const GACHA_SSR_RATE = 0.02;
  const GACHA_SSR_OVERFLOW_MEMORY = 360;
  const GACHA_CARD_OVERFLOW_MATRICES = 3;
  // Every pull adds one mileage point; 200 points buy one SSR of the player's
  // choice.  Mileage never resets and keeps stacking past 200.
  const GACHA_MILEAGE_COST = 200;
  const MAX_BASE_ENERGY_BONUS = 2;
  const BREAKTHROUGH_MAX = 5;
  const BREAKTHROUGH_COSTS = Object.freeze([120, 180, 240, 300, 360]);

  const LOBBY_BACKGROUNDS = Object.freeze([
    { id: 'LOBBY-BG-01', name: '검은 비의 거리', unlockStage: 0, path: 'assets/battle_backgrounds/stage01_b_black_rain_avenue.webp' },
    { id: 'LOBBY-BG-02', name: '침수 지하도', unlockStage: 10, path: 'assets/battle_backgrounds/stage02_b_drowned_underpass.webp' },
    { id: 'LOBBY-BG-03', name: '붕괴 터빈 홀', unlockStage: 20, path: 'assets/battle_backgrounds/stage03_b_ruined_turbine_hall.webp' },
    { id: 'LOBBY-BG-04', name: '일식 과수원', unlockStage: 30, path: 'assets/battle_backgrounds/stage04_b_eclipse_orchard.webp' },
    { id: 'LOBBY-BG-05', name: '산산이 부서진 본당', unlockStage: 40, path: 'assets/battle_backgrounds/stage05_b_shattered_nave.webp' },
    { id: 'LOBBY-BG-06', name: '동결 댐', unlockStage: 50, path: 'assets/battle_backgrounds/stage06_b_frozen_dam.webp' },
    { id: 'LOBBY-BG-07', name: '붕괴 메가브리지', unlockStage: 60, path: 'assets/battle_backgrounds/stage07_b_collapsed_megabridge.webp' },
    { id: 'LOBBY-BG-08', name: '격리 온실', unlockStage: 70, path: 'assets/battle_backgrounds/stage08_b_quarantine_greenhouse.webp' },
    { id: 'LOBBY-BG-09', name: '해상 플랫폼', unlockStage: 80, path: 'assets/battle_backgrounds/stage09_b_offshore_platform.webp' },
    { id: 'LOBBY-BG-10', name: '궤도 성소', unlockStage: 90, path: 'assets/battle_backgrounds/stage10_b_orbital_sanctum.webp' }
  ].map(Object.freeze));

  const SHOP_ITEMS = Object.freeze([
    { id: 'CARD_MATRIX_PACK', name: '카드 강화 매트릭스', text: '카드 강화 재료 3개', currency: 'credits', cost: 120, grant: { cardMatrices: 3 } },
    { id: 'MEMORY_PACK', name: '전술 기억 데이터', text: '캐릭터 성장 재화 120', currency: 'credits', cost: 100, grant: { memory: 120 } },
    { id: 'ACTION_CELL', name: '행동력 확장 셀', text: '새 런의 기본 에너지 +1 (최대 +2)', currency: 'credits', cost: 700, permanent: 'baseEnergyBonus', max: MAX_BASE_ENERGY_BONUS }
  ].map(Object.freeze));

  const clampInt = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
  const uniqueStrings = values => [...new Set((Array.isArray(values) ? values : []).filter(value => typeof value === 'string' && value))];
  const copy = value => JSON.parse(JSON.stringify(value));

  function unlockedBackgroundIds(maxStageCleared = 0) {
    const stage = clampInt(maxStageCleared);
    return LOBBY_BACKGROUNDS.filter(background => stage >= background.unlockStage).map(background => background.id);
  }

  function defaultProfile(now = Date.now(), rosterIds = []) {
    const ownedCharacterIds = uniqueStrings(rosterIds);
    return {
      profileVersion: PROFILE_VERSION,
      createdAt: now,
      updatedAt: now,
      wallet: { credits: 0, signal: 0, cardMatrices: 0, memory: 0 },
      inventory: {},
      cardCollection: {},
      characterBreakthroughs: {},
      ownedCharacterIds,
      selectedLobbyCharacterId: ownedCharacterIds[0] || null,
      maxStageCleared: 0,
      totalStagesCleared: 0,
      baseEnergyBonus: 0,
      unlockedLobbyBackgroundIds: ['LOBBY-BG-01'],
      selectedLobbyBackgroundId: 'LOBBY-BG-01',
      idle: { lastClaimAt: now, lastPreviewAt: now },
      gachaHistory: [],
      recruitMileage: 0,
      transactionLedger: {}
    };
  }

  function normalizeProfile(input, now = Date.now(), rosterIds = []) {
    const source = input && typeof input === 'object' ? copy(input) : {};
    const fallback = defaultProfile(now, rosterIds);
    const ownedCharacterIds = uniqueStrings([...(source.ownedCharacterIds || []), ...rosterIds]);
    const maxStageCleared = clampInt(source.maxStageCleared);
    const unlocked = uniqueStrings([...unlockedBackgroundIds(maxStageCleared), ...(source.unlockedLobbyBackgroundIds || [])])
      .filter(id => LOBBY_BACKGROUNDS.some(background => background.id === id));
    const selectedBackground = unlocked.includes(source.selectedLobbyBackgroundId) ? source.selectedLobbyBackgroundId : unlocked[0] || 'LOBBY-BG-01';
    const selectedCharacter = ownedCharacterIds.includes(source.selectedLobbyCharacterId) ? source.selectedLobbyCharacterId : ownedCharacterIds[0] || null;
    const cardCollection = {};
    for (const [id, state] of Object.entries(source.cardCollection || {})) {
      if (!id || !state || typeof state !== 'object') continue;
      cardCollection[id] = { level: clampInt(state.level, 1, 5), purchasedAt: clampInt(state.purchasedAt || now) };
    }
    const characterBreakthroughs = {};
    for (const [id, level] of Object.entries(source.characterBreakthroughs || {})) {
      if (!ownedCharacterIds.includes(id)) continue;
      characterBreakthroughs[id] = clampInt(level, 0, BREAKTHROUGH_MAX);
    }
    const transactionLedger = {};
    for (const [id, entry] of Object.entries(source.transactionLedger || {})) {
      if (id && entry && typeof entry === 'object') transactionLedger[id] = entry;
    }
    const gachaHistory = Array.isArray(source.gachaHistory)
      ? source.gachaHistory.filter(entry => entry && typeof entry === 'object' && typeof entry.characterId === 'string').slice(-100)
      : [];
    return {
      ...fallback,
      ...source,
      profileVersion: PROFILE_VERSION,
      createdAt: clampInt(source.createdAt || now),
      updatedAt: now,
      wallet: {
        credits: clampInt(source.wallet?.credits),
        signal: clampInt(source.wallet?.signal),
        cardMatrices: clampInt(source.wallet?.cardMatrices),
        memory: clampInt(source.wallet?.memory)
      },
      inventory: source.inventory && typeof source.inventory === 'object' ? source.inventory : {},
      cardCollection,
      characterBreakthroughs,
      ownedCharacterIds,
      selectedLobbyCharacterId: selectedCharacter,
      maxStageCleared,
      totalStagesCleared: clampInt(source.totalStagesCleared),
      baseEnergyBonus: clampInt(source.baseEnergyBonus, 0, MAX_BASE_ENERGY_BONUS),
      unlockedLobbyBackgroundIds: unlocked,
      selectedLobbyBackgroundId: selectedBackground,
      idle: {
        lastClaimAt: clampInt(source.idle?.lastClaimAt || now),
        lastPreviewAt: clampInt(source.idle?.lastPreviewAt || now)
      },
      gachaHistory,
      recruitMileage: clampInt(source.recruitMileage),
      transactionLedger
    };
  }

  function effectiveIdleHours(lastClaimAt, now = Date.now()) {
    const rawDeltaMs = Number(now) - Number(lastClaimAt);
    const clockRollback = rawDeltaMs < 0;
    const elapsedSinceClaimHours = Math.max(0, rawDeltaMs / HOUR_MS);
    const elapsedHours = Math.min(IDLE_MAX_HOURS, elapsedSinceClaimHours);
    const full = Math.min(IDLE_FULL_RATE_HOURS, elapsedHours);
    const reduced = Math.min(IDLE_REDUCED_RATE_HOURS, Math.max(0, elapsedHours - IDLE_FULL_RATE_HOURS));
    const capped = elapsedSinceClaimHours >= IDLE_MAX_HOURS;
    const accrualPhase = clockRollback
      ? 'CLOCK_ROLLBACK'
      : capped
        ? 'STOPPED'
        : elapsedSinceClaimHours >= IDLE_FULL_RATE_HOURS
          ? 'REDUCED'
          : 'FULL';
    const accrualRate = accrualPhase === 'FULL' ? 1 : accrualPhase === 'REDUCED' ? 0.5 : 0;
    return {
      elapsedSinceClaimHours,
      elapsedHours,
      fullRateHours: full,
      reducedRateHours: reduced,
      effectiveHours: full + reduced * 0.5,
      accrualRate,
      currentRatePercent: accrualRate * 100,
      accrualPhase,
      clockRollback,
      capped
    };
  }

  function previewIdle(profile, now = Date.now()) {
    const state = effectiveIdleHours(profile?.idle?.lastClaimAt || now, now);
    const rewards = Object.fromEntries(Object.entries(IDLE_RATES).map(([key, rate]) => [key, Math.floor(rate * state.effectiveHours)]));
    return { ...state, rewards, claimable: Object.values(rewards).some(value => value > 0) };
  }

  function addWallet(profile, grant = {}) {
    for (const key of Object.keys(profile.wallet)) profile.wallet[key] = clampInt(profile.wallet[key] + clampInt(grant[key]));
  }

  function claimIdle(input, now = Date.now(), rosterIds = [], requestedTransactionId = '') {
    const profile = normalizeProfile(input, now, rosterIds);
    const claimAnchor = profile.idle.lastClaimAt;
    const transactionId = String(requestedTransactionId || `IDLE:${claimAnchor}:${clampInt(now)}`);
    if (profile.transactionLedger[transactionId]) {
      return { profile, preview: previewIdle(profile, now), claimed: false, reason: 'DUPLICATE', transactionId };
    }
    const preview = previewIdle(profile, now);
    if (!preview.claimable) return { profile, preview, claimed: false, reason: 'NOT_READY', transactionId };
    commitOnce(profile, transactionId, { kind: 'IDLE_CLAIM', claimAnchor, claimedAt: now, rewards: preview.rewards }, now);
    addWallet(profile, preview.rewards);
    profile.idle.lastClaimAt = now;
    profile.idle.lastPreviewAt = now;
    profile.updatedAt = now;
    return { profile, preview, claimed: true, transactionId };
  }

  function stageClearReward(stage, type = 'battle') {
    const act = Math.max(1, Math.ceil(clampInt(stage, 1) / 10));
    const rank = type === 'boss' ? 3 : type === 'elite' ? 2 : ['rest', 'event'].includes(type) ? 0 : 1;
    return {
      credits: 20 + rank * 25 + (act - 1) * 5,
      signal: rank === 3 ? 20 : rank === 2 ? 6 : rank === 1 ? 3 : 1,
      cardMatrices: rank === 3 ? 4 : rank === 2 ? 2 : 1,
      memory: 10 + rank * 15 + (act - 1) * 3
    };
  }

  function commitOnce(profile, transactionId, payload, committedAt = Date.now()) {
    if (!transactionId || profile.transactionLedger[transactionId]) return false;
    profile.transactionLedger[transactionId] = { ...payload, committedAt: clampInt(committedAt) };
    const ids = Object.keys(profile.transactionLedger);
    if (ids.length > 500) for (const id of ids.slice(0, ids.length - 500)) delete profile.transactionLedger[id];
    return true;
  }

  function applyStageClear(input, detail, rosterIds = []) {
    const now = detail?.now || Date.now();
    const profile = normalizeProfile(input, now, rosterIds);
    const stage = clampInt(detail?.stage, 1);
    const transactionId = String(detail?.transactionId || `STAGE:${stage}:${detail?.type || 'battle'}`);
    const rewards = stageClearReward(stage, detail?.type);
    if (!commitOnce(profile, transactionId, { kind: 'STAGE_CLEAR', stage, type: detail?.type || 'battle', rewards }, now)) return { profile, rewards, committed: false, unlocked: [] };
    addWallet(profile, rewards);
    profile.maxStageCleared = Math.max(profile.maxStageCleared, stage);
    profile.totalStagesCleared++;
    const before = new Set(profile.unlockedLobbyBackgroundIds);
    profile.unlockedLobbyBackgroundIds = unlockedBackgroundIds(profile.maxStageCleared);
    const unlocked = profile.unlockedLobbyBackgroundIds.filter(id => !before.has(id));
    profile.updatedAt = now;
    return { profile, rewards, committed: true, unlocked };
  }

  function purchaseShopItem(input, itemId, transactionId, now = Date.now(), rosterIds = []) {
    const profile = normalizeProfile(input, now, rosterIds);
    const item = SHOP_ITEMS.find(entry => entry.id === itemId);
    if (!item) return { profile, purchased: false, reason: 'UNKNOWN_ITEM' };
    if (transactionId && profile.transactionLedger[transactionId]) return { profile, purchased: false, reason: 'DUPLICATE' };
    if (item.permanent === 'baseEnergyBonus' && profile.baseEnergyBonus >= item.max) return { profile, purchased: false, reason: 'MAXED' };
    if (profile.wallet[item.currency] < item.cost) return { profile, purchased: false, reason: 'INSUFFICIENT_FUNDS' };
    profile.wallet[item.currency] -= item.cost;
    if (item.grant) addWallet(profile, item.grant);
    if (item.permanent === 'baseEnergyBonus') profile.baseEnergyBonus = clampInt(profile.baseEnergyBonus + 1, 0, item.max);
    commitOnce(profile, transactionId || `SHOP:${itemId}:${now}`, { kind: 'SHOP_ITEM', itemId, cost: item.cost }, now);
    profile.updatedAt = now;
    return { profile, purchased: true, item };
  }

  function purchaseCard(input, cardId, cost = 240, transactionId, now = Date.now(), rosterIds = []) {
    const profile = normalizeProfile(input, now, rosterIds);
    if (!cardId) return { profile, purchased: false, reason: 'UNKNOWN_CARD' };
    if (transactionId && profile.transactionLedger[transactionId]) return { profile, purchased: false, reason: 'DUPLICATE' };
    if (profile.cardCollection[cardId]) return { profile, purchased: false, reason: 'OWNED' };
    if (profile.wallet.credits < cost) return { profile, purchased: false, reason: 'INSUFFICIENT_FUNDS' };
    profile.wallet.credits -= cost;
    profile.cardCollection[cardId] = { level: 1, purchasedAt: now };
    commitOnce(profile, transactionId || `SHOP_CARD:${cardId}:${now}`, { kind: 'SHOP_CARD', cardId, cost }, now);
    profile.updatedAt = now;
    return { profile, purchased: true, cardId };
  }

  function cardUpgradeCost(currentLevel = 1) {
    return clampInt(currentLevel, 1, 4) * 2;
  }

  function upgradeCard(input, cardId, transactionId, now = Date.now(), rosterIds = []) {
    const profile = normalizeProfile(input, now, rosterIds);
    if (transactionId && profile.transactionLedger[transactionId]) return { profile, upgraded: false, reason: 'DUPLICATE' };
    const state = profile.cardCollection[cardId];
    if (!state) return { profile, upgraded: false, reason: 'NOT_OWNED' };
    if (state.level >= 5) return { profile, upgraded: false, reason: 'MAXED' };
    const cost = cardUpgradeCost(state.level);
    if (profile.wallet.cardMatrices < cost) return { profile, upgraded: false, reason: 'INSUFFICIENT_MATERIALS', cost };
    profile.wallet.cardMatrices -= cost;
    state.level++;
    commitOnce(profile, transactionId || `UPGRADE_CARD:${cardId}:${now}`, { kind: 'CARD_UPGRADE', cardId, level: state.level, cost }, now);
    profile.updatedAt = now;
    return { profile, upgraded: true, cardId, level: state.level, cost };
  }

  function characterBreakthrough(profile, characterId) {
    return clampInt(profile?.characterBreakthroughs?.[characterId], 0, BREAKTHROUGH_MAX);
  }

  function breakthroughCost(currentLevel = 0) {
    return BREAKTHROUGH_COSTS[clampInt(currentLevel, 0, BREAKTHROUGH_MAX - 1)] || 0;
  }

  function upgradeCharacter(input, characterId, transactionId, now = Date.now(), rosterIds = []) {
    const profile = normalizeProfile(input, now, rosterIds);
    const id = String(characterId || '');
    if (transactionId && profile.transactionLedger[transactionId]) return { profile, upgraded: false, reason: 'DUPLICATE' };
    if (!profile.ownedCharacterIds.includes(id)) return { profile, upgraded: false, reason: 'NOT_OWNED' };
    const level = characterBreakthrough(profile, id);
    if (level >= BREAKTHROUGH_MAX) return { profile, upgraded: false, reason: 'MAXED', level };
    const cost = breakthroughCost(level);
    if (profile.wallet.memory < cost) return { profile, upgraded: false, reason: 'INSUFFICIENT_MEMORY', cost, level };
    profile.wallet.memory -= cost;
    profile.characterBreakthroughs[id] = level + 1;
    commitOnce(profile, transactionId || `UPGRADE_CHARACTER:${id}:${now}`, { kind: 'CHARACTER_BREAKTHROUGH', characterId: id, level: level + 1, cost }, now);
    profile.updatedAt = now;
    return { profile, upgraded: true, characterId: id, level: level + 1, cost };
  }

  function selectLobbyBackground(input, backgroundId, now = Date.now(), rosterIds = []) {
    const profile = normalizeProfile(input, now, rosterIds);
    if (!profile.unlockedLobbyBackgroundIds.includes(backgroundId)) return { profile, selected: false };
    profile.selectedLobbyBackgroundId = backgroundId;
    profile.updatedAt = now;
    return { profile, selected: true };
  }

  // Character recruitment is deliberately asset-gated.  A future character is
  // not drawable until its full art, lobby RGBA and frozen SD manifest are all
  // registered by the canonical roster.  This keeps the CPU-only meta system
  // from exposing placeholder or GPU-pending characters.
  function assetReady(record) {
    const hasText = value => typeof value === 'string' && value.trim().length > 0;
    return Boolean(
      record && hasText(record.id)
      && record.sd?.status === 'PASS_ACTIVE_FINAL' && hasText(record.sd?.manifest)
      && record.lobbyArt?.status === 'PASS_ACTIVE'
      && record.lobbyArt?.assetType === 'NON_SD_CHARACTER_RGBA'
      && record.lobbyArt?.backgroundPolicy === 'TRANSPARENT_ONLY'
      && record.lobbyArt?.backgroundRemoved === true
      && record.lobbyArt?.alphaValidated === true
      && hasText(record.lobbyArt?.path) && hasText(record.fullArt)
    );
  }

  function recruitable(record) {
    return Boolean(record && record.enabled === true && record.acquisition === 'GACHA' && record.gachaEligible === true && assetReady(record));
  }

  // Banner SSR: every playable character, starters included.  Starters are
  // owned from the first launch, so pulling one always becomes a breakthrough.
  function bannerCharacter(record) {
    return Boolean(record && record.enabled === true && (recruitable(record) || (record.acquisition === 'STARTER' && assetReady(record))));
  }

  function gachaCandidates(records = [], profile = {}) {
    const owned = new Set(Array.isArray(profile?.ownedCharacterIds) ? profile.ownedCharacterIds : []);
    return (Array.isArray(records) ? records : [])
      .filter(record => recruitable(record) && !owned.has(record.id))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  function gachaReceipt(profile, transactionId, records = []) {
    const ledgerEntry = profile?.transactionLedger?.[transactionId];
    const historyEntry = Array.isArray(profile?.gachaHistory)
      ? profile.gachaHistory.find(entry => entry?.transactionId === transactionId)
      : null;
    const entry = ledgerEntry?.kind === 'CHARACTER_GACHA' ? ledgerEntry : historyEntry;
    if (!entry || typeof entry.characterId !== 'string') return null;
    const record = (Array.isArray(records) ? records : []).find(candidate => candidate?.id === entry.characterId);
    return {
      transactionId,
      characterId: entry.characterId,
      cost: clampInt(entry.cost || GACHA_SINGLE_COST),
      record: record || null
    };
  }

  function drawCharacter(input, records, transactionId, now = Date.now(), random = 0.5, rosterIds = []) {
    const profile = normalizeProfile(input, now, rosterIds);
    const id = String(transactionId || `GACHA:${now}`);
    const priorReceipt = gachaReceipt(profile, id, records);
    if (priorReceipt) {
      return {
        profile,
        drawn: true,
        replayed: true,
        reason: 'DRAWN',
        ...priorReceipt
      };
    }
    if (profile.transactionLedger[id]) return { profile, drawn: false, replayed: false, reason: 'DUPLICATE', transactionId: id, characterId: null };
    const candidates = gachaCandidates(records, profile);
    if (!candidates.length) return { profile, drawn: false, reason: 'NO_AVAILABLE_CHARACTERS', transactionId: id, characterId: null };
    if (profile.wallet.signal < GACHA_SINGLE_COST) {
      return { profile, drawn: false, reason: 'INSUFFICIENT_SIGNAL', transactionId: id, characterId: null, cost: GACHA_SINGLE_COST };
    }
    const rollValue = typeof random === 'function' ? random(candidates) : random;
    const safeRoll = Math.max(0, Math.min(0.999999999, Number(rollValue) || 0));
    const record = candidates[Math.floor(safeRoll * candidates.length)];
    const receipt = { kind: 'CHARACTER_GACHA', characterId: record.id, cost: GACHA_SINGLE_COST, result: 'DRAWN' };
    const nextProfile = normalizeProfile(profile, now, rosterIds);
    nextProfile.wallet.signal -= GACHA_SINGLE_COST;
    nextProfile.ownedCharacterIds = uniqueStrings([...nextProfile.ownedCharacterIds, record.id]);
    nextProfile.gachaHistory = [...(Array.isArray(nextProfile.gachaHistory) ? nextProfile.gachaHistory : []), {
      transactionId: id, characterId: record.id, cost: GACHA_SINGLE_COST, result: 'DRAWN', pulledAt: clampInt(now)
    }].slice(-100);
    if (!commitOnce(nextProfile, id, receipt, now)) {
      return { profile, drawn: false, replayed: false, reason: 'DUPLICATE', transactionId: id, characterId: null };
    }
    nextProfile.updatedAt = now;
    return { profile: nextProfile, drawn: true, replayed: false, reason: 'DRAWN', transactionId: id, characterId: record.id, record, cost: GACHA_SINGLE_COST, receipt };
  }

  // Recruit banner pool.  Every asset-gated SSR character stays in the pool
  // whether owned or not, so the published per-character rate never drifts;
  // duplicates convert into growth instead.  Signature cards are excluded,
  // matching the card shop.
  function recruitPool(records = [], cardIds = []) {
    const ssr = (Array.isArray(records) ? records : []).filter(bannerCharacter).sort((left, right) => left.id.localeCompare(right.id));
    const cards = uniqueStrings(cardIds).sort();
    const ssrRate = ssr.length ? (cards.length ? GACHA_SSR_RATE : 1) : 0;
    return { ssr, cards, ssrRate, cardRate: cards.length ? 1 - ssrRate : 0 };
  }

  function recruitRates(records = [], cardIds = []) {
    const pool = recruitPool(records, cardIds);
    const ssrEach = pool.ssr.length ? pool.ssrRate / pool.ssr.length : 0;
    const cardEach = pool.cards.length ? pool.cardRate / pool.cards.length : 0;
    return {
      ssrRate: pool.ssrRate,
      cardRate: pool.cardRate,
      ssrEach,
      cardEach,
      ssr: pool.ssr.map(record => ({ kind: 'SSR', id: record.id, rate: ssrEach })),
      cards: pool.cards.map(id => ({ kind: 'CARD', id, rate: cardEach }))
    };
  }

  // One uniform roll per pull: [0, ssrRate) picks an SSR, the rest picks a
  // card, and each band is cut into equal slices.
  function recruitRoll(pool, roll) {
    const value = Math.max(0, Math.min(0.999999999, Number(roll) || 0));
    if (value < pool.ssrRate) {
      return { kind: 'SSR', id: pool.ssr[Math.min(pool.ssr.length - 1, Math.floor(value / pool.ssrRate * pool.ssr.length))].id };
    }
    const band = (value - pool.ssrRate) / (1 - pool.ssrRate);
    return { kind: 'CARD', id: pool.cards[Math.min(pool.cards.length - 1, Math.floor(band * pool.cards.length))] };
  }

  // New SSR joins the roster; a duplicate becomes a free breakthrough, then
  // growth data once maxed.  A new card is unlocked at Lv1; a duplicate levels
  // it up, then becomes enhancement matrices at Lv5.
  function grantRecruit(profile, pull, now) {
    if (pull.kind === 'SSR') {
      if (!profile.ownedCharacterIds.includes(pull.id)) {
        profile.ownedCharacterIds = uniqueStrings([...profile.ownedCharacterIds, pull.id]);
        return { ...pull, outcome: 'NEW' };
      }
      const level = characterBreakthrough(profile, pull.id);
      if (level < BREAKTHROUGH_MAX) {
        profile.characterBreakthroughs[pull.id] = level + 1;
        return { ...pull, outcome: 'BREAKTHROUGH', level: level + 1 };
      }
      addWallet(profile, { memory: GACHA_SSR_OVERFLOW_MEMORY });
      return { ...pull, outcome: 'CONVERTED', level, grant: { memory: GACHA_SSR_OVERFLOW_MEMORY } };
    }
    const state = profile.cardCollection[pull.id];
    if (!state) {
      profile.cardCollection[pull.id] = { level: 1, purchasedAt: clampInt(now) };
      return { ...pull, outcome: 'NEW', level: 1 };
    }
    if (state.level < 5) {
      state.level++;
      return { ...pull, outcome: 'LEVEL_UP', level: state.level };
    }
    addWallet(profile, { cardMatrices: GACHA_CARD_OVERFLOW_MATRICES });
    return { ...pull, outcome: 'CONVERTED', level: 5, grant: { cardMatrices: GACHA_CARD_OVERFLOW_MATRICES } };
  }

  function drawRecruit(input, records, cardIds, transactionId, now = Date.now(), random = 0.5, rosterIds = [], count = 1) {
    const profile = normalizeProfile(input, now, rosterIds);
    const id = String(transactionId || `RECRUIT:${now}`);
    const prior = profile.transactionLedger[id];
    if (prior?.kind === 'RECRUIT_BANNER' && Array.isArray(prior.results)) {
      return { profile, pulled: true, replayed: true, reason: 'PULLED', transactionId: id, count: prior.results.length, cost: clampInt(prior.cost), results: copy(prior.results), mileage: profile.recruitMileage };
    }
    if (prior) return { profile, pulled: false, replayed: false, reason: 'DUPLICATE', transactionId: id, results: [] };
    const pulls = clampInt(count, 1, GACHA_MULTI_COUNT);
    const cost = pulls * GACHA_SINGLE_COST;
    const pool = recruitPool(records, cardIds);
    if (!pool.ssr.length && !pool.cards.length) return { profile, pulled: false, replayed: false, reason: 'NO_RECRUIT_POOL', transactionId: id, cost, results: [] };
    if (profile.wallet.signal < cost) return { profile, pulled: false, replayed: false, reason: 'INSUFFICIENT_SIGNAL', transactionId: id, cost, results: [] };
    const rolls = Array.from({ length: pulls }, (_, index) => (typeof random === 'function' ? random(index) : random));
    profile.wallet.signal -= cost;
    profile.recruitMileage = clampInt(profile.recruitMileage + pulls);
    const results = rolls.map((roll, index) => ({ index, ...grantRecruit(profile, recruitRoll(pool, roll), now) }));
    for (const result of results) {
      if (result.kind !== 'SSR' || result.outcome !== 'NEW') continue;
      profile.gachaHistory = [...profile.gachaHistory, {
        transactionId: `${id}#${result.index}`, characterId: result.id, cost: GACHA_SINGLE_COST, result: 'DRAWN', pulledAt: clampInt(now)
      }].slice(-100);
    }
    commitOnce(profile, id, { kind: 'RECRUIT_BANNER', count: pulls, cost, results, mileage: pulls }, now);
    profile.updatedAt = now;
    return { profile, pulled: true, replayed: false, reason: 'PULLED', transactionId: id, count: pulls, cost, results: copy(results), mileage: profile.recruitMileage };
  }

  // Spend 200 mileage on one banner SSR of the player's choice.  A character
  // already owned gains a breakthrough; a fully broken-through one is refused
  // so mileage is never wasted.
  function exchangeMileage(input, records, characterId, transactionId, now = Date.now(), rosterIds = []) {
    const profile = normalizeProfile(input, now, rosterIds);
    const id = String(transactionId || `MILEAGE:${now}`);
    const prior = profile.transactionLedger[id];
    if (prior?.kind === 'MILEAGE_EXCHANGE' && prior.result) {
      return { profile, exchanged: true, replayed: true, reason: 'EXCHANGED', transactionId: id, cost: GACHA_MILEAGE_COST, result: copy(prior.result), mileage: profile.recruitMileage };
    }
    const fail = reason => ({ profile, exchanged: false, replayed: false, reason, transactionId: id, cost: GACHA_MILEAGE_COST, result: null, mileage: profile.recruitMileage });
    if (prior) return fail('DUPLICATE');
    if (!recruitPool(records, []).ssr.some(record => record.id === characterId)) return fail('NOT_IN_POOL');
    if (profile.recruitMileage < GACHA_MILEAGE_COST) return fail('INSUFFICIENT_MILEAGE');
    if (profile.ownedCharacterIds.includes(characterId) && characterBreakthrough(profile, characterId) >= BREAKTHROUGH_MAX) return fail('MAXED');
    profile.recruitMileage -= GACHA_MILEAGE_COST;
    const result = { index: 0, ...grantRecruit(profile, { kind: 'SSR', id: characterId }, now) };
    if (result.outcome === 'NEW') {
      profile.gachaHistory = [...profile.gachaHistory, { transactionId: id, characterId, cost: 0, result: 'MILEAGE', pulledAt: clampInt(now) }].slice(-100);
    }
    commitOnce(profile, id, { kind: 'MILEAGE_EXCHANGE', characterId, cost: GACHA_MILEAGE_COST, result }, now);
    profile.updatedAt = now;
    return { profile, exchanged: true, replayed: false, reason: 'EXCHANGED', transactionId: id, cost: GACHA_MILEAGE_COST, result: copy(result), mileage: profile.recruitMileage };
  }

  function dailyOfferEpochDay(now = Date.now()) {
    return Math.floor((Number(now) + DAILY_RESET_OFFSET_HOURS * HOUR_MS) / DAY_MS);
  }

  function dailyOfferIds(corePools, now = Date.now()) {
    const day = dailyOfferEpochDay(now);
    return (Array.isArray(corePools) ? corePools : []).map((pool, index) => {
      const ids = uniqueStrings(pool);
      return ids.length ? ids[(day * 7 + index * 11) % ids.length] : null;
    }).filter(Boolean);
  }

  const api = Object.freeze({
    PROFILE_KEY, PROFILE_VERSION, HOUR_MS, DAY_MS, DAILY_RESET_OFFSET_HOURS, IDLE_FULL_RATE_HOURS, IDLE_REDUCED_RATE_HOURS, IDLE_MAX_HOURS,
    IDLE_RATES, GACHA_SINGLE_COST, GACHA_MULTI_COUNT, GACHA_SSR_RATE, GACHA_SSR_OVERFLOW_MEMORY, GACHA_CARD_OVERFLOW_MATRICES, GACHA_MILEAGE_COST, MAX_BASE_ENERGY_BONUS, BREAKTHROUGH_MAX, BREAKTHROUGH_COSTS, LOBBY_BACKGROUNDS, SHOP_ITEMS,
    defaultProfile, normalizeProfile, unlockedBackgroundIds, effectiveIdleHours, previewIdle, claimIdle,
    stageClearReward, applyStageClear, purchaseShopItem, purchaseCard, cardUpgradeCost, upgradeCard, characterBreakthrough, breakthroughCost, upgradeCharacter, selectLobbyBackground,
    gachaCandidates, drawCharacter, recruitPool, recruitRates, recruitRoll, drawRecruit, exchangeMileage, dailyOfferEpochDay, dailyOfferIds
  });

  global.TRIAD_META_PROGRESSION = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
