/* SD frame normalization: one uniform scale per atlas frame so a character's
   on-screen size never pumps between poses or clips, and every party member
   shares the same head-top-to-feet standing height.  Presentation only; the
   authored atlases are drawn unmodified, just placed with a similarity map.

   The canvas gains a MARGIN of transparent room on every side so poses that
   are enlarged back to their true size are not clipped at the 512 frame edge.
   CSS scales the canvas by (FRAME + 2*MARGIN)/FRAME around its centre, which
   keeps the original 512 frame exactly on the element's layout box. */
(function(root){
  'use strict';
  const data=()=>root.TRIAD_SD_FRAME_NORMALIZATION_DATA||null;

  function character(characterId){
    return data()?.characters?.[String(characterId||'')]||null;
  }

  function surfaceSize(){
    const d=data();return d?d.frame+d.margin*2:0;
  }

  // Resize the backing store once and expose the unchanged torso anchor to
  // TRIAD_COMBAT_GEOMETRY, which reads points in logical canvas space.
  function prepare(canvas,characterId){
    const d=data();
    if(!canvas||!d||!character(characterId))return false;
    const size=surfaceSize();
    if(canvas.width!==size)canvas.width=size;
    if(canvas.height!==size)canvas.height=size;
    if(canvas.dataset)canvas.dataset.sdNormalized='1';
    canvas._triadBodyPoint=()=>({x:.5,y:(d.margin+d.frame*.55)/size});
    return true;
  }

  function frameScale(spec,frame){
    const value=Array.isArray(spec.scale)?spec.scale[Math.max(0,Math.min(spec.scale.length-1,frame|0))]:spec.scale;
    return Number(value)||1;
  }

  // Destination rectangle, in canvas pixels, for one atlas frame.  The frame
  // is scaled about its foot pivot and the feet land on the shared baseline.
  function destination(characterId,clip,frame,canvasWidth){
    const d=data(),entry=character(characterId);
    if(!d||!entry)return null;
    const spec=entry.clips?.[clip]||entry.clips?.idle;
    if(!spec)return null;
    const k=(Number(entry.global)||1)*frameScale(spec,frame);
    const unit=(Number(canvasWidth)||surfaceSize())/surfaceSize();
    const x=d.margin+d.pivotX*(1-k);
    const y=d.margin+d.baselineY-(Number(spec.lift)||0)*k-spec.pivotY*k;
    return{x:x*unit,y:y*unit,size:d.frame*k*unit,scale:k};
  }

  // Shared draw used by every SdBattleActor implementation.
  function draw(actor,atlas,clip,frame,sx,sy,sw,sh){
    const canvas=actor?.canvas,ctx=actor?.ctx;
    if(!canvas||!ctx||canvas.dataset?.sdNormalized!=='1')return false;
    const rect=destination(actor.characterId,clip,frame,canvas.width);
    if(!rect)return false;
    const composite=ctx.globalCompositeOperation;
    ctx.globalCompositeOperation='source-over';
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';
    ctx.drawImage(atlas,sx,sy,sw,sh,rect.x,rect.y,rect.size,rect.size);
    ctx.globalCompositeOperation=composite;
    canvas.dataset.sdScale=rect.scale.toFixed(3);
    return true;
  }

  root.TRIAD_SD_NORMALIZATION=Object.freeze({
    get version(){return data()?.version||'';},
    prepare,destination,draw,surfaceSize
  });
})(globalThis);
