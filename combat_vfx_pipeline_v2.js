(function(global){
  'use strict';

  // V2 is a presentation-only promotion layer.  The immutable V1 asset table
  // stays authoritative; this file only chooses a cinematic timing profile.
  const BASE=global.TRIAD_COMBAT_VFX;
  if(!BASE)throw new Error('TRIAD combat VFX V2 requires the V1 asset authority');

  const VERSION='2.0.0-authored-cinematic-pipelines';
  const PIPELINES=Object.freeze({PROJECTILE:'PROJECTILE',HEAVY:'HEAVY_IMPACT',ULTIMATE:'ULTIMATE',SUPPORT:'SUPPORT'});
  const RANGED_CARDS=new Set(['quick','dot','volley','ambush','mark']);
  const HEAVY_CARDS=new Set(['strike','heavy','combo','scale','execute','burst','inferno','overload']);
  const PROJECTILE_ARCHETYPES=new Set(['SCOUT','CASTER','HUNTER','VANGUARD']);
  const HEAVY_CATEGORY_BY_CARD=Object.freeze({inferno:'BURN',overload:'SHOCK',mark:'MARK'});
  // Timing and particle language distinguish skills without recoloring or
  // replacing the authored high-resolution image that remains on top.
  const CARD_PROJECTILE_PROFILES=Object.freeze({
    quick:{duration:680,contactMs:490,particleProfile:'needle',emphasis:.86},
    dot:{duration:840,contactMs:605,particleProfile:'ember-orb',emphasis:1.04},
    volley:{duration:710,contactMs:512,particleProfile:'scatter',emphasis:.78},
    ambush:{duration:735,contactMs:529,particleProfile:'shade-needle',emphasis:.92},
    mark:{duration:790,contactMs:569,particleProfile:'lockshot',emphasis:.94}
  });
  const ENEMY_PROJECTILE_PROFILES=Object.freeze({
    SCOUT:{duration:700,contactMs:504,particleProfile:'enemy-needle',emphasis:.86},
    CASTER:{duration:880,contactMs:634,particleProfile:'enemy-orb',emphasis:1.08},
    HUNTER:{duration:735,contactMs:529,particleProfile:'hunter-shot',emphasis:.94},
    VANGUARD:{duration:920,contactMs:662,particleProfile:'siege-shot',emphasis:1.16}
  });

  function card(record){
    const event=BASE.card(record),key=String(record?.pattern?.key||record?.key||'').toLowerCase();
    if(event.target!=='enemy')return{...event,pipeline:PIPELINES.SUPPORT,contactMs:0,priority:'P2',particleProfile:'support'};
    if(key==='signature')return{...event,pipeline:PIPELINES.ULTIMATE,impactAsset:BASE.ASSETS.IMPACT,contactMs:Math.round((Number(event.asset?.duration)||1200)*.52),priority:'P0',particleProfile:'finisher'};
    if(RANGED_CARDS.has(key)){
      const profile=CARD_PROJECTILE_PROFILES[key]||CARD_PROJECTILE_PROFILES.quick;
      return{...event,...profile,category:'PROJECTILE',asset:BASE.ASSETS.PROJECTILE,impactAsset:BASE.ASSETS.IMPACT,pipeline:PIPELINES.PROJECTILE,priority:'P0'};
    }
    const category=HEAVY_CATEGORY_BY_CARD[key]||'IMPACT';
    return{...event,category,asset:BASE.ASSETS[category]||BASE.ASSETS.IMPACT,impactAsset:BASE.ASSETS.IMPACT,pipeline:PIPELINES.HEAVY,duration:760,contactMs:210,priority:HEAVY_CARDS.has(key)?'P0':'P1',particleProfile:key==='inferno'?'ember':'shard'};
  }

  function enemy(record){
    const event=BASE.enemy(record),rank=String(record?.data?.rank||record?.rank||(record?.boss?'boss':record?.elite?'elite':'normal')).toLowerCase(),archetype=String(event.archetype||'SCOUT').toUpperCase();
    if(rank==='boss')return{...event,pipeline:PIPELINES.ULTIMATE,impactAsset:BASE.ASSETS.IMPACT,contactMs:Math.round((Number(event.duration)||1420)*.52),priority:'P0',particleProfile:'boss'};
    if(PROJECTILE_ARCHETYPES.has(archetype)||event.asset?.motion==='TRAVEL'){
      const asset=rank==='elite'&&archetype==='VANGUARD'?BASE.ASSETS.ELITE_VANGUARD:BASE.ASSETS.PROJECTILE;
      const profile=ENEMY_PROJECTILE_PROFILES[archetype]||ENEMY_PROJECTILE_PROFILES.SCOUT;
      const eliteMultiplier=rank==='elite'?1.10:1;
      const duration=Math.round(profile.duration*eliteMultiplier);
      return{...event,...profile,category:asset===BASE.ASSETS.ELITE_VANGUARD?'ELITE_VANGUARD':'PROJECTILE',asset,impactAsset:BASE.ASSETS.IMPACT,pipeline:PIPELINES.PROJECTILE,duration,contactMs:Math.round(profile.contactMs*eliteMultiplier),priority:'P0'};
    }
    return{...event,impactAsset:BASE.ASSETS.IMPACT,pipeline:PIPELINES.HEAVY,duration:rank==='elite'?900:760,contactMs:rank==='elite'?260:220,priority:rank==='elite'?'P0':'P1',particleProfile:archetype==='COLOSSUS'?'quake':'enemy-shard'};
  }

  const API=Object.freeze({...BASE,VERSION,PIPELINES,RANGED_CARDS,HEAVY_CARDS,PROJECTILE_ARCHETYPES,CARD_PROJECTILE_PROFILES,ENEMY_PROJECTILE_PROFILES,card,enemy});
  global.TRIAD_COMBAT_VFX_V2=API;
  global.TRIAD_COMBAT_VFX=API;
})(window);
