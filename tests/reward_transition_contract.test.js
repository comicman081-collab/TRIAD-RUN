/* Guards the persisted victory/event transition contract in the single-file runtime. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runtimePath = path.resolve(__dirname, '..', 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const source = fs.readFileSync(runtimePath, 'utf8');

function section(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} is required`);
  const end = nextName ? source.indexOf(`function ${nextName}(`, start) : source.length;
  assert.notStrictEqual(end, -1, `${nextName} boundary is required`);
  return source.slice(start, end);
}

const resume = section('resumeRun', 'migrateProductionVisual');
assert.ok(resume.includes('else if(run.pendingTransition){resumePendingTransition()}'), 'resume must restore a persisted transition before the route');

const win = section('winCombat', 'buildArtifactOffer');
assert.ok(win.includes("combat.phase='TERMINAL';combat.inputLocked=true"), 'victory must lock input in the terminal transaction');
assert.ok(win.includes("TRIAD_TXN.pending(run,'COMBAT_REWARD'"), 'victory must persist an explicit combat reward transaction');
assert.ok(win.includes('run.rewardOffer=buildRewardOffer()'), 'victory must persist card rewards before the victory delay');
assert.ok(win.indexOf('run.pendingTransition=') < win.indexOf('run.combat=null;saveRun()'), 'transition must be saved before combat is cleared');
assert.ok(win.includes('run?.id===runId&&run.pendingTransition?.txnId===txnId'), 'stale victory timer must match the exact transaction');

const eventArtifact = section('beginEventArtifact', 'resumePendingTransition');
assert.ok(eventArtifact.includes("TRIAD_TXN.pending(run,'EVENT_ARTIFACT'"), 'event artifact choice must be serializable');
assert.ok(eventArtifact.indexOf('saveRun()') < eventArtifact.indexOf('openPendingArtifactOffer()'), 'event artifact must save before UI opens');

const reward = section('showReward', 'takeReward');
assert.ok(reward.includes("TRIAD_TXN.isPending(pending,'COMBAT_REWARD'"), 'reward screen must require the current combat reward transaction');
assert.ok(!reward.includes('buildRewardOffer()'), 'Continue must never regenerate reward candidates');

const takeReward = section('takeReward', 'completeStage');
assert.ok(takeReward.includes('TRIAD_TXN.isCommitted(run,pending.txnId)'), 'duplicate reward claims must be rejected');
assert.ok(takeReward.includes('completeStage(true,pending.txnId'), 'taking or skipping a reward must close the exact transaction once');

const artifact = section('resolvePendingArtifact', 'takeArtifact');
assert.ok(artifact.includes("pending.artifactStatus!=='PENDING'"), 'artifact claim must require a pending artifact state');
assert.ok(artifact.includes('TRIAD_TXN.isCommitted(run,artifactTxnId)'), 'artifact claim must be idempotent');

console.log('[PASS] victory, event artifact, and card reward transitions are persisted and idempotent');
