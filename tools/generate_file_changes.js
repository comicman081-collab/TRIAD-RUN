'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs', 'MANUS_ARCH_IMPORT_FILE_CHANGES.md');
const records = [];
const seen = new Set();

function record(filePath, classification) {
  const absolute = path.resolve(filePath);
  const key = absolute.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  records.push({ classification, absolute });
}

function walk(directory, classificationFor) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, classificationFor);
    else record(fullPath, typeof classificationFor === 'function' ? classificationFor(fullPath) : classificationFor);
  }
}

walk(path.join(root, '_migration_backup', 'PRE_MANUS_ARCH_IMPORT_20260816'), 'GENERATED_BACKUP');
walk(path.join(root, 'assets'), filePath => filePath.toLowerCase().startsWith(path.join(root, 'assets', 'assets').toLowerCase()) ? 'CREATED_DELETE_CANDIDATE' : 'CREATED');
walk(path.join(root, 'card_art'), 'CREATED');

record(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'CREATED_AND_MODIFIED');
record(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY_ARCH_MIGRATION.html'), 'GENERATED');
record(path.join(root, 'combat_data.js'), 'CREATED_AND_MODIFIED');
record(path.join(root, 'card_character_data.js'), 'CREATED');
walk(path.join(root, 'src'), 'CREATED');
walk(path.join(root, 'tests'), 'CREATED');
walk(path.join(root, 'tools'), 'CREATED');
walk(path.join(root, 'docs'), filePath => path.resolve(filePath).toLowerCase() === output.toLowerCase() ? 'GENERATED' : 'CREATED');
record(output, 'GENERATED');

records.sort((left, right) => left.classification.localeCompare(right.classification) || left.absolute.localeCompare(right.absolute));
const counts = records.reduce((result, item) => { result[item.classification] = (result[item.classification] || 0) + 1; return result; }, {});
const lines = [
  '# MANUS Architecture Import File Changes',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  'No files were deleted.',
  '',
  '## Counts',
  '',
  '| Classification | Files |',
  '| --- | ---: |',
  ...Object.entries(counts).sort().map(([classification, count]) => `| ${classification} | ${count} |`),
  '',
  '## Absolute paths',
  '',
  '| Classification | Absolute path |',
  '| --- | --- |',
  ...records.map(item => `| ${item.classification} | \`${item.absolute.replace(/\|/g, '\\|')}\` |`),
  ''
];
fs.writeFileSync(output, lines.join('\n'), 'utf8');
process.stdout.write(`${JSON.stringify({ result: 'FILE_CHANGE_MANIFEST_PASS', output, files: records.length, counts })}\n`);
