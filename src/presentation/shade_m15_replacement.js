/* One versioned source/rig definition shared by normal play and the review build. */
(function(root){'use strict';
  const spec={id:'SHADE_M15',base:'assets/enemies/hd_replacements/SHADE_M15/',file:'SHADE_M15_CLEAN_v2_RGBA.webp',
    green:'source_assets/enemies/replacements_20260913/SHADE_M15/SHADE_M15_CLEAN_v2_GREEN.webp',
    sourceSha256:'23cc1edd5b15b3ae1ef25ef4c7054145b89b9df72c244a25bcc0251986c2ee8b',
    sourceWidth:1536,sourceHeight:1024,artVersion:'CLEAN_v2_20260913',className:'shade-m15-clean-replacement',
    status:'LOCAL_REPLACEMENT_USER_VISUAL_REVIEW_PENDING',scale:.40,sceneX:66,sceneY:30,
    anchor:[230,530],hitAnchor:[795,410],continuity:'ONE_SOURCE_CONTINUOUS_MESH_NO_STATE_IMAGE_SWAPS',
    regions:{
      crown:{home:[780,230],radius:[235,235]},crescent:{home:[260,540],radius:[390,450]},
      counterClaw:{home:[1200,400],radius:[300,280]},mantle:{home:[1100,760],radius:[460,270]},
      chest:{home:[800,365],radius:[170,165]}
    },
    tracks:{
      crown:[[0,0,0,0],[220,-1,0,0],[460,-3,-4,0],[720,3,4,1],[980,1,2,0],[1240,-.5,0,0],[1540,0,0,0]],
      crescent:[[0,0,0,0],[220,3,8,2],[460,12,-35,-12],[720,-15,-64,18],[980,-6,-26,8],[1240,2,5,-2],[1540,0,0,0]],
      counterClaw:[[0,0,0,0],[220,-2,0,2],[460,-9,12,7],[720,13,26,-8],[980,5,12,-4],[1240,-2,0,1],[1540,0,0,0]],
      mantle:[[0,0,0,0],[220,2,2,3],[460,6,-8,8],[720,-7,12,-8],[980,-3,5,-4],[1240,1,0,1],[1540,0,0,0]],
      chest:[[0,0,0,0],[220,0,0,0],[460,-1,-2,1],[720,1,2,0],[980,.4,0,0],[1240,0,0,0],[1540,0,0,0]]
    },motion:[[0,0,0,0],[220,0,0,0],[460,-2,-7,2],[720,3,7,-2],[980,1,3,-1],[1240,0,0,0],[1540,0,0,0]]};
  root.TRIAD_BOSS_ART_SPECS={...(root.TRIAD_BOSS_ART_SPECS||{}),[spec.id]:spec};
  if(typeof module==='object'&&module.exports)module.exports=spec;
})(globalThis);
