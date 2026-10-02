/* Presentation-only action clocks. Keep logical atlas/event frames intact. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TRIAD_SD_ACTION_TIMING=api})(globalThis,function(){
  'use strict';
  function timeline(clip,name){
    const fps=Math.max(1,Number(clip?.fps)||30),frames=Math.max(1,Number(clip?.frames)||1);
    const action=['attack','skill','ultimate'].includes(name),events=clip?.events||{};
    const cue=[events.release,events.projectile,events.effect,events.impact].find(Number.isFinite);
    let startFrame=0;
    if(action){
      if(Array.isArray(clip?.frameMap)){
        // Only remove proven repeated pre-roll, not an authored moving wind-up.
        const first=clip.frameMap.findIndex(cell=>cell!==clip.frameMap[0]);
        if(first>fps*.3)startFrame=Math.max(0,first-Math.ceil(fps*.1));
      }else if(clip?.motion==='CODEX_KEYPOSE_TIMELINE'&&cue>fps*.5){
        // These source atlases have the same pre-roll before export deduplication.
        startFrame=Math.max(0,cue-Math.ceil(fps*.3));
      }
    }
    startFrame=Math.min(frames-1,startFrame);
    // Pose-only clips have no event metadata: let the 90ms incoming fade finish.
    return{startFrame,startMs:startFrame*1000/fps,cueMs:action?(Number.isFinite(cue)?Math.max(0,(cue-startFrame)*1000/fps):100):0,durationMs:(frames-startFrame)*1000/fps};
  }
  return Object.freeze({version:'sd-action-timing-1.0.0',timeline});
});
