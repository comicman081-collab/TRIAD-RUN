/* Review-only rasterizer for one inactive SVG artifact candidate.
 * Requires the workspace's bundled Node modules (`sharp`) through NODE_PATH.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..', '..');
const input = path.join(root, 'assets', 'artifacts', 'candidates', 'v1', 'TRIAD-ART-FIRST_ZERO-V1.svg');
const output = path.join(root, 'reports', 'QA_ARTIFACT_FIRST_ZERO_CANDIDATE_20260825.png');

if (!fs.existsSync(input)) throw new Error(`Missing artifact candidate: ${input}`);

(async () => {
  const icon = await sharp(input).resize(300, 300).png().toBuffer();
  const panels = [
    { left: 0, top: 0, input: Buffer.from('<svg width="420" height="420"><rect width="420" height="420" fill="#07101E"/></svg>') },
    { left: 430, top: 0, input: Buffer.from('<svg width="420" height="420"><defs><pattern id="p" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#D4D7DC"/><rect width="16" height="16" fill="#89919D"/><rect x="16" y="16" width="16" height="16" fill="#89919D"/></pattern></defs><rect width="420" height="420" fill="url(#p)"/></svg>') },
    { left: 860, top: 0, input: Buffer.from('<svg width="420" height="420"><rect width="420" height="420" fill="#F0F5FC"/></svg>') }
  ];
  const labels = Buffer.from('<svg width="1280" height="96"><rect width="1280" height="96" fill="#07101E"/><text x="24" y="34" fill="#7EEBFF" font-family="Arial" font-size="20">TRIAD // RUN — ARTIFACT VISUAL PILOT (REVIEW REQUIRED)</text><text x="24" y="68" fill="#D7E6F8" font-family="Arial" font-size="16">FIRST_ZERO · dark / alpha checker / light contrast · runtimeActive=false</text></svg>');
  await sharp({ create: { width: 1280, height: 516, channels: 4, background: '#07101E' } })
    .composite([...panels, { left: 60, top: 132, input: icon }, { left: 490, top: 132, input: icon }, { left: 920, top: 132, input: icon }, { left: 0, top: 420, input: labels }])
    .png().toFile(output);
  console.log(output);
})();
