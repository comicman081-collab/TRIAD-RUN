/* Keep native CSS movement, opacity and contact clocks. Cache the expensive
   filtered source states in a worker and composite them on one screen layer. */
(function(root){
  'use strict';
  if(!root.Worker||!root.OffscreenCanvas||location.protocol==='file:')return;
  const script=document.currentScript?.src,worker=new Worker(new URL('vfx_raster_worker.js?v=20261005-1080p',script));
  const cache=new Map(),jobs=new Map(),nodes=new Map(),warmed=new Set(),limit=192*1024*1024;
  const metrics={prepared:0,draws:0,frames:0,evictions:0,bytes:0,errors:[]};let jobId=0,canvas=null,ctx=null,raf=0,nextDraw=0,warmTimer=0,unavailable=false;
  let observedStage=null,resize=null;const viewport={width:0,height:0,dpr:1};
  function sceneDensity(){return Math.min(1,Math.max(.01,Number(root.TRIAD_LAYOUT?.density?.()??Math.min(1,root.devicePixelRatio||1))||1));}
  function sceneDimensions(node){
    const rect=root.TRIAD_LAYOUT?.rect(node)||node.getBoundingClientRect?.()||{width:node.clientWidth,height:node.clientHeight},w=Math.max(0,Number(rect.width)||0),h=Math.max(0,Number(rect.height)||0),dpr=Math.min(sceneDensity(),1920/Math.max(1,w),1080/Math.max(1,h));
    return{dpr,width:Math.max(1,Math.min(1920,Math.round(w*dpr))),height:Math.max(1,Math.min(1080,Math.round(h*dpr)))};
  }
  function renderer(surface){
    const gl=surface.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false});if(!gl)return null;
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
    const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p;attribute vec2 uv;uniform vec2 size;varying vec2 v;void main(){gl_Position=vec4(p.x/size.x*2.0-1.0,1.0-p.y/size.y*2.0,0.0,1.0);v=uv;}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D a;uniform sampler2D b;uniform float weight;uniform float opacity;varying vec2 v;void main(){gl_FragColor=mix(texture2D(a,v),texture2D(b,v),weight)*opacity;}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),vertices=new Float32Array(24),p=gl.getAttribLocation(program,'p'),uv=gl.getAttribLocation(program,'uv'),size=gl.getUniformLocation(program,'size'),weight=gl.getUniformLocation(program,'weight'),opacity=gl.getUniformLocation(program,'opacity');
    gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'a'),0);gl.uniform1i(gl.getUniformLocation(program,'b'),1);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_COLOR,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    function texture(entry,index){entry.textures??=[];if(!entry.textures[index]){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,entry.bitmaps[index]);entry.textures[index]=t;}return entry.textures[index];}
    function clear(){gl.viewport(0,0,surface.width,surface.height);gl.useProgram(program);gl.uniform2f(size,surface.width,surface.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
    function draw(entry,a,b,w,m,origin,left,top,alpha,dpr,shift=[0,0]){
      let i=0;for(const [u,v]of [[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]]){const x=-entry.pad+(entry.cropX||0)/entry.dpr+u*(entry.cropWidth/entry.dpr||entry.width+entry.pad*2)-origin[0]+shift[0],y=-entry.pad+(entry.cropY||0)/entry.dpr+v*(entry.cropHeight/entry.dpr||entry.height+entry.pad*2)-origin[1]+shift[1];vertices[i++]=dpr*(left+origin[0]+m.a*x+m.c*y+m.e);vertices[i++]=dpr*(top+origin[1]+m.b*x+m.d*y+m.f);vertices[i++]=u;vertices[i++]=v;}
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture(entry,a));gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture(entry,b));gl.uniform1f(weight,w);gl.uniform1f(opacity,alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STREAM_DRAW);gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);gl.drawArrays(gl.TRIANGLES,0,6);
    }
    function drop(entry){entry.textures?.forEach(t=>gl.deleteTexture(t));entry.textures=null;}
    return{clear,draw,drop,texture};
  }
  function resizeSurface(){if(observedStage)Object.assign(viewport,sceneDimensions(observedStage));}
  worker.onmessage=({data})=>{
    const entry=jobs.get(data.id);if(!entry){data.bitmaps?.forEach(bitmap=>bitmap.close());return;}jobs.delete(data.id);
    if(data.error){entry.failed=true;metrics.errors.push(data.error);return;}
    entry.bitmaps=data.bitmaps;entry.contentWidth=data.contentWidth;entry.contentHeight=data.contentHeight;Object.assign(entry,{cropX:data.cropX,cropY:data.cropY,cropWidth:data.cropWidth,cropHeight:data.cropHeight});entry.bytes=data.bytes;entry.ready=true;metrics.prepared++;metrics.bytes+=entry.bytes;trim();
    if(ctx&&!entry.retired){for(let index=0;index<entry.bitmaps.length;index++)textureJobs.push([entry,index]);scheduleTextures();}
  };
  function trim(){
    const held=new Set([...nodes.values()].map(n=>n.entry));
    for(const [key,entry]of cache){if(metrics.bytes<=limit)break;if(!entry.ready||held.has(entry))continue;entry.bitmaps.forEach(b=>b.close());ctx?.drop(entry);metrics.bytes-=entry.bytes;cache.delete(key);entry.ready=false;entry.retired=true;entry.warmKeys?.forEach(key=>warmed.delete(key));metrics.evictions++;}
  }
  function acquire(node){
    const style=getComputedStyle(node),width=parseFloat(style.width),height=parseFloat(style.height),animation=node.getAnimations().find(a=>a.effect?.target===node);
    if(!width||!height||!animation)return null;
    if(!/^[-\d.]+(?:px|%) [-\d.]+(?:px|%)$/.test(style.objectPosition))return null;
    const authored=animation.effect.getKeyframes(),motion=motionTrack(authored,width,height);if(!motion)return null;
    const frames=authored.filter(f=>typeof f.filter==='string');
    const filters=frames.length?frames.map(f=>f.filter):[style.filter||'none'];
    const dpr=sceneDensity(),key=JSON.stringify([node.src,width,height,dpr,filters]);
    let entry=cache.get(key);
    if(!entry){
      const radii=filters.flatMap(f=>[...f.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map(m=>Math.abs(Number(m[1]))));
      const pad=Math.ceil(Math.max(4,...radii)*4+4);
      entry={key,src:node.src,width,height,pad,dpr,frames:frames.map(f=>({offset:f.computedOffset??f.offset,easing:f.easing})),ready:false,failed:false};cache.set(key,entry);
      jobs.set(++jobId,entry);worker.postMessage({id:jobId,src:node.src,width,height,pad,dpr,filters});
    }
    return{entry,animation,motion,objectPosition:style.objectPosition,origin:style.transformOrigin.split(' ').map(parseFloat),left:parseFloat(style.left)||0,top:parseFloat(style.top)||0,originalFilter:node.style.getPropertyValue('filter'),filterPriority:node.style.getPropertyPriority('filter')};
  }
  function ensure(){
    if(unavailable)return false;
    const layer=root.combatVfxLayer?.();if(!layer)return false;
    if(!canvas?.isConnected){for(const entry of cache.values())entry.textures=null;canvas=document.createElement('canvas');canvas.className='battle-vfx-raster-canvas';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen;z-index:9';layer.appendChild(canvas);try{ctx=renderer(canvas);}catch(error){metrics.errors.push(String(error.message||error));}if(!ctx){nativeFallback();return false;}canvas.addEventListener('webglcontextlost',nativeFallback,{once:true});}
    const stage=layer.parentElement;
    if(stage!==observedStage){resize?.disconnect();observedStage=stage;resizeSurface();resize=new ResizeObserver(resizeSurface);resize.observe(stage);}
    const {dpr,width:w,height:h}=viewport;
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    return dpr;
  }
  const easingCache=new Map();
  function ease(value,name){
    if(name==='linear')return value;
    if(!easingCache.has(name)){const aliases={linear:[0,0,1,1],ease:[.25,.1,.25,1],'ease-out':[0,0,.58,1],'ease-in':[.42,0,1,1],'ease-in-out':[.42,0,.58,1]},match=String(name).match(/cubic-bezier\(([^)]+)\)/);easingCache.set(name,match?match[1].split(',').map(Number):aliases[name]||aliases.linear);}
    const [x1,y1,x2,y2]=easingCache.get(name),bezier=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
    let lo=0,hi=1;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(bezier(mid,x1,x2)<value)lo=mid;else hi=mid;}
    return bezier((lo+hi)/2,y1,y2);
  }
  function mix(entry,progress){
    if(entry.bitmaps.length===1)return[0,0,0];
    let a=0;while(a<entry.frames.length-2&&progress>entry.frames[a+1].offset)a++;
    const first=entry.frames[a],last=entry.frames[a+1],p=Math.max(0,Math.min(1,(progress-first.offset)/(last.offset-first.offset||1)));
    return[a,a+1,ease(p,first.easing)];
  }
  function restore(node,state){node.style.visibility='';if(state.originalFilter)node.style.setProperty('filter',state.originalFilter,state.filterPriority);else node.style.removeProperty('filter');}
  function nativeFallback(){unavailable=true;for(const [node,state]of nodes)restore(node,state);nodes.clear();if(raf)cancelAnimationFrame(raf);raf=0;if(textureTimer)cancelAnimationFrame(textureTimer);textureTimer=0;textureJobs.length=0;worker.terminate();jobs.clear();for(const entry of cache.values())entry.bitmaps?.forEach(bitmap=>bitmap.close());cache.clear();metrics.bytes=0;canvas?.remove();ctx=null;}
  worker.onerror=event=>{metrics.errors.push(String(event.message||'VFX worker unavailable'));nativeFallback();};
  // CSS supplies resolved keyframes (including var()/calc() values). Interpolate
  // the same matching transform functions and property-specific offsets without
  // asking the browser to recalculate animated styles on every rendered frame.
  function transformParts(value,width,height){
    const result=[];let at=0;
    while(at<value.length){while(value[at]===' ')at++;const match=/^(translate(?:X|Y)?|scale(?:X|Y)?|rotate)\(/.exec(value.slice(at));if(!match)return null;
      at+=match[0].length;let end=at,depth=1;for(;end<value.length&&depth;end++){if(value[end]==='(')depth++;else if(value[end]===')')depth--;}if(depth)return null;
      const name=match[1],args=value.slice(at,end-1).split(',').map(x=>x.trim());at=end;
      const length=(s,size)=>{const terms=[...s.replace(/-\s+(?=\d)/g,'-').matchAll(/(-?\d+(?:\.\d+)?)(px|%)/g)];if(!terms.length)return Number(s);return terms.reduce((sum,m)=>sum+Number(m[1])*(m[2]==='%'?size/100:1),0);};
      let values;if(name.startsWith('translate'))values=name==='translateX'?[length(args[0],width),0]:name==='translateY'?[0,length(args[0],height)]:[length(args[0],width),length(args[1]||'0',height)];
      else if(name.startsWith('scale'))values=name==='scaleX'?[Number(args[0]),1]:name==='scaleY'?[1,Number(args[0])]:[Number(args[0]),Number(args[1]||args[0])];
      else values=[parseFloat(args[0])];if(values.some(n=>!Number.isFinite(n)))return null;result.push({name,values});
    }return result;
  }
  function motionTrack(frames,width,height){
    const transforms=frames.filter(f=>typeof f.transform==='string').map(f=>({...f,parts:transformParts(f.transform,width,height)})),opacity=frames.filter(f=>f.opacity!==undefined).map(f=>({...f,value:Number(f.opacity)}));
    if(!transforms.length||transforms.some(f=>!f.parts)||transforms.some(f=>f.parts.map(p=>p.name).join('|')!==transforms[0].parts.map(p=>p.name).join('|'))||!opacity.length)return null;
    const positions=frames.filter(f=>typeof f.objectPosition==='string').map(f=>({...f,values:f.objectPosition.split(' ')}));
    if(positions.some(f=>!/^[-\d.]+(?:px|%) [-\d.]+(?:px|%)$/.test(f.objectPosition)))return null;
    return{transforms,opacity,positions};
  }
  function segment(frames,progress){let index=0;while(index<frames.length-2&&progress>frames[index+1].computedOffset)index++;const a=frames[index],b=frames[Math.min(index+1,frames.length-1)],p=Math.max(0,Math.min(1,(progress-a.computedOffset)/(b.computedOffset-a.computedOffset||1)));return[a,b,ease(p,a.easing)];}
  function sampleState(state){
    const progress=state.animation.effect.getComputedTiming().progress;if(progress===null)return null;
    const [a,b,p]=segment(state.motion.transforms,progress),matrix=new DOMMatrix();
    a.parts.forEach((part,index)=>{const values=part.values.map((value,i)=>value+(b.parts[index].values[i]-value)*p);if(part.name.startsWith('translate'))matrix.translateSelf(...values);else if(part.name.startsWith('scale'))matrix.scaleSelf(...values);else matrix.rotateSelf(values[0]);});
    const [oa,ob,op]=segment(state.motion.opacity,progress),opacity=oa.value+(ob.value-oa.value)*op;
    const x=state.entry.width/2-state.origin[0],y=state.entry.height/2-state.origin[1];
    const free=[state.entry.width-state.entry.contentWidth,state.entry.height-state.entry.contentHeight],position=state.objectPosition.split(' '),offset=(value,space)=>String(value).includes('%')?parseFloat(value)*space/100:parseFloat(value);
    let objectShift=free.map((space,index)=>offset(position[index],space)-space/2);
    if(state.motion.positions.length){const [pa,pb,pp]=segment(state.motion.positions,progress);objectShift=free.map((space,index)=>{const a=offset(pa.values[index],space),b=offset(pb.values[index],space);return a+(b-a)*pp-space/2;});}
    return{matrix,opacity,objectShift,x:state.left+state.origin[0]+matrix.a*x+matrix.c*y+matrix.e,y:state.top+state.origin[1]+matrix.b*x+matrix.d*y+matrix.f};
  }
  const textureJobs=[];let textureTimer=0;
  function scheduleTextures(){if(textureTimer||!textureJobs.length||unavailable)return;textureTimer=requestAnimationFrame(()=>{textureTimer=0;const [entry,index]=textureJobs.shift();if(ctx&&entry.ready&&!entry.retired){ctx.texture(entry,index);if(!ctx.primed){ctx.clear();ctx.draw(entry,index,index,0,{a:1,b:0,c:0,d:1,e:0,f:0},[0,0],0,0,0,viewport.dpr);ctx.clear();ctx.primed=true;}}scheduleTextures()});}
  function frame(now){
    raf=0;if(document.hidden||!document.getElementById('combat')?.classList.contains('active'))return;
    if(now<nextDraw){if(nodes.size)raf=requestAnimationFrame(frame);return;}
    const interval=1000/60;if(now-nextDraw>interval*2)nextDraw=now;nextDraw+=interval*(1+Math.floor((now-nextDraw)/interval));
    const dpr=ensure();if(!dpr)return;metrics.frames++;
    ctx.clear();
    for(const [node,state]of nodes){
      if(!node.isConnected){nodes.delete(node);continue;}
      const e=state.entry;if(e.failed||e.retired){restore(node,state);nodes.delete(node);continue;}if(!e.ready)continue;
      if(!state.cached){node.style.visibility='hidden';node.style.setProperty('filter','none','important');node.dataset.vfxRaster='CACHED_RGBA';state.cached=true;}
      const sample=sampleState(state);if(!sample||sample.opacity<.002)continue;
      const timing=state.animation.effect.getComputedTiming(),progress=timing.progress;if(progress===null)continue;
      const [a,b,weight]=mix(e,progress);
      ctx.draw(e,a,b,weight,sample.matrix,state.origin,state.left,state.top,sample.opacity,dpr,sample.objectShift);metrics.draws++;
    }
    trim();if(nodes.size)raf=requestAnimationFrame(frame);else nextDraw=0;
  }
  const original=root.appendCombatVfxParticle;
  if(typeof original!=='function'){worker.terminate();return;}
  root.appendCombatVfxParticle=function(...args){const result=original.apply(this,args);if(!unavailable&&result?.particle){const state=acquire(result.particle);if(state){nodes.set(result.particle,state);if(!raf)raf=requestAnimationFrame(frame);}}return result;};
  function warmPlans(event,zone){
    if(!event?.asset)return[];
    const plans=[],asset=event.asset,pipeline=event.pipeline||(asset.motion==='TRAVEL'?'PROJECTILE':'HEAVY_IMPACT');
    const impact=asset=>{const impactEvent={...event,scope:'SINGLE',emphasis:Math.max(1,Number(event.emphasis)||1)};plans.push({event:impactEvent,asset,phase:'IMPACT',zone:null});if(event.impactAsset&&event.impactAsset!==asset)plans.push({event:{...impactEvent,emphasis:Math.max(.72,impactEvent.emphasis*.76)},asset:event.impactAsset,phase:'IMPACT',zone:null});};
    if(pipeline==='HEAVY_IMPACT')impact(asset);
    else if(pipeline==='ULTIMATE'&&event.launchAsset?.path){const requested=Number(event.launchDuration),duration=Number.isFinite(requested)?requested:Math.max(820,(Number(event.contactMs)||0)+160);plans.push({event:{...event,asset:event.launchAsset,duration:Math.max(320,duration),emphasis:Math.max(.46,(Number(event.emphasis)||1)*(Number(event.launchEmphasis)||.7))},asset:event.launchAsset,phase:'PRIMARY',zone:null});impact(event.impactAsset||asset);}
    else{plans.push({event,asset,phase:'PRIMARY',zone:event.target==='party'&&event.scope==='ALL_ALLIES'?zone:null});if(event.target==='enemy'||event.kind==='ENEMY')impact(event.impactAsset||asset);}
    return plans;
  }
  function warm(event,zone){
    for(const plan of warmPlans(event,zone)){
      const {event,asset,phase,zone}=plan;
      if(!asset?.path)continue;const key=[asset.path,phase,event.elementId,event.uniqueAssetId,event.scope].join('|');if(warmed.has(key))continue;warmed.add(key);
      const result=original(event,asset,{x:0,y:0},{x:0,y:0},zone,phase);if(!result?.particle)continue;
      result.particle.style.visibility='hidden';const state=acquire(result.particle);if(state){state.entry.warmKeys??=new Set();state.entry.warmKeys.add(key);}result.particle.getAnimations().forEach(a=>a.cancel());result.particle.remove();
    }
  }
  function introSignatures(combat){
    if(combat.turn!==1||(Number(combat.actionToken)||0)!==0||combat.phase!=='PLAYER'||combat.inputLocked)return[];
    const party=new Set(run.party.map(member=>member.id)),owners=new Set(),selected=[];
    // A selected signature can start in the deck instead of the opening hand.
    // Read only this encounter's inventory; never invent an unowned card.
    for(const pile of [combat.hand,run.deck,combat.draw])for(const state of pile||[]){
      const card=ALL_CARDS[typeof state==='string'?state:state?.id];
      if(!card||!party.has(card.owner)||owners.has(card.owner)||card.pattern?.key!=='signature')continue;
      owners.add(card.owner);selected.push(card);if(selected.length===3)return selected;
    }
    return selected;
  }
  function warmHand(){
    warmTimer=0;if(unavailable||typeof run==='undefined'||!run?.combat||!document.getElementById('combat')?.classList.contains('active'))return;
    const combat=run.combat,cards=combat.hand.map(state=>root.combatCardVfxEvent(ALL_CARDS[state.id])),enemy=combat.enemy,enemyEvent=root.combatEnemyVfxEvent(enemy,run.party[0]?.id,combat.intent?.skillId||enemy.data?.skills?.[0]?.id);
    const openingIds=new Set(combat.hand.map(state=>state.id)),sequence=typeof battleVfxSequence==='number'?battleVfxSequence:null;
    try{for(const card of introSignatures(combat))if(!openingIds.has(card.id))cards.push(root.combatCardVfxEvent(card));}
    finally{if(sequence!==null)battleVfxSequence=sequence;}
    const needsWarm=event=>warmPlans(event,null).some(({event,asset,phase})=>asset?.path&&!warmed.has([asset.path,phase,event.elementId,event.uniqueAssetId,event.scope].join('|')));
    if(![...cards,enemyEvent].some(needsWarm))return;
    const counter=typeof battleVfxSequence==='number'?battleVfxSequence:null;
    ensure();const stage=document.querySelector('#combat .battle-stage'),rect=root.TRIAD_LAYOUT?.rect(stage)||stage.getBoundingClientRect(),zone=root.combatVfxPartyZone?.(rect);
    for(const event of cards)warm(event,zone);
    warm(enemyEvent,null);
    if(counter!==null)battleVfxSequence=counter;
  }
  const render=root.renderCombat;root.renderCombat=function(...args){const result=render.apply(this,args);if(!warmTimer)warmTimer=setTimeout(warmHand,100);return result;};
  root.addEventListener('resize',()=>{for(const [node,state]of nodes)restore(node,state);nodes.clear();ctx?.clear();resizeSurface();warmed.clear();warmHand();});
  root.addEventListener('pagehide',()=>{worker.terminate();for(const entry of cache.values())entry.bitmaps?.forEach(b=>b.close());cache.clear();},{once:true});
  root.TRIAD_VFX_RASTER=Object.freeze({version:'vfx-raster-1.0.3',snapshot:()=>({...metrics,compositeMaxFps:60,renderer:unavailable?'native-css':'cached-rgba-webgl',nodes:nodes.size,pending:jobs.size,pendingTextures:textureJobs.length,entries:cache.size}),cacheInfo:()=>[...cache.values()].map(e=>({key:e.key,ready:e.ready,filters:e.bitmaps?.length||0,uploaded:e.textures?.filter(Boolean).length||0,gpuReady:Boolean(e.ready&&e.bitmaps?.length&&e.bitmaps.every((_,i)=>e.textures?.[i]))})),sample:node=>{const state=nodes.get(node);return state?.entry.ready?sampleState(state):null},animationMath:Object.freeze({motionTrack,sampleState,transformParts,ease}),warmHand});
})(globalThis);
