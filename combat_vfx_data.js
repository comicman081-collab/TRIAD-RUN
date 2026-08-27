(function(global){
  'use strict';

  // Image-first combat VFX authority.  The source art is generated as isolated
  // transparent PNGs; runtime color, scale and motion are supplied here so the
  // same production asset remains readable across all 126 cards and 108 enemies.
  const VERSION='1.2.0-targeting-and-party-zones';
  const ROOT='assets/vfx/gpt_web_v1/';
  const ASSETS=Object.freeze({
    IMPACT:{path:`${ROOT}vfx_impact.png`,duration:560,scale:1.00,motion:'STRIKE'},
    PROJECTILE:{path:`${ROOT}vfx_projectile.png`,duration:720,scale:.88,motion:'TRAVEL'},
    BURN:{path:`${ROOT}vfx_burn.png`,duration:860,scale:1.05,motion:'RISING'},
    SHOCK:{path:`${ROOT}vfx_shock.png`,duration:660,scale:.96,motion:'ARC'},
    MARK:{path:`${ROOT}vfx_mark.png`,duration:760,scale:.86,motion:'LOCK_ON'},
    SHIELD:{path:`${ROOT}vfx_shield.png`,duration:820,scale:1.12,motion:'DOME'},
    HEAL:{path:`${ROOT}vfx_heal.png`,duration:900,scale:1.04,motion:'ASCEND'},
    ULTIMATE:{path:`${ROOT}vfx_ultimate.png`,duration:1150,scale:1.24,motion:'NOVA'},
    SIG_EMBER:{path:`${ROOT}vfx_signature_ember.png`,duration:1280,scale:1.45,motion:'NOVA'},
    SIG_VOLT:{path:`${ROOT}vfx_signature_volt.png`,duration:1240,scale:1.40,motion:'NOVA'},
    SIG_AEGIS:{path:`${ROOT}vfx_signature_aegis.png`,duration:1260,scale:1.44,motion:'DOME'},
    SIG_SHADE:{path:`${ROOT}vfx_signature_shade.png`,duration:1260,scale:1.42,motion:'NOVA'},
    SIG_BLOOM:{path:`${ROOT}vfx_signature_bloom.png`,duration:1300,scale:1.46,motion:'NOVA'},
    SIG_RIFT:{path:`${ROOT}vfx_signature_rift.png`,duration:1340,scale:1.50,motion:'COLLAPSE'},
    ELITE_VANGUARD:{path:`${ROOT}vfx_elite_vanguard.png`,duration:1120,scale:1.28,motion:'TRAVEL'},
    ELITE_REAPER:{path:`${ROOT}vfx_elite_reaper.png`,duration:1160,scale:1.34,motion:'STRIKE'},
    ELITE_COLOSSUS:{path:`${ROOT}vfx_elite_colossus.png`,duration:1220,scale:1.48,motion:'QUAKE'},
    BOSS_APOSTLE:{path:`${ROOT}vfx_boss_apostle.png`,duration:1180,scale:1.42,motion:'JUDGMENT'},
    BOSS_OVERMIND:{path:`${ROOT}vfx_boss_overmind.png`,duration:1200,scale:1.42,motion:'PSIONIC'},
    BOSS_SOVEREIGN:{path:`${ROOT}vfx_boss_sovereign.png`,duration:1320,scale:1.52,motion:'COLLAPSE'}
  });

  const ENEMY_ARCHETYPE_VFX=Object.freeze({
    SCOUT:'PROJECTILE',HOUND:'IMPACT',WARDEN:'SHOCK',CASTER:'PROJECTILE',HUNTER:'PROJECTILE',
    BRUTE:'IMPACT',WEAVER:'MARK',RAVAGER:'IMPACT',SENTINEL:'SHOCK',
    VANGUARD:'IMPACT',REAPER:'IMPACT',COLOSSUS:'IMPACT',
    APOSTLE:'BOSS_APOSTLE',OVERMIND:'BOSS_OVERMIND',SOVEREIGN:'BOSS_SOVEREIGN'
  });
  const SIGNATURE_VFX=Object.freeze({EMBER:'SIG_EMBER',VOLT:'SIG_VOLT',AEGIS:'SIG_AEGIS',SHADE:'SIG_SHADE',BLOOM:'SIG_BLOOM',RIFT:'SIG_RIFT'});
  const ELITE_ARCHETYPE_VFX=Object.freeze({VANGUARD:'ELITE_VANGUARD',REAPER:'ELITE_REAPER',COLOSSUS:'ELITE_COLOSSUS'});
  const ARCHETYPE_BY_CATALOG=Object.freeze(['SCOUT','HOUND','WARDEN','CASTER','HUNTER','BRUTE','WEAVER','RAVAGER','SENTINEL','VANGUARD','REAPER','COLOSSUS','APOSTLE','OVERMIND','SOVEREIGN']);

  function card(card){
    const key=String(card?.pattern?.key||card?.key||'').toLowerCase();
    const owner=String(card?.owner||card?.characterId||'EMBER').toUpperCase();
    const categories=global.TRIAD_COMBAT_VISUAL_DATA?.resolveCard?.(key,owner)||['IMPACT'];
    const partyWide=(key==='signature'&&['AEGIS','BLOOM'].includes(owner))||['guard','bastion','counter','heal','renewal'].includes(key);
    const selfOnly=['focus','battery'].includes(key);
    const projectile=categories.includes('PROJECTILE')&&key!=='signature';
    const category=key==='signature'?(SIGNATURE_VFX[owner]||'ULTIMATE'):(projectile?'PROJECTILE':categories.includes('ULTIMATE')?'ULTIMATE':categories.at(-1)||'IMPACT');
    const target=partyWide?'party':selfOnly?'self':'enemy';
    return {kind:'CARD',category,asset:ASSETS[category]||ASSETS.IMPACT,impactAsset:projectile?ASSETS.IMPACT:null,elementId:owner,target,scope:partyWide?'ALL_ALLIES':selfOnly?'SELF':'SINGLE',emphasis:key==='signature'||category==='ULTIMATE'?1.18:1};
  }

  function enemy(enemy){
    const archetype=String(enemy?.data?.archetypeKey||enemy?.archetypeKey||enemy?.data?.id||enemy?.id||'').match(/_(SCOUT|HOUND|WARDEN|CASTER|HUNTER|BRUTE|WEAVER|RAVAGER|SENTINEL|VANGUARD|REAPER|COLOSSUS|APOSTLE|OVERMIND|SOVEREIGN)_/)?.[1]
      || global.TRIAD_COMBAT_DATA?.ARCHETYPES?.[Math.max(0,(Number(enemy?.data?.catalogNo||enemy?.catalogNo)||1)-1)]?.key
      || ARCHETYPE_BY_CATALOG[Math.max(0,(Number(enemy?.data?.catalogNo||enemy?.catalogNo)||1)-1)]
      || 'SCOUT';
    const rank=enemy?.data?.rank||(enemy?.boss?'boss':enemy?.elite?'elite':'normal');
    const category=(rank==='elite'&&ELITE_ARCHETYPE_VFX[archetype])||ENEMY_ARCHETYPE_VFX[archetype]||'IMPACT';
    const asset=ASSETS[category]||ASSETS.IMPACT;
    return {kind:'ENEMY',category,asset,impactAsset:asset.motion==='TRAVEL'?ASSETS.IMPACT:null,elementId:String(enemy?.data?.elementId||enemy?.elementId||'EMBER').toUpperCase(),target:'party',scope:'SINGLE',archetype,emphasis:rank==='boss'?1.18:rank==='elite'?1.08:1,duration:rank==='boss'?1420:rank==='elite'?1120:960};
  }

  global.TRIAD_COMBAT_VFX=Object.freeze({VERSION,ROOT,ASSETS,ENEMY_ARCHETYPE_VFX,SIGNATURE_VFX,ELITE_ARCHETYPE_VFX,card,enemy});
})(window);
