'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');

test('AUTO toggle is premium, persistent, token-safe and strategy scored', () => {
  assert.match(html, /id="autoBattleToggle" class="auto-battle-toggle"/);
  assert.match(html, /<b>AUTO<\/b><small>OFF<\/small>/);
  assert.match(html, /const AUTO_BATTLE_PREF_KEY='triad_auto_battle_enabled'/);
  assert.match(html, /const AUTO_BATTLE_UNLOCK_STAGE=4/);
  assert.match(html, /function autoBattleAvailable\(\)\{return Boolean\(run\?\.combat\)&&run\.combat\.type!=='tutorial'&&Number\(run\.stage\)>=AUTO_BATTLE_UNLOCK_STAGE\}/);
  assert.match(html, /if\(!autoBattleAvailable\(\)\)return toast\('AUTO 전투는 STAGE 3 클리어 후, STAGE 4부터 사용할 수 있습니다'\)/);
  assert.match(html, /if\(!autoBattleEnabled\|\|!autoBattleAvailable\(\)\)return false/);
  assert.match(html, /if\(!autoBattleEnabled\|\|!autoBattleAvailable\(\)\|\|!c\|\|!/);
  assert.match(html, /!available\?'STAGE 4'/);
  assert.match(html, /function autoCardScore\(card,state,index\)/);
  assert.match(html, /damage>=c\.enemy\.hp&&damage>0\)score\+=10000/);
  assert.match(html, /key==='heal'\|\|key==='renewal'/);
  assert.match(html, /shield<threat\?Math\.max\(0,shieldValue\*alive\.length-shield\)/);
  assert.match(html, /function chooseAutoBattleCard\(\)/);
  assert.match(html, /playCardAuthoritative\(choice\.index,choice\.state\.id,c\.actionToken\)/);
  assert.match(html, /endTurnAuthoritative\(c\.actionToken\)/);
  assert.match(html, /c\.autoActionsThisTurn<12/);
});

test('idle reward claim opens a central animated resource receipt instead of a small toast', () => {
  assert.match(html, /id="idleRewardModal" class="idle-reward-modal" role="dialog"/);
  assert.match(html, /font-family:"Bahnschrift","Pretendard Variable"/);
  assert.match(html, /function showIdleRewardModal\(preview\)/);
  assert.match(html, /showIdleRewardModal\(result\.preview\);return true/);
  assert.match(html, /SFX\.reward\(\)/);
  const claimBody = html.match(/function claimIdleRewards\(\)\{([^\n]+)\}/)?.[1] || '';
  assert.ok(!claimBody.includes('방치 보상:'), 'successful idle claim must not collapse into the legacy toast');
});

test('lobby previews actual elapsed time and current idle accrual rate without a full persistent rerender', () => {
  assert.match(html, /function renderIdlePreview\(now=Date\.now\(\)\)/);
  assert.match(html, /경과 \$\{idleDurationLabel\(preview\.elapsedSinceClaimHours\)\}/);
  assert.match(html, /현재 적립률 \$\{preview\.currentRatePercent\}%/);
  assert.match(html, /적립 정지 · 0%/);
  assert.match(html, /function scheduleIdlePreviewRefresh\(now=Date\.now\(\)\)/);
  const renderBody = html.match(/function renderIdlePreview\(now=Date\.now\(\)\)\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(!renderBody.includes('persistProfile'), 'minute refresh must not write the whole profile');
});

test('Korean atomic controls wrap only at word boundaries', () => {
  assert.match(html, /button\{[^}]*word-break:keep-all;overflow-wrap:normal/);
  assert.match(html, /\.lobby-actions button\{[^}]*text-wrap:balance/);
  assert.match(html, /\.tag,\.badge\{white-space:nowrap;word-break:keep-all;overflow-wrap:normal\}/);
});
