/* Fit the entire enemy surface below its HUD, including its facing transform.
   Runs on entry/surface replacement/resize only, never in the animation loop. */
(function(root){
  'use strict';
  function install(){
    const wrap=document.getElementById('enemySpriteWrap'),stage=document.querySelector('#combat .battle-stage');
    if(!wrap||!stage)return;
    const ownStyles=new WeakMap();let pending=0;
    const rect=node=>root.TRIAD_LAYOUT?.rect(node)||node.getBoundingClientRect();
    function fit(){
      pending=0;
      if(!document.getElementById('combat').classList.contains('active'))return;
      const host=wrap.querySelector('.enemy-visual');if(!host)return;
      const h=rect(host),s=rect(stage);if(!h.width||!s.height)return;
      const hud=[...host.querySelectorAll('.sd-name,.sd-mini-bar'),document.getElementById('enemyIntent')].filter(Boolean).map(rect);
      const top=Math.max(h.top,...hud.map(r=>r.bottom))+Math.max(10,s.height*.014);
      const bottom=Math.min(h.bottom,s.top+s.height*.72),left=h.left+h.width*.02,right=h.right-h.width*.02;
      const availableWidth=right-left,availableHeight=bottom-top;if(availableHeight<24)return;
      for(const canvas of host.querySelectorAll('canvas,img')){
        if(getComputedStyle(canvas).display==='none')continue;
        const ratio=(canvas.naturalWidth||canvas.width)/(canvas.naturalHeight||canvas.height);if(!ratio)continue;
        let width=Math.min(availableWidth,availableHeight*ratio),height=width/ratio;
        const put=(key,value)=>canvas.style.setProperty(key,value,'important');
        put('position','absolute');put('left','0px');put('top','0px');put('margin','0');put('max-width','none');put('max-height','none');
        // Perspective projection is non-linear. Refit its outer bounds instead
        // of clipping horns/weapons or assuming a square canvas stays square.
        for(let pass=0;pass<5;pass++){
          put('width',width+'px');put('height',height+'px');
          const r=rect(canvas),scale=Math.min(1,availableWidth/r.width,availableHeight/r.height);
          if(scale>=.999)break;width*=scale*.997;height*=scale*.997;
        }
        const r=rect(canvas);
        put('left',(left+(availableWidth-r.width)*.5-r.left)+'px');
        put('top',(bottom-r.bottom)+'px');
        canvas.dataset.hudFit='below-hud';ownStyles.set(canvas,canvas.getAttribute('style'));
      }
    }
    function schedule(){if(!pending)pending=requestAnimationFrame(fit);}
    const mutations=new MutationObserver(records=>{
      if(records.some(record=>record.type==='childList'||record.attributeName==='data-load-status'||record.target.getAttribute('style')!==ownStyles.get(record.target)))schedule();
    });
    mutations.observe(wrap,{childList:true,subtree:true,attributes:true,attributeFilter:['style','data-load-status']});
    const resize=new ResizeObserver(schedule);resize.observe(stage);resize.observe(wrap);
    root.addEventListener('resize',schedule,{passive:true});
    root.addEventListener('pagehide',()=>{mutations.disconnect();resize.disconnect();if(pending)cancelAnimationFrame(pending);},{once:true});
    root.TRIAD_ENEMY_LAYOUT={fit,schedule};schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(globalThis);
