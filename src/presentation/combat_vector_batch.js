/* Rasterize each authored particle appearance once. Animate the same CSS
   keyframes on two shared screen surfaces, with one parent filter per burst. */
(function(root){
  'use strict';
  const math=root.TRIAD_VFX_RASTER?.animationMath;if(!math)return;
  const cache=new Map(),groups=new Set(),surfaces=new Map(),warmed=new Set(),pending=new Set(),pendingVisibility=new Map(),metrics={frames:0,draws:0,prepared:0,bytes:0,reservedCount:0,reservedBytes:0,filterPixels:0,filterEnvelopePixels:0,errors:[]};
  let collectRaf=0,uploadRaf=0;const uploads=[];
  const introReserved=new WeakSet(),introWarmRecords=new WeakMap();let introTimer=0,introRaf=0,introReservation=null,introWarm=null,warmRaf=0,warmGeneration=0;
  let frameTime=0,raf=0,nextPaint=0,stage=null,resize=null,unavailable=false,warmTimer=0;
  const viewport={w:0,h:0,dpr:1},MAX_BYTES=64*1024*1024;
  const paintFps=root.TRIAD_QA_VECTOR_FPS||60;
  const recipes=new Map(),rootRecipes=new Map(),keyframes=new Map(),motionTemplates=new Map();
  function sceneDimensions(node){
    const rect=root.TRIAD_LAYOUT?.rect(node)||node.getBoundingClientRect?.()||{width:node.clientWidth,height:node.clientHeight},w=Math.max(0,Number(rect.width)||0),h=Math.max(0,Number(rect.height)||0);
    const density=root.TRIAD_LAYOUT?.density?.()??Math.min(1,root.devicePixelRatio||1),dpr=Math.min(1,Math.max(.01,Number(density)||1),1920/Math.max(1,w),1080/Math.max(1,h));
    return{w,h,dpr,width:Math.max(1,Math.min(1920,Math.round(w*dpr))),height:Math.max(1,Math.min(1080,Math.round(h*dpr)))};
  }
  function gpuRenderer(canvas){
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false});if(!gl)throw Error('Vector WebGL unavailable');
    const vertex='attribute vec2 p;attribute vec2 uv;attribute float alpha;uniform vec2 size;varying vec2 v;varying float a;void main(){gl_Position=vec4(p.x/size.x*2.0-1.0,1.0-p.y/size.y*2.0,0.0,1.0);v=uv;a=alpha;}';
    function program(fragment){const shaders=[gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].map((type,i)=>{const s=gl.createShader(type);gl.shaderSource(s,i?fragment:vertex);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;});const p=gl.createProgram();shaders.forEach(s=>gl.attachShader(p,s));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return{p,shaders,position:gl.getAttribLocation(p,'p'),uv:gl.getAttribLocation(p,'uv'),alpha:gl.getAttribLocation(p,'alpha'),size:gl.getUniformLocation(p,'size'),uniforms:Object.fromEntries(['image','shadow','step','centre','weights','offsets','count','colour','shift','mask','maskBox','maskUV','extent','origin','pixelU','pixelV','region'].map(name=>[name,gl.getUniformLocation(p,name)]))};}
    const imageProgram=program('precision highp float;uniform sampler2D image;varying vec2 v;varying float a;void main(){gl_FragColor=texture2D(image,v)*a;}');
    const clipProgram=program('precision highp float;uniform sampler2D image;uniform sampler2D mask;uniform vec4 maskBox;uniform vec4 maskUV;uniform vec2 extent;uniform vec2 origin;uniform vec2 pixelU;uniform vec2 pixelV;varying vec2 v;varying float a;vec4 covered(vec2 q){vec2 local=vec2(q.x,1.0-q.y)*extent+origin;vec2 uv=(local-maskBox.xy)/maskBox.zw;float coverage=0.0;if(uv.x>=0.0&&uv.y>=0.0&&uv.x<=1.0&&uv.y<=1.0)coverage=texture2D(mask,maskUV.xy+uv*maskUV.zw).a;return texture2D(image,q)*coverage;}void main(){vec4 value=vec4(0.0);for(int y=0;y<4;y++)for(int x=0;x<4;x++)value+=covered(v+pixelU*((float(x)+0.5)/4.0-0.5)+pixelV*((float(y)+0.5)/4.0-0.5));gl_FragColor=value*(a/16.0);}');
    const areaProgram=program('precision highp float;uniform sampler2D image;uniform vec2 pixelU;uniform vec2 pixelV;uniform vec4 region;varying vec2 v;varying float a;vec4 tex(vec2 q){if(q.x<region.x||q.y<region.y||q.x>region.x+region.z||q.y>region.y+region.w)return vec4(0.0);return texture2D(image,q);}void main(){vec4 value=vec4(0.0);for(int y=0;y<4;y++)for(int x=0;x<4;x++)value+=tex(v+pixelU*((float(x)+0.5)/4.0-0.5)+pixelV*((float(y)+0.5)/4.0-0.5));gl_FragColor=value*(a/16.0);}');
    const blurPrograms=new Map();
    function blurProgramFor(count){
      if(!blurPrograms.has(count))blurPrograms.set(count,program(`precision highp float;uniform sampler2D image;uniform vec2 step;uniform float centre;uniform float weights[${count}];uniform float offsets[${count}];varying vec2 v;varying float a;void main(){vec4 value=texture2D(image,v)*centre;for(int i=0;i<${count};i++){vec2 d=step*offsets[i];value+=(texture2D(image,v+d)+texture2D(image,v-d))*weights[i];}gl_FragColor=value;}`));
      return blurPrograms.get(count);
    }
    const shadowProgram=program('precision highp float;uniform sampler2D image;uniform sampler2D shadow;uniform vec4 colour;uniform vec2 shift;varying vec2 v;varying float a;void main(){vec4 source=texture2D(image,v);float alpha=texture2D(shadow,v-shift).a*colour.a;gl_FragColor=source+vec4(colour.rgb*alpha,alpha)*(1.0-source.a);}');
    const buffer=gl.createBuffer(),quadData=new Float32Array(30),spriteData=new Float32Array(30*256),atlasSize=viewport.dpr>1?2048:1024,atlases=[],kernels=new Map(),pool=[];let slots=new WeakMap(),allocated=0,verifyTargets=true,liveBytes=0,poolBytes=0,peakBytes=0;const maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE),poolLimit=64*1024*1024;
    function texture(w,h){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const [name,value]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,name,value);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t;}
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    function slot(entry){
      const old=slots.get(entry);if(old&&old.generation===old.atlas.generation){old.atlas.lastUsed=frameTime;return old;}
      const w=entry.canvas.width,h=entry.canvas.height;if(w+2>atlasSize||h+2>atlasSize)throw Error('Particle exceeds atlas extent');
      let atlas=atlases.find(a=>a.x+w+2<=atlasSize&&a.y+Math.max(a.row,h+2)<=atlasSize);
      if(!atlas){atlas=atlases.find(a=>a.y+a.row+h+2<=atlasSize);if(atlas){atlas.x=1;atlas.y+=atlas.row;atlas.row=0;}}
      if(!atlas){
        if(atlases.length>=8){
          const active=new Set([...groups].flatMap(g=>[...g.parts.map(p=>p.image),g.mask]));
          atlas=atlases.filter(a=>[...a.entries].every(e=>!active.has(e))).sort((a,b)=>a.lastUsed-b.lastUsed)[0];
          if(!atlas)throw Error('Active particles exceed GPU atlas budget');
          atlas.generation++;atlas.entries.clear();gl.bindTexture(gl.TEXTURE_2D,atlas.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,atlasSize,atlasSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
          atlases.splice(atlases.indexOf(atlas),1);atlases.push(atlas);Object.assign(atlas,{x:1,y:1,row:0});
        }else{atlas={texture:texture(atlasSize,atlasSize),x:1,y:1,row:0,generation:0,entries:new Set()};atlases.push(atlas);}
      }
      const s={texture:atlas.texture,atlas,generation:atlas.generation,x:atlas.x,y:atlas.y,w,h};gl.bindTexture(gl.TEXTURE_2D,s.texture);gl.texSubImage2D(gl.TEXTURE_2D,0,s.x,s.y,gl.RGBA,gl.UNSIGNED_BYTE,entry.canvas);atlas.x+=w+2;atlas.row=Math.max(atlas.row,h+2);atlas.lastUsed=frameTime;atlas.entries.add(entry);slots.set(entry,s);return s;
    }
    function quad(data,offset,w,h,m,x,y,u0,v0,u1,v1,alpha=1){let i=offset;for(const [u,v]of [[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]]){const px=x+u*w,py=y+v*h;data[i++]=m.a*px+m.c*py+m.e;data[i++]=m.b*px+m.d*py+m.f;data[i++]=u0+u*(u1-u0);data[i++]=v0+v*(v1-v0);data[i++]=alpha;}return i;}
    function use(p,w,h,data,vertices){gl.useProgram(p.p);gl.uniform2f(p.size,w,h);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);if(data.byteLength>allocated){allocated=Math.max(allocated*2,data.byteLength,4096);gl.bufferData(gl.ARRAY_BUFFER,allocated,gl.DYNAMIC_DRAW);}gl.bufferSubData(gl.ARRAY_BUFFER,0,data);for(const [location,n,offset]of [[p.position,2,0],[p.uv,2,8],[p.alpha,1,16]])if(location>=0){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,n,gl.FLOAT,false,20,offset);}gl.viewport(0,0,w,h);}
    function target(group,index){gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,index===null?null:group.gpu.framebuffers[index]);gl.viewport(0,0,index===null?canvas.width:group.buffer.width,index===null?canvas.height:group.buffer.height);}
    function clear(){gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
    function allocate(group){
      if(group.gpu)return;const w=Math.ceil(group.buffer.width/32)*32,h=Math.ceil(group.buffer.height/32)*32;
      if(w>maxTextureSize||h>maxTextureSize)throw Error('Vector envelope exceeds GPU extent');
      const index=pool.findIndex(p=>p.w===w&&p.h===h);let entry;
      if(index>=0){entry=pool.splice(index,1)[0];poolBytes-=entry.bytes;}
      else{const textures=Array.from({length:3},()=>texture(w,h)),framebuffers=textures.map(t=>{const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(verifyTargets&&gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Vector framebuffer incomplete');return f;});entry={textures,framebuffers,w,h,bytes:w*h*12};}
      group.buffer={width:w,height:h};group.gpu=entry;liveBytes+=entry.bytes;peakBytes=Math.max(peakBytes,liveBytes+poolBytes);
    }
    function reserve(width,height,availableBytes){
      const w=Math.ceil(width/32)*32,h=Math.ceil(height/32)*32,bytes=w*h*12;
      if(!Number.isFinite(bytes)||w<=0||h<=0||w>maxTextureSize||h>maxTextureSize||bytes>availableBytes||poolBytes+bytes>poolLimit||pool.some(p=>p.w===w&&p.h===h))return 0;
      const group={buffer:{width:w,height:h}};let cleared=false;
      try{allocate(group);gl.clearColor(0,0,0,0);for(let i=0;i<3;i++){target(group,i);gl.clear(gl.COLOR_BUFFER_BIT);}cleared=true;}
      finally{target(group,null);drop(group,cleared);}
      return bytes;
    }
    const identity={a:1,b:0,c:0,d:1,e:0,f:0};
    // Rectangles use the same top-down pixel coordinates as sprite vertices.
    // null is empty; undefined preserves full-envelope rendering if uncertain.
    function boundedRect(rect,w,h){
      if(rect===null)return null;if(!rect||![rect.left,rect.top,rect.right,rect.bottom].every(Number.isFinite))return undefined;
      const left=Math.max(0,Math.floor(rect.left)),top=Math.max(0,Math.floor(rect.top)),right=Math.min(w,Math.ceil(rect.right)),bottom=Math.min(h,Math.ceil(rect.bottom));
      return right>left&&bottom>top?{left,top,right,bottom}:null;
    }
    function expandedRect(rect,x,y,w,h){return rect?boundedRect({left:rect.left-x,top:rect.top-y,right:rect.right+x,bottom:rect.bottom+y},w,h):rect;}
    function shadowRect(source,blurred,x,y,w,h){
      if(source===undefined||blurred===undefined)return undefined;
      const moved=blurred?{left:blurred.left+x,top:blurred.top+y,right:blurred.right+x,bottom:blurred.bottom+y}:null;
      const union=source&&moved?{left:Math.min(source.left,moved.left),top:Math.min(source.top,moved.top),right:Math.max(source.right,moved.right),bottom:Math.max(source.bottom,moved.bottom)}:source||moved;
      return expandedRect(union,2,2,w,h);
    }
    function fullQuad(group,p,index,source,rect){
      const w=group.buffer.width,h=group.buffer.height;target(group,index);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);quad(quadData,0,w,h,identity,0,0,0,1,1,0);use(p,w,h,quadData,6);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,group.gpu.textures[source]);gl.uniform1i(p.uniforms.image,0);gl.disable(gl.BLEND);
      const bounds=root.TRIAD_QA_VECTOR_FULL_FILTERS?undefined:boundedRect(rect,w,h);metrics.filterEnvelopePixels+=w*h;
      if(bounds===null)return false;
      if(bounds){gl.enable(gl.SCISSOR_TEST);gl.scissor(bounds.left,h-bounds.bottom,bounds.right-bounds.left,bounds.bottom-bounds.top);metrics.filterPixels+=(bounds.right-bounds.left)*(bounds.bottom-bounds.top);}else metrics.filterPixels+=w*h;
      return true;
    }
    function kernel(sigma){if(kernels.has(sigma))return kernels.get(sigma);const radius=Math.ceil(sigma*3),raw=Array.from({length:radius+1},(_,i)=>Math.exp(-i*i/(2*sigma*sigma))),total=raw[0]+2*raw.slice(1).reduce((n,x)=>n+x,0),weights=new Float32Array(96),offsets=new Float32Array(96);let count=0;for(let i=1;i<=radius;i+=2){if(count===96)throw Error('Vector filter exceeds Gaussian extent');const sum=raw[i]+(raw[i+1]||0);weights[count]=sum/total;offsets[count]=(raw[i]*i+(raw[i+1]||0)*(i+1))/sum;count++;}const value={centre:raw[0]/total,weights,offsets,count};kernels.set(sigma,value);return value;}
    function blur(group,source,sigma){const free=[0,1,2].filter(i=>i!==source),k=kernel(sigma),p=blurProgramFor(k.count),w=group.buffer.width,h=group.buffer.height,radius=Math.ceil(sigma*3)+2;for(const [from,to,dx,dy]of [[source,free[0],1/w,0],[free[0],free[1],0,1/h]]){const rect=expandedRect(group.gpu.rects[from],dx?radius:0,dy?radius:0,w,h),draw=fullQuad(group,p,to,from,rect);gl.uniform2f(p.uniforms.step,dx,dy);gl.uniform1f(p.uniforms.centre,k.centre);gl.uniform1fv(p.uniforms.weights,k.weights.subarray(0,k.count));gl.uniform1fv(p.uniforms.offsets,k.offsets.subarray(0,k.count));if(draw)gl.drawArrays(gl.TRIANGLES,0,6);group.gpu.rects[to]=rect;}return free[1];}
    function colour(value){const match=/^rgba?\(([^)]+)\)$/.exec(value);if(!match)throw Error('Unsupported particle filter colour '+value);const n=match[1].split(',').map(Number);return[n[0]/255,n[1]/255,n[2]/255,n[3]??1];}
    function filters(value){if(value==='none')return[];const parts=[];let depth=0,start=0;for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')'&&!--depth){parts.push(value.slice(start,i+1).trim());start=i+1;}}return parts.map(part=>{if(part.startsWith('blur('))return{type:'blur',sigma:parseFloat(part.slice(5))};const match=/^drop-shadow\((rgba?\([^)]+\))\s+([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\)$/.exec(part);if(!match)throw Error('Unsupported particle filter '+part);return{type:'shadow',colour:colour(match[1]),x:Number(match[2]),y:Number(match[3]),sigma:Number(match[4])};});}
    function draw(group,parentValue){
      if(group.direct){
        const p=group.parent,m=parentValue.matrix,[ox,oy]=p.s.origin,d=viewport.dpr,image=group.parts[1].image,tile=slot(image),world={a:m.a*d,b:m.b*d,c:m.c*d,d:m.d*d,e:(p.s.left+ox+m.e-m.a*ox-m.c*oy)*d,f:(p.s.top+oy+m.f-m.b*ox-m.d*oy)*d},det=world.a*world.d-world.b*world.c;
        target(group,null);quad(quadData,0,tile.w/image.dpr,tile.h/image.dpr,world,-image.pad,-image.pad,tile.x/atlasSize,tile.y/atlasSize,(tile.x+tile.w)/atlasSize,(tile.y+tile.h)/atlasSize,parentValue.opacity);use(areaProgram,canvas.width,canvas.height,quadData,6);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tile.texture);gl.uniform1i(areaProgram.uniforms.image,0);gl.uniform4f(areaProgram.uniforms.region,tile.x/atlasSize,tile.y/atlasSize,tile.w/atlasSize,tile.h/atlasSize);
        gl.uniform2f(areaProgram.uniforms.pixelU,world.d/det*image.dpr/atlasSize,-world.b/det*image.dpr/atlasSize);gl.uniform2f(areaProgram.uniforms.pixelV,-world.c/det*image.dpr/atlasSize,world.a/det*image.dpr/atlasSize);
        gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_COLOR);gl.drawArrays(gl.TRIANGLES,0,6);metrics.draws++;return;
      }
      allocate(group);const bufferDpr=group.dpr||viewport.dpr,fullFilters=Boolean(root.TRIAD_QA_VECTOR_FULL_FILTERS);if(group.fullFilters!==fullFilters){delete group.filteredSource;group.fullFilters=fullFilters;}let source=group.filteredSource;
      if(source===undefined){target(group,0);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);let used=0,current=null,sourceRect=null,uncertainRect=false;
      const submit=()=>{if(!used)return;use(imageProgram,group.buffer.width,group.buffer.height,spriteData.subarray(0,used),used/5);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,current);gl.uniform1i(imageProgram.uniforms.image,0);gl.drawArrays(gl.TRIANGLES,0,used/5);used=0;};
      for(const p of group.parts.slice(1)){const value=sample(p);if(!value||value.opacity<.002)continue;const tile=slot(p.image);if(current!==tile.texture||used+30>spriteData.length){submit();current=tile.texture;}const m=value.matrix,[ox,oy]=p.s.origin,d=bufferDpr,world={a:m.a*d,b:m.b*d,c:m.c*d,d:m.d*d,e:(p.s.left+ox+m.e-m.a*ox-m.c*oy-group.x)*d,f:(p.s.top+oy+m.f-m.b*ox-m.d*oy-group.y)*d},start=used;used=quad(spriteData,used,tile.w/(p.image.dpr||d),tile.h/(p.image.dpr||d),world,-p.image.pad,-p.image.pad,tile.x/atlasSize,tile.y/atlasSize,(tile.x+tile.w)/atlasSize,(tile.y+tile.h)/atlasSize,value.opacity);
        for(let i=start;i<used;i+=5){const x=spriteData[i],y=spriteData[i+1];if(!Number.isFinite(x)||!Number.isFinite(y)){uncertainRect=true;continue;}if(sourceRect){sourceRect.left=Math.min(sourceRect.left,x-2);sourceRect.top=Math.min(sourceRect.top,y-2);sourceRect.right=Math.max(sourceRect.right,x+2);sourceRect.bottom=Math.max(sourceRect.bottom,y+2);}else sourceRect={left:x-2,top:y-2,right:x+2,bottom:y+2};}metrics.draws++;}submit();
      group.gpu.rects??=[];group.gpu.rects[0]=uncertainRect?undefined:boundedRect(sourceRect,group.buffer.width,group.buffer.height);
      source=0;group.gpu.filters??=filters(group.parent.s.filter);
      for(const filter of group.gpu.filters){const original=source;source=blur(group,source,Math.max(.001,filter.sigma*bufferDpr));if(filter.type==='shadow'){const destination=[0,1,2].find(i=>i!==source&&i!==original),rect=shadowRect(group.gpu.rects[original],group.gpu.rects[source],filter.x*bufferDpr,filter.y*bufferDpr,group.buffer.width,group.buffer.height),draw=fullQuad(group,shadowProgram,destination,original,rect);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,group.gpu.textures[source]);gl.uniform1i(shadowProgram.uniforms.shadow,1);gl.uniform4fv(shadowProgram.uniforms.colour,filter.colour);gl.uniform2f(shadowProgram.uniforms.shift,filter.x*bufferDpr/group.buffer.width,-filter.y*bufferDpr/group.buffer.height);if(draw)gl.drawArrays(gl.TRIANGLES,0,6);group.gpu.rects[destination]=rect;source=destination;}}
      // Static local appearances retain the exact filtered pixels. Only their
      // authored parent transform/opacity changes during subsequent paints.
      if(group.parts.slice(1).every(p=>!p.state))group.filteredSource=source;
      }
      const p=group.parent,m=parentValue.matrix,[ox,oy]=p.s.origin,d=viewport.dpr,world={a:m.a*d,b:m.b*d,c:m.c*d,d:m.d*d,e:(p.s.left+ox+m.e-m.a*ox-m.c*oy)*d,f:(p.s.top+oy+m.f-m.b*ox-m.d*oy)*d},output=group.mask?clipProgram:imageProgram,tile=group.mask?slot(group.mask):null;
      target(group,null);quad(quadData,0,group.buffer.width/bufferDpr,group.buffer.height/bufferDpr,world,group.x,group.y,0,1,1,0,parentValue.opacity);use(output,canvas.width,canvas.height,quadData,6);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,group.gpu.textures[source]);gl.uniform1i(output.uniforms.image,0);
      if(tile){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tile.texture);gl.uniform1i(output.uniforms.mask,1);gl.uniform4f(output.uniforms.maskBox,-group.mask.pad,-group.mask.pad,tile.w/group.mask.dpr,tile.h/group.mask.dpr);gl.uniform4f(output.uniforms.maskUV,tile.x/atlasSize,tile.y/atlasSize,tile.w/atlasSize,tile.h/atlasSize);gl.uniform2f(output.uniforms.extent,group.buffer.width/bufferDpr,group.buffer.height/bufferDpr);gl.uniform2f(output.uniforms.origin,group.x,group.y);const sx=group.buffer.width/bufferDpr,sy=group.buffer.height/bufferDpr,A=world.a*sx,B=world.b*sx,C=-world.c*sy,D=-world.d*sy,det=A*D-B*C;gl.uniform2f(output.uniforms.pixelU,D/det,-B/det);gl.uniform2f(output.uniforms.pixelV,-C/det,A/det);}
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_COLOR);gl.drawArrays(gl.TRIANGLES,0,6);metrics.draws++;
    }
    function release(entry){entry.textures.forEach(t=>gl.deleteTexture(t));entry.framebuffers.forEach(f=>gl.deleteFramebuffer(f));}
    function drop(group,keep=true){delete group.filteredSource;if(!group.gpu)return;const entry=group.gpu;group.gpu=null;delete entry.filters;delete entry.rects;liveBytes-=entry.bytes;if(keep&&entry.bytes<=poolLimit){pool.push(entry);poolBytes+=entry.bytes;}else release(entry);while(poolBytes>poolLimit){const old=pool.shift();poolBytes-=old.bytes;release(old);}}
    function reset(){for(const atlas of atlases)gl.deleteTexture(atlas.texture);atlases.length=0;slots=new WeakMap();for(const entry of pool)release(entry);pool.length=0;poolBytes=0;}
    function destroy(){reset();gl.deleteBuffer(buffer);for(const p of [imageProgram,clipProgram,areaProgram,...blurPrograms.values(),shadowProgram]){gl.deleteProgram(p.p);p.shaders.forEach(s=>gl.deleteShader(s));}blurPrograms.clear();}
    function read(group){target(group,0);const w=group.buffer.width,h=group.buffer.height,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const c=document.createElement('canvas');c.width=w;c.height=h;const data=c.getContext('2d').createImageData(w,h);for(let y=0;y<h;y++)data.data.set(pixels.subarray((h-y-1)*w*4,(h-y)*w*4),y*w*4);c.getContext('2d').putImageData(data,0,0);return{image:c.toDataURL(),error:gl.getError(),x:group.x,y:group.y,w,h};}
    const source=document.createElement('canvas');source.width=source.height=1;source.getContext('2d',{willReadFrequently:true}).fillRect(0,0,1,1);
    const style={left:0,top:0,origin:[0,0],transform:'none',opacity:1,filter:'blur(2px) drop-shadow(rgb(255, 255, 255) 0px 0px 2px)'},primer={buffer:{width:16,height:16},x:0,y:0,parent:{s:style},parts:[{s:style},{s:style,image:{canvas:source,pad:0}}]};
    draw(primer,{matrix:new DOMMatrix(),opacity:1});primer.mask={canvas:source,pad:0,dpr:1};draw(primer,{matrix:new DOMMatrix(),opacity:1});primer.direct=true;primer.parts[1].image.dpr=1;draw(primer,{matrix:new DOMMatrix(),opacity:1});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));drop(primer);clear();verifyTargets=false;
    function prepareFilters(value,dpr){
      if(groups.size||pending.size)return;
      const missing=filters(value).filter(f=>!blurPrograms.has(kernel(Math.max(.001,f.sigma*dpr)).count));if(!missing.length)return;
      const group={buffer:{width:16,height:16},x:0,y:0,parent:{s:{...style,filter:'none'}},parts:primer.parts};
      try{allocate(group);for(const f of missing){draw(group,{matrix:new DOMMatrix(),opacity:1});blur(group,0,Math.max(.001,f.sigma*dpr));}gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));}
      finally{drop(group);clear();}
    }
    return{clear,draw,drop,read,reserve,prepareFilters,upload:slot,reset,destroy,snapshot:()=>({atlasBytes:atlases.length*atlasSize*atlasSize*4,liveBytes,poolBytes,peakBytes,atlases:atlases.length,poolEntries:pool.length,blurPrograms:blurPrograms.size})};
  }
  for(const sheet of document.styleSheets)try{(function visit(rules){for(const rule of rules){if(rule.type===7)keyframes.set(rule.name,[...rule.cssRules]);else if(rule.cssRules)visit(rule.cssRules);}})(sheet.cssRules);}catch{}
  const pauseStyle=document.createElement('style');pauseStyle.textContent='[data-vector-batch="CACHED_CSS"],[data-vector-batch="CACHED_CSS"]::before,[data-vector-batch="CACHED_CSS"]::after,[data-vector-batch="CACHED_CSS"]>.battle-vfx-fragment,[data-vector-batch="CACHED_CSS"]>.battle-vfx-charge-mote,[data-vector-batch="CACHED_CSS"]>.battle-vfx-afterglow-mote{animation-play-state:paused!important}'+'[data-vector-children="CACHED_CSS"]>.battle-vfx-fragment,[data-vector-children="CACHED_CSS"]>.battle-vfx-charge-mote,[data-vector-children="CACHED_CSS"]>.battle-vfx-afterglow-mote{animation:none!important}';document.head.appendChild(pauseStyle);
  const kinds=['appendCombatVfxCharge','appendCombatVfxWake','appendCombatVfxPreflash','appendCombatVfxAfterglow','appendCombatVfxImpactBurst'];
  function split(value,delimiter=','){
    const parts=[];let depth=0,start=0;for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')')depth--;if(value[i]===delimiter&&!depth){parts.push(value.slice(start,i).trim());start=i+1;}}
    parts.push(value.slice(start).trim());return parts;
  }
  const length=(s,size)=>String(s).includes('%')?parseFloat(s)*size/100:parseFloat(s)||0;
  function styleData(node,pseudo){
    const s=getComputedStyle(node,pseudo),content=s.boxSizing!=='border-box',w=parseFloat(s.width)+(content?['borderLeftWidth','borderRightWidth','paddingLeft','paddingRight'].reduce((n,k)=>n+(parseFloat(s[k])||0),0):0),h=parseFloat(s.height)+(content?['borderTopWidth','borderBottomWidth','paddingTop','paddingBottom'].reduce((n,k)=>n+(parseFloat(s[k])||0),0):0);
    return{w,h,left:parseFloat(s.left)||0,top:parseFloat(s.top)||0,origin:s.transformOrigin.split(' ').map(parseFloat),transform:s.transform,opacity:Number(s.opacity),filter:s.filter,
      background:s.backgroundImage,colour:s.backgroundColor,clip:s.clipPath,shadow:s.boxShadow,
      radii:['TopLeft','TopRight','BottomRight','BottomLeft'].map(k=>s['border'+k+'Radius']),borderWidth:parseFloat(s.borderTopWidth)||0,borderColour:s.borderTopColor,borderStyle:s.borderTopStyle,
      animationName:s.animationName,animationDuration:parseFloat(s.animationDuration)*1000,animationDelay:parseFloat(s.animationDelay)*1000,animationEasing:s.animationTimingFunction,content:pseudo?s.content:null};
  }
  function shape(ctx,s,spread=0){
    const radii=s.radii.map(v=>{const [x,y=x]=v.split(' ');return{x:Math.max(0,length(x,s.w)+spread),y:Math.max(0,length(y,s.h)+spread)}});
    ctx.beginPath();ctx.roundRect(-spread,-spread,s.w+spread*2,s.h+spread*2,radii);
  }
  function clip(ctx,s){
    if(!s.clip.startsWith('polygon('))return;
    const points=split(s.clip.slice(8,-1)).map(p=>p.split(/\s+/));ctx.beginPath();points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](length(x,s.w),length(y,s.h)));ctx.closePath();ctx.clip();
  }
  function background(ctx,s){
    if(s.background==='none')return s.colour;
    const type=s.background.startsWith('linear-gradient(')?'linear':s.background.startsWith('radial-gradient(')?'radial':null;if(!type)return s.colour;
    const parts=split(s.background.slice(s.background.indexOf('(')+1,-1));let gradient,distance;
    if(type==='linear'){
      const direction=/^(to |[-\d.]+deg)/.test(parts[0])?parts.shift():'to bottom';
      if(direction!=='to bottom')throw Error('Unsupported particle gradient '+direction);
      distance=s.h;gradient=ctx.createLinearGradient(0,0,0,s.h);
    }else{
      const descriptor=/^(circle|ellipse|at )/.test(parts[0])?parts.shift():'circle';
      const match=/at ([\d.]+)% ([\d.]+)%/.exec(descriptor),x=match?s.w*Number(match[1])/100:s.w/2,y=match?s.h*Number(match[2])/100:s.h/2;
      if(!descriptor.startsWith('circle')){const rx=Math.max(x,s.w-x)*Math.SQRT2,ry=Math.max(y,s.h-y)*Math.SQRT2;distance=rx;ctx.translate(x,y);ctx.scale(rx,ry);gradient=ctx.createRadialGradient(0,0,0,0,0,1);}
      else{distance=Math.hypot(Math.max(x,s.w-x),Math.max(y,s.h-y));gradient=ctx.createRadialGradient(x,y,0,x,y,distance);}
    }
    const parse=value=>{const rgb=/^rgba?\(([^)]+)\)$/.exec(value),srgb=/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(value);if(rgb){const n=rgb[1].split(',').map(Number);return[n[0],n[1],n[2],n[3]??1];}if(srgb)return[Number(srgb[1])*255,Number(srgb[2])*255,Number(srgb[3])*255,Number(srgb[4]??1)];throw Error('Unsupported gradient colour '+value);};
    const stops=parts.map((stop,index)=>{const match=/^(.*)\s+([-\d.]+)(%|px)$/.exec(stop);return{offset:match?Math.max(0,Math.min(1,Number(match[2])/(match[3]==='%'?100:distance))):index/Math.max(1,parts.length-1),colour:parse(match?match[1]:stop)};});
    // CSS gradients interpolate premultiplied colour. Software Canvas gradients
    // darken a coloured stop as it approaches transparent black; subdivide the
    // same authored stops using premultiplied interpolation instead.
    const put=(offset,c)=>gradient.addColorStop(offset,`rgba(${c[0]},${c[1]},${c[2]},${c[3]})`);
    put(stops[0].offset,stops[0].colour);for(let i=1;i<stops.length;i++){const before=stops[i-1],after=stops[i];for(let j=1;j<=32;j++){const t=j/32,a=before.colour[3]*(1-t)+after.colour[3]*t,c=[0,1,2].map(k=>a?(before.colour[k]*before.colour[3]*(1-t)+after.colour[k]*after.colour[3]*t)/a:before.colour[k]);put(before.offset+(after.offset-before.offset)*t,[...c,a]);}}
    return gradient;
  }
  function shadowData(value){
    if(value==='none')return[];
    return split(value).map(v=>{const colour=/^(rgba?\([^)]+\)|color\([^)]+\)|#[\da-f]+)\s*/i.exec(v);if(!colour)return null;const rest=v.slice(colour[0].length),numbers=[...rest.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map(m=>Number(m[1]));return{colour:colour[1],x:numbers[0]||0,y:numbers[1]||0,blur:numbers[2]||0,spread:numbers[3]||0,inset:rest.includes('inset')}}).filter(Boolean);
  }
  function appearance(s,quality=1){
    const shadows=shadowData(s.shadow),pad=Math.ceil(Math.max(2,...shadows.map(v=>v.blur*2+Math.abs(v.spread)+Math.abs(v.x)+Math.abs(v.y)))+2),extent=viewport.dpr>1?2046:1022,dpr=Math.min(viewport.dpr*quality,extent/Math.max(s.w+pad*2,s.h+pad*2)),key=JSON.stringify([s.w,s.h,s.background,s.colour,s.clip,s.shadow,s.radii,s.borderWidth,s.borderColour,s.borderStyle,dpr]);
    if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return entry;}
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil((s.w+pad*2)*dpr);canvas.height=Math.ceil((s.h+pad*2)*dpr);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.scale(dpr,dpr);ctx.translate(pad,pad);ctx.save();clip(ctx,s);
    for(const shadow of [...shadows].reverse()){
      if(shadow.inset)continue;
      // CSS box-shadow casts the border box, independently of its gradient alpha.
      const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const g=c.getContext('2d',{willReadFrequently:true});g.scale(dpr,dpr);g.translate(pad,pad);const shift=c.width/dpr+s.w+pad*2+Math.abs(shadow.spread)*2;g.shadowColor=shadow.colour;g.shadowBlur=shadow.blur*dpr;g.shadowOffsetX=(shadow.x-shift)*dpr;g.shadowOffsetY=shadow.y*dpr;g.fillStyle='#fff';g.save();g.translate(shift,0);shape(g,s,shadow.spread);g.fill();g.restore();g.shadowColor='transparent';g.globalCompositeOperation='destination-out';shape(g,s);g.fill();ctx.drawImage(c,-pad,-pad,c.width/dpr,c.height/dpr);
    }
    shape(ctx,s);ctx.save();ctx.fillStyle=background(ctx,s);ctx.fill();ctx.restore();
    for(const shadow of shadows.filter(v=>v.inset)){
      // An inset shadow is a blurred, coloured region outside the padding
      // box's hole. Blurring a thin border stroke leaves the inner glow too dim.
      const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const g=c.getContext('2d',{willReadFrequently:true}),shift=c.width/dpr+s.w+pad*8,inset=s.borderWidth+shadow.spread;
      g.scale(dpr,dpr);g.translate(pad+shift,pad);g.shadowColor=shadow.colour;g.shadowBlur=shadow.blur*dpr;g.shadowOffsetX=(shadow.x-shift)*dpr;g.shadowOffsetY=shadow.y*dpr;g.fillStyle='#fff';g.beginPath();g.rect(-pad*2,-pad*2,s.w+pad*4,s.h+pad*4);
      g.roundRect(inset,inset,Math.max(0,s.w-inset*2),Math.max(0,s.h-inset*2),s.radii.map(v=>{const [x,y=x]=v.split(' ');return{x:Math.max(0,length(x,s.w)-inset),y:Math.max(0,length(y,s.h)-inset)}}));g.fill('evenodd');ctx.save();shape(ctx,s);ctx.clip();ctx.drawImage(c,-pad,-pad,c.width/dpr,c.height/dpr);ctx.restore();
    }
    if(s.borderWidth&&s.borderStyle!=='none'){
      ctx.save();ctx.translate(s.borderWidth/2,s.borderWidth/2);shape(ctx,{...s,w:s.w-s.borderWidth,h:s.h-s.borderWidth});ctx.lineWidth=s.borderWidth;ctx.strokeStyle=s.borderColour;if(s.borderStyle==='dashed')ctx.setLineDash([s.borderWidth*3,s.borderWidth*3]);ctx.stroke();ctx.restore();
    }
    ctx.restore();const entry={canvas,w:s.w,h:s.h,pad,dpr,bytes:canvas.width*canvas.height*4};return remember(key,entry);
  }
  function remember(key,entry){
    cache.set(key,entry);metrics.prepared++;metrics.bytes+=entry.bytes;
    for(const [key,old]of cache){if(metrics.bytes<=MAX_BYTES)break;if(old===entry||[...groups].some(group=>group.mask===old||group.parts.some(p=>p.image===old)))continue;cache.delete(key);metrics.bytes-=old.bytes;old.canvas.width=old.canvas.height=0;warmed.clear();}
    return entry;
  }
  function filteredWake(s){
    const dpr=viewport.dpr*4,pad=2,key=JSON.stringify(['filtered-wake',s.w,s.h,s.background,s.colour,s.clip,s.shadow,s.radii,s.borderWidth,s.borderColour,s.borderStyle,s.filter,dpr]);
    if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return entry;}
    const source=appearance({...s,clip:'none'},4),canvas=document.createElement('canvas');canvas.width=Math.ceil((s.w+pad*2)*dpr);canvas.height=Math.ceil((s.h+pad*2)*dpr);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.scale(dpr,dpr);ctx.translate(pad,pad);clip(ctx,s);ctx.setTransform(1,0,0,1,0,0);ctx.filter=s.filter.replace(/(-?\d+(?:\.\d+)?)px/g,(_,n)=>Number(n)*dpr+'px');
    if(s.filter!=='none'&&ctx.filter==='none')throw Error('Wake filter unavailable');
    ctx.drawImage(source.canvas,(pad-source.pad)*dpr,(pad-source.pad)*dpr,source.canvas.width*dpr/source.dpr,source.canvas.height*dpr/source.dpr);
    return remember(key,{canvas,w:s.w,h:s.h,pad,dpr,bytes:canvas.width*canvas.height*4});
  }
  function clock(timing,origin,current=0){
    return{timing,origin,current,progress(){const time=frameTime-this.origin+this.current-this.timing.delay;if(time<0)return null;return math.ease(Math.max(0,Math.min(1,time/this.timing.duration)),this.timing.easing)}};
  }
  function resolve(value,node,parent){
    return value.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g,(_,name,fallback)=>node.style.getPropertyValue(name)||parent?.style.getPropertyValue(name)||fallback||'0').replace(/calc\(([^()]+)\)/g,(original,expression)=>{
      if(!expression.includes('deg')||expression.includes('px')||expression.includes('%'))return original;
      const terms=[...expression.replace(/\s|deg/g,'').matchAll(/([+-]*)(\d+(?:\.\d+)?)/g)];return terms.reduce((n,m)=>n+Number(m[2])*((m[1].match(/-/g)||[]).length%2?-1:1),0)+'deg';
    });
  }
  function recipeKey(node,pseudo,parent){
    const holder=parent||node,colour=holder.style.getPropertyValue('--vfx-color')||holder.parentElement?.style.getPropertyValue('--vfx-color'),accent=holder.style.getPropertyValue('--vfx-accent')||holder.parentElement?.style.getPropertyValue('--vfx-accent');
    return JSON.stringify([node.className,pseudo,node.dataset.shape,node.dataset.vector,holder.dataset.impactProfile,holder.dataset.ruptureStyle,holder.dataset.travelProfile,colour,accent,viewport.w,viewport.h,viewport.dpr]);
  }
  function recipe(node,pseudo,parent){const key=recipeKey(node,pseudo,parent);if(!recipes.has(key))recipes.set(key,styleData(node,pseudo));return recipes.get(key);}
  function rootRecipe(node){
    // Only these authored inline values vary per instance. An arbitrary paint,
    // geometry or custom-property override keeps the live computed-style path.
    const allowed=/^(?:left|top|visibility|--vfx-(?:color|accent|burst-scale)|--(?:charge|preflash|afterglow)-duration|--wake-(?:x|y|mid-x|mid-y|rotation|duration|delay))$/;
    for(let i=0;i<node.style.length;i++)if(!allowed.test(node.style.item(i)))return styleData(node);
    const position=name=>{const value=node.style.getPropertyValue(name).trim();return !value?null:/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?px$/i.test(value)?parseFloat(value):NaN;},left=position('left'),top=position('top');
    if(Number.isNaN(left)||Number.isNaN(top))return styleData(node);
    const key=recipeKey(node,null,null);let entry=rootRecipes.get(key);
    if(!entry){
      const s=styleData(node);entry={s};
      if(!motionTemplate(s.animationName)){
        if(!node.classList.contains('battle-vfx-burst'))return s;
        const value=node.style.getPropertyValue('--vfx-burst-scale').trim(),scale=value?Number(value):1,matrix=new DOMMatrix(s.transform==='none'?undefined:s.transform);
        // The sole supported static root is translate(-50%,-50%) scale(var).
        // Scale changes its linear coefficients, independently of translation.
        if(!Number.isFinite(scale)||!scale||matrix.is2D===false||matrix.b||matrix.c||Math.abs(matrix.a-scale)>Math.max(1,Math.abs(scale))*1e-5||Math.abs(matrix.d-scale)>Math.max(1,Math.abs(scale))*1e-5||Math.abs(matrix.e+s.w/2)>1e-3||Math.abs(matrix.f+s.h/2)>1e-3)return s;
        entry.burstMatrix=[matrix.a/scale,matrix.b/scale,matrix.c/scale,matrix.d/scale,matrix.e,matrix.f];
      }
      rootRecipes.set(key,entry);
    }
    const s={...entry.s,left:left??entry.s.left,top:top??entry.s.top};
    if(entry.burstMatrix){
      const value=node.style.getPropertyValue('--vfx-burst-scale').trim(),scale=value?Number(value):1;if(!Number.isFinite(scale))return styleData(node);
      // Match computed matrix() number serialization before DOMMatrix parsing.
      s.transform='matrix('+entry.burstMatrix.map((value,i)=>i<4?Number((value*scale).toPrecision(6)):value).join(',')+')';
    }
    return s;
  }
  function motionTemplate(name){
    if(motionTemplates.has(name))return motionTemplates.get(name);
    const rules=keyframes.get(name);if(!rules)return null;
    const frames=rules.flatMap(rule=>{
      const template={easing:rule.style.animationTimingFunction,transform:rule.style.transform,opacity:rule.style.opacity};
      return rule.keyText.split(',').map(offset=>({...template,computedOffset:parseFloat(offset)/100}));
    }).sort((a,b)=>a.computedOffset-b.computedOffset);
    motionTemplates.set(name,frames);return frames;
  }
  function part(node,pseudo,parent,origin){
    const s=parent||pseudo?recipe(node,pseudo,parent):rootRecipe(node);if(!s.w||!s.h)return null;
    const template=motionTemplate(s.animationName),timing={duration:s.animationDuration,delay:s.animationDelay,easing:'linear'};
    const duration=node.style.getPropertyValue('--fragment-duration')||node.style.getPropertyValue('--charge-duration')||node.style.getPropertyValue('--wake-duration')||node.style.getPropertyValue('--preflash-duration')||node.style.getPropertyValue('--afterglow-duration');
    const delay=node.style.getPropertyValue('--fragment-delay')||node.style.getPropertyValue('--wake-delay')||node.style.getPropertyValue('--afterglow-delay');
    if(duration)timing.duration=parseFloat(duration);if(delay)timing.delay=parseFloat(delay);
    const time=template?clock(timing,origin):null,image=parent?appearance(s,pseudo==='::after'?4:pseudo?2:1):{w:s.w,h:s.h,pad:0,canvas:null};
    let state=null;
    if(template){const frames=template.map(raw=>{const frame={computedOffset:raw.computedOffset,easing:raw.easing||s.animationEasing};for(const name of ['transform','opacity'])if(raw[name])frame[name]=resolve(raw[name],node,parent);return frame;});const motion=math.motionTrack(frames,s.w,s.h);if(!motion)throw Error('Unsupported vector motion '+s.animationName);state={entry:{width:s.w,height:s.h,contentWidth:s.w,contentHeight:s.h},motion,origin:s.origin,left:s.left,top:s.top,objectPosition:'50% 50%',animation:{effect:{getComputedTiming:()=>({progress:time.progress()})}}};}
    return{node,pseudo,s,image,time,state};
  }
  function sample(p){if(p.state)return math.sampleState(p.state);return{matrix:new DOMMatrix(p.s.transform==='none'?undefined:p.s.transform),opacity:p.s.opacity};}
  function transformed(ctx,p,value){
    if(!value||value.opacity<.002)return false;
    const m=value.matrix,[x,y]=p.s.origin;ctx.translate(p.s.left+x,p.s.top+y);ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.translate(-x,-y);ctx.globalAlpha=value.opacity;return true;
  }
  function releaseGroups(){for(const group of groups){restore(group);surfaces.get(group.layer)?.gpu.drop(group,false);}groups.clear();}
  function clearAppearances(){if(introReservation?.stage)cancelIntroReservation();if(introWarm?.stage||unavailable)cancelIntroWarm();warmGeneration++;for(const entry of cache.values())entry.canvas.width=entry.canvas.height=0;cache.clear();recipes.clear();rootRecipes.clear();warmed.clear();metrics.bytes=0;uploads.length=0;if(uploadRaf)cancelAnimationFrame(uploadRaf);uploadRaf=0;}
  function dimensions(){
    if(!stage)return;const {w,h,dpr,width,height}=sceneDimensions(stage);if(w===viewport.w&&h===viewport.h&&dpr===viewport.dpr)return;
    const dprChanged=dpr!==viewport.dpr;releaseGroups();clearAppearances();Object.assign(viewport,{w,h,dpr});
    try{for(const surface of surfaces.values()){surface.gpu.reset();surface.canvas.width=width;surface.canvas.height=height;if(dprChanged){surface.gpu.destroy();surface.gpu=gpuRenderer(surface.canvas);}}}catch(error){fallback(error);return;}
    scheduleIntroWarm();
  }
  function ensure(){
    const next=document.querySelector('#combat .battle-stage');if(!next||unavailable)return false;
    if(stage!==next){releaseGroups();clearAppearances();for(const {canvas,gpu}of surfaces.values()){gpu.destroy();canvas.remove();}surfaces.clear();stage=next;resize?.disconnect();resize=new ResizeObserver(dimensions);resize.observe(stage);dimensions();}
    for(const z of [8,10])if(!surfaces.has(z)){
      const canvas=document.createElement('canvas');canvas.className='battle-vector-canvas';canvas.dataset.vectorLayer=String(z);canvas.setAttribute('aria-hidden','true');canvas.style.cssText=`position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen;z-index:${z}`;root.combatVfxLayer().appendChild(canvas);const size=sceneDimensions(stage);canvas.width=size.width;canvas.height=size.height;try{surfaces.set(z,{canvas,gpu:gpuRenderer(canvas)});}catch(error){canvas.remove();fallback(error);return false;}canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();},{once:true});
    }return true;
  }
  function easingBounds(name){
    const match=String(name).match(/cubic-bezier\(([^)]+)\)/);if(!match)return[0,1];
    const values=match[1].split(',').map(Number);return values.length===4&&values.every(Number.isFinite)?[Math.min(0,values[1],values[3]),Math.max(1,values[1],values[3])]:null;
  }
  function intervalProduct(a,b){const values=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return[Math.min(...values),Math.max(...values)];}
  function axisAlignedBounds(p){
    const e=p.image,s=p.s,[ox,oy]=s.origin,pad=e.pad||0,imageWidth=e.canvas?.width&&e.dpr?e.canvas.width/e.dpr:e.w+pad*2,imageHeight=e.canvas?.height&&e.dpr?e.canvas.height/e.dpr:e.h+pad*2,frames=p.state?.motion.transforms||[];
    if(![s.left,s.top,ox,oy,pad,imageWidth,imageHeight].every(Number.isFinite))return null;
    if(!frames.length){if(s.transform&&s.transform!=='none')return null;return{minX:s.left-pad,minY:s.top-pad,maxX:s.left+imageWidth-pad,maxY:s.top+imageHeight-pad};}
    const names=frames[0].parts.map(part=>part.name);
    if(names.some(name=>! /^(translate(?:X|Y)?|scale(?:X|Y)?)$/.test(name))||frames.some(frame=>frame.parts.length!==names.length||frame.parts.some((part,index)=>part.name!==names[index]||part.values.length!==2||!part.values.every(Number.isFinite))))return null;
    const ranges=names.map(()=>[[Infinity,-Infinity],[Infinity,-Infinity]]);
    for(let f=0;f<frames.length;f++){
      const a=frames[f],b=frames[Math.min(f+1,frames.length-1)],ease=easingBounds(a.easing);if(!ease)return null;
      for(let i=0;i<names.length;i++)for(let axis=0;axis<2;axis++){const from=a.parts[i].values[axis],delta=b.parts[i].values[axis]-from,x=from+delta*ease[0],y=from+delta*ease[1],range=ranges[i][axis];range[0]=Math.min(range[0],x,y);range[1]=Math.max(range[1],x,y);}
    }
    // Diagonal affine composition matches sampleState's postmultiplication.
    // Interval products remain conservative for signed scales, interpolation
    // overshoot, multiple translations and either transform-function order.
    let sx=[1,1],sy=[1,1],tx=[0,0],ty=[0,0];
    for(let i=0;i<names.length;i++){const [x,y]=ranges[i];if(names[i].startsWith('translate')){const dx=intervalProduct(sx,x),dy=intervalProduct(sy,y);tx=[tx[0]+dx[0],tx[1]+dx[1]];ty=[ty[0]+dy[0],ty[1]+dy[1]];}else{sx=intervalProduct(sx,x);sy=intervalProduct(sy,y);}}
    const x=intervalProduct(sx,[-pad-ox,imageWidth-pad-ox]),y=intervalProduct(sy,[-pad-oy,imageHeight-pad-oy]);
    const result={minX:s.left+ox+tx[0]+x[0],minY:s.top+oy+ty[0]+y[0],maxX:s.left+ox+tx[1]+x[1],maxY:s.top+oy+ty[1]+y[1]};return Object.values(result).every(Number.isFinite)?result:null;
  }
  function radialBounds(p){
    const [ox,oy]=p.s.origin,e=p.image,frames=p.state?.motion.transforms||[],translations=frames.flatMap(f=>f.parts.filter(part=>part.name.startsWith('translate')).map(part=>part.values));
    const scale=Math.max(1,...frames.map(f=>f.parts.filter(part=>part.name.startsWith('scale')).reduce((n,part)=>n*Math.max(...part.values.map(Math.abs)),1)));
    const radius=Math.hypot(Math.max(Math.abs(-e.pad-ox),Math.abs(e.w+e.pad-ox)),Math.max(Math.abs(-e.pad-oy),Math.abs(e.h+e.pad-oy)))*scale,xs=translations.map(v=>v[0]),ys=translations.map(v=>v[1]);
    return{minX:p.s.left+ox+Math.min(0,...xs)-radius,minY:p.s.top+oy+Math.min(0,...ys)-radius,maxX:p.s.left+ox+Math.max(0,...xs)+radius,maxY:p.s.top+oy+Math.max(0,...ys)+radius};
  }
  function radialTrackSupported(p){
    const frames=p.state?.motion.transforms||[];if(!frames.length)return!p.s.transform||p.s.transform==='none';
    const names=frames[0].parts.map(part=>part.name);if(names.filter(name=>name.startsWith('translate')).length>1||names.filter(name=>name.startsWith('scale')).length>1||names.some((name,i)=>! /^(translate(?:X|Y)?|scale(?:X|Y)?|rotate)$/.test(name)||(name.startsWith('translate')&&i!==0)))return false;
    return frames.every(frame=>{const ease=easingBounds(frame.easing);return ease&&ease[0]===0&&ease[1]===1&&frame.parts.length===names.length&&frame.parts.every((part,i)=>part.name===names[i]&&part.values.every(Number.isFinite));});
  }
  function filterEnvelopeMargin(value,dpr){
    if(!value||value==='none')return{x:0,y:0};const tokens=[];let depth=0,start=0;
    for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')'&&!--depth){tokens.push(value.slice(start,i+1).trim());start=i+1;}}
    let x=0,y=0;for(const token of tokens){let sigma,dx=0,dy=0;if(token.startsWith('blur('))sigma=parseFloat(token.slice(5));else{const match=/^drop-shadow\((rgba?\([^)]+\))\s+([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\)$/.exec(token);if(!match)return null;dx=Number(match[2]);dy=Number(match[3]);sigma=Number(match[4]);}if(![sigma,dx,dy].every(Number.isFinite))return null;const radius=(Math.ceil(Math.max(.001,sigma*dpr)*3)+2)/dpr;x+=radius+Math.abs(dx);y+=radius+Math.abs(dy);}
    return tokens.length?{x,y}:null;
  }
  function groupEnvelope(parent,parts,dpr){
    const old={minX:0,minY:0,maxX:parent.s.w,maxY:parent.s.h},tight={...old};let supported=true,hasAxis=false;
    const include=(bounds,next)=>{bounds.minX=Math.min(bounds.minX,next.minX);bounds.minY=Math.min(bounds.minY,next.minY);bounds.maxX=Math.max(bounds.maxX,next.maxX);bounds.maxY=Math.max(bounds.maxY,next.maxY);};
    for(const p of parts.slice(1)){const radial=radialBounds(p),axis=axisAlignedBounds(p);include(old,radial);include(tight,axis||radial);if(axis)hasAxis=true;else if(!radialTrackSupported(p))supported=false;}
    const margin=filterEnvelopeMargin(parent.s.filter,dpr);let bounds=old;
    if(supported&&margin&&hasAxis){
      // Include every source corner and finite Gaussian/shadow pass. Unknown
      // tracks/filters and wholly rotating groups retain the original envelope.
      bounds={minX:tight.minX-margin.x,minY:tight.minY-margin.y,maxX:tight.maxX+margin.x,maxY:tight.maxY+margin.y};
    }
    const pad=4,x=Math.floor(bounds.minX)-pad,y=Math.floor(bounds.minY)-pad;
    return{x,y,buffer:{width:Math.ceil(bounds.maxX-x+pad)*dpr,height:Math.ceil(bounds.maxY-y+pad)*dpr}};
  }
  function attach(node,origin,register=true){
    if(!node||!ensure())return;
    const parent=part(node,null,null,origin),parts=[parent];
    if(parent.s.background!=='none'||parent.s.shadow!=='none'||parent.s.borderWidth){const s={...parent.s,left:0,top:0,origin:[0,0],transform:'none',opacity:1,clip:'none'};parts.push({node,pseudo:'background',s,image:appearance(s,parent.s.clip!=='none'?4:1),state:null,time:null});}
    for(const pseudo of ['::before']){const s=recipe(node,pseudo,node);if(s.content!=='none'){const p=part(node,pseudo,node,origin);if(p)parts.push(p);}}
    for(const child of node.children){const p=part(child,null,node,origin);if(p)parts.push(p);}
    for(const pseudo of ['::after']){const s=recipe(node,pseudo,node);if(s.content!=='none'){const p=part(node,pseudo,node,origin);if(p)parts.push(p);}}
    const group={node,parent,parts,layer:node.classList.contains('battle-vfx-burst')?10:8,visibility:node.style.visibility,filter:node.style.getPropertyValue('filter'),filterPriority:node.style.getPropertyPriority('filter')};
    group.direct=node.classList.contains('battle-vfx-wake');if(group.direct)parts[1].image=filteredWake(parent.s);
    group.dpr=parent.s.clip!=='none'?Math.min(4,viewport.dpr*2):viewport.dpr;
    if(parent.s.clip!=='none'&&!group.direct)group.mask=appearance({...parent.s,background:'none',colour:'#ffffff',shadow:'none',radii:['0px','0px','0px','0px'],borderWidth:0},4);
    // Allocate once from a conservative motion envelope. Never resize in frame().
    Object.assign(group,groupEnvelope(parent,parts,group.dpr));
    if(register)groups.add(group);return group;
  }
  function cancelIntroReservation(){if(introTimer)clearTimeout(introTimer);if(introRaf)cancelAnimationFrame(introRaf);introTimer=introRaf=0;introReservation=null;}
  function introReservationCurrent(job){
    return !unavailable&&!document.hidden&&document.getElementById('combat')?.classList.contains('active')&&typeof run!=='undefined'&&run?.combat===job.combat&&(Number(run.stats?.cardsPlayed)||0)===job.cardsPlayed&&run.combat.phase==='PLAYER'&&!run.combat.inputLocked&&!groups.size&&!pending.size;
  }
  function reservationEnvelope(event,kind){
    const profile=root.combatVfxRuptureProfile(event),holder=document.createElement('div'),node=document.createElement('div');holder.style.visibility='hidden';node.className='battle-vfx-'+kind;node.style.setProperty('--vfx-color',root.combatVfxColor(event));node.style.setProperty('--vfx-accent',root.combatVfxAccent(event));
    if(kind==='burst'||kind==='afterglow')node.dataset.impactProfile=profile.family;if(kind==='burst')node.dataset.ruptureStyle=String(event.sequenceVariant?.rupture?.style||'');holder.appendChild(node);root.combatVfxLayer().appendChild(holder);
    try{
      const baseline=attach(node,0,false);if(!baseline)return null;
      // Reserve an exact native envelope only when its seed-independent core
      // contains every possible fragment/mote bound. No presentation is played.
      const decay=event.sequenceVariant?.decay||{},vertical=['ground','seismic','breakwave'].includes(profile.vector)?.48:['plume','cathedral','throne'].includes(profile.vector)?1.15:['siege','rail','piston'].includes(profile.vector)?.54:.72;
      let shapes=[],x=0,y=0,prefix='',className='';
      if(kind==='burst'){shapes=[...new Set(profile.shapes)];x=(Number(profile.spread)||0)+36+Math.abs(Number(decay.driftX)||0);y=((Number(profile.spread)||0)+36)*vertical+Math.abs(Number(decay.driftY)||0);prefix='fragment';className='battle-vfx-fragment';}
      else if(kind==='afterglow'){shapes=[''];x=56+Math.abs(Number(decay.driftX)||0);y=56*vertical+Math.abs(Number(decay.driftY)||0);prefix='afterglow';className='battle-vfx-afterglow-mote';}
      else if(kind==='charge'){
        const charge=event.sequenceVariant?.charge||{},folds=Math.max(1,Number(charge.folds)||3),count=Math.max(1,Math.floor(Number(event.motionVariant?.chargeMotes)||7)),style=String(charge.style||'inward-orbit');let radius=0;
        for(let i=0;i<count;i++)radius=Math.max(radius,style==='vertical-forge'?24+(i%folds)*13:style==='split-converge'?34+(i%folds)*9:style==='folding-crest'?22+(i%folds)*14:style==='fracture-assemble'?35+(i%4)*15:28+(i%3)*12);
        shapes=[''];x=y=radius;prefix='mote';className='battle-vfx-charge-mote';
      }
      for(const shape of shapes)for(const sx of [-1,1])for(const sy of [-1,1]){const child=document.createElement('i');child.className=className;if(kind==='burst'){child.dataset.shape=shape;child.dataset.vector=profile.vector;}child.style.setProperty('--'+prefix+'-x',sx*x+'px');child.style.setProperty('--'+prefix+'-y',sy*y+'px');node.appendChild(child);}
      const bounded=shapes.length?attach(node,0,false):baseline,rounded=g=>[Math.ceil(g.buffer.width/32)*32,Math.ceil(g.buffer.height/32)*32],baseSize=rounded(baseline),boundSize=rounded(bounded);
      return baseSize.every((value,i)=>value===boundSize[i])?{layer:baseline.layer,width:baseSize[0],height:baseSize[1]}:null;
    }finally{holder.remove();}
  }
  function reserveIntroFrame(){
    introRaf=0;const job=introReservation,size=stage&&sceneDimensions(stage);if(!job||!introReservationCurrent(job)||stage!==job.stage||!stage?.isConnected||document.querySelector('#combat .battle-stage')!==stage||size.w!==job.w||size.h!==job.h||size.dpr!==job.dpr||viewport.w!==job.w||viewport.h!==job.h||viewport.dpr!==job.dpr){cancelIntroReservation();return;}
    const kind=job.kinds.shift();
    try{const envelope=reservationEnvelope(job.event,kind);if(envelope&&introReservation===job){const remaining=MAX_BYTES-[...surfaces.values()].reduce((bytes,s)=>bytes+s.gpu.snapshot().poolBytes,0),bytes=surfaces.get(envelope.layer)?.gpu.reserve(envelope.width,envelope.height,remaining)||0;if(bytes){metrics.reservedCount++;metrics.reservedBytes+=bytes;}}}catch(error){fallback(error);return;}
    if(introReservation!==job)return;if(job.kinds.length)introRaf=requestAnimationFrame(reserveIntroFrame);else introReservation=null;
  }
  function scheduleIntroReservation(){
    const combat=typeof run!=='undefined'?run?.combat:null;if(introReservation&&(combat!==introReservation.combat||(Number(run?.stats?.cardsPlayed)||0)!==introReservation.cardsPlayed))cancelIntroReservation();if(!combat||introReserved.has(combat)||unavailable)return;
    introReserved.add(combat);cancelIntroReservation();const job={combat,cardsPlayed:Number(run.stats?.cardsPlayed)||0};introReservation=job;
    introTimer=setTimeout(()=>{introTimer=0;if(introReservation!==job||!introReservationCurrent(job)||!ensure()){cancelIntroReservation();return;}const state=combat.hand[0],card=state&&ALL_CARDS[state.id],event=card&&root.combatCardVfxEvent(card);if(!event){cancelIntroReservation();return;}Object.assign(job,{event,stage,w:viewport.w,h:viewport.h,dpr:viewport.dpr,kinds:['burst','charge','preflash','afterglow']});introRaf=requestAnimationFrame(reserveIntroFrame);},180);
  }
  function suppressPreparedChildren(node){
    if(!node.children.length)return false;
    for(const child of node.children){
      if(!/^battle-vfx-(fragment|charge-mote|afterglow-mote)$/.test(child.className))return false;
      const s=recipes.get(recipeKey(child,null,node));if(!s||!motionTemplate(s.animationName))return false;
    }
    // Root and pseudo clocks keep running. Prepared child tracks use that same
    // origin on the GPU without creating a second set of hidden CSS animations.
    node.dataset.vectorChildren='CACHED_CSS';return true;
  }
  function restorePreparedChildren(node,elapsed){
    delete node.dataset.vectorChildren;
    if(elapsed===undefined||!node.isConnected)return;
    const now=document.timeline.currentTime||performance.now();
    for(const animation of node.getAnimations({subtree:true}))if(animation.effect?.target!==node){animation.currentTime=elapsed;animation.play();animation.startTime=now-elapsed;}
  }
  function hidePending(node){if(!pendingVisibility.has(node))pendingVisibility.set(node,{value:node.style.getPropertyValue('visibility'),priority:node.style.getPropertyPriority('visibility'),childrenSuppressed:suppressPreparedChildren(node)});node.style.setProperty('visibility','hidden','important');}
  function restorePending(node){const old=pendingVisibility.get(node);if(!old)return;if(old.childrenSuppressed){const animation=node.isConnected&&node.getAnimations({subtree:false}).find(a=>a.effect?.target===node);restorePreparedChildren(node,animation?animation.currentTime||0:undefined);}if(old.value)node.style.setProperty('visibility',old.value,old.priority);else node.style.removeProperty('visibility');pendingVisibility.delete(node);}
  function clearPending(){if(collectRaf)cancelAnimationFrame(collectRaf);collectRaf=0;for(const node of pendingVisibility.keys())restorePending(node);pending.clear();}
  function queue(node){if(!node||unavailable||node.dataset.vectorBatch==='CACHED_CSS')return;cancelIntroWarm();hidePending(node);pending.add(node);if(!collectRaf)collectRaf=requestAnimationFrame(collect);}
  function collect(){
    collectRaf=0;const added=[];
    try{
      // Read all resolved animations and styles before pausing or hiding any
      // node. Interleaving those mutations forced a style flush per fragment.
      const origins=new Map(),nativeClocks=[];
      for(const node of pending)if(node.isConnected){const animation=node.getAnimations({subtree:false}).find(animation=>animation.effect?.target===node);if(animation)nativeClocks.push([node,animation.currentTime||0]);}
      const now=document.timeline.currentTime||performance.now();for(const [node,currentTime]of nativeClocks)origins.set(node,now-currentTime);
      for(const node of pending){if(!node.isConnected){restorePending(node);continue;}const group=attach(node,origins.get(node)??now);if(group){const old=pendingVisibility.get(node);if(old){group.visibility=old.value;group.visibilityPriority=old.priority;group.childrenSuppressed=old.childrenSuppressed;pendingVisibility.delete(node);}added.push(group);}else restorePending(node);}
      for(const group of added){group.node.dataset.vectorBatch='CACHED_CSS';group.node.style.visibility='hidden';}
      // Draw in this RAF: the hidden native effect has not incurred its first
      // large blur paint, and no extra empty frame precedes the GPU output.
      if(!raf&&groups.size)frame(performance.now());
    }catch(error){fallback(error);}pending.clear();
  }
  function restore(group){if(group.visibility)group.node.style.setProperty('visibility',group.visibility,group.visibilityPriority||'');else group.node.style.removeProperty('visibility');delete group.node.dataset.vectorBatch;if(group.childrenSuppressed)restorePreparedChildren(group.node);if(group.filter)group.node.style.setProperty('filter',group.filter,group.filterPriority);else group.node.style.removeProperty('filter');const animations=group.node.getAnimations({subtree:true});for(const p of group.parts)if(p.time){const animation=animations.find(a=>a.effect.target===p.node&&(a.effect.pseudoElement||null)===(p.pseudo||null));if(animation){animation.currentTime=(document.timeline.currentTime||performance.now())-p.time.origin+p.time.current;animation.play();animation.startTime=p.time.origin-p.time.current;}}}
  function fallback(error){unavailable=true;if(error)metrics.errors.push(String(error?.message||error));clearPending();releaseGroups();for(const {canvas,gpu}of surfaces.values()){gpu.destroy();canvas.remove();}surfaces.clear();clearAppearances();resize?.disconnect();if(raf)cancelAnimationFrame(raf);raf=0;}
  function frame(now){
    raf=0;if(document.hidden||!document.getElementById('combat')?.classList.contains('active'))return;
    if(now<nextPaint){if(groups.size)raf=requestAnimationFrame(frame);return;}nextPaint=now+1000/paintFps-.1;frameTime=document.timeline.currentTime||now;metrics.frames++;
    for(const {gpu}of surfaces.values())gpu.clear();
    for(const group of groups){
      if(!group.node.isConnected){groups.delete(group);surfaces.get(group.layer).gpu.drop(group);continue;}
      const parentValue=sample(group.parent);if(!parentValue||parentValue.opacity<.002)continue;
      try{surfaces.get(group.layer).gpu.draw(group,parentValue);}catch(error){fallback(error);return;}
    }
    if(groups.size)raf=requestAnimationFrame(frame);else nextPaint=0;
  }
  for(const name of kinds){const original=root[name];if(typeof original!=='function')continue;root[name]=function(...args){const layer=root.combatVfxLayer(),last=layer?.lastElementChild,result=original.apply(this,args);if(result?.nodeType===1)queue(result);else if(name==='appendCombatVfxWake'){let node=last?.nextElementSibling||layer?.firstElementChild;for(;node;node=node.nextElementSibling)if(node.classList.contains('battle-vfx-wake'))queue(node);}return result;};}
  function warmKey(event,profile){return JSON.stringify([profile.family,profile.shapes,event.sequenceVariant?.rupture?.style,event.travelProfile,root.combatVfxColor(event),root.combatVfxAccent(event),viewport.w,viewport.h,viewport.dpr]);}
  function warmEvent(event,job=null){
    if(!event||unavailable)return;const profile=root.combatVfxRuptureProfile(event),key=warmKey(event,profile);if(warmed.has(key))return;warmed.add(key);const holder=document.createElement('div');holder.style.visibility='hidden';holder.style.setProperty('--vfx-color',root.combatVfxColor(event));holder.style.setProperty('--vfx-accent',root.combatVfxAccent(event));
      for(const kind of ['burst','charge','wake','preflash','afterglow']){const node=document.createElement('div');node.className='battle-vfx-'+kind;node.style.setProperty('--vfx-color',root.combatVfxColor(event));node.style.setProperty('--vfx-accent',root.combatVfxAccent(event));if(kind==='burst'||kind==='afterglow')node.dataset.impactProfile=profile.family;if(kind==='wake')node.dataset.travelProfile=String(event.travelProfile||'dart');if(kind==='burst')node.dataset.ruptureStyle=String(event.sequenceVariant?.rupture?.style||'');holder.appendChild(node);if(kind==='burst')for(const shape of profile.shapes){const p=document.createElement('i');p.className='battle-vfx-fragment';p.dataset.shape=shape;p.dataset.vector=profile.vector;const vector=root.combatVfxFragmentVector(profile,event,node.children.length,profile.requested,73142);p.style.setProperty('--fragment-x',Math.cos(vector.angle)*vector.spread+'px');p.style.setProperty('--fragment-y',Math.sin(vector.angle)*vector.spread*vector.vertical+'px');p.style.setProperty('--fragment-rotation',vector.angle*180/Math.PI+90+'deg');p.style.setProperty('--fragment-spin','180deg');node.appendChild(p);}if(kind==='charge'||kind==='afterglow'){const p=document.createElement('i');p.className='battle-vfx-'+kind+'-mote';node.appendChild(p);}}
      root.combatVfxLayer().appendChild(holder);try{for(const node of holder.children){const s=rootRecipe(node),layer=node.classList.contains('battle-vfx-burst')?10:8,prepare=entry=>{if(!uploads.some(upload=>upload.entry===entry&&upload.layer===layer&&upload.job===job))uploads.push({entry,layer,job});};surfaces.get(layer)?.gpu.prepareFilters?.(s.filter,s.clip!=='none'?Math.min(4,viewport.dpr*2):viewport.dpr);if(s.background!=='none'||s.shadow!=='none'||s.borderWidth)prepare(appearance({...s,clip:'none'},s.clip!=='none'?4:1));if(node.classList.contains('battle-vfx-wake'))prepare(filteredWake(s));else if(s.clip!=='none')prepare(appearance({...s,background:'none',colour:'#ffffff',shadow:'none',radii:['0px','0px','0px','0px'],borderWidth:0},4));for(const pseudo of ['::before','::after']){const s=recipe(node,pseudo,node);if(s.content!=='none')prepare(appearance(s,pseudo==='::after'?4:2));}for(const child of node.children)prepare(appearance(recipe(child,null,node)));}}catch(error){fallback(error);}finally{holder.remove();}
    if(job)job.prepared++;
    if(uploads.length&&!uploadRaf&&!unavailable)uploadRaf=requestAnimationFrame(uploadFrame);
  }
  function cancelIntroWarm(){
    if(warmTimer)clearTimeout(warmTimer);if(warmRaf)cancelAnimationFrame(warmRaf);warmTimer=warmRaf=0;
    const job=introWarm;introWarm=null;if(job){for(let i=uploads.length-1;i>=0;i--)if(uploads[i].job===job)uploads.splice(i,1);if(!uploads.length&&uploadRaf){cancelAnimationFrame(uploadRaf);uploadRaf=0;}}
  }
  function introWarmCurrent(job){
    const size=job.stage&&sceneDimensions(job.stage);return introWarm===job&&introReservationCurrent(job)&&job.combat.turn===1&&(Number(job.combat.actionToken)||0)===job.actionToken&&performance.now()<job.expires&&(!job.stage||(warmGeneration===job.generation&&stage===job.stage&&stage?.isConnected&&document.querySelector('#combat .battle-stage')===stage&&size.w===job.w&&size.h===job.h&&size.dpr===job.dpr&&viewport.w===job.w&&viewport.h===job.h&&viewport.dpr===job.dpr));
  }
  function introWarmEvents(combat){
    const ids=new Set(),party=new Set(run.party.map(member=>member.id));
    // Prepare the real encounter inventory, starting with its opening hand.
    for(const pile of [combat.hand,run.deck,combat.draw,combat.discard,combat.exhaust,run.startingDeck])for(const state of pile||[]){const id=typeof state==='string'?state:state?.id,card=ALL_CARDS[id];if(card&&party.has(card.owner))ids.add(id);}
    const events=[...ids].map(id=>root.combatCardVfxEvent(ALL_CARDS[id])),skills=new Set([combat.intent?.skillId,...(combat.enemy?.data?.skills||combat.enemy?.skills||[]).map(skill=>skill.id)]);
    for(const skillId of skills)events.push(root.combatEnemyVfxEvent(combat.enemy,run.party[0]?.id,skillId));
    const keys=new Set();return events.filter(event=>{if(!event)return false;const key=warmKey(event,root.combatVfxRuptureProfile(event));if(keys.has(key)||warmed.has(key))return false;keys.add(key);return true;});
  }
  function warmIntroFrame(){
    warmRaf=0;const job=introWarm;if(!job||!introWarmCurrent(job)){cancelIntroWarm();return;}
    const event=job.events.shift();if(event)warmEvent(event,job);
    if(introWarm!==job)return;if(job.events.length)warmRaf=requestAnimationFrame(warmIntroFrame);else if(!uploads.some(upload=>upload.job===job))introWarm=null;
  }
  function scheduleIntroWarm(){
    const combat=typeof run!=='undefined'?run?.combat:null;if(introWarm&&!introWarmCurrent(introWarm))cancelIntroWarm();if(introWarm||!combat||unavailable||combat.turn!==1||(Number(combat.actionToken)||0)!==0)return;
    if(!introReservationCurrent({combat,cardsPlayed:Number(run.stats?.cardsPlayed)||0}))return;
    let record=introWarmRecords.get(combat);if(!record){record={cardsPlayed:Number(run.stats?.cardsPlayed)||0,expires:performance.now()+2000,generations:new Set()};introWarmRecords.set(combat,record);}
    if(record.cardsPlayed!==(Number(run.stats?.cardsPlayed)||0)||performance.now()>=record.expires||record.generations.has(warmGeneration))return;
    const job={combat,cardsPlayed:record.cardsPlayed,actionToken:Number(combat.actionToken)||0,expires:record.expires,stage:null,events:[],prepared:0};introWarm=job;record.generations.add(warmGeneration);
    warmTimer=setTimeout(()=>{
      if(introWarm!==job)return;
      warmTimer=0;if(!introWarmCurrent(job)||!ensure()){cancelIntroWarm();return;}
      Object.assign(job,{stage,w:viewport.w,h:viewport.h,dpr:viewport.dpr,generation:warmGeneration});record.generations.add(warmGeneration);
      if(!introWarmCurrent(job)){cancelIntroWarm();return;}job.events=introWarmEvents(combat);if(job.events.length)warmRaf=requestAnimationFrame(warmIntroFrame);else introWarm=null;
    },150);
  }
  function warmHand(){
    if(!document.getElementById('combat')?.classList.contains('active')||!ensure()||typeof run==='undefined'||!run?.combat)return;
    const events=run.combat.hand.map(state=>ALL_CARDS[state.id]).filter(Boolean).map(card=>root.combatCardVfxEvent(card));events.push(root.combatEnemyVfxEvent(run.combat.enemy,run.party[0]?.id,run.combat.intent?.skillId));for(const event of events)warmEvent(event);
  }
  function uploadFrame(){
    uploadRaf=0;if(unavailable)return;const next=uploads.shift();if(next?.job&&!introWarmCurrent(next.job)){if(introWarm===next.job)cancelIntroWarm();else for(let i=uploads.length-1;i>=0;i--)if(uploads[i].job===next.job)uploads.splice(i,1);}else if(next&&next.entry.canvas.width)try{surfaces.get(next.layer)?.gpu.upload(next.entry);}catch(error){fallback(error);}if(uploads.length&&!unavailable)uploadRaf=requestAnimationFrame(uploadFrame);else if(introWarm?.stage&&!warmTimer&&!introWarm.events.length&&!warmRaf)introWarm=null;
  }
  const resume=()=>{if(!raf&&groups.size&&!unavailable&&document.getElementById('combat')?.classList.contains('active'))raf=requestAnimationFrame(frame);};
  const render=root.renderCombat;root.renderCombat=function(...args){const result=render.apply(this,args);resume();scheduleIntroReservation();scheduleIntroWarm();return result;};
  root.addEventListener('resize',dimensions,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelIntroWarm();resume();});
  root.TRIAD_VECTOR_BATCH=Object.freeze({version:'combat-vector-batch-0.2.0',snapshot:()=>({...metrics,groups:groups.size,entries:cache.size,gpu:[...surfaces.values()].map(s=>s.gpu.snapshot()),pendingUploads:uploads.length,preparation:{generation:warmGeneration,active:!!introWarm,queuedEvents:introWarm?.events.length||0,preparedEvents:introWarm?.prepared||0},renderer:unavailable?'native-css':'cached-css-webgl',filterMode:root.TRIAD_QA_VECTOR_FULL_FILTERS?'full':'bounded',compositeMaxFps:paintFps}),read:node=>{const group=[...groups].find(g=>g.node===node);return group?(group.direct?{image:group.parts[1].image.canvas.toDataURL(),x:-group.parts[1].image.pad,y:-group.parts[1].image.pad,w:group.parts[1].image.canvas.width,h:group.parts[1].image.canvas.height}:surfaces.get(group.layer).gpu.read(group)):null;},sample:node=>{const group=[...groups].find(g=>g.node===node);if(!group)return null;const saved=frameTime;frameTime=document.timeline.currentTime||performance.now();const values=group.parts.map(p=>({node:p.node,pseudo:p.pseudo,paintStyle:p.s,canvas:p.image.canvas,currentTime:p.time?frameTime-p.time.origin+p.time.current:null,...sample(p)}));frameTime=saved;return values;},warmHand});
})(globalThis);
