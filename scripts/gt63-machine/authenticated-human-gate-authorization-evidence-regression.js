"use strict";

const assert = require("node:assert/strict");
const mod = require("./authenticated-human-gate-authorization-evidence");

const scope = (overrides={}) => ({
  scopeType:"GATE",
  interactionId:"interaction:1",
  fromInteractionRevision:7,
  throughInteractionRevision:7,
  gateId:"gate:1",
  gateRevision:1,
  authorityScopeDigest:`sha256:${"a".repeat(64)}`,
  continuationTargetRef:"continuation:1",
  ...overrides
});

function principal(overrides={}) {
  return {
    principalRef:"gt63-machine:human-principal:goce-v0",
    principalRevision:"1",
    principalEvidenceRef:"evidence:principal:1",
    lifecycleState:"CURRENT",
    freshnessState:"CURRENT",
    contradictionState:"NONE",
    authority:"NONE",
    ...overrides
  };
}

function presentation(overrides={}) {
  return {
    type:"GT63_HUMAN_GATE_AUTHORIZATION_PRESENTATION",
    presentationRef:"presentation:1",
    presentationRevision:"1",
    authorizationSubjectRef:"subject:1",
    authorizationSubjectRevision:"1",
    principalRef:"gt63-machine:human-principal:goce-v0",
    principalRevision:"1",
    governanceAct:"GATE_AUTHORIZATION",
    contextScope:scope(),
    exactSemanticDigest:`sha256:${"b".repeat(64)}`,
    lifecycleState:"CURRENT",
    freshnessState:"CURRENT",
    contradictionState:"NONE",
    authority:"NONE",
    ...overrides
  };
}

function decision(overrides={}) {
  return {
    type:"GT63_HUMAN_GATE_AUTHORIZATION_DECISION",
    presentationRef:"presentation:1",
    presentationRevision:"1",
    principalRef:"gt63-machine:human-principal:goce-v0",
    principalRevision:"1",
    authorizationSubjectRef:"subject:1",
    authorizationSubjectRevision:"1",
    governanceAct:"GATE_AUTHORIZATION",
    contextScope:scope(),
    decision:"APPROVE",
    exactSemanticDigest:`sha256:${"b".repeat(64)}`,
    decisionEvidenceRef:"evidence:decision:1",
    lifecycleState:"CURRENT",
    freshnessState:"CURRENT",
    contradictionState:"NONE",
    authority:"NONE",
    ...overrides
  };
}

function request(overrides={}) {
  return {
    rulesetVersion:mod.RULESET_VERSION,
    presentationRef:"presentation:1",
    presentationRevision:"1",
    authorizationSubjectRef:"subject:1",
    authorizationSubjectRevision:"1",
    principalRef:"gt63-machine:human-principal:goce-v0",
    principalRevision:"1",
    governanceAct:"GATE_AUTHORIZATION",
    contextScope:scope(),
    ...overrides
  };
}

function make({p=principal(),pr=presentation(),d=decision()}={}) {
  return mod.createAuthenticatedHumanGateAuthorizationEvidence({
    governancePrincipalPort:()=>p,
    presentationPort:()=>pr,
    decisionPort:()=>d
  });
}

const tests=[]; function t(name,fn){tests.push([name,fn]);}

t("constructor-requires-all-ports",()=>{
  assert.throws(()=>mod.createAuthenticatedHumanGateAuthorizationEvidence(),/governancePrincipalPort/);
});

t("exact-approve-produces-positive-evidence",()=>{
  const r=make().assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.RESOLVED);
  assert.equal(r.evidence.decision,"APPROVE");
  assert.equal(r.evidence.principalRef,"gt63-machine:human-principal:goce-v0");
});

