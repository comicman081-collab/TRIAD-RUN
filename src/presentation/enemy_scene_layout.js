/* Fit the entire enemy surface below its HUD, including its facing transform.
   Runs on entry/surface replacement/resize only, never in the animation loop. */
(function(root){
  'use strict';
  function install(){
    const wrap=document.getElementById('enemySpriteWrap'),stage=document.querySelector('#combat .battle-stage');
    if(!wrap||!stage)return;
    const ownStyles=new WeakMap(),fittedBounds=new WeakMap(),observedHud=new Set();let pending=0;
    const rect=node=>root.TRIAD_LAYOUT?.rect(node)||node.getBoundingClientRect();
    function fit(){
      pending=0;
      if(!document.getElementById('combat').classList.contains('active'))return;
      const host=wrap.querySelector('.enemy-visual');if(!host)return;
      const screen=rect(stage),width=stage.offsetWidth||screen.width,height=stage.offsetHeight||screen.height;
      if(!width||!height)return;
      const sx=screen.width/width||1,sy=screen.height/height||1;
      // Camera translation/zoom changes screen-space bounds, not layout units.
      // Fitting during a shake or resize must not bake that zoom into the art.
      const local=node=>{const r=rect(node);return{left:(r.left-screen.left)/sx,right:(r.right-screen.left)/sx,top:(r.top-screen.top)/sy,bottom:(r.bottom-screen.top)/sy,width:r.width/sx,height:r.height/sy}};
      const h=local(host),s={top:0,height};if(!h.width)return;
      const hud=[...host.querySelectorAll('.sd-name'),document.getElementById('enemyIntent')].filter(Boolean).map(local);
      // Reserve the overhead HP lane as well as the name and intent. A bar
      // accidentally flowing below the actor must not erase the fit area.
      const headerEnd=Math.max(h.top,...hud.map(r=>r.bottom));
      for(const bar of host.querySelectorAll('.sd-mini-bar')){
        const r=local(bar);if(r.top>=h.top-1&&r.top<=headerEnd+24)hud.push(r);
      }
      const top=Math.max(h.top,...hud.map(r=>r.bottom))+Math.max(10,s.height*.014);
      const bottom=Math.min(h.bottom,s.top+s.height*.72),left=h.left+h.width*.02,right=h.right-h.width*.02;
      const availableWidth=right-left,availableHeight=bottom-top;if(availableHeight<24)return;
      for(const canvas of host.querySelectorAll('canvas,img')){
        if(getComputedStyle(canvas).display==='none')continue;
        const ratio=(canvas.naturalWidth||canvas.width)/(canvas.naturalHeight||canvas.height);if(!ratio)continue;
        const bounds=[top,bottom,left,right,ratio].map(n=>Math.round(n*10000)/10000).join('|');
        if(fittedBounds.get(canvas)===bounds&&ownStyles.get(canvas)===canvas.getAttribute('style'))continue;
        let width=Math.min(availableWidth,availableHeight*ratio),height=width/ratio;
        const put=(key,value)=>canvas.style.setProperty(key,value,'important');
        put('position','absolute');put('left','0px');put('top','0px');put('margin','0');put('max-width','none');put('max-height','none');
        // Perspective projection is non-linear. Refit its outer bounds instead
        // of clipping horns/weapons or assuming a square canvas stays square.
        for(let pass=0;pass<5;pass++){
          put('width',width+'px');put('height',height+'px');
          const r=local(canvas),scale=Math.min(1,availableWidth/r.width,availableHeight/r.height);
          if(scale>=.999)break;width*=scale*.997;height*=scale*.997;
        }
        const r=local(canvas);
        put('left',(left+(availableWidth-r.width)*.5-r.left)+'px');
        put('top',(bottom-r.bottom)+'px');
        canvas.dataset.hudFit='below-hud';ownStyles.set(canvas,canvas.getAttribute('style'));fittedBounds.set(canvas,bounds);
      }
    }
    function schedule(){if(!pending)pending=requestAnimationFrame(fit);}
    const surface=node=>node?.matches?.('canvas,img');
    const containsSurface=node=>surface(node)||Boolean(node?.querySelector?.('canvas,img'));
    const resize=new ResizeObserver(schedule);resize.observe(stage);resize.observe(wrap);
    function observeHud(){
      for(const node of observedHud)if(!node.isConnected){resize.unobserve(node);observedHud.delete(node);}
      for(const node of [...wrap.querySelectorAll('.sd-name,.sd-mini-bar'),document.getElementById('enemyIntent')].filter(Boolean)){
        if(!observedHud.has(node)){observedHud.add(node);resize.observe(node);}
      }
    }
    const mutations=new MutationObserver(records=>{
      // HP fill widths and repeated name text updates do not change the enemy
      // surface bounds. ResizeObserver handles actual HUD size changes.
      const changed=records.some(record=>record.type==='childList'
        ? [...record.addedNodes,...record.removedNodes].some(containsSurface)
        : surface(record.target)
          ? record.attributeName!=='style'||record.target.getAttribute('style')!==ownStyles.get(record.target)
          : record.target.matches?.('.enemy-visual')&&record.attributeName==='style');
      if(changed){observeHud();schedule();}
    });
    mutations.observe(wrap,{childList:true,subtree:true,attributes:true,attributeFilter:['style','data-load-status','width','height']});
    observeHud();
    root.addEventListener('resize',schedule,{passive:true});
    root.addEventListener('pagehide',()=>{mutations.disconnect();resize.disconnect();if(pending)cancelAnimationFrame(pending);},{once:true});
    root.TRIAD_ENEMY_LAYOUT={fit,schedule};schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(globalThis);
