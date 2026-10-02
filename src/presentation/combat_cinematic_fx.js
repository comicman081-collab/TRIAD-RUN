/* Cinematic combat layer.

   Adds light, camera and staging on top of the authored sprite VFX without
   touching combat rules or timing: every hook wraps an existing presentation
   function and reads the same contact moments the sprite pipeline uses.

   - card launch / contact:   presentCombatVfx / triggerCombatVfxImpact
   - enemy launch / contact:  same, with telegraphs for elites and bosses
   - enemy defeat:            setEnemyVisualState('DEFEAT')
   - boss / elite encounter:  startCombat(type)

   Rendering is one additive 2D canvas per battle stage plus a few DOM
   overlays (dim, letterbox, cut-in, warning).  The RAF loop only runs while
   something is alive. */
(function(root){
  'use strict';
  const VERSION='cinematic-fx-1.0.0';
  const TAU=Math.PI*2;
  const MAX_PARTICLES=1400;
  const PALETTE={
    EMBER:{core:'#fff4d6',main:'#ff6a2b',deep:'#b3200c',accent:'#ffc94d'},
    VOLT:{core:'#f2feff',main:'#56dcff',deep:'#1c58ff',accent:'#fff17a'},
    AEGIS:{core:'#ffffff',main:'#8fb6ff',deep:'#2b4fc4',accent:'#e6f0ff'},
    SHADE:{core:'#f8ecff',main:'#b27aff',deep:'#4b168f',accent:'#ff5fd0'},
    BLOOM:{core:'#f6ffe8',main:'#79f0a0',deep:'#16874a',accent:'#e6ff86'},
    RIFT:{core:'#fbf0ff',main:'#a88bff',deep:'#3b1a9e',accent:'#6ef3ff'}
  };
  const HOSTILE={core:'#fff0ee',main:'#ff4058',deep:'#8d0718',accent:'#ffb36b'};
  const MELEE_ARCHETYPES=new Set(['HOUND','BRUTE','RAVAGER','WEAVER','REAPER','COLOSSUS','VANGUARD','WARDEN']);
  const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  // The runtime keeps `run` as a top-level `let`; classic scripts share that
  // binding by name even though it is not a window property.
  const game=()=>typeof run!=='undefined'?run:null;
  let enabled=true;

  const rand=(a,b)=>a+Math.random()*(b-a);
  const pick=list=>list[Math.floor(Math.random()*list.length)];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const easeOut=t=>1-Math.pow(1-t,3);
  const easeIn=t=>t*t*t;
  function hexToRgb(hex){const v=String(hex).replace('#','');const n=parseInt(v.length===3?v.split('').map(c=>c+c).join(''):v,16);return[(n>>16)&255,(n>>8)&255,n&255]}
  const rgba=(hex,a)=>{const[r,g,b]=hexToRgb(hex);return`rgba(${r},${g},${b},${a})`};
  function mix(a,b,t){const x=hexToRgb(a),y=hexToRgb(b);return'#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}

  // --- glow sprite cache -------------------------------------------------
  const glowCache=new Map();
  function glowSprite(color){
    if(glowCache.has(color))return glowCache.get(color);
    const size=128,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
    const grad=g.createRadialGradient(64,64,0,64,64,64);
    grad.addColorStop(0,rgba(color,1));grad.addColorStop(.22,rgba(color,.62));grad.addColorStop(.5,rgba(color,.2));grad.addColorStop(1,rgba(color,0));
    g.fillStyle=grad;g.fillRect(0,0,size,size);glowCache.set(color,c);return c;
  }

  // --- stage / canvas ----------------------------------------------------
  const state={stage:null,canvas:null,ctx:null,w:0,h:0,dpr:1,particles:[],tasks:[],raf:0,last:0,portraits:new Map(),seq:0};

  function stageEl(){return document.querySelector('#combat .battle-stage')||document.querySelector('.battle-stage')}
  function stageRect(stage){return root.TRIAD_LAYOUT?.rect(stage)||stage.getBoundingClientRect()}

  function ensure(){
    const stage=stageEl();if(!stage)return null;
    if(state.stage!==stage||!state.canvas?.isConnected){
      state.stage=stage;
      state.canvas=stage.querySelector(':scope > .battle-cinematic-canvas')||Object.assign(document.createElement('canvas'),{className:'battle-cinematic-canvas'});
      state.canvas.setAttribute('aria-hidden','true');
      if(!state.canvas.isConnected)stage.appendChild(state.canvas);
      state.ctx=state.canvas.getContext('2d');
    }
    const w=stage.clientWidth,h=stage.clientHeight;
    const dpr=clamp(Math.min(root.devicePixelRatio||1,1.6),1,Math.sqrt(2600000/Math.max(1,w*h)));
    if(w!==state.w||h!==state.h||dpr!==state.dpr){state.w=w;state.h=h;state.dpr=dpr;state.canvas.width=Math.max(1,Math.round(w*dpr));state.canvas.height=Math.max(1,Math.round(h*dpr))}
    preloadPortraits();
    return stage;
  }

  function add(p){if(state.particles.length>=MAX_PARTICLES)return null;p.age=0;state.particles.push(p);wake();return p}
  function task(duration,fn,done){state.tasks.push({age:0,duration,fn,done});wake()}
  function later(ms,fn){setTimeout(()=>{if(isCombatVisible()&&ensure())fn()},Math.max(0,ms))}
  function isCombatVisible(){return Boolean(document.querySelector('#combat.active'))}
  function wake(){if(!state.raf){state.last=performance.now();state.raf=requestAnimationFrame(frame)}}

  function frame(now){
    const dt=Math.min(.05,Math.max(.001,(now-state.last)/1000));state.last=now;
    const ctx=state.ctx;if(!ctx){state.raf=0;return}
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,state.canvas.width,state.canvas.height);
    ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
    for(let i=state.tasks.length-1;i>=0;i--){const t=state.tasks[i];t.age+=dt*1000;try{t.fn(dt,clamp(t.age/t.duration,0,1))}catch(e){t.age=t.duration}if(t.age>=t.duration){state.tasks.splice(i,1);try{t.done?.()}catch{}}}
    const alive=[];
    for(const p of state.particles){p.age+=dt;if(p.age<p.life){p.update?.(p,dt);alive.push(p)}}
    state.particles=alive;
    ctx.globalCompositeOperation='source-over';
    for(const p of alive)if(p.blend==='normal')p.draw(ctx,p,p.age/p.life);
    ctx.globalCompositeOperation='lighter';
    for(const p of alive)if(p.blend!=='normal')p.draw(ctx,p,p.age/p.life);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    if(alive.length||state.tasks.length)state.raf=requestAnimationFrame(frame);
    else{state.raf=0;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,state.canvas.width,state.canvas.height)}
  }

  // --- primitives --------------------------------------------------------
  const physics=(p,dt)=>{const drag=Math.pow(p.drag??.9,dt*60);p.vx*=drag;p.vy*=drag;p.vy+=(p.gravity||0)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt};

  function glow(x,y,r,color,alpha,life,opts={}){
    return add({x,y,r,color,alpha,life,grow:opts.grow??.35,vx:opts.vx||0,vy:opts.vy||0,drag:opts.drag??.94,gravity:opts.gravity||0,update:physics,
      draw(ctx,p,t){const a=p.alpha*Math.pow(1-t,opts.fade??1.6);if(a<=.003)return;const rr=p.r*(1+p.grow*easeOut(t));ctx.globalAlpha=a;ctx.drawImage(glowSprite(p.color),p.x-rr,p.y-rr,rr*2,rr*2)}});
  }

  function sparks(x,y,count,pal,opts={}){
    const speed=opts.speed||520,spread=opts.spread??TAU,dir=opts.dir??0;
    for(let i=0;i<count;i++){
      const a=dir+(Math.random()-.5)*spread,v=speed*rand(.35,1.15),color=Math.random()<.35?pal.core:Math.random()<.6?pal.main:pal.accent;
      add({x:x+rand(-6,6),y:y+rand(-6,6),vx:Math.cos(a)*v,vy:Math.sin(a)*v*(opts.flatten||1),w:rand(1.2,opts.width||3.2),len:rand(.022,.05)*(opts.stretch||1),color,life:rand(.28,opts.life||.62),drag:opts.drag??.9,gravity:opts.gravity??380,alpha:opts.alpha??1,update:physics,
        draw(ctx,p,t){const a=p.alpha*Math.pow(1-t,1.3);ctx.globalAlpha=a;ctx.strokeStyle=p.color;ctx.lineCap='round';ctx.lineWidth=p.w*(1-t*.55);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*p.len,p.y-p.vy*p.len);ctx.stroke();ctx.globalAlpha=a*.55;const r=p.w*3.2;ctx.drawImage(glowSprite(p.color),p.x-r,p.y-r,r*2,r*2)}});
    }
  }

  function ring(x,y,r0,r1,color,life,opts={}){
    return add({x,y,r0,r1,color,life,width:opts.width||6,squash:opts.squash||1,alpha:opts.alpha??1,rot:opts.rot||0,
      draw(ctx,p,t){const e=easeOut(t),r=p.r0+(p.r1-p.r0)*e,a=p.alpha*Math.pow(1-t,1.4);if(a<=.004)return;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.scale(1,p.squash);
        ctx.strokeStyle=p.color;ctx.globalAlpha=a*.28;ctx.lineWidth=p.width*3.2*(1-t*.5)/p.squash**.5;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();
        ctx.globalAlpha=a;ctx.lineWidth=Math.max(.6,p.width*(1-t*.8));ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();
        ctx.strokeStyle='#ffffff';ctx.globalAlpha=a*.7;ctx.lineWidth=Math.max(.4,p.width*.35*(1-t));ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();ctx.restore()}});
  }

  function flash(x,y,r,pal,life=.22,alpha=1){glow(x,y,r,pal.core,alpha,life,{grow:.25,fade:2});glow(x,y,r*1.9,pal.main,alpha*.55,life*1.4,{grow:.4,fade:1.6})}

  // Crescent sword trail that crosses the target: the arc's centre sits below
  // the hit point so the bright chord sweeps straight through it.
  function slash(x,y,radius,pal,opts={}){
    const tilt=opts.tilt??rand(-.75,-.4),flatten=opts.flatten??.62,sweep=opts.sweep??2.35,thick=opts.thick||radius*.16,dir=opts.dir||1,life=opts.life||.32;
    return add({x,y,life,draw(ctx,p,t){
      const head=easeOut(clamp(t*3,0,1)),tail=easeIn(clamp((t-.12)*1.35,0,1));if(head-tail<.01)return;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(tilt);ctx.scale(dir,flatten);ctx.translate(0,radius*.62);
      const start=-Math.PI/2-sweep/2,a0=start+sweep*tail,a1=start+sweep*head,n=30;
      const crescent=(grow)=>{ctx.beginPath();for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;ctx.lineTo(Math.cos(a)*(radius+grow),Math.sin(a)*(radius+grow))}for(let i=n;i>=0;i--){const a=a0+(a1-a0)*i/n,taper=Math.pow(Math.sin(Math.PI*(.15+.85*i/n)),.8);ctx.lineTo(Math.cos(a)*(radius-thick*taper-grow),Math.sin(a)*(radius-thick*taper-grow))}ctx.closePath()};
      const fade=Math.pow(1-t,.7);
      ctx.fillStyle=pal.main;ctx.globalAlpha=.22*fade;crescent(10);ctx.fill();
      ctx.globalAlpha=.6*fade;crescent(3);ctx.fill();
      ctx.fillStyle=pal.core;ctx.globalAlpha=.95*fade;crescent(-thick*.18);ctx.fill();
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2.2;ctx.globalAlpha=fade;ctx.beginPath();for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius)}ctx.stroke();
      ctx.restore()}});
  }

  // Claw rake: parallel tapered gashes drawn one after another.
  function claw(x,y,size,pal,opts={}){
    const angle=opts.angle??rand(.85,1.15),count=opts.count||3,gap=size*.17;
    for(let i=0;i<count;i++){const off=(i-(count-1)/2)*gap,delay=i*.04,life=.34;
      add({x,y,life:life+delay,draw(ctx,p,t){const tt=clamp((p.age-delay)/life,0,1);if(tt<=0)return;const head=easeOut(clamp(tt*3.2,0,1)),tail=easeIn(clamp((tt-.3)*1.4,0,1)),fade=Math.pow(1-tt,.9);
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);const from=-size*.55+size*1.1*tail,to=-size*.55+size*1.1*head;if(to-from<2){ctx.restore();return}
        const gash=(w)=>{ctx.beginPath();ctx.moveTo(from,off);ctx.quadraticCurveTo((from+to)/2,off-w-6,to,off);ctx.quadraticCurveTo((from+to)/2,off+w*.4,from,off);ctx.closePath()};
        ctx.fillStyle=pal.main;ctx.globalAlpha=.3*fade;gash(16);ctx.fill();ctx.globalAlpha=.75*fade;gash(8);ctx.fill();ctx.fillStyle=pal.core;ctx.globalAlpha=fade;gash(3.5);ctx.fill();ctx.restore()}});
    }
  }

  // Anime-style contact star: thin spikes that snap out and retract.
  function starFlare(x,y,size,pal,life=.2,opts={}){
    const rot=opts.rot??rand(-.3,.3),spikes=opts.spikes||4;
    return add({x,y,life,draw(ctx,p,t){const s=size*(t<.25?easeOut(t/.25):1-easeIn((t-.25)/.75)*.85),a=Math.pow(1-t,.6);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(rot);
      for(let k=0;k<spikes;k++){const len=s*(k%2?.55:1),w=Math.max(1.2,s*.045);ctx.rotate(TAU/spikes);ctx.globalAlpha=a*.45;ctx.fillStyle=pal.main;ctx.beginPath();ctx.moveTo(0,-w*2.2);ctx.lineTo(len*1.05,0);ctx.lineTo(0,w*2.2);ctx.closePath();ctx.fill();ctx.globalAlpha=a;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(0,-w);ctx.lineTo(len,0);ctx.lineTo(0,w);ctx.closePath();ctx.fill()}
      ctx.globalAlpha=a;const r=s*.28;ctx.drawImage(glowSprite(pal.core),-r,-r,r*2,r*2);ctx.restore()}});
  }

  function bolt(x0,y0,x1,y1,pal,opts={}){
    const make=()=>{const pts=[[x0,y0],[x1,y1]];let disp=Math.hypot(x1-x0,y1-y0)*(opts.jag||.28);
      for(let pass=0;pass<5;pass++){const next=[pts[0]];for(let i=0;i<pts.length-1;i++){const[a,b]=[pts[i],pts[i+1]],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,nx=-(b[1]-a[1]),ny=b[0]-a[0],len=Math.hypot(nx,ny)||1,o=(Math.random()-.5)*disp;next.push([mx+nx/len*o,my+ny/len*o],b)}pts.splice(0,pts.length,...next);disp*=.52}
      return pts};
    return add({life:opts.life||.26,pts:make(),branch:null,tick:0,x:x0,y:y0,update(p,dt){p.tick+=dt;if(p.tick>.045){p.tick=0;p.pts=make();if(Math.random()<.7){const s=p.pts[Math.floor(p.pts.length*rand(.25,.7))],a=Math.atan2(y1-y0,x1-x0)+rand(-1.1,1.1),l=Math.hypot(x1-x0,y1-y0)*rand(.2,.4);p.branch=[s,[s[0]+Math.cos(a)*l*.5+rand(-12,12),s[1]+Math.sin(a)*l*.5+rand(-12,12)],[s[0]+Math.cos(a)*l,s[1]+Math.sin(a)*l]]}else p.branch=null}},
      draw(ctx,p,t){const flick=(Math.random()<.2?.35:1)*Math.pow(1-t,.7);const line=(pts,w,c,a)=>{ctx.globalAlpha=a*flick;ctx.strokeStyle=c;ctx.lineWidth=w;ctx.lineJoin='round';ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke()};
        line(p.pts,opts.width||9,pal.main,.22);line(p.pts,(opts.width||9)*.42,pal.main,.85);line(p.pts,1.6,'#ffffff',1);if(p.branch){line(p.branch,3,pal.main,.6);line(p.branch,1,'#ffffff',.9)}}});
  }

  function pillar(x,groundY,height,width,pal,life=.7,intensity=1){
    return add({x,y:groundY,life,draw(ctx,p,t){const open=t<.18?easeOut(t/.18):1-easeIn((t-.18)/.82)*.9,w=width*open,a=Math.pow(1-t,.9)*intensity;if(w<.5)return;
      const g=ctx.createLinearGradient(0,p.y-height,0,p.y);g.addColorStop(0,rgba(pal.main,0));g.addColorStop(.45,rgba(pal.main,.55*a));g.addColorStop(.92,rgba(pal.core,.95*a));g.addColorStop(1,rgba(pal.main,.2*a));
      ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(p.x-w/2,p.y-height,w,height);const core=ctx.createLinearGradient(0,p.y-height,0,p.y);core.addColorStop(0,rgba('#ffffff',0));core.addColorStop(.7,rgba('#ffffff',.5*a));core.addColorStop(1,rgba('#ffffff',.8*a));ctx.fillStyle=core;ctx.fillRect(p.x-w*.16,p.y-height*.85,w*.32,height*.85);
      ctx.globalAlpha=a*.8;const r=w*1.4;ctx.drawImage(glowSprite(pal.main),p.x-r,p.y-r*.5,r*2,r)}});
  }

  function magicCircle(x,y,radius,pal,life=1,opts={}){
    const squash=opts.squash??.36,spin=opts.spin??1.4,sides=opts.sides||6;
    return add({x,y,life,rot:rand(0,TAU),update(p,dt){p.rot+=spin*dt},draw(ctx,p,t){const a=(t<.15?t/.15:t>.75?(1-t)/.25:1)*(opts.alpha??.9),r=radius*(.7+.3*easeOut(clamp(t*3,0,1)));if(a<=.01)return;
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,squash);ctx.strokeStyle=pal.main;
      ctx.globalAlpha=a*.3;ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();
      ctx.globalAlpha=a;ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,r*.84,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.38,0,TAU);ctx.stroke();
      ctx.rotate(p.rot);ctx.lineWidth=1.6;
      for(let k=0;k<2;k++){ctx.beginPath();for(let i=0;i<=sides/2;i++){const ang=(i*2/sides)*TAU+k*TAU/sides;ctx.lineTo(Math.cos(ang)*r*.84,Math.sin(ang)*r*.84)}ctx.stroke()}
      ctx.rotate(-p.rot*2);for(let i=0;i<24;i++){const ang=i/24*TAU,l=i%3?.05:.1;ctx.beginPath();ctx.moveTo(Math.cos(ang)*r*(.84+l*.2),Math.sin(ang)*r*(.84+l*.2));ctx.lineTo(Math.cos(ang)*r*(.98-l*.3),Math.sin(ang)*r*(.98-l*.3));ctx.stroke()}
      ctx.fillStyle=pal.core;for(let i=0;i<sides;i++){const ang=i/sides*TAU;ctx.beginPath();ctx.arc(Math.cos(ang)*r*.61,Math.sin(ang)*r*.61,2.4,0,TAU);ctx.fill()}
      ctx.globalAlpha=a*.4;ctx.drawImage(glowSprite(pal.main),-r,-r,r*2,r*2);ctx.restore()}});
  }

  function converge(x,y,radius,count,pal,duration){
    for(let i=0;i<count;i++){const a=rand(0,TAU),d=radius*rand(.6,1.25),delay=rand(0,duration*.55),life=duration-delay+.05,sx=x+Math.cos(a)*d,sy=y+Math.sin(a)*d*.8,color=Math.random()<.5?pal.main:pal.accent;
      add({x:sx,y:sy,life:life+delay,color,draw(ctx,p,t){const tt=clamp((p.age-delay)/life,0,1);if(tt<=0)return;const e=easeIn(tt),cx=sx+(x-sx)*e,cy=sy+(y-sy)*e,px=sx+(x-sx)*Math.max(0,e-.12),py=sy+(y-sy)*Math.max(0,e-.12);
        ctx.globalAlpha=Math.sin(Math.PI*tt)*.95;ctx.strokeStyle=p.color;ctx.lineWidth=2.2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(cx,cy);ctx.stroke();ctx.drawImage(glowSprite(p.color),cx-7,cy-7,14,14)}});
    }
  }

  function speedLines(x,y,pal,duration){
    const lines=Array.from({length:46},()=>({a:rand(0,TAU),d:rand(.55,1.1),l:rand(.12,.3),w:rand(.8,2.6),s:rand(.8,1.4)}));
    const reach=Math.hypot(state.w,state.h)*.75;
    add({x,y,life:duration,draw(ctx,p,t){const fade=t<.2?t/.2:Math.pow(1-(t-.2)/.8,1.2);ctx.globalAlpha=.42*fade;
      for(const L of lines){const d=reach*(L.d-((t*L.s*1.6)%1)*.5),len=reach*L.l;ctx.strokeStyle=Math.random()<.3?pal.accent:'#ffffff';ctx.lineWidth=L.w;ctx.beginPath();ctx.moveTo(p.x+Math.cos(L.a)*d,p.y+Math.sin(L.a)*d);ctx.lineTo(p.x+Math.cos(L.a)*(d+len),p.y+Math.sin(L.a)*(d+len));ctx.stroke()}}});
  }

  function embers(x,y,count,pal,opts={}){
    for(let i=0;i<count;i++){const color=Math.random()<.5?pal.accent:pal.main;
      add({x:x+rand(-opts.spread||-50,opts.spread||50),y:y+rand(-20,20),vx:rand(-40,40),vy:-rand(opts.rise||80,(opts.rise||80)*2.4),r:rand(2,4.6),phase:rand(0,TAU),color,life:rand(.7,opts.life||1.5),drag:.985,gravity:opts.gravity??-20,update:(p,dt)=>{physics(p,dt);p.x+=Math.sin(p.age*6+p.phase)*18*dt},
        draw(ctx,p,t){const a=Math.pow(1-t,1.1)*(.6+.4*Math.sin(p.age*22+p.phase));ctx.globalAlpha=a;const r=p.r*3;ctx.drawImage(glowSprite(p.color),p.x-r,p.y-r,r*2,r*2);ctx.fillStyle=pal.core;ctx.globalAlpha=a*.9;ctx.fillRect(p.x-p.r*.35,p.y-p.r*.35,p.r*.7,p.r*.7)}});
    }
  }

  function petals(x,y,count,pal,opts={}){
    for(let i=0;i<count;i++){const a=rand(0,TAU),v=rand(90,opts.speed||260);
      add({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.7-60,rot:rand(0,TAU),spin:rand(-8,8),s:rand(4,8),color:Math.random()<.5?pal.main:pal.accent,life:rand(.7,1.3),drag:.94,gravity:90,update:(p,dt)=>{physics(p,dt);p.rot+=p.spin*dt},
        draw(ctx,p,t){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.pow(1-t,1.2)*.9;ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,p.s,p.s*.42,0,0,TAU);ctx.fill();ctx.fillStyle=pal.core;ctx.globalAlpha*=.6;ctx.beginPath();ctx.ellipse(0,0,p.s*.5,p.s*.14,0,0,TAU);ctx.fill();ctx.restore()}});
    }
  }

  function hexShards(x,y,count,pal,opts={}){
    for(let i=0;i<count;i++){const a=rand(0,TAU),v=rand(120,opts.speed||380);
      add({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.8,rot:rand(0,TAU),spin:rand(-5,5),s:rand(7,15),life:rand(.45,.85),drag:.9,gravity:160,update:(p,dt)=>{physics(p,dt);p.rot+=p.spin*dt},
        draw(ctx,p,t){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.pow(1-t,1.2);ctx.strokeStyle=pal.core;ctx.fillStyle=rgba(pal.main,.28);ctx.lineWidth=1.6;ctx.beginPath();for(let k=0;k<6;k++){const an=k/6*TAU;ctx.lineTo(Math.cos(an)*p.s,Math.sin(an)*p.s)}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}});
    }
  }

  function tendrils(x,y,count,pal,length,life=.7){
    for(let i=0;i<count;i++){const a=rand(0,TAU),bend=rand(-1.2,1.2),len=length*rand(.6,1.1);
      add({x,y,life:life*rand(.8,1.1),draw(ctx,p,t){const grow=easeOut(clamp(t*2.2,0,1)),fade=Math.pow(1-t,1.2),n=16;ctx.lineCap='round';
        for(let pass=0;pass<2;pass++){ctx.strokeStyle=pass?pal.core:pal.main;ctx.globalAlpha=fade*(pass?.8:.45);ctx.beginPath();
          for(let k=0;k<=n;k++){const u=k/n*grow,ang=a+bend*u*u,d=len*u;ctx.lineWidth=(pass?1.2:5)*(1-u*.8)+.5;ctx.lineTo(p.x+Math.cos(ang)*d,p.y+Math.sin(ang)*d*.8)}ctx.stroke()}}});
    }
  }

  function implode(x,y,radius,count,pal,duration){
    for(let i=0;i<count;i++){const a=rand(0,TAU),r=radius*rand(.5,1.2),delay=rand(0,duration*.3),spin=rand(1.5,3.2);
      add({life:duration,x,y,draw(ctx,p,t){const tt=clamp((p.age-delay)/(duration-delay),0,1);if(tt<=0)return;const rr=r*(1-easeIn(tt)),ang=a+spin*tt*TAU*.35,px=p.x+Math.cos(ang)*rr,py=p.y+Math.sin(ang)*rr*.75;ctx.globalAlpha=Math.sin(Math.PI*tt);ctx.drawImage(glowSprite(i%2?pal.main:pal.accent),px-5,py-5,10,10)}});
    }
  }

  function debris(x,y,count,pal,groundY,opts={}){
    for(let i=0;i<count;i++){const a=-Math.PI/2+rand(-1.25,1.25),v=rand(260,opts.speed||620),verts=Array.from({length:5},(_,k)=>{const an=k/5*TAU+rand(-.3,.3),r=rand(.55,1);return[Math.cos(an)*r,Math.sin(an)*r]});
      add({x:x+rand(-20,20),y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:rand(0,TAU),spin:rand(-9,9),s:rand(4,opts.size||11),verts,ground:groundY,blend:'normal',life:rand(.8,1.3),drag:.99,gravity:1500,bounced:false,
        update(p,dt){physics(p,dt);p.rot+=p.spin*dt;if(p.y>p.ground&&p.vy>0){p.y=p.ground;p.vy*=p.bounced?0:-.32;p.vx*=.6;p.spin*=.5;p.bounced=true}},
        draw(ctx,p,t){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.min(1,(1-t)*2.2);ctx.fillStyle='#1c1a22';ctx.strokeStyle=rgba(pal.main,.9);ctx.lineWidth=1.2;ctx.beginPath();p.verts.forEach(([vx,vy],k)=>k?ctx.lineTo(vx*p.s,vy*p.s):ctx.moveTo(vx*p.s,vy*p.s));ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}});
    }
  }

  function smoke(x,y,count,opts={}){
    for(let i=0;i<count;i++){add({x:x+rand(-opts.spread||-60,opts.spread||60),y:y+rand(-10,10),vx:rand(-30,30),vy:-rand(10,50),r:rand(28,opts.size||60),blend:'normal',life:rand(.9,1.6),drag:.97,update:physics,
      draw(ctx,p,t){const rr=p.r*(1+t*1.2),g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rr);const a=.34*Math.sin(Math.PI*Math.min(1,t*1.3));g.addColorStop(0,`rgba(18,14,22,${a})`);g.addColorStop(1,'rgba(18,14,22,0)');ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(p.x-rr,p.y-rr,rr*2,rr*2)}})}
  }

  function groundCracks(x,y,pal,size,life=.9){
    const cracks=Array.from({length:7},()=>{const a=rand(0,TAU),pts=[[0,0]];let px=0,py=0;for(let k=0;k<5;k++){const aa=a+rand(-.5,.5),l=size*rand(.12,.24);px+=Math.cos(aa)*l;py+=Math.sin(aa)*l*.32;pts.push([px,py])}return pts});
    add({x,y,life,draw(ctx,p,t){const grow=easeOut(clamp(t*4,0,1)),a=Math.pow(1-t,1.3);ctx.lineCap='round';
      for(const pts of cracks){const n=Math.max(1,Math.round((pts.length-1)*grow));for(let pass=0;pass<2;pass++){ctx.globalAlpha=a*(pass?.95:.4);ctx.strokeStyle=pass?pal.core:pal.main;ctx.lineWidth=pass?1.4:5;ctx.beginPath();for(let k=0;k<=n;k++)k?ctx.lineTo(p.x+pts[k][0],p.y+pts[k][1]):ctx.moveTo(p.x,p.y);ctx.stroke()}}}});
  }

  function shieldDome(zone,pal,life=1.1){
    const cells=[];const rx=zone.width*.5,ry=zone.height*.62,step=26;
    for(let gx=-rx;gx<=rx;gx+=step*1.5)for(let gy=-ry;gy<=0;gy+=step*.866){const ox=(Math.round(gy/(step*.866))%2)?step*.75:0;cells.push([gx+ox,gy])}
    add({x:zone.x,y:zone.y+zone.height*.34,life,draw(ctx,p,t){const rise=easeOut(clamp(t*3,0,1)),a=(t<.7?1:Math.pow(1-(t-.7)/.3,1.3))*.95;ctx.save();ctx.translate(p.x,p.y);
      ctx.beginPath();ctx.ellipse(0,0,rx,ry*rise,0,Math.PI,TAU);ctx.closePath();ctx.save();ctx.clip();
      const g=ctx.createRadialGradient(0,-ry*.2,ry*.1,0,0,rx);g.addColorStop(0,rgba(pal.main,.05*a));g.addColorStop(.8,rgba(pal.main,.2*a));g.addColorStop(1,rgba(pal.core,.55*a));ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(-rx,-ry,rx*2,ry);
      const sweep=-ry+(ry*2.4)*((t*1.6)%1);ctx.strokeStyle=pal.core;ctx.lineWidth=1;
      for(const[cx,cy]of cells){const near=Math.max(0,1-Math.abs(cy-sweep)/60);ctx.globalAlpha=a*(.16+near*.7);ctx.beginPath();for(let k=0;k<6;k++){const an=k/6*TAU;ctx.lineTo(cx+Math.cos(an)*step*.5,cy+Math.sin(an)*step*.5)}ctx.closePath();ctx.stroke()}
      ctx.restore();ctx.strokeStyle=pal.main;ctx.globalAlpha=a*.35;ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(0,0,rx,ry*rise,0,Math.PI,TAU);ctx.stroke();ctx.strokeStyle=pal.core;ctx.globalAlpha=a;ctx.lineWidth=2.4;ctx.beginPath();ctx.ellipse(0,0,rx,ry*rise,0,Math.PI,TAU);ctx.stroke();ctx.restore()}});
  }

  // --- camera / overlays ---------------------------------------------------
  function shake(intensity,duration=380,zoom=0){
    const stage=state.stage;if(!stage||reducedMotion()||!stage.animate)return;
    const steps=9,frames=[];for(let i=0;i<=steps;i++){const k=Math.pow(1-i/steps,1.6),z=1+zoom*(i===0?0:Math.pow(1-i/steps,2)),x=i===steps?0:rand(-1,1)*intensity*k,y=i===steps?0:rand(-1,1)*intensity*k*.7;frames.push({transform:`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${z.toFixed(4)})`})}
    try{stage.animate(frames,{duration,easing:'linear',composite:'add'})}catch{try{stage.animate(frames,{duration,easing:'linear'})}catch{}}
  }
  function overlay(className,duration,setup){
    const stage=state.stage;if(!stage)return null;const node=document.createElement('div');node.className=className;node.setAttribute('aria-hidden','true');node.dataset.cine='1';
    if(duration)node.style.setProperty('--cine-duration',`${duration}ms`);setup?.(node);stage.appendChild(node);if(duration)setTimeout(()=>node.remove(),duration+60);return node;
  }
  function screenFlash(pt,color,peak=.6,duration=220){if(reducedMotion())peak*=.35;overlay('cine-flash',duration,node=>{node.style.setProperty('--cine-color',color);node.style.setProperty('--cine-peak',String(peak));node.style.setProperty('--cine-fx',`${(pt.x/Math.max(1,state.w)*100).toFixed(1)}%`);node.style.setProperty('--cine-fy',`${(pt.y/Math.max(1,state.h)*100).toFixed(1)}%`)})}
  function vignette(color,duration=900){overlay('cine-vignette',duration,node=>node.style.setProperty('--cine-vignette',color))}

  let dimNode=null,dimTimer=0,letterNodes=null,letterTimer=0;
  function dim(on,opts={}){
    const stage=state.stage;if(!stage)return;
    if(on){clearTimeout(dimTimer);if(!dimNode?.isConnected){dimNode=overlay('cine-dim',0)}dimNode.dataset.tone=opts.tone||'';if(opts.focus){dimNode.style.setProperty('--cine-fx',`${(opts.focus.x/Math.max(1,state.w)*100).toFixed(1)}%`);dimNode.style.setProperty('--cine-fy',`${(opts.focus.y/Math.max(1,state.h)*100).toFixed(1)}%`)}dimNode.classList.remove('is-off');requestAnimationFrame(()=>dimNode?.classList.add('is-on'))}
    else if(dimNode){const node=dimNode;node.classList.add('is-off');node.classList.remove('is-on');dimTimer=setTimeout(()=>{node.remove();if(dimNode===node)dimNode=null},460)}
  }
  function letterbox(on){
    const stage=state.stage;if(!stage)return;
    if(on){clearTimeout(letterTimer);if(!letterNodes?.every(n=>n.isConnected))letterNodes=['top','bottom'].map(side=>overlay(`cine-letterbox ${side}`,0));letterNodes.forEach(n=>{n.classList.remove('is-off');requestAnimationFrame(()=>n.classList.add('is-on'))})}
    else if(letterNodes){const nodes=letterNodes;nodes.forEach(n=>{n.classList.add('is-off');n.classList.remove('is-on')});letterTimer=setTimeout(()=>{nodes.forEach(n=>n.remove());if(letterNodes===nodes)letterNodes=null},400)}
  }

  // --- data helpers ----------------------------------------------------------
  function palette(id){return PALETTE[String(id||'').toUpperCase()]||PALETTE.EMBER}
  function hostilePalette(id){const base=palette(id);return{core:HOSTILE.core,main:mix(base.main,HOSTILE.main,.35),deep:HOSTILE.deep,accent:mix(base.accent,HOSTILE.main,.5)}}
  function memberFor(ownerId){return game()?.party?.find?.(p=>p.id===ownerId)||null}
  function portraitFor(member){const record=root.TRIAD_CHARACTER_ROSTER?.byId?.[member?.characterId];return record?.lobbyArt?.path||record?.portrait||''}
  function preloadPortraits(){for(const member of game()?.party||[]){const src=portraitFor(member);if(src&&!state.portraits.has(src)){const img=new Image();img.decoding='async';img.src=src;state.portraits.set(src,img)}}}
  function feetOf(node,anchor){
    const canvas=node?.querySelector?.('canvas,img');const h=canvas?.offsetHeight||node?.offsetHeight||200;
    return{x:anchor.x,y:anchor.y+h*.4};
  }
  function anchors(event){
    const stage=state.stage,rect=stageRect(stage);
    const enemy=root.combatVfxAnchor?.('.enemy-side .enemy-visual',rect)||{x:state.w*.72,y:state.h*.45};
    const ownerNode=root.combatVfxPartyActor?.(event?.ownerId),ally=ownerNode?root.combatVfxNodeAnchor?.(ownerNode,rect):null;
    const source=event?.kind==='ENEMY'?(root.TRIAD_BOSS_REPLACEMENTS?.launchAnchor?.(rect)||enemy):(ally||{x:state.w*.28,y:state.h*.6});
    const enemyNode=document.querySelector('.enemy-side .enemy-visual'),enemyRect=enemyNode?.getBoundingClientRect(),enemyGround=enemyRect?{x:enemy.x,y:Math.min(state.h-24,enemyRect.bottom-rect.top-enemyRect.height*.06)}:{x:enemy.x,y:enemy.y+120};
    return{rect,enemy,enemyGround,ally,ownerNode,source,sourceFeet:event?.kind==='ENEMY'?enemyGround:feetOf(ownerNode,ally||source),zone:root.combatVfxPartyZone?.(rect)};
  }
  function allyTargets(rect){return[...document.querySelectorAll('.ally-side .sd-card:not(.dead)')].map(node=>({node,point:root.combatVfxNodeAnchor?.(node,rect)})).filter(t=>t.point)}

  // --- element flavour -------------------------------------------------------
  function flavour(elementId,x,y,pal,power){
    const id=String(elementId||'').toUpperCase(),n=Math.round(power);
    if(id==='EMBER'){embers(x,y,10*n,pal,{spread:60*power,rise:120});glow(x,y-20,70*power,pal.main,.5,.5,{grow:.8})}
    else if(id==='VOLT'){for(let i=0;i<2+n;i++){const a=rand(0,TAU),l=rand(70,150)*power;bolt(x,y,x+Math.cos(a)*l,y+Math.sin(a)*l*.7,pal,{life:rand(.18,.3),width:7})}}
    else if(id==='AEGIS'){hexShards(x,y,6*n,pal,{speed:320*power});ring(x,y,20,110*power,pal.core,.4,{width:3})}
    else if(id==='SHADE'){tendrils(x,y,4+n*2,pal,110*power,.6);glow(x,y,60*power,pal.deep,.6,.6)}
    else if(id==='BLOOM'){petals(x,y,8*n,pal,{speed:260*power})}
    else if(id==='RIFT'){implode(x,y,120*power,10*n,pal,.35);later(300,()=>{ring(x,y,10,150*power,pal.accent,.45,{width:4,squash:.8});sparks(x,y,8*n,pal,{speed:420*power})})}
  }

  // --- card cinematics -------------------------------------------------------
  const launched=new WeakSet();
  function cardLaunch(event,a){
    const key=String(event.cardKey||''),pal=palette(event.elementId);
    if(event.pipeline==='SUPPORT')return supportCard(event,a,key,pal);
    if(event.pipeline==='ULTIMATE')return signatureLaunch(event,a,pal);
    glow(a.source.x+14,a.source.y-6,46,pal.main,.8,.3,{grow:.6});
    if(event.pipeline==='PROJECTILE')trackProjectile(event,pal,a);
  }

  function signatureLaunch(event,a,pal){
    const member=memberFor(event.ownerId),contact=contactMs(event),focus=a.source;
    dim(true,{focus});letterbox(true);
    magicCircle(a.sourceFeet.x,a.sourceFeet.y,120,pal,Math.max(1,contact/1000+.35),{spin:2.2});
    converge(focus.x,focus.y,180,34,pal,Math.min(.62,contact/1000*.8));
    speedLines(focus.x,focus.y,pal,Math.min(.75,contact/1000));
    glow(focus.x,focus.y,90,pal.main,.9,contact/1000,{grow:.6,fade:.8});
    pillar(a.sourceFeet.x,a.sourceFeet.y,state.h*.42,120,pal,Math.min(.8,contact/1000+.1),.55);
    if(!reducedMotion())cutIn(member,event,pal,Math.min(820,Math.max(560,contact+60)));
    trackProjectile(event,pal,a,true);
    // Contact releases the staging; this is the safety net for party-wide
    // signatures that never reach an enemy contact.
    later(Math.max(900,contact+900),()=>{dim(false);letterbox(false)});
    if(event.pipeline==='SUPPORT')later(Math.max(620,contact),()=>{const pt=a.zone||a.source;flash(pt.x,pt.y,140,pal,.35,.9);screenFlash(pt,pal.main,.4,240);ring(pt.x,pt.y,20,260,pal.core,.6,{width:6,squash:.5});shake(6,300,.015);later(360,()=>{dim(false);letterbox(false)})});
  }

  function cutIn(member,event,pal,duration){
    const src=portraitFor(member);
    overlay('cine-cutin',duration,node=>{
      node.style.setProperty('--cine-color',pal.main);node.style.setProperty('--cine-accent',pal.accent);
      const band=document.createElement('div');band.className='band';node.appendChild(band);
      if(src){
        const img=document.createElement('img');img.className='portrait';img.alt='';img.src=src;img.decoding='async';
        // Land every character's eye line on the same spot of the band, whatever the art's framing.
        const head=root.TRIAD_LIVE_ILLUSTRATION?.RIGS?.[member?.characterId]?.head;
        if(head){img.style.top=`${(25-head[1]/1536*265).toFixed(1)}%`;img.style.left='25%';img.style.translate=`${(-head[0]/1024*100).toFixed(1)}% 0`}
        node.appendChild(img);
      }
      const title=document.createElement('div');title.className='title';
      title.innerHTML='<span class="kicker">SIGNATURE ARTS</span><span class="name"></span><span class="owner"></span>';
      title.querySelector('.name').textContent=event.cardName||'필살기';title.querySelector('.owner').textContent=member?.name||'';node.appendChild(title);
    });
  }

  function supportCard(event,a,key,pal){
    const zone=a.zone,targets=allyTargets(a.rect);
    if(['guard','bastion','counter'].includes(key)||(key==='signature'&&String(event.elementId).toUpperCase()==='AEGIS')){
      if(zone)shieldDome(zone,pal,key==='signature'?1.4:1.05);
      for(const t of targets){glow(t.point.x,t.point.y,60,pal.main,.55,.6);hexShards(t.point.x,t.point.y-20,4,pal,{speed:180})}
      if(key==='counter'||key==='bastion')for(const t of targets)ring(t.point.x,t.point.y+50,14,70,palette('EMBER').accent,.6,{squash:.3,width:3});
      if(key==='signature')signatureLaunch(event,a,pal);
      return;
    }
    if(['heal','renewal'].includes(key)||key==='signature'){
      const heal=palette('BLOOM');
      for(const t of targets){const feet=feetOf(t.node,t.point);pillar(feet.x,feet.y,220,48,heal,.8);embers(feet.x,feet.y-20,10,heal,{spread:30,rise:90,life:1.1});magicCircle(feet.x,feet.y,56,heal,.9,{spin:1.6})}
      petals(a.source.x,a.source.y,14,heal,{speed:180});
      if(key==='signature')signatureLaunch(event,a,pal);
      return;
    }
    // focus / battery: energy gathers into the caster.
    converge(a.source.x,a.source.y,140,26,pal,.5);magicCircle(a.sourceFeet.x,a.sourceFeet.y,70,pal,.8,{spin:2.6});
    later(420,()=>{flash(a.source.x,a.source.y,60,pal,.3,.9);ring(a.source.x,a.source.y,10,90,pal.core,.45,{width:3})});
  }

  // Comet trail behind the authored travelling sprite: its on-screen centre is
  // sampled every frame so the trail follows whatever path CSS gives it.
  function trackProjectile(event,pal,a,heavy=false){
    const node=event.__cineTravel;if(!node)return;
    let lastX=null,lastY=null;
    task(Math.max(400,contactMs(event)+80),()=>{
      if(!node.isConnected)return;const r=node.getBoundingClientRect();if(!r.width||getComputedStyle(node).opacity<.05)return;
      const x=r.left+r.width/2-a.rect.left,y=r.top+r.height/2-a.rect.top;
      if(lastX!==null){const dx=x-lastX,dy=y-lastY,steps=Math.min(6,Math.ceil(Math.hypot(dx,dy)/10));for(let i=0;i<steps;i++){const px=lastX+dx*i/steps,py=lastY+dy*i/steps;glow(px,py,heavy?30:18,Math.random()<.5?pal.main:pal.accent,heavy?.5:.38,heavy?.42:.3,{grow:-.4})}
        if(Math.random()<(heavy?.9:.55))sparks(x,y,1,pal,{dir:Math.atan2(-dy,-dx),spread:.8,speed:240,gravity:60,life:.35})}
      lastX=x;lastY=y;
    });
  }

  function cardImpact(event,target){
    const key=String(event.cardKey||''),pal=palette(event.elementId),ultimate=event.pipeline==='ULTIMATE',heavy=event.pipeline==='HEAVY_IMPACT',x=target.x,y=target.y;
    const a=anchors(event);
    if(ultimate){
      flash(x,y,150,pal,.32,1);screenFlash(target,pal.main,.42,260);starFlare(x,y,260,pal,.28,{spikes:8});later(60,()=>slash(x,y,220,pal,{thick:44,life:.36}));
      ring(x,y,20,230,pal.core,.55,{width:9});later(90,()=>ring(x,y,10,320,pal.main,.7,{width:6}));later(180,()=>ring(a.enemyGround.x,a.enemyGround.y,30,380,pal.accent,.8,{width:5,squash:.28}));
      pillar(a.enemyGround.x,a.enemyGround.y,state.h*.62,170,pal,.75,.7);
      sparks(x,y,90,pal,{speed:900,width:4,life:.8,stretch:1.3});
      flavour(event.elementId,x,y,pal,2.4);groundCracks(a.enemyGround.x,a.enemyGround.y,pal,420,1.1);debris(a.enemyGround.x,a.enemyGround.y,16,pal,a.enemyGround.y,{speed:760});
      later(260,()=>{embers(x,y+40,26,pal,{spread:160,rise:60,life:1.8});smoke(a.enemyGround.x,a.enemyGround.y-10,8,{spread:140,size:80})});
      shake(15,560,.045);
      later(520,()=>{dim(false);letterbox(false)});
      return;
    }
    if(heavy){
      flash(x,y,90,pal,.24,.95);ring(x,y,16,150,pal.core,.42,{width:6});starFlare(x,y,key==='heavy'?200:150,pal,.2);
      const slashes=key==='combo'?3:key==='execute'||key==='burst'?2:1,size=key==='heavy'||key==='execute'?190:160;
      for(let i=0;i<slashes;i++)later(i*70,()=>slash(x+rand(-10,10),y+rand(-14,14),size,pal,{tilt:i%2?rand(.35,.7):rand(-.75,-.4),dir:i%2?-1:1,thick:size*.17}));
      sparks(x,y,key==='heavy'?56:40,pal,{speed:720,dir:0,spread:2.4,width:3.6});
      flavour(event.elementId,x,y,pal,key==='heavy'||key==='execute'?1.6:1.1);
      if(key==='heavy'){ring(a.enemyGround.x,a.enemyGround.y,20,190,pal.main,.5,{squash:.28,width:4});debris(a.enemyGround.x,a.enemyGround.y,8,pal,a.enemyGround.y)}
      shake(key==='heavy'||key==='execute'?10:7,340,key==='heavy'?.022:.014);
      if(key==='heavy'||key==='execute')screenFlash(target,pal.main,.22,160);
      return;
    }
    // projectile / light contact
    flash(x,y,64,pal,.2,.9);ring(x,y,12,110,pal.core,.36,{width:4});starFlare(x,y,120,pal,.16);
    sparks(x,y,28,pal,{speed:600,dir:0,spread:2.2});flavour(event.elementId,x,y,pal,.9);
    shake(5,260,.008);
  }

  // --- enemy cinematics ------------------------------------------------------
  function rankOf(event){return event.rank||(event.pipeline==='ULTIMATE'?'boss':(Number(event.emphasis)||1)>1.04?'elite':'normal')}

  function enemyLaunch(event,a){
    const rank=rankOf(event),pal=hostilePalette(event.elementId),contact=contactMs(event);
    glow(a.source.x,a.source.y,rank==='boss'?110:60,pal.main,.8,.35,{grow:.8});
    if(rank==='boss'){
      dim(true,{tone:'hostile',focus:a.enemy});vignette('rgba(255,20,44,.34)',Math.max(700,contact+200));
      magicCircle(a.enemyGround.x,a.enemyGround.y,190,pal,contact/1000+.4,{spin:-1.8,sides:8});
      converge(a.source.x,a.source.y,240,40,pal,Math.min(.65,contact/1000*.85));
      embers(a.enemyGround.x,a.enemyGround.y-10,30,pal,{spread:150,rise:140,life:1.2});
      if(!reducedMotion())warning(event,Math.min(760,contact+40));
      shake(4,Math.min(700,contact),0);
      trackProjectile(event,pal,a,true);
    }else if(rank==='elite'){
      magicCircle(a.enemyGround.x,a.enemyGround.y,140,pal,contact/1000+.3,{spin:-2.2});
      embers(a.enemyGround.x,a.enemyGround.y-10,16,pal,{spread:110,rise:120});
      converge(a.source.x,a.source.y,150,18,pal,Math.min(.4,contact/1000*.8));
      if(event.pipeline==='PROJECTILE')trackProjectile(event,pal,a,true);
    }else if(event.pipeline==='PROJECTILE')trackProjectile(event,pal,a);
  }

  function warning(event,duration){
    overlay('cine-warning',duration,node=>{node.innerHTML='<div class="label"><span class="kicker">WARNING</span><span class="name"></span></div>';node.querySelector('.name').textContent=event.skillName||'강력한 공격'});
  }

  function enemyImpact(event,target){
    const rank=rankOf(event),pal=hostilePalette(event.elementId),x=target.x,y=target.y,a=anchors(event);
    const melee=MELEE_ARCHETYPES.has(String(event.archetype||'').toUpperCase())&&event.pipeline!=='PROJECTILE';
    const partyWide=event.skillTarget==='all';
    const hitPoints=partyWide?allyTargets(a.rect).map(t=>t.point):[{x,y}];
    if(rank==='boss'){
      screenFlash(target,pal.main,.4,280);vignette('rgba(255,10,30,.42)',700);starFlare(x,y,240,pal,.26,{spikes:8});
      const zone=a.zone||{x,y,width:420,height:300},ground=zone.y+zone.height*.42;
      ring(zone.x,ground,30,zone.width*.75,pal.core,.7,{squash:.26,width:8});later(110,()=>ring(zone.x,ground,20,zone.width*.95,pal.main,.8,{squash:.26,width:5}));
      for(const p of hitPoints){flash(p.x,p.y,110,pal,.3,1);ring(p.x,p.y,16,170,pal.core,.5,{width:6});sparks(p.x,p.y,40,pal,{speed:760,dir:Math.PI,spread:2.6});flavour(event.elementId,p.x,p.y,pal,1.6)}
      pillar(x,ground,state.h*.55,130,pal,.6,.7);groundCracks(zone.x,ground,pal,zone.width*.9,1.2);debris(zone.x,ground,18,pal,ground,{speed:700});
      later(220,()=>smoke(zone.x,ground-10,10,{spread:zone.width*.4,size:90}));
      shake(17,620,.05);later(520,()=>dim(false));
      return;
    }
    const power=rank==='elite'?1.5:1;
    for(const p of hitPoints){
      flash(p.x,p.y,70*power,pal,.22,.95);ring(p.x,p.y,12,120*power,pal.core,.4,{width:5});starFlare(p.x,p.y,140*power,pal,.18);
      sparks(p.x,p.y,Math.round(26*power),pal,{speed:600*power,dir:Math.PI,spread:2.3});
      if(melee)claw(p.x,p.y,190*power,pal,{count:3});
      flavour(event.elementId,p.x,p.y,pal,power*.9);
    }
    if(rank==='elite'){const ground=(a.zone?.y||y)+(a.zone?.height||200)*.42;groundCracks(x,ground,pal,300,1);debris(x,ground,10,pal,ground);vignette('rgba(255,30,50,.4)',600)}
    shake(rank==='elite'?11:7,rank==='elite'?420:320,rank==='elite'?.025:.012);
  }

  // --- defeat / encounter ------------------------------------------------------
  function defeatBurst(){
    const stage=ensure();if(!stage)return;const node=document.querySelector('.enemy-side .enemy-visual');if(!node||node.dataset.cineDefeated==='1')return;node.dataset.cineDefeated='1';
    const rank=node.dataset.rank||'normal',a=anchors({kind:'CARD'}),pal=palette(game()?.combat?.enemy?.data?.elementId),x=a.enemy.x,y=a.enemy.y,big=rank==='boss'?1.8:rank==='elite'?1.35:1;
    const blast=(dx,dy,s)=>{flash(x+dx,y+dy,120*s,pal,.35,1);starFlare(x+dx,y+dy,230*s,pal,.3,{spikes:8});ring(x+dx,y+dy,20,260*s,pal.core,.6,{width:7});later(80,()=>ring(x+dx,y+dy,10,340*s,pal.main,.7,{width:4}));sparks(x+dx,y+dy,Math.round(70*s),pal,{speed:950*s,width:4,life:.9,stretch:1.2});hexShards(x+dx,y+dy,Math.round(10*s),pal,{speed:460*s});embers(x+dx,y+dy,Math.round(22*s),pal,{spread:90*s,rise:80})};
    if(rank==='boss'){
      dim(true,{focus:a.enemy});
      [[0,0,.7],[-60,-40,.8],[70,20,.9],[-20,50,1]].forEach(([dx,dy,s],i)=>later(i*170,()=>{blast(dx,dy,s);shake(8+i*2,260,.01)}));
      later(760,()=>{blast(0,0,big);screenFlash(a.enemy,pal.core,.8,420);pillar(a.enemyGround.x,a.enemyGround.y,state.h,260,pal,.9);ring(a.enemyGround.x,a.enemyGround.y,40,state.w*.6,pal.main,1,{squash:.25,width:8});debris(a.enemyGround.x,a.enemyGround.y,26,pal,a.enemyGround.y,{speed:900});shake(20,760,.06);later(900,()=>dim(false))});
    }else{
      blast(0,0,big);later(120,()=>ring(a.enemyGround.x,a.enemyGround.y,30,260*big,pal.main,.7,{squash:.28,width:5}));
      if(rank==='elite'){pillar(a.enemyGround.x,a.enemyGround.y,state.h*.6,150,pal,.7,.75);later(220,()=>blast(rand(-40,40),rand(-50,10),.7))}
      debris(a.enemyGround.x,a.enemyGround.y,Math.round(10*big),pal,a.enemyGround.y);later(200,()=>smoke(a.enemyGround.x,a.enemyGround.y-20,6,{spread:90,size:70}));
      screenFlash(a.enemy,pal.main,.38*big,240);shake(9*big,420,.02*big);
    }
  }

  function encounterIntro(){
    const stage=ensure(),combat=game()?.combat;if(!stage||!combat)return;
    const rank=combat.type==='boss'||combat.type==='eventBoss'?'boss':combat.type==='elite'?'elite':null;if(!rank)return;
    const pal=palette(combat.enemy?.data?.elementId),duration=rank==='boss'?1900:1300;
    later(260,()=>{
      overlay('cine-intro',duration,node=>{node.style.setProperty('--cine-color',rank==='boss'?'#ff3050':pal.main);node.innerHTML='<div class="stripe"></div><div class="label"><span class="rank"></span><span class="name"></span><span class="sub"></span></div>';node.querySelector('.rank').textContent=combat.type==='eventBoss'?'EVENT BOSS':rank==='boss'?'BOSS':'ELITE';node.querySelector('.name').textContent=combat.enemy?.name||'';node.querySelector('.sub').textContent=combat.type==='eventBoss'?`${game()?.eventBoss?.seasonId||''} · SCORE ATTACK`:`STAGE ${game()?.stage||''}`});
      if(rank==='boss'){later(180,()=>{const a=anchors({kind:'ENEMY'});magicCircle(a.enemyGround.x,a.enemyGround.y,220,hostilePalette(combat.enemy?.data?.elementId),1.6,{spin:-1.2,sides:8});shake(10,700,.03)})}
    });
  }

  // --- timing mirror of presentCombatVfx ------------------------------------
  function contactMs(event){
    const configured=Math.max(0,Number(event?.contactMs)||0);
    if(event?.pipeline==='HEAVY_IMPACT')return configured||210;
    if(event?.pipeline==='ULTIMATE'&&event.launchAsset?.path){const req=Number(event.launchDuration),launch=Math.max(320,Number.isFinite(req)?req:Math.max(820,configured+160));return Math.max(150,Math.min(launch-34,configured||Math.round(launch*.72)))}
    return configured||Math.round((Number(event?.duration)||Number(event?.asset?.duration)||700)*.72);
  }

  // --- hooks ---------------------------------------------------------------
  function wrap(name,after,before){
    const original=root[name];if(typeof original!=='function'||original.__cineWrapped)return false;
    const wrapped=function(...args){let pre;if(enabled)try{pre=before?.(...args)}catch(e){console.warn('TRIAD_CINEMATIC_FX',name,e)}const result=original.apply(this,args);if(enabled)try{after?.(result,args,pre)}catch(e){console.warn('TRIAD_CINEMATIC_FX',name,e)}return result};
    wrapped.__cineWrapped=true;wrapped.__cineOriginal=original;root[name]=wrapped;return true;
  }

  function install(){
    if(root.TRIAD_CINEMATIC_FX)return;
    wrap('combatCardVfxEvent',(event,[card])=>{if(event&&card){event.cardKey=card.pattern?.key||'';event.cardName=card.displayName||card.name}});
    wrap('combatEnemyVfxEvent',(event,[enemy,,skillId])=>{if(!event)return;const data=enemy?.data||enemy,skill=data?.skills?.find?.(s=>s.id===(skillId||event.skillId));event.rank=data?.rank||event.rank;event.skillName=skill?.name||'';event.skillTarget=skill?.target||'single'});
    wrap('presentCombatVfx',(ok,[event])=>{
      if(!ok||!event||!isCombatVisible()||!ensure())return;
      // presentCombatVfx appends its travelling sprite synchronously, so the
      // newest TRAVEL node belongs to this call.
      event.__cineTravel=[...state.stage.querySelectorAll('.battle-vfx[data-motion="TRAVEL"]')].pop()||null;
      const a=anchors(event);
      if(launched.has(event)){const pal=event.kind==='ENEMY'?hostilePalette(event.elementId):palette(event.elementId);trackProjectile(event,pal,a,event.pipeline==='ULTIMATE');return}
      launched.add(event);
      if(event.kind==='ENEMY')enemyLaunch(event,a);else cardLaunch(event,a);
    });
    wrap('triggerCombatVfxImpact',(result,[event,,target])=>{
      if(!event||!target||!isCombatVisible()||!ensure())return;
      if(event.kind==='ENEMY')enemyImpact(event,target);else cardImpact(event,target);
    });
    wrap('setEnemyVisualState',(result,[stateName])=>{if(String(stateName||'').toUpperCase()==='DEFEAT'&&isCombatVisible())defeatBurst()});
    wrap('startCombat',()=>{state.particles.length=0;dim(false);letterbox(false);later(0,encounterIntro)});
    root.TRIAD_CINEMATIC_FX=Object.freeze({version:VERSION,setEnabled(value){enabled=Boolean(value);if(!enabled){state.particles.length=0;state.tasks.length=0;dim(false);letterbox(false)}return enabled},get enabled(){return enabled},snapshot:()=>({particles:state.particles.length,tasks:state.tasks.length,running:Boolean(state.raf)})});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})(globalThis);
