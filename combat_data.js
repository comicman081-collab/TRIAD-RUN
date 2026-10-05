(function(global){
  'use strict';

  const RULES=Object.freeze({
    weaknessMultiplier:1.20,
    damageVariance:0.05,
    baseCritChance:0.15,
    baseCritMultiplier:1.50
  });

  // strongAgainst가 가리키는 속성은 이 속성의 공격에 20% 추가 피해를 받는다.
  const ELEMENTS=[
    {id:'EMBER',name:'화염',icon:'🔥',color:'#ff755f',strongAgainst:'BLOOM',family:'잿불'},
    {id:'BLOOM',name:'자연',icon:'🌿',color:'#89e7a6',strongAgainst:'VOLT',family:'녹음'},
    {id:'VOLT',name:'전격',icon:'⚡',color:'#6fe0ff',strongAgainst:'AEGIS',family:'뇌광'},
    {id:'AEGIS',name:'강철',icon:'🛡️',color:'#8da8ff',strongAgainst:'SHADE',family:'성철'},
    {id:'SHADE',name:'암흑',icon:'🌑',color:'#b488ff',strongAgainst:'RIFT',family:'그림자'},
    {id:'RIFT',name:'공허',icon:'🌀',color:'#9f82ff',strongAgainst:'EMBER',family:'균열'}
  ];
  const ELEMENT_BY_ID=Object.fromEntries(ELEMENTS.map(x=>[x.id,x]));
  ELEMENTS.forEach(element=>{
    element.weakTo=ELEMENTS.find(x=>x.strongAgainst===element.id).id;
    Object.freeze(element);
  });
  Object.freeze(ELEMENTS);

  const skill=(id,name,medianDamage,hits=1,target='single')=>({id,name,medianDamage,hits,target});

  // 1~9 일반(Act별 3종), 10~12 엘리트(Act별 1종), 13~15 보스(Act별 1종).
  // HP와 피해 중앙값은 몬스터 레코드 생성 시 확정되어 런 도중 스케일링되지 않는다.
  const ARCHETYPES=[
    {key:'SCOUT',suffix:'정찰체',rank:'normal',act:1,maxHp:42,icon:'👁️',skills:[skill('JAB','탐침',6),skill('FLURRY','연속 찌르기',4,2)]},
    {key:'HOUND',suffix:'사냥견',rank:'normal',act:1,maxHp:49,icon:'🐺',skills:[skill('BITE','물어뜯기',7),skill('LEAP','도약 강습',9)]},
    {key:'WARDEN',suffix:'문지기',rank:'normal',act:1,maxHp:58,icon:'🤖',skills:[skill('BASH','방패 가격',6),skill('WAVE','방호 파동',4,1,'all')]},
    {key:'CASTER',suffix:'주문체',rank:'normal',act:2,maxHp:70,icon:'🔮',skills:[skill('BOLT','응축탄',9),skill('SURGE','이중 방출',6,2)]},
    {key:'HUNTER',suffix:'추적자',rank:'normal',act:2,maxHp:78,icon:'🦂',skills:[skill('SHOT','정밀 사격',10),skill('VOLLEY','산개 사격',6,1,'all')]},
    {key:'BRUTE',suffix:'파쇄자',rank:'normal',act:2,maxHp:88,icon:'🦏',skills:[skill('CLUB','중량 타격',11),skill('CRUSH','분쇄 강타',14)]},
    {key:'WEAVER',suffix:'직조체',rank:'normal',act:3,maxHp:98,icon:'🕷️',skills:[skill('LASH','사슬 채찍',13),skill('WEB','구속 폭발',8,1,'all')]},
    {key:'RAVAGER',suffix:'광전사',rank:'normal',act:3,maxHp:108,icon:'👾',skills:[skill('REND','쌍열상',8,2),skill('FRENZY','광란',6,3)]},
    {key:'SENTINEL',suffix:'감시자',rank:'normal',act:3,maxHp:120,icon:'🗿',skills:[skill('SPEAR','관통창',15),skill('PULSE','감시 파동',10,1,'all')]},
    {key:'VANGUARD',suffix:'선봉 집행자',rank:'elite',act:1,maxHp:126,icon:'💀',skills:[skill('BREACH','전선 붕괴',12),skill('CROSS','교차 참격',8,2)]},
    {key:'REAPER',suffix:'수확자',rank:'elite',act:2,maxHp:174,icon:'💀',skills:[skill('REAP','수확의 낫',16),skill('HARVEST','생명 수확',10,1,'all')]},
    {key:'COLOSSUS',suffix:'거신',rank:'elite',act:3,maxHp:228,icon:'💀',skills:[skill('FIST','거신권',13,2),skill('QUAKE','붕괴 지진',13,1,'all')]},
    {key:'APOSTLE',suffix:'제1 사도',rank:'boss',act:1,maxHp:260,icon:'👹',skills:[skill('EDICT','파멸 선고',16),skill('JUDGMENT','초동 심판',11,1,'all')]},
    {key:'OVERMIND',suffix:'군집 의식',rank:'boss',act:2,maxHp:390,icon:'👹',skills:[skill('SYNAPSE','신경 절단',13,2),skill('DOMINION','정신 지배파',16,1,'all')]},
    {key:'SOVEREIGN',suffix:'종말 군주',rank:'boss',act:3,maxHp:560,icon:'👹',skills:[skill('END','종말의 쌍격',18,2),skill('COLLAPSE','세계 붕괴',24,1,'all')]}
  ];

  const MONSTERS=ELEMENTS.flatMap(element=>ARCHETYPES.map((base,index)=>({
    id:`${element.id}_M${String(index+1).padStart(2,'0')}`,
    catalogNo:index+1,
    name:`${element.family} ${base.suffix}`,
    elementId:element.id,
    rank:base.rank,
    act:base.act,
    maxHp:base.maxHp,
    icon:base.icon,
    critChance:RULES.baseCritChance,
    critMultiplier:RULES.baseCritMultiplier,
    skills:base.skills.map((s,skillIndex)=>({
      ...s,
      id:`${element.id}_${base.key}_${s.id}`,
      name:`${element.name} ${s.name}`,
      elementId:element.id,
      order:skillIndex+1
    }))
  })));
  const MONSTER_BY_ID=Object.fromEntries(MONSTERS.map(x=>[x.id,x]));

  function isWeakness(attackElementId,targetElementId){
    return Boolean(attackElementId&&targetElementId&&ELEMENT_BY_ID[attackElementId]?.strongAgainst===targetElementId);
  }

  // Runtime supplies the persisted run RNG. This fallback keeps standalone data
  // inspection deterministic rather than silently consuming ambient randomness.
  const deterministicFallbackRng=()=>0.5;

  function rollMedianDamage(medianDamage,rng=deterministicFallbackRng){
    const factor=1-RULES.damageVariance+rng()*RULES.damageVariance*2;
    return Math.max(0,Math.round(medianDamage*factor));
  }

  function resolveHit({medianDamage,attackElementId,targetElementId,critChance=RULES.baseCritChance,critMultiplier=RULES.baseCritMultiplier,weaknessMultiplier=RULES.weaknessMultiplier,rng=deterministicFallbackRng,modifier=1,variance=true,canCrit=true}){
    const rolled=variance?rollMedianDamage(medianDamage,rng):Math.max(0,Math.round(medianDamage));
    const weakness=isWeakness(attackElementId,targetElementId);
    const safeCritChance=Math.max(0,Math.min(1,Number(critChance)||0));
    const safeCritMultiplier=Math.max(1,Number(critMultiplier)||1);
    const critical=canCrit&&rng()<safeCritChance;
    const safeWeaknessMultiplier=Math.max(1,Number(weaknessMultiplier)||1);
    const amount=Math.max(0,Math.round(rolled*(weakness?safeWeaknessMultiplier:1)*(critical?safeCritMultiplier:1)*modifier));
    return{amount,rolled,weakness,weaknessMultiplier:weakness?safeWeaknessMultiplier:1,critical};
  }

  function pickMonster(stage,type,rng=deterministicFallbackRng){
    const act=Math.max(1,Math.min(3,Math.ceil(stage/10)));
    const rank=type==='boss'?'boss':type==='elite'?'elite':'normal';
    const pool=MONSTERS.filter(x=>x.rank===rank&&x.act===act);
    return pool[Math.floor(rng()*pool.length)];
  }

  // 읽기 쉬운 고정 패턴: 1, 1, 2 반복. 플레이어는 다음 행동을 항상 확인할 수 있다.
  function buildIntent(monster,turn){
    const skillIndex=turn%3===0?1:0;
    const selected=monster.skills[skillIndex];
    return{
      skillId:selected.id,
      skillName:selected.name,
      damage:selected.medianDamage,
      hits:selected.hits,
      target:selected.target,
      elementId:selected.elementId
    };
  }

  global.TRIAD_COMBAT_DATA=Object.freeze({
    RULES,ELEMENTS,ELEMENT_BY_ID,ARCHETYPES,MONSTERS,MONSTER_BY_ID,
    isWeakness,rollMedianDamage,resolveHit,pickMonster,buildIntent
  });
})(window);
