/* Recruit gacha presentation.

   drawRecruitBanner() commits and saves the pull first, then hands the
   results here purely for show:
     uplink  - a signal beacon draws light in; if the batch holds an SSR the
               beacon turns gold part-way (the rarity tell)
     burst   - flash and light pillar, the cards are dealt face down
     reveal  - cards flip in order; an SSR card charges gold before turning
     cut-in  - full-screen SSR introduction with the live illustration
     result  - every card face up with NEW / level / breakthrough badges
   Skip (button or Esc) jumps straight to the result board.  The banner hero
   on the recruit tab is painted here as well. */
(function(root){
  'use strict';
  const VERSION='gacha-fx-1.1.0';
  const CYAN='#7ee7ff',GOLD='#ffd37a';
  const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  const sfx=(key,options)=>{try{root.TRIAD_SFX?.play?.(key,options)}catch{}};
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const rgbOf=hex=>{const h=String(hex||'').replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0)};
  const call=(name,...args)=>{const fn=root[name];return typeof fn==='function'?fn(...args):undefined};

  // ------------------------------------------------------------ pure helpers
  function bestRarity(views){return(views||[]).some(view=>view?.rarity==='SSR')?'SSR':'CARD'}
  function outcomeLabel(view){
    const grant=view?.grant||{};
    switch(view?.outcome){
      case'NEW':return{text:view.rarity==='SSR'?'NEW 영입':'NEW',cls:'new'};
      case'BREAKTHROUGH':return{text:`돌파 ${view.level}/5`,cls:'up'};
      case'LEVEL_UP':return{text:`Lv.${view.level}`,cls:'up'};
      case'CONVERTED':return grant.memory?{text:`성장 데이터 +${grant.memory}`,cls:'conv'}:{text:`매트릭스 +${grant.cardMatrices||0}`,cls:'conv'};
      default:return{text:'',cls:''};
    }
  }
  function summarize(views){
    const list=views||[],count=pred=>list.filter(pred).length;
    const parts=[];
    const ssr=count(view=>view.rarity==='SSR');if(ssr)parts.push(`SSR ${ssr}`);
    const fresh=count(view=>view.rarity!=='SSR'&&view.outcome==='NEW');if(fresh)parts.push(`신규 카드 ${fresh}`);
    const up=count(view=>view.rarity!=='SSR'&&view.outcome==='LEVEL_UP');if(up)parts.push(`카드 레벨 업 ${up}`);
    const conv=count(view=>view.rarity!=='SSR'&&view.outcome==='CONVERTED');if(conv)parts.push(`매트릭스 전환 ${conv}`);
    return parts.join(' · ');
  }
  function resultLine(views,mileage){
    let line=summarize(views)||'모집 완료';
    if(mileage){
      const total=Number(mileage.total)||0,cost=Number(mileage.cost)||200;
      line+=mileage.gained?` · 마일리지 +${mileage.gained} (누적 ${total})`:` · 남은 마일리지 ${total}`;
      if(total>=cost)line+=' · 선택 교환 가능';
    }
    return line;
  }
  function codename(view){const match=/\/([a-z]+)_lobby/i.exec(view?.art||'');return(match?match[1]:view?.element||'SSR').toUpperCase()}
  function timeline(count,hasSsr,reduced){
    if(reduced)return{uplink:450,tell:hasSsr?200:-1,burst:220,deal:260,dealStagger:20,flip:60,hurryFlip:30,ssrCharge:160,cutinHold:500};
    return{uplink:hasSsr?2800:2300,tell:hasSsr?1650:-1,burst:560,deal:460,dealStagger:count>1?62:0,flip:count>1?170:0,hurryFlip:45,ssrCharge:950,cutinHold:1100};
  }

  // -------------------------------------------------------------- canvas FX
  class Fx{
    constructor(canvas,stage){
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.stage=stage;
      this.tint=rgbOf(CYAN);this.target=rgbOf(CYAN);this.mode='inflow';this.charge=0;
      this.streams=[];this.rings=[];this.shards=[];this.embers=[];this.lastRing=0;this.last=performance.now();
      this.resize=this.resize.bind(this);this.frame=this.frame.bind(this);
      this.resize();addEventListener('resize',this.resize);this.raf=requestAnimationFrame(this.frame);
    }
    resize(){
      const size=root.TRIAD_LAYOUT?.size?.()||{width:Math.min(1920,innerWidth),height:Math.min(1080,innerHeight)},dpr=root.TRIAD_LAYOUT?.density?.()||1;this.w=size.width;this.h=size.height;
      this.canvas.width=Math.round(this.w*dpr);this.canvas.height=Math.round(this.h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);
      this.cx=this.w/2;this.cy=this.h*.46;this.reach=Math.hypot(this.w,this.h)*.56;
    }
    setTint(hex){this.target=rgbOf(hex)}
    rgba(alpha,whiten=0,rgb=this.tint){const m=v=>Math.round(v+(255-v)*whiten);return`rgba(${m(rgb[0])},${m(rgb[1])},${m(rgb[2])},${Math.max(0,Math.min(1,alpha))})`}
    stream(){const a=Math.random()*Math.PI*2;return{a,r:this.reach*(.72+Math.random()*.4),v:170+Math.random()*250,swirl:(.5+Math.random()*.8)*(Math.random()<.5?-1:1),width:Math.random()*1.7+.5,hot:Math.random()<.2}}
    ember(){return{x:Math.random()*this.w,y:this.h*(.35+Math.random()*.75),vy:-(12+Math.random()*34),ph:Math.random()*6.3,r:Math.random()*1.8+.5,a:Math.random()*.55+.2}}
    shock(color,power=1,x=this.cx,y=this.cy){
      const rgb=rgbOf(color);
      this.rings.push({x,y,r:16,v:1700*power,a:1,w:16*power,rgb},{x,y,r:10,v:950*power,a:.85,w:5,rgb});
      const n=Math.round((reducedMotion()?50:170)*power);
      for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=(260+Math.random()*1200)*power;this.shards.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,decay:.8+Math.random()*1.3,rgb,size:Math.random()*2.2+.7})}
    }
    frame(now){
      this.raf=requestAnimationFrame(this.frame);
      const dt=Math.min(.05,(now-this.last)/1000);this.last=now;this.stage.tick(now);
      if(document.hidden)return;
      for(let i=0;i<3;i++)this.tint[i]+=(this.target[i]-this.tint[i])*Math.min(1,dt*4.5);
      const ctx=this.ctx;ctx.clearRect(0,0,this.w,this.h);ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
      if(this.mode==='inflow'){
        const want=reducedMotion()?50:Math.round(160+this.charge*150),boost=1+this.charge*2.6;
        while(this.streams.length<want)this.streams.push(this.stream());
        for(const s of this.streams){
          const x0=this.cx+Math.cos(s.a)*s.r,y0=this.cy+Math.sin(s.a)*s.r;
          s.r-=s.v*boost*dt*(1+(1-s.r/this.reach)*1.6);s.a+=s.swirl*dt*boost*(110/Math.max(50,s.r));
          if(s.r<24){Object.assign(s,this.stream());continue}
          const x1=this.cx+Math.cos(s.a)*s.r,y1=this.cy+Math.sin(s.a)*s.r;
          ctx.strokeStyle=this.rgba(Math.min(1,(1-s.r/this.reach)*1.7)*.8,s.hot?.65:.05);ctx.lineWidth=s.width;
          ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
        }
        if(now-this.lastRing>520-this.charge*300){this.lastRing=now;this.rings.push({x:this.cx,y:this.cy,r:46,v:430+this.charge*260,a:.5,w:1.6,rgb:null})}
        const R=64+this.charge*130+Math.sin(now/80)*7*this.charge;
        const g=ctx.createRadialGradient(this.cx,this.cy,0,this.cx,this.cy,R);
        g.addColorStop(0,this.rgba(.95,.75));g.addColorStop(.3,this.rgba(.5,.2));g.addColorStop(1,this.rgba(0));
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(this.cx,this.cy,R,0,Math.PI*2);ctx.fill();
      }else if(this.mode==='drift'){
        const want=reducedMotion()?16:60;while(this.embers.length<want)this.embers.push(this.ember());
        for(const e of this.embers){
          e.y+=e.vy*dt;e.x+=Math.sin(now/1100+e.ph)*10*dt;if(e.y<-10)Object.assign(e,this.ember(),{y:this.h+8});
          const tw=.6+.4*Math.sin(now/420+e.ph*3),r=e.r*4;
          const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,r);g.addColorStop(0,this.rgba(e.a*tw,.4));g.addColorStop(1,this.rgba(0));
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.fill();
        }
      }
      for(const ring of this.rings){
        ring.r+=ring.v*dt;ring.v*=Math.pow(.3,dt);ring.a-=dt*(ring.w>4?1.15:.8);
        ctx.strokeStyle=this.rgba(ring.a,.25,ring.rgb||this.tint);ctx.lineWidth=ring.w*Math.max(.2,ring.a);
        ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2);ctx.stroke();
      }
      this.rings=this.rings.filter(ring=>ring.a>0);
      for(const p of this.shards){
        p.x+=p.vx*dt;p.y+=p.vy*dt;const drag=Math.pow(.09,dt);p.vx*=drag;p.vy*=drag;p.life-=p.decay*dt;
        ctx.strokeStyle=this.rgba(p.life,.45,p.rgb);ctx.lineWidth=p.size;
        ctx.beginPath();ctx.moveTo(p.x-p.vx*.03,p.y-p.vy*.03);ctx.lineTo(p.x,p.y);ctx.stroke();
      }
      this.shards=this.shards.filter(p=>p.life>0);
      ctx.globalCompositeOperation='source-over';
    }
    stop(){cancelAnimationFrame(this.raf);removeEventListener('resize',this.resize)}
  }

  // ----------------------------------------------------------------- stage
  const BEACON=`<svg class="gx-beacon" viewBox="-120 -120 240 240" aria-hidden="true">
<circle class="gx-b-ring r1" r="110"/><circle class="gx-b-ticks" r="100"/><circle class="gx-b-ring r2" r="88"/>
<g class="gx-b-blades"><path d="M0-80 18-31 6-23 0-37-6-23-18-31Z"/><path transform="rotate(120)" d="M0-80 18-31 6-23 0-37-6-23-18-31Z"/><path transform="rotate(240)" d="M0-80 18-31 6-23 0-37-6-23-18-31Z"/></g>
<path class="gx-b-core" d="M0-17 15 0 0 17-15 0Z"/></svg>`;
  const BACK_EMBLEM=`<svg viewBox="-60 -60 120 120" aria-hidden="true"><circle r="50"/><path d="M0-44 10-17 3-12 0-20-3-12-10-17Z"/><path transform="rotate(120)" d="M0-44 10-17 3-12 0-20-3-12-10-17Z"/><path transform="rotate(240)" d="M0-44 10-17 3-12 0-20-3-12-10-17Z"/><path d="M0-8 7 0 0 8-7 0Z"/></svg>`;
  const STATUS=[[0,'모집 신호 송신'],[.34,'응답 채널 탐색'],[.68,'응답 수신'],[.97,'연결 완료']];

  let stage=null;

  class GachaStage{
    constructor(views,options,resolve){
      this.views=views;this.options=options;this.resolve=resolve;this.reduced=reducedMotion();
      this.best=bestRarity(views);this.t=timeline(views.length,this.best==='SSR',this.reduced);
      this.phase='init';this.skipped=false;this.hurried=false;this.closed=false;this.wakers=new Set();this.tapWaiter=null;this.live=null;
      this.returnFocus=document.activeElement;
      this.build();
    }
    build(){
      const node=document.createElement('div');node.id='gachaStage';node.className='gx';node.tabIndex=-1;
      node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-label','캐릭터 모집 연출');
      node.dataset.best=this.best.toLowerCase();node.dataset.count=String(this.views.length);
      node.innerHTML=`<div class="gx-bg"></div><canvas class="gx-fx" aria-hidden="true"></canvas>
<div class="gx-center">${BEACON}</div><div class="gx-pillar" aria-hidden="true"></div>
<div class="gx-hud"><small>SIGNAL UPLINK · 모집 ${this.views.length}회</small><b class="gx-status">${STATUS[0][1]}</b><span class="gx-meter"><i></i></span><em class="gx-pct">0%</em></div>
<div class="gx-title" aria-hidden="true"><small>RECRUIT RESULT</small><b>${esc(this.options.title||'모집 결과')}</b></div>
<div class="gx-cards" role="list">${this.views.map((view,i)=>this.cardMarkup(view,i)).join('')}</div>
<div class="gx-cutin" aria-live="polite"></div>
<div class="gx-result"><p class="gx-summary" aria-live="polite"></p><div class="gx-buttons"><button type="button" class="gx-again"></button><button type="button" class="primary gx-ok">확인</button></div></div>
<button type="button" class="gx-skip">SKIP <span aria-hidden="true">›</span></button><div class="gx-flash" aria-hidden="true"></div>`;
      this.node=node;this.cards=[...node.querySelectorAll('.gx-card')];
      node.addEventListener('pointerdown',event=>this.onPointer(event));
      node.querySelector('.gx-skip').addEventListener('click',event=>{event.stopPropagation();this.skip()});
      node.querySelector('.gx-ok').addEventListener('click',()=>this.close());
      node.querySelector('.gx-again').addEventListener('click',()=>this.again());
      this.onKey=event=>this.key(event);document.addEventListener('keydown',this.onKey,true);
      this.onResize=()=>this.frameArt();addEventListener('resize',this.onResize);
      document.body.appendChild(node);document.body.classList.add('gx-open');
      this.fx=new Fx(node.querySelector('.gx-fx'),this);
      this.frameArt();node.focus({preventScroll:true});
    }
    cardMarkup(view,i){
      const label=outcomeLabel(view),ssr=view.rarity==='SSR';
      return`<div class="gx-card ${ssr?'ssr':'card'}" role="listitem" style="--i:${i};--tint:${esc(view.tint)}" data-index="${i}" aria-label="${esc(`${ssr?'SSR ':''}${view.name} ${label.text}`)}">
<span class="gx-card-inner"><span class="gx-back">${BACK_EMBLEM}</span>
<span class="gx-face"><span class="gx-art" data-character="${ssr?esc(view.id):''}" style="background-image:url('${esc(view.art)}')"></span><span class="gx-shade"></span>
<span class="gx-rank">${ssr?'SSR':'CARD'}</span><span class="gx-name"><b>${esc(view.name)}</b><small>${esc(view.sub)}</small></span>${label.text?`<span class="gx-badge ${label.cls}">${esc(label.text)}</span>`:''}</span></span></div>`;
    }
    // Frame SSR faces on the character's head so every card crops the same way.
    frameArt(){
      const rigs=root.TRIAD_LIVE_ILLUSTRATION?.RIGS||{};
      for(const art of this.node.querySelectorAll('.gx-art[data-character]:not([data-character=""])')){
        const w=art.offsetWidth,h=art.offsetHeight;if(!w||!h)continue;
        const head=rigs[art.dataset.character]?.head||[512,220],k=h*1.75/1536;
        art.style.backgroundSize=`${1024*k}px ${1536*k}px`;art.style.backgroundPosition=`${w*.5-head[0]*k}px ${h*.24-head[1]*k}px`;
      }
    }
    setPhase(phase){this.phase=phase;this.node.dataset.phase=phase}
    sleep(ms,{hurry=false}={}){
      if(this.skipped||this.closed)return Promise.resolve();
      return new Promise(resolve=>{
        const done=()=>{clearTimeout(timer);this.wakers.delete(entry);resolve()},timer=setTimeout(done,ms),entry={done,hurry};
        this.wakers.add(entry);
      });
    }
    wake(all){for(const entry of[...this.wakers])if(all||entry.hurry)entry.done()}
    tick(now){
      if(this.phase!=='uplink')return;
      const p=Math.max(0,Math.min(1,(now-this.uplinkStart)/this.t.uplink));this.fx.charge=p;
      this.node.style.setProperty('--gx-progress',p.toFixed(3));
      const pct=this.node.querySelector('.gx-pct');if(pct)pct.textContent=`${Math.round(p*100)}%`;
      const status=STATUS.filter(([at])=>p>=at).pop()?.[1];
      const statusNode=this.node.querySelector('.gx-status');
      if(statusNode&&!this.node.classList.contains('gx-tell')&&statusNode.textContent!==status)statusNode.textContent=status;
    }
    async run(){
      this.preload();
      // Direct (mileage exchange): no uplink or deal, straight to the SSR reveal.
      if(this.options.direct){this.node.classList.add('gx-instant','gx-dealt','gx-tell');this.fx.mode='drift';this.fx.setTint(GOLD);await this.reveal()}
      else{await this.uplink();if(!this.skipped&&!this.closed){await this.burst();await this.reveal()}}
      if(!this.closed)this.showResult();
    }
    preload(){for(const view of this.views)if(view.art){const image=new Image();image.decoding='async';image.src=view.art}}
    async uplink(){
      this.setPhase('uplink');this.uplinkStart=performance.now();this.fx.mode='inflow';
      sfx('ultimateCharge',{volume:.5});
      if(this.t.tell>=0){
        await this.sleep(this.t.tell,{hurry:true});if(this.skipped||this.closed)return;
        this.tell();
        await this.sleep(Math.max(this.hurried?420:0,this.t.uplink-this.t.tell),{hurry:!this.hurried});
      }else await this.sleep(this.t.uplink,{hurry:true});
    }
    tell(){
      if(this.node.classList.contains('gx-tell'))return;
      this.node.classList.add('gx-tell');this.fx.setTint(GOLD);this.fx.shock(GOLD,.45);
      const status=this.node.querySelector('.gx-status');if(status)status.textContent='고위 신호 감지 — SSR';
      sfx('magicCast',{volume:.62});
    }
    async burst(){
      if(this.best==='SSR')this.tell();
      this.setPhase('burst');this.fx.charge=1;this.fx.mode='drift';this.fx.shock(this.best==='SSR'?GOLD:CYAN,1.1);
      this.node.classList.add('gx-bursting');
      sfx(this.best==='SSR'?'ultimateImpact':'explosionMedium',{volume:this.best==='SSR'?.6:.3});
      if(this.best==='SSR')sfx('explosionLarge',{volume:.28});
      await this.sleep(this.t.burst*.45);
      this.deal();
      await this.sleep(this.t.burst*.55+this.t.deal+this.t.dealStagger*this.cards.length);
    }
    deal(){
      // Cards sit untranslated until now, so their box centre is the slot centre.
      const center=[this.fx.cx,this.fx.cy];
      for(const card of this.cards){
        const box=root.TRIAD_LAYOUT?.rect?.(card)||card.getBoundingClientRect();
        card.style.setProperty('--from-x',`${center[0]-(box.left+box.width/2)}px`);card.style.setProperty('--from-y',`${center[1]-(box.top+box.height/2)}px`);
      }
      this.node.style.setProperty('--gx-deal',`${this.t.deal}ms`);this.node.style.setProperty('--gx-stagger',`${this.t.dealStagger}ms`);
      void this.node.offsetWidth;this.node.classList.add('gx-dealt');
    }
    async reveal(){
      this.setPhase('reveal');
      for(const card of this.cards){
        if(this.skipped||this.closed)return;
        const view=this.views[Number(card.dataset.index)];
        if(view.rarity==='SSR'){
          card.classList.add('charging');sfx('ultimateCharge',{volume:.36});
          await this.sleep(this.t.ssrCharge);if(this.skipped||this.closed)return;
          card.classList.remove('charging');this.open(card);
          const box=root.TRIAD_LAYOUT?.rect?.(card)||card.getBoundingClientRect();this.fx.shock(GOLD,.55,box.left+box.width/2,box.top+box.height/2);
          sfx('ultimateImpact',{volume:.5});
          await this.sleep(420);if(this.skipped||this.closed)return;
          await this.cutIn(view);
        }else{
          this.open(card);sfx('weaponWhoosh',{volume:.2});
          await this.sleep(this.hurried?this.t.hurryFlip:this.t.flip,{hurry:true});
        }
      }
      await this.sleep(this.reduced?120:480,{hurry:true});
    }
    open(card){card.classList.add('open')}
    async cutIn(view){
      this.setPhase('cutin');
      const layer=this.node.querySelector('.gx-cutin'),label=outcomeLabel(view);
      const glitter=Array.from({length:this.reduced?0:36},(_,i)=>`<i style="--x:${(i*37%100)}%;--d:${(i*0.29%3.4).toFixed(2)}s;--s:${(0.6+(i*13%10)/10).toFixed(2)}"></i>`).join('');
      layer.style.setProperty('--ci-tint',view.tint||GOLD);
      layer.innerHTML=`<div class="gx-ci-bg"></div><div class="gx-ci-rays"></div><div class="gx-ci-lines"></div><div class="gx-ci-band a"></div><div class="gx-ci-band b"></div>
<div class="gx-ci-code" aria-hidden="true">${esc(codename(view))}</div>
<div class="gx-ci-figure"><img alt="" src="${esc(view.art)}"></div><div class="gx-ci-glitter" aria-hidden="true">${glitter}</div>
<div class="gx-ci-info"><div class="gx-ci-rank"><b>SSR</b><span><i></i><i></i><i></i></span></div><h2>${esc(view.name)}</h2><p>${esc(view.sub)}</p>${label.text?`<span class="gx-ci-outcome ${label.cls}">${esc(label.text)}</span>`:''}</div>
<div class="gx-ci-hint">TOUCH TO CONTINUE</div><div class="gx-ci-flash"></div>`;
      const figure=layer.querySelector('.gx-ci-figure');
      this.live=root.TRIAD_LIVE_ILLUSTRATION?.create(figure,{heightScale:1.5,headY:.15,centerX:.5,maxScale:1.55,interactive:true})||null;
      if(this.live)this.live.setSource(view.art,view.id,view.tint||GOLD).then(ok=>{if(!ok)figure.classList.add('gx-static');else setTimeout(()=>this.live?.poke(1.3),380)});
      else figure.classList.add('gx-static');
      void layer.offsetWidth;layer.classList.add('show');
      setTimeout(()=>sfx('rewardClaim',{volume:.7}),420);
      await this.sleep(this.t.cutinHold);
      if(!this.skipped&&!this.closed){layer.classList.add('ready');await new Promise(resolve=>{this.tapWaiter=resolve})}
      this.tapWaiter=null;layer.classList.add('leave');
      await new Promise(resolve=>setTimeout(resolve,this.reduced?60:280));
      this.clearCutIn();
      if(!this.closed&&!this.skipped)this.setPhase('reveal');
    }
    clearCutIn(){
      this.live?.destroy();this.live=null;
      const layer=this.node.querySelector('.gx-cutin');if(layer){layer.className='gx-cutin';layer.innerHTML=''}
    }
    showResult(){
      if(this.phase==='result')return;
      this.clearCutIn();
      if(!this.node.classList.contains('gx-dealt')){this.node.classList.add('gx-instant','gx-dealt')}
      for(const card of this.cards){card.classList.remove('charging');this.open(card)}
      this.fx.mode='drift';this.fx.setTint(this.best==='SSR'?GOLD:CYAN);this.frameArt();
      this.setPhase('result');
      this.node.querySelector('.gx-summary').textContent=resultLine(this.views,this.options.mileage);
      const again=this.node.querySelector('.gx-again'),cost=Number(this.options.cost)||0,count=Number(this.options.count)||this.views.length;
      const signal=typeof this.options.signal==='function'?Number(this.options.signal())||0:0;
      if(typeof this.options.again==='function'){again.innerHTML=`<b>${count}회 더 모집</b><small>✦ ${cost.toLocaleString()}</small>`;again.disabled=signal<cost;again.title=signal<cost?'모집 신호가 부족합니다':''}
      else again.hidden=true;
      try{root.TRIAD_SFX?.reward?.()}catch{}
      setTimeout(()=>this.node?.querySelector('.gx-ok')?.focus({preventScroll:true}),60);
    }
    onPointer(event){
      if(event.target.closest('button'))return;
      if(this.phase==='cutin'){if(this.tapWaiter)this.tapWaiter();return}
      if(this.phase==='uplink'||this.phase==='reveal'||this.phase==='burst'){this.hurried=true;this.wake(false)}
    }
    key(event){
      if(!this.node?.isConnected)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(this.phase==='result')this.close();else this.skip();return}
      if((event.key==='Enter'||event.key===' ')&&this.phase!=='result'){event.preventDefault();event.stopPropagation();this.onPointer({target:this.node})}
    }
    skip(){
      if(this.phase==='result'||this.closed)return;
      this.skipped=true;this.wake(true);if(this.tapWaiter)this.tapWaiter();
      this.showResult();
    }
    again(){const next=this.options.again;this.close();if(typeof next==='function')next()}
    close(){
      if(this.closed)return;this.closed=true;this.wake(true);if(this.tapWaiter)this.tapWaiter();
      this.clearCutIn();this.fx.stop();document.removeEventListener('keydown',this.onKey,true);removeEventListener('resize',this.onResize);
      this.node.remove();document.body.classList.remove('gx-open');
      if(stage===this)stage=null;
      try{this.returnFocus?.focus?.({preventScroll:true})}catch{}
      this.resolve();
    }
  }

  function play(views,options={}){
    stage?.close();
    const list=(Array.isArray(views)?views:[]).filter(Boolean);if(!list.length)return Promise.resolve();
    return new Promise(resolve=>{stage=new GachaStage(list,options,resolve);stage.run()});
  }
  function active(){return Boolean(stage)}
  function close(){stage?.close()}

  // -------------------------------------------------- recruit banner hero
  let heroIndex=0,heroTimer=0;
  function heroList(){return root.TRIAD_META_PROGRESSION?.recruitPool?.(root.TRIAD_CHARACTER_ROSTER?.records||[],[]).ssr||[]}
  function paintHero(swap){
    const art=document.getElementById('rcHeroArt'),name=document.getElementById('rcHeroName'),panel=document.getElementById('characterRecruitmentPanel');
    const list=heroList();if(!art||!list.length)return;
    const record=list[heroIndex%list.length],path=call('metaCharacterThumbnail',record)||record.lobbyArt?.path;if(!path)return;
    const cores=typeof CORES!=='undefined'?CORES:[],tint=cores.find(core=>core.id===record.coreId)?.color;
    const apply=()=>{
      const box=root.TRIAD_LAYOUT?.rect?.(art)||art.getBoundingClientRect(),h=box.height||320,w=box.width||420,k=h*1.62/1536,head=root.TRIAD_LIVE_ILLUSTRATION?.RIGS?.[record.id]?.head||[512,220];
      art.style.backgroundImage=`url("${path}")`;art.style.backgroundSize=`${1024*k}px ${1536*k}px`;art.style.backgroundPosition=`${w*.56-head[0]*k}px ${h*.17-head[1]*k}px`;
      if(name)name.innerHTML=`<b>SSR</b>${esc(record.name)}<small>${esc(record.role||'')}</small>`;
      if(panel&&tint)panel.style.setProperty('--rc-tint',tint);
      panel?.querySelectorAll('.rc-unit').forEach(unit=>unit.classList.toggle('featured',unit.dataset.recruitId===record.id));
      art.classList.remove('swap');
    };
    if(swap){art.classList.add('swap');setTimeout(apply,380)}else apply();
  }
  function heroVisible(){return document.body.dataset.screen==='metaShop'&&!document.hidden&&document.querySelector('[data-meta-tab-pane="recruitment"].active')}
  function startHero(){
    if(heroTimer)return;
    heroTimer=setInterval(()=>{if(!heroVisible())return;heroIndex=(heroIndex+1)%Math.max(1,heroList().length);paintHero(true)},5200);
  }
  function install(){
    const original=root.renderCharacterRecruitment;
    if(typeof original==='function'&&!original.__gachaWrapped){
      const wrapped=function(...args){const result=original.apply(this,args);requestAnimationFrame(()=>paintHero(false));startHero();return result};
      wrapped.__gachaWrapped=true;root.renderCharacterRecruitment=wrapped;
    }
    const tab=root.setMetaShopTab;
    if(typeof tab==='function'&&!tab.__gachaWrapped){
      const wrappedTab=function(...args){const result=tab.apply(this,args);if(result==='recruitment')requestAnimationFrame(()=>paintHero(false));return result};
      wrappedTab.__gachaWrapped=true;root.setMetaShopTab=wrappedTab;
    }
    // Clicking a lineup portrait features that character in the hero.
    document.getElementById('gachaCandidateGrid')?.addEventListener('click',event=>{
      const unit=event.target.closest('.rc-unit');if(!unit)return;
      const index=heroList().findIndex(record=>record.id===unit.dataset.recruitId);if(index<0)return;
      heroIndex=index;paintHero(true);
    });
    if(document.getElementById('rcHeroArt'))paintHero(false);
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  }

  root.TRIAD_GACHA_FX=Object.freeze({VERSION,play,active,close,bestRarity,outcomeLabel,summarize,resultLine,codename,timeline});
})(typeof window!=='undefined'?window:globalThis);
