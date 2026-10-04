/* Live illustration: Live2D-style idle motion for the flat RGBA character art.

   The 1024x1536 lobby illustration is drawn as a dense textured mesh that a
   vertex shader bends every frame with a small rig measured on each picture:
     - legs stay planted: nothing below the hips moves, the figure never floats
     - torso: breathes (shoulders rise, chest widens) and leans from the hips
     - head: turns rigidly around the chin, with turn/nod parallax so the face
       leads the skull outline; it glances around, tilts now and then and
       follows the pointer
     - hair and cloth outside the body core lag the head through a damped
       pendulum plus a slow, long-wavelength flutter (no rubbery ripples)
     - eyes blink: the fragment pass slides the upper lid (skin + lash line)
       down over each measured eye
     - a held weapon (rig.weapon: centre-line path, radius, grip) is rigid: it
       follows the hand at its grip instead of bending with the cloth sway
   Tapping gives a small startled reaction.  Anything that fails (no WebGL,
   lost context, missing art) leaves the original <img> visible. */
(function(root){
  'use strict';
  const VERSION='live-illustration-2.2.1';
  const GRID_X=48,GRID_Y=72,TEX_W=1024,TEX_H=1536;
  // Source-pixel anchors on each lobby illustration (001-006: the 20260924
  // standing repaint): head = midpoint between
  // the eyes, neck = chin (head pivot), chest / hip = torso, feet = ground.
  // eyes: [cx, cy, halfWidth, lidAbove, lidBelow, tilt] per visible eye.
  const RIGS=Object.freeze({
    'TRIAD-CHAR-001':{head:[510,167],neck:[510,223],chest:[500,330],hip:[495,650],feet:1460,body:210,hair:1.25,eyes:[[484,166.7,12.5,7.2,7.4,.23],[535.7,166.7,12.5,7.2,7.4,-.23]]},
    'TRIAD-CHAR-002':{head:[489,208],neck:[490,266],chest:[470,340],hip:[455,655],feet:1480,body:200,hair:1.2,eyes:[[460.7,209,11.5,5.5,7.4,.23],[516.7,207.3,13,5.5,7.4,-.24]]},
    'TRIAD-CHAR-003':{head:[510,473],neck:[512,518],chest:[520,610],hip:[512,800],feet:1310,body:190,hair:1.0,feetSpan:1000,eyes:[[493.3,471.7,8.5,3.8,5.1,.33],[527.3,475,7.8,3.8,5.1,-.15]]},
    'TRIAD-CHAR-004':{head:[582,170],neck:[577,243],chest:[560,340],hip:[505,680],feet:1490,body:190,hair:1.1,eyes:[[580,164,10.5,5.8,7.8,.39]],
      weapon:{grip:[895,640],radius:60,path:[[788,48],[912,220],[938,420],[895,640],[915,830],[822,1100]]}},
    'TRIAD-CHAR-005':{head:[510,286],neck:[520,344],chest:[515,420],hip:[500,735],feet:1464,body:220,hair:1.1,eyes:[[487,294.3,10.5,5.2,7,-.24],[532.5,277,13.5,5.8,7.8,-.18]]},
    'TRIAD-CHAR-006':{head:[574,174],neck:[564,224],chest:[590,395],hip:[579,757],feet:1504,body:200,hair:1.0,eyes:[[555,164,13,5.5,7.4,.3],[592.7,183.3,11,5.5,7.4,.37]]},
    'TRIAD-CHAR-007':{head:[543,116],neck:[550,167],chest:[537,400],hip:[552,767],feet:1533,body:230,hair:1.0,eyes:[[513,125.3,13.5,9.5,6.8,-.15],[573.7,106.7,15.6,6.6,8.9,-.22]]},
    'TRIAD-CHAR-008':{head:[496,162],neck:[514,226],chest:[517,433],hip:[543,767],feet:1530,body:220,hair:1.3,eyes:[[478.5,169.5,8.2,4.6,6.2,.15],[514.5,155.3,10.4,4.6,6.2,-.08]]},
    'TRIAD-CHAR-009':{head:[525,191],neck:[530,252],chest:[484,445],hip:[500,767],feet:1501,body:190,hair:.9,eyes:[[502.5,196,12,8,7.4,-.26],[547,185.8,12.6,5.6,7.6,-.21]]},
    'TRIAD-CHAR-010':{head:[526,135],neck:[540,197],chest:[519,399],hip:[534,752],feet:1495,body:220,hair:1.3,eyes:[[499.5,146.5,13,8.8,6,-.2],[553,123.3,14.2,5.6,7.6,-.25]]},
    'TRIAD-CHAR-011':{head:[545,168],neck:[560,226],chest:[511,399],hip:[511,767],feet:1513,body:220,hair:1.35,eyes:[[519.5,180,13,9.8,6.8,-.28],[570.5,155.5,15.2,6,8.1,-.29]]},
    'TRIAD-CHAR-012':{head:[524,253],neck:[526,307],chest:[417,450],hip:[373,767],feet:1534,body:210,hair:1.25,eyes:[[499.2,246.2,11.9,5.6,7.6,.38],[548.8,259.5,10,5.6,9.4,.09]]}
  });
  const DEFAULT_RIG={head:[512,220],neck:[512,280],chest:[512,450],hip:[512,780],feet:1500,body:210,hair:1,eyes:[]};
  const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};

  const VS=`
attribute vec2 aPos;
uniform vec2 uCanvas; uniform vec2 uOrigin; uniform float uScale;
uniform vec2 uHead; uniform vec2 uNeck; uniform vec2 uChest; uniform vec2 uHip; uniform float uFeet; uniform float uBody;
uniform float uBreath; uniform float uBodyRoll; uniform float uHeadRoll; uniform vec2 uTurn; uniform vec2 uHair; uniform float uTime; uniform float uFlutter;
uniform vec2 uWeapon[8]; uniform float uWeaponN; uniform float uWeaponR; uniform vec2 uWeaponGrip;
varying vec2 vUv;
vec2 rot(vec2 p, vec2 c, float a){ float s=sin(a), k=cos(a); p-=c; return c+vec2(p.x*k-p.y*s, p.x*s+p.y*k); }
float segDist(vec2 p, vec2 a, vec2 b){ vec2 ab=b-a; float t=clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0); return length(p-(a+ab*t)); }
vec2 deform(vec2 p){
  float face=max(20.0,length(uNeck-uHead));
  float span=max(1.0,uHip.y-uHead.y);
  vec2 pivot=uNeck+(uNeck-uHead)*0.25;
  // smooth region weights
  float upper=1.0-smoothstep(uHip.y-0.22*span,uHip.y+0.08*span,p.y);
  float shoulders=1.0-smoothstep(uChest.y,uHip.y-0.1*span,p.y);
  float head=(1.0-smoothstep(1.05*face,2.5*face,length(p-mix(uHead,uNeck,0.35))))*(1.0-smoothstep(pivot.y-0.1*face,pivot.y+0.8*face,p.y));
  float facial=exp(-dot(p-uHead,p-uHead)/(2.0*pow(0.85*face,2.0)));
  vec2 cd=(p-uChest)/vec2(1.35*uBody,0.6*max(1.0,uHip.y-uChest.y));
  float chest=exp(-0.5*dot(cd,cd));
  float legD=abs(p.x-uHip.x);
  float outside=smoothstep(0.55*uBody,1.6*uBody,p.y<uHip.y?segDist(p,uHip,uNeck):legD);
  float legs=smoothstep(uHip.y,uHip.y+0.15*(uFeet-uHip.y),p.y)*(1.0-smoothstep(0.8*uBody,1.7*uBody,legD));
  float hang=clamp((p.y-uNeck.y)/max(1.0,uFeet-uNeck.y),0.0,1.0);
  float floorPin=1.0-smoothstep(uFeet-0.3*(uFeet-uHip.y),uFeet-0.05*(uFeet-uHip.y),p.y);
  float loose=outside*(1.0-legs)*floorPin*smoothstep(0.0,0.15,hang)*(0.35+0.65*hang);
  // head: rigid roll at the neck, turn / nod parallax (features lead the outline)
  p=rot(p,pivot,uHeadRoll*head);
  p+=uTurn*face*vec2(0.035*head+0.05*facial,0.025*head+0.035*facial);
  // breathing
  p.y-=uBreath*span*0.012*shoulders*upper;
  p.x+=(p.x-uChest.x)*uBreath*0.014*chest;
  // torso lean from the hips
  p=rot(p,uHip,uBodyRoll*upper);
  // loose hair and cloth: lagging pendulum + slow flutter
  float wave=sin(uTime*1.25+p.y*0.0026+p.x*0.0015);
  p+=(uHair+vec2(wave*uFlutter,0.0))*loose;
  return p;
}
void main(){
  vec2 p=deform(aPos); vUv=aPos/vec2(${TEX_W}.0,${TEX_H}.0);
  // held weapon: rigid, carried by the hand at the grip
  if(uWeaponN>1.5){
    float d=1e6;
    for(int i=0;i<7;i++){ if(float(i)>=uWeaponN-1.0) break; d=min(d,segDist(aPos,uWeapon[i],uWeapon[i+1])); }
    p=mix(p,aPos+deform(uWeaponGrip)-uWeaponGrip,1.0-smoothstep(uWeaponR,1.5*uWeaponR,d));
  }
  vec2 screen=uOrigin+p*uScale;
  gl_Position=vec4(screen/uCanvas*2.0-1.0,0.0,1.0); gl_Position.y=-gl_Position.y;
}`;
  // Blink: inside each eye box the upper band (skin + lash line) is stretched
  // down to the closing lid line; a soft shade keeps the lash edge dark.
  const FS=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex; uniform float uGlow; uniform vec3 uTint; uniform float uBlink;
uniform vec4 uEyeA; uniform vec3 uEyeA2; uniform vec4 uEyeB; uniform vec3 uEyeB2;
varying vec2 vUv;
vec2 lid(vec2 q, vec4 E, vec3 F, inout float shade){
  if(F.z<0.5||uBlink<0.002) return q;
  vec2 ax=vec2(cos(F.y),sin(F.y)), pr=vec2(-ax.y,ax.x);
  vec2 d=q-E.xy; float u=dot(d,ax), v=dot(d,pr);
  if(abs(u)>=E.z) return q;
  float e=sqrt(max(0.0,1.0-(u/E.z)*(u/E.z)));
  float top=-E.w*e, bot=F.x*e, m=0.55*E.w*e, k=0.40*E.w*e;
  float L=top+k+(bot-top-k)*uBlink;
  shade=max(shade,clamp(1.0-abs(v-(L-0.6))/1.4,0.0,1.0)*uBlink*0.5*clamp(e*3.0,0.0,1.0));
  if(v>=top-m&&v<L){ float nv=(top-m)+(v-(top-m))*(m+k)/(L-top+m); return E.xy+u*ax+nv*pr; }
  return q;
}
void main(){
  vec2 q=vUv*vec2(${TEX_W}.0,${TEX_H}.0); float shade=0.0;
  q=lid(q,uEyeA,uEyeA2,shade); q=lid(q,uEyeB,uEyeB2,shade);
  vec4 c=texture2D(uTex,q/vec2(${TEX_W}.0,${TEX_H}.0));
  if(c.a<0.003) discard;
  gl_FragColor=vec4(c.rgb*(1.0-shade)+uTint*uGlow*c.a,c.a);
}`;

  // ------------------------------------------------------------ motion
  function rng(seed){let s=(seed>>>0)||1;return()=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  function noise(seed){const r=rng(seed),table=Array.from({length:256},()=>r()*2-1);return t=>{const i=Math.floor(t),f=t-i,u=f*f*(3-2*f),a=table[i&255],b=table[(i+1)&255];return a+(b-a)*u}}
  const ease=x=>x*x*(3-2*x);
  // Breath: quicker inhale, slower exhale, eased at both ends; phase 0..1 → -.5..+.5.
  function breathCurve(phase){const p=((phase%1)+1)%1;return(p<.4?ease(p/.4):1-ease((p-.4)/.6))-.5}
  // Lid closure 0..1 at ms after a blink starts: fast close, short hold, slower open.
  const BLINK=Object.freeze({close:70,hold:45,open:125});
  function blinkCurve(ms){
    if(!(ms>=0))return 0;
    if(ms<BLINK.close)return ease(ms/BLINK.close);
    ms-=BLINK.close;if(ms<BLINK.hold)return 1;
    ms-=BLINK.hold;if(ms<BLINK.open){const x=1-ms/BLINK.open;return x*x}
    return 0;
  }
  // Critically damped spring (implicit, stable at any frame time).
  function damp(s,key,target,omega,dt){
    const x=s[key]||0,v=s[key+'V']||0,f=1+2*dt*omega,oo=omega*omega,hoo=dt*oo,hhoo=dt*hoo,det=1/(f+hhoo);
    s[key]=(f*x+dt*v+hhoo*target)*det;s[key+'V']=(v+hoo*(target-x))*det;
  }
  const LIMITS=Object.freeze({headRoll:.075,bodyRoll:.012,turn:1,hair:9});
  class Motion{
    constructor(seed=Date.now()){
      this.r=rng(seed);this.n=Array.from({length:6},(_,i)=>noise((seed>>>0)*31+i+1));
      this.s={yaw:0,pitch:0,roll:0,body:0,hairX:0,hairXV:0};
      this.t=0;this.gaze=[0,0];this.nextGaze=1+this.r()*2;
      this.tilt=0;this.tiltUntil=0;this.nextTilt=5+this.r()*6;
      this.blinkStart=-10;this.double=false;this.nextBlink=.8+this.r()*2.2;
      this.phase=this.r();this.rate=1/(3.9+this.r()*.6);this.sighAt=12+this.r()*10;this.sighCycle=-1;
      this.pointer=null;this.pointerAt=-10;this.kick=0;this.kickDir=1;
    }
    point(x,y){this.pointer=[x,y];this.pointerAt=this.t}
    blink(){this.blinkStart=this.t;this.double=this.r()<.18;this.nextBlink=this.t+2.4+this.r()*3.8}
    poke(strength=1){
      this.kickDir=this.r()<.5?-1:1;this.kick=Math.min(1.5,strength);
      this.s.rollV=(this.s.rollV||0)+this.kickDir*.28*this.kick;this.s.bodyV=(this.s.bodyV||0)+this.kickDir*.018*this.kick;
      this.s.hairXV+=this.kickDir*22*this.kick;this.gaze=[0,-.18];this.nextGaze=this.t+1.8;this.blink();
    }
    step(dt,calm=1,hair=1){
      dt=Math.max(0,Math.min(.05,dt));const t=this.t+=dt,s=this.s,n=this.n,r=this.r;
      // breathing, with an occasional deeper sigh cycle
      this.phase+=dt*this.rate;const cycle=Math.floor(this.phase);
      if(t>=this.sighAt&&this.sighCycle<cycle){this.sighCycle=cycle+1;this.sighAt=t+16+r()*12}
      const breath=(breathCurve(this.phase)+.5)*(cycle===this.sighCycle?1.8:1)-.5;
      // where to look: the pointer while it moves, otherwise idle glances
      if(this.pointer&&t-this.pointerAt<2.5){this.gaze=[Math.max(-1,Math.min(1,this.pointer[0]*1.2))*.7,Math.max(-1,Math.min(1,this.pointer[1]*1.2))*.45]}
      else if(t>=this.nextGaze){
        this.gaze=r()<.5?[(r()-.5)*.16,(r()-.5)*.12]:[(r()<.5?-1:1)*(.35+r()*.45),-.3+r()*.5];
        this.nextGaze=t+2.6+r()*4.2;if(r()<.4)this.blink();
      }
      if(t>=this.nextTilt&&calm>=1){this.tilt=(r()<.5?-1:1)*(.025+r()*.03);this.tiltUntil=t+1.4+r()*1.8;this.nextTilt=t+8+r()*9}
      if(t>=this.tiltUntil)this.tilt=0;
      damp(s,'yaw',this.gaze[0]+n[0](t*.35)*.08,5.5,dt);
      damp(s,'pitch',this.gaze[1]+n[1](t*.3)*.06,5,dt);
      damp(s,'roll',this.tilt+n[2](t*.22)*.012-s.yaw*.03,3.2,dt);
      damp(s,'body',n[3](t*.12)*.0045+s.yaw*.004+breath*.0012,2.2,dt);
      // hair pendulum driven by head / body motion plus a little wind
      const drive=-(s.rollV*30+s.bodyV*120+s.yawV*1.6),wind=n[4](t*.45)*1.3+n[5](t*1.1)*.35;
      const w=2*Math.PI*1.05;s.hairXV+=((wind+drive-s.hairX)*w*w-s.hairXV*2*.2*w)*dt;s.hairX+=s.hairXV*dt;
      if(t>=this.nextBlink)this.blink();
      const ms=(t-this.blinkStart)*1000;
      const clamp=(v,m)=>Math.max(-m,Math.min(m,v));
      return{
        breath:breath*calm,
        bodyRoll:clamp(s.body,LIMITS.bodyRoll)*calm,
        headRoll:clamp(s.roll,LIMITS.headRoll)*calm,
        turn:[clamp(s.yaw,LIMITS.turn)*calm,clamp(s.pitch,LIMITS.turn)*calm],
        hair:[clamp(s.hairX*hair,LIMITS.hair)*calm,clamp(s.hairX*hair*.15,LIMITS.hair)*calm],
        flutter:1.1*hair*calm,
        blink:Math.max(blinkCurve(ms),this.double?blinkCurve(ms-300):0)
      };
    }
  }

  function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader');return s}

  class LiveIllustration{
    constructor(host,options={}){
      this.host=host;this.options={heightScale:1.3,headY:.16,centerX:.5,maxScale:1.35,interactive:true,...options};
      this.canvas=document.createElement('canvas');this.canvas.className='live-illustration-canvas';this.canvas.setAttribute('aria-hidden','true');
      this.motion=new Motion((Math.random()*4294967296)>>>0);this.glow=0;
      this.rig=DEFAULT_RIG;this.ready=false;this.dead=false;this.raf=0;this.start=performance.now();
      const gl=this.canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true})||this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
      if(!gl)throw new Error('WebGL unavailable');
      this.gl=gl;this.isGL2=typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext;
      this.program=this.build();this.buildMesh();
      this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.fail('context-lost')});
      host.appendChild(this.canvas);
      // The pointer is read relative to the face so the head turns toward it.
      this.onMove=event=>{
        if(!this.ready||!this.origin)return;const r=root.TRIAD_LAYOUT?.rect?.(this.canvas)||this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;
        const point=root.TRIAD_LAYOUT?.point?.(event.clientX,event.clientY)||{x:event.clientX,y:event.clientY},sx=r.width/this.cssW,sy=r.height/this.cssH;
        const hx=r.left+(this.origin[0]+this.rig.head[0]*this.scale)*sx,hy=r.top+(this.origin[1]+this.rig.head[1]*this.scale)*sy;
        this.motion.point((point.x-hx)/(r.width*.5),(point.y-hy)/(r.height*.5));
      };
      this.onLeave=()=>{this.motion.pointerAt=-10};
      if(this.options.interactive){addEventListener('pointermove',this.onMove,{passive:true});document.addEventListener('pointerleave',this.onLeave)}
      this.resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.resize()):null;this.resizeObserver?.observe(host);
      this.loop=this.loop.bind(this);
    }
    build(){
      const gl=this.gl,program=gl.createProgram();
      gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'link');
      this.u={};for(const name of ['uCanvas','uOrigin','uScale','uHead','uNeck','uChest','uHip','uFeet','uBody','uBreath','uBodyRoll','uHeadRoll','uTurn','uHair','uTime','uFlutter','uTex','uGlow','uTint','uBlink','uEyeA','uEyeA2','uEyeB','uEyeB2','uWeapon','uWeaponN','uWeaponR','uWeaponGrip'])this.u[name]=gl.getUniformLocation(program,name);
      return program;
    }
    buildMesh(){
      const gl=this.gl,verts=[],idx=[];
      for(let y=0;y<=GRID_Y;y++)for(let x=0;x<=GRID_X;x++)verts.push(x/GRID_X*TEX_W,y/GRID_Y*TEX_H);
      for(let y=0;y<GRID_Y;y++)for(let x=0;x<GRID_X;x++){const a=y*(GRID_X+1)+x,b=a+1,c=a+GRID_X+1,d=c+1;idx.push(a,b,c,b,d,c)}
      this.vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
      this.ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);this.count=idx.length;
    }
    setSource(src,characterId,tint='#ffffff'){
      if(this.dead)return Promise.resolve(false);
      this.rig={...DEFAULT_RIG,...(RIGS[characterId]||{})};this.characterId=characterId;
      const path=(this.rig.weapon?.path||[]).slice(0,8);this.weaponPath=new Float32Array(16);path.forEach(([x,y],i)=>{this.weaponPath[i*2]=x;this.weaponPath[i*2+1]=y});this.weaponCount=path.length>1?path.length:0;
      const hex=String(tint).replace('#','');this.tint=[0,2,4].map(i=>parseInt(hex.slice(i,i+2)||'ff',16)/255);
      const token=this.token=(this.token||0)+1;
      return new Promise(resolve=>{
        const image=new Image();image.decoding='async';
        image.onload=()=>{if(this.dead||token!==this.token){resolve(false);return}this.upload(image);this.ready=true;this.canvas.dataset.liveCharacter=characterId;this.host.classList.add('live-ready');this.glow=1;this.resize();this.play();resolve(true)};
        image.onerror=()=>{this.fail('image');resolve(false)};
        image.src=src;
      });
    }
    upload(image){
      const gl=this.gl;if(this.texture)gl.deleteTexture(this.texture);
      this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(this.isGL2){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR)}else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    }
    resize(){
      const w=Math.min(1920,this.host.clientWidth),h=Math.min(1080,this.host.clientHeight);if(!w||!h)return;
      const dpr=root.TRIAD_LAYOUT?.density?.()||1;this.cssW=w;this.cssH=h;
      this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.dpr=dpr;
      // Frame the figure by head-to-feet height so every pose sits the same way.
      const rig=this.rig,o=this.options,span=Math.max(rig.feetSpan||0,rig.feet-rig.head[1],900);
      const scale=Math.min(h*o.heightScale/span,h*o.maxScale/TEX_H*1.2);
      this.scale=scale;this.origin=[w*o.centerX-rig.hip[0]*scale,h*o.headY-rig.head[1]*scale];
    }
    figureRect(){if(!this.ready)return null;const s=this.scale;return{x:this.origin[0],y:this.origin[1],width:TEX_W*s,height:TEX_H*s,head:[this.origin[0]+this.rig.head[0]*s,this.origin[1]+this.rig.head[1]*s],chest:[this.origin[0]+this.rig.chest[0]*s,this.origin[1]+this.rig.chest[1]*s]}}
    poke(strength=1){this.motion.poke(strength);this.glow=Math.max(this.glow,.55)}
    play(){if(!this.raf&&!this.dead)this.raf=requestAnimationFrame(this.loop)}
    pause(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0}
    loop(now){
      this.raf=0;if(this.dead)return;
      const visible=!document.hidden&&this.canvas.isConnected&&this.host.offsetParent!==null;
      // A picture that loaded while its host was hidden has no layout yet.
      if(visible&&this.ready&&!this.origin)this.resize();
      if(visible&&this.ready&&this.origin)this.draw(now);else this.last=0;
      this.raf=requestAnimationFrame(this.loop);
    }
    draw(now){
      const gl=this.gl,rig=this.rig,dt=this.last?(now-this.last)/1000:0;this.last=now;
      const m=this.motion.step(dt,reducedMotion()?.35:1,rig.hair);
      this.glow=Math.max(0,this.glow-dt*1.6);
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);const loc=gl.getAttribLocation(this.program,'aPos');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibo);
      const u=this.u,d=this.dpr;
      gl.uniform2f(u.uCanvas,this.canvas.width,this.canvas.height);gl.uniform2f(u.uOrigin,this.origin[0]*d,this.origin[1]*d);gl.uniform1f(u.uScale,this.scale*d);
      gl.uniform2f(u.uHead,rig.head[0],rig.head[1]);gl.uniform2f(u.uNeck,rig.neck[0],rig.neck[1]);gl.uniform2f(u.uChest,rig.chest[0],rig.chest[1]);gl.uniform2f(u.uHip,rig.hip[0],rig.hip[1]);
      gl.uniform1f(u.uFeet,rig.feet);gl.uniform1f(u.uBody,rig.body);
      gl.uniform1f(u.uBreath,m.breath);gl.uniform1f(u.uBodyRoll,m.bodyRoll);gl.uniform1f(u.uHeadRoll,m.headRoll);
      gl.uniform2f(u.uTurn,m.turn[0],m.turn[1]);gl.uniform2f(u.uHair,m.hair[0],m.hair[1]);
      gl.uniform1f(u.uTime,this.motion.t);gl.uniform1f(u.uFlutter,m.flutter);
      const eyes=rig.eyes||[],eye=(i,a,b)=>{const e=eyes[i];if(e){gl.uniform4f(a,e[0],e[1],e[2],e[3]);gl.uniform3f(b,e[4],e[5],1)}else{gl.uniform4f(a,0,0,1,1);gl.uniform3f(b,1,0,0)}};
      eye(0,u.uEyeA,u.uEyeA2);eye(1,u.uEyeB,u.uEyeB2);gl.uniform1f(u.uBlink,m.blink);
      gl.uniform1f(u.uWeaponN,this.weaponCount||0);
      if(this.weaponCount){const w=rig.weapon;gl.uniform2fv(u.uWeapon,this.weaponPath);gl.uniform1f(u.uWeaponR,w.radius);gl.uniform2f(u.uWeaponGrip,w.grip[0],w.grip[1])}
      gl.uniform1f(u.uGlow,this.glow*.18);gl.uniform3f(u.uTint,this.tint?.[0]??1,this.tint?.[1]??1,this.tint?.[2]??1);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(u.uTex,0);
      gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);
    }
    fail(reason){this.canvas.dataset.liveFailure=reason;this.host.classList.remove('live-ready');this.destroy()}
    destroy(){
      if(this.dead)return;this.dead=true;this.pause();this.resizeObserver?.disconnect();
      removeEventListener('pointermove',this.onMove);document.removeEventListener('pointerleave',this.onLeave);
      try{const gl=this.gl;if(this.texture)gl.deleteTexture(this.texture);gl.deleteBuffer(this.vbo);gl.deleteBuffer(this.ibo);gl.deleteProgram(this.program);gl.getExtension('WEBGL_lose_context')?.loseContext()}catch{}
      this.canvas.remove();this.host.classList.remove('live-ready');
    }
  }

  function create(host,options){try{return new LiveIllustration(host,options)}catch(error){console.warn('TRIAD_LIVE_ILLUSTRATION_UNAVAILABLE',error?.message||error);return null}}
  root.TRIAD_LIVE_ILLUSTRATION=Object.freeze({version:VERSION,RIGS,LIMITS,BLINK,create,Motion,breathCurve,blinkCurve});
})(globalThis);
