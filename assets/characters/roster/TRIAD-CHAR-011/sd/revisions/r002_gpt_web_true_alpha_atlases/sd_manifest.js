window.TRIAD_SD_MANIFESTS = window.TRIAD_SD_MANIFESTS || {};
window.TRIAD_SD_MANIFESTS['TRIAD-CHAR-011'] = {
  schema:'triad.sd.bundle.v1',status:'PASS_ACTIVE_FINAL',characterId:'TRIAD-CHAR-011',revision:2,
  frameWidth:512,frameHeight:512,anchor:{x:256,y:493},faction:'PLAYER',battleLane:'LEFT',facing:'RIGHT',enemyLane:'RIGHT',runtimeMirror:false,
  clips:Object.fromEntries([
    ['enter',false,{land:39,ready:81}],['idle',true,{}],['attack',false,{release:36,projectile:36}],['skill',false,{effect:36}],['ultimate',false,{effect:39,impact:42}],['guard',false,{block:36,hold:48}],['hit',false,{impactReceived:12,maxRecoil:45}],['ko',false,{down:60,hold:81}],['victory',false,{pose:60,hold:81}]
  ].map(([clip,loop,events])=>[clip,{atlas:`assets/characters/roster/TRIAD-CHAR-011/sd/revisions/r002_gpt_web_true_alpha_atlases/sena_${clip}_r002_84f.webp`,frames:84,fps:30,columns:12,rows:7,loop,holdLastFrame:['ko','victory'].includes(clip),events,motion:'GPT_WEB_KEYPOSE_SOURCE',authoredPoseCadenceFps:10}])),
  assets:{},projectiles:{primary:{assetId:'TRIAD-SD-CHAR-011',path:'assets/characters/roster/TRIAD-CHAR-011/lobby/sena_lobby_rgba_v4_gpt_web_true_alpha.png',facing:'RIGHT',embeddedInCharacterAtlas:false}},
  runtimeEligible:true,localForgeUsed:false,localAssetGeneration:'GPT_WEB_KEYPOSE_ATLAS',modelFilesModified:false
};
