/* TRIAD // RUN authoritative transaction helpers.
   This module is deterministic, serializable, and intentionally UI-agnostic. */
(function attachTriadTransactions(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TRIAD_TXN = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function triadTransactionsFactory() {
  'use strict';

  function requireRun(run) {
    if (!run || typeof run !== 'object') throw new Error('TRIAD transaction requires an active run');
    if (!run.id) throw new Error('TRIAD transaction requires run.id');
    return run;
  }

  function ensureLedger(run) {
    requireRun(run);
    if (!run.transactionLedger || typeof run.transactionLedger !== 'object' || Array.isArray(run.transactionLedger)) {
      run.transactionLedger = {};
    }
    return run.transactionLedger;
  }

  function id(run, kind, scope) {
    requireRun(run);
    const normalizedKind = String(kind || 'TXN').replace(/[^A-Z0-9_-]/gi, '_').toUpperCase();
    const normalizedScope = String(scope == null ? '' : scope).replace(/[^A-Z0-9_.:-]/gi, '_');
    return `${run.id}:${normalizedKind}:${normalizedScope}`;
  }

  function isCommitted(run, transactionId) {
    if (!transactionId) return false;
    return ensureLedger(run)[transactionId]?.status === 'COMMITTED';
  }

  function commit(run, transactionId, payload) {
    if (!transactionId) throw new Error('TRIAD transaction id is required');
    const ledger = ensureLedger(run);
    if (ledger[transactionId]?.status === 'COMMITTED') return false;
    ledger[transactionId] = {
      status: 'COMMITTED',
      sequence: Object.keys(ledger).length + 1,
      payload: payload && typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : {}
    };
    return true;
  }

  function pending(run, kind, scope, fields) {
    return {
      ...(fields && typeof fields === 'object' ? fields : {}),
      kind,
      txnId: id(run, kind, scope),
      status: 'PENDING'
    };
  }

  function isPending(record, kind, stage) {
    return Boolean(record && record.kind === kind && record.status === 'PENDING' && (stage == null || record.stage === stage));
  }

  function restore(run) {
    requireRun(run);
    ensureLedger(run);
    if (run.combat && typeof run.combat === 'object') {
      run.combat.phase = run.combat.phase === 'TERMINAL' ? 'TERMINAL' : 'PLAYER';
      run.combat.inputLocked = run.combat.phase === 'TERMINAL';
      run.combat.actionToken = Number.isInteger(run.combat.actionToken) ? run.combat.actionToken : 0;
    }
    if (run.routeOffer && typeof run.routeOffer === 'object') {
      run.routeOffer.txnId = run.routeOffer.txnId || id(run, 'ROUTE', run.routeOffer.stage);
      run.routeOffer.status = run.routeOffer.status || 'PENDING';
    }
    return run;
  }

  return Object.freeze({ ensureLedger, id, isCommitted, commit, pending, isPending, restore });
});

/* Full-resolution battle runtime optimization.
   Source atlases, frame size, enemies, skills, ultimates and VFX stay unchanged.
   Only decode residency and redundant canvas redraw scheduling are changed. */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const installTriadFullResPerf = () => {
    'use strict';
    const VERSION='2026-09-07-fullres-lazy-atlas-v2';
    if(window.TRIAD_RUNTIME_PERF?.version===VERSION)return;
    if(typeof SdBattleActor==='undefined'||typeof EnemyBattleActor==='undefined')return;

    const metrics={atlasLoads:0,atlasEvictions:0,playerDraws:0,playerSkipped:0,enemyDraws:0,enemySkipped:0,decodePeak:0};
    const MAX_ATLASES=2;
    const MAX_DECODES=(Number(navigator.deviceMemory)||4)<=4?1:2;
    const queue=[];let active=0,seq=0;
    const atlasPath=(actor,name)=>actor?.manifest?.assets?.[name]?.path||actor?.manifest?.clips?.[name]?.atlas||'';
    const visible=()=>!document.hidden&&document.getElementById('combat')?.classList.contains('active');
    const closeSource=source=>{try{if(source?.close)source.close();else if(source instanceof HTMLImageElement){source.onload=null;source.onerror=null;source.src=''}}catch{}};

    const decodeImage=async path=>{
      if(typeof createImageBitmap==='function'&&location.protocol!=='file:'){
        try{const response=await fetch(path,{cache:'force-cache',credentials:'same-origin'});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await createImageBitmap(await response.blob())}catch(error){console.warn('TRIAD bitmap fallback',path,error)}
      }
      return await new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>{const done=()=>resolve(image);typeof image.decode==='function'?image.decode().catch(()=>{}).finally(done):done()};image.onerror=()=>reject(new Error(`TRIAD atlas load failed: ${path}`));image.src=path})
    };
    const pump=()=>{while(active<MAX_DECODES&&queue.length){queue.sort((a,b)=>b.priority-a.priority||a.seq-b.seq);const job=queue.shift();active++;metrics.decodePeak=Math.max(metrics.decodePeak,active);decodeImage(job.path).then(job.resolve,job.reject).finally(()=>{active--;pump()})}};
    const decode=(path,priority=50)=>new Promise((resolve,reject)=>{queue.push({path,priority,seq:++seq,resolve,reject});pump()});

    const p=SdBattleActor.prototype;
    p._perfTouch=function(name){(this._perfUse??=new Map()).set(name,performance.now())};
    p._perfRelease=function(name){const source=this.atlases?.[name];if(!source)return false;closeSource(source);delete this.atlases[name];this._perfUse?.delete(name);metrics.atlasEvictions++;return true};
    p._perfEvict=function(protect=[]){const keep=new Set(['idle',this.clip,this.normalizeClip?.(this.pendingState),...protect].filter(Boolean));const candidates=Object.keys(this.atlases||{}).filter(name=>!keep.has(name)).sort((a,b)=>(this._perfUse?.get(a)||0)-(this._perfUse?.get(b)||0));while(Object.keys(this.atlases||{}).length>MAX_ATLASES&&candidates.length)this._perfRelease(candidates.shift())};
    p._perfEnsure=function(name,priority=80){
      if(!this.manifest?.clips?.[name])return Promise.reject(new Error(`Unknown SD clip: ${name}`));
      this._perfPromises??=new Map();
      if(this.atlases?.[name]){this._perfTouch(name);return Promise.resolve(this.atlases[name])}
      if(this._perfPromises.has(name))return this._perfPromises.get(name);
      const path=atlasPath(this,name);if(!path)return Promise.reject(new Error(`Missing SD atlas: ${this.characterId}/${name}`));
      const promise=decode(path,priority).then(source=>{if(this._perfDestroyed){closeSource(source);return null}this.atlases[name]=source;this._perfTouch(name);metrics.atlasLoads++;this._perfEvict([name]);this.canvas.dataset.atlasCacheCount=String(Object.keys(this.atlases).length);return source}).finally(()=>this._perfPromises.delete(name));
      this._perfPromises.set(name,promise);return promise
    };
    p._perfActivate=function(name){if(!this.atlases?.[name])return false;this.clip=name;this.frame=0;this.started=performance.now();this.eventFrames.clear();this._perfLastClip='';this._perfLastFrame=-1;this._perfTouch(name);this.canvas.dataset.currentClip=name;this.canvas.dataset.currentAtlas=atlasPath(this,name);this.canvas.dataset.pendingAtlas='';this.canvas.setAttribute?.('aria-label',`${this.canvas.dataset.characterName||this.characterId} SD ${name}`);this._perfEvict([name]);return true};
    p.load=async function(){
      if(!this.manifest)return;this._perfDestroyed=false;this._perfPromises=new Map();this._perfUse=new Map();this._perfLastClip='';this._perfLastFrame=-1;
      const initial=this.normalizeClip(this.pendingState||'idle');
      try{await this._perfEnsure(initial,120);if(this._perfDestroyed)return;this.canvas.dataset.loadStatus='PASS';this._perfActivate(initial);this.raf=requestAnimationFrame(t=>this.tick(t));if(initial!=='idle'&&this.manifest.clips.idle)setTimeout(()=>!this._perfDestroyed&&this._perfEnsure('idle',20).catch(()=>{}),200)}catch(error){this.canvas.dataset.loadStatus='FAIL';console.error('TRIAD_SD_ATLAS_LOAD_FAIL',this.characterId,error)}
    };
    p.play=function(name){
      if(!this.manifest)return false;this.pendingState=name;const clip=this.normalizeClip(name),request=(this._perfRequest||0)+1;this._perfRequest=request;
      if(this.atlases?.[clip])return this._perfActivate(clip);
      this.canvas.dataset.pendingAtlas=clip;this._perfEnsure(clip,130).then(source=>{if(source&&!this._perfDestroyed&&request===this._perfRequest)this._perfActivate(clip)}).catch(error=>{this.canvas.dataset.loadStatus='FAIL';console.error('TRIAD_SD_ATLAS_LOAD_FAIL',this.characterId,clip,error)});return true
    };
    p.tick=function(now){
      if(this._perfDestroyed)return;if(!visible()){this.raf=requestAnimationFrame(t=>this.tick(t));return}
      const clip=this.manifest?.clips?.[this.clip],atlas=this.atlases?.[this.clip];
      if(clip&&atlas){const raw=Math.floor(Math.max(0,now-this.started)*clip.fps/1000),ended=!clip.loop&&raw>=clip.frames;if(ended&&!clip.holdLastFrame)this.play('idle');else{const frame=ended?clip.frames-1:clip.loop?raw%clip.frames:Math.min(raw,clip.frames-1);this.frame=frame;if(this._perfLastClip!==this.clip||this._perfLastFrame!==frame){this.draw(atlas,clip,frame);this._perfLastClip=this.clip;this._perfLastFrame=frame;metrics.playerDraws++;for(const[eventName,eventFrame]of Object.entries(clip.events||{}))if(frame===eventFrame&&!this.eventFrames.has(eventName)){this.eventFrames.add(eventName);this.canvas.dispatchEvent(new CustomEvent('triad-sd-event',{bubbles:true,detail:{characterId:this.characterId,clip:this.clip,event:eventName,frame}}))}}else metrics.playerSkipped++}}
      this.raf=requestAnimationFrame(t=>this.tick(t))
    };
    p.draw=function(atlas,clip,frame){const w=this.manifest.frameWidth,h=this.manifest.frameHeight,sourceW=Number(atlas?.naturalWidth||atlas?.width)||w,cols=clip.columns||Math.max(1,Math.floor(sourceW/w)),sx=(frame%cols)*w,sy=Math.floor(frame/cols)*h;this.canvas.dataset.currentFrame=String(frame);this.canvas.dataset.atlasColumns=String(cols);this.canvas.dataset.atlasRows=String(clip.rows||Math.ceil(clip.frames/cols));const old=this.ctx.globalCompositeOperation;this.ctx.globalCompositeOperation='copy';this.ctx.drawImage(atlas,sx,sy,w,h,0,0,this.canvas.width,this.canvas.height);this.ctx.globalCompositeOperation=old};
    p.destroy=function(){this._perfDestroyed=true;this._perfRequest=(this._perfRequest||0)+1;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;for(const name of Object.keys(this.atlases||{}))this._perfRelease(name);this._perfPromises?.clear?.()};

    const ep=EnemyBattleActor.prototype,enemyPlay=ep.play;
    ep.load=function(){const path=this.manifest?.atlas;if(!path)return;this._perfDestroyed=false;decode(path,120).then(source=>{if(this._perfDestroyed){closeSource(source);return}this.image=source;this.canvas.dataset.loadStatus='PASS';this.canvas.dataset.atlas=path;this.play(this.pendingState);this.raf=requestAnimationFrame(t=>this.tick(t))}).catch(error=>{this.canvas.dataset.loadStatus='FAIL';console.error('TRIAD_ENEMY_ATLAS_LOAD_FAIL',this.manifest?.id,error)})};
    ep.play=function(state,options){const result=enemyPlay.call(this,state,options);if(result!==false){this._perfLastState='';this._perfLastFrame=-1}return result};
    ep.tick=function(now){if(this._perfDestroyed)return;if(!visible()){this.raf=requestAnimationFrame(t=>this.tick(t));return}const clip=this.manifest?.clips?.[this.state];if(this.image&&clip){const generation=this.generation,raw=Math.floor(Math.max(0,now-this.started)*clip.fps/1000),ended=!clip.loop&&raw>=clip.frames;if(ended&&!clip.holdLastFrame){if(generation===this.generation)this.play('IDLE',{force:true,reason:'complete'})}else{const frame=ended?clip.frames-1:clip.loop?raw%clip.frames:Math.min(raw,clip.frames-1);this.frame=frame;if(this._perfLastState!==this.state||this._perfLastFrame!==frame){this.draw(clip,frame);this._perfLastState=this.state;this._perfLastFrame=frame;metrics.enemyDraws++}else metrics.enemySkipped++}}this.raf=requestAnimationFrame(t=>this.tick(t))};
    ep.draw=function(clip,frame){const w=this.manifest.frameWidth,h=this.manifest.frameHeight,sx=frame*w,sy=clip.row*h;this.canvas.dataset.currentFrame=String(frame);const old=this.ctx.globalCompositeOperation;this.ctx.globalCompositeOperation='copy';this.ctx.drawImage(this.image,sx,sy,w,h,0,0,this.canvas.width,this.canvas.height);this.ctx.globalCompositeOperation=old};
    ep.destroy=function(){this._perfDestroyed=true;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;closeSource(this.image);this.image=null};

    const prefetched=new Set(),prefetchEncoded=path=>{if(!path||prefetched.has(path))return;prefetched.add(path);const link=document.createElement('link');link.rel='prefetch';link.as='image';link.href=path;link.dataset.triadPerfPrefetch='1';document.head.appendChild(link)};
    const oldRender=renderCombat;
    renderCombat=function(...args){const out=oldRender.apply(this,args);try{if(run?.combat){const paths=[];for(const state of run.combat.hand||[]){const card=ALL_CARDS[state.id];if(!card)continue;const member=run.party.find(x=>x.id===card.owner),manifest=member&&window.TRIAD_SD_MANIFESTS?.[member.characterId];if(!manifest)continue;const key=card.pattern.key,clip=key==='signature'?'ultimate':['guard','bastion','counter'].includes(key)?'guard':['focus','battery','mark','dot','heal','renewal','overload'].includes(key)?'skill':'attack',path=manifest.assets?.[clip]?.path||manifest.clips?.[clip]?.atlas;if(path&&!paths.includes(path))paths.push(path);if(paths.length>=4)break}setTimeout(()=>paths.forEach(prefetchEncoded),220)}}catch(error){console.warn('TRIAD encoded atlas prefetch skipped',error)}return out};

    window.TRIAD_RUNTIME_PERF={version:VERSION,sourceQuality:'UNCHANGED_FULL_RESOLUTION',playerAtlasLimit:MAX_ATLASES,decodeConcurrency:MAX_DECODES,metrics,snapshot:()=>({version:VERSION,sourceQuality:'UNCHANGED_FULL_RESOLUTION',metrics:{...metrics},players:[...sdBattleActors].map(([id,a])=>({id,clip:a.clip,cached:Object.keys(a.atlases||{})}))})};
    console.info('TRIAD_RUNTIME_PERF_ACTIVE',window.TRIAD_RUNTIME_PERF.snapshot())
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installTriadFullResPerf,{once:true});else installTriadFullResPerf();
}
