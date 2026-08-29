(function(global){
  'use strict';

  // V2 is a presentation-only promotion layer.  The immutable V1 asset table
  // stays authoritative; this file only chooses a cinematic timing profile.
  const BASE=global.TRIAD_COMBAT_VFX;
  if(!BASE)throw new Error('TRIAD combat VFX V2 requires the V1 asset authority');

  const VERSION='2.3.0-authored-projectile-language';
  const PIPELINES=Object.freeze({PROJECTILE:'PROJECTILE',HEAVY:'HEAVY_IMPACT',ULTIMATE:'ULTIMATE',SUPPORT:'SUPPORT'});
  const RANGED_CARDS=new Set(['quick','dot','volley','ambush','mark']);
  const HEAVY_CARDS=new Set(['strike','heavy','combo','scale','execute','burst','inferno','overload']);
  const PROJECTILE_ARCHETYPES=new Set(['SCOUT','CASTER','HUNTER','VANGUARD']);
  const HEAVY_CATEGORY_BY_CARD=Object.freeze({inferno:'BURN',overload:'SHOCK',mark:'MARK'});
  // Timing and particle language distinguish skills without recoloring or
  // replacing the authored high-resolution image that remains on top.
  const CARD_PROJECTILE_PROFILES=Object.freeze({
    quick:{duration:680,contactMs:490,particleProfile:'needle',launchAssetKey:'PROJECTILE',travelProfile:'dart',impactAssetKey:'SHOCK',impactProfile:'ion-burst',emphasis:.86},
    dot:{duration:840,contactMs:605,particleProfile:'ember-orb',launchAssetKey:'BURN',travelProfile:'plume',impactAssetKey:'BURN',impactProfile:'ember-plume',emphasis:1.04},
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
  const authoredTravel=(key,fallback)=>({...authored(key,fallback),motion:'TRAVEL'});

  function card(record){
    const event=BASE.card(record),key=String(record?.pattern?.key||record?.key||'').toLowerCase();
    if(event.target!=='enemy')return{...event,pipeline:PIPELINES.SUPPORT,contactMs:0,priority:'P2',particleProfile:'support'};
    if(key==='signature'){
      const elementId=String(event.elementId||record?.owner||'').toUpperCase();
      const launch=SIGNATURE_LAUNCH_PROFILES[elementId]||{assetKey:'ULTIMATE',travelProfile:'arcane-orb',launchEmphasis:.44};
      const contactMs=Math.round((Number(event.asset?.duration)||1200)*.52);
      // The existing signature source remains the authored rupture silhouette.
      // A smaller pre-existing projectile carries that energy to the contact point,
      // avoiding the old "large source art slides away" presentation.
      return{...event,pipeline:PIPELINES.ULTIMATE,launchAsset:authoredTravel(launch.assetKey,BASE.ASSETS.PROJECTILE),travelProfile:launch.travelProfile,launchDuration:Math.max(680,contactMs+160),launchEmphasis:launch.launchEmphasis,impactAsset:event.asset,impactProfile:SIGNATURE_IMPACT_PROFILES[elementId]||'star-collapse',contactMs,priority:'P0',particleProfile:'finisher'}
    }
    if(RANGED_CARDS.has(key)){
      const profile=CARD_PROJECTILE_PROFILES[key]||CARD_PROJECTILE_PROFILES.quick;
      return{...event,...profile,category:'PROJECTILE',asset:authoredTravel(profile.launchAssetKey,BASE.ASSETS.PROJECTILE),impactAsset:authored(profile.impactAssetKey,BASE.ASSETS.SHOCK),pipeline:PIPELINES.PROJECTILE,priority:'P0'};
    }
    const profile=CARD_HEAVY_PROFILES[key]||{assetKey:HEAVY_CATEGORY_BY_CARD[key]||'IMPACT',impactProfile:'arc-cleave'},asset=authored(profile.assetKey,BASE.ASSETS.IMPACT);
    return{...event,category:profile.assetKey,asset,impactAsset:asset,impactProfile:profile.impactProfile,pipeline:PIPELINES.HEAVY,duration:760,contactMs:210,priority:HEAVY_CARDS.has(key)?'P0':'P1',particleProfile:key==='inferno'?'ember':'shard'};
  }

  function enemy(record){
    const event=BASE.enemy(record),rank=String(record?.data?.rank||record?.rank||(record?.boss?'boss':record?.elite?'elite':'normal')).toLowerCase(),archetype=String(event.archetype||'SCOUT').toUpperCase();
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

  const API=Object.freeze({...BASE,VERSION,PIPELINES,RANGED_CARDS,HEAVY_CARDS,PROJECTILE_ARCHETYPES,CARD_PROJECTILE_PROFILES,ENEMY_PROJECTILE_PROFILES,CARD_HEAVY_PROFILES,ENEMY_HEAVY_PROFILES,SIGNATURE_IMPACT_PROFILES,BOSS_IMPACT_PROFILES,SIGNATURE_LAUNCH_PROFILES,BOSS_LAUNCH_PROFILES,card,enemy});
  global.TRIAD_COMBAT_VFX_V2=API;
  global.TRIAD_COMBAT_VFX=API;
})(window);
