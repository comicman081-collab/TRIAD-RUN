/* TRIAD // RUN authoritative transaction helpers.
   This module is deterministic, serializable, and intentionally UI-agnostic. */
(function attachTriadTransactions(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TRIAD_TXN = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function triadTransactionsFactory() {
  'use strict';

  function requireRun(run) {
    if (!run || typeof run !== 'object') throw new Error('TRIAD transaction requires an active run');
    if (!run.id) throw new Error('TRIAD transaction requires run.id');
    return run;
  }

  function ensureLedger(run) {
    requireRun(run);
    if (!run.transactionLedger || typeof run.transactionLedger !== 'object' || Array.isArray(run.transactionLedger)) {
      run.transactionLedger = {};
    }
    return run.transactionLedger;
  }

  function id(run, kind, scope) {
    requireRun(run);
    const normalizedKind = String(kind || 'TXN').replace(/[^A-Z0-9_-]/gi, '_').toUpperCase();
    const normalizedScope = String(scope == null ? '' : scope).replace(/[^A-Z0-9_.:-]/gi, '_');
    return `${run.id}:${normalizedKind}:${normalizedScope}`;
  }

  function isCommitted(run, transactionId) {
    if (!transactionId) return false;
    return ensureLedger(run)[transactionId]?.status === 'COMMITTED';
  }

  function commit(run, transactionId, payload) {
    if (!transactionId) throw new Error('TRIAD transaction id is required');
    const ledger = ensureLedger(run);
    if (ledger[transactionId]?.status === 'COMMITTED') return false;
    ledger[transactionId] = {
      status: 'COMMITTED',
      sequence: Object.keys(ledger).length + 1,
      payload: payload && typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : {}
    };
    return true;
  }

  function pending(run, kind, scope, fields) {
    return {
      ...(fields && typeof fields === 'object' ? fields : {}),
      kind,
      txnId: id(run, kind, scope),
      status: 'PENDING'
    };
  }

  function isPending(record, kind, stage) {
    return Boolean(record && record.kind === kind && record.status === 'PENDING' && (stage == null || record.stage === stage));
  }

  function restore(run) {
    requireRun(run);
    ensureLedger(run);
    if (run.combat && typeof run.combat === 'object') {
      run.combat.phase = run.combat.phase === 'TERMINAL' ? 'TERMINAL' : 'PLAYER';
      run.combat.inputLocked = run.combat.phase === 'TERMINAL';
      run.combat.actionToken = Number.isInteger(run.combat.actionToken) ? run.combat.actionToken : 0;
    }
    if (run.routeOffer && typeof run.routeOffer === 'object') {
      run.routeOffer.txnId = run.routeOffer.txnId || id(run, 'ROUTE', run.routeOffer.stage);
      run.routeOffer.status = run.routeOffer.status || 'PENDING';
    }
    return run;
  }

  return Object.freeze({ ensureLedger, id, isCommitted, commit, pending, isPending, restore });
});
