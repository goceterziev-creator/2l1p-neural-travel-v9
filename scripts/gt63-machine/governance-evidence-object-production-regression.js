"use strict";

const assert = require("node:assert/strict");
const {
  RULESET_VERSION,
  OUTCOMES,
  ISSUER,
  SOURCES,
  createGovernanceEvidenceObjectProduction
} = require("./governance-evidence-object-production");

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const gateScope = Object.freeze({
  scopeType: "GATE",
  interactionId: "interaction:1",
  fromInteractionRevision: 1,
  throughInteractionRevision: 1,
  gateId: "gate:1",
  gateRevision: 1,
  authorityScopeDigest: `sha256:${"a".repeat(64)}`,
  continuationTargetRef: "continuation:1"
});

const materials = Object.freeze({
  POLICY: Object.freeze({
    policyRef: "policy:1",
    policyRevision: "1",
    policyDocument: Object.freeze({
      roles: [Object.freeze({roleRef:"role:authorizer",roleRevision:"1",assignmentCardinality:"SINGLE",delegable:false,maxDelegationDepth:0,redelegationPermitted:false})],
      requirements: [Object.freeze({requirementRef:"requirement:gate",requirementRevision:"1",governanceAct:"GATE_AUTHORIZATION",requiredRoleRef:"role:authorizer",requiredRoleRevision:"1",contextScope:gateScope})],
      assignmentIssuerRefs: [ISSUER.issuerRef]
    }),
    validFromTemporalFrameRef: "temporal:1",
    validThroughTemporalFrameRef: null,
    lifecycleState: "CURRENT",
    supersedesPolicyRef: null
  }),
  ASSIGNMENT: Object.freeze({
    assignmentRef: "assignment:1",
    assignmentRevision: "1",
    principalRef: "principal:1",
    principalRevision: "1",
    roleRef: "role:authorizer",
    roleRevision: "1",
    policyRef: "policy:1",
    policyRevision: "1",
    contextScope: gateScope,
    validFromTemporalFrameRef: "temporal:1",
    validThroughTemporalFrameRef: null,
    lifecycleState: "CURRENT",
    supersedesAssignmentRef: null
  }),
  DELEGATION: Object.freeze({
    delegationRef: "delegation:1",
    delegationRevision: "1",
    sourceEventBindingRef: "source-event-binding:1",
    grantBytesBase64: Buffer.from(JSON.stringify({grantorRef:"principal:1",granteeRef:"principal:2",roleRef:"role:authorizer"}), "utf8").toString("base64"),
    grantContentEncoding: "utf-8"
  })
});

function boundPort(argument) {
  const source = SOURCES[argument.subjectKind];
  return Object.freeze({
    outcome: "BOUND",
    authority: "NONE",
    evidence: Object.freeze({
      issuerRef: ISSUER.issuerRef,
      issuerRevision: ISSUER.issuerRevision,
      subjectKind: argument.subjectKind,
      sourceRef: source.sourceRef,
      sourceRevision: source.sourceRevision,
      bindingEvidenceRef: `sha256:${"b".repeat(64)}`,
      authority: "NONE"
    })
  });
}

function producer(port = boundPort) {
  return createGovernanceEvidenceObjectProduction({issuerSourceBindingPort: port});
}

function request(kind, material = materials[kind]) {
  return {rulesetVersion:RULESET_VERSION,issuerRef:ISSUER.issuerRef,issuerRevision:ISSUER.issuerRevision,subjectKind:kind,material};
}

function assertNoDownstream(result) {
  assert.equal(result.authority, "NONE");
  assert.equal(result.evidenceAccepted, false);
  assert.equal(result.principalEligibilityCreated, false);
  assert.equal(result.authorizationCreated, false);
  assert.equal(result.humanGateSatisfied, false);
  assert.equal(result.continuationAuthorityCreated, false);
  assert.equal(result.executionAuthorityCreated, false);
  assert.equal(result.effectAuthorized, false);
}

test("constructor-requires-issuer-source-binding-port", () => {
  assert.throws(() => createGovernanceEvidenceObjectProduction(), /issuerSourceBindingPort is required/);
});

