"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  RULESET_VERSION,
  OUTCOMES,
  createAuthenticatedHumanGateAuthorizationRuntimeProductionWiring,
  createMemoryLedger
} = require("./authenticated-human-gate-authorization-runtime-production-wiring");
const {
  createAuthenticatedHumanGateAuthorizationEvidence
} = require("./authenticated-human-gate-authorization-evidence");

let pass = 0;
function test(name, fn) {
  try { fn(); pass += 1; console.log(`PASS - ${name}`); }
  catch (error) { console.error(`FAIL - ${name}`); throw error; }
}
function sha(bytes) { return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

const scope = Object.freeze({
  scopeType: "GATE",
  interactionId: "interaction-1",
  fromInteractionRevision: 7,
  throughInteractionRevision: 7,
  gateId: "gate-1",
  gateRevision: 3,
  authorityScopeDigest: `sha256:${"a".repeat(64)}`,
  continuationTargetRef: "continuation-target-1"
});

function governanceBinding(overrides = {}) {
  return {
    type: "GT63_GOVERNANCE_PRINCIPAL_IDENTITY_BINDING_EVIDENCE",
    schemaVersion: "1.0",
    rulesetVersion: "governance-principal-identity-binding-v0.1.0",
    principalRef: "gt63-machine:human-principal:goce-v0",
    principalRevision: "1",
    principalEvidenceRef: "gt63-evidence:governance-principal-identity-binding:test",
    governancePrincipalRef: "gt63-machine:human-principal:goce-v0",
    governancePrincipalRevision: "1",
    externalPrincipalRef: "gt63-machine:principal:github:239696056",
    externalPrincipalRevision: "1",
    externalPrincipalEvidenceRef: "gt63-evidence:github:test",
    identityProvider: "github.com",
    githubUserId: 239696056,
    githubLogin: "goceterziev-creator",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    authority: "NONE",
    ...overrides
  };
}

function sourceBinding(contentDigest, overrides = {}) {
  return {
    type: "AUTHENTICATED_HUMAN_SOURCE_EVENT_BINDING",
    schemaVersion: "1.0",
    rulesetVersion: "authenticated-human-source-event-binding-v1.0.0",
    bindingId: "human-source-binding:test",
    sourceEventRef: "human-source-event:1",
    sourceEventRevision: "1",
    sourceProviderRef: "gt63-machine:human-governance-approval-surface-v0",
    sourceProviderRevision: "1",
    providerEventId: "provider-event-1",
    contentDigest,
    contentByteLength: 1,
    contentEncoding: "utf-8",
    contentMediaType: "application/json",
    contentBindingContractRef: "contract-1",
    contentBindingContractRevision: "1",
    principalRef: "gt63-machine:principal:github:239696056",
    principalNamespace: "github.com",
    principalRevision: "1",
    principalResolutionState: "RESOLVED",
    principalLifecycleState: "CURRENT",
    principalFreshnessState: "CURRENT",
    channelRef: "channel-1",
    channelRevision: "1",
    sessionRef: "session-1",
    sessionRevision: "1",
    occurredTemporalFrameRef: "time-1",
    receivedTemporalFrameRef: "time-2",
    interactionId: "interaction-1",
    contextRevision: "7",
    routingRevision: "1",
    verificationMethodRef: "method-1",
    verificationMethodRevision: "1",
    sourceTrustState: "TRUSTED",
    verificationMethodTrustState: "TRUSTED",
    verificationFreshnessState: "CURRENT",
    originAuthenticationState: "AUTHENTICATED",
    contentIntegrityState: "EXACT_BYTES",
    interactionBindingState: "BOUND",
    contradictionState: "NONE",
    claimedActorRef: null,
    claimedActorRelation: "NO_CLAIM",
    presentationClass: "DIRECT",
    attributedPrincipalRef: "gt63-machine:principal:github:239696056",
    attributionState: "ATTRIBUTED",
    delegationState: "DIRECT",
    priorContentEventRefs: [],
    evidenceRefs: ["evidence-1"],
    authority: "NONE",
    ...overrides
  };
}

function createFixture(options = {}) {
  const presentations = createMemoryLedger();
  const decisions = createMemoryLedger();
  let gov = governanceBinding(options.governanceOverrides || {});
  let binding = null;
  let source = null;
  const downstream = createAuthenticatedHumanGateAuthorizationEvidence({
    governancePrincipalPort: () => gov,
    presentationPort: ({ presentationRef }) => presentations.get(presentationRef),
    decisionPort: ({ presentationRef }) => decisions.get(presentationRef)
  });
  const wiring = createAuthenticatedHumanGateAuthorizationRuntimeProductionWiring({
    governancePrincipalBindingPort: () => gov,
    authenticatedSourceBindingPort: () => binding,
    sourceEventSnapshotPort: () => source,
    presentationLedger: presentations,
    decisionLedger: decisions,
    authorizationEvidenceConsumer: downstream
  });
  const presentationRequest = {
    rulesetVersion: RULESET_VERSION,
    authorizationSubjectRef: "authorization-subject-1",
    authorizationSubjectRevision: "1",
    principalRef: "gt63-machine:human-principal:goce-v0",
    principalRevision: "1",
    governanceAct: "GATE_AUTHORIZATION",
    contextScope: clone(scope)
  };
  function present() { return wiring.present(presentationRequest); }
  function setDecision(presentation, decision = "APPROVE", payloadOverrides = {}, bindingOverrides = {}, sourceOverrides = {}) {
    const payload = {
      type: "GT63_HUMAN_GATE_AUTHORIZATION_DECISION_INPUT",
      presentationRef: presentation.presentationRef,
      presentationRevision: presentation.presentationRevision,
      exactSemanticDigest: presentation.exactSemanticDigest,
      decision,
      ...payloadOverrides
    };
    const bytes = Buffer.from(JSON.stringify(payload), "utf8");
    binding = sourceBinding(sha(bytes), { contentByteLength: bytes.length, ...bindingOverrides });
    source = {
      type: "HUMAN_SOURCE_EVENT",
      sourceEventRef: binding.sourceEventRef,
      sourceEventRevision: binding.sourceEventRevision,
      contentBytesBase64: bytes.toString("base64"),
      ...sourceOverrides
    };
    return payload;
  }
  function consume(presentation) {
    return wiring.consume({
      rulesetVersion: RULESET_VERSION,
      presentationRef: presentation.presentationRef,
      presentationRevision: presentation.presentationRevision,
      sourceEventRef: "human-source-event:1",
      sourceEventRevision: "1"
    });
  }
  return { wiring, presentations, decisions, present, setDecision, consume, presentationRequest, setGov(v){ gov=v; }, setBinding(v){ binding=v; }, setSource(v){ source=v; } };
}

for (const [name, bad] of [
  ["constructor-requires-governance-port", { governancePrincipalBindingPort: null }],
  ["constructor-requires-source-binding-port", { authenticatedSourceBindingPort: null }],
  ["constructor-requires-source-snapshot-port", { sourceEventSnapshotPort: null }]
]) {
  test(name, () => {
    assert.throws(() => createAuthenticatedHumanGateAuthorizationRuntimeProductionWiring({
      governancePrincipalBindingPort: () => ({}), authenticatedSourceBindingPort: () => ({}), sourceEventSnapshotPort: () => ({}),
      presentationLedger: createMemoryLedger(), decisionLedger: createMemoryLedger(), authorizationEvidenceConsumer: { assess(){} }, ...bad
    }));
  });
}
test("constructor-requires-presentation-ledger", () => assert.throws(() => createAuthenticatedHumanGateAuthorizationRuntimeProductionWiring({ governancePrincipalBindingPort(){}, authenticatedSourceBindingPort(){}, sourceEventSnapshotPort(){}, presentationLedger:null, decisionLedger:createMemoryLedger(), authorizationEvidenceConsumer:{assess(){}} })));
test("constructor-requires-decision-ledger", () => assert.throws(() => createAuthenticatedHumanGateAuthorizationRuntimeProductionWiring({ governancePrincipalBindingPort(){}, authenticatedSourceBindingPort(){}, sourceEventSnapshotPort(){}, presentationLedger:createMemoryLedger(), decisionLedger:null, authorizationEvidenceConsumer:{assess(){}} })));
test("constructor-requires-downstream-consumer", () => assert.throws(() => createAuthenticatedHumanGateAuthorizationRuntimeProductionWiring({ governancePrincipalBindingPort(){}, authenticatedSourceBindingPort(){}, sourceEventSnapshotPort(){}, presentationLedger:createMemoryLedger(), decisionLedger:createMemoryLedger(), authorizationEvidenceConsumer:null })));

test("exact-presentation-produced", () => { const f=createFixture(); const r=f.present(); assert.equal(r.outcome, OUTCOMES.PRESENTED); assert.equal(r.value.type,"GT63_HUMAN_GATE_AUTHORIZATION_PRESENTATION"); });
test("presentation-governance-principal-exact", () => { const r=createFixture().present(); assert.equal(r.value.principalRef,"gt63-machine:human-principal:goce-v0"); assert.equal(r.value.principalRevision,"1"); });
test("presentation-act-exact", () => assert.equal(createFixture().present().value.governanceAct,"GATE_AUTHORIZATION"));
test("presentation-scope-exact", () => assert.deepEqual(createFixture().present().value.contextScope,scope));
test("presentation-semantic-digest", () => assert.match(createFixture().present().value.exactSemanticDigest,/^sha256:[0-9a-f]{64}$/));
test("presentation-authority-none", () => assert.equal(createFixture().present().authority,"NONE"));
test("presentation-no-gate-satisfaction", () => assert.equal(createFixture().present().humanGateSatisfied,false));
test("presentation-no-continuation-authority", () => assert.equal(createFixture().present().continuationAuthorityCreated,false));
test("presentation-no-execution-authority", () => assert.equal(createFixture().present().executionAuthorityCreated,false));
test("presentation-no-effect-authority", () => assert.equal(createFixture().present().effectAuthorized,false));
test("presentation-deterministic-idempotent", () => { const f=createFixture(); const a=f.present(); const b=f.present(); assert.equal(a.value.presentationRef,b.value.presentationRef); assert.deepEqual(a.value,b.value); });

test("wrong-principal-presentation-invalid", () => { const f=createFixture(); const q=clone(f.presentationRequest); q.principalRef="gt63-machine:principal:github:239696056"; assert.equal(f.wiring.present(q).outcome,OUTCOMES.INVALID); });
test("wrong-principal-revision-presentation-invalid", () => { const f=createFixture(); const q=clone(f.presentationRequest); q.principalRevision="2"; assert.equal(f.wiring.present(q).outcome,OUTCOMES.INVALID); });
test("wrong-act-presentation-invalid", () => { const f=createFixture(); const q=clone(f.presentationRequest); q.governanceAct="TRUST_REGISTRATION"; assert.equal(f.wiring.present(q).outcome,OUTCOMES.INVALID); });
test("bad-scope-presentation-invalid", () => { const f=createFixture(); const q=clone(f.presentationRequest); q.contextScope.authorityScopeDigest="bad"; assert.equal(f.wiring.present(q).outcome,OUTCOMES.INVALID); });
test("extra-field-presentation-invalid", () => { const f=createFixture(); const q={...f.presentationRequest,extra:true}; assert.equal(f.wiring.present(q).outcome,OUTCOMES.INVALID); });
test("noncurrent-governance-binding-unknown", () => { const f=createFixture({governanceOverrides:{freshnessState:"STALE"}}); assert.equal(f.present().outcome,OUTCOMES.UNKNOWN); });
test("contradictory-governance-binding-unknown", () => { const f=createFixture({governanceOverrides:{contradictionState:"CONTRADICTORY_EVIDENCE"}}); assert.equal(f.present().outcome,OUTCOMES.UNKNOWN); });
test("wrong-governance-principal-binding-unknown", () => { const f=createFixture({governanceOverrides:{governancePrincipalRef:"other"}}); assert.equal(f.present().outcome,OUTCOMES.UNKNOWN); });

test("exact-authenticated-human-decision-resolves", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); const r=f.consume(p); assert.equal(r.outcome,OUTCOMES.RESOLVED); assert.equal(r.value.type,"GT63_AUTHENTICATED_HUMAN_GATE_AUTHORIZATION_EVIDENCE"); });
test("resolved-binds-subject", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.authorizationSubjectRef,"authorization-subject-1"); });
test("resolved-binds-subject-revision", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.authorizationSubjectRevision,"1"); });
test("resolved-binds-principal", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.principalRef,"gt63-machine:human-principal:goce-v0"); });
test("resolved-binds-presentation", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.presentationRef,p.presentationRef); });
test("resolved-binds-semantic-digest", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.exactSemanticDigest,p.exactSemanticDigest); });
test("resolved-binds-decision-evidence", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.match(f.consume(p).value.decisionEvidenceRef,/^gt63-evidence:human-gate-authorization-decision:/); });
test("resolved-decision-approve", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE"); assert.equal(f.consume(p).value.decision,"APPROVE"); });
test("authenticated-deny-still-resolves-evidence-not-gate", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"DENY"); const r=f.consume(p); assert.equal(r.outcome,OUTCOMES.RESOLVED); assert.equal(r.value.decision,"DENY"); assert.equal(r.humanGateSatisfied,false); });
test("authenticated-nonauthorization-still-resolves-evidence-not-gate", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"NON_AUTHORIZATION"); const r=f.consume(p); assert.equal(r.outcome,OUTCOMES.RESOLVED); assert.equal(r.value.decision,"NON_AUTHORIZATION"); assert.equal(r.humanGateSatisfied,false); });
test("resolved-authority-none", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).authority,"NONE"); });
test("resolved-no-gate-satisfaction", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).humanGateSatisfied,false); });
test("resolved-no-continuation-authority", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).continuationAuthorityCreated,false); });
test("resolved-no-execution-authority", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).executionAuthorityCreated,false); });
test("resolved-no-effect-authority", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).effectAuthorized,false); });

