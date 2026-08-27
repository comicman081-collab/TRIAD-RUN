/* Guards against rapid clicks crossing a synchronous combat rerender. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runtimePath = path.resolve(__dirname, '..', 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const source = fs.readFileSync(runtimePath, 'utf8');

assert.match(source, /let uiInputFenceUntil=0/);
assert.match(source, /function takeUiInputFence\(durationMs=350\)/);
assert.match(source, /if\(!takeUiInputFence\(\)\)return false;\s*c\.inputLocked=true;c\.actionToken\+\+;c\.energy-=cost/);
assert.match(source, /function endTurnAuthoritative\(expectedToken\)[\s\S]*?if\(!takeUiInputFence\(\)\)return false;[\s\S]*?c\.phase='ENEMY'/);
assert.match(source, /function chooseRoute\(type,offerToken\)[\s\S]*?if\(!takeUiInputFence\(\)\)return false;[\s\S]*?offer\.status='CLAIMED'/);
assert.match(source, /function resolvePendingArtifact\(id\)[\s\S]*?if\(!takeUiInputFence\(\)\)return false;[\s\S]*?pending\.artifactStatus='CLAIMED'/);
assert.match(source, /function takeReward\(id\)[\s\S]*?if\(!takeUiInputFence\(\)\)return false;[\s\S]*?pending\.status='CLAIMED'/);

const combatStart = source.indexOf('function renderCombat()');
const combatEnd = source.indexOf('function renderMap(', combatStart);
assert.ok(combatStart >= 0 && combatEnd > combatStart, 'renderCombat boundary is required');
const renderCombat = source.slice(combatStart, combatEnd);
assert.ok(renderCombat.includes('combatActorLayoutMatches(activeEnemyVisualData.id)'), 'combat actors must be reconciled by identity');
assert.ok(!renderCombat.includes('clearSdBattleActors();\n  primeVisualUrls'), 'card rerenders must not destroy actors before every update');
assert.match(source, /function syncPartyBattleActor\(p\)[\s\S]*?actor\.normalizeClip\(state\)!==actor\.clip/);
assert.match(source, /this\.pendingState=name;this\.clip=this\.normalizeClip\(name\)/);

console.log('[PASS] combat input fence and persistent battle actors share the authoritative transition contract');
