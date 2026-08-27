const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..', '..');
const overridePath = path.join(root, 'enemy_animation_production_overrides.js');
const htmlPath = path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const override = fs.readFileSync(overridePath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const requiredStates = ['IDLE', 'ATTACK', 'HIT', 'DEFEAT'];
const pilots = [
  {
    id: 'RIFT_M10',
    revision: 'RIFT_M10_V7_GPU_FINAL',
    variable: 'pilot',
    manifestPath: 'assets/enemies/production_pilot_v7/RIFT_M10/RIFT_M10_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  {
    id: 'SHADE_M01',
    revision: 'SHADE_M01_V6_GPU_FINAL',
    variable: 'shade',
    manifestPath: 'assets/enemies/production_pilot_v6/SHADE_M01/SHADE_M01_PRODUCTION_PILOT_V6_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'EMBER_M13', revision: 'EMBER_M13_V4_FINAL', variable: 'ember' },
  { id: 'AEGIS_M13', revision: 'AEGIS_M13_V4_FINAL', variable: 'aegis' },
  { id: 'BLOOM_M13', revision: 'BLOOM_M13_V4_FINAL', variable: 'bloom' },
  { id: 'VOLT_M13', revision: 'VOLT_M13_V4_FINAL', variable: 'volt' },
  {
    id: 'RIFT_M13',
    revision: 'RIFT_M13_V7_GPU_FINAL',
    variable: 'riftBoss',
    manifestPath: 'assets/enemies/production_pilot_v7/RIFT_M13/RIFT_M13_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'SHADE_M13', revision: 'SHADE_M13_V4_FINAL', variable: 'shadeBoss' },
  { id: 'AEGIS_M14', revision: 'AEGIS_M14_V4_FINAL', variable: 'aegisM14' },
  { id: 'EMBER_M14', revision: 'EMBER_M14_V4_FINAL', variable: 'emberM14' },
  { id: 'BLOOM_M14', revision: 'BLOOM_M14_V4_FINAL', variable: 'bloomM14' },
  { id: 'VOLT_M14', revision: 'VOLT_M14_V4_FINAL', variable: 'voltM14' },
  {
    id: 'RIFT_M14',
    revision: 'RIFT_M14_V7_GPU_FINAL',
    variable: 'riftM14',
    manifestPath: 'assets/enemies/production_pilot_v7/RIFT_M14/RIFT_M14_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'SHADE_M14', revision: 'SHADE_M14_V4_FINAL', variable: 'shadeM14' },
  { id: 'AEGIS_M15', revision: 'AEGIS_M15_V4_FINAL', variable: 'aegisM15' },
  { id: 'EMBER_M15', revision: 'EMBER_M15_V4_FINAL', variable: 'emberM15' },
  { id: 'BLOOM_M15', revision: 'BLOOM_M15_V4_FINAL', variable: 'bloomM15' },
  { id: 'VOLT_M15', revision: 'VOLT_M15_V4_FINAL', variable: 'voltM15' },
  {
    id: 'RIFT_M15',
    revision: 'RIFT_M15_V7_GPU_FINAL',
    variable: 'riftM15',
    manifestPath: 'assets/enemies/production_pilot_v7/RIFT_M15/RIFT_M15_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'SHADE_M15', revision: 'SHADE_M15_V4_FINAL', variable: 'shadeM15' },
  { id: 'AEGIS_M12', revision: 'AEGIS_M12_V4_FINAL', variable: 'aegisM12' },
  { id: 'EMBER_M12', revision: 'EMBER_M12_V4_FINAL', variable: 'emberM12' },
  { id: 'BLOOM_M12', revision: 'BLOOM_M12_V4_FINAL', variable: 'bloomM12' },
  { id: 'VOLT_M12', revision: 'VOLT_M12_V4_FINAL', variable: 'voltM12' },
  {
    id: 'RIFT_M12',
    revision: 'RIFT_M12_V7_GPU_FINAL',
    variable: 'riftM12',
    manifestPath: 'assets/enemies/production_pilot_v7/RIFT_M12/RIFT_M12_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'SHADE_M12', revision: 'SHADE_M12_V4_FINAL', variable: 'shadeM12' },
  { id: 'AEGIS_M11', revision: 'AEGIS_M11_V4_FINAL', variable: 'aegisM11' },
  { id: 'EMBER_M11', revision: 'EMBER_M11_V4_FINAL', variable: 'emberM11' },
  { id: 'BLOOM_M11', revision: 'BLOOM_M11_V4_FINAL', variable: 'bloomM11' },
  { id: 'VOLT_M11', revision: 'VOLT_M11_V4_FINAL', variable: 'voltM11' },
  {
    id: 'RIFT_M11',
    revision: 'RIFT_M11_V7_GPU_FINAL',
    variable: 'riftM11',
    manifestPath: 'assets/enemies/production_pilot_v7/RIFT_M11/RIFT_M11_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'SHADE_M11', revision: 'SHADE_M11_V4_FINAL', variable: 'shadeM11' },
  { id: 'AEGIS_M10', revision: 'AEGIS_M10_V4_FINAL', variable: 'aegisM10' },
  { id: 'EMBER_M10', revision: 'EMBER_M10_V4_FINAL', variable: 'emberM10' },
  { id: 'BLOOM_M10', revision: 'BLOOM_M10_V4_FINAL', variable: 'bloomM10' },
  { id: 'VOLT_M10', revision: 'VOLT_M10_V4_FINAL', variable: 'voltM10' },
  { id: 'SHADE_M10', revision: 'SHADE_M10_V4_FINAL', variable: 'shadeM10' },
  { id: 'AEGIS_M09', revision: 'AEGIS_M09_V4_FINAL', variable: 'aegisM09' },
  { id: 'EMBER_M09', revision: 'EMBER_M09_V4_FINAL', variable: 'emberM09' },
  { id: 'BLOOM_M09', revision: 'BLOOM_M09_V4_FINAL', variable: 'bloomM09' },
  { id: 'VOLT_M09', revision: 'VOLT_M09_V4_FINAL', variable: 'voltM09' },
  {
    id: 'RIFT_M09',
    revision: 'RIFT_M09_V7_GPU_FINAL',
    variable: 'riftM09',
    manifestPath: 'assets/enemies/production_pilot_v7/RIFT_M09/RIFT_M09_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'SHADE_M09', revision: 'SHADE_M09_V4_FINAL', variable: 'shadeM09' },
  { id: 'AEGIS_M08', revision: 'AEGIS_M08_V4_FINAL', variable: 'aegisM08' },
  { id: 'EMBER_M08', revision: 'EMBER_M08_V4_FINAL', variable: 'emberM08' },
  { id: 'BLOOM_M08', revision: 'BLOOM_M08_V4_FINAL', variable: 'bloomM08' },
  { id: 'VOLT_M08', revision: 'VOLT_M08_V4_FINAL', variable: 'voltM08' },
  {
    id: 'RIFT_M08',
    revision: 'RIFT_M08_V8_GPU_FINAL',
    variable: 'riftM08',
    manifestPath: 'assets/enemies/production_pilot_v8/RIFT_M08/RIFT_M08_PRODUCTION_PILOT_V8_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'SHADE_M08', revision: 'SHADE_M08_V4_FINAL', variable: 'shadeM08' },
  { id: 'AEGIS_M07', revision: 'AEGIS_M07_V4_FINAL', variable: 'aegisM07' },
  { id: 'EMBER_M07', revision: 'EMBER_M07_V4_FINAL', variable: 'emberM07' },
  { id: 'BLOOM_M07', revision: 'BLOOM_M07_V4_FINAL', variable: 'bloomM07' },
  { id: 'VOLT_M07', revision: 'VOLT_M07_V4_FINAL', variable: 'voltM07' },
  {
    id: 'RIFT_M07',
    revision: 'RIFT_M07_V7_GPU_FINAL',
    variable: 'riftM07',
    manifestPath: 'assets/enemies/production_pilot_v7/RIFT_M07/RIFT_M07_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json',
    rows: 6,
    states: ['IDLE', 'ENTER', 'ATTACK', 'SKILL', 'HIT', 'DEFEAT']
  },
  { id: 'SHADE_M07', revision: 'SHADE_M07_V4_FINAL', variable: 'shadeM07' }
];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function verifyPilot(spec) {
  const manifestPath = spec.manifestPath
    ? path.join(root, ...spec.manifestPath.split('/'))
    : path.join(
      root,
      'assets',
      'enemies',
      'production_pilot_v4',
      spec.id,
      `${spec.id}_PRODUCTION_PILOT_V4_MANIFEST.json`
    );
  const states = spec.states || requiredStates;
  const expectedRows = spec.rows || 4;
  const errors = [];
  if (!fs.existsSync(manifestPath)) {
    return { id: spec.id, errors: ['manifest missing'], pass: false };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const atlasPath = path.join(root, ...manifest.atlas.split('/'));
  const atlasSha256 = fs.existsSync(atlasPath) ? sha256(atlasPath) : null;

  if (manifest.id !== spec.id) errors.push(`manifest id=${manifest.id}`);
  if (manifest.status !== 'PASS_ACTIVE_FINAL') errors.push(`status=${manifest.status}`);
  if (manifest.runtimeActive !== true) errors.push('runtimeActive is not true');
  if (manifest.faction !== 'ENEMY' || manifest.battleLane !== 'RIGHT' || manifest.facing !== 'LEFT') errors.push('direction contract failed');
  if (manifest.frameWidth !== 420 || manifest.frameHeight !== 420 || manifest.columns !== 6 || manifest.rows !== expectedRows) errors.push('atlas geometry contract failed');
  if (manifest.runtimeTransform?.scale !== 1 || manifest.runtimeTransform?.translate?.some(value => value !== 0)) errors.push('runtime transform is not identity');
  if (!fs.existsSync(atlasPath)) errors.push('atlas missing');
  if (atlasSha256 !== manifest.atlasSha256) errors.push('atlas sha256 mismatch');
  for (const state of states) {
    const clip = manifest.clips?.[state];
    if (!clip || clip.frames !== 6 || !Number.isInteger(clip.row)) errors.push(`${state} clip contract failed`);
  }
  if (!manifest.clips?.DEFEAT?.holdLastFrame) errors.push('DEFEAT does not hold last frame');
  if (!override.includes(`const ${spec.variable}=data.byId.${spec.id};`)) errors.push('runtime override actor missing');
  if (!override.includes(`productionRevision:'${spec.revision}'`)) errors.push('runtime revision mismatch');
  if (!override.includes(manifest.atlas)) errors.push('runtime override atlas mismatch');

  return {
    id: manifest.id,
    status: manifest.status,
    atlas: manifest.atlas,
    atlasSha256,
    frameWidth: manifest.frameWidth,
    frameHeight: manifest.frameHeight,
    states,
    direction: `${manifest.battleLane}/${manifest.facing}`,
    runtimeTransform: manifest.runtimeTransform,
    errors,
    pass: errors.length === 0
  };
}

const results = pilots.map(verifyPilot);
const errors = [];
if (!html.includes('enemy_animation_production_overrides.js?v=fifty-five-pilots-v4-final-v6qa-rift-v7qa-rift-m11-v7-final-rift-m12-v7-final-rift-m13-v7-final-rift-m14-v7-final-rift-m15-v7-final-rift-m07-v7-final-rift-m08-v8-final-rift-m09-v7-final')) errors.push('canonical HTML does not load final enemy override');
if (!override.includes("'1.50.0-rift-m09-v7-final'")) errors.push('override data version mismatch');
for (const result of results) for (const error of result.errors) errors.push(`${result.id}: ${error}`);

const summary = {
  schema: 'triad.enemy-production-pilots.v4.qa',
  expected: pilots.length,
  passed: results.filter(result => result.pass).length,
  pilots: results,
  errors,
  pass: errors.length === 0
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
