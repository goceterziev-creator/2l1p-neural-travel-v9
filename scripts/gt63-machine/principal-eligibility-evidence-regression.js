"use strict";
const assert = require("node:assert/strict");
const { RULESET_VERSION, AUTHORITY, OUTCOMES, createPrincipalEligibilityEvidence } = require("./principal-eligibility-evidence");
const digest = `sha256:${"a".repeat(64)}`;
function scope(overrides = {}) { return { scopeType:"GATE", interactionId:"interaction:1", fromInteractionRevision:1,
  throughInteractionRevision:3, gateId:"gate:1", gateRevision:1, authorityScopeDigest:digest,
  continuationTargetRef:"continuation:1", ...overrides }; }
function request(overrides = {}) { return { rulesetVersion:RULESET_VERSION, principalRef:"principal:goce",
  principalRevision:"1", governanceAct:"GATE_AUTHORIZATION", contextScope:scope(), ...overrides }; }
function system(overrides = {}) {
  const principal = { principalRef:"principal:goce", principalRevision:"1", principalEvidenceRef:"evidence:principal:1",
    lifecycleState:"CURRENT", freshnessState:"CURRENT", contradictionState:"NONE", authority:"NONE", ...(overrides.principal||{}) };
  const policy = { eligibilityPolicyEvidenceRef:"evidence:eligibility-policy:1", principalRef:"principal:goce",
    principalRevision:"1", governanceAct:"GATE_AUTHORIZATION", contextScope:scope(), eligibilityState:"ELIGIBLE",
    lifecycleState:"CURRENT", freshnessState:"CURRENT", contradictionState:"NONE", authority:"NONE", ...(overrides.policy||{}) };
  return createPrincipalEligibilityEvidence({
    authenticatedPrincipalPort: overrides.authenticatedPrincipalPort || (() => principal),
    eligibilityPolicyPort: overrides.eligibilityPolicyPort || (() => policy)
  });
}
const cases=[]; function check(name, fn){ fn(); cases.push(name); console.log(`PASS - ${name}`); }
function noAuthority(o){ assert.equal(o.authority,AUTHORITY); assert.equal(o.humanGateSatisfied,false);
  assert.equal(o.continuationAuthorityCreated,false); assert.equal(o.executionAuthorityCreated,false); assert.equal(o.effectAuthorized,false); }
check("constructor-requires-ports",()=>assert.throws(()=>createPrincipalEligibilityEvidence({}),TypeError));
check("positive-explicit-policy-resolves-eligible",()=>{ const o=system().assess(request()); assert.equal(o.outcome,OUTCOMES.RESOLVED); assert.equal(o.evidence.eligibilityState,"ELIGIBLE"); noAuthority(o); });
check("authenticated-identity-alone-cannot-create-eligibility",()=>{ const o=system({eligibilityPolicyPort:()=>null}).assess(request()); assert.equal(o.outcome,OUTCOMES.UNKNOWN); noAuthority(o); });
check("policy-unknown-preserved",()=>{ const o=system({policy:{eligibilityState:"UNKNOWN"}}).assess(request()); assert.equal(o.outcome,OUTCOMES.RESOLVED); assert.equal(o.evidence.eligibilityState,"UNKNOWN"); noAuthority(o); });
check("positive-not-eligible-preserved",()=>{ const o=system({policy:{eligibilityState:"NOT_ELIGIBLE"}}).assess(request()); assert.equal(o.evidence.eligibilityState,"NOT_ELIGIBLE"); noAuthority(o); });
check("stale-principal-fails-closed",()=>assert.equal(system({principal:{freshnessState:"STALE"}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
check("stale-policy-fails-closed",()=>assert.equal(system({policy:{freshnessState:"STALE"}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
check("conflicting-policy-fails-closed",()=>assert.equal(system({policy:{contradictionState:"CONFLICT"}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
check("cross-principal-policy-fails-closed",()=>assert.equal(system({policy:{principalRef:"principal:other"}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
check("cross-gate-policy-fails-closed",()=>assert.equal(system({policy:{contextScope:scope({gateId:"gate:2"})}}).assess(request()).outcome,OUTCOMES.UNKNOWN));
check("unsupported-governance-act-invalid",()=>assert.equal(system().assess(request({governanceAct:"DEPLOY"})).outcome,OUTCOMES.INVALID));
check("caller-cannot-inject-eligibility",()=>assert.equal(system().assess({...request(),eligibilityState:"ELIGIBLE"}).outcome,OUTCOMES.INVALID));
check("deterministic-exact-replay",()=>{ const c=system(); const a=c.assess(request()); const b=c.assess(request()); assert.deepEqual(a,b); });
check("scope-change-changes-evidence-identity",()=>{ const a=system().assess(request()); const s=scope({fromInteractionRevision:2}); const b=system({policy:{contextScope:s}}).assess(request({contextScope:s})); assert.notEqual(a.evidence.eligibilityEvidenceRef,b.evidence.eligibilityEvidenceRef); });
console.log(`${cases.length}/${cases.length} PASS`);
