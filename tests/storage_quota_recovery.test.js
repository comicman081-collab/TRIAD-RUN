const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');

function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = html.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < html.length; index++) {
    if (html[index] === '{') depth++;
    if (html[index] === '}' && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}`);
}

function quotaContext() {
  const originalHistory = JSON.stringify([{ id: 'legacy-run', name: 'keep me', art: `data:image/png;base64,${'A'.repeat(16_000)}` }]);
  const records = new Map([['triad_history', originalHistory]]);
  let historyCompacted = false;
  const saveState = { textContent: '' };
  const context = {
    console: { warn() {}, error() {} },
    JSON,
    Object,
    Array,
    Date,
    RegExp,
    localStorage: {
      getItem: key => records.get(key) ?? null,
      setItem(key, value) {
        if (key === 'triad_history') {
          records.set(key, value);
          historyCompacted = !value.includes('data:image/');
          return;
        }
        if (!historyCompacted) throw new Error('QuotaExceededError');
        records.set(key, value);
      }
    },
    $: () => saveState,
    META: { PROFILE_KEY: 'triad_profile', normalizeProfile: value => value },
    TRIAD_TXN: { ensureLedger: () => ({}) },
    profileRosterIds: () => [],
    profile: { id: 'profile-before' },
    run: { id: 'run-1', stage: 3, transactionLedger: {} },
  };
  vm.createContext(context);
  return { context, records, saveState };
}

test('profile checkpoint reclaims only legacy embedded history art after a quota error', () => {
  const { context, records, saveState } = quotaContext();
  vm.runInContext(`${functionSource('compactLegacyImagePayloads')}\n${functionSource('reclaimLegacyStorageForRun')}\n${functionSource('persistProfile')}`, context);

  const result = context.persistProfile({ id: 'profile-after', wallet: { credits: 77 } });
  const history = JSON.parse(records.get('triad_history'));

  assert.equal(result.id, 'profile-after');
  assert.equal(JSON.parse(records.get('triad_profile')).wallet.credits, 77);
  assert.equal(history[0].name, 'keep me');
  assert.equal(history[0].art, '');
  assert.match(saveState.textContent, /이전 원본 이미지 경량화/);
});

test('active run checkpoint retries after quota recovery without blocking stage data', () => {
  const { context, records, saveState } = quotaContext();
  vm.runInContext(`${functionSource('compactLegacyImagePayloads')}\n${functionSource('reclaimLegacyStorageForRun')}\n${functionSource('saveRun')}`, context);

  assert.equal(context.saveRun(), true);
  const savedRun = JSON.parse(records.get('triad_active_run'));

  assert.equal(savedRun.id, 'run-1');
  assert.equal(savedRun.stage, 3);
  assert.equal(JSON.parse(records.get('triad_history'))[0].art, '');
  assert.match(saveState.textContent, /이전 원본 이미지 경량화/);
});
