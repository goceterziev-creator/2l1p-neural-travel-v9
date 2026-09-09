"use strict";

const assert = require("node:assert/strict");
const capability = require("./human-governance-approval-surface");

const PAYLOAD = '{"decision":"APPROVE","type":"GT63_BOOTSTRAP_APPROVAL"}\n';

function session(overrides = {}) {
  return {
    sessionRef: "session:goce:001",
    sessionRevision: "1",
    authenticatedAccountRef: "github:user:goceterziev-creator",
    authenticationProviderRef: "github-oauth",
    authenticationEvidenceRef: "evidence:github-login:001",
    authenticationState: "AUTHENTICATED",
    freshnessState: "CURRENT",
    ...overrides
  };
}

function gate(overrides = {}) {
  return {
    gateId: "gt63-machine:bootstrap-gate:lifecycle-issuer-policy-v0",
    gateRevision: "1",
    repositoryIdentity: "goceterziev-creator/2l1p-neural-travel-v9",
    targetPath: "config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json",
    beforeStateId: "sha256:before",
    afterStateId: "sha256:after",
    approvalPayloadText: PAYLOAD,
    ...overrides
  };
}

function surface() {
  let tick = 0;
  return capability.createHumanGovernanceApprovalSurface({
    clock: () => `2026-09-09T15:00:0${tick++}Z`,
    presentationLedger: capability.createMemoryLedger(),
    sourceEventLedger: capability.createMemoryLedger()
  });
}

const cases = [];
function test(name, fn) { cases.push([name, fn]); }

test("presents exact immutable bytes with authority NONE", () => {
  const s = surface();
  const p = s.present({ session: session(), gate: gate() });
  assert.equal(Buffer.from(p.exactPayloadBytesBase64, "base64").toString("utf8"), PAYLOAD);
  assert.equal(p.authority, "NONE");
});

test("rejects unauthenticated session", () => {
  assert.throws(() => surface().present({ session: session({ authenticationState: "UNKNOWN" }), gate: gate() }));
});

test("decision cannot supply replacement payload", () => {
  const s = surface();
  const p = s.present({ session: session(), gate: gate() });
  const e = s.decide({ session: session(), presentationId: p.presentationId, decision: "APPROVE", approvalPayloadText: "tamper" });
  assert.equal(Buffer.from(e.contentBytesBase64, "base64").toString("utf8"), PAYLOAD);
});

test("decision must match presenting authenticated session", () => {
  const s = surface();
  const p = s.present({ session: session(), gate: gate() });
  assert.throws(() => s.decide({ session: session({ sessionRef: "session:other" }), presentationId: p.presentationId, decision: "APPROVE" }));
});

test("approval emits HUMAN_SOURCE_EVENT but no authority", () => {
  const s = surface();
  const p = s.present({ session: session(), gate: gate() });
  const e = s.decide({ session: session(), presentationId: p.presentationId, decision: "APPROVE" });
  assert.equal(e.type, "HUMAN_SOURCE_EVENT");
  assert.equal(e.authority, "NONE");
  assert.equal(e.attributedPrincipalRef, null);
});

test("reject emits source event and still no authority", () => {
  const s = surface();
  const p = s.present({ session: session(), gate: gate() });
  const e = s.decide({ session: session(), presentationId: p.presentationId, decision: "REJECT" });
  assert.equal(e.decision, "REJECT");
  assert.equal(e.authority, "NONE");
});

test("unsupported decision fails closed", () => {
  const s = surface();
  const p = s.present({ session: session(), gate: gate() });
  assert.throws(() => s.decide({ session: session(), presentationId: p.presentationId, decision: "YES" }));
});

test("invalid payload JSON fails before presentation", () => {
  assert.throws(() => surface().present({ session: session(), gate: gate({ approvalPayloadText: "not-json" }) }));
});

let passed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`${passed}/${cases.length} PASS`);
