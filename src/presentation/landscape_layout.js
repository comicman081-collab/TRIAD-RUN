/* Always render landscape; never gate rotation or disable user input. */
(()=>{
 const overlays=document.createElement('div');overlays.id='landscapeOverlays';
 for(const node of document.querySelectorAll('body>.modal,body>.idle-reward-modal,body>.triad-artifact-modal,body>.toast'))overlays.appendChild(node);
 document.body.appendChild(overlays);
 // DOM rectangles are screen-space after CSS rotation; effects need logical
 // battlefield coordinates. Keep authored release/contact positions aligned.
 globalThis.TRIAD_LAYOUT={rect(node){
  const r=node.getBoundingClientRect();
  if(!matchMedia('(orientation:portrait) and (hover:none) and (pointer:coarse)').matches)return r;
  const a=document.getElementById('app').getBoundingClientRect();
  const left=r.top-a.top,top=a.right-r.right;
  return{left,top,x:left,y:top,width:r.height,height:r.width,right:left+r.height,bottom:top+r.width};
 }};
 function sync(){
  const rotated=matchMedia('(orientation:portrait) and (hover:none) and (pointer:coarse)').matches;
  document.documentElement.style.setProperty('--game-height',`${rotated?innerWidth:innerHeight}px`);
 }
 addEventListener('resize',sync,{passive:true});sync();
})();
