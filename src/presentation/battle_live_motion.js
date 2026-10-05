/* Battle live motion: smoother, more alive SD party members and monsters.

   The atlases are authored at low pose rates (SD clips hold each pose for 3
   of 30 frames; monster idles are 6 poses at 6 fps), so frames visibly step.
   This layer takes over drawing of every visible battle actor canvas and:
     1. interpolates between consecutive poses (premultiplied cross-dissolve,
        eased so action poses stay crisp and only the hand-off blends);
     2. cross-fades clip changes (idle <-> attack/hit) instead of hard cuts;
     3. adds a procedural rig on top: upper-body breathing and chest swell,
        a lean pivoting on the feet, and a damped wobble when struck.
   Feet stay planted on the normalized baseline and the whole figure never
   scales, so the size contract of sd_frame_normalization is preserved.
   Frames are drawn as thin horizontal strips with additive compositing on a
   cleared canvas, which is seamless at fractional positions.  If anything is
   missing the actor's own renderer keeps drawing. */
(function(root){
  'use strict';
  const VERSION='battle-live-motion-1.0.7';
  const STRIPS=18;
  const FRAME_MS=1000/30;
  const TAU=Math.PI*2;
  const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
  // Procedural amplitude per clip: full life while idle, restrained in action.
  const SD_CLIP_LIFE=Object.freeze({idle:1,victory:.8,guard:.55,enter:.3,skill:.3,attack:.22,ultimate:.2,hit:.35,ko:0});
  const ENEMY_CLIP_LIFE=Object.freeze({IDLE:1,ENTER:.4,SKILL:.25,ATTACK:.25,HIT:.35,DEFEAT:0});

  /* Pose sampling: which two atlas frames to show and how much of the second. */
  function poseBlend(elapsedMs,clip,loopClip){
    const frames=Math.max(1,clip.frames|0),fps=Math.max(1,Number(clip.fps)||10);
    const step=Math.max(1,Math.round(fps/Math.max(1,Number(clip.authoredPoseCadenceFps)||fps)));
    const raw=Math.max(0,elapsedMs)*fps/1000;
    if(!clip.loop&&raw>=frames-1)return{a:frames-1,b:frames-1,w:0};
    const pos=clip.loop?raw%frames:Math.min(raw,frames-1);
    const a=Math.floor(pos/step)*step;let b=a+step;
    if(b>=frames)b=clip.loop?b%frames:frames-1;
    const t=(pos-a)/step;
    // Loops dissolve continuously; actions hold each pose and blend late.
    const w=loopClip?t*t*(3-2*t):smooth(.45,1,t);
    return{a,b,w:a===b?0:w};
  }

  /* Row warp for one strip: vertical lift (breathing), shear (lean) and
     horizontal chest swell, all measured from the feet pivot. */
  function rowWarp(v,pivot,life){
    const h=Math.max(0,pivot-v);
    return{lift:life.breath*smooth(.04,.42,h),shear:life.lean*h,swell:1+life.breath*1.6*Math.exp(-Math.pow((h-.44)/.13,2))};
  }

  function drawWarped(ctx,image,sx,sy,sw,sh,dx,dy,dw,dh,pivot,axisX,life,alpha,frameHeight=dh){
    if(!image||alpha<=.004)return;
    ctx.globalAlpha=alpha;
    const rows=life.still?1:STRIPS;
    for(let i=0;i<rows;i++){
      const v0=i/rows,v1=(i+1)/rows,vm=(v0+v1)/2;
      const whole=frameHeight!==dh;
      const w0=rowWarp(whole?(dy+v0*dh)/frameHeight:v0,pivot,life),w1=rowWarp(whole?(dy+v1*dh)/frameHeight:v1,pivot,life),wm=rowWarp(whole?(dy+vm*dh)/frameHeight:vm,pivot,life);
      const y0=dy+v0*dh-w0.lift*frameHeight,y1=dy+v1*dh-w1.lift*frameHeight;
      const width=dw*wm.swell,x=axisX+(dx-axisX)*wm.swell+wm.shear*frameHeight;
      ctx.drawImage(image,sx,sy+v0*sh,sw,(v1-v0)*sh,x,y0,width,y1-y0);
    }
  }

  const states=new WeakMap();
  function stateFor(actor){
    let s=states.get(actor);
    if(!s){s={phase:Math.random()*TAU,phase2:Math.random()*TAU,period:3.2+Math.random()*.7,leanPeriod:5.2+Math.random()*1.4,spring:0,springV:0,lastKey:'',fade:null,last:null,life:0,nextPaint:null,paintedAt:null};states.set(actor,s)}
    return s;
  }
  function kick(actor,direction,strength=1){const s=stateFor(actor);s.springV+=direction*.55*strength}

  function procedural(s,now,clipLife,dt){
    s.life+=(clipLife-s.life)*Math.min(1,dt*6);
    s.springV+=(-s.spring*70-s.springV*7.5)*dt;s.spring+=s.springV*dt;
    if(reducedMotion())return{breath:0,lean:0,still:Math.abs(s.spring)<.0005};
    const t=now/1000,life=s.life;
    const breath=(Math.sin(t*TAU/s.period+s.phase)*.5+.5)*.0085*life;
    const lean=Math.sin(t*TAU/s.leanPeriod+s.phase2)*.012*life+s.spring*.08;
    return{breath,lean,still:false};
  }

  /* ---------------------------------------------------------------- SD party */
  function sdLayer(actor,frame){
    const clip=actor.manifest?.clips?.[actor.clip],atlas=actor.atlases?.[actor.clip];if(!clip||!atlas)return null;
    const fw=actor.manifest.frameWidth||512,fh=actor.manifest.frameHeight||512,columns=clip.columns||Math.max(1,Math.floor((atlas.naturalWidth||atlas.width)/fw));
    const norm=root.TRIAD_SD_NORMALIZATION,data=root.TRIAD_SD_FRAME_NORMALIZATION_DATA;
    const rect=norm?.destination?.(actor.characterId,actor.clip,frame,actor.canvas.width)||{x:0,y:0,size:actor.canvas.width};
    const spec=data?.characters?.[actor.characterId]?.clips?.[actor.clip];
    const storageFrame=clip.frameMap?.[frame]??frame;
    return{image:atlas,sx:(storageFrame%columns)*fw,sy:Math.floor(storageFrame/columns)*fh,sw:fw,sh:fh,dx:rect.x,dy:rect.y,dw:rect.size,dh:rect.size,pivot:clamp((spec?.pivotY||497)/fh,.5,1),axisX:rect.x+rect.size*((data?.pivotX||256)/fw)};
  }
  function renderSd(actor,now,dt){
    const clip=actor.manifest?.clips?.[actor.clip];if(!clip||!actor.atlases?.[actor.clip])return false;
    const s=stateFor(actor),key=actor.clip;
    const blend=poseBlend(now-actor.started,clip,Boolean(clip.loop));
    const samePose=(clip.frameMap?.[blend.a]??blend.a)===(clip.frameMap?.[blend.b]??blend.b);
    const A=sdLayer(actor,blend.a),B=blend.w>0&&!samePose?sdLayer(actor,blend.b):null;if(!A)return false;
    return paint(actor,s,key,A,B,samePose?0:blend.w,SD_CLIP_LIFE[actor.clip]??.4,now,dt,blend.a);
  }

  function prepareAtlas(actor,clipName){
    if(!actor.atlases?.[clipName])return false;
    const clip=actor.manifest?.clips?.[clipName],timing=root.TRIAD_SD_ACTION_TIMING?.timeline(clip,clipName);
    const startMs=Math.max(0,Number(timing?.startMs)||0);
    const canvas=actor.canvas,ctx=actor.ctx;if(!clip||!canvas?.width||!canvas.height||!ctx)return false;
    const backup=document.createElement('canvas');backup.width=canvas.width;backup.height=canvas.height;
    const copy=backup.getContext('2d',{willReadFrequently:false});
    const facade=Object.create(actor);Object.assign(facade,{canvas,ctx,clip:clipName,started:-startMs,_materialPreparation:true});
    // Prepare the actual actor context's full-size strip/upload path. Restore
    // its visible pixels synchronously so no preparation pose reaches a RAF.
    states.set(facade,{phase:0,phase2:0,period:3.5,leanPeriod:5.5,spring:0,springV:0,lastKey:'',fade:null,last:null,life:SD_CLIP_LIFE[clipName]??.4,nextPaint:null,paintedAt:null});
    let sampleMs=90;
    if(clip?.frameMap){
      const blend=poseBlend(startMs+sampleMs,clip,Boolean(clip.loop));
      if(clip.frameMap[blend.a]===clip.frameMap[blend.b]){
        const fps=Math.max(1,Number(clip.fps)||10),step=Math.max(1,Math.round(fps/Math.max(1,Number(clip.authoredPoseCadenceFps)||fps)));
        for(let next=blend.a+step;next<clip.frames;next+=step)if(clip.frameMap[next]!==clip.frameMap[blend.a]){
          sampleMs=Math.max(0,(next-step*.1)*1000/fps-startMs);break;
        }
      }
    }
    let saved=false;
    const neutral=()=>{ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.shadowColor='rgba(0,0,0,0)';ctx.shadowBlur=0;ctx.shadowOffsetX=ctx.shadowOffsetY=0;};
    try{
      if(!copy)return false;copy.drawImage(canvas,0,0);ctx.save();saved=true;neutral();
      const ok=renderSd(facade,sampleMs,1/60);if(ok)ctx.getImageData(0,0,1,1);return ok;
    }finally{
      try{if(saved)try{neutral();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(backup,0,0);}finally{ctx.restore();}}
      finally{states.delete(facade);backup.width=backup.height=0;}
    }
  }

  /* ------------------------------------------------------------------ monsters */
  function enemyLayer(actor,frame){
    const clip=actor.manifest?.clips?.[actor.state];if(!clip||!actor.image)return null;
    const fw=actor.manifest.frameWidth,fh=actor.manifest.frameHeight,c=actor.canvas;
    const index=clip.row*(actor.detail?.columns||6)+frame,rect=actor.detail?.frameRects?.[index],image=actor.frameImages?.[index]||actor.image;
    if(rect)return{image,sx:actor.frameImages?0:rect[0],sy:actor.frameImages?0:rect[1],sw:rect[2],sh:rect[3],dx:rect[4],dy:rect[5],dw:rect[2],dh:rect[3],frameHeight:c.height,pivot:.95,axisX:c.width/2};
    return{image:actor.image,sx:frame*fw,sy:clip.row*fh,sw:fw,sh:fh,dx:0,dy:0,dw:c.width,dh:c.height,pivot:.95,axisX:c.width/2};
  }
  function renderEnemy(actor,now,dt){
    const clip=actor.manifest?.clips?.[actor.state];if(!clip||!actor.image)return false;
    const s=stateFor(actor),key=actor.state;
    const blend=poseBlend(now-actor.started,clip,Boolean(clip.loop));
    const A=enemyLayer(actor,blend.a),B=blend.w>0?enemyLayer(actor,blend.b):null;if(!A)return false;
    return paint(actor,s,key,A,B,blend.w,ENEMY_CLIP_LIFE[actor.state]??.4,now,dt,blend.a);
  }

  function paint(actor,s,key,A,B,w,clipLife,now,dt,frame){
    const canvas=actor.canvas,ctx=actor.ctx;
    if(key!==s.lastKey){
      if(s.last&&s.lastKey)s.fade={layer:s.last,start:now,duration:/idle|IDLE/.test(key)?170:90};
      s.lastKey=key;
    }
    const life=procedural(s,now,clipLife,dt);
    let incoming=1;
    if(s.fade){const p=(now-s.fade.start)/s.fade.duration;if(p>=1)s.fade=null;else incoming=smooth(0,1,p)}
    ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.globalCompositeOperation='lighter';
    try{
      if(s.fade){const L=s.fade.layer;drawWarped(ctx,L.image,L.sx,L.sy,L.sw,L.sh,L.dx,L.dy,L.dw,L.dh,L.pivot,L.axisX,life,1-incoming,L.frameHeight)}
    }catch{s.fade=null}
    const draw=(L,a)=>drawWarped(ctx,L.image,L.sx,L.sy,L.sw,L.sh,L.dx,L.dy,L.dw,L.dh,L.pivot,L.axisX,life,a,L.frameHeight);
    try{draw(A,incoming*(1-w));if(B)draw(B,incoming*w)}
    catch{ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;return false}
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    s.last=w>=.5&&B?B:A;
    if(!actor._materialPreparation){canvas.dataset.currentFrame=String(frame);canvas.dataset.liveMotion='1';}
    return true;
  }

  /* ------------------------------------------------------------------ loop */
  function visible(canvas){
    // The combat screen owns visibility. offsetParent forces pending style /
    // layout work after the preceding actor's canvas and dataset writes.
    if(!canvas?.isConnected||canvas.hidden)return false;
    if(canvas.dataset.loadStatus==='REPLACED'||canvas.style.display==='none')return false;
    return true;
  }
  function actors(){
    const list=[];
    try{if(typeof sdBattleActors!=='undefined')for(const actor of sdBattleActors.values())list.push(['sd',actor])}catch{}
    try{if(typeof enemyBattleActor!=='undefined'&&enemyBattleActor)list.push(['enemy',enemyBattleActor])}catch{}
    return list;
  }
  let enabled=true;
  function release(actor){
    // Hand drawing back to the actor's own renderer on its next tick.
    if(actor.canvas?.dataset)actor.canvas.dataset.liveMotion='0';
    actor._lastClip='';actor._lastFrame=-1;actor._lastState='';actor._lastDrawnClip='';actor._lastDrawnFrame=-1;actor._lastDrawnState='';
  }
  function frame(now){
    requestAnimationFrame(frame);
    if(document.hidden||!document.getElementById('combat')?.classList.contains('active'))return;
    const mounted=actors().filter(([,actor])=>!actor._actorDestroyed&&!actor._perfDead&&visible(actor.canvas));
    for(const [index,[kind,actor]]of mounted.entries()){
      if(!enabled){if(actor.canvas.dataset.liveMotion==='1')release(actor);continue}
      const state=stateFor(actor),phase=FRAME_MS*index/Math.max(1,mounted.length);
      if(state.nextPaint===null||now-state.nextPaint>FRAME_MS*2)state.nextPaint=now+phase;
      // Retain the previous paint interval at this display cadence. Distribute
      // uploads without increasing their frequency or replaying overdue paints.
      if(now<state.nextPaint)continue;
      state.nextPaint=now+FRAME_MS-.1;
      const dt=Math.min(.05,Math.max(0,(now-(state.paintedAt??now))/1000));state.paintedAt=now;
      const ok=kind==='sd'?renderSd(actor,now,dt):renderEnemy(actor,now,dt);
      if(!ok&&actor.canvas.dataset.liveMotion==='1')release(actor);
    }
  }

  function install(){
    if(root.TRIAD_BATTLE_LIVE_MOTION)return;
    const guard=(Class,name)=>{
      const proto=Class?.prototype;if(!proto||proto.draw?.__liveWrapped)return;
      const original=proto.draw;
      const draw=function(...args){if(enabled&&this.canvas?.dataset?.liveMotion==='1')return;return original.apply(this,args)};
      draw.__liveWrapped=true;draw.__liveOriginal=original;proto.draw=draw;
      const play=proto.play;
      if(typeof play==='function'&&!play.__liveWrapped){
        const wrapped=function(state,...rest){const result=play.call(this,state,...rest);const key=String(state||'').toLowerCase();if(result!==false&&key==='hit')kick(this,name==='sd'?-1:1,1);return result};
        wrapped.__liveWrapped=true;proto.play=wrapped;
      }
    };
    guard(typeof SdBattleActor!=='undefined'?SdBattleActor:null,'sd');
    guard(typeof EnemyBattleActor!=='undefined'?EnemyBattleActor:null,'enemy');
    requestAnimationFrame(frame);
    root.TRIAD_BATTLE_LIVE_MOTION=Object.freeze({version:VERSION,poseBlend,rowWarp,prepareAtlas,setEnabled(value){enabled=Boolean(value);return enabled},get enabled(){return enabled}});
  }
  // The runtime performance layer replaces SdBattleActor/EnemyBattleActor
  // draw() on DOMContentLoaded; install after it so we wrap the final draw.
  const later=()=>setTimeout(install,0);
  // Deferred scripts run while readyState is "interactive", before the
  // performance layer's DOMContentLoaded hook. A zero-delay timer here could
  // otherwise install first and have its ownership guard overwritten later.
  if(document.readyState==='complete'||root.TRIAD_RUNTIME_PERF)later();
  else document.addEventListener('DOMContentLoaded',later,{once:true});
})(globalThis);
