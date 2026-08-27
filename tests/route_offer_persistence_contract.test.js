/* The visible route must not change when a run is saved and resumed. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runtimePath = path.resolve(__dirname, '..', 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const source = fs.readFileSync(runtimePath, 'utf8');

function section(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} is required`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.notStrictEqual(end, -1, `${nextName} boundary is required`);
  return source.slice(start, end);
}

const showRoute = section('showRoute', 'ensureRouteOffer');
assert.ok(showRoute.includes('const choices=ensureRouteOffer()'), 'route render must use the persisted offer');
assert.ok(!showRoute.includes('const choices=routeOptions(run.stage)'), 'route render must not re-roll choices');
assert.ok(showRoute.includes("chooseRoute('${r.type}','${offerToken}')"), 'visible route buttons must carry the stage-specific offer token');

const ensure = section('ensureRouteOffer', 'routeOptions');
assert.ok(ensure.includes('current?.stage===run.stage'), 'saved route offer must be scoped to its stage');
assert.ok(ensure.includes("txnId:TRIAD_TXN.id(run,'ROUTE',run.stage)"), 'a new stage must serialize a unique route transaction');
assert.ok(ensure.includes("status:'PENDING',choices"), 'a new route offer must start pending');
assert.ok(ensure.includes("current.status!=='PENDING'"), 'stalled claimed offers must recover into a selectable state');
assert.ok(ensure.includes("TRIAD_TXN.id(run,'ROUTE_RECOVERY'"), 'a recovered route must receive a fresh transaction id');

const choose = section('chooseRoute', 'healParty');
assert.ok(choose.includes("offer.status!=='PENDING'||offer.txnId!==offerToken"), 'stale route buttons must be rejected');
assert.ok(choose.includes('offer.choices.some(choice=>choice.type===type)'), 'route action must be validated against the presented choices');
assert.ok(choose.includes('TRIAD_TXN.isCommitted(run,offer.txnId)'), 'committed route transactions must be no-ops');
assert.ok(choose.indexOf('run.routeOffer=null') < choose.indexOf('run.path.some'), 'offer must be consumed exactly once before route resolution');

assert.ok(!source.includes(`onclick="chooseRoute('battle')">전투 시작`), 'top-bar battle shortcut must not bypass a boss-only route');
console.log('[PASS] route offers persist through reload and only visible routes can be selected');
