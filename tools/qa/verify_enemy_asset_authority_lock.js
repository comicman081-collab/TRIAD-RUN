const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));
const strip=value=>String(value||'').split('?')[0];
const errors=[];

const window={location:{search:''}};
const sandbox=vm.createContext({window,URLSearchParams,console});
for(const file of ['combat_data.js','enemy_animation_data.js','enemy_animation_production_overrides.js','enemy_animation_authority.js','enemy_visual_data.js']){
  vm.runInContext(read(file),sandbox,{filename:file});
}

const combat=window.TRIAD_COMBAT_DATA;
const animationData=window.TRIAD_ENEMY_ANIMATION_DATA;
const authority=window.TRIAD_ENEMY_ANIMATION_AUTHORITY;
const visual=window.TRIAD_COMBAT_VISUAL_DATA;
if(!combat||!animationData||!authority||!visual)errors.push('canonical authority/runtime data failed to load');

const records=animationData?.records||[];
const byId=animationData?.byId||{};
const ids=records.map(row=>row.id);
const idCounts={};
for(const id of ids)idCounts[id]=(idCounts[id]||0)+1;
const duplicateIds=Object.entries(idCounts).filter(([,count])=>count!==1).map(([id,count])=>({id,count}));
if(duplicateIds.length)errors.push(`duplicate animation IDs: ${duplicateIds.map(row=>row.id).join(',')}`);
if(Object.keys(byId).length!==records.length)errors.push('byId/records count mismatch');
for(const row of records)if(byId[row.id]!==row)errors.push(`byId identity mismatch: ${row.id}`);

const kinds={};
const approved=[];
const denied=[];
const directionFailures=[];
const activeAtlas=new Map();
for(const row of records){
  const verdict=authority.classify(row);
  if(!verdict.ok){denied.push({id:row.id,code:verdict.code,status:row.status,atlas:strip(row.atlas)});continue}
  approved.push({id:row.id,kind:verdict.kind,atlas:verdict.atlas});
  kinds[verdict.kind]=(kinds[verdict.kind]||0)+1;
  const prior=activeAtlas.get(verdict.atlas);
  if(prior)errors.push(`duplicate approved atlas: ${prior} and ${row.id}`);
  activeAtlas.set(verdict.atlas,row.id);
  if(!exists(verdict.atlas))errors.push(`missing approved atlas: ${row.id} -> ${verdict.atlas}`);
  if(row.preview&&!exists(row.preview))errors.push(`missing preview: ${row.id} -> ${row.preview}`);
  if(verdict.kind.startsWith('PRODUCTION_FINAL')){
    if(!row.sourceManifest||!exists(row.sourceManifest))errors.push(`missing source manifest: ${row.id}`);
  }
  const resolved=authority.resolve(row.id);
  if(!resolved||resolved.id!==row.id||resolved.authority?.kind!==verdict.kind)errors.push(`authority resolve mismatch: ${row.id}`);
  for(const[key,value]of Object.entries(authority.directionFor?.(row.id)||authority.DIRECTION_CONTRACT||{})){
    if(resolved?.[key]!==value)directionFailures.push({id:row.id,key,expected:value,actual:resolved?.[key]});
  }
}
if(denied.length)errors.push(`default authority denied ${denied.length} records`);
if(directionFailures.length)errors.push(`enemy direction contract failed ${directionFailures.length} fields`);

const normalResolutions=[];
const bossResolutions=[];
for(const monster of combat?.MONSTERS||[]){
  const resolved=visual.resolveEnemy(monster);
  const record=resolved?.animation;
  if(!record||record.id!==monster.id)errors.push(`visual resolver mismatch: ${monster.id}`);
  const authorityKind=record?.authority?.kind;
  normalResolutions.push({id:monster.id,rank:monster.rank,kind:authorityKind||'LEGACY_UNANNOTATED'});
  if(monster.rank==='boss')bossResolutions.push({id:monster.id,kind:authorityKind||'LEGACY_UNANNOTATED'});
}
if(normalResolutions.length!==90)errors.push(`expected 90 monster runtime resolutions, got ${normalResolutions.length}`);
if(bossResolutions.length!==18)errors.push(`expected 18 boss runtime resolutions, got ${bossResolutions.length}`);
if(normalResolutions.some(row=>row.kind==='LEGACY_UNANNOTATED'))errors.push('runtime resolution bypassed authority');

