/* TRIAD // RUN recruitment art compatibility patch.
 *
 * New GACHA characters intentionally reuse their validated canonical lobby
 * foreground as fullArt/portrait. The legacy lobby validator rejected those
 * aliases even though the asset itself had already passed the active alpha
 * contract, causing recruitment thumbnails to resolve to an empty URL.
 *
 * Keep every actual safety gate (PASS_ACTIVE, RGBA foreground contract,
 * transparent background, background removal, alpha validation, canonical
 * roster path) and only remove the obsolete "must differ from fullArt and
 * portrait" restriction.
 */
(function attachTriadRecruitArtFix(global) {
  'use strict';

  const FIX_VERSION = '1.0.0-recruit-lobby-alias';
  const CANONICAL_PREFIX = 'assets/characters/roster/';
  const MAX_BOOT_ATTEMPTS = 80;
  let bootAttempts = 0;

  function validatedLobbyAsset(record) {
    const art = record && record.lobbyArt;
    const contract = global.TRIAD_CHARACTER_ROSTER && global.TRIAD_CHARACTER_ROSTER.lobbyForegroundContract;
    const safe = Boolean(
      art &&
      art.status === 'PASS_ACTIVE' &&
      contract &&
      art.assetType === contract.assetType &&
      art.backgroundPolicy === contract.backgroundPolicy &&
      art.backgroundRemoved === true &&
      art.alphaValidated === true &&
      typeof art.path === 'string' &&
      art.path.startsWith(CANONICAL_PREFIX)
    );
    return safe ? art : null;
  }

  function refreshRecruitmentUi() {
    if (typeof global.renderCharacterRecruitment !== 'function') return;
    if (!document.getElementById('gachaCandidateGrid')) return;
    try {
      global.renderCharacterRecruitment();
    } catch (error) {
      console.warn('TRIAD recruitment art UI refresh failed', error);
    }
  }

  function validateRecruitableRoster() {
    const roster = global.TRIAD_CHARACTER_ROSTER && global.TRIAD_CHARACTER_ROSTER.records;
    if (!Array.isArray(roster)) return { checked: 0, valid: 0, invalid: [] };
    const recruits = roster.filter(record => record && record.acquisition === 'GACHA' && record.gachaEligible === true);
    const invalid = recruits.filter(record => !validatedLobbyAsset(record)).map(record => record.id || record.name || 'UNKNOWN');
    return { checked: recruits.length, valid: recruits.length - invalid.length, invalid };
  }

  function applyFix() {
    if (!global.TRIAD_CHARACTER_ROSTER) return false;
    if (typeof global.lobbyCharacterAsset !== 'function' || typeof global.metaCharacterThumbnail !== 'function') return false;

    global.lobbyCharacterAsset = validatedLobbyAsset;
    global.metaCharacterThumbnail = record => validatedLobbyAsset(record)?.path || '';

    const audit = validateRecruitableRoster();
    global.TRIAD_RECRUIT_ART_FIX = Object.freeze({
      version: FIX_VERSION,
      active: true,
      checked: audit.checked,
      valid: audit.valid,
      invalid: Object.freeze(audit.invalid.slice())
    });

    if (audit.invalid.length) console.error('TRIAD recruit lobby-art contract failures:', audit.invalid);
    refreshRecruitmentUi();
    return true;
  }

  function boot() {
    if (applyFix()) return;
    bootAttempts += 1;
    if (bootAttempts >= MAX_BOOT_ATTEMPTS) {
      console.error('TRIAD recruitment art fix could not attach to the runtime');
      return;
    }
    global.setTimeout(boot, 100);
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
