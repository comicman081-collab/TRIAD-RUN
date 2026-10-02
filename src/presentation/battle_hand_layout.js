(()=>{
 const hand=document.getElementById('hand');if(!hand)return;
 const panel=hand.closest('.combat-panel-v05');
 const endTurn=document.getElementById('endTurnControl');if(endTurn)panel.appendChild(endTurn);
 const turn=document.getElementById('turnLabel');if(turn)panel.appendChild(turn);
 const energy=document.getElementById('energyLabel')?.closest('.resource');if(energy){energy.classList.add('battle-energy');panel.appendChild(energy);}
 const autoBattle=document.getElementById('autoBattleToggle');if(autoBattle)panel.appendChild(autoBattle);
 const transfers=new Set();
 const piles={};
 for(const [kind,label] of [['draw','뽑기 덱'],['discard','버림 덱']]){
  const button=document.createElement('button');button.type='button';button.className=`battle-pile battle-pile-${kind}`;button.innerHTML=`<span class="pile-icon" aria-hidden="true">▱</span><b>0</b><small>${label}</small>`;button.setAttribute('aria-label',label+' 확인');panel.appendChild(button);piles[kind]=button;
  button.onclick=()=>{
   panel.querySelector('.deck-inspector')?.remove();const box=document.createElement('section');box.className='deck-inspector';box.setAttribute('role','dialog');box.setAttribute('aria-label',label);
   const title=document.createElement('h3');title.textContent=label;box.appendChild(title);const close=document.createElement('button');close.textContent='닫기';close.onclick=()=>box.remove();box.appendChild(close);
   const description=document.createElement('p');description.textContent=kind==='draw'?'카드를 사용한 수만큼 즉시 보충합니다. 뽑기 덱이 비면 버림 덱을 섞습니다. 미사용 손패는 다음 턴에도 유지됩니다.':'사용한 일반 카드만 모입니다. 턴을 종료해도 미사용 손패는 버리지 않습니다. 소모·전투불능 캐릭터 카드는 재순환에서 제외됩니다.';box.appendChild(description);
   const list=document.createElement('ul');const states=(typeof run!=='undefined'?run?.combat?.[kind]:[])||[];
   // Do not expose the next-draw order: show the pile alphabetically.
   const names=states.map(s=>typeof ALL_CARDS!=='undefined'?(ALL_CARDS[s.id]?.name||s.id):s.id).sort();
   for(const name of names){const row=document.createElement('li');row.textContent=name;list.appendChild(row);}if(!names.length){const row=document.createElement('li');row.textContent='비어 있음';list.appendChild(row);}box.appendChild(list);panel.appendChild(box);
  };
 }
 function updateCounts(){for(const kind of ['draw','discard'])piles[kind].querySelector('b').textContent=document.getElementById(kind==='draw'?'drawLabel':'discardLabel')?.textContent||'0';}
 for(const id of ['drawLabel','discardLabel']){const node=document.getElementById(id);if(node)new MutationObserver(updateCounts).observe(node,{childList:true,characterData:true,subtree:true});}
 function transfer(card,target,reverse=false){
  if(transfers.size>=3||!panel.closest('.screen.active')||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const p=TRIAD_LAYOUT.rect(panel),from=TRIAD_LAYOUT.rect(card),to=TRIAD_LAYOUT.rect(target),ghost=card.cloneNode(true);
  ghost.removeAttribute('onclick');ghost.removeAttribute('style');ghost.removeAttribute('id');ghost.setAttribute('aria-hidden','true');ghost.className='card-pile-transfer';Object.assign(ghost.style,{left:`${from.left-p.left+from.width/2}px`,top:`${from.top-p.top+from.height/2}px`});panel.appendChild(ghost);
  const x=to.left+to.width/2-from.left-from.width/2,y=to.top+to.height/2-from.top-from.height/2;
  const anim=ghost.animate([{transform:'translate(-50%,-50%) scale(.8)',opacity:1},{transform:`translate(calc(-50% + ${x*.45}px),calc(-50% + ${y*.4-45}px)) scale(.65) rotate(${reverse?-12:12}deg)`,opacity:1},{transform:`translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(.12) rotate(${reverse?-22:22}deg)`,opacity:0}],{duration:460,easing:'ease-in-out'});
  const item={anim,ghost};transfers.add(item);const clean=()=>{ghost.remove();transfers.delete(item);};anim.finished.then(clean,clean);
 }
 addEventListener('triad:card-settled',event=>{
  const card=[...hand.querySelectorAll('.hand-card')].find(el=>el.dataset.cardId===event.detail.cardId);
  if(card&&event.detail.destination==='discard')transfer(card,piles.discard);
 });
 addEventListener('triad:deck-reshuffled',()=>{transfer(piles.discard,piles.draw,true);piles.draw.classList.add('reshuffled');setTimeout(()=>piles.draw.classList.remove('reshuffled'),700);});
 addEventListener('resize',()=>{for(const item of transfers){item.anim.cancel();item.ghost.remove();}transfers.clear();});
 updateCounts();
 const hint=document.createElement('div');hint.className='hand-help';hint.textContent='카드 터치: 확대\n한 번 더: 사용';hint.style.whiteSpace='pre-line';panel.appendChild(hint);
 let inspected=null,preview=null,touchArmed=null;
 function clear(){inspected?.classList.remove('hand-inspected');inspected=null;touchArmed=null;preview?.remove();preview=null;}
 function inspect(card){
  clear();inspected=card;
  preview=card.cloneNode(true);preview.removeAttribute('onclick');preview.removeAttribute('style');preview.className='hand-inspection-preview';preview.setAttribute('role','button');preview.tabIndex=0;preview.setAttribute('aria-label','확대한 카드 사용');
  preview.addEventListener('click',()=>{const original=inspected;clear();original?.click();});
  preview.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();preview.click();}});
  panel.appendChild(preview);
 }
 function arrange(){
  if(inspected&&!inspected.isConnected)clear();
  const cards=[...hand.querySelectorAll('.hand-card')],width=hand.clientWidth;
  const cardWidth=cards[0]?.offsetWidth||148;
  const step=Math.max(0,Math.min(cardWidth*.88,(width*.66-cardWidth)/Math.max(1,cards.length-1)));
  cards.forEach((card,i)=>{
   const offset=i-(cards.length-1)/2,normalized=offset/Math.max(1,(cards.length-1)/2);
   card.style.setProperty('--fan-x',`${offset*step}px`);card.style.setProperty('--fan-y',`${Math.abs(normalized)*4}px`);card.style.setProperty('--fan-angle',`${normalized*3}deg`);card.style.setProperty('--fan-order',String(i+1));
   card.tabIndex=0;card.setAttribute('role','button');
  });
  hint.hidden=!cards.length||!matchMedia('(pointer:coarse)').matches;
 }
 // Touch first inspects the authored card at full size; second touch uses the
 // existing inline card handler. No transaction/damage/cost code is duplicated.
 hand.addEventListener('click',event=>{
  const card=event.target.closest('.hand-card');if(!card)return;
  if(event.pointerType!=='touch')return;
  if(touchArmed!==card){event.preventDefault();event.stopImmediatePropagation();inspect(card);touchArmed=card;}
  else clear();
 },true);
 document.addEventListener('pointerdown',event=>{if(!hand.contains(event.target)&&!preview?.contains(event.target))clear();});
 // Small resting cards never need unreadably compressed rule text. A single
 // explicit preview retains the original art/rules and original play handler.
 hand.addEventListener('pointerover',event=>{const card=event.target.closest('.hand-card');if(card&&event.pointerType==='mouse'&&inspected!==card)inspect(card);});
 hand.addEventListener('focusin',event=>{const card=event.target.closest('.hand-card');if(card?.matches(':focus-visible')&&inspected!==card)inspect(card);});
 hand.addEventListener('keydown',event=>{const card=event.target.closest('.hand-card');if(card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();card.click();}if(event.key==='Escape')clear();});
 panel.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'&&!event.target.closest('.hand-card,.hand-inspection-preview'))clear();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')clear();});
 new MutationObserver(arrange).observe(hand,{childList:true});
 new ResizeObserver(arrange).observe(panel);addEventListener('resize',arrange,{passive:true});arrange();
})();
