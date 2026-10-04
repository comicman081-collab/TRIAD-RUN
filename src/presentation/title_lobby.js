/* Title screen and command lobby behaviour.

   Boot shows a cinematic title (element-themed key art, live character,
   animated logo, real asset preloading, touch to start).  Starting plays a
   flash transition into the NIKKE-style lobby, whose featured character is a
   live illustration that reacts to the pointer and to taps.  Automation
   (navigator.webdriver) skips the title unless the URL carries ?title. */
(function(root){
  'use strict';
  const VERSION='title-lobby-1.0.2';
  const SCENES=Object.freeze({
    FIRE:{bg:'stage07_b_collapsed_megabridge',tint:'#ff8a4a'},
    LIGHTNING:{bg:'stage09_b_offshore_platform',tint:'#7fdcff'},
    GUARD:{bg:'stage06_a_frozen_exclusion_zone',tint:'#a8ccff'},
    SHADOW:{bg:'stage05_a_cathedral_graveyard',tint:'#b58cff'},
    NATURE:{bg:'stage08_b_quarantine_greenhouse',tint:'#8ff0b0'},
    RIFT:{bg:'stage10_b_orbital_sanctum',tint:'#c890ff'}
  });
  const NOTES=['PC 첫 실행과 전투 진입 로딩 최적화','0 AP 공격 · 퀵 액션과 매복은 같은 캐릭터의 같은 카드 종류당 턴에 1회','전투 연출 강화 · 필살기 컷인, 보스 경고와 격파 연출','캐릭터 라이브 모션 · 로비 캐릭터가 숨 쉬고 반응합니다','지휘 로비 개편 · 한 화면에서 출격과 성장 메뉴를 바로 선택','전투 HUD · 아군과 적의 HP 수치 표시'];
  const params=new URLSearchParams(location.search);
  const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  const call=(name,...args)=>{const fn=root[name];return typeof fn==='function'?fn(...args):undefined};
  const gameProfile=()=>typeof profile!=='undefined'?profile:null;
  let lobbyLive=null,lobbyCharacter=null,lobbyFx=null,lobbyFxTint='',titleNode=null,titleLive=null,titleFx=null;

  function featured(){
    const record=call('lobbyCharacterRecord')||root.TRIAD_CHARACTER_ROSTER?.records?.[0]||null;
    const asset=record?call('lobbyCharacterAsset',record):null;
    return{record,path:asset?.path||record?.lobbyArt?.path||'',scene:SCENES[record?.element]||SCENES.FIRE};
  }
  function preload(src){return new Promise(resolve=>{if(!src)return resolve();const image=new Image();image.decoding='async';image.onload=image.onerror=()=>resolve();image.src=src})}

  // ------------------------------------------------------------- title
  const EMBLEM=`<svg class="ts-emblem" viewBox="-100 -100 200 200" aria-hidden="true"><defs><linearGradient id="tsMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d6ecff"/><stop offset=".62" stop-color="#7fb4d6"/><stop offset="1" stop-color="#eef8ff"/></linearGradient></defs>
<circle class="ring" r="88"/><circle class="ticks" r="95"/>
<path class="blade" style="--r:rotate(0deg)" d="M0-80 20-30 7-22 0-38-7-22-20-30Z"/><path class="blade" style="--r:rotate(120deg)" d="M0-80 20-30 7-22 0-38-7-22-20-30Z"/><path class="blade" style="--r:rotate(240deg)" d="M0-80 20-30 7-22 0-38-7-22-20-30Z"/>
<path class="core" d="M0-17 15 0 0 17-15 0Z"/></svg>`;

  function particles(canvas,tint,count=150){
    const ctx=canvas.getContext('2d');let w=0,h=0,raf=0,last=performance.now();const dpr=Math.min(1.5,root.devicePixelRatio||1);
    const resize=()=>{w=canvas.clientWidth;h=canvas.clientHeight;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)};resize();
    const hex=tint.replace('#',''),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
    const make=()=>{const kind=Math.random();return{x:Math.random()*w,y:h*(.3+Math.random()*.8),r:kind<.12?Math.random()*18+10:Math.random()*2.2+.6,vy:-(Math.random()*26+8),vx:Math.random()*14-7,a:Math.random()*.6+.25,ph:Math.random()*6.28,bokeh:kind<.12,warm:Math.random()<.7}};
    const list=Array.from({length:reducedMotion()?Math.min(30,count):count},make);
    const frame=now=>{raf=requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(canvas.offsetParent===null||document.hidden)return;if(canvas.clientWidth!==w)resize();ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
      for(const p of list){p.x+=(p.vx+Math.sin(now/1300+p.ph)*8)*dt;p.y+=p.vy*dt;if(p.y<-30){Object.assign(p,make(),{y:h+20})}
        const tw=.55+.45*Math.sin(now/600+p.ph*3),alpha=p.a*tw*(p.bokeh?.16:1),col=p.warm?rgb:[220,235,255],r=p.bokeh?p.r:p.r*3.2;
        const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,`rgba(${col[0]},${col[1]},${col[2]},${alpha})`);g.addColorStop(p.bokeh?.7:.35,`rgba(${col[0]},${col[1]},${col[2]},${alpha*(p.bokeh?.6:.3)})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2)}};
    raf=requestAnimationFrame(frame);addEventListener('resize',resize);
    return{stop(){cancelAnimationFrame(raf);removeEventListener('resize',resize)}};
  }

  function buildTitle(){
    const {record,path,scene}=featured();
    const node=document.createElement('div');node.id='titleScreen';node.className='title-screen';node.setAttribute('role','dialog');node.setAttribute('aria-label','TRIAD // RUN 타이틀 화면');node.tabIndex=0;
    node.style.setProperty('--ts-tint',scene.tint);
    node.innerHTML=`<div class="ts-parallax"><div class="ts-layer ts-bg"></div><div class="ts-layer ts-rays"></div><div class="ts-layer ts-aura"></div><div class="ts-char"></div><div class="ts-layer ts-fog"></div><div class="ts-layer ts-fog b"></div></div>
<canvas class="ts-fx"></canvas><div class="ts-layer ts-grade"></div><div class="ts-layer ts-grain"></div>
<div class="ts-logo">${EMBLEM}<div class="ts-word">TRIAD</div><div class="ts-sub"><b><em>//</em>RUN</b></div><div class="ts-tag">TACTICAL DECK RPG</div></div>
<div class="ts-start"><div class="ts-loading"><div class="bar"><i></i></div><span>데이터 동기화 중 0%</span></div><div class="ts-tap"><b>화면을 터치하여 시작</b><small>TOUCH TO START</small></div></div>
<div class="ts-sys"><button type="button" class="ts-notice-btn" aria-label="업데이트 소식">✉</button><button type="button" class="ts-sound" aria-label="배경음악 켜기/끄기">♫</button></div>
<div class="ts-foot"><span>VER 0.8 · BUILD 2026.10.04</span><span>© TRIAD // RUN</span></div>
<div class="ts-layer ts-flash"></div><div class="ts-layer ts-black"></div>`;
    node.querySelector('.ts-bg').style.backgroundImage=`url("${new URL(`assets/battle_backgrounds/${scene.bg}.webp`,document.baseURI).href}")`;
    const host=node.querySelector('.ts-char');
    if(path){const img=document.createElement('img');img.alt=`${record?.name||''} 키 아트`;img.src=path;host.appendChild(img)}
    return{node,record,path,scene,host};
  }

  function show(options={}){
    if(titleNode)return titleNode;
    const built=buildTitle(),node=built.node;titleNode=node;document.body.appendChild(node);document.body.classList.add('title-active');
    document.documentElement.classList.remove('ts-boot');
    titleFx=particles(node.querySelector('.ts-fx'),built.scene.tint);
    titleLive=root.TRIAD_LIVE_ILLUSTRATION?.create(built.host,{heightScale:1.12,headY:.17,centerX:.67,maxScale:1.3});
    const loads=[built.path?(titleLive?titleLive.setSource(built.path,built.record?.id,built.scene.tint):preload(built.path)):null,preload(node.querySelector('.ts-bg').style.backgroundImage.replace(/^url\("|"\)$/g,'')),document.fonts?.ready,preload(call('lobbyBackgroundRecord')?.path)].filter(Boolean);
    let done=0;const bar=node.querySelector('.ts-loading i'),label=node.querySelector('.ts-loading span'),t0=performance.now();
    const tick=()=>{const pct=Math.round(done/loads.length*100);bar.style.width=pct+'%';label.textContent=`데이터 동기화 중 ${pct}%`};
    loads.forEach(p=>Promise.resolve(p).then(()=>{done++;tick()}));
    Promise.all(loads).then(()=>new Promise(r=>setTimeout(r,Math.max(0,300-(performance.now()-t0))))).then(()=>{
      if(titleNode!==node)return;
      // A fast connection must reveal the title art before enabling its start prompt.
      for(const selector of ['.ts-char','.ts-logo'])for(const animation of node.querySelector(selector)?.getAnimations?.({subtree:true})||[]){
        if(Number.isFinite(animation.effect?.getTiming().iterations))try{animation.finish()}catch{}
      }
      node.classList.add('ts-ready');
    });
    node.addEventListener('pointermove',event=>{if(reducedMotion())return;const x=event.clientX/innerWidth-.5,y=event.clientY/innerHeight-.5;node.querySelector('.ts-parallax').style.transform=`translate3d(${-x*18}px,${-y*10}px,0) scale(1.02)`});
    node.querySelector('.ts-sound').addEventListener('click',event=>{event.stopPropagation();call('toggleBgm')});
    node.querySelector('.ts-notice-btn').addEventListener('click',event=>{event.stopPropagation();const open=node.querySelector('.ts-notice');if(open){open.remove();return}const panel=document.createElement('div');panel.className='ts-notice';panel.innerHTML='<h3>업데이트 소식 · VER 0.8</h3><ul></ul>';panel.querySelector('ul').innerHTML=NOTES.map(n=>`<li></li>`).join('');panel.querySelectorAll('li').forEach((li,i)=>li.textContent=NOTES[i]);panel.addEventListener('click',e=>e.stopPropagation());node.appendChild(panel)});
    const start=event=>{if(!node.classList.contains('ts-ready')||node.classList.contains('ts-leaving'))return;if(event?.type==='keydown'&&!['Enter',' ','Spacebar'].includes(event.key))return;event?.preventDefault?.();leave()};
    node.addEventListener('click',start);node.addEventListener('keydown',start);
    setTimeout(()=>node.focus({preventScroll:true}),50);
    try{if(typeof AUDIO!=='undefined')AUDIO.playScreen('home')}catch{}
    return node;
  }

  function leave(){
    const node=titleNode;if(!node)return;
    try{if(typeof AUDIO!=='undefined')AUDIO.playScreen('home')}catch{}
    try{if(typeof SFX!=='undefined')SFX.play('ultimateCharge',{volume:.55})}catch{}
    node.classList.add('ts-leaving');
    setTimeout(()=>{node.classList.add('ts-out');enterLobby(true)},reducedMotion()?0:520);
    setTimeout(()=>{titleLive?.destroy();titleLive=null;titleFx?.stop();titleFx=null;node.remove();if(titleNode===node)titleNode=null;document.body.classList.remove('title-active')},reducedMotion()?60:1000);
  }

  // ------------------------------------------------------------- lobby
  function enterLobby(fromTitle){
    const shell=document.getElementById('lobbyShell');if(!shell)return;
    if(document.querySelector('.screen.active')?.id!=='home')call('goHome');
    syncLobby();
    if(reducedMotion())return;
    shell.classList.remove('nk-enter');void shell.offsetWidth;shell.classList.add('nk-enter');
    setTimeout(()=>shell.classList.remove('nk-enter'),fromTitle?1400:1000);
  }

  function avatarStyle(record,path){
    const rig=root.TRIAD_LIVE_ILLUSTRATION?.RIGS?.[record?.id];const avatar=document.getElementById('nkAvatar');if(!avatar||!path)return;
    const head=rig?.head||[512,220],k=.42,size=58;
    avatar.style.backgroundImage=`url("${path}")`;avatar.style.backgroundSize=`${1024*k}px ${1536*k}px`;avatar.style.backgroundPosition=`${-(head[0]*k-size/2)}px ${-(head[1]*k-size/2-4)}px`;
  }

  function alerts(){
    const p=gameProfile(),META=root.TRIAD_META_PROGRESSION,ROSTER=root.TRIAD_CHARACTER_ROSTER;if(!p||!META)return;
    const wallet=p.wallet||{},owned=p.ownedCharacterIds||[];
    const recruit=(wallet.signal||0)>=(META.GACHA_SINGLE_COST||100)||(p.recruitMileage||0)>=(META.GACHA_MILEAGE_COST||200);
    const breakthrough=owned.some(id=>{const level=Number(p.characterBreakthroughs?.[id]||0);return level<5&&(wallet.memory||0)>=(META.breakthroughCost?.(level)||Infinity)});
    const set=(tab,on)=>document.querySelector(`#home .nk-dock [data-nk-tab="${tab}"]`)?.classList.toggle('has-alert',Boolean(on));
    set('breakthrough',breakthrough);document.querySelector('#home .nk-recruit')?.classList.toggle('has-alert',Boolean(recruit));
    const claim=document.getElementById('idleClaimBtn');document.querySelector('#home .nk-idle')?.classList.toggle('has-alert',Boolean(claim&&!claim.disabled));
    const info=document.getElementById('nkCampaignInfo');if(info)info.textContent=`최고 STAGE ${p.maxStageCleared||0} · 기본 AP ${3+(p.baseEnergyBonus||0)}`;
  }

  // Reserve room for the global sound/relic controls so currencies never collide.
  function reserveSystemBar(){
    const shell=document.getElementById('lobbyShell'),bar=document.querySelector('#app>.topbar');if(!shell||!bar||document.body.dataset.screen!=='home')return;
    const zoom=parseFloat(getComputedStyle(document.querySelector('#home .nk-header')||shell).zoom)||1;
    shell.style.setProperty('--nk-sys',`${Math.ceil(bar.getBoundingClientRect().width/zoom)+18}px`);
  }
  // Recruit banner: rotate through the SSR characters of the recruit pool.
  let recruitTimer=0,recruitIndex=0;
  function recruitPool(){
    const p=gameProfile(),records=root.TRIAD_META_PROGRESSION?.recruitPool?.(root.TRIAD_CHARACTER_ROSTER?.records||[],[]).ssr||[];
    const open=records.filter(r=>!(p?.ownedCharacterIds||[]).includes(r.id));return{open,list:records};
  }
  function paintRecruit(swap){
    const art=document.getElementById('nkRecruitArt'),name=document.getElementById('nkRecruitName'),info=document.getElementById('nkRecruitInfo');if(!art)return;
    const {open,list}=recruitPool(),record=list[recruitIndex%Math.max(1,list.length)],META=root.TRIAD_META_PROGRESSION,cost=META?.GACHA_SINGLE_COST||100,signal=gameProfile()?.wallet?.signal||0;
    if(info)info.textContent=`SSR ${((META?.GACHA_SSR_RATE||.02)*100).toFixed(0)}% · 신호 ${signal}/${cost} · 마일리지 ${gameProfile()?.recruitMileage||0}/${META?.GACHA_MILEAGE_COST||200}`;
    if(name)name.textContent=record?`SSR ${record.name}${open.includes(record)?'':' · 보유'}`:'';
    const path=record&&call('lobbyCharacterAsset',record)?.path;if(!path)return;
    const apply=()=>{const rig=root.TRIAD_LIVE_ILLUSTRATION?.RIGS?.[record.id]||{head:[512,220]},box=art.getBoundingClientRect(),h=box.height||140,w=box.width||230,k=h*2.35/1536;
      art.style.backgroundImage=`url("${path}")`;art.style.backgroundSize=`${1024*k}px ${1536*k}px`;art.style.backgroundPosition=`${-(rig.head[0]*k-w*.55)}px ${-(rig.head[1]*k-h*.3)}px`;art.classList.remove('swap')};
    if(swap){art.classList.add('swap');setTimeout(apply,420)}else apply();
  }
  function startRecruitCycle(){
    clearInterval(recruitTimer);paintRecruit(false);
    recruitTimer=setInterval(()=>{if(document.body.dataset.screen!=='home'||document.hidden)return;const {list}=recruitPool();if(list.length<2)return;recruitIndex=(recruitIndex+1)%list.length;paintRecruit(true)},4800);
  }
  function syncLobby(){
    const {record,path,scene}=featured(),stage=document.getElementById('lobbyCharacterStage'),shell=document.getElementById('lobbyShell');
    if(shell)shell.style.setProperty('--nk-tint',scene.tint);
    requestAnimationFrame(reserveSystemBar);
    requestAnimationFrame(()=>recruitTimer?paintRecruit(false):startRecruitCycle());
    avatarStyle(record,path);alerts();
    if(!stage||!path||!record)return;
    if(!lobbyLive){lobbyLive=root.TRIAD_LIVE_ILLUSTRATION?.create(stage,{heightScale:1.22,headY:.14,centerX:.5,maxScale:1.4});if(lobbyLive)stage.addEventListener('pointerdown',tapCharacter)}
    if(!lobbyFx&&shell){const canvas=document.createElement('canvas');canvas.className='nk-fx';canvas.setAttribute('aria-hidden','true');stage.after(canvas);lobbyFx=particles(canvas,scene.tint,70);lobbyFxTint=scene.tint}
    else if(lobbyFx&&lobbyFxTint!==scene.tint){const canvas=shell.querySelector('.nk-fx');lobbyFx.stop();lobbyFx=particles(canvas,scene.tint,70);lobbyFxTint=scene.tint}
    if(lobbyLive&&lobbyCharacter!==record.id){
      const first=lobbyCharacter===null;lobbyCharacter=record.id;
      if(!first)stage.classList.add('nk-swapping');
      lobbyLive.setSource(path,record.id,scene.tint).then(()=>setTimeout(()=>stage.classList.remove('nk-swapping'),first?0:60));
    }
  }

  function tapCharacter(event){
    const rect=lobbyLive?.figureRect();if(!rect)return;
    const box=event.currentTarget.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;
    if(Math.abs(x-rect.chest[0])>rect.width*.28||y<rect.head[1]-rect.width*.2)return;
    lobbyLive.poke(1.2);
    const burst=document.createElement('i');burst.className='nk-tap-burst';burst.style.left=`${x}px`;burst.style.top=`${y}px`;event.currentTarget.appendChild(burst);setTimeout(()=>burst.remove(),650);
    try{if(typeof SFX!=='undefined')SFX.play('utilityPulse',{volume:.35})}catch{}
  }

  function openLobbyShop(tab){call('setMetaShopTab',tab,false);call('showMetaShop')}

  function wrap(name,after){
    const original=root[name];if(typeof original!=='function'||original.__nkWrapped)return;
    const wrapped=function(...args){const result=original.apply(this,args);try{after(result,args)}catch(e){console.warn('TRIAD_TITLE_LOBBY',name,e)}return result};
    wrapped.__nkWrapped=true;wrapped.__nkOriginal=original;root[name]=wrapped;
  }

  function install(){
    if(root.TRIAD_TITLE)return;
    root.openLobbyShop=openLobbyShop;
    addEventListener('resize',()=>requestAnimationFrame(reserveSystemBar));
    wrap('renderLobby',()=>syncLobby());
    wrap('showScreen',(result,[id])=>{if(id==='home')enterLobby(false);else lobbyLive?.pause();if(id==='home')lobbyLive?.play()});
    root.TRIAD_TITLE=Object.freeze({version:VERSION,show:()=>show({instant:true}),hide:leave,get open(){return Boolean(titleNode)}});
    const automated=navigator.webdriver===true&&!params.has('title');
    if(!params.has('notitle')&&!automated&&document.querySelector('.screen.active')?.id==='home')show();
    else {syncLobby();document.documentElement.classList.remove('ts-boot')}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})(globalThis);
