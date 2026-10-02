/* Renderer-independent, versioned split-part motion. No gameplay or RNG dependency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TRIAD_PART_RIG=api;})(globalThis,function(){
  'use strict';
  const identity=()=>[1,0,0,1,0,0];
  function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
  const point=(m,x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
  // Shared boss contract: keep the same articulated geometry for the entire
  // action. Unregistered full-body drawings are not animation in-betweens.
  function keepContinuousBody(actor){
    actor.scene.alpha=1;
    if(actor.contact)actor.contact.alpha=0;
    if(actor.recoil)actor.recoil.alpha=0;
  }
  function sample(track,time){
    if(!track?.length)return[0,0,0];
    if(time<=track[0][0])return track[0].slice(1);
    for(let i=1;i<track.length;i++){const a=track[i-1],b=track[i];if(time<=b[0]){const t=(time-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);return[1,2,3].map(k=>(a[k]||0)+((b[k]||0)-(a[k]||0))*s);}}
    return track.at(-1).slice(1);
  }
  function validate(rig,{production=false}={}){
    const issues=[],ids=new Set();
    if(rig.schema!=='triad.part-rig.v1')issues.push('SCHEMA');
    if(!rig.source?.path||!rig.source?.sha256)issues.push('SOURCE_PROVENANCE');
    if(!['LEFT','RIGHT'].includes(rig.facing))issues.push('FACING');
    for(const part of rig.parts||[]){
      if(ids.has(part.id))issues.push(`DUPLICATE:${part.id}`);
      if(part.parent&&!ids.has(part.parent))issues.push(`PARENT_ORDER:${part.id}`);
      ids.add(part.id);
      if(!part.pivot?.every(Number.isFinite)||part.pivot.length!==2)issues.push(`PIVOT:${part.id}`);
      if(production&&part.sourceStatus!=='SOURCE_OK')issues.push(`SOURCE_GAP:${part.id}`);
      if(part.points?.length<3)issues.push(`GEOMETRY:${part.id}`);
    }
    for(const [id,socket] of Object.entries(rig.sockets||{}))if(!ids.has(socket.part)||!socket.point?.every(Number.isFinite))issues.push(`SOCKET:${id}`);
    for(const required of ['root','hit_primary','release'])if(!rig.sockets?.[required])issues.push(`MISSING_SOCKET:${required}`);
    if(production&&rig.visualAcceptance!=='USER_ACCEPTED')issues.push('VISUAL_HOLD');
    return issues;
  }
  class PartRig{
    constructor(rig,{production=false}={}){const issues=validate(rig,{production});if(issues.length)throw Error(issues.join(', '));this.data=rig;this.matrices=new Map();this.time=0;}
    update(time,action='attack'){
      this.time=time;
      for(const part of this.data.parts){
        const [angle=0,dx=0,dy=0]=sample(this.data.actions?.[action]?.tracks?.[part.id],time),r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r),[x,y]=part.pivot;
        const own=[c,s,-s,c,x-c*x+s*y+dx,y-s*x-c*y+dy];
        this.matrices.set(part.id,multiply(this.matrices.get(part.parent)||identity(),own));
      }
      return this;
    }
    socket(id,{x=0,y=0,scale=1,mirror=this.data.runtimeMirror===true}={}){const socket=this.data.sockets[id];if(!socket)throw Error(`Missing authored socket: ${id}`);const p=point(this.matrices.get(socket.part)||identity(),...socket.point);return{x:x+(mirror?this.data.source.width-p.x:p.x)*scale,y:y+p.y*scale};}
    vertices(part,output){const matrix=this.matrices.get(part.id)||identity();for(let i=0;i<part.points.length;i++){const p=point(matrix,...part.points[i]);output[i*2]=p.x;output[i*2+1]=p.y;}return output;}
  }
  return{PartRig,validate,sample,multiply,point,keepContinuousBody};
});
