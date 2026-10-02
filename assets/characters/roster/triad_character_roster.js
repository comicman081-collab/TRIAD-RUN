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
        path: 'assets/characters/roster/TRIAD-CHAR-001/lobby/ember_standing_rgba_imagegen_20260924_v1.webp',
        crop: 'FULL_BODY',
        sha256: '903C4296B0C410D62799B8FB28CD276B2B4C057271EF76555390F51A426991CB',
        provenance: 'IMAGEGEN_20260924_NEW_STANDING_IDENTITY_ALPHA_QA',
        reason: 'STARTER_STANDING_AND_SELECT_REPAINT_20260924'
      },
      sourceArt: { width: 1024, height: 1536, sha256: '903C4296B0C410D62799B8FB28CD276B2B4C057271EF76555390F51A426991CB' },
      signatureCardId: 'EMBER_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r055_codex_keypose_atlases/sd_manifest.json',
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
        path: 'assets/characters/roster/TRIAD-CHAR-002/lobby/volt_standing_rgba_imagegen_20260924_v1.webp',
        crop: 'FULL_BODY',
        sha256: '11F2C8F37E4F5C677B2E6B7542815BBDCE022C8C5A4EB4D4B6A364E80D6A78EE',
        provenance: 'IMAGEGEN_20260924_NEW_STANDING_IDENTITY_ALPHA_QA',
        reason: 'STARTER_STANDING_AND_SELECT_REPAINT_20260924'
      }, signatureCardId: 'VOLT_15',
      sourceArt: { width: 1024, height: 1536, sha256: '11F2C8F37E4F5C677B2E6B7542815BBDCE022C8C5A4EB4D4B6A364E80D6A78EE' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r028_codex_keypose_atlases/sd_manifest.json',
        }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-003', name: '에이기스', coreId: 'AEGIS', role: '보호막 / 반격', element: 'GUARD',
      fullArt: 'card_art/signature/aegis.webp', portrait: 'card_art/signature/aegis.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-003/lobby/aegis_standing_rgba_imagegen_20260924_v1.webp',
        crop: 'FULL_BODY',
        sha256: '776371822C4247EC53574FE1AD6A59AD255232F43BE5F570300CC7365617F44E',
        provenance: 'IMAGEGEN_20260924_NEW_STANDING_IDENTITY_ALPHA_QA',
        reason: 'STARTER_STANDING_AND_SELECT_REPAINT_20260924'
      }, signatureCardId: 'AEGIS_15',
      sourceArt: { width: 1024, height: 1536, sha256: '776371822C4247EC53574FE1AD6A59AD255232F43BE5F570300CC7365617F44E' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r024_codex_keypose_atlases/sd_manifest.json',
        }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-004', name: '셰이드', coreId: 'SHADE', role: '표식 / 연계', element: 'SHADOW',
      fullArt: 'card_art/signature/shade.webp', portrait: 'card_art/signature/shade.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-004/lobby/shade_standing_rgba_imagegen_20260924_v2_bow.webp',
        crop: 'FULL_BODY',
        sha256: 'A56446064C889F05463DA75430BC2753FA78689CEA5163A76556C7ED7B4B69D0',
        provenance: 'IMAGEGEN_20260924_NEW_STANDING_IDENTITY_ALPHA_QA',
        reason: 'STARTER_STANDING_AND_SELECT_REPAINT_20260924'
      }, signatureCardId: 'SHADE_15',
      sourceArt: { width: 1024, height: 1536, sha256: 'A56446064C889F05463DA75430BC2753FA78689CEA5163A76556C7ED7B4B69D0' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-004/sd/revisions/r011_codex_keypose_atlases/sd_manifest.json',
        }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-005', name: '블룸', coreId: 'BLOOM', role: '회복 / 집중', element: 'NATURE',
      fullArt: 'card_art/signature/bloom.webp', portrait: 'card_art/signature/bloom.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-005/lobby/bloom_standing_rgba_imagegen_20260924_v1.webp',
        crop: 'FULL_BODY',
        sha256: '03737C68517E062EED44739A2FA0D481BC77E47A6B557FD373D3B45BCD477800',
        provenance: 'IMAGEGEN_20260924_NEW_STANDING_IDENTITY_ALPHA_QA',
        reason: 'STARTER_STANDING_AND_SELECT_REPAINT_20260924'
      }, signatureCardId: 'BLOOM_15',
      sourceArt: { width: 1024, height: 1536, sha256: '03737C68517E062EED44739A2FA0D481BC77E47A6B557FD373D3B45BCD477800' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-005/sd/revisions/r011_codex_keypose_atlases/sd_manifest.json',
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
        path: 'assets/characters/roster/TRIAD-CHAR-006/lobby/rift_standing_rgba_imagegen_20260924_v1.webp',
        crop: 'FULL_BODY',
        sha256: '48A4F864A2A32411D1B2014D92C7CE47FF819FF4D74B657AF20ADB26D4598158',
        provenance: 'IMAGEGEN_20260924_NEW_STANDING_IDENTITY_ALPHA_QA',
        reason: 'STARTER_STANDING_AND_SELECT_REPAINT_20260924'
      },
      signatureCardId: 'RIFT_15',
      sourceArt: { width: 1024, height: 1536, sha256: '48A4F864A2A32411D1B2014D92C7CE47FF819FF4D74B657AF20ADB26D4598158' },
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r011_codex_keypose_atlases/sd_manifest.json',
        }, acquisition: 'STARTER', gachaEligible: false, enabled: true
    },
    {
      id: 'TRIAD-CHAR-007', name: '세라프', coreId: 'AEGIS', role: '방벽 핵 / 반격', element: 'GUARD',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-007/lobby/seraph_lobby_rgba_v4_gpt_web.webp',
      portrait: 'assets/characters/roster/TRIAD-CHAR-007/lobby/seraph_lobby_rgba_v4_gpt_web.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-007/lobby/seraph_lobby_rgba_v4_gpt_web.webp',
        crop: 'KNEE_UP',
        sha256: '3908A9EECC776F4E82A812314BE8EE9E821B6CC18CC3B720389C23B145FC0497',
        provenance: 'GPT_WEB_V4_COSTUME_CONTINUITY_PASS', reason: 'SERAPH_V4_GPT_WEB_LOBBY_ALPHA_PASS'
      }, signatureCardId: 'AEGIS_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-007/sd/revisions/r001_gpt_web_v4_keypose_atlases/sd_manifest.json',
        }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-008', name: '리라', coreId: 'EMBER', role: '화염 창격 / 연소', element: 'FIRE',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-008/lobby/lyra_lobby_rgba_v1_gpt_web.webp',
      portrait: 'assets/characters/roster/TRIAD-CHAR-008/lobby/lyra_lobby_rgba_v1_gpt_web.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-008/lobby/lyra_lobby_rgba_v1_gpt_web.webp',
        crop: 'KNEE_UP',
        sha256: '9F29CD6C6A1F52D2370217FEA3623281F19C4592489A08CE0D8925FA810ACE2C',
        provenance: 'GPT_WEB_V1_LOCAL_COSTUME_CONTINUITY_PASS', reason: 'LYRA_V1_GPT_WEB_LOBBY_ALPHA_PASS'
      }, signatureCardId: 'EMBER_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-008/sd/revisions/r001_gpt_web_v1_keypose_atlases/sd_manifest.json',
        }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-009', name: '카이아', coreId: 'VOLT', role: '레일블레이드 / 감전', element: 'LIGHTNING',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-009/lobby/kaia_lobby_rgba_v2_gpt_web_sam2_tight.webp',
      portrait: 'assets/characters/roster/TRIAD-CHAR-009/lobby/kaia_lobby_rgba_v2_gpt_web_sam2_tight.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-009/lobby/kaia_lobby_rgba_v2_gpt_web_sam2_tight.webp',
        crop: 'KNEE_UP',
        sha256: '034B02EA11BE3C3677F7884D04FE2DBCB234BEEFDDBA263434A328AD5A738C25',
        provenance: 'GPT_WEB_V1_LOCAL_DINO_SAM2_COSTUME_CONTINUITY_PASS', reason: 'KAIA_V1_AUTHORITY_ALPHA_PASS'
      }, signatureCardId: 'VOLT_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-009/sd/revisions/r001_authority_texture_atlases/sd_manifest.json',
        }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-010', name: '녹스', coreId: 'SHADE', role: '사슬 표식 / 연계', element: 'SHADOW',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-010/lobby/nox_lobby_rgba_v6_gpt_web_true_alpha.webp',
      portrait: 'assets/characters/roster/TRIAD-CHAR-010/lobby/nox_lobby_rgba_v6_gpt_web_true_alpha.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-010/lobby/nox_lobby_rgba_v6_gpt_web_true_alpha.webp',
        crop: 'KNEE_UP',
        sha256: '424421C07BCAC96F1AF8A1BA066A392A0BAAD8B960DD8537793EA373E485BE84',
        provenance: 'GPT_WEB_NATIVE_RGBA_LOCAL_COSTUME_CONTINUITY_PASS', reason: 'NOX_V1_TRUE_ALPHA_COMPLETE_SILHOUETTE_PASS'
      }, signatureCardId: 'SHADE_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-010/sd/revisions/r002_gpt_web_true_alpha_atlases/sd_manifest.json',
        }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-011', name: '세나', coreId: 'BLOOM', role: '생체 치유 / 집중', element: 'NATURE',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-011/lobby/sena_lobby_rgba_v4_gpt_web_true_alpha.webp',
      portrait: 'assets/characters/roster/TRIAD-CHAR-011/lobby/sena_lobby_rgba_v4_gpt_web_true_alpha.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-011/lobby/sena_lobby_rgba_v4_gpt_web_true_alpha.webp',
        crop: 'KNEE_UP',
        sha256: '46CE6F110D0CDE3B2F7E170B3812A33F179D99C8AFDD7F35F909C61D2DAF895B',
        provenance: 'GPT_WEB_NATIVE_RGBA_LOCAL_COSTUME_CONTINUITY_PASS', reason: 'SENA_V1_TRUE_ALPHA_COMPLETE_SILHOUETTE_PASS'
      }, signatureCardId: 'BLOOM_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-011/sd/revisions/r002_gpt_web_true_alpha_atlases/sd_manifest.json',
        }, acquisition: 'GACHA', gachaEligible: true, enabled: true
    },
    {
      id: 'TRIAD-CHAR-012', name: '벨라', coreId: 'RIFT', role: '특이점 / 에너지 소모', element: 'RIFT',
      fullArt: 'assets/characters/roster/TRIAD-CHAR-012/lobby/vela_lobby_rgba_v1_gpt_web_true_alpha.webp',
      portrait: 'assets/characters/roster/TRIAD-CHAR-012/lobby/vela_lobby_rgba_v1_gpt_web_true_alpha.webp',
      lobbyArt: {
        status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
        backgroundRemoved: true, alphaValidated: true,
        path: 'assets/characters/roster/TRIAD-CHAR-012/lobby/vela_lobby_rgba_v1_gpt_web_true_alpha.webp',
        crop: 'KNEE_UP',
        sha256: 'C2EFC00AA68C95CA08D592B8D9E01DA945EAB932B51737ED5DD1F19F531077E8',
        provenance: 'GPT_WEB_NATIVE_RGBA_LOCAL_COSTUME_CONTINUITY_PASS', reason: 'VELA_V1_TRUE_ALPHA_COMPLETE_SILHOUETTE_PASS'
      }, signatureCardId: 'RIFT_15',
      sd: {
        status: 'PASS_ACTIVE_FINAL',
        manifest: 'assets/characters/roster/TRIAD-CHAR-012/sd/revisions/r001_gpt_web_true_alpha_atlases/sd_manifest.json',
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
