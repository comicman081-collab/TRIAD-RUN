/* Hash-locked native sources; metadata only, no image preload. */
(function(root){'use strict';
const sources=[
  {
    "id": "AEGIS_M13",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/AEGIS_M13/AEGIS_M13_CLEAN_v2_RGBA.webp",
    "sha256": "b2a729decaeab2135a48f881717bca3110f972dbec2fc60dee101bd39e7049fe"
  },
  {
    "id": "AEGIS_M14",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/AEGIS_M14/AEGIS_M14_CLEAN_v2_RGBA.webp",
    "sha256": "4a7f3024599e7872f52d947b5d173648076125c1c299d5e53c0a2521b939debd"
  },
  {
    "id": "AEGIS_M15",
    "version": "v3",
    "output": "assets/enemies/hd_replacements/AEGIS_M15/AEGIS_M15_CLEAN_v3_RGBA.webp",
    "sha256": "0100be6a85781b1af34882932ba16b0e2be5832a292e31b8aa87fe0ff9bd37e5"
  },
  {
    "id": "BLOOM_M13",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/BLOOM_M13/BLOOM_M13_CLEAN_v2_RGBA.webp",
    "sha256": "64fb1bb3afdf9896eae377cf1b69d7edada8be66c1ad710ba69499bbdb34d275"
  },
  {
    "id": "BLOOM_M14",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/BLOOM_M14/BLOOM_M14_CLEAN_v2_RGBA_matte3.webp",
    "sha256": "61e34cfa326514a50d2bb5b47b8a3bf540f09500916494df78713c8a226e031e"
  },
  {
    "id": "BLOOM_M15",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/BLOOM_M15/BLOOM_M15_CLEAN_v2_RGBA_matte3.webp",
    "sha256": "03ddac53825be4537aad77901ada9e6a8eec6c856155f507f766f0d5c9fef919"
  },
  {
    "id": "EMBER_M13",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/EMBER_M13/EMBER_M13_CLEAN_v2_RGBA.webp",
    "sha256": "35c08064ea41de4ad8cb793c5bdb0d221eb05b9aeab0b7f86db300c710ae2668"
  },
  {
    "id": "EMBER_M14",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/EMBER_M14/EMBER_M14_CLEAN_v2_RGBA.webp",
    "sha256": "ef16cb7cde894bb0dcf8ec833754371eb3a66384c8132062211b892981c3f758"
  },
  {
    "id": "EMBER_M15",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/EMBER_M15/EMBER_M15_CLEAN_v2_RGBA.webp",
    "sha256": "6048c2b48bfd9f25cbc5e17ddf4fedce70d67eb780cf17bf6219726ddc22b498"
  },
  {
    "id": "RIFT_M13",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/RIFT_M13/RIFT_M13_CLEAN_v2_RGBA.webp",
    "sha256": "5a1a0cffee64e1d51216f0b849a0ab160df87fe9e6541d3b18d614df6920df19"
  },
  {
    "id": "RIFT_M14",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/RIFT_M14/RIFT_M14_CLEAN_v2_RGBA.webp",
    "sha256": "72e33c5d05fb9e6f09c6ba580bbeec54d3f588c8f636201f4af9c37a2919c79f"
  },
  {
    "id": "RIFT_M15",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/RIFT_M15/RIFT_M15_CLEAN_v2_RGBA.webp",
    "sha256": "7d3eff59849e2fbb30854e0c02b738c9cf643e124fa4827866801eb467f3295f"
  },
  {
    "id": "SHADE_M13",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/SHADE_M13/SHADE_M13_CLEAN_v2_RGBA.webp",
    "sha256": "837b06e2c99f5d85f7434c9ed7023e5a25d39c4619658e85fc61e597d168e3f6"
  },
  {
    "id": "SHADE_M14",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/SHADE_M14/SHADE_M14_CLEAN_v2_RGBA.webp",
    "sha256": "fd6411fd321468650790d253eed1ad4108f5efff3325de5f69a79c8ed622e77d"
  },
  {
    "id": "VOLT_M13",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/VOLT_M13/VOLT_M13_CLEAN_v2_RGBA.webp",
    "sha256": "838169f6e0ad653ed91158dbd356a33463309e15ef9d127763ebfc73d290848e"
  },
  {
    "id": "VOLT_M14",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/VOLT_M14/VOLT_M14_CLEAN_v2_RGBA.webp",
    "sha256": "b59b227d3e63d3b806ec76218de695006112a789d8ab5f25a9aaf0b066de6dac"
  },
  {
    "id": "VOLT_M15",
    "version": "v2",
    "output": "assets/enemies/hd_replacements/VOLT_M15/VOLT_M15_CLEAN_v2_RGBA_matte3.webp",
    "sha256": "2abd36f0fc927d9a67c6fec29803952d512957376fb2b7a88aee0a94f5fa4372"
  }
];
root.TRIAD_BOSS_REPLACEMENT_SOURCES=sources;
if(typeof module==='object'&&module.exports)module.exports=sources;
})(globalThis);

