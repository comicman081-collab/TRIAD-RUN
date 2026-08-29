(function(global){
  'use strict';

  // V2 is a presentation-only promotion layer.  The immutable V1 asset table
  // stays authoritative; this file only chooses a cinematic timing profile.
  const BASE=global.TRIAD_COMBAT_VFX;
  if(!BASE)throw new Error('TRIAD combat VFX V2 requires the V1 asset authority');

  const VERSION='4.0.0-distinct-visual-grammar';
  const UNIQUE=global.TRIAD_COMBAT_VFX_SKILL_ASSETS_V4||global.TRIAD_COMBAT_VFX_SKILL_ASSETS_V3||{cards:{},enemies:{}};
  const PIPELINES=Object.freeze({PROJECTILE:'PROJECTILE',HEAVY:'HEAVY_IMPACT',ULTIMATE:'ULTIMATE',SUPPORT:'SUPPORT'});
  const RANGED_CARDS=new Set(['quick','dot','volley','ambush','mark']);
  const HEAVY_CARDS=new Set(['strike','heavy','combo','scale','execute','burst','inferno','overload']);
  const PROJECTILE_ARCHETYPES=new Set(['SCOUT','CASTER','HUNTER','VANGUARD']);
  const HEAVY_CATEGORY_BY_CARD=Object.freeze({inferno:'BURN',overload:'SHOCK',mark:'MARK'});
  // Timing and particle language distinguish skills without recoloring or
  // replacing the authored high-resolution image that remains on top.
  const CARD_PROJECTILE_PROFILES=Object.freeze({
    quick:{duration:680,contactMs:490,particleProfile:'needle',launchAssetKey:'PROJECTILE',travelProfile:'dart',impactAssetKey:'SHOCK',impactProfile:'ion-burst',emphasis:.86},
    dot:{duration:840,contactMs:605,particleProfile:'ember-orb',launchAssetKey:'SIG_EMBER',launchScale:.55,travelProfile:'fireball',impactAssetKey:'BURN',impactProfile:'ember-plume',emphasis:1.04},
    volley:{duration:710,contactMs:512,particleProfile:'scatter',launchAssetKey:'SHOCK',travelProfile:'orb',impactAssetKey:'SHOCK',impactProfile:'scatter-volley',emphasis:.78},
    ambush:{duration:735,contactMs:529,particleProfile:'shade-needle',launchAssetKey:'ELITE_REAPER',travelProfile:'crescent',impactAssetKey:'MARK',impactProfile:'void-seal',emphasis:.92},
    mark:{duration:790,contactMs:569,particleProfile:'lockshot',launchAssetKey:'MARK',travelProfile:'seal',impactAssetKey:'MARK',impactProfile:'lock-on-seal',emphasis:.94}
  });
  const ENEMY_PROJECTILE_PROFILES=Object.freeze({
    SCOUT:{duration:700,contactMs:504,particleProfile:'enemy-needle',launchAssetKey:'PROJECTILE',travelProfile:'dart',impactAssetKey:'SHOCK',impactProfile:'ion-burst',emphasis:.86},
    CASTER:{duration:880,contactMs:634,particleProfile:'enemy-orb',launchAssetKey:'ULTIMATE',travelProfile:'arcane-orb',impactAssetKey:'MARK',impactProfile:'void-seal',emphasis:1.08},
    HUNTER:{duration:735,contactMs:529,particleProfile:'hunter-shot',launchAssetKey:'ELITE_REAPER',travelProfile:'crescent',impactAssetKey:'IMPACT',impactProfile:'pierce-shards',emphasis:.94},
    VANGUARD:{duration:920,contactMs:662,particleProfile:'siege-shot',launchAssetKey:'ELITE_VANGUARD',travelProfile:'lance',impactAssetKey:'SHOCK',impactProfile:'siege-shock',emphasis:1.16}
  });
  // A monster has two authored combat actions.  This table deliberately keys
  // the presentation to the immutable combat skill id suffix rather than just
  // its archetype, so e.g. SCOUT_JAB and SCOUT_FLURRY no longer emit the same
  // travelling silhouette and rupture.  Elemental variants retain their
  // source actor and colour, while sharing only the semantic skill language.
  const ENEMY_SKILL_VFX_PROFILES=Object.freeze({
    SCOUT:Object.freeze({
      JAB:{pipeline:'PROJECTILE',duration:700,contactMs:504,particleProfile:'enemy-needle',launchAssetKey:'PROJECTILE',travelProfile:'dart',impactAssetKey:'SHOCK',impactProfile:'ion-burst',emphasis:.86},
      FLURRY:{pipeline:'PROJECTILE',duration:744,contactMs:536,particleProfile:'flurry-orbs',launchAssetKey:'SHOCK',travelProfile:'orb',impactAssetKey:'IMPACT',impactProfile:'scatter-volley',emphasis:.78}
    }),
    HOUND:Object.freeze({
      BITE:{pipeline:'HEAVY_IMPACT',assetKey:'IMPACT',impactProfile:'maul-sweep',particleProfile:'fang-shard'},
      LEAP:{pipeline:'HEAVY_IMPACT',assetKey:'ELITE_COLOSSUS',impactProfile:'crater',particleProfile:'leap-rubble'}
    }),
    WARDEN:Object.freeze({
      BASH:{pipeline:'HEAVY_IMPACT',assetKey:'SHIELD',impactProfile:'guard-break',particleProfile:'guard-shard'},
      WAVE:{pipeline:'HEAVY_IMPACT',assetKey:'SHOCK',impactProfile:'ion-burst',particleProfile:'ward-wave'}
    }),
    CASTER:Object.freeze({
      BOLT:{pipeline:'PROJECTILE',duration:880,contactMs:634,particleProfile:'enemy-orb',launchAssetKey:'ULTIMATE',travelProfile:'arcane-orb',impactAssetKey:'MARK',impactProfile:'void-seal',emphasis:1.08},
      SURGE:{pipeline:'PROJECTILE',duration:930,contactMs:670,particleProfile:'rift-surge',launchAssetKey:'SIG_RIFT',launchScale:.54,travelProfile:'singularity',impactAssetKey:'SHOCK',impactProfile:'star-collapse',emphasis:.92}
    }),
    HUNTER:Object.freeze({
      SHOT:{pipeline:'PROJECTILE',duration:735,contactMs:529,particleProfile:'hunter-shot',launchAssetKey:'ELITE_REAPER',travelProfile:'crescent',impactAssetKey:'IMPACT',impactProfile:'pierce-shards',emphasis:.94},
      VOLLEY:{pipeline:'PROJECTILE',duration:790,contactMs:569,particleProfile:'hunter-volley',launchAssetKey:'ELITE_VANGUARD',launchScale:.78,travelProfile:'lance',impactAssetKey:'SHOCK',impactProfile:'scatter-volley',emphasis:.82}
    }),
    BRUTE:Object.freeze({
      CLUB:{pipeline:'HEAVY_IMPACT',assetKey:'IMPACT',impactProfile:'maul-sweep',particleProfile:'club-shard'},
      CRUSH:{pipeline:'HEAVY_IMPACT',assetKey:'ELITE_COLOSSUS',impactProfile:'crater',particleProfile:'crush-rubble'}
    }),
    WEAVER:Object.freeze({
      LASH:{pipeline:'HEAVY_IMPACT',assetKey:'ELITE_REAPER',impactProfile:'reaper-rend',particleProfile:'lash-shard'},
      WEB:{pipeline:'HEAVY_IMPACT',assetKey:'MARK',impactProfile:'thread-collapse',particleProfile:'web-lump'}
    }),
    RAVAGER:Object.freeze({
      REND:{pipeline:'HEAVY_IMPACT',assetKey:'ELITE_REAPER',impactProfile:'reaper-rend',particleProfile:'rend-shard'},
      FRENZY:{pipeline:'HEAVY_IMPACT',assetKey:'BURN',impactProfile:'ember-plume',particleProfile:'frenzy-ember'}
    }),
    SENTINEL:Object.freeze({
      SPEAR:{pipeline:'PROJECTILE',duration:900,contactMs:648,particleProfile:'sentinel-lance',launchAssetKey:'ELITE_VANGUARD',launchScale:.84,travelProfile:'lance',impactAssetKey:'IMPACT',impactProfile:'pierce-shards',emphasis:1.02},
      PULSE:{pipeline:'HEAVY_IMPACT',assetKey:'SHOCK',impactProfile:'ion-burst',particleProfile:'sentinel-pulse'}
    }),
    VANGUARD:Object.freeze({
      BREACH:{pipeline:'PROJECTILE',duration:920,contactMs:662,particleProfile:'siege-shot',launchAssetKey:'ELITE_VANGUARD',travelProfile:'lance',impactAssetKey:'SHOCK',impactProfile:'siege-shock',emphasis:1.16},
      CROSS:{pipeline:'HEAVY_IMPACT',assetKey:'ELITE_REAPER',impactProfile:'reaper-rend',particleProfile:'cross-shard'}
    }),
    REAPER:Object.freeze({
      REAP:{pipeline:'PROJECTILE',duration:820,contactMs:590,particleProfile:'reap-crescent',launchAssetKey:'ELITE_REAPER',launchScale:.78,travelProfile:'crescent',impactAssetKey:'MARK',impactProfile:'void-seal',emphasis:1.08},
      HARVEST:{pipeline:'HEAVY_IMPACT',assetKey:'MARK',impactProfile:'thread-collapse',particleProfile:'harvest-lump'}
    }),
    COLOSSUS:Object.freeze({
      FIST:{pipeline:'HEAVY_IMPACT',assetKey:'ELITE_COLOSSUS',impactProfile:'crater',particleProfile:'fist-rubble'},
      QUAKE:{pipeline:'HEAVY_IMPACT',assetKey:'SHOCK',impactProfile:'siege-shock',particleProfile:'quake-rubble'}
    }),
    APOSTLE:Object.freeze({
      EDICT:{pipeline:'ULTIMATE',launchAssetKey:'BOSS_APOSTLE',travelProfile:'judgment',launchEmphasis:.38,impactAssetKey:'BOSS_APOSTLE',impactProfile:'boss-ritual',particleProfile:'apostle-edict'},
      JUDGMENT:{pipeline:'ULTIMATE',launchAssetKey:'SIG_AEGIS',launchScale:.42,travelProfile:'judgment',launchEmphasis:.42,impactAssetKey:'BOSS_APOSTLE',impactProfile:'boss-ritual',particleProfile:'apostle-judgment'}
    }),
    OVERMIND:Object.freeze({
      SYNAPSE:{pipeline:'ULTIMATE',launchAssetKey:'BOSS_OVERMIND',travelProfile:'psychic-orb',launchEmphasis:.40,impactAssetKey:'BOSS_OVERMIND',impactProfile:'boss-psychic',particleProfile:'overmind-synapse'},
      DOMINION:{pipeline:'ULTIMATE',launchAssetKey:'SIG_RIFT',launchScale:.43,travelProfile:'singularity',launchEmphasis:.43,impactAssetKey:'BOSS_OVERMIND',impactProfile:'boss-psychic',particleProfile:'overmind-dominion'}
    }),
    SOVEREIGN:Object.freeze({
      END:{pipeline:'ULTIMATE',launchAssetKey:'BOSS_SOVEREIGN',travelProfile:'domination-slice',launchEmphasis:.36,impactAssetKey:'BOSS_SOVEREIGN',impactProfile:'boss-domination',particleProfile:'sovereign-end'},
      COLLAPSE:{pipeline:'ULTIMATE',launchAssetKey:'SIG_RIFT',launchScale:.46,travelProfile:'singularity',launchEmphasis:.46,impactAssetKey:'BOSS_SOVEREIGN',impactProfile:'boss-domination',particleProfile:'sovereign-collapse'}
    })
  });
  const CARD_HEAVY_PROFILES=Object.freeze({
    strike:{assetKey:'IMPACT',impactProfile:'arc-cleave'},heavy:{assetKey:'IMPACT',impactProfile:'crater'},
    combo:{assetKey:'SHOCK',impactProfile:'ion-burst'},scale:{assetKey:'ULTIMATE',impactProfile:'star-collapse'},
    execute:{assetKey:'MARK',impactProfile:'void-seal'},burst:{assetKey:'SHOCK',impactProfile:'scatter-volley'},
    inferno:{assetKey:'BURN',impactProfile:'ember-plume'},overload:{assetKey:'SHOCK',impactProfile:'ion-burst'}
  });
  const ENEMY_HEAVY_PROFILES=Object.freeze({
    HOUND:{assetKey:'IMPACT',impactProfile:'maul-sweep'},WARDEN:{assetKey:'SHIELD',impactProfile:'guard-break'},
    BRUTE:{assetKey:'ELITE_COLOSSUS',impactProfile:'crater'},WEAVER:{assetKey:'MARK',impactProfile:'thread-collapse'},
    RAVAGER:{assetKey:'BURN',impactProfile:'ember-plume'},SENTINEL:{assetKey:'SHOCK',impactProfile:'ion-burst'},
    REAPER:{assetKey:'ELITE_REAPER',impactProfile:'reaper-rend'},COLOSSUS:{assetKey:'ELITE_COLOSSUS',impactProfile:'crater'}
  });
  const SIGNATURE_IMPACT_PROFILES=Object.freeze({EMBER:'ember-plume',BLOOM:'bloom-nova',VOLT:'ion-burst',AEGIS:'guard-break',SHADE:'void-seal',RIFT:'star-collapse'});
  const BOSS_IMPACT_PROFILES=Object.freeze({APOSTLE:'boss-ritual',OVERMIND:'boss-psychic',SOVEREIGN:'boss-domination'});
  // Each travelling silhouette comes from a different existing high-resolution
  // source.  Nothing here synthesizes replacement geometry or recolors a single
  // generic bolt into many fake skills.
  const SIGNATURE_LAUNCH_PROFILES=Object.freeze({
    EMBER:{assetKey:'SIG_EMBER',travelProfile:'nova-ember',launchEmphasis:.44},
    VOLT:{assetKey:'SIG_VOLT',travelProfile:'plasma-wing',launchEmphasis:.46},
    SHADE:{assetKey:'SIG_SHADE',travelProfile:'void-crescent',launchEmphasis:.43},
    RIFT:{assetKey:'SIG_RIFT',travelProfile:'singularity',launchEmphasis:.45}
  });
  const BOSS_LAUNCH_PROFILES=Object.freeze({
    APOSTLE:{assetKey:'BOSS_APOSTLE',travelProfile:'judgment',launchEmphasis:.38},
    OVERMIND:{assetKey:'BOSS_OVERMIND',travelProfile:'psychic-orb',launchEmphasis:.40},
    SOVEREIGN:{assetKey:'BOSS_SOVEREIGN',travelProfile:'domination-slice',launchEmphasis:.36}
  });
  const authored=(key,fallback)=>BASE.ASSETS[key]||fallback;
  const authoredTravel=(key,fallback,scaleMultiplier=1)=>{const asset=authored(key,fallback);return{...asset,scale:(Number(asset.scale)||1)*scaleMultiplier,motion:'TRAVEL'}};
  function applyUniqueSkillAsset(event,group,id){
    const unique=UNIQUE[group]?.[String(id||'')];if(!unique)return event;
    const launchTemplate=event.launchAsset||event.asset,impactTemplate=event.impactAsset||event.asset;
    const launchAsset=launchTemplate?{...launchTemplate,path:unique.launch}:null,impactAsset=impactTemplate?{...impactTemplate,path:unique.impact}:null;
    const travelling=event.pipeline===PIPELINES.PROJECTILE||Boolean(event.launchAsset),support=event.pipeline===PIPELINES.SUPPORT;
    return{...event,asset:support?launchAsset:travelling?launchAsset:impactAsset,launchAsset:event.launchAsset?launchAsset:event.launchAsset,impactAsset:support?event.impactAsset:impactAsset,impactFamily:unique.impactFamily||event.impactProfile,impactProfile:unique.id,variantSeed:unique.seed,motionVariant:unique.motion,ruptureVariant:unique.rupture,sequenceVariant:unique.sequence,uniqueSequenceId:unique.sequence?.id||unique.id,visualIdentity:unique.visualIdentity,uniqueAssetId:unique.id,uniqueAssetPaths:{launch:unique.launch,impact:unique.impact}}
  }
  const uniqueCard=(event,record)=>applyUniqueSkillAsset(event,'cards',record?.id);
  const uniqueEnemy=(event,skillId)=>applyUniqueSkillAsset(event,'enemies',skillId);

  function card(record){
    const event=BASE.card(record),key=String(record?.pattern?.key||record?.key||'').toLowerCase();
    if(event.target!=='enemy')return uniqueCard({...event,pipeline:PIPELINES.SUPPORT,contactMs:0,priority:'P2',particleProfile:'support'},record);
    if(key==='signature'){
      const elementId=String(event.elementId||record?.owner||'').toUpperCase();
      const launch=SIGNATURE_LAUNCH_PROFILES[elementId]||{assetKey:'ULTIMATE',travelProfile:'arcane-orb',launchEmphasis:.44};
      const contactMs=Math.round((Number(event.asset?.duration)||1200)*.52);
      // The existing signature source remains the authored rupture silhouette.
      // A smaller pre-existing projectile carries that energy to the contact point,
      // avoiding the old "large source art slides away" presentation.
      return uniqueCard({...event,pipeline:PIPELINES.ULTIMATE,launchAsset:authoredTravel(launch.assetKey,BASE.ASSETS.PROJECTILE),travelProfile:launch.travelProfile,launchDuration:Math.max(680,contactMs+160),launchEmphasis:launch.launchEmphasis,impactAsset:event.asset,impactProfile:SIGNATURE_IMPACT_PROFILES[elementId]||'star-collapse',contactMs,priority:'P0',particleProfile:'finisher'},record)
    }
    if(RANGED_CARDS.has(key)){
      const profile=CARD_PROJECTILE_PROFILES[key]||CARD_PROJECTILE_PROFILES.quick;
      return uniqueCard({...event,...profile,category:'PROJECTILE',asset:authoredTravel(profile.launchAssetKey,BASE.ASSETS.PROJECTILE,Number(profile.launchScale)||1),impactAsset:authored(profile.impactAssetKey,BASE.ASSETS.SHOCK),pipeline:PIPELINES.PROJECTILE,priority:'P0'},record);
    }
    const profile=CARD_HEAVY_PROFILES[key]||{assetKey:HEAVY_CATEGORY_BY_CARD[key]||'IMPACT',impactProfile:'arc-cleave'},asset=authored(profile.assetKey,BASE.ASSETS.IMPACT);
    return uniqueCard({...event,category:profile.assetKey,asset,impactAsset:asset,impactProfile:profile.impactProfile,pipeline:PIPELINES.HEAVY,duration:760,contactMs:210,priority:HEAVY_CARDS.has(key)?'P0':'P1',particleProfile:key==='inferno'?'ember':'shard'},record);
  }

  function enemySkillKey(skillId){return String(skillId||'').trim().toUpperCase().split('_').pop()||''}
  function enemy(record,skillId){
    const event=BASE.enemy(record),rank=String(record?.data?.rank||record?.rank||(record?.boss?'boss':record?.elite?'elite':'normal')).toLowerCase(),archetype=String(event.archetype||'SCOUT').toUpperCase();
    const actionKey=enemySkillKey(skillId),skillProfile=ENEMY_SKILL_VFX_PROFILES[archetype]?.[actionKey];
    if(skillProfile?.pipeline===PIPELINES.ULTIMATE){
      const duration=rank==='boss'?Number(event.duration)||1420:1080,contactMs=Math.round(duration*.52),launch=authoredTravel(skillProfile.launchAssetKey,BASE.ASSETS.PROJECTILE,Number(skillProfile.launchScale)||1),impactAsset=authored(skillProfile.impactAssetKey,event.asset||BASE.ASSETS.ULTIMATE);
      return uniqueEnemy({...event,...skillProfile,skillId,skillKey:actionKey,pipeline:PIPELINES.ULTIMATE,launchAsset:launch,launchDuration:Math.max(820,contactMs+160),impactAsset,contactMs,priority:'P0'},skillId)
    }
    if(skillProfile?.pipeline===PIPELINES.PROJECTILE){
      const eliteMultiplier=rank==='elite'?1.10:1,duration=Math.round(skillProfile.duration*eliteMultiplier),asset=authoredTravel(skillProfile.launchAssetKey,BASE.ASSETS.PROJECTILE,Number(skillProfile.launchScale)||1);
      return uniqueEnemy({...event,...skillProfile,skillId,skillKey:actionKey,category:skillProfile.launchAssetKey||'PROJECTILE',asset,impactAsset:authored(skillProfile.impactAssetKey,BASE.ASSETS.SHOCK),pipeline:PIPELINES.PROJECTILE,duration,contactMs:Math.round(skillProfile.contactMs*eliteMultiplier),priority:'P0'},skillId)
    }
    if(skillProfile?.pipeline===PIPELINES.HEAVY){
      const asset=authored(skillProfile.assetKey,event.asset||BASE.ASSETS.IMPACT);
      return uniqueEnemy({...event,...skillProfile,skillId,skillKey:actionKey,category:skillProfile.assetKey,asset,impactAsset:asset,pipeline:PIPELINES.HEAVY,duration:rank==='elite'?900:760,contactMs:rank==='elite'?260:220,priority:rank==='elite'?'P0':'P1'},skillId)
    }
    if(rank==='boss'){
      const contactMs=Math.round((Number(event.duration)||1420)*.52);
      const launch=BOSS_LAUNCH_PROFILES[archetype]||{assetKey:'ULTIMATE',travelProfile:'arcane-orb',launchEmphasis:.4};
      // Boss source art no longer drifts across the arena.  It forms at the
      // caster, launches a compact authored projectile, then ruptures at impact.
      return{...event,pipeline:PIPELINES.ULTIMATE,launchAsset:authoredTravel(launch.assetKey,BASE.ASSETS.PROJECTILE),travelProfile:launch.travelProfile,launchDuration:Math.max(820,contactMs+160),launchEmphasis:launch.launchEmphasis,impactAsset:event.asset,impactProfile:BOSS_IMPACT_PROFILES[archetype]||'boss-ritual',contactMs,priority:'P0',particleProfile:'boss'};
    }
    if(PROJECTILE_ARCHETYPES.has(archetype)||event.asset?.motion==='TRAVEL'){
      const profile=ENEMY_PROJECTILE_PROFILES[archetype]||ENEMY_PROJECTILE_PROFILES.SCOUT;
      const eliteMultiplier=rank==='elite'?1.10:1;
      const duration=Math.round(profile.duration*eliteMultiplier);
      const asset=authoredTravel(profile.launchAssetKey,BASE.ASSETS.PROJECTILE);
      return{...event,...profile,category:profile.launchAssetKey||'PROJECTILE',asset,impactAsset:authored(profile.impactAssetKey,BASE.ASSETS.SHOCK),pipeline:PIPELINES.PROJECTILE,duration,contactMs:Math.round(profile.contactMs*eliteMultiplier),priority:'P0'};
    }
    const profile=ENEMY_HEAVY_PROFILES[archetype]||{assetKey:'IMPACT',impactProfile:'arc-cleave'},asset=authored(profile.assetKey,event.asset||BASE.ASSETS.IMPACT);
    return{...event,category:profile.assetKey,asset,impactAsset:asset,impactProfile:profile.impactProfile,pipeline:PIPELINES.HEAVY,duration:rank==='elite'?900:760,contactMs:rank==='elite'?260:220,priority:rank==='elite'?'P0':'P1',particleProfile:archetype==='COLOSSUS'?'quake':'enemy-shard'};
  }

  const API=Object.freeze({...BASE,VERSION,PIPELINES,RANGED_CARDS,HEAVY_CARDS,PROJECTILE_ARCHETYPES,CARD_PROJECTILE_PROFILES,ENEMY_PROJECTILE_PROFILES,ENEMY_SKILL_VFX_PROFILES,CARD_HEAVY_PROFILES,ENEMY_HEAVY_PROFILES,SIGNATURE_IMPACT_PROFILES,BOSS_IMPACT_PROFILES,SIGNATURE_LAUNCH_PROFILES,BOSS_LAUNCH_PROFILES,card,enemy});
  global.TRIAD_COMBAT_VFX_V2=API;
  global.TRIAD_COMBAT_VFX=API;
})(window);