const m09=byId.RIFT_M09;
const negativeTests=[];
function negative(name,record){
  const verdict=authority.classify(record);
  const pass=!verdict.ok;
  negativeTests.push({name,pass,code:verdict.code||null});
  if(!pass)errors.push(`negative authority test accepted: ${name}`);
}
negative('candidate-path-and-status',{...m09,status:'PASS_ACTIVE_CANDIDATE',runtimeActive:false,atlas:'assets/enemies/production_pilot_v7_candidate/RIFT_M09/RIFT_M09_PRODUCTION_PILOT_V7_GPU_CANDIDATE.webp'});
negative('final-without-runtime-flag',{...m09,runtimeActive:false});
negative('unknown-status',{...m09,status:'UNKNOWN',runtimeActive:true});
negative('missing-atlas',{...m09,atlas:'',runtimeActive:true});
negative('legacy-assembly-path',{...m09,atlas:'assets/enemies/legacy/assembly/RIFT_M09.webp',runtimeActive:true});
const qaCandidate=authority.classify({...m09,status:'PASS_ACTIVE_CANDIDATE',runtimeActive:false,atlas:'assets/enemies/production_pilot_v7_candidate/RIFT_M09/RIFT_M09_PRODUCTION_PILOT_V7_GPU_CANDIDATE.webp'},{allowQaCandidate:true});
const qaCandidatePass=qaCandidate.ok&&qaCandidate.qaOnly===true&&qaCandidate.kind==='QA_CANDIDATE';
negativeTests.push({name:'explicit-qa-candidate-only',pass:qaCandidatePass,code:qaCandidate.code||null});
if(!qaCandidatePass)errors.push('explicit QA candidate contract failed');

