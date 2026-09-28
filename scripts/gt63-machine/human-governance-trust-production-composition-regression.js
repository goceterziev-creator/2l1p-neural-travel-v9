"use strict";

const assert = require("node:assert/strict");
const compositionModule = require("./human-governance-trust-production-composition");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log("PASS - " + name);
}

function dbHarness() {
  let db = { schemaVersion: "test", agencies: [], users: [], clients: [], offers: [], activities: [], gt63GovernanceEvidence: [] };
  return {
    readDb() { return JSON.parse(JSON.stringify(db)); },
    writeDb(next) { db = JSON.parse(JSON.stringify(next)); },
    snapshot() { return JSON.parse(JSON.stringify(db)); }
  };
}

function req({ bypass = false, expired = false, mismatch = false } = {}) {
  const now = Date.now();
  return {
    user: { id: "USR-ADMIN" },
    session: {
      userId: mismatch ? "USR-OTHER" : "USR-ADMIN",
      agencyId: "AGY-AYA",
      role: "admin",
      sessionVersion: 1,
      iat: now - 1000,
      exp: expired ? now - 1 : now + 60000,
      ...(bypass ? { betaAuthBypass: true } : {})
    },
    sessionIdentity: { userId: "USR-ADMIN", agencyId: "AGY-AYA", role: "admin", sessionVersion: 1 },
    body: {}
  };
}

function res() {
  return {
    code: null, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function fakeApp() {
  const routes = [];
  return {
    routes,
    get(path, ...handlers) { routes.push({ method: "GET", path, handlers }); },
    post(path, ...handlers) { routes.push({ method: "POST", path, handlers }); }
  };
}

const noNetwork = async () => { throw new Error("network must not be called"); };

test("missing-client-id-keeps-identity-route-fail-closed", () => {
  const h = dbHarness();
  const c = compositionModule.createProductionTrustRuntimeComposition({ readDb: h.readDb, writeDb: h.writeDb });
  assert.equal(c.authority, "NONE");
  assert.equal(c.identityBootstrap, null);
  assert.equal(c.trustDecisionRoutes, null);
  assert.equal(c.runtimeRoutes, null);
});

test("missing-client-id-attaches-no-decision-or-consume-routes", () => {
  const h = dbHarness();
  const c = compositionModule.createProductionTrustRuntimeComposition({ readDb: h.readDb, writeDb: h.writeDb });
  const app = fakeApp();
  const attached = compositionModule.attachProductionTrustRuntimeRoutes(app, { requireAuthApi() {}, composition: c });
  assert.equal(attached.trustRoutesConfigured, false);
  assert.deepEqual(app.routes.map((x) => x.path), [
    "/api/gt63/trust/identity/start",
    "/api/gt63/trust/identity/poll"
  ]);
});

test("configured-composition-attaches-exact-five-authenticated-routes", () => {
  const h = dbHarness();
  const c = compositionModule.createProductionTrustRuntimeComposition({
    readDb: h.readDb, writeDb: h.writeDb, githubClientId: "Iv1.test", identityTransport: noNetwork
  });
  const auth = function requireAuthApi() {};
  const app = fakeApp();
  const attached = compositionModule.attachProductionTrustRuntimeRoutes(app, { requireAuthApi: auth, composition: c });
  assert.equal(attached.trustRoutesConfigured, true);
  assert.deepEqual(app.routes.map((x) => x.path), [
    "/api/gt63/trust/identity/start",
    "/api/gt63/trust/identity/poll",
    "/api/gt63/trust/decision/presentation",
    "/api/gt63/trust/decision",
    "/api/gt63/trust/consume"
  ]);
  assert.ok(app.routes.every((x) => x.handlers[0] === auth));
});

test("composition-exposes-the-durable-decision-ledger-with-authority-none", () => {
  const h = dbHarness();
  const c = compositionModule.createProductionTrustRuntimeComposition({
    readDb: h.readDb, writeDb: h.writeDb, githubClientId: "Iv1.test", identityTransport: noNetwork
  });
  assert.equal(typeof c.decisionLedger.get, "function");
  assert.equal(typeof c.decisionLedger.commit, "function");
  assert.equal(c.decisionLedger.authority, "NONE");
});

(async () => {
  // Re-run async tests in a deterministic provider-free block because the tiny test helper above is synchronous.
  const asyncCases = [
    ["normal-session-async-proof", async () => {
      const h=dbHarness(); const c=compositionModule.createProductionTrustRuntimeComposition({readDb:h.readDb,writeDb:h.writeDb,githubClientId:"Iv1.test",identityTransport:noNetwork});
      const r=res(); await c.identityRoutes.start(req(),r); assert.equal(r.code,503); assert.equal(r.body.outcome,"IDENTITY_BOOTSTRAP_UNAVAILABLE");
    }],
    ["beta-bypass-async-proof", async () => {
      const h=dbHarness(); let called=false; const c=compositionModule.createProductionTrustRuntimeComposition({readDb:h.readDb,writeDb:h.writeDb,githubClientId:"Iv1.test",identityTransport:async()=>{called=true;throw new Error("unexpected");}});
      const r=res(); await c.identityRoutes.start(req({bypass:true}),r); assert.equal(r.code,403); assert.equal(called,false);
    }],
    ["expired-session-async-proof", async () => {
      const h=dbHarness(); let called=false; const c=compositionModule.createProductionTrustRuntimeComposition({readDb:h.readDb,writeDb:h.writeDb,githubClientId:"Iv1.test",identityTransport:async()=>{called=true;throw new Error("unexpected");}});
      const r=res(); await c.identityRoutes.start(req({expired:true}),r); assert.equal(r.code,403); assert.equal(called,false);
    }],
    ["mismatched-session-async-proof", async () => {
      const h=dbHarness(); let called=false; const c=compositionModule.createProductionTrustRuntimeComposition({readDb:h.readDb,writeDb:h.writeDb,githubClientId:"Iv1.test",identityTransport:async()=>{called=true;throw new Error("unexpected");}});
      const r=res(); await c.identityRoutes.start(req({mismatch:true}),r); assert.equal(r.code,403); assert.equal(called,false);
    }]
  ];
  for (const [name, fn] of asyncCases) { await fn(); passed += 1; console.log("PASS - " + name); }
  console.log(passed + "/8 PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
