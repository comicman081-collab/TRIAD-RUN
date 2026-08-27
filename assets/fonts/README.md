# TRIAD runtime font

`NotoSansKR-VF.ttf` is the self-hosted Korean UI font for the browser runtime.

- Family: Noto Sans KR Variable
- Version: 2.04
- Runtime weights: 100–900
- License: SIL Open Font License 1.1 (`NotoSansKR-OFL.txt`)

Keep the full Korean font unless a replacement subset is generated from every
runtime string and verified by `tests/typography_contract.test.js`. The older
local runtime subset used by another project is incomplete for TRIAD's Korean
UI and must not be substituted directly.
