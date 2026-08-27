const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');

function historyLoader(serialized) {
  const match = html.match(/(function loadHistory\(\)\{[\s\S]*?\n\})\nfunction historyCharacters/);
  assert.ok(match, 'loadHistory source boundary must exist');
  const storage = { getItem: () => serialized };
  const warnings = [];
  return {
    read: new Function('localStorage', 'console', `${match[1]}; return loadHistory;`)(storage, {
      warn: (...args) => warnings.push(args)
    }),
    warnings
  };
}

test('corrupt history uses a non-destructive safe reader on every production history action', () => {
  assert.match(html, /function loadHistory\(\)\{\s*try\{/);
  assert.match(html, /console\.warn\('TRIAD history recovery used',error\)/);
  assert.match(html, /return Array\.isArray\(parsed\)\?parsed:\[\];/);
  for (const name of ['finishRun', 'renderHistory', 'openHistory', 'replayHistory', 'deleteHistory']) {
    const start = html.indexOf(`function ${name}`);
    const end = html.indexOf('\nfunction ', start + 1);
    const source = html.slice(start, end < 0 ? html.length : end);
    assert.match(source, /loadHistory\(\)/, `${name} must use the safe history reader`);
    assert.doesNotMatch(source, /JSON\.parse\(localStorage\.getItem\('triad_history'/, `${name} must not parse history directly`);
  }
});

test('safe history reader returns an empty view without mutating unreadable storage', () => {
  const valid = historyLoader('[{"id":"history-1"}]');
  assert.deepEqual(valid.read(), [{ id: 'history-1' }]);
  assert.deepEqual(valid.warnings, []);

  const corrupt = historyLoader('{invalid json');
  assert.deepEqual(corrupt.read(), []);
  assert.equal(corrupt.warnings.length, 1);

  const wrongShape = historyLoader('{"id":"not-an-array"}');
  assert.deepEqual(wrongShape.read(), []);
  assert.deepEqual(wrongShape.warnings, []);
});
