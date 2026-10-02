/* Combat tactics presentation: short battlefield callouts for engine events
   (break, boss phase, enemy guard/buff/debuff, enrage, event-boss bars).
   Display only - every number comes from src/triad_combat_engine.js. */
(function(root){
  'use strict';
  const MAX_VISIBLE=4,LIFETIME_MS=1500;
  let layer=null;
  function host(){
    const stage=document.querySelector('#combat .battle-stage');if(!stage)return null;
    if(!layer||!stage.contains(layer)){layer=document.createElement('div');layer.className='combat-callouts';layer.setAttribute('aria-live','polite');stage.appendChild(layer)}
    return layer
  }
  function show(text,tone){
    const target=host();if(!target||!document.getElementById('combat')?.classList.contains('active'))return;
    const node=document.createElement('div');node.className='combat-callout';node.dataset.tone=tone||'info';node.textContent=text;
    target.appendChild(node);while(target.children.length>MAX_VISIBLE)target.firstChild.remove();
    setTimeout(()=>node.remove(),LIFETIME_MS)
  }
  function callout(text,tone='info',delay=0){
    if(typeof document==='undefined'||!text)return false;
    if(delay>0)setTimeout(()=>show(text,tone),delay);else show(text,tone);
    return true
  }
  root.addEventListener('triad:enemy-phase',event=>callout(`PHASE ${event.detail?.phase||2}${event.detail?.label?` · ${event.detail.label}`:''}`,'danger',320));
  root.addEventListener('triad:event-boss-bar',event=>callout(`격파 ${event.detail?.bars||1}회 · 재생성`,'break',240));
  root.TRIAD_COMBAT_TACTICS=Object.freeze({callout});
})(window);
