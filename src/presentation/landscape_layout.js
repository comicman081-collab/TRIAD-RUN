/* A fixed 1080p PC game plane; touch screens retain their landscape controls. */
(()=>{
 const overlays=document.createElement('div');overlays.id='landscapeOverlays';
 for(const node of document.querySelectorAll('body>.modal,body>.idle-reward-modal,body>.triad-artifact-modal,body>.toast'))overlays.appendChild(node);
 document.body.appendChild(overlays);
 let view={width:1920,height:1080,scale:1,offsetX:0,offsetY:0,rotated:false,fixed1080:true};
 const originals=new WeakMap(),units=/(-?(?:\d*\.)?\d+)(d?v[wh]|s[v][wh]|l[v][wh])\b/g;
 // Viewport units otherwise track a 4K browser even inside a 1080p DOM plane.
 // Preserve the authored values so resize never compounds a previous conversion.
 function fitStyle(style){
  if(!style)return;let entries=originals.get(style);if(!entries){entries=new Map();originals.set(style,entries);}
  for(const name of Array.from(style)){
   const current=style.getPropertyValue(name),old=entries.get(name);
   if(old&&current===old.output)continue;
   units.lastIndex=0;if(!units.test(current))continue;
   entries.set(name,{source:current,priority:style.getPropertyPriority(name),output:null});
  }
  for(const [name,item] of entries){
   const output=item.source.replace(units,(_,number,unit)=>`${Number(number)*(unit.endsWith('w')?view.width:view.height)/100}px`);
   if(output!==item.output){style.setProperty(name,output,item.priority);item.output=output;}
  }
 }
 function fitRules(rules){for(const rule of rules||[]){if(rule.style)fitStyle(rule.style);if(rule.cssRules)fitRules(rule.cssRules);}}
 function fitStyles(){for(const sheet of document.styleSheets||[])try{fitRules(sheet.cssRules);}catch{} }
 function point(x,y){
  if(view.fixed1080)return{x:(x-view.offsetX)/view.scale,y:(y-view.offsetY)/view.scale};
  if(view.rotated){const a=document.getElementById('app').getBoundingClientRect();return{x:y-a.top,y:a.right-x};}
  return{x,y};
 }
 globalThis.TRIAD_LAYOUT={
  size:()=>({width:view.width,height:view.height}),density:()=>1,snapshot:()=>({...view}),point,
  rect(node){
   const r=node.getBoundingClientRect(),p=point(view.rotated?r.right:r.left,r.top);
   const width=(view.rotated?r.height:r.width)/(view.fixed1080?view.scale:1),height=(view.rotated?r.width:r.height)/(view.fixed1080?view.scale:1);
   return{left:p.x,top:p.y,x:p.x,y:p.y,width,height,right:p.x+width,bottom:p.y+height};
  }
 };
 function sync(){
  const touch=matchMedia('(hover:none) and (pointer:coarse)').matches;
  const rotated=matchMedia('(orientation:portrait) and (hover:none) and (pointer:coarse)').matches;
  const width=touch?Math.min(1920,rotated?innerHeight:innerWidth):1920,height=touch?Math.min(1080,rotated?innerWidth:innerHeight):1080;
  const scale=touch?1:Math.min(innerWidth/width,innerHeight/height,1/Math.max(1,devicePixelRatio||1));
  view={width,height,scale,offsetX:touch?0:(innerWidth-width*scale)/2,offsetY:touch?0:(innerHeight-height*scale)/2,rotated,fixed1080:!touch};
  const style=document.documentElement.style;style.setProperty('--game-width',`${width}px`);style.setProperty('--game-height',`${height}px`);
  document.documentElement.classList.toggle('game-fixed-1080',!touch);
  document.body.dataset.gameResolution=touch?'responsive-1080-cap':'1920x1080';
  const body=document.body.style;
  for(const name of ['position','width','height','min-height','margin','padding','left','top','transform','transform-origin','overflow'])body.removeProperty(name);
  if(!touch){
   const values={position:'fixed',width:'1920px',height:'1080px','min-height':'0',margin:'0',padding:'0',left:`${view.offsetX}px`,top:`${view.offsetY}px`,transform:`scale(${scale})`,'transform-origin':'0 0',overflow:'clip'};
   for(const [name,value]of Object.entries(values))body.setProperty(name,value,'important');
  }
  fitStyles();dispatchEvent(new Event('triad:resolution'));
 }
 addEventListener('resize',sync,{passive:true});sync();
 // Presentation modules add styles lazily. Only head changes are observed;
 // per-frame effects and actor DOM mutations never trigger this work.
 new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))fitStyles();}).observe(document.head,{childList:true,subtree:true});
 document.head.addEventListener('load',fitStyles,true);
})();
