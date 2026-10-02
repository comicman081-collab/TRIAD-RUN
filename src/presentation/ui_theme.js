/* Interface theme behaviour: screen-aware body state, entrance animations,
   the cinematic wipe between major screens, the new-run stepper, a living
   backdrop taken from the current scene, the run HUD on the route map and
   numeric HP on combat bars.  Presentation only; every hook calls the
   original function first and keeps its return value. */
(function(root){
  'use strict';
  const VERSION='ui-theme-1.0.0';
  const SCENES=['a_ruined_checkpoint','a_flooded_metro','a_toxic_refinery','a_dead_forest_village','a_cathedral_graveyard','a_frozen_exclusion_zone','a_ash_convoy_graveyard','a_bioresearch_breach','a_storm_shipyard','a_annihilation_crater'];
  const RUN_STEPS=[['difficultySelect','난이도'],['partySelect','출전 파티'],['startDraft','시작 덱'],['tutorial','작전 브리핑']];
  const RUN_SCREENS=new Set(['route','event','reward','combat','tutorial']);
  const game=()=>typeof run!=='undefined'?run:null;
  const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  const $=selector=>document.querySelector(selector);
  let lastScreen=null;

  function wrap(name,after){
    const original=root[name];if(typeof original!=='function'||original.__uiWrapped)return;
    const wrapped=function(...args){const result=original.apply(this,args);try{after(result,args)}catch(e){console.warn('TRIAD_UI_THEME',name,e)}return result};
    wrapped.__uiWrapped=true;wrapped.__uiOriginal=original;root[name]=wrapped;
  }

  // --- backdrop -------------------------------------------------------------
  function sceneFor(stage){
    const info=root.TRIAD_STAGE_PROGRESSION?.stageInfo?.(stage);const index=Math.max(1,Math.min(10,Number(info?.battleBackgroundIndex)||1));
    return`url("assets/battle_backgrounds/stage${String(index).padStart(2,'0')}_${SCENES[index-1]}.webp")`;
  }
  function updateBackdrop(screen){
    const current=game();let image='';
    if(current&&RUN_SCREENS.has(screen))image=sceneFor(current.stage||1);
    else{const shell=$('#lobbyShell');image=shell?.style.backgroundImage||''}
    const path=/url\(["']?([^"')]+)["']?\)/.exec(image)?.[1];
    // Resolve against the document: a relative url() in a custom property
    // would otherwise resolve against the stylesheet that consumes it.
    if(path)document.body.style.setProperty('--ui-backdrop',`url("${new URL(path,document.baseURI).href}")`);
  }

  // --- screen state, entrance and wipe -----------------------------------------------
  function transitionLabel(from,to){
    const current=game();
    if(to==='combat'){const type=current?.combat?.type;if(type==='tutorial')return['TRAINING','기초 전투 훈련'];return[type==='boss'?'BOSS BATTLE':type==='elite'?'ELITE BATTLE':'ENGAGE',`STAGE ${current?.stage||1}`]}
    if(to==='route'&&from&&from!=='route'&&from!=='event')return[`ACT ${Math.ceil((current?.stage||1)/10)}`,`STAGE ${current?.stage||1} · 탐사 경로`];
    if(to==='reward'&&from==='combat')return['VICTORY','STAGE CLEAR'];
    return null;
  }
  function wipe(label){
    if(reducedMotion())return;
    let node=$('#uiTransition');if(!node){node=document.createElement('div');node.id='uiTransition';node.setAttribute('aria-hidden','true');document.body.appendChild(node)}
    node.innerHTML=label?`<div class="label"><span></span><b></b></div>`:'';
    if(label){node.querySelector('.label span').textContent=label[1];node.querySelector('.label b').textContent=label[0]}
    node.classList.remove('run');void node.offsetWidth;node.classList.add('run');
    clearTimeout(wipe.timer);wipe.timer=setTimeout(()=>node.classList.remove('run'),600);
  }
  function onScreen(id){
    const from=lastScreen;lastScreen=id;
    document.body.dataset.screen=id;
    updateBackdrop(id);
    const screen=document.getElementById(id);
    if(screen&&from!==id&&!reducedMotion()){screen.classList.remove('ui-enter');void screen.offsetWidth;screen.classList.add('ui-enter');setTimeout(()=>screen.classList.remove('ui-enter'),520)}
    const label=from&&from!==id?transitionLabel(from,id):null;if(label)wipe(label);
    renderStepper(id);
    if(id==='route')renderRunHud();
  }

  // --- new-run stepper ---------------------------------------------------------------------
  function renderStepper(id){
    const index=RUN_STEPS.findIndex(([screen])=>screen===id);if(index<0)return;
    const host=id==='difficultySelect'?$('#difficultySelect .difficulty-shell'):id==='tutorial'?$('#tutorial .tutorial-shell'):$(`#${id} > .panel`);if(!host)return;
    let list=host.querySelector(':scope > .run-stepper');
    if(!list){list=document.createElement('ol');list.className='run-stepper';list.setAttribute('aria-label','새 RUN 준비 단계');host.prepend(list)}
    list.innerHTML=RUN_STEPS.map(([,label],i)=>`<li class="${i<index?'done':i===index?'current':''}"${i===index?' aria-current="step"':''}><b>${i<index?'✓':i+1}</b>${label}</li>`).join('');
  }

  // --- route run HUD -------------------------------------------------------------------------
  // Head crop of the character's current standing art, framed on the live rig's eye line.
  function portraitStyle(member){
    const record=root.TRIAD_CHARACTER_ROSTER?.byId?.[member.characterId],src=record?.lobbyArt?.path||record?.portrait||record?.fullArt||'';if(!src)return'';
    const head=root.TRIAD_LIVE_ILLUSTRATION?.RIGS?.[member.characterId]?.head;if(!head)return`background-image:url("${src}");background-size:cover;background-position:center 12%`;
    const size=30,k=.25;return`background-image:url("${src}");background-size:${1024*k}px ${1536*k}px;background-position:${(size/2-head[0]*k).toFixed(1)}px ${(size*.52-head[1]*k).toFixed(1)}px`;
  }
  function renderRunHud(){
    const current=game(),title=$('#route .section-title');if(!current?.party||!title)return;
    let hud=title.querySelector('.run-hud');if(!hud){hud=document.createElement('div');hud.className='run-hud';title.insertBefore(hud,title.lastElementChild)}
    hud.innerHTML=current.party.map(member=>{const ratio=Math.max(0,Math.min(1,member.hp/Math.max(1,member.maxHp)));return`<div class="hud-member${member.hp<=0?' dead':ratio<.35?' low':''}"><i class="hud-face" aria-hidden="true" style='${portraitStyle(member)}'></i><div><b>${member.name}</b><div class="hud-hp"><i style="width:${(ratio*100).toFixed(1)}%"></i></div><small>HP ${Math.max(0,member.hp)}/${member.maxHp}</small></div></div>`}).join('');
  }

  // --- combat HP numbers ---------------------------------------------------------------------------------
  function label(bar,text,low){
    if(!bar)return;let span=bar.querySelector(':scope > .sd-hp-value');if(!span){span=document.createElement('span');span.className='sd-hp-value';bar.appendChild(span)}
    span.innerHTML=text;bar.classList.toggle('low',Boolean(low));
  }
  function labelMember(memberId,hp,maxHp,shield){
    const sprite=document.querySelector(`#partySprites [data-core-id="${memberId}"]`);if(!sprite)return;
    const bar=sprite.querySelector('.sd-mini-bar:not(.shield)');
    label(bar,`${Math.max(0,hp)}/${maxHp}${shield>0?`<em>🛡${shield}</em>`:''}`,hp>0&&hp/maxHp<.35);
  }
  function labelEnemy(hp,maxHp){const bar=document.querySelector('#enemySpriteWrap .sd-mini-bar');label(bar,`${Math.max(0,hp)} / ${maxHp}`,false)}
  function syncCombatLabels(){
    const current=game(),combat=current?.combat;if(!combat)return;
    for(const member of current.party||[])labelMember(member.id,member.hp,member.maxHp,member.shield||0);
    if(combat.enemy)labelEnemy(combat.enemy.hp,combat.enemy.maxHp);
  }

  // --- ambient motes on menu screens ---------------------------------------------------------------------------
  function ambient(){
    if(reducedMotion())return;
    const canvas=document.createElement('canvas');canvas.id='uiAmbient';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
    const ctx=canvas.getContext('2d');let w=0,h=0,last=0;const motes=[];
    const resize=()=>{const dpr=Math.min(1.5,root.devicePixelRatio||1);w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0)};
    resize();addEventListener('resize',resize);
    for(let i=0;i<46;i++)motes.push({x:Math.random(),y:Math.random(),r:Math.random()*1.8+.6,s:Math.random()*.018+.006,d:Math.random()*Math.PI*2,warm:Math.random()<.35});
    const tick=now=>{
      requestAnimationFrame(tick);
      if(document.hidden||document.body.dataset.screen==='combat'||now-last<33)return;
      const dt=Math.min(.1,(now-last)/1000);last=now;ctx.clearRect(0,0,w,h);
      for(const m of motes){m.y-=m.s*dt;m.x+=Math.sin(now/2400+m.d)*.004*dt;if(m.y<-.02){m.y=1.02;m.x=Math.random()}
        const x=m.x*w,y=m.y*h,a=.25+.35*Math.sin(now/900+m.d*3)**2,g=ctx.createRadialGradient(x,y,0,x,y,m.r*5);
        g.addColorStop(0,m.warm?`rgba(255,190,120,${a})`:`rgba(150,230,255,${a})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-m.r*5,y-m.r*5,m.r*10,m.r*10)}
    };
    requestAnimationFrame(tick);
  }

  function install(){
    if(root.TRIAD_UI_THEME)return;
    document.body.classList.add('ui-theme');
    wrap('showScreen',(result,[id])=>onScreen(id));
    wrap('renderLobby',()=>{if(document.body.dataset.screen==='home'||!document.body.dataset.screen)updateBackdrop('home')});
    wrap('showRoute',()=>renderRunHud());
    wrap('renderCombat',()=>syncCombatLabels());
    wrap('renderEnemyHpPresentation',(result,[hp,maxHp])=>labelEnemy(Number(hp)||0,Number(maxHp)||game()?.combat?.enemy?.maxHp||1));
    wrap('renderPartyMemberPresentation',(result,[snapshot])=>{const member=game()?.party?.find(p=>p.id===snapshot?.targetId);if(member)labelMember(member.id,Number(snapshot.hpAfter??member.hp),member.maxHp,Number(snapshot.shieldAfter??member.shield)||0)});
    ambient();
    const active=document.querySelector('.screen.active');onScreen(active?.id||'home');
    root.TRIAD_UI_THEME=Object.freeze({version:VERSION,refresh:()=>onScreen(document.body.dataset.screen||'home')});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})(globalThis);
