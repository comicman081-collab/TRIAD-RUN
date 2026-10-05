/* Lazy high-resolution boss replacement; no gameplay, HP, cards or RNG writes.
   Reuses the candidate's continuous renderer without promoting its game/UI wrappers. */
(function(root){'use strict';
  const jobs=new Map();let current=null;
  function script(url,available){
    if(available())return Promise.resolve();
    if(!jobs.has(url))jobs.set(url,new Promise((resolve,reject)=>{
      const tag=document.createElement('script');tag.src=new URL(url,document.baseURI).href;
      tag.onload=()=>available()?resolve():reject(Error('Replacement module unavailable: '+url));
      tag.onerror=()=>reject(Error('Replacement module load failed: '+url));document.head.appendChild(tag);
    }).catch(error=>{jobs.delete(url);throw error;}));
    return jobs.get(url);
  }
  async function runtime(){
    await script('assets/vendor/pixi-8.20.1/pixi.min.js',()=>!!root.PIXI);
    await script('src/presentation/scene_clock.js',()=>!!root.TRIAD_SCENE_CLOCK);
    await script('src/presentation/part_rig.js',()=>!!root.TRIAD_PART_RIG);
    await script('src/presentation/distinct_boss_rig_factory.js',()=>!!root.TRIAD_DISTINCT_BOSS_RIG);
  }
  class ReplacementBossActor{
    constructor(canvas,manifest,state,spec){
      Object.assign(this,{canvas,original:canvas,spec,state:'IDLE',pendingState:state,frame:0,generation:0,errors:[],_perfDead:false,_actorDestroyed:false});
      // Retain authored clip timing, not the old low-resolution atlas pixels.
      this.manifest={...manifest,atlas:spec.base+spec.file,frameWidth:spec.sourceWidth,frameHeight:spec.sourceHeight,
        renderMode:'CONTINUOUS_HIGHRES_MESH',legacyTimingSource:manifest.atlas,facing:'LEFT',runtimeMirror:false};
      Object.assign(canvas.dataset,{loadStatus:'LOADING',artVersion:spec.artVersion,atlas:this.manifest.atlas});
      const host=canvas.closest('.enemy-visual');
      Object.assign(host.dataset,{assetAuthority:'HIGHRES_REPLACEMENT',authorityPath:this.manifest.atlas,authorityStatus:spec.status,authorityQaOnly:'false',motion:'CONTINUOUS_MESH'});
      current=this;this.ready=this._pcReady=this.load();
    }
    async load(){
      try{
        await runtime();if(this._perfDead)return false;
        this.clock=root.TRIAD_PRESENTATION_CANDIDATE?.clock;
        if(!this.clock){
          this.ownsClock=true;this.clock=new root.TRIAD_SCENE_CLOCK.SceneClock({requestFrame:requestAnimationFrame.bind(root),cancelFrame:cancelAnimationFrame.bind(root),onError:error=>this.fail(error)});
          this.visibility=()=>this.clock.setPaused(document.hidden||!document.getElementById('combat')?.classList.contains('active'));
          document.addEventListener('visibilitychange',this.visibility);this.visibility();
          this.screenObserver=new MutationObserver(this.visibility);
          this.screenObserver.observe(document.getElementById('combat'),{attributes:true,attributeFilter:['class']});
        }
        const Actor=root.TRIAD_DISTINCT_BOSS_RIG.create(this.spec);
        this.rig=new Actor(this.clock,this.original.closest('.enemy-visual'),this.original);
        const ready=await this.rig.ready;if(this._perfDead)return false;
        if(!ready)throw Error(this.rig.errors.join('; ')||'Replacement renderer failed');
        this.canvas=this.rig.canvas;
        Object.assign(this.canvas.dataset,{loadStatus:'PASS',atlas:this.manifest.atlas,artVersion:this.spec.artVersion,
          directionContract:'PASS',sourceFacing:'LEFT',directionMode:'AUTHORED_LEFT',targetPolicy:'PLAYER_LANE'});
        this.original.dataset.loadStatus='REPLACED';
        this._unsubscribe=this.clock.subscribe(now=>this.tick(now));
        this.play(this.pendingState,{force:true});root.TRIAD_ENEMY_LAYOUT?.schedule();return true;
      }catch(error){if(!this._perfDead)this.fail(error);return false;}
    }
    fail(error){
      this.errors.push(String(error?.message||error));this.canvas.dataset.loadStatus='FAIL';
      console.error('TRIAD_BOSS_REPLACEMENT_FAILED',this.spec.id,error);
    }
    play(state,options={}){
      // Candidate action scheduler also uses this adapter as its rig handle.
      if(state&&typeof state==='object'){if(this.state!=='DEFEAT')this.rig?.play(state);return true;}
      if(this._perfDead)return false;
      const next=String(state||'IDLE').toUpperCase();
      if(!this.manifest.clips[next])throw Error('Unknown enemy animation state: '+next);
      if(this.state==='DEFEAT'&&next!=='DEFEAT'&&!options.force)return false;
      this.state=this.pendingState=next;this.frame=0;this.started=this.clock?.time||0;this.generation++;
      const history=(this.canvas.dataset.stateHistory||'').split('>').filter(Boolean);history.push(next);
      Object.assign(this.canvas.dataset,{enemyState:next,stateHistory:history.slice(-12).join('>'),stateGeneration:String(this.generation),lastActionState:next});
      this.canvas.closest('.enemy-visual')?.setAttribute('data-enemy-state',next);
      if(!this.rig?.scene)return true;
      const clip=this.manifest.clips[next];
      if(next==='DEFEAT')this.rig.defeat();
      else if(next==='HIT')this.rig.hit();
      else if(['ATTACK','SKILL'].includes(next)){
        const endAt=clip.frames*1000/clip.fps;
        // Canonical impact scheduling starts at action time, not after release.
        // The review scheduler overrides these timings with its common timeline.
        const contactAt=Math.min(endAt*.65,Math.max(180,root.TRIAD_SCENE_CLOCK.releaseTime(clip)));
        this.rig.play({releaseAt:contactAt*.45,contactAt,endAt:Math.max(endAt,contactAt+360)});
      }else this.rig.cancelAction();
      return true;
    }
    tick(now){
      if(this._perfDead||this._pcHeld)return;
      const clip=this.manifest.clips[this.state];if(!clip)return;
      const raw=Math.floor(Math.max(0,now-this.started)*clip.fps/1000);
      this.frame=clip.loop?raw%clip.frames:Math.min(raw,clip.frames-1);this.canvas.dataset.currentFrame=String(this.frame);
      if(!clip.loop&&!clip.holdLastFrame&&raw>=clip.frames&&this.rig?.mode!=='attack')this.play('IDLE',{force:true});
    }
    hit(){if(this.state!=='DEFEAT')this.rig?.hit();}
    cancelAction(){if(!this._perfDead&&this.state!=='DEFEAT')this.play('IDLE',{force:true});}
    launchAnchor(rect){return this.rig?.launchAnchor(rect)||null;}
    snapshot(){return{...(this.rig?.snapshot()||{}),id:this.spec.id,state:this.state,artVersion:this.spec.artVersion,
      source:this.manifest.atlas,sourceSize:[this.spec.sourceWidth,this.spec.sourceHeight],legacyAtlasLoaded:false,
      fullSplitPartRig:false,canonicalChanged:true,userVisualAcceptance:'PENDING',errors:[...this.errors,...(this.rig?.errors||[])]};}
    destroy(){
      if(this._perfDead)return;this._perfDead=this._actorDestroyed=true;this._unsubscribe?.();this.rig?.destroy();
      if(this.ownsClock)this.clock?.setPaused(true);
      if(this.visibility)document.removeEventListener('visibilitychange',this.visibility);
      this.screenObserver?.disconnect();
      this.original?.remove();if(current===this)current=null;
    }
  }
  root.TRIAD_BOSS_REPLACEMENTS={
    create(canvas,manifest,state){const spec=root.TRIAD_BOSS_ART_SPECS?.[manifest.id];return spec?new ReplacementBossActor(canvas,manifest,state,spec):null;},
    current:()=>current&&!current._perfDead?current:null,
    launchAnchor:rect=>current?.launchAnchor(rect)||null,
    snapshot:()=>current?.snapshot()||null
  };
})(globalThis);
