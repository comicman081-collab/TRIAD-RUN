(function (global) {
  'use strict';

  // Visible alpha bounds (threshold > 24) of the twelve active lobby masters.
  // The masters stay untouched; only their presentation within UI frames changes.
  const SOURCE_WIDTH = 1024;
  const SOURCE_HEIGHT = 1536;
  const BOUNDS = Object.freeze({
    'TRIAD-CHAR-001': [20, 62, 1005, 1476],
    'TRIAD-CHAR-002': [97, 6, 1021, 1528],
    'TRIAD-CHAR-003': [59, 236, 1007, 1326],
    'TRIAD-CHAR-004': [35, 10, 997, 1529],
    'TRIAD-CHAR-005': [73, 4, 958, 1487],
    'TRIAD-CHAR-006': [65, 2, 1017, 1525],
    'TRIAD-CHAR-007': [2, 0, 1021, 1534],
    'TRIAD-CHAR-008': [4, 13, 1008, 1531],
    'TRIAD-CHAR-009': [96, 27, 816, 1503],
    'TRIAD-CHAR-010': [3, 22, 1022, 1496],
    'TRIAD-CHAR-011': [11, 18, 1024, 1514],
    'TRIAD-CHAR-012': [3, 3, 1023, 1535]
  });

  function plan(characterId, frameWidth, frameHeight) {
    const bounds = BOUNDS[characterId];
    if (!bounds || !(frameWidth > 0) || !(frameHeight > 0)) return null;
    const [left, top, right, bottom] = bounds;
    const scale = Math.min(frameWidth * .9 / (right - left), frameHeight * .9 / (bottom - top));
    return {
      width: SOURCE_WIDTH * scale,
      height: SOURCE_HEIGHT * scale,
      left: frameWidth / 2 - (left + right) * scale / 2,
      top: frameHeight / 2 - (top + bottom) * scale / 2
    };
  }

  function fit(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    let count = 0;
    root.querySelectorAll('[data-roster-art-frame]').forEach(frame => {
      const image = frame.querySelector('img[data-roster-art]');
      if (!image) return;
      const layout = plan(frame.dataset.rosterArtFrame, frame.clientWidth, frame.clientHeight);
      if (!layout) return;
      for (const [key, value] of Object.entries(layout)) image.style[key] = `${value}px`;
      count++;
    });
    return count;
  }

  const api = Object.freeze({ BOUNDS, plan, fit });
  global.TRIAD_ROSTER_ART_LAYOUT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
