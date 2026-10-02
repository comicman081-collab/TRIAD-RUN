/* Contact geometry uses the visible artwork, never a card's HP/header box. */
(function(root){
  'use strict';
  function bodyAnchor(host,stageRect){
    if(!host)return null;
    const surface=[...host.querySelectorAll('canvas,img')].find(node=>{
      const style=getComputedStyle(node);return style.display!=='none'&&style.visibility!=='hidden'&&node.getBoundingClientRect().width>0;
    });
    if(!surface)return null;
    const style=getComputedStyle(surface),rect=root.TRIAD_LAYOUT?.rect(surface)||surface.getBoundingClientRect();
    const width=parseFloat(style.width)||surface.offsetWidth,height=parseFloat(style.height)||surface.offsetHeight;
    if(!width||!height)return null;
    // Rig sockets are normalized in the rendered logical canvas, not in its
    // high-DPI backing buffer. Atlas actors use a torso point in the artwork.
    const point=surface._triadBodyPoint?.()||{x:.5,y:.55};
    let contentWidth=width,contentHeight=height;
    if(style.objectFit==='contain'){
      const iw=surface.naturalWidth||surface.width,ih=surface.naturalHeight||surface.height;
      if(iw&&ih){const scale=Math.min(width/iw,height/ih);contentWidth=iw*scale;contentHeight=ih*scale;}
    }
    const positions=style.objectPosition.split(' ');
    const fraction=(value,fallback)=>value?.endsWith('%')?parseFloat(value)/100:value==='left'||value==='top'?0:value==='right'||value==='bottom'?1:fallback;
    const x=(width-contentWidth)*fraction(positions[0],.5)+point.x*contentWidth;
    const y=(height-contentHeight)*fraction(positions[1],.5)+point.y*contentHeight;
    // Respect the existing left-facing mirror / perspective without treating
    // the transformed bounding rectangle as the untransformed sprite surface.
    const origin=style.transformOrigin.split(' ').map(parseFloat),matrix=new DOMMatrixReadOnly(style.transform==='none'?undefined:style.transform);
    function project(px,py){const p=matrix.transformPoint({x:px-(origin[0]||0),y:py-(origin[1]||0),z:0,w:1});return{x:p.x/p.w+(origin[0]||0),y:p.y/p.w+(origin[1]||0)};}
    const corners=[[0,0],[width,0],[0,height],[width,height]].map(p=>project(...p)),p=project(x,y);
    const left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y));
    return{x:rect.left-stageRect.left+p.x-left,y:rect.top-stageRect.top+p.y-top};
  }
  root.TRIAD_COMBAT_GEOMETRY={bodyAnchor};
})(globalThis);