const html=read('TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
if(!html.includes('enemy_animation_authority.js?v=1.2.0-per-actor-player-facing'))errors.push('canonical HTML missing authority script');
if(html.indexOf('enemy_animation_authority.js')>html.indexOf('enemy_visual_data.js'))errors.push('authority script must load before visual resolver');
if(html.includes('production_pilot_v7_candidate')||html.includes('production_pilot_v6_candidate'))errors.push('candidate path leaked into canonical HTML');

const report={
  version:authority.VERSION,
  generatedAt:new Date().toISOString(),
  canonical:{html:'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html',resolver:'enemy_animation_authority.js'},
  counts:{registryRecords:records.length,uniqueIds:Object.keys(byId).length,approved:approved.length,denied:denied.length,approvedAtlases:activeAtlas.size,monsterResolutions:normalResolutions.length,bossResolutions:bossResolutions.length,directionContracts:records.length-directionFailures.length},
  approvedKinds:kinds,
  approved,
  denied,
  negativeTests,
  runtime:{allMonsterResolutionsPass:normalResolutions.every(row=>row.kind!=='LEGACY_UNANNOTATED'),bossResolutionsPass:bossResolutions.every(row=>row.kind!=='LEGACY_UNANNOTATED'),directionContractsPass:directionFailures.length===0,directionContract:authority.DIRECTION_CONTRACT,directionPolicy:'PER_ACTOR_SOURCE_AWARE',candidateDefaultDenied:true},
  externalValidation:{
    gptWebSession:'6a8af051-27a4-83e8-9c1c-c05b96ed70f5',
    verdict:'VALIDATION: PASS — PRODUCTION AUTHORITY-LOCK MVP 승인',
    visualStructural:'PASS',
    blockers:0,
    inAppEvidence:{
      finalPilot:'RIFT_M09',
      url:'http://127.0.0.1:4173/TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html?qaEnemyVisual=RIFT_M09&authorityQa=normal',
      authority:'PRODUCTION_FINAL',
      status:'PASS_ACTIVE_FINAL',
      lane:'RIGHT',
      facing:'LEFT',
      loadStatus:'PASS',
      consoleErrors:0,
      consoleWarnings:0,
      screenshots:[
        'reports/qa/RIFT_M09_V7_FINAL_INAPP_SKILL.png',
        'reports/qa/RIFT_M09_V7_FINAL_INAPP_HIT.png',
        'reports/qa/RIFT_M09_V7_FINAL_INAPP_DEFEAT.png'
      ]
    }
  },
  errors,
  pass:errors.length===0,
  deleted:0
};

const jsonPath=path.join(root,'reports','TRIAD_ENEMY_ASSET_AUTHORITY_LOCK_20260825.json');
const mdPath=path.join(root,'reports','TRIAD_ENEMY_ASSET_AUTHORITY_LOCK_20260825.md');
fs.mkdirSync(path.dirname(jsonPath),{recursive:true});
fs.writeFileSync(jsonPath,JSON.stringify(report,null,2)+'\n');
const md=[
  '# TRIAD Enemy Asset Authority Lock',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Resolver: \`${report.canonical.resolver}\``,
  `- Registry: ${report.counts.registryRecords} records / ${report.counts.uniqueIds} unique IDs`,
  `- Approved: ${report.counts.approved}`, 
  `- Denied in normal runtime: ${report.counts.denied}`,
  `- Monster resolutions: ${report.counts.monsterResolutions}/90`,
  `- Boss resolutions: ${report.counts.bossResolutions}/18 (subset of the 90 actor records)`,
  `- Approved kinds: ${Object.entries(kinds).map(([key,value])=>`${key}=${value}`).join(', ')}`,
  `- GPT web validation: ${report.externalValidation.verdict}`,
  `- Actual in-app pilot: ${report.externalValidation.inAppEvidence.finalPilot} ${report.externalValidation.inAppEvidence.authority} / ${report.externalValidation.inAppEvidence.status} / ${report.externalValidation.inAppEvidence.loadStatus}`,
  '',
  '## Authority contract',
  '',
  '- Frozen `PASS_ACTIVE_FRAME_MVP` records are accepted only with the exact canonical atlas and preview roots.',
  '- Promoted production records are accepted only as `PASS_ACTIVE_FINAL` with a non-candidate production atlas.',
  '- V4 final records use explicit source-manifest/revision compatibility because the frozen V4 override predates `runtimeActive`.',
  '- Candidate, historical, legacy assembly, portrait/full-art and unknown records fail closed in normal runtime.',
  '- Explicit `qaEnemyAnimation` is the only QA-only candidate allowance and is never a normal runtime source.',
  '',
  '## Negative tests',
  '',
  ...negativeTests.map(test=>`- ${test.pass?'PASS':'FAIL'} — ${test.name}${test.code?` (${test.code})`:''}`),
  '',
  '## Dual PASS evidence',
  '',
  '- The existing GPT web session returned `VISUAL/STRUCTURAL PASS` with no blocker after reviewing the authority contract and regression results.',
  '- The reused local in-app tab loaded RIFT_M09 from the final V7 atlas with `data-asset-authority=PRODUCTION_FINAL`, `data-authority-status=PASS_ACTIVE_FINAL`, `data-battle-lane=RIGHT`, `data-facing=LEFT`, `data-load-status=PASS`, and console error/warning count 0.',
  '- Existing RIFT_M09 final Skill/Hit/Defeat screenshots remain the visual evidence; no new candidate was promoted.',
  '',
  `## Result: **${report.pass?'PASS':'FAIL'}**`,
  '',
  '- No files were deleted.',
  ''
].join('\n');
fs.writeFileSync(mdPath,md);

console.log(JSON.stringify({pass:report.pass,counts:report.counts,approvedKinds:kinds,negativeTests,errors,files:[jsonPath,mdPath]},null,2));
if(!report.pass)process.exitCode=1;
