const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');

test('canonical HTML loads the versioned meta progression module and exposes one lobby', () => {
  assert.match(html, /src\/triad_meta_progression\.js\?v=1\.1\.0-meta-breakthrough/);
  assert.match(html, /triad_character_roster\.js\?v=1\.0\.20-gacha-six-complete/);
  assert.equal((html.match(/id="lobbyShell"/g) || []).length, 1);
  assert.match(html, /const META=window\.TRIAD_META_PROGRESSION/);
});

test('lobby foreground contract rejects background-baked signature art', () => {
  assert.match(html, /art\?\.status==='PASS_ACTIVE'/);
  assert.match(html, /art\.assetType===contract\?\.assetType/);
  assert.match(html, /art\.backgroundPolicy===contract\?\.backgroundPolicy/);
  assert.match(html, /art\.backgroundRemoved===true/);
  assert.match(html, /art\.alphaValidated===true/);
  assert.match(html, /art\.path\.startsWith\(canonicalPrefix\)/);
  assert.match(html, /art\.path!==record\?\.fullArt/);
  assert.match(html, /art\.path!==record\?\.portrait/);
  assert.match(html, /function metaCharacterThumbnail\(record\)\{return lobbyCharacterAsset\(record\)\?\.path\|\|''\}/);
  assert.doesNotMatch(html, /character-face-preview[^`]+record\.fullArt/);
  assert.match(html, /visual-slot-stage[^`]+metaCharacterThumbnail\(record\)/);
  assert.match(html, /\.visual-slot-stage img\{[^}]*object-fit:cover[^}]*object-position:center 10%/);
  assert.doesNotMatch(html, /lobbyCharacterVisual[^\n]+record\.fullArt/);
  assert.match(html, /배경이 포함된 시그니처 원화는 로비에 사용하지 않습니다/);
});

test('all twelve visual-gated lobby RGBA characters are active and background-free', () => {
  const roster = fs.readFileSync(path.join(root, 'assets/characters/roster/triad_character_roster.js'), 'utf8');
  assert.equal((roster.match(/status: 'SOURCE_CUTOUT_REQUIRED'/g) || []).length, 0);
  assert.equal((roster.match(/reason: 'BACKGROUND_BAKED_REFERENCE_ONLY'/g) || []).length, 0);
  assert.equal((roster.match(/lobbyArt: \{[^}]+path: null/g) || []).length, 0);
  assert.equal((roster.match(/status: 'PASS_ACTIVE'/g) || []).length, 12);
  for (const file of [
    'ember_lobby_rgba_v11_registered_clean_alpha.png',
    'volt_lobby_rgba_v10_registered.png',
    'aegis_lobby_rgba_v13_registered.png',
    'shade_lobby_rgba_v3_registered.png',
    'bloom_lobby_rgba_v6_registered.png',
    'rift_lobby_rgba_v5_registered.png',
    'seraph_lobby_rgba_v4_gpt_web.png',
    'lyra_lobby_rgba_v1_gpt_web.png',
    'kaia_lobby_rgba_v2_gpt_web_sam2_tight.png',
    'nox_lobby_rgba_v6_gpt_web_true_alpha.png',
    'sena_lobby_rgba_v4_gpt_web_true_alpha.png',
    'vela_lobby_rgba_v1_gpt_web_true_alpha.png'
  ]) assert.match(roster, new RegExp(file.replaceAll('.', '\\.')));
  assert.match(roster, /TRIAD-CHAR-006[\s\S]+rift_lobby_rgba_v5_registered\.png/);
  assert.equal((roster.match(/backgroundRemoved: true/g) || []).length, 12);
  assert.equal((roster.match(/alphaValidated: true/g) || []).length, 12);
  assert.match(roster, /98F3C31C999657A012973E4219F09F66BD1013C63F06DBBF5249E946F1866E5A/);
  assert.match(roster, /3908A9EECC776F4E82A812314BE8EE9E821B6CC18CC3B720389C23B145FC0497/);
  assert.match(roster, /424421C07BCAC96F1AF8A1BA066A392A0BAAD8B960DD8537793EA373E485BE84/);
  assert.match(roster, /46CE6F110D0CDE3B2F7E170B3812A33F179D99C8AFDD7F35F909C61D2DAF895B/);
  assert.match(roster, /C2EFC00AA68C95CA08D592B8D9E01DA945EAB932B51737ED5DD1F19F531077E8/);
  assert.match(roster, /assetType: 'NON_SD_CHARACTER_RGBA'/);
  assert.match(roster, /backgroundPolicy: 'TRANSPARENT_ONLY'/);
  assert.match(roster, /sourceBackgroundAllowed: false/);
  assert.match(roster, /crop: 'KNEE_UP'/);
});

