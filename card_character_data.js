(function(global){
  'use strict';

  const STAR_MIN=0,STAR_MAX=5;
  const clampStar=star=>Math.max(STAR_MIN,Math.min(STAR_MAX,Math.floor(Number(star)||STAR_MIN)));

  // 캐릭터 차별점은 고유 패시브가 아닌 기본 능력치 배분에서 나온다.
  const CHARACTERS={
    EMBER:{id:'EMBER',specialty:'마법 공격 특화',elementId:'EMBER',baseHp:70,basePhysicalAttack:96,baseMagicAttack:110,baseDefense:96,baseRecovery:100,baseCritChance:.15,baseCritMultiplier:1.50},
    VOLT:{id:'VOLT',specialty:'물리 공격 특화',elementId:'VOLT',baseHp:68,basePhysicalAttack:108,baseMagicAttack:98,baseDefense:96,baseRecovery:98,baseCritChance:.15,baseCritMultiplier:1.50},
    AEGIS:{id:'AEGIS',specialty:'방어 특화',elementId:'AEGIS',baseHp:94,basePhysicalAttack:98,baseMagicAttack:94,baseDefense:112,baseRecovery:104,baseCritChance:.15,baseCritMultiplier:1.50},
    SHADE:{id:'SHADE',specialty:'물리·마법 혼합형',elementId:'SHADE',baseHp:72,basePhysicalAttack:106,baseMagicAttack:104,baseDefense:94,baseRecovery:96,baseCritChance:.15,baseCritMultiplier:1.50},
    BLOOM:{id:'BLOOM',specialty:'회복·지원 특화',elementId:'BLOOM',baseHp:80,basePhysicalAttack:92,baseMagicAttack:102,baseDefense:104,baseRecovery:112,baseCritChance:.15,baseCritMultiplier:1.50},
    RIFT:{id:'RIFT',specialty:'고화력 유리대포',elementId:'RIFT',baseHp:64,basePhysicalAttack:104,baseMagicAttack:108,baseDefense:90,baseRecovery:96,baseCritChance:.15,baseCritMultiplier:1.50}
  };

  const BREAKTHROUGH_MIN=0,BREAKTHROUGH_MAX=5;
  const BREAKTHROUGH=[
    {level:0,hpMultiplier:1.00,statBonus:0,critChanceBonus:0,critMultiplierBonus:0},
    {level:1,hpMultiplier:1.03,statBonus:1,critChanceBonus:0,critMultiplierBonus:0},
    {level:2,hpMultiplier:1.05,statBonus:2,critChanceBonus:0,critMultiplierBonus:0},
    {level:3,hpMultiplier:1.07,statBonus:3,critChanceBonus:.01,critMultiplierBonus:0},
    {level:4,hpMultiplier:1.09,statBonus:4,critChanceBonus:.01,critMultiplierBonus:.02},
    {level:5,hpMultiplier:1.12,statBonus:6,critChanceBonus:.02,critMultiplierBonus:.05}
  ];
  const clampBreakthrough=level=>Math.max(BREAKTHROUGH_MIN,Math.min(BREAKTHROUGH_MAX,Math.floor(Number(level)||0)));
  function characterStats(id,breakthrough=0){
    const base=CHARACTERS[id],level=clampBreakthrough(breakthrough),growth=BREAKTHROUGH[level];
    if(!base)return null;
    return{
      id:base.id,specialty:base.specialty,elementId:base.elementId,breakthrough:level,
      maxHp:Math.round(base.baseHp*growth.hpMultiplier),
      physicalAttack:base.basePhysicalAttack+growth.statBonus,
      magicAttack:base.baseMagicAttack+growth.statBonus,
      defense:base.baseDefense+growth.statBonus,
      recovery:base.baseRecovery+growth.statBonus,
      critChance:base.baseCritChance+growth.critChanceBonus,
      critMultiplier:base.baseCritMultiplier+growth.critMultiplierBonus
    };
  }

  const CARD_DAMAGE_TYPES=Object.freeze({
    strike:'physical',guard:'utility',quick:'physical',heavy:'physical',focus:'utility',
    battery:'utility',mark:'magic',dot:'magic',burst:'physical',heal:'utility',
    combo:'physical',scale:'magic',counter:'physical',execute:'physical',
    inferno:'magic',volley:'physical',bastion:'physical',ambush:'physical',renewal:'utility',overload:'magic',
    signature:'magic'
  });
  const CARD_AFFINITIES=Object.freeze({
    strike:['VOLT','SHADE'],guard:['AEGIS','BLOOM'],quick:['VOLT','SHADE'],heavy:['VOLT','RIFT'],
    focus:['AEGIS','BLOOM'],battery:['BLOOM','RIFT'],mark:['EMBER','SHADE'],dot:['EMBER','RIFT'],
    burst:['VOLT','SHADE'],heal:['BLOOM'],combo:['VOLT','SHADE'],scale:['EMBER','RIFT'],
    counter:['AEGIS'],execute:['SHADE','RIFT'],
    inferno:['EMBER','RIFT'],volley:['VOLT','SHADE'],bastion:['AEGIS'],ambush:['SHADE'],renewal:['BLOOM'],overload:['RIFT'],
    signature:['EMBER','VOLT','AEGIS','SHADE','BLOOM','RIFT']
  });
  const SIGNATURE_PROFILES=Object.freeze({
    EMBER:{name:'초신성 폭발',damageType:'magic',damageMultiplier:1.00,shieldRatio:.25,burn:4},
    VOLT:{name:'뇌광 난무',damageType:'physical',damageMultiplier:.90,shieldRatio:.15,shock:4,draw:1},
    AEGIS:{name:'성채 반격',damageType:'physical',damageMultiplier:.70,shieldRatio:1.00,counterRatio:.45},
    SHADE:{name:'황혼 연계',damageType:'physical',damageMultiplier:.90,shieldRatio:.20,mark:4,chainBonus:6},
    BLOOM:{name:'생명의 개화',damageType:'magic',damageMultiplier:.55,shieldRatio:.45,healRatio:.35},
    RIFT:{name:'공허 붕괴',damageType:'magic',damageMultiplier:1.25,shieldRatio:.10,burn:1,shock:1}
  });
  function recommendedCharacters(key){return CARD_AFFINITIES[key]||[]}
  function isAffinity(characterId,key){return recommendedCharacters(key).includes(characterId)}
  function signatureProfile(characterId){return SIGNATURE_PROFILES[characterId]||SIGNATURE_PROFILES.EMBER}
  function damageType(key,characterId){return key==='signature'?signatureProfile(characterId).damageType:(CARD_DAMAGE_TYPES[key]||'utility')}
  function damageMultiplier(stats,type){
    if(type==='physical')return (stats?.physicalAttack||100)/100;
    if(type==='magic')return (stats?.magicAttack||100)/100;
    return 1;
  }
  function shieldMultiplier(stats){return Math.max(.5,(stats?.defense||100)/100)}
  function recoveryMultiplier(stats){return Math.max(.5,(stats?.recovery||100)/100)}
  function incomingDamageMultiplier(stats){return 100/Math.max(50,stats?.defense||100)}

  const growth=(values,secondary,star5)=>({values,secondary,star5});
  const CARD_GROWTH={
    strike:growth([7,8,9,10,11,12],null,{id:'CRIT_2',text:'이 카드 치명타 확률 +2%p',critChanceBonus:.02}),
    guard:growth([7,8,9,10,11,12],null,{id:'SHIELD_2',text:'보호막 +2',shieldBonus:2}),
    quick:growth([4,5,5,6,6,7],[0,0,.01,.01,.02,.02],{id:'CRIT_2',text:'이 카드 치명타 확률 추가 +2%p',critChanceBonus:.02}),
    heavy:growth([15,17,19,21,23,25],null,{id:'WEAK_5',text:'약점 피해 배율 추가 +5%p',weaknessBonus:.05}),
    focus:growth([2,2,3,3,4,4],[0,1,1,2,2,3],{id:'SHIELD_2',text:'보호막 추가 +2',shieldBonus:2}),
    battery:growth([1,1,1,2,2,2],[0,1,2,2,3,4],{id:'HEAL_2',text:'사용 시 체력이 가장 낮은 아군 HP 2 회복',healBonus:2}),
    mark:growth([2,2,3,3,4,4],[4,5,5,6,6,7],{id:'STATUS_1',text:'표식 추가 +1',statusBonus:1}),
    dot:growth([2,2,3,3,4,4],[5,6,6,7,7,8],{id:'STATUS_1',text:'상태이상 추가 +1',statusBonus:1}),
    burst:growth([3,3,3,4,4,5],[4,5,6,5,6,5],{id:'CRIT_1',text:'각 타격 치명타 확률 +1%p',critChanceBonus:.01}),
    heal:growth([6,7,8,9,10,11],null,{id:'SHIELD_2',text:'회복 대상에게 보호막 2',targetShield:2}),
    combo:growth([8,10,11,13,14,16],null,{id:'CHAIN_2',text:'서로 다른 주인 연계 추가 피해 +2',chainDamage:2}),
    scale:growth([12,14,16,18,20,22],[2,2,2,2,2,2],{id:'SCALE_1',text:'상태이상당 추가 피해 +1',statusScaleBonus:1}),
    counter:growth([5,6,7,8,9,10],[5,6,7,8,9,10],{id:'COUNTER_2',text:'반격 피해 +2',counterDamage:2}),
    execute:growth([13,15,17,19,21,23],null,{id:'EXECUTE_40',text:'강화 기준 HP 35% → 40%',executeThreshold:.40}),
    inferno:growth([6,7,8,9,10,11],[2,2,3,3,4,4],{id:'STATUS_1',text:'화상 추가 +1',statusBonus:1}),
    volley:growth([2,2,3,3,4,4],[4,5,5,6,6,7],{id:'CRIT_1',text:'각 타격 치명타 확률 +1%p',critChanceBonus:.01}),
    bastion:growth([8,9,10,11,12,13],[3,3,4,4,5,5],{id:'SHIELD_2',text:'보호막 추가 +2',shieldBonus:2}),
    ambush:growth([9,11,12,14,15,17],[2,2,3,3,4,4],{id:'MARK_SCALE_1',text:'표식당 추가 피해 +1',markScaleBonus:1}),
    renewal:growth([3,4,5,6,7,8],[0,0,1,1,2,2],{id:'SHIELD_2',text:'아군 전체 보호막 추가 +2',shieldBonus:2}),
    overload:growth([16,18,20,22,24,27],[4,4,4,4,4,4],{id:'SELF_DAMAGE_DOWN',text:'자해 피해 4 → 3',selfDamage:3}),
    signature:growth([22,25,28,31,34,37],null,{id:'SHIELD_2',text:'아군 전체 보호막 추가 +2',shieldBonus:2})
  };

  function growthFor(key){return CARD_GROWTH[key]||CARD_GROWTH.strike}
  function value(key,star=0){const s=clampStar(star);return growthFor(key).values[s]}
  function secondary(key,star=0){const s=clampStar(star),list=growthFor(key).secondary;return list?list[s]:0}
  function star5Perk(key,star=0){return clampStar(star)>=STAR_MAX?growthFor(key).star5:null}
  function starLabel(star=0){const s=clampStar(star);return s===0?'명함':`★${s}`}

  function description(key,star=0,characterId){
    const v=value(key,star),s=secondary(key,star),perk=star5Perk(key,star);
    if(key==='signature'){
      const profile=signatureProfile(characterId),parts=[`${profile.damageType==='physical'?'물리':'마법'} 피해 ${Math.round(v*profile.damageMultiplier)}`];
      if(profile.shieldRatio)parts.push(`아군 전체 보호막 ${Math.round(v*profile.shieldRatio)}`);
      if(profile.healRatio)parts.push(`아군 전체 HP ${Math.round(v*profile.healRatio)} 회복`);
      if(profile.counterRatio)parts.push(`물리 반격 ${Math.round(v*profile.counterRatio)}`);
      if(profile.burn)parts.push(`화상 ${profile.burn}`);
      if(profile.shock)parts.push(`감전 ${profile.shock}`);
      if(profile.mark)parts.push(`표식 ${profile.mark}`);
      if(profile.draw)parts.push(`카드 ${profile.draw}장 드로우`);
      if(profile.chainBonus)parts.push(`주인 교대 시 추가 피해 ${profile.chainBonus}`);
      return`${parts.join(' + ')}${perk?` · 돌파5 ${perk.text}`:''}`;
    }
    const descriptions={
      strike:`물리 피해 ${v}`,
      guard:`아군 전체 보호막 ${v}`,
      quick:`물리 피해 ${v}. 카드 1장 드로우${s?` · 치명타 +${Math.round(s*100)}%p`:''}`,
      heavy:`물리 피해 ${v}`,
      focus:`카드 ${v}장 드로우${s?` · 아군 전체 보호막 ${s}`:''}`,
      battery:`에너지 +${v}${s?` · 아군 전체 보호막 ${s}`:''}. 전투 중 소멸`,
      mark:`마법 피해 ${s} + 표식 ${v}`,
      dot:`마법 피해 ${s} + 캐릭터 상태이상 ${v}`,
      burst:`${v}회 × 물리 피해 ${s}`,
      heal:`가장 체력이 낮은 아군 HP ${v} 회복`,
      combo:`물리 피해 ${v}. 직전 카드와 주인이 다르면 추가 피해 7`,
      scale:`마법 피해 ${v}. 대상 상태이상마다 추가 피해 ${s}`,
      counter:`아군 전체 보호막 ${v} + 물리 반격 피해 ${s}`,
      execute:`물리 피해 ${v}. 적 HP 35% 이하에서 2배`,
      inferno:`마법 피해 ${v} + 화상 ${s}`,
      volley:`${v}회 × 물리 피해 ${s}`,
      bastion:`아군 전체 보호막 ${v} + 물리 반격 피해 ${s}`,
      ambush:`물리 피해 ${v} + 대상 표식당 추가 피해 ${s}`,
      renewal:`아군 전체 HP ${v} 회복${s?` + 아군 전체 보호막 ${s}`:''}`,
      overload:`마법 피해 ${v} + 소유 캐릭터 HP ${s} 소모(전투불능 불가). 전투 중 소멸`,
      signature:`마법 피해 ${v} + 보호막 ${Math.round(v*.4)} + 핵심 상태이상`
    };
    return`${descriptions[key]||`효과 ${v}`}${perk?` · ★5 ${perk.text}`:''}`;
  }

  global.TRIAD_CARD_CHARACTER_DATA=Object.freeze({
    STAR_MIN,STAR_MAX,BREAKTHROUGH_MIN,BREAKTHROUGH_MAX,CHARACTERS,BREAKTHROUGH,CARD_GROWTH,
    CARD_DAMAGE_TYPES,CARD_AFFINITIES,SIGNATURE_PROFILES,clampStar,clampBreakthrough,characterStats,
    recommendedCharacters,isAffinity,signatureProfile,damageType,damageMultiplier,
    shieldMultiplier,recoveryMultiplier,incomingDamageMultiplier,value,secondary,star5Perk,starLabel,description
  });
})(window);
