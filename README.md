# TRIAD // RUN

Deck building game.

## 실행

- 무클릭 타이틀 음악을 포함한 권장 실행: `TRIAD_RUN_자동음악_시작.cmd`
- 직접 실행: `TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html`

권장 실행 파일은 로컬 서버와 전용 Chromium 앱 창을 열며, 게임 화면을 닫으면 서버도 종료합니다.

## 테스트

```powershell
node --test tests/*.test.js
node tools/validate_triad_arch.js
```

## 저장소 범위

이 저장소에는 실행에 필요한 게임 코드, 런타임 이미지/오디오 에셋, 테스트와 도구가 포함됩니다. 로컬 백업, 마이그레이션 사본, Blender 제작 원본, 미사용 음원 라이브러리 및 감사 산출물은 `.gitignore`로 제외됩니다.

배포 설정은 포함하지 않습니다.