t("exact-deny-produces-negative-evidence",()=>{
  const r=make({d:decision({decision:"DENY"})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.RESOLVED);
  assert.equal(r.evidence.decision,"DENY");
});

t("explicit-non-authorization-preserved",()=>{
  const r=make({d:decision({decision:"NON_AUTHORIZATION"})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.RESOLVED);
  assert.equal(r.evidence.decision,"NON_AUTHORIZATION");
});

t("application-account-cannot-substitute-governance-principal",()=>{
  const r=make({p:principal({principalRef:"gt63-runtime-user:USR-ADMIN"})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.UNKNOWN);
});

t("github-external-principal-cannot-substitute-governance-principal",()=>{
  const r=make({p:principal({principalRef:"gt63-machine:principal:github:239696056"})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.UNKNOWN);
});

t("principal-revision-mismatch-fails-closed",()=>{
  const r=make({p:principal({principalRevision:"2"})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.UNKNOWN);
});

t("subject-mismatch-fails-closed",()=>{
  const r=make({pr:presentation({authorizationSubjectRef:"subject:2"})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.UNKNOWN);
});

t("gate-mismatch-fails-closed",()=>{
  const r=make({pr:presentation({contextScope:scope({gateId:"gate:2"})})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.UNKNOWN);
});

t("scope-mismatch-fails-closed",()=>{
  const r=make({pr:presentation({contextScope:scope({continuationTargetRef:"continuation:2"})})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.UNKNOWN);
});

t("payload-digest-mismatch-fails-closed",()=>{
  const r=make({d:decision({exactSemanticDigest:`sha256:${"c".repeat(64)}`})}).assess(request());
  assert.equal(r.outcome,mod.OUTCOMES.UNKNOWN);
});

t("stale-principal-unknown",()=>{
  assert.equal(make({p:principal({freshnessState:"STALE"})}).assess(request()).outcome,mod.OUTCOMES.UNKNOWN);
});

t("stale-presentation-unknown",()=>{
  assert.equal(make({pr:presentation({freshnessState:"STALE"})}).assess(request()).outcome,mod.OUTCOMES.UNKNOWN);
});

t("stale-decision-unknown",()=>{
  assert.equal(make({d:decision({freshnessState:"STALE"})}).assess(request()).outcome,mod.OUTCOMES.UNKNOWN);
});

t("contradictory-decision-unknown",()=>{
  assert.equal(make({d:decision({contradictionState:"CONFLICT"})}).assess(request()).outcome,mod.OUTCOMES.UNKNOWN);
});

t("missing-principal-unknown",()=>{
  assert.equal(make({p:null}).assess(request()).outcome,mod.OUTCOMES.UNKNOWN);
});

t("missing-presentation-unknown",()=>{
  assert.equal(make({pr:null}).assess(request()).outcome,mod.OUTCOMES.UNKNOWN);
});

t("missing-decision-unknown",()=>{
  assert.equal(make({d:null}).assess(request()).outcome,mod.OUTCOMES.UNKNOWN);
});

t("caller-cannot-inject-approve",()=>{
  const r=make({d:decision({decision:"DENY"})}).assess({...request(),decision:"APPROVE"});
  assert.equal(r.outcome,mod.OUTCOMES.INVALID);
});

t("deterministic-exact-replay",()=>{
  const a=make().assess(request()), b=make().assess(request());
  assert.deepEqual(a,b);
});

t("changed-decision-changes-evidence-identity",()=>{
  const a=make().assess(request()), b=make({d:decision({decision:"DENY"})}).assess(request());
  assert.notEqual(a.evidence.humanAuthorizationEvidenceRef,b.evidence.humanAuthorizationEvidenceRef);
});

t("changed-payload-changes-evidence-identity",()=>{
  const pr=presentation({exactSemanticDigest:`sha256:${"d".repeat(64)}`});
  const d=decision({exactSemanticDigest:`sha256:${"d".repeat(64)}`,decisionEvidenceRef:"evidence:decision:2"});
  const a=make().assess(request()), b=make({pr,d}).assess(request());
  assert.notEqual(a.evidence.humanAuthorizationEvidenceRef,b.evidence.humanAuthorizationEvidenceRef);
});

t("changed-scope-changes-evidence-identity",()=>{
  const s2=scope({interactionId:"interaction:2"});
  const pr=presentation({contextScope:s2});
  const d=decision({contextScope:s2});
  const a=make().assess(request()), b=make({pr,d}).assess(request({contextScope:s2}));
  assert.notEqual(a.evidence.humanAuthorizationEvidenceRef,b.evidence.humanAuthorizationEvidenceRef);
});

t("all-outcomes-authority-none",()=>{
  const rs=[make().assess(request()),make({pr:null}).assess(request()),make().assess(request({principalRef:"other"}))];
  for(const r of rs) assert.equal(r.authority,"NONE");
});

t("evidence-does-not-create-downstream-authority",()=>{
  const r=make().assess(request());
  assert.equal(r.humanGateSatisfied,false);
  assert.equal(r.continuationAuthorityCreated,false);
  assert.equal(r.executionAuthorityCreated,false);
  assert.equal(r.effectAuthorized,false);
});

let passed=0;
for(const [name,fn] of tests){
  try{fn();console.log(`PASS - ${name}`);passed++;}
  catch(e){console.error(`FAIL - ${name}`);console.error(e.stack||e);process.exitCode=1;}
}
console.log(`${passed}/${tests.length} PASS`);
if(passed!==tests.length) process.exitCode=1;
