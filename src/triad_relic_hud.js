(function attachTriadArtifactHud(global) {
  'use strict';

  const STORAGE_KEY = 'triad_active_run';
  const STYLE_ID = 'triad-artifact-hud-style';
  const MODAL_ID = 'triadOwnedArtifactModal';
  const TOP_BUTTON_ID = 'triadOwnedArtifactButton';
  const COMBAT_BUTTON_ID = 'triadCombatArtifactButton';
  const ROUTE_STRIP_ID = 'triadOwnedArtifactStrip';

  function activeRun() {
    try {
      if (typeof run !== 'undefined' && run && Array.isArray(run.artifacts)) return run;
    } catch (_) {}
    try {
      const raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function artifactDefinitions() {
    try {
      if (typeof ARTIFACTS !== 'undefined' && Array.isArray(ARTIFACTS)) return ARTIFACTS;
    } catch (_) {}
    return [];
  }

  function ownedArtifacts() {
    const state = activeRun();
    const ids = state && Array.isArray(state.artifacts) ? state.artifacts : [];
    const defs = artifactDefinitions();
    return ids.map(id => defs.find(item => item && item.id === id) || {
      id,
      name: String(id || '알 수 없는 유물'),
      text: '효과 정보를 불러오지 못했습니다.'
    });
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .triad-artifact-hud-button{min-height:0;padding:9px 11px;border-color:#8669c8;background:linear-gradient(180deg,#33294d,#201c31);color:#eee7ff;white-space:nowrap}
      .triad-artifact-hud-button:hover{border-color:#b89cff;filter:brightness(1.12)}
      .triad-artifact-route-label{cursor:pointer;border-color:#8067bb!important;color:#eadfff!important;background:#29223c!important;user-select:none}
      .triad-artifact-route-label:focus-visible{outline:2px solid #b89cff;outline-offset:2px}
      .triad-artifact-route-strip{display:flex;align-items:center;gap:8px;overflow-x:auto;margin:-2px 0 12px;padding:8px 10px;border:1px solid #3a3255;border-radius:14px;background:linear-gradient(90deg,rgba(43,34,64,.8),rgba(16,20,30,.68));scrollbar-width:thin}
      .triad-artifact-route-strip[hidden]{display:none}
      .triad-artifact-strip-title{flex:0 0 auto;color:#c9b8f7;font-size:11px;font-weight:900;letter-spacing:.08em}
      .triad-artifact-mini{flex:0 0 auto;min-height:0;padding:7px 10px;border-radius:999px;border-color:#66558f;background:#211b31;color:#f0eaff;font-size:11px;box-shadow:none}
      .triad-artifact-modal{position:fixed;inset:0;z-index:140;display:none;place-items:center;padding:18px;background:rgba(3,4,9,.84);backdrop-filter:blur(6px)}
      .triad-artifact-modal.open{display:grid}
      .triad-artifact-dialog{width:min(780px,100%);max-height:min(82vh,760px);overflow:auto;border:1px solid #554879;border-radius:20px;background:linear-gradient(180deg,#1b1727,#10131d);box-shadow:0 24px 70px rgba(0,0,0,.58);padding:18px}
      .triad-artifact-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
      .triad-artifact-dialog-head h2{margin:2px 0 3px}.triad-artifact-dialog-head p{margin:0;color:#aebbd1;font-size:12px}
      .triad-artifact-close{min-height:0;padding:8px 11px}
      .triad-artifact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
      .triad-artifact-card{padding:14px;border:1px solid #493f67;border-radius:15px;background:linear-gradient(180deg,#29213c,#171624)}
      .triad-artifact-card strong{display:block;margin-bottom:7px;color:#f5f0ff;font-size:16px}.triad-artifact-card p{margin:0;color:#c6bfd5;font-size:13px;line-height:1.55}
      .triad-artifact-empty{padding:22px 14px;text-align:center;border:1px dashed #4b435d;border-radius:14px;color:#aebbd1}
      @media(max-width:560px){.triad-artifact-hud-button{padding:8px 9px;font-size:11px}.triad-artifact-route-strip{margin-top:0}.triad-artifact-dialog{padding:14px}.triad-artifact-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function makeButton(id, label, className) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = className || 'triad-artifact-hud-button';
    button.textContent = label;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', MODAL_ID);
    button.addEventListener('click', openArtifactModal);
    return button;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'triad-artifact-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', `${MODAL_ID}Title`);
    modal.innerHTML = `
      <div class="triad-artifact-dialog">
        <div class="triad-artifact-dialog-head">
          <div><div class="muted small">CURRENT RUN</div><h2 id="${MODAL_ID}Title">보유 유물</h2><p id="${MODAL_ID}Summary"></p></div>
          <button type="button" class="triad-artifact-close" aria-label="보유 유물 창 닫기">닫기</button>
        </div>
        <div id="${MODAL_ID}Grid" class="triad-artifact-grid"></div>
      </div>`;
    modal.querySelector('.triad-artifact-close').addEventListener('click', closeArtifactModal);
    modal.addEventListener('click', event => {
      if (event.target === modal) closeArtifactModal();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function ensureTopButton() {
    let button = document.getElementById(TOP_BUTTON_ID);
    if (button) return button;
    const row = document.querySelector('#app > .topbar > .row') || document.querySelector('.topbar .row');
    if (!row) return null;
    button = makeButton(TOP_BUTTON_ID, '◈ 유물 0', 'triad-artifact-hud-button');
    const saveState = row.querySelector('#saveState');
    if (saveState && saveState.nextSibling) row.insertBefore(button, saveState.nextSibling);
    else row.prepend(button);
    return button;
  }

  function ensureCombatButton() {
    let button = document.getElementById(COMBAT_BUTTON_ID);
    if (button) return button;
    const meta = document.querySelector('#combat .jrpg-meta');
    if (!meta) return null;
    button = makeButton(COMBAT_BUTTON_ID, '◈ 유물 0', 'triad-artifact-hud-button');
    const endTurn = meta.querySelector('#endTurnControl');
    meta.insertBefore(button, endTurn || null);
    return button;
  }

  function enhanceRouteLabel() {
    const label = document.getElementById('artifactLabel');
    if (!label || label.dataset.artifactHudBound === '1') return label;
    label.dataset.artifactHudBound = '1';
    label.classList.add('triad-artifact-route-label');
    label.setAttribute('role', 'button');
    label.setAttribute('tabindex', '0');
    label.setAttribute('aria-haspopup', 'dialog');
    label.setAttribute('aria-controls', MODAL_ID);
    label.title = '보유 유물과 효과 확인';
    label.addEventListener('click', openArtifactModal);
    label.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openArtifactModal();
      }
    });
    return label;
  }

  function ensureRouteStrip() {
    let strip = document.getElementById(ROUTE_STRIP_ID);
    if (strip) return strip;
    const routePanel = document.querySelector('#route .panel');
    const title = routePanel && routePanel.querySelector('.section-title');
    if (!routePanel || !title) return null;
    strip = document.createElement('div');
    strip.id = ROUTE_STRIP_ID;
    strip.className = 'triad-artifact-route-strip';
    strip.hidden = true;
    title.insertAdjacentElement('afterend', strip);
    return strip;
  }

  function renderModal() {
    const modal = ensureModal();
    const artifacts = ownedArtifacts();
    const summary = modal.querySelector(`#${MODAL_ID}Summary`);
    const grid = modal.querySelector(`#${MODAL_ID}Grid`);
    summary.textContent = artifacts.length ? `이번 런에서 획득한 유물 ${artifacts.length}개 · 효과는 현재 전투에 적용 중입니다.` : '이번 런에서 아직 획득한 유물이 없습니다.';
    grid.replaceChildren();
    if (!artifacts.length) {
      const empty = document.createElement('div');
      empty.className = 'triad-artifact-empty';
      empty.textContent = '아직 보유한 유물이 없습니다.';
      grid.appendChild(empty);
      return;
    }
    artifacts.forEach(artifact => {
      const card = document.createElement('article');
      card.className = 'triad-artifact-card';
      const name = document.createElement('strong');
      name.textContent = `◈ ${artifact.name}`;
      const text = document.createElement('p');
      text.textContent = artifact.text || '효과 설명 없음';
      card.append(name, text);
      grid.appendChild(card);
    });
  }

  function openArtifactModal() {
    const modal = ensureModal();
    renderModal();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const close = modal.querySelector('.triad-artifact-close');
    if (close) close.focus();
  }

  function closeArtifactModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderRouteStrip(strip, artifacts) {
    if (!strip) return;
    strip.replaceChildren();
    if (!artifacts.length) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    const title = document.createElement('span');
    title.className = 'triad-artifact-strip-title';
    title.textContent = '보유 유물';
    strip.appendChild(title);
    artifacts.forEach(artifact => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'triad-artifact-mini';
      chip.textContent = `◈ ${artifact.name}`;
      chip.title = artifact.text || '';
      chip.addEventListener('click', openArtifactModal);
      strip.appendChild(chip);
    });
  }

  function refresh() {
    ensureStyle();
    ensureModal();
    const state = activeRun();
    const artifacts = ownedArtifacts();
    const hasRun = Boolean(state && Array.isArray(state.artifacts));
    const topButton = ensureTopButton();
    const combatButton = ensureCombatButton();
    const routeLabel = enhanceRouteLabel();
    const routeStrip = ensureRouteStrip();
    const names = artifacts.map(item => item.name).join(', ');

    if (topButton) {
      topButton.hidden = !hasRun;
      topButton.textContent = `◈ 유물 ${artifacts.length}`;
      topButton.title = artifacts.length ? `보유 유물: ${names}` : '보유 유물 없음';
    }
    if (combatButton) {
      combatButton.hidden = !hasRun;
      combatButton.textContent = `◈ 유물 ${artifacts.length}`;
      combatButton.title = artifacts.length ? `보유 유물: ${names}` : '보유 유물 없음';
    }
    if (routeLabel && hasRun) {
      routeLabel.textContent = `유물 ${artifacts.length}개 · 확인`;
      routeLabel.title = artifacts.length ? `${names} · 눌러서 효과 확인` : '보유 유물 없음 · 눌러서 확인';
    }
    renderRouteStrip(routeStrip, artifacts);

    const modal = document.getElementById(MODAL_ID);
    if (modal && modal.classList.contains('open')) renderModal();
  }

  function bind() {
    ensureStyle();
    ensureModal();
    refresh();
    global.addEventListener('storage', event => {
      if (!event.key || event.key === STORAGE_KEY) refresh();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeArtifactModal();
    });
    global.setInterval(refresh, 900);
  }

  global.TRIAD_ARTIFACT_HUD = Object.freeze({ refresh, open: openArtifactModal, close: closeArtifactModal });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})(typeof window !== 'undefined' ? window : globalThis);
