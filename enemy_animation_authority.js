(function(global){
  'use strict';

  // Runtime authority for enemy animation assets.  The frozen FRAME MVP set
  // remains valid, while promoted production pilots are accepted only when
  // their registry record is explicitly final and points at a non-candidate
  // production atlas.  Historical/candidate assets are never selected by
  // the normal resolver.
  const VERSION='1.2.0-per-actor-player-facing';
  const FRAME_MVP_ROOT='assets/enemies/monster_animation_p1/';
  const FRAME_PREVIEW_ROOT='assets/enemies/monsters_rgba_p1/';
  const PRODUCTION_ROOT='assets/enemies/production_pilot_v';
  const DIRECTION_CONTRACT=Object.freeze({
    faction:'ENEMY',
    battleLane:'RIGHT',
    facing:'LEFT',
    targetPolicy:'PLAYER_LANE'
  });
  const RIGHT_FACING_CATALOGS=new Set([2]);
  const LEFT_FACING_CATALOGS=new Set([5]);

  function directionFor(id){
    const catalogNo=Number(String(id||'').match(/_M(\d+)$/)?.[1])||0;
    const runtimeMirror=RIGHT_FACING_CATALOGS.has(catalogNo);
    return Object.freeze({
      ...DIRECTION_CONTRACT,
      sourceFacing:runtimeMirror?'RIGHT':LEFT_FACING_CATALOGS.has(catalogNo)?'LEFT':'FRONT_LEFT_BIAS',
      runtimeMirror,
      directionMode:runtimeMirror?'MIRROR_TO_PLAYER':LEFT_FACING_CATALOGS.has(catalogNo)?'SOURCE_LEFT':'FRONTAL_LEFT_BIAS'
    })
  }

  function stripQuery(value){return String(value||'').split('?')[0]}
  function pathHasForbiddenMarker(path){
    const normalized=stripQuery(path).toLowerCase();
    return normalized.includes('_candidate')||normalized.includes('/candidate/')||normalized.includes('/legacy/')||normalized.includes('/assembly/')||normalized.includes('fullart')||normalized.includes('portrait');
  }
  function productionPathFor(id,path){
    const normalized=stripQuery(path);
    if(!normalized.startsWith(PRODUCTION_ROOT)||pathHasForbiddenMarker(normalized))return false;
    const match=normalized.match(/^assets\/enemies\/production_pilot_v(\d+)\/([^/]+)\/([^/]+)\.webp$/i);
    if(!match)return false;
    return match[2]===id&&match[3].startsWith(`${id}_PRODUCTION_PILOT_V`);
  }
  function isFrozenV4FinalCompatibility(record){
    const atlas=stripQuery(record?.atlas);
    const manifest=stripQuery(record?.sourceManifest);
    return record?.status==='PASS_ACTIVE_FINAL'
      &&/^assets\/enemies\/production_pilot_v4\/[^/]+\/[^/]+_PRODUCTION_PILOT_V4\.webp$/i.test(atlas)
      &&manifest===atlas.replace(/\.webp$/i,'_MANIFEST.json')
      &&String(record?.productionRevision||'').endsWith('_V4_FINAL');
  }
  function classify(record,{allowQaCandidate=false}={}){
    if(!record?.id)return{ok:false,code:'MISSING_ID'};
    const id=String(record.id);
    const atlas=stripQuery(record.atlas);
    const preview=stripQuery(record.preview);
    if(record.status==='PASS_ACTIVE_FRAME_MVP'&&atlas===`${FRAME_MVP_ROOT}${id}.webp`&&preview===`${FRAME_PREVIEW_ROOT}${id}.png`){
      return{ok:true,kind:'FROZEN_FRAME_MVP',status:record.status,atlas,preview,qaOnly:false}
    }
    if(record.status==='PASS_ACTIVE_FINAL'&&productionPathFor(id,record.atlas)&&(record.runtimeActive===true||isFrozenV4FinalCompatibility(record))){
      return{ok:true,kind:record.runtimeActive===true?'PRODUCTION_FINAL':'PRODUCTION_FINAL_V4_COMPAT',status:record.status,atlas,preview,qaOnly:false}
    }
    if(allowQaCandidate&&record.status==='PASS_ACTIVE_CANDIDATE'&&record.runtimeActive===false&&pathHasForbiddenMarker(record.atlas)){
      return{ok:true,kind:'QA_CANDIDATE',status:record.status,atlas,preview,qaOnly:true}
    }
    let code='UNAPPROVED_RECORD';
    if(pathHasForbiddenMarker(record.atlas))code='FORBIDDEN_OR_HISTORICAL_PATH';
    else if(record.status==='PASS_ACTIVE_CANDIDATE')code='CANDIDATE_NOT_RUNTIME_ACTIVE';
    else if(record.status==='PASS_ACTIVE_FINAL'&&record.runtimeActive!==true)code='FINAL_RUNTIME_FLAG_MISSING';
    else if(!record.atlas)code='MISSING_ATLAS';
    return{ok:false,kind:'DENIED',status:record.status||null,atlas,preview,qaOnly:false,code}
  }
  function resolve(id,{allowQaCandidate=false}={}){
    const key=typeof id==='string'?id:id?.id;
    const record=global.TRIAD_ENEMY_ANIMATION_DATA?.byId?.[key];
    const verdict=classify(record,{allowQaCandidate});
    if(!verdict.ok)return null;
    return Object.assign({},record,directionFor(key),{authority:{version:VERSION,...verdict}})
  }
  function audit(records=global.TRIAD_ENEMY_ANIMATION_DATA?.records||[],{allowQaCandidate=false}={}){
    const rows=Array.isArray(records)?records:[];
    const byId=new Map();
    const results=[];
    for(const record of rows){
      const id=String(record?.id||'');
      byId.set(id,(byId.get(id)||0)+1);
      results.push({id,verdict:classify(record,{allowQaCandidate})})
    }
    const duplicates=[...byId.entries()].filter(([,count])=>count!==1).map(([id,count])=>({id,count}));
    const denied=results.filter(row=>!row.verdict.ok);
    return{version:VERSION,total:rows.length,uniqueIds:byId.size,duplicates,approved:results.filter(row=>row.verdict.ok).length,denied,results}
  }
  global.TRIAD_ENEMY_ANIMATION_AUTHORITY=Object.freeze({VERSION,DIRECTION_CONTRACT,directionFor,stripQuery,classify,resolve,audit});
})(window);
