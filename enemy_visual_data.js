(function(global){
  'use strict';

  const archetype=(key,name,motion)=>({
    key,name,motion,
    path:`assets/enemies/archetypes_rgba_p1/${key.toLowerCase()}.png`,
    assetStatus:'PASS_ACTIVE_P1_ALPHA'
  });

  const ARCHETYPES=[
    archetype('SCOUT','정찰체','HOVER_SCAN'),
    archetype('HOUND','사냥견','PROWL'),
    archetype('WARDEN','문지기','HEAVY_GUARD'),
    archetype('CASTER','주문체','FLOAT_CAST'),
    archetype('HUNTER','추적자','TAIL_AIM'),
    archetype('BRUTE','파쇄자','HEAVY_SWAY'),
    archetype('WEAVER','직조체','MULTI_LEG'),
    archetype('RAVAGER','광전사','AGGRESSIVE_SWAY'),
    archetype('SENTINEL','감시자','STONE_PULSE'),
    archetype('VANGUARD','선봉 집행자','ARMORED_ADVANCE'),
    archetype('REAPER','수확자','CLOAK_FLOAT'),
    archetype('COLOSSUS','거신','MASSIVE_BREATH'),
    archetype('APOSTLE','제1 사도','BOSS_RITUAL'),
    archetype('OVERMIND','군집 의식','BOSS_PSYCHIC'),
    archetype('SOVEREIGN','종말 군주','BOSS_DOMINION')
  ];

  const ELEMENTS={
    EMBER:{color:'#ff6b4a',aura:'FIRE',emblem:'🔥'},
    BLOOM:{color:'#76df91',aura:'NATURE',emblem:'🌿'},
    VOLT:{color:'#58d9ff',aura:'ELECTRIC',emblem:'⚡'},
    AEGIS:{color:'#8ca8ff',aura:'METAL',emblem:'🛡️'},
    SHADE:{color:'#b080ff',aura:'SHADOW',emblem:'🌑'},
    RIFT:{color:'#d28cff',aura:'VOID',emblem:'🌀'}
  };

  const RANKS={
    normal:{scale:1,auraIntensity:1,frame:'STANDARD'},
    elite:{scale:1.08,auraIntensity:1.35,frame:'ELITE'},
    boss:{scale:1.18,auraIntensity:1.7,frame:'BOSS'}
  };

  const VFX_CATEGORIES=['PROJECTILE','IMPACT','BURN','SHOCK','MARK','SHIELD','HEAL','ULTIMATE'];
  const VFX_PROFILES={
    PROJECTILE:{duration:560,motion:'TRAVEL'},IMPACT:{duration:420,motion:'BURST'},
    BURN:{duration:760,motion:'RISING'},SHOCK:{duration:620,motion:'ARC'},
    MARK:{duration:680,motion:'LOCK_ON'},SHIELD:{duration:720,motion:'DOME'},
    HEAL:{duration:780,motion:'ASCEND'},ULTIMATE:{duration:980,motion:'SCREEN_PULSE'}
  };
  const PLAYERS={
    EMBER:{primary:'#ff5b36',secondary:'#ffd166',shape:'FLAME'},
    BLOOM:{primary:'#64dd86',secondary:'#d8ff99',shape:'PETAL'},
    VOLT:{primary:'#4ddcff',secondary:'#f4fbff',shape:'BOLT'},
    AEGIS:{primary:'#7797ff',secondary:'#dce5ff',shape:'SHARD'},
    SHADE:{primary:'#a66cff',secondary:'#edc9ff',shape:'NEEDLE'},
    RIFT:{primary:'#c16cff',secondary:'#73e5ff',shape:'ORB'}
  };
  const CARD_VFX={
    strike:['IMPACT'],guard:['SHIELD'],quick:['PROJECTILE','IMPACT'],heavy:['IMPACT'],focus:['ULTIMATE'],
    battery:['SHOCK'],mark:['MARK'],dot:['PROJECTILE','IMPACT'],burst:['PROJECTILE','IMPACT'],heal:['HEAL'],
    combo:['IMPACT'],scale:['IMPACT'],counter:['SHIELD'],execute:['IMPACT'],signature:['ULTIMATE','IMPACT'],
    inferno:['BURN','IMPACT'],volley:['PROJECTILE','IMPACT'],bastion:['SHIELD'],ambush:['MARK','IMPACT'],
    renewal:['HEAL','SHIELD'],overload:['SHOCK','IMPACT']
  };
  const SIGNATURE_VFX={EMBER:['BURN'],BLOOM:['HEAL'],VOLT:['SHOCK'],AEGIS:['SHIELD'],SHADE:['MARK'],RIFT:['BURN','SHOCK']};
  // ENTER and SKILL are optional presentation states.  Existing 90-enemy
  // FRAME MVP records remain valid with their four authoritative clips; the
  // runtime falls back to ATTACK/IDLE until a candidate manifest is gated in.
  const ENEMY_STATES=['IDLE','ENTER','ATTACK','SKILL','HIT','DEFEAT'];
  const byArchetype=Object.fromEntries(ARCHETYPES.map(record=>[record.key,record]));

  function resolveEnemy(monster){
    const catalogNo=Number(monster?.catalogNo)||Number(String(monster?.id||'').match(/_M(\d+)$/)?.[1]);
    const archetype=byArchetype[monster?.archetypeKey]||ARCHETYPES[catalogNo-1];
    const element=ELEMENTS[monster?.elementId];
    const rank=RANKS[monster?.rank];
    const allowQaCandidate=Boolean(global.location?.search&&typeof URLSearchParams==='function'&&new URLSearchParams(global.location.search).get('qaEnemyAnimation'));
    const animation=global.TRIAD_ENEMY_ANIMATION_AUTHORITY
      ? global.TRIAD_ENEMY_ANIMATION_AUTHORITY.resolve(monster?.id,{allowQaCandidate})
      : global.TRIAD_ENEMY_ANIMATION_DATA?.byId?.[monster?.id];
    if(!archetype||!element||!rank||!animation)throw new Error(`TRIAD enemy visual mapping missing: ${monster?.id||'unknown'}`);
    return{archetype,element,rank,animation}
  }

  function resolvePlayer(characterId){
    const coreId=PLAYERS[characterId]?characterId:global.TRIAD_CHARACTER_ROSTER?.byId?.[characterId]?.coreId;
    const profile=PLAYERS[coreId];
    if(!profile)throw new Error(`TRIAD player VFX profile missing: ${characterId}`);
    return profile
  }

  function resolveCard(patternKey,characterId){
    const categories=CARD_VFX[patternKey];
    if(!categories)throw new Error(`TRIAD card VFX mapping missing: ${patternKey}`);
    const dynamic=[];
    if(patternKey==='signature'&&characterId)dynamic.push(...(SIGNATURE_VFX[characterId]||[]));
    if(patternKey==='dot'&&characterId)dynamic.push(characterId==='EMBER'||characterId==='RIFT'?'BURN':'SHOCK');
    return[...new Set([...categories,...dynamic])]
  }

  global.TRIAD_COMBAT_VISUAL_DATA={
    version:'2.0.0-monster-frame-mvp',ARCHETYPES,byArchetype,ELEMENTS,RANKS,PLAYERS,
    VFX_CATEGORIES,VFX_PROFILES,CARD_VFX,SIGNATURE_VFX,ENEMY_STATES,resolveEnemy,resolvePlayer,resolveCard
  };
})(window);