test('lobby character presentation is a clipped knee-up foreground, never a scene layer', () => {
  assert.match(html, /\.lobby-character-stage\{[^}]*overflow:hidden/);
  assert.match(html, /\.lobby-character-art\{[^}]*top:16px[^}]*bottom:auto[^}]*height:calc\(100% - 122px\)[^}]*object-fit:cover[^}]*object-position:center top/);
  assert.match(html, /@media\(max-width:850px\)[^}]*[\s\S]*?\.lobby-character-stage\{min-height:500px\}/);
  assert.match(html, /\.lobby-character-art\{top:10px;bottom:auto;width:min\(96%,340px\);height:calc\(100% - 104px\);object-fit:cover;object-position:center top\}/);
  assert.match(html, /\.lobby-character-nav\{bottom:10px\}/);
  assert.doesNotMatch(html, /\.lobby-character-art\{[^}]*bottom:-\d/);
});

test('profile progression is transaction-safe and connected to stage completion', () => {
  assert.match(html, /META\.applyStageClear\(profile/);
  assert.match(html, /transactionId:`\$\{run\.id\}:\$\{txnId\}`/);
  assert.match(html, /META\.PROFILE_KEY/);
});

test('active-run persistence failure cannot block the run screen transition', () => {
  assert.match(html, /function saveRun\(\)\{[\s\S]*?try\{[\s\S]*?localStorage\.setItem\('triad_active_run'/);
  assert.match(html, /catch\(error\)\{[\s\S]*?저장 공간 부족 · 현재 세션 진행 중[\s\S]*?return false/);
  assert.match(html, /primeVisualUrls\(run\.party\.map\(p=>p\.visual\)\);saveRun\(\);showTutorialStage\(\)/);
});

test('quota recovery compacts only legacy embedded history images and retries profile and run writes', () => {
  assert.match(html, /function compactLegacyImagePayloads\(value\)\{/);
  assert.match(html, /\^data:image\\\/\/i\.test\(value\)\?'':value/);
  assert.match(html, /function reclaimLegacyStorageForRun\(\)\{[\s\S]*?localStorage\.getItem\('triad_history'\)[\s\S]*?localStorage\.setItem\('triad_history',serialized\)/);
  assert.match(html, /TRIAD profile persistence failed[\s\S]*?reclaimLegacyStorageForRun\(\)[\s\S]*?localStorage\.setItem\(META\.PROFILE_KEY,serialized\)/);
  assert.match(html, /TRIAD active-run persistence failed[\s\S]*?reclaimLegacyStorageForRun\(\)[\s\S]*?localStorage\.setItem\('triad_active_run',serialized\)/);
});

test('account card levels and permanent base energy are snapshotted into new runs', () => {
  assert.match(html, /level:accountCardLevel\(id\)/);
  assert.match(html, /level:accountCardLevel\(signatureId\)/);
  assert.match(html, /accountSnapshot:createRunAccountSnapshot\(\)/);
  assert.match(html, /function runBaseEnergyBonus\(\)/);
  assert.match(html, /c\.energy=3\+runBaseEnergyBonus\(\)\+\(hasArtifact\('energyPlus'\)\?1:0\)/);
  assert.doesNotMatch(html, /c\.energy=3\+profile\.baseEnergyBonus/);
});

test('idle reward, shop and background selection use real production screens', () => {
  for (const id of ['metaShop', 'lobbyBackgrounds', 'profileWallet', 'idlePanel', 'characterBreakthroughGrid', 'shopItemGrid', 'shopCardGrid', 'backgroundGrid', 'characterRecruitmentPanel', 'gachaSummary', 'gachaCandidateGrid', 'gachaDrawBtn']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /META\.claimIdle\(/);
  assert.match(html, /META\.purchaseShopItem\(/);
  assert.match(html, /META\.purchaseCard\(/);
  assert.match(html, /META\.upgradeCard\(/);
  assert.match(html, /META\.upgradeCharacter\(/);
  assert.match(html, /function upgradeProfileCharacter\(/);
  assert.match(html, /breakthrough:META\.characterBreakthrough\(profile,record\.id\)/);
  assert.match(html, /META\.dailyOfferIds\(/);
  assert.match(html, /META\.gachaCandidates\(ROSTER\.records,profile\)/);
  assert.match(html, /META\.drawCharacter\(/);
  assert.match(html, /acquisition!=='GACHA'/);
  assert.match(html, /function takeMetaInputFence\(/);
  assert.match(html, /\.character-face-preview\{background-position:center 10%/);
  assert.match(html, /\.card-face-preview\{background-position:center 14%/);
  assert.equal((html.match(/background-preview character-face-preview/g) || []).length, 2);
  assert.equal((html.match(/background-preview card-face-preview/g) || []).length, 1);
});
