'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');
const dataSource = fs.readFileSync(path.join(root, 'card_character_data.js'), 'utf8');
const window = {};
vm.runInNewContext(dataSource, { window }, { filename: 'card_character_data.js' });
const cards = window.TRIAD_CARD_CHARACTER_DATA;
const start = html.indexOf('function playCardAuthoritative(');
const end = html.indexOf('function endTurnAuthoritative(', start);
assert.ok(start >= 0 && end > start, 'authoritative card resolver is required');
const resolver = html.slice(start, end);

test('authored multi-hit, status, support, and self-cost meanings are executable', () => {
  assert.match(cards.description('burst', 5), /5회 × 물리 피해 5/);
  assert.match(cards.description('volley', 5), /4회 × 물리 피해 7/);
  assert.match(cards.description('renewal', 5), /아군 전체 HP 8 회복/);
  assert.match(cards.description('overload', 5), /마법 피해 27.*HP 4 소모.*전투 중 소멸/);
  assert.match(cards.description('signature', 5, 'BLOOM'), /아군 전체 HP 13 회복/);

  assert.match(resolver, /case 'burst':for\(let i=0;i<Math\.max\(1,v\).*?hit\(secondary\+\(i===0\?comboBonus:0\)\)/s);
  assert.match(resolver, /case 'volley':for\(let i=0;i<Math\.max\(1,v\).*?hit\(secondary\+\(i===0\?comboBonus:0\)\)/s);
  assert.match(resolver, /case 'mark':hit\(secondary\+comboBonus\).*?c\.enemy\.mark\+=v\+statusBonus\+\(perk\?\.statusBonus\|\|0\)/s);
  assert.match(resolver, /case 'dot':hit\(secondary\+comboBonus\)/);
  assert.match(resolver, /case 'focus':drawCards\(v\);if\(secondary\)addShield\(secondary\)/);
  assert.match(resolver, /case 'battery':c\.energy\+=v;if\(secondary\)addShield\(secondary\);exhaust=true/);
  assert.match(resolver, /case 'renewal':healAllies\(v\);if\(secondary\)addShield\(secondary\)/);
  assert.match(resolver, /profile\.healRatio\)healAllies\(Math\.round\(v\*profile\.healRatio\)\)/);
  assert.match(resolver, /case 'overload':\{hit\(v\+comboBonus\).*?owner\.hp=Math\.max\(1,owner\.hp-selfDamage\).*?exhaust=true/s);
});

test('every authored star-five combat modifier is consumed by the resolver', () => {
  for (const field of [
    'critChanceBonus', 'weaknessBonus', 'targetShield', 'chainDamage',
    'statusScaleBonus', 'counterDamage', 'executeThreshold', 'markScaleBonus', 'selfDamage',
  ]) assert.ok(resolver.includes(`perk?.${field}`), `${field} must affect resolution`);
  assert.match(resolver, /damageOptions=\{critChanceBonus:\(card\.pattern\.key==='quick'\?secondary:0\)\+\(perk\?\.critChanceBonus\|\|0\),weaknessBonus:perk\?\.weaknessBonus\|\|0\}/);
  assert.match(resolver, /if\(perk\?\.shieldBonus\)addShield\(perk\.shieldBonus\);if\(perk\?\.healBonus\)healLowest\(perk\.healBonus\)/);
  assert.doesNotMatch(resolver, /if\(perk\?\.statusBonus\)c\.enemy\.burn/);
});

test('auto battle estimates the same authored damage and thresholds', () => {
  const scoreStart = html.indexOf('function autoCardDamageEstimate(');
  const scoreEnd = html.indexOf('function chooseAutoBattleCard(', scoreStart);
  const scoring = html.slice(scoreStart, scoreEnd);
  assert.match(scoring, /key==='burst'\|\|key==='volley'\)return v\*secondary\+combo/);
  assert.match(scoring, /key==='ambush'\)return v\+c\.enemy\.mark\*\(secondary\+\(perk\?\.markScaleBonus\|\|0\)\)\+combo/);
  assert.match(scoring, /perk\?\.executeThreshold\|\|\.35/);
  assert.match(scoring, /key==='overload'\)return v\+combo/);
  assert.match(scoring, /\['focus','battery'\]\.includes\(key\)\?secondary:key==='renewal'\?secondary:v/);
});

test('enemy intent supports all-target attacks and exposes impact snapshots', () => {
  const enemyStart = html.indexOf('function enemyTurn(){', html.indexOf('// Canonical combat bindings'));
  const enemyEnd = html.indexOf('function playCard(){', enemyStart);
  const enemyTurn = html.slice(enemyStart, enemyEnd);
  assert.match(enemyTurn, /c\.intent\.target==='all'\?run\.party\.filter\(p=>p\.hp>0\):null/);
  assert.match(enemyTurn, /hpBefore=p\.hp,shieldBefore=p\.shield/);
  assert.match(enemyTurn, /hpAfter:p\.hp,shieldAfter:p\.shield,counterHit:null/);
});
