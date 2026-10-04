/* Batch the unchanged premultiplied glow sprites into one additive GPU draw.
   Paths stay on Canvas 2D; their RGBA surface is copied first, then the same
   glow gradient/colour/transform/alpha is added, including its alpha channel. */
(function(root){
  'use strict';
  function create(canvas,onLost){
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false});
    if(!gl)return null;
    const scratch=document.createElement('canvas');scratch.className='battle-cinematic-buffer';
    const ctx=scratch.getContext('2d');
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
    const vertex=shader(gl.VERTEX_SHADER,'attribute vec2 p;attribute vec2 uv;attribute vec4 color;uniform vec2 size;varying vec2 v;varying vec4 c;void main(){gl_Position=vec4(p.x/size.x*2.0-1.0,1.0-p.y/size.y*2.0,0.0,1.0);v=uv;c=color;}');
    const fragment=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 v;varying vec4 c;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,v)*vec4(c.rgb*c.a,c.a);}');
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),size=gl.getUniformLocation(program,'size'),attributes=[['p',2,0],['uv',2,8],['color',4,16]].map(([name,n,offset])=>[gl.getAttribLocation(program,name),n,offset]);let bufferBytes=0;
    const texture=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t};
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    const glow=texture(),sprite=document.createElement('canvas');sprite.width=sprite.height=128;
    const g=sprite.getContext('2d'),gradient=g.createRadialGradient(64,64,0,64,64,64);
    for(const [at,a]of [[0,1],[.22,.62],[.5,.2],[1,0]])gradient.addColorStop(at,`rgba(255,255,255,${a})`);
    g.fillStyle=gradient;g.fillRect(0,0,128,128);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sprite);
    const base=texture(),colours=new Map();let data=new Float32Array(48*2048),used=0,lost=false;
    const metrics={frames:0,glows:0,drawCalls:0};
    const rgb=hex=>{if(!colours.has(hex)){const h=String(hex).replace('#',''),n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);colours.set(hex,[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255])}return colours.get(hex)};
    function quad(target,offset,x,y,w,h,m,color,alpha){
      let i=offset;for(const [u,v]of [[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]]){
        const px=x+u*w,py=y+v*h;
        target[i++]=m.a*px+m.c*py+m.e;target[i++]=m.b*px+m.d*py+m.f;target[i++]=u;target[i++]=v;
        target[i++]=color[0];target[i++]=color[1];target[i++]=color[2];target[i++]=alpha;
      }
    }
    const baseQuad=new Float32Array(48),identity={a:1,b:0,c:0,d:1,e:0,f:0};
    function resize(w,h){scratch.width=w;scratch.height=h;gl.bindTexture(gl.TEXTURE_2D,base);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      if(!metrics.primed){begin();ctx.save();ctx.globalAlpha=0;add(ctx,'#ffffff',0,0,1,1);ctx.restore();flush();begin();metrics.frames=metrics.glows=metrics.drawCalls=0;metrics.primed=true;}}
    function begin(){used=0;}
    function add(context,color,x,y,w,h){
      if(lost)return false;
      if(used+48>data.length){const next=new Float32Array(data.length*2);next.set(data);data=next;}
      quad(data,used,x,y,w,h,context.getTransform(),rgb(color),context.globalAlpha);used+=48;return true;
    }
    function upload(vertices,count){
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);if(vertices.byteLength>bufferBytes){bufferBytes=Math.max(vertices.byteLength,bufferBytes*2,4096);gl.bufferData(gl.ARRAY_BUFFER,bufferBytes,gl.DYNAMIC_DRAW)}gl.bufferSubData(gl.ARRAY_BUFFER,0,vertices);
      for(const [at,n,offset]of attributes){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,n,gl.FLOAT,false,32,offset)}
      gl.drawArrays(gl.TRIANGLES,0,count);metrics.drawCalls++;
    }
    function flush(){
      if(lost)return;
      gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.uniform2f(size,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);gl.bindTexture(gl.TEXTURE_2D,base);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,scratch);
      quad(baseQuad,0,0,0,canvas.width,canvas.height,identity,[1,1,1],1);upload(baseQuad,6);
      if(used){gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.bindTexture(gl.TEXTURE_2D,glow);upload(data.subarray(0,used),used/8);}
      metrics.frames++;metrics.glows+=used/48;
    }
    function prepare(draw){
      const started=performance.now();begin();ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,scratch.width,scratch.height);draw(ctx);ctx.restore();flush();
      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
      ctx.clearRect(0,0,scratch.width,scratch.height);begin();flush();begin();metrics.preparationMs=performance.now()-started;
    }
    const loss=event=>{event.preventDefault();lost=true;onLost?.()};canvas.addEventListener('webglcontextlost',loss);
    function destroy(){canvas.removeEventListener('webglcontextlost',loss);gl.deleteTexture(base);gl.deleteTexture(glow);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);}
    return{ctx,resize,begin,add,flush,prepare,destroy,metrics};
  }
  root.TRIAD_GLOW_BATCH=Object.freeze({version:'glow-batch-1.0.1',create});
})(globalThis);
