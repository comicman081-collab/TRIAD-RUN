/* Register all remaining bosses for both normal play and the review build. */
(function(root){'use strict';
 const geometry=root.TRIAD_BOSS_REPLACEMENT_GEOMETRY||[],sources=root.TRIAD_BOSS_REPLACEMENT_SOURCES||[];
 if(geometry.length!==17||sources.length!==17)throw Error('Incomplete boss replacement definitions');
 const track=(w,c,r)=>[[0,0,0,0],[220,...w.map(x=>x*.3)],[460,...w],[720,...c],[980,...r],[1240,...r.map(x=>-x*.2)],[1540,0,0,0]];
 const specs={};
 for(const row of geometry){
  const source=sources.find(x=>x.id===row.id);if(!source)throw Error('Missing boss source '+row.id);
  const regions={},tracks={};
  for(const [name,p] of Object.entries(row.parts)){regions[name]={home:p.slice(0,2),radius:p.slice(2,4)};tracks[name]=track(...p.slice(4));}
  specs[row.id]={id:row.id,base:source.output.slice(0,source.output.lastIndexOf('/')+1),file:source.output.split('/').at(-1),
   green:'source_assets/enemies/replacements_20260913/'+row.id+'/'+row.id+'_CLEAN_'+source.version+'_GREEN.webp',
   sourceSha256:source.sha256,sourceWidth:1536,sourceHeight:1024,artVersion:'CLEAN_'+source.version+'_20260913',
   className:row.id.toLowerCase().replaceAll('_','-')+'-clean-replacement',status:'LOCAL_REPLACEMENT_USER_VISUAL_REVIEW_PENDING',
   scale:.40,sceneX:66,sceneY:30,anchor:row.anchor,hitAnchor:row.hit,regions,tracks,motion:track(...row.move),
   action:row.action,continuity:'ONE_SOURCE_CONTINUOUS_MESH_NO_STATE_IMAGE_SWAPS'};
 }
 root.TRIAD_BOSS_ART_SPECS={...(root.TRIAD_BOSS_ART_SPECS||{}),...specs};
 if(typeof module==='object'&&module.exports)module.exports=specs;
})(globalThis);
