'use strict';

// The project contract is an offline folder runtime with relative local assets.
// This build copies only the patched entry point; it never duplicates embedded data.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const output = path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY_ARCH_MIGRATION.html');
const text = fs.readFileSync(input, 'utf8');
if (!text.includes('src/triad_architecture.js')) throw new Error('Architecture adapter script is not present in runtime entry');
fs.copyFileSync(input, output);
process.stdout.write(`${JSON.stringify({ result: 'BUILD_PASS', input, output, bytes: fs.statSync(output).size, contract: 'offline-relative-assets' })}\n`);
