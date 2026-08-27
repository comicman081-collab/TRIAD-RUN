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
