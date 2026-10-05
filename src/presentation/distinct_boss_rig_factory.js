/* Shared source-specific boss rig factory. Candidate-only presentation layer. */
(function(root){'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=(v)=>{v=clamp(v);return v*v*(3-2*v);};
  function sample(track,t){
    if(!track?.length)return[0,0,0];
    if(t<=track[0][0])return track[0].slice(1);
    for(let i=1;i<track.length;i++){const a=track[i-1],b=track[i];if(t<=b[0]){const u=smooth((t-a[0])/Math.max(1,b[0]-a[0]));return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u);}}
    return track.at(-1).slice(1);
  }
  function regionWeight(x,y,region){
    const [cx,cy]=region.home,[rx,ry]=region.radius||[220,220];
    const dx=Math.abs(x-cx)/Math.max(1,rx),dy=Math.abs(y-cy)/Math.max(1,ry);
    return clamp(1-Math.max(dx,dy));
  }
  // Assets.load shares a cached texture. A retired actor must never unload it
  // underneath a new actor, including when the old load is still pending.
  const sourceLeases=new Map();
  function retainSourceTexture(url){
    let entry=sourceLeases.get(url);
    if(!entry||entry.retiring){
      const previousRetirement=entry?.retiring||Promise.resolve();
      entry={refs:0,ready:previousRetirement.then(()=>root.PIXI.Assets.load(url)),retiring:null};
      sourceLeases.set(url,entry);
    }
    entry.refs++;let released=false;
    return{ready:entry.ready,release(){
      if(released)return;released=true;entry.refs--;
      if(entry.refs)return;
      entry.retiring=entry.ready.then(()=>root.PIXI.Assets.unload(url),()=>{}).catch(()=>{}).finally(()=>{
        if(sourceLeases.get(url)===entry)sourceLeases.delete(url);
      });
    }};
  }
  class DistinctBossActor{
    constructor(clock,host,original,spec){Object.assign(this,{clock,host,original,spec,mode:'idle',renders:0,errors:[],destroyed:false,hitStarted:null});this.ready=this.load();}
    async load(){
      const {spec}=this;
      try{
        if(!root.PIXI)throw Error('PixiJS unavailable for '+spec.id+' candidate');
        this.app=new PIXI.Application();
        // Keep the logical combat lane at 768×512, but render into a 2× backing
        // buffer.  The source masters are 1536×1024; rendering them straight to
        // a 768×512 canvas was throwing away edge detail before the browser ever
        // displayed the boss.  autoDensity keeps CSS/layout coordinates logical
        // while the GPU gets the higher-resolution surface.
        await this.app.init({width:768,height:512,resolution:2,autoDensity:true,preference:'webgl',autoStart:false,sharedTicker:false,backgroundAlpha:0,antialias:true});
        if(this.destroyed){this.app.destroy(true,{children:true});return false;}
        this.canvas=this.app.canvas;this.canvas.className='enemy-animation-canvas '+spec.className;
        Object.assign(this.canvas.dataset,{enemyAnimation:spec.id,faction:'ENEMY',battleLane:'RIGHT',facing:'LEFT',runtimeMirror:'false',directionContract:'FRONT_LEFT_CANDIDATE',candidateStatus:'HOLD',rigSurface:'768x512',artVersion:spec.artVersion||'candidate'});
        this.canvas._triadBodyPoint=()=>{
          if(!this.motion)return null;
          const p=this.motion.toGlobal(this.deformPoint(...(spec.hitAnchor||[768,480])));
          return{x:p.x/this.app.screen.width,y:p.y/this.app.screen.height};
        };
        this.canvas.style.display='none';this.host.insertBefore(this.canvas,this.original);
        this._sourceLease=retainSourceTexture(spec.base+spec.file);
        this.texture=await this._sourceLease.ready;
        if(this.destroyed)return false;
        this.texture.source.scaleMode='linear';this.texture.source.autoGenerateMipmaps=true;this.texture.source.update();
        this.scene=new PIXI.Container();this.app.stage.addChild(this.scene);this.app.stage.scale.set(spec.scale||.40);
        this.motion=new PIXI.Container();this.motion.pivot.set(768,680);this.motion.position.set(768,680);this.scene.addChild(this.motion);
        this.mesh=new PIXI.MeshPlane({texture:this.texture,verticesX:41,verticesY:29});this.motion.addChild(this.mesh);
        this.vertexBuffer=this.mesh.geometry.getAttribute('aPosition').buffer;this.restVertices=new Float32Array(this.vertexBuffer.data);
        this.parts={};for(const [name,region] of Object.entries(spec.regions)){const node=new PIXI.Container();node.pivot.set(...region.home);node.position.set(...region.home);node.home=region.home;this.motion.addChild(node);this.parts[name]=node;}
        this.unsubscribe=this.clock.subscribe(now=>this.tick(now));this.original.style.display='none';this.canvas.style.display='block';this.apply(0);this.draw();return true;
      }catch(error){this.errors.push(String(error?.message||error));this.destroy();return false;}
    }
    play({releaseAt=specDefault(this.spec,470),contactAt=specDefault(this.spec,760),endAt=specDefault(this.spec,1540)}={}){if(this.destroyed)return;this.mode='attack';this.started=this.clock.time;this.mapping={releaseAt:Math.max(1,releaseAt),contactAt:Math.max(releaseAt+1,contactAt),endAt:Math.max(contactAt+1,endAt)};}
    mapElapsed(t){const m=this.mapping;if(t<=m.releaseAt)return t/m.releaseAt*460;if(t<=m.contactAt)return 460+(t-m.releaseAt)/(m.contactAt-m.releaseAt)*260;return 720+(t-m.contactAt)/(m.endAt-m.contactAt)*820;}
    // Idle breathing is added here, at mesh-deform time only, so part transforms
    // (and the authored attack/recovery continuity) stay exactly as sampled.
    regionTransforms(){const idle=this.idleOffsets;return Object.entries(this.spec.regions).map(([name,region])=>{const part=this.parts[name],o=idle?.[name],r=part.rotation+(o?o[0]:0);return{region,home:part.home,x:part.position.x+(o?o[1]:0),y:part.position.y+(o?o[2]:0),c:Math.cos(r),s:Math.sin(r)};});}
    idleTick(now){if(now-(this._idleAt??-1e9)<33)return;this._idleAt=now;const t=now/1000,names=Object.keys(this.spec.regions),calm=root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?0:1;this.idleOffsets=Object.fromEntries(names.map((name,i)=>[name,[Math.sin(t*(.85+i*.09)+i*1.7)*.02*calm,Math.sin(t*.8+i)*1.8*calm,Math.sin(t*1.05+i*.6)*2.4*calm]]));this.apply(0);this.scene.position.y+=Math.sin(t*1.05)*5*calm;this.draw();}
    deformPoint(x,y){let px=x,py=y;for(const p of this._regionTransforms||this.regionTransforms()){const w=regionWeight(x,y,p.region);if(w<.001)continue;const dx=x-p.home[0],dy=y-p.home[1];px+=w*(p.x+p.c*dx-p.s*dy-x);py+=w*(p.y+p.s*dx+p.c*dy-y);}return{x:px,y:py};}
    apply(t){const {spec}=this;this.scene.position.set(spec.sceneX??64,spec.sceneY??28);for(const name of Object.keys(spec.regions)){const [degrees,dx,dy]=sample(spec.tracks[name],t),part=this.parts[name];part.rotation=degrees*Math.PI/180;part.position.set(part.home[0]+dx,part.home[1]+dy);}this._regionTransforms=this.regionTransforms();const [degrees,dx,dy]=sample(spec.motion,t);this.motion.rotation=degrees*Math.PI/180;this.motion.position.set(768+dx,680+dy);if(this.vertexBuffer){for(let i=0;i<this.restVertices.length;i+=2){const p=this.deformPoint(this.restVertices[i],this.restVertices[i+1]);this.vertexBuffer.data[i]=p.x;this.vertexBuffer.data[i+1]=p.y;}this.vertexBuffer.update();}root.TRIAD_PART_RIG.keepContinuousBody(this);}
    hit(){if(!this.destroyed)this.hitStarted=this.clock.time;}
    defeat(){if(this.destroyed)return;this.mode='defeat';this.started=this.clock.time;this.hitStarted=null;}
    tick(now){if(this.destroyed||!this.scene)return;if(this.mode==='defeated')return;if(this.mode==='idle'&&this.hitStarted==null){this.idleTick(now);return;}if(this.mode!=='idle')this.idleOffsets=null;const elapsed=Math.max(0,now-this.started);this.apply(this.mode==='attack'?this.mapElapsed(elapsed):0);if(this.mode==='defeat'){const t=smooth(elapsed/720);this.scene.alpha=1-t;this.scene.position.y+=35*t;this.motion.rotation-=.08*t;this.draw();if(t===1)this.mode='defeated';return;}if(this.hitStarted!=null){const dt=now-this.hitStarted;if(dt>=240)this.hitStarted=null;else this.scene.position.x+=Math.sin(dt/240*Math.PI*2)*7*(1-dt/240);}this.draw();if(this.mode==='attack'&&elapsed>=this.mapping.endAt)this.cancelAction();}
    draw(){this.app.render();this.renders++;}
    cancelAction(){if(this.destroyed||!this.scene)return;this.mode='idle';this.mapping=null;this.hitStarted=null;this.apply(0);this.draw();}
    launchAnchor(stageRect){const rect=this.canvas&&(root.TRIAD_LAYOUT?.rect(this.canvas)||this.canvas.getBoundingClientRect());if(this.destroyed||!rect?.width||!this.motion)return null;const p=this.motion.toGlobal(this.deformPoint(...this.spec.anchor));const logical=this.app.screen||{width:768,height:512};return{x:rect.left-stageRect.left+p.x/logical.width*rect.width,y:rect.top-stageRect.top+p.y/logical.height*rect.height};}
    snapshot(){return{status:this.spec.status||this.spec.id+'_EXPLICIT_PART_MESH_RIG_CANDIDATE_HOLD',mode:this.mode,renders:this.renders,sourceFacing:'LEFT',mirrorCount:0,movingParts:Object.keys(this.spec.regions),sourceLayers:{greenMaster:this.spec.green,keyedDerivative:this.spec.file},continuity:this.spec.continuity,errors:[...this.errors],pending:['source identity/facing review','alpha edge review','real-time motion/user acceptance'],canonicalChanged:false};}
    destroy(){if(this.destroyed)return;this.destroyed=true;this.unsubscribe?.();if(this.original)this.original.style.display='block';this.canvas?.remove();try{this.app?.destroy(true,{children:true});}catch(error){this.errors.push(String(error?.message||error));}this._sourceLease?.release();this._sourceLease=null;}
  }
  function specDefault(spec,value){return spec.endAt||value;}
  root.TRIAD_DISTINCT_BOSS_RIG={create:(spec)=>class extends DistinctBossActor{constructor(clock,host,original){super(clock,host,original,spec);}},sample,DistinctBossActor};
})(globalThis);