test("raw-source-event-without-accepted-binding-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); f.setBinding({}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("raw-runtime-session-cannot-substitute-source-binding", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); f.setBinding({authenticationState:"AUTHENTICATED",freshnessState:"CURRENT"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("trust-registration-approval-cannot-substitute-source-binding", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); f.setBinding({type:"GT63_GOVERNANCE_APPROVAL_TRUST_DECISION",authority:"NONE"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("wrong-external-principal-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {principalRef:"gt63-machine:principal:github:999"}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("wrong-external-principal-revision-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {principalRevision:"2"}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("source-interaction-mismatch-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {interactionId:"other"}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("unauthenticated-origin-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {originAuthenticationState:"NOT_AUTHENTICATED"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("nonexact-bytes-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {contentIntegrityState:"BYTES_MISMATCH"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("unbound-interaction-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {interactionBindingState:"NOT_BOUND"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("stale-source-principal-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {principalFreshnessState:"STALE"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("contradictory-source-binding-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {contradictionState:"CONTRADICTORY_EVIDENCE"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("source-ref-mismatch-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {sourceEventRef:"other"}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("source-revision-mismatch-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {sourceEventRevision:"2"}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });

test("source-bytes-digest-mismatch-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); f.setSource({type:"HUMAN_SOURCE_EVENT",sourceEventRef:"human-source-event:1",sourceEventRevision:"1",contentBytesBase64:Buffer.from("{}").toString("base64")}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("source-snapshot-wrong-ref-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {}, {sourceEventRef:"other"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("source-snapshot-wrong-revision-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{}, {}, {sourceEventRevision:"2"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("malformed-json-source-unknown", () => { const f=createFixture(); const p=f.present().value; const bytes=Buffer.from("not-json","utf8"); f.setBinding(sourceBinding(sha(bytes),{contentByteLength:bytes.length})); f.setSource({type:"HUMAN_SOURCE_EVENT",sourceEventRef:"human-source-event:1",sourceEventRevision:"1",contentBytesBase64:bytes.toString("base64")}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });

test("wrong-decision-type-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{type:"GT63_GOVERNANCE_APPROVAL_TRUST_DECISION"}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("wrong-presentation-ref-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{presentationRef:"other"}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("wrong-presentation-revision-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{presentationRevision:"2"}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("wrong-semantic-digest-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{exactSemanticDigest:`sha256:${"b".repeat(64)}`}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("unsupported-decision-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"MAYBE"); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });
test("extra-decision-field-not-authorized", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p,"APPROVE",{extra:true}); assert.equal(f.consume(p).outcome,OUTCOMES.NOT_AUTHORIZED); });

test("consume-wrong-ruleset-invalid", () => { const f=createFixture(); const p=f.present().value; const r=f.wiring.consume({rulesetVersion:"bad",presentationRef:p.presentationRef,presentationRevision:"1",sourceEventRef:"human-source-event:1",sourceEventRevision:"1"}); assert.equal(r.outcome,OUTCOMES.INVALID); });
test("consume-extra-field-invalid", () => { const f=createFixture(); const p=f.present().value; const r=f.wiring.consume({rulesetVersion:RULESET_VERSION,presentationRef:p.presentationRef,presentationRevision:"1",sourceEventRef:"human-source-event:1",sourceEventRevision:"1",extra:true}); assert.equal(r.outcome,OUTCOMES.INVALID); });
test("missing-presentation-unknown", () => { const f=createFixture(); const r=f.wiring.consume({rulesetVersion:RULESET_VERSION,presentationRef:"missing",presentationRevision:"1",sourceEventRef:"human-source-event:1",sourceEventRevision:"1"}); assert.equal(r.outcome,OUTCOMES.UNKNOWN); });

test("decision-ledger-idempotent", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); const a=f.consume(p); const b=f.consume(p); assert.equal(a.outcome,OUTCOMES.RESOLVED); assert.equal(b.outcome,OUTCOMES.RESOLVED); assert.equal(a.value.decisionEvidenceRef,b.value.decisionEvidenceRef); });
test("decision-identity-conflict-unknown", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); f.decisions.commit(p.presentationRef,{type:"conflict"}); assert.equal(f.consume(p).outcome,OUTCOMES.UNKNOWN); });
test("presentation-ledger-immutable", () => { const l=createMemoryLedger(); l.commit("x",{a:1}); assert.throws(()=>l.commit("x",{a:1})); });
test("memory-ledger-clones-and-freezes", () => { const l=createMemoryLedger(); const v={a:{b:1}}; l.commit("x",v); v.a.b=2; assert.equal(l.get("x").a.b,1); assert.equal(Object.isFrozen(l.get("x")),true); });

test("downstream-evidence-is-existing-contract", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); const r=f.consume(p); assert.equal(r.value.rulesetVersion,"authenticated-human-gate-authorization-evidence-v0.1.0"); });
test("downstream-evidence-lifecycle-current", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.lifecycleState,"CURRENT"); });
test("downstream-evidence-freshness-current", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.freshnessState,"CURRENT"); });
test("downstream-evidence-contradiction-none", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.contradictionState,"NONE"); });
test("downstream-evidence-authority-none", () => { const f=createFixture(); const p=f.present().value; f.setDecision(p); assert.equal(f.consume(p).value.authority,"NONE"); });

console.log(`${pass}/${pass} PASS`);
