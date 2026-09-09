"use strict";

const assert = require("node:assert/strict");
const routesModule = require("./human-governance-trust-decision-routes");

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function session() {
  return {
    sessionRef: "session-1",
    sessionRevision: "1",
    authenticatedAccountRef: "account-1",
    authenticationProviderRef: "provider-1",
    authenticationEvidenceRef: "evidence-1",
    authenticationState: "AUTHENTICATED",
    freshnessState: "CURRENT"
  };
}

const principal = {
  principalRef: "gt63-machine:principal:github:239696056",
  principalRevision: "1",
  sessionRef: "session-1",
  sessionRevision: "1",
  lifecycleState: "CURRENT",
  freshnessState: "CURRENT",
  contradictionState: "NONE",
  principalEvidenceRef: "principal-evidence-1",
  authority: "NONE"
};

let presented = null;
const surface = {
  present({ session, principal }) {
    presented = { session, principal };
    return { presentationId: "presentation-1", authority: "NONE" };
  },
  decide({ session, principal, presentationId, decision }) {
    return {
      registrationRef: "gt63-machine:trust-registration:human-governance-approval-surface-v0",
      principalRef: principal.principalRef,
      sessionRef: session.sessionRef,
      presentationId,
      decision,
      authority: "NONE"
    };
  }
};

let identity = principal;
const identityBootstrap = { getIdentityBySession() { return identity; } };
const routes = routesModule.createHumanGovernanceTrustDecisionRoutes({
  trustDecisionSurface: surface,
  identityBootstrap,
  sessionAdapter() { return session(); }
});

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`PASS - ${name}`); }

test("constructor requires trust decision surface", () => {
  assert.throws(() => routesModule.createHumanGovernanceTrustDecisionRoutes({}), TypeError);
});

test("constructor requires identity bootstrap", () => {
  assert.throws(() => routesModule.createHumanGovernanceTrustDecisionRoutes({ trustDecisionSurface: surface }), TypeError);
});

test("presentation requires verified principal", () => {
  identity = null;
  const res = response();
  routes.present({}, res);
  assert.equal(res.statusCode, 403);
  identity = principal;
});

test("presentation uses same session verified principal", () => {
  const res = response();
  routes.present({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.outcome, "TRUST_DECISION_PRESENTED");
  assert.equal(presented.session.sessionRef, "session-1");
  assert.equal(presented.principal.principalRef, principal.principalRef);
});

test("decision captures exact body fields", () => {
  const res = response();
  routes.decide({ body: { presentationId: "presentation-1", decision: "APPROVE_TRUST_REGISTRATION" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.outcome, "TRUST_DECISION_CAPTURED");
  assert.equal(res.body.trustDecision.presentationId, "presentation-1");
  assert.equal(res.body.trustDecision.decision, "APPROVE_TRUST_REGISTRATION");
});

test("decision remains authority NONE", () => {
  const res = response();
  routes.decide({ body: { presentationId: "presentation-1", decision: "APPROVE_TRUST_REGISTRATION" } }, res);
  assert.equal(res.body.authority, "NONE");
  assert.equal(res.body.trustDecision.authority, "NONE");
});

test("missing presentation id fails closed through surface", () => {
  const failingRoutes = routesModule.createHumanGovernanceTrustDecisionRoutes({
    trustDecisionSurface: {
      present: surface.present,
      decide() { throw new Error("presentationId required"); }
    },
    identityBootstrap,
    sessionAdapter() { return session(); }
  });
  const res = response();
  failingRoutes.decide({ body: { decision: "APPROVE_TRUST_REGISTRATION" } }, res);
  assert.equal(res.statusCode, 403);
});

test("route does not assert eligibility role or governance authorization", () => {
  const res = response();
  routes.decide({ body: { presentationId: "presentation-1", decision: "APPROVE_TRUST_REGISTRATION" } }, res);
  for (const forbidden of ["eligibilityState", "roleRef", "governanceAuthorizationRef"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(res.body.trustDecision, forbidden), false);
  }
});

test("route uses process-local identity lookup only for current session ref", () => {
  let seen = null;
  const localRoutes = routesModule.createHumanGovernanceTrustDecisionRoutes({
    trustDecisionSurface: surface,
    identityBootstrap: { getIdentityBySession(ref) { seen = ref; return principal; } },
    sessionAdapter() { return session(); }
  });
  const res = response();
  localRoutes.present({}, res);
  assert.equal(seen, "session-1");
});

console.log(`${passed}/9 PASS`);
