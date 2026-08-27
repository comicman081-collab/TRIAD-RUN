(function (global) {
  'use strict';

  const records = [
    {
      id: 'TRIAD-CHAR-001',
      name: '엠버',
      coreId: 'EMBER',
      role: '화상 / 폭발',
      element: 'FIRE',
      fullArt: 'card_art/signature/ember.webp',
      portrait: 'card_art/signature/ember.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-001/lobby/ember_lobby_rgba_v11_registered_clean_alpha.png',
        sourceArt: 'card_art/signature/ember.webp', crop: 'KNEE_UP',
        sha256: '3A48413C90E3164BBC2D408E50466E8FA874561DD90B86D8345130A4CA47D768',
        provenance: 'LOCAL_BLENDER_CHECKER_ALL_NEUTRAL_ALPHA_COSTUME_CONTINUITY_PASS',
        reason: 'EMBER_V2_CHECKER_RESIDUE_REMOVED_ALPHA_QA_PASS'
      },
      sourceArt: { width: 768, height: 1152, sha256: '11A30C2E8E6156D3B4BA9A489079417B60BD51BD18610F2C3A604638E35C6C62' },
      signatureCardId: 'EMBER_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r054_blender_nineclip_manifest/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-001/sd/pilot_v7_identity/ember_sd_idle_rgba_v7_identity_motifs_v2.png'
      },
      acquisition: 'STARTER', gachaEligible: false,
      enabled: true
    },
    {
      id: 'TRIAD-CHAR-002', name: '볼트', coreId: 'VOLT', role: '감전 / 연쇄', element: 'LIGHTNING',
      fullArt: 'card_art/signature/volt.webp', portrait: 'card_art/signature/volt.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-002/lobby/volt_lobby_rgba_v10_registered.png',
        sourceArt: 'card_art/signature/volt.webp', crop: 'KNEE_UP',
        sha256: 'A160CE90C536452B401F70D3C5AAC4CCE987BD576D962E453634DC9B2D267D0E',
        provenance: 'LOCAL_DINO_SAM2_ORIGINAL_RGB_ALPHA_COMPONENT_CLEANUP_BLENDER_REGISTRATION',
        reason: 'LOBBY_6_RGBA_CONTACT_V3_GPT_WEB_PASS'
      }, signatureCardId: 'VOLT_15',
      sourceArt: { width: 768, height: 1152, sha256: '67DCE7E1B13544E6EAAA92088E71D2C95CB7019FB5AB185C4FE080B4E1D7FA74' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r027_blender_nineclip_manifest/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r020_blender_idle_canonical_84f/unique_poses/pose_00.png'
      }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-003', name: '에이기스', coreId: 'AEGIS', role: '보호막 / 반격', element: 'GUARD',
      fullArt: 'card_art/signature/aegis.webp', portrait: 'card_art/signature/aegis.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-003/lobby/aegis_lobby_rgba_v13_registered.png',
        sourceArt: 'card_art/signature/aegis.webp', crop: 'KNEE_UP',
        sha256: '35A45DEB7C0E2EBC3885FB8F40FB91EA90E3DFAABC82AC9706FCCE2F17A75793',
        provenance: 'IMAGEGEN_SCENE_REMOVAL_CAPE_REPAIR_BLENDER_CHECKER_ALPHA_REGISTRATION',
        reason: 'LOBBY_6_RGBA_CONTACT_V3_GPT_WEB_PASS'
      }, signatureCardId: 'AEGIS_15',
      sourceArt: { width: 768, height: 1152, sha256: 'B7D28CB1D638174F93D88B060AE9729AB5DC82C46D787662507E33ED5D399B17' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r023_blender_nineclip_manifest/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r007_blender_idle_equipment_safe_84f/unique_poses/pose_00.png'
      }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-004', name: '셰이드', coreId: 'SHADE', role: '표식 / 연계', element: 'SHADOW',
      fullArt: 'card_art/signature/shade.webp', portrait: 'card_art/signature/shade.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-004/lobby/shade_lobby_rgba_v3_registered.png',
        sourceArt: 'card_art/signature/shade.webp', crop: 'KNEE_UP',
        sha256: 'A12D07EA3597163A980BD2BA6300DEC7C481B2F3B4BD066428DD86411F217C51',
        provenance: 'LOCAL_DINO_SAM2_ORIGINAL_RGB_ALPHA_ONLY_BLENDER_REGISTRATION',
        reason: 'LOBBY_6_RGBA_CONTACT_V3_GPT_WEB_PASS'
      }, signatureCardId: 'SHADE_15',
      sourceArt: { width: 768, height: 1152, sha256: 'E2276B81914058FD80725C97347D2D3CE74FFD742B19E8C9B0BFE7F5C6AE7622' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-004/sd/revisions/r010_blender_nineclip_manifest/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-004/sd/revisions/r001_blender_idle_canonical_84f/unique_poses/pose_00.png'
      }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-005', name: '블룸', coreId: 'BLOOM', role: '회복 / 집중', element: 'NATURE',
      fullArt: 'card_art/signature/bloom.webp', portrait: 'card_art/signature/bloom.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-005/lobby/bloom_lobby_rgba_v6_registered.png',
        sourceArt: 'card_art/signature/bloom.webp', crop: 'KNEE_UP',
        sha256: 'E4DAD0F9F89983C2BCB1663D326338A2A40E5F6713C94B1C29143DCB74C8F067',
        provenance: 'IMAGEGEN_SCENE_REMOVAL_ROBE_REPAIR_BLENDER_CHECKER_ALPHA_REGISTRATION',
        reason: 'LOBBY_6_RGBA_CONTACT_V3_GPT_WEB_PASS'
      }, signatureCardId: 'BLOOM_15',
      sourceArt: { width: 768, height: 1152, sha256: '4C269BB8F9F1E8F8B325952A16DC00C4C276B7211664CA82DF765472F79C08BA' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-005/sd/revisions/r010_blender_nineclip_manifest/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-005/sd/revisions/r001_blender_idle_canonical_84f/unique_poses/pose_00.png'
      }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-006', name: '리프트', coreId: 'RIFT', role: '에너지 / 소모', element: 'RIFT',
      fullArt: 'card_art/signature/rift.webp', portrait: 'card_art/signature/rift.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE',
        assetType: 'NON_SD_CHARACTER_RGBA',
        backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true,
        alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-006/lobby/rift_lobby_rgba_v5_registered.png',
        sourceArt: 'card_art/signature/rift.webp',
        crop: 'KNEE_UP',
        sha256: '98F3C31C999657A012973E4219F09F66BD1013C63F06DBBF5249E946F1866E5A',
        provenance: 'LOCAL_DINO_SAM2_ORIGINAL_RGB_ALPHA_ONLY_BLENDER_REGISTRATION',
        reason: 'RIFT_LOBBY_RGBA_PILOT_VISUAL_GATE_CANDIDATE'
      },
      signatureCardId: 'RIFT_15',
      sourceArt: { width: 768, height: 1152, sha256: '7B2224B275583019AF56BBF620454B32F2761242222F64F799A313629CCB6455' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r010_blender_nineclip_manifest/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r001_blender_idle_canonical_84f/unique_poses/pose_00.png'
      }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-007', name: '세라프', coreId: 'AEGIS', role: '방벽 핵 / 반격', element: 'GUARD',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-007/lobby/seraph_lobby_rgba_v4_gpt_web.png',
      portrait: 'assets/characters/roster/TRIAD-CHAR-007/lobby/seraph_lobby_rgba_v4_gpt_web.png',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-007/lobby/seraph_lobby_rgba_v4_gpt_web.png',
        sourceArt: 'assets/characters/roster/TRIAD-CHAR-007/lobby/seraph_lobby_rgba_v4_gpt_web.png', crop: 'KNEE_UP',
        sha256: '3908A9EECC776F4E82A812314BE8EE9E821B6CC18CC3B720389C23B145FC0497',
        provenance: 'GPT_WEB_V4_COSTUME_CONTINUITY_PASS', reason: 'SERAPH_V4_GPT_WEB_LOBBY_ALPHA_PASS'
      }, signatureCardId: 'AEGIS_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-007/sd/revisions/r001_gpt_web_v4_keypose_atlases/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-007/sd/source_generation/gpt_web_v4_keyposes/seraph_v4_9pose_contact.png'
      }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-008', name: '리라', coreId: 'EMBER', role: '화염 창격 / 연소', element: 'FIRE',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-008/lobby/lyra_lobby_rgba_v1_gpt_web.png',
      portrait: 'assets/characters/roster/TRIAD-CHAR-008/lobby/lyra_lobby_rgba_v1_gpt_web.png',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-008/lobby/lyra_lobby_rgba_v1_gpt_web.png',
        sourceArt: 'assets/characters/roster/TRIAD-CHAR-008/source/lyra_authority_gpt_web_v1.png', crop: 'KNEE_UP',
        sha256: '9F29CD6C6A1F52D2370217FEA3623281F19C4592489A08CE0D8925FA810ACE2C',
        provenance: 'GPT_WEB_V1_LOCAL_COSTUME_CONTINUITY_PASS', reason: 'LYRA_V1_GPT_WEB_LOBBY_ALPHA_PASS'
      }, signatureCardId: 'EMBER_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-008/sd/revisions/r001_gpt_web_v1_keypose_atlases/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-008/sd/source_generation/gpt_web_v1_keyposes/lyra_v1_9pose_contact.png'
      }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-009', name: '카이아', coreId: 'VOLT', role: '레일블레이드 / 감전', element: 'LIGHTNING',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-009/lobby/kaia_lobby_rgba_v2_gpt_web_sam2_tight.png',
      portrait: 'assets/characters/roster/TRIAD-CHAR-009/lobby/kaia_lobby_rgba_v2_gpt_web_sam2_tight.png',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-009/lobby/kaia_lobby_rgba_v2_gpt_web_sam2_tight.png',
        sourceArt: 'assets/characters/roster/TRIAD-CHAR-009/source/kaia_authority_gpt_web_v1.png', crop: 'KNEE_UP',
        sha256: '034B02EA11BE3C3677F7884D04FE2DBCB234BEEFDDBA263434A328AD5A738C25',
        provenance: 'GPT_WEB_V1_LOCAL_DINO_SAM2_COSTUME_CONTINUITY_PASS', reason: 'KAIA_V1_AUTHORITY_ALPHA_PASS'
      }, signatureCardId: 'VOLT_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-009/sd/revisions/r001_authority_texture_atlases/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-009/lobby/kaia_lobby_rgba_v2_gpt_web_sam2_tight.png'
      }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-010', name: '녹스', coreId: 'SHADE', role: '사슬 표식 / 연계', element: 'SHADOW',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-010/lobby/nox_lobby_rgba_v6_gpt_web_true_alpha.png',
      portrait: 'assets/characters/roster/TRIAD-CHAR-010/lobby/nox_lobby_rgba_v6_gpt_web_true_alpha.png',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-010/lobby/nox_lobby_rgba_v6_gpt_web_true_alpha.png',
        sourceArt: 'assets/characters/roster/TRIAD-CHAR-010/source/nox_authority_gpt_web_v1.png', crop: 'KNEE_UP',
        sha256: '424421C07BCAC96F1AF8A1BA066A392A0BAAD8B960DD8537793EA373E485BE84',
        provenance: 'GPT_WEB_NATIVE_RGBA_LOCAL_COSTUME_CONTINUITY_PASS', reason: 'NOX_V1_TRUE_ALPHA_COMPLETE_SILHOUETTE_PASS'
      }, signatureCardId: 'SHADE_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-010/sd/revisions/r002_gpt_web_true_alpha_atlases/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-010/lobby/nox_lobby_rgba_v6_gpt_web_true_alpha.png'
      }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-011', name: '세나', coreId: 'BLOOM', role: '생체 치유 / 집중', element: 'NATURE',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-011/lobby/sena_lobby_rgba_v4_gpt_web_true_alpha.png',
      portrait: 'assets/characters/roster/TRIAD-CHAR-011/lobby/sena_lobby_rgba_v4_gpt_web_true_alpha.png',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-011/lobby/sena_lobby_rgba_v4_gpt_web_true_alpha.png',
        sourceArt: 'assets/characters/roster/TRIAD-CHAR-011/source/sena_authority_gpt_web_v1.png', crop: 'KNEE_UP',
        sha256: '46CE6F110D0CDE3B2F7E170B3812A33F179D99C8AFDD7F35F909C61D2DAF895B',
        provenance: 'GPT_WEB_NATIVE_RGBA_LOCAL_COSTUME_CONTINUITY_PASS', reason: 'SENA_V1_TRUE_ALPHA_COMPLETE_SILHOUETTE_PASS'
      }, signatureCardId: 'BLOOM_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-011/sd/revisions/r002_gpt_web_true_alpha_atlases/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-011/lobby/sena_lobby_rgba_v4_gpt_web_true_alpha.png'
      }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-012', name: '벨라', coreId: 'RIFT', role: '특이점 / 에너지 소모', element: 'RIFT',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-012/lobby/vela_lobby_rgba_v1_gpt_web_true_alpha.png',
      portrait: 'assets/characters/roster/TRIAD-CHAR-012/lobby/vela_lobby_rgba_v1_gpt_web_true_alpha.png',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-012/lobby/vela_lobby_rgba_v1_gpt_web_true_alpha.png',
        sourceArt: 'assets/characters/roster/TRIAD-CHAR-012/source/vela_authority_gpt_web_v1.png', crop: 'KNEE_UP',
        sha256: 'C2EFC00AA68C95CA08D592B8D9E01DA945EAB932B51737ED5DD1F19F531077E8',
        provenance: 'GPT_WEB_NATIVE_RGBA_LOCAL_COSTUME_CONTINUITY_PASS', reason: 'VELA_V1_TRUE_ALPHA_COMPLETE_SILHOUETTE_PASS'
      }, signatureCardId: 'RIFT_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-012/sd/revisions/r001_gpt_web_true_alpha_atlases/sd_manifest.json',
        idlePreview: 'assets/characters/roster/TRIAD-CHAR-012/lobby/vela_lobby_rgba_v1_gpt_web_true_alpha.png'
      }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    }
  ];

  const byId = Object.freeze(Object.fromEntries(records.map(record => [record.id, Object.freeze(record)])));
  const byCore = Object.freeze(Object.fromEntries(records.filter(record => record.acquisition !== 'GACHA').map(record => [record.coreId, byId[record.id]])));
  const lobbyForegroundContract = Object.freeze({
    assetType: 'NON_SD_CHARACTER_RGBA',
    backgroundPolicy: 'TRANSPARENT_ONLY',
    sourceBackgroundAllowed: false,
    crop: 'KNEE_UP',
    pathPattern: 'assets/characters/roster/{characterId}/lobby/'
  });

  global.TRIAD_CHARACTER_ROSTER = Object.freeze({
    version: '1.0.20-gacha-six-complete',
    selectionCount: 3,
    pilotCharacterId: 'TRIAD-CHAR-001',
    lobbyForegroundContract,
    records: Object.freeze(records.map(record => byId[record.id])),
    byId,
    byCore
  });
})(window);
