'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'),'utf8');
const sandbox={window:{TRIAD_COMBAT_VISUAL_DATA:{resolveCard:(key,owner)=>key==='signature'?['ULTIMATE',owner==='EMBER'?'BURN':'SHOCK']:key==='heal'?['HEAL']:key==='quick'?['PROJECTILE','IMPACT']:['IMPACT']}}};
sandbox.window.window=sandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(root,'combat_vfx_data.js'),'utf8'),sandbox,{filename:'combat_vfx_data.js'});
vm.runInNewContext(fs.readFileSync(path.join(root,'combat_vfx_skill_assets_v4.js'),'utf8'),sandbox,{filename:'combat_vfx_skill_assets_v4.js'});
vm.runInNewContext(fs.readFileSync(path.join(root,'combat_vfx_pipeline_v2.js'),'utf8'),sandbox,{filename:'combat_vfx_pipeline_v2.js'});
const vfx=sandbox.window.TRIAD_COMBAT_VFX;
const required=['IMPACT','PROJECTILE','BURN','SHOCK','MARK','SHIELD','HEAL','ULTIMATE','SIG_EMBER','SIG_VOLT','SIG_AEGIS','SIG_SHADE','SIG_BLOOM','SIG_RIFT','ELITE_VANGUARD','ELITE_REAPER','ELITE_COLOSSUS','BOSS_APOSTLE','BOSS_OVERMIND','BOSS_SOVEREIGN'];
const missing=required.filter(key=>!vfx.ASSETS[key]||!fs.existsSync(path.join(root,vfx.ASSETS[key].path)));
const emberSignature=vfx.card({pattern:{key:'signature'},owner:'EMBER'});
const aegisSignature=vfx.card({pattern:{key:'signature'},owner:'AEGIS'});
const heal=vfx.card({pattern:{key:'heal'},owner:'BLOOM'});
const guard=vfx.card({pattern:{key:'guard'},owner:'AEGIS'});
const quick=vfx.card({pattern:{key:'quick'},owner:'VOLT'});
const apostle=vfx.enemy({data:{catalogNo:13,rank:'boss',elementId:'SHADE'}},'SHADE_APOSTLE_EDICT');
const apostleJudgment=vfx.enemy({data:{catalogNo:13,rank:'boss',elementId:'SHADE'}},'SHADE_APOSTLE_JUDGMENT');
const scout=vfx.enemy({data:{catalogNo:1,rank:'normal',elementId:'VOLT'}},'VOLT_SCOUT_JAB');
const scoutFlurry=vfx.enemy({data:{catalogNo:1,rank:'normal',elementId:'VOLT'}},'VOLT_SCOUT_FLURRY');
const eliteColossus=vfx.enemy({data:{catalogNo:12,rank:'elite',elementId:'EMBER'}});
const assertions=[
  ['runtime script is linked',html.includes('combat_vfx_data.js')],
  ['V2 pipeline is linked',html.includes('combat_vfx_pipeline_v2.js')],
  ['card VFX presenter is linked',html.includes('presentCardVfx(card)')],
  ['enemy VFX presenter is linked',html.includes('scheduleCombatPresentation(()=>presentCombatVfx(event),offset,presentationGeneration)')],
  ['ember signature resolves to its dedicated asset',emberSignature.category==='SIG_EMBER'],
  ['signature targets enemy',emberSignature.target==='enemy'],
  ['aegis signature targets party',aegisSignature.target==='party'],
  ['heal covers all allies',heal.target==='party'&&heal.scope==='ALL_ALLIES'],
  ['shield covers all allies',guard.target==='party'&&guard.scope==='ALL_ALLIES'],
  ['card projectile carries an impact follow-up',quick.asset.motion==='TRAVEL'&&quick.impactAsset===vfx.ASSETS.SHOCK],
  ['enemy projectile carries an impact follow-up',scout.asset.motion==='TRAVEL'&&scout.impactAsset.path===sandbox.window.TRIAD_COMBAT_VFX_SKILL_ASSETS_V4.enemies.VOLT_SCOUT_JAB.impact],
  ['each enemy skill id selects its own presentation',scout.travelProfile!==scoutFlurry.travelProfile&&apostle.launchAsset.path!==apostleJudgment.launchAsset.path],
  ['party actors expose both immutable character and core IDs',html.includes('data-core-id="${esc(p.id||core?.id||\'\')}"')],
  ['party-wide VFX uses a transparent expanded zone',html.includes('data-target-scope="ALL_ALLIES"')&&html.includes('filter:opacity(.64)')],
  ['travel VFX lands with a direct impact',html.includes('triggerCombatVfxImpact(event,event.impactAsset||asset,target,stage)')&&html.includes('appendCombatVfxImpactBurst(event,target)')],
  ['apostle resolves to boss asset',apostle.category==='BOSS_APOSTLE'],
  ['elite colossus resolves to dedicated asset',eliteColossus.category==='ELITE_COLOSSUS'],
  ['every production asset exists',missing.length===0]
];
const failed=assertions.filter(([,ok])=>!ok).map(([name])=>name);
process.stdout.write(`${JSON.stringify({result:failed.length?'FAIL':'PASS',assetRoot:vfx.ROOT,requiredAssets:required.length,missing,assertions:Object.fromEntries(assertions)},null,2)}\n`);
if(failed.length)process.exitCode=1;