test("exact-policy-object-produced", () => {
  const r = producer().produce(request("POLICY"));
  assert.equal(r.outcome, OUTCOMES.PRODUCED);
  assert.equal(r.evidenceObject.type, "GOVERNANCE_ROLE_POLICY");
  assert.equal(r.evidenceObject.sourceRef, SOURCES.POLICY.sourceRef);
  assert.equal(r.evidenceObject.sourceRevision, "1");
  assert.match(r.evidenceObject.policyEvidenceRef, /^sha256:[0-9a-f]{64}$/);
});

test("exact-assignment-object-produced", () => {
  const r = producer().produce(request("ASSIGNMENT"));
  assert.equal(r.outcome, OUTCOMES.PRODUCED);
  assert.equal(r.evidenceObject.type, "DIRECT_PRINCIPAL_ROLE_ASSIGNMENT");
  assert.equal(r.evidenceObject.sourceRef, SOURCES.ASSIGNMENT.sourceRef);
  assert.match(r.evidenceObject.assignmentEvidenceRef, /^sha256:[0-9a-f]{64}$/);
});

test("exact-delegation-object-produced", () => {
  const r = producer().produce(request("DELEGATION"));
  assert.equal(r.outcome, OUTCOMES.PRODUCED);
  assert.equal(r.evidenceObject.type, "DIRECT_DELEGATION_GRANT");
  assert.equal(r.evidenceObject.sourceRef, SOURCES.DELEGATION.sourceRef);
  assert.match(r.evidenceObject.grantEvidenceRef, /^sha256:[0-9a-f]{64}$/);
});

test("policy-snapshot-has-exact-acceptance-shape", () => {
  const o = producer().produce(request("POLICY")).evidenceObject;
  assert.deepEqual(Object.keys(o).sort(), ["lifecycleState","policyDocument","policyEvidenceRef","policyRef","policyRevision","sourceRef","sourceRevision","supersedesPolicyRef","type","validFromTemporalFrameRef","validThroughTemporalFrameRef"].sort());
});

test("assignment-snapshot-has-exact-acceptance-shape", () => {
  const o = producer().produce(request("ASSIGNMENT")).evidenceObject;
  assert.deepEqual(Object.keys(o).sort(), ["assignmentEvidenceRef","assignmentRef","assignmentRevision","contextScope","lifecycleState","policyRef","policyRevision","principalRef","principalRevision","roleRef","roleRevision","sourceRef","sourceRevision","supersedesAssignmentRef","type","validFromTemporalFrameRef","validThroughTemporalFrameRef"].sort());
});

test("delegation-snapshot-has-exact-acceptance-shape", () => {
  const o = producer().produce(request("DELEGATION")).evidenceObject;
  assert.deepEqual(Object.keys(o).sort(), ["delegationRef","delegationRevision","grantBytesBase64","grantContentEncoding","grantEvidenceRef","sourceEventBindingRef","sourceRef","sourceRevision","type"].sort());
});

test("wrong-issuer-ref-not-produced", () => {
  const r = producer().produce({...request("POLICY"),issuerRef:"issuer:wrong"});
  assert.equal(r.outcome, OUTCOMES.NOT_PRODUCED);
});

test("wrong-issuer-revision-not-produced", () => {
  const r = producer().produce({...request("POLICY"),issuerRevision:"2"});
  assert.equal(r.outcome, OUTCOMES.NOT_PRODUCED);
});

test("unsupported-subject-invalid", () => {
  const r = producer().produce({rulesetVersion:RULESET_VERSION,issuerRef:ISSUER.issuerRef,issuerRevision:"1",subjectKind:"OTHER",material:{}});
  assert.equal(r.outcome, OUTCOMES.INVALID);
});

test("extra-request-field-invalid", () => {
  const r = producer().produce({...request("POLICY"),trustState:"TRUSTED"});
  assert.equal(r.outcome, OUTCOMES.INVALID);
});

test("caller-cannot-inject-source-ref", () => {
  const r = producer().produce({...request("POLICY"),sourceRef:"registry:governance-policy"});
  assert.equal(r.outcome, OUTCOMES.INVALID);
});

test("caller-cannot-inject-acceptance", () => {
  const r = producer().produce({...request("POLICY"),evidenceAccepted:true});
  assert.equal(r.outcome, OUTCOMES.INVALID);
});

test("unbound-issuer-source-not-produced", () => {
  const r = producer(() => ({outcome:"NOT_BOUND",authority:"NONE",evidence:null})).produce(request("POLICY"));
  assert.equal(r.outcome, OUTCOMES.NOT_PRODUCED);
});

test("binding-wrong-authority-not-produced", () => {
  const r = producer((a) => ({...boundPort(a),authority:"WRITE"})).produce(request("POLICY"));
  assert.equal(r.outcome, OUTCOMES.NOT_PRODUCED);
});

test("binding-wrong-subject-not-produced", () => {
  const r = producer((a) => ({...boundPort(a),evidence:{...boundPort(a).evidence,subjectKind:"ASSIGNMENT"}})).produce(request("POLICY"));
  assert.equal(r.outcome, OUTCOMES.NOT_PRODUCED);
});

test("binding-wrong-source-not-produced", () => {
  const r = producer((a) => ({...boundPort(a),evidence:{...boundPort(a).evidence,sourceRef:"source:wrong"}})).produce(request("POLICY"));
  assert.equal(r.outcome, OUTCOMES.NOT_PRODUCED);
});

test("binding-port-failure-unknown", () => {
  const r = producer(() => { throw new Error("offline"); }).produce(request("POLICY"));
  assert.equal(r.outcome, OUTCOMES.UNKNOWN);
});

test("invalid-policy-material-invalid", () => {
  const m = {...materials.POLICY}; delete m.policyRef;
  assert.equal(producer().produce(request("POLICY",m)).outcome, OUTCOMES.INVALID);
});

test("invalid-assignment-context-invalid", () => {
  const m = {...materials.ASSIGNMENT,contextScope:{scopeType:"GATE"}};
  assert.equal(producer().produce(request("ASSIGNMENT",m)).outcome, OUTCOMES.INVALID);
});

test("invalid-delegation-encoding-invalid", () => {
  const m = {...materials.DELEGATION,grantContentEncoding:"base64"};
  assert.equal(producer().produce(request("DELEGATION",m)).outcome, OUTCOMES.INVALID);
});

test("invalid-delegation-bytes-invalid", () => {
  const m = {...materials.DELEGATION,grantBytesBase64:"%%%"};
  assert.equal(producer().produce(request("DELEGATION",m)).outcome, OUTCOMES.INVALID);
});

test("deterministic-policy-replay", () => {
  assert.deepEqual(producer().produce(request("POLICY")), producer().produce(request("POLICY")));
});

test("deterministic-assignment-replay", () => {
  assert.deepEqual(producer().produce(request("ASSIGNMENT")), producer().produce(request("ASSIGNMENT")));
});

test("deterministic-delegation-replay", () => {
  assert.deepEqual(producer().produce(request("DELEGATION")), producer().produce(request("DELEGATION")));
});

test("different-subjects-have-different-production-evidence", () => {
  const p = producer().produce(request("POLICY")).productionEvidence.productionEvidenceRef;
  const a = producer().produce(request("ASSIGNMENT")).productionEvidence.productionEvidenceRef;
  const d = producer().produce(request("DELEGATION")).productionEvidence.productionEvidenceRef;
  assert.notEqual(p,a); assert.notEqual(a,d); assert.notEqual(p,d);
});

test("production-evidence-binds-object-digest", () => {
  const r = producer().produce(request("POLICY"));
  assert.match(r.productionEvidence.evidenceObjectDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(r.productionEvidence.productionEvidenceRef, /^sha256:[0-9a-f]{64}$/);
  assert.equal(r.productionEvidence.bindingEvidenceRef, `sha256:${"b".repeat(64)}`);
});

test("produced-object-is-not-accepted", () => {
  for (const kind of ["POLICY","ASSIGNMENT","DELEGATION"]) {
    const r = producer().produce(request(kind));
    assert.equal(r.outcome, OUTCOMES.PRODUCED);
    assert.equal(r.evidenceAccepted, false);
  }
});

test("all-outcomes-authority-none-and-no-downstream-authority", () => {
  const results = [
    producer().produce(request("POLICY")),
    producer().produce({...request("POLICY"),issuerRef:"wrong"}),
    producer(() => { throw new Error("offline"); }).produce(request("POLICY")),
    producer().produce({rulesetVersion:"wrong",issuerRef:ISSUER.issuerRef,issuerRevision:"1",subjectKind:"POLICY",material:materials.POLICY})
  ];
  results.forEach(assertNoDownstream);
});

let passed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}
console.log(`${passed}/${tests.length} PASS`);
if (passed !== tests.length) process.exitCode = 1;
