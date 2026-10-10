"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bindingModule = require("./authenticated-human-source-event-binding");
const intakeModule = require("./authenticated-task-intent-intake-v0");

const hash = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

function harness(overrides = {}) {
  const state = {
    text: intakeModule.TASK_TEXT,
    principalRef: "gt63:principal:test-1",
    principalRevision: "1",
    principalEvidenceRef: "evidence:principal:1",
    sessionRef: "session:test-1",
    sessionRevision: "7",
    authenticatedPrincipalRef: "gt63:principal:test-1",
    authenticatedPrincipalRevision: "1",
    authenticatedSessionRef: "session:test-1",
    authenticatedSessionRevision: "7",
    sourceTrust: "TRUSTED",
    originState: "VERIFIED",
    verificationFreshness: "CURRENT",
    contradiction: "NONE",
    routingState: "BOUND",
    authenticationFreshness: "CURRENT",
    authenticationState: "AUTHENTICATED",
    throwContext: false,
    ...overrides
  };
  const counters = { sourceBinding: 0, authenticationContext: 0, intentClassification: 0, effects: 0 };
  const bytes = Buffer.from(state.text, "utf8");
  const source = {
    type: "HUMAN_SOURCE_EVENT",
    sourceEventRef: "source-event:task-1",
    sourceEventRevision: "1",
    sourceProviderRef: "provider:signed-session",
    sourceProviderRevision: "1",
    providerEventId: "event:task-1",
    contentBytesBase64: bytes.toString("base64"),
    contentEncoding: "utf8",
    contentMediaType: "text/plain",
    contentBindingContractRef: "content-binding:exact-utf8-v1",
    contentBindingContractRevision: "1",
    channelRef: "channel:authenticated-task-api",
    channelRevision: "1",
    sessionRef: state.sessionRef,
    sessionRevision: state.sessionRevision,
    occurredTemporalFrameRef: "frame:occurred:1",
    receivedTemporalFrameRef: "frame:received:1",
    interactionId: "interaction:task-1",
    contextRevision: "1",
    claimedActorRef: state.principalRef,
    presentationClass: "DIRECT",
    attributedPrincipalRef: null,
    sourceEventEvidenceRef: "evidence:source-event:1"
  };
  const principal = {
    principalRef: state.principalRef,
    principalNamespace: "gt63:test",
    principalRevision: state.principalRevision,
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    principalEvidenceRef: state.principalEvidenceRef,
    displayName: null
  };
  const registry = {
    sourceProviderRef: source.sourceProviderRef,
    sourceProviderRevision: source.sourceProviderRevision,
    trustState: state.sourceTrust,
    verificationMethodRef: "verification:signed-session-v1",
    verificationMethodRevision: "1",
    registryEvidenceRef: "evidence:source-registry:1"
  };
  const bindingLedger = {
    records: [],
    findBySourceEventRef(ref) { return this.records.filter((item) => item.sourceEventRef === ref); },
    listByContentDigest(digest) { return this.records.filter((item) => item.contentDigest === digest); },
    commit(binding) {
      if (this.records.some((item) => item.sourceEventRef === binding.sourceEventRef)) throw new Error("duplicate");
      const saved = Object.freeze(clone(binding));
      this.records.push(saved);
      return saved;
    }
  };
  const sourceBinding = bindingModule.createAuthenticatedHumanSourceEventBinding({
    sourceEventSnapshotPort() { return source; },
    sourceRegistryPort() { return registry; },
    principalIdentityPort() {
      return {
        sourceEventRef: source.sourceEventRef,
        sourceProviderRef: source.sourceProviderRef,
        providerEventId: source.providerEventId,
        status: "RESOLVED",
        candidates: [principal],
        resolutionEvidenceRef: "evidence:principal-resolution:1"
      };
    },
    verificationMethodPort() {
      return {
        verificationMethodRef: registry.verificationMethodRef,
        verificationMethodRevision: registry.verificationMethodRevision,
        trustState: "TRUSTED",
        freshnessState: state.verificationFreshness,
        methodEvidenceRef: "evidence:verification-method:1"
      };
    },
    originVerifierPort({ sourceEvent, principal: verifiedPrincipal }) {
      return {
        verificationState: state.originState,
        verifiedPrincipalRef: verifiedPrincipal ? verifiedPrincipal.principalRef : null,
        verifiedSourceEventRef: sourceEvent.sourceEventRef,
        verifiedContentDigest: hash(Buffer.from(sourceEvent.contentBytesBase64, "base64")),
        verifiedChannelRef: sourceEvent.channelRef,
        verifiedSessionRef: sourceEvent.sessionRef,
        freshnessState: state.verificationFreshness,
        contradictionState: state.contradiction,
        evidenceRefs: ["evidence:current-auth-context:1"]
      };
    },
    interactionRoutingPort() {
      return {
        sourceEventRef: source.sourceEventRef,
        providerEventId: source.providerEventId,
        interactionId: source.interactionId,
        contextRevision: source.contextRevision,
        routingRevision: "1",
        sourceProviderRef: source.sourceProviderRef,
        sourceProviderRevision: source.sourceProviderRevision,
        channelRef: source.channelRef,
        channelRevision: source.channelRevision,
        sessionRef: source.sessionRef,
        sessionRevision: source.sessionRevision,
        bindingState: state.routingState,
        routingEvidenceRef: "evidence:routing:1"
      };
    },
    bindingLedger
  });
  const intake = intakeModule.createAuthenticatedTaskIntentIntake({
    sourceBinding: {
      accept(request) {
        counters.sourceBinding += 1;
        return sourceBinding.accept(request);
      }
    },
    currentAuthenticationContextPort() {
      counters.authenticationContext += 1;
      if (state.throwContext) throw new Error("context unavailable");
      return {
        principalRef: state.authenticatedPrincipalRef,
        principalRevision: state.authenticatedPrincipalRevision,
        principalEvidenceRef: state.principalEvidenceRef,
        sessionRef: state.authenticatedSessionRef,
        sessionRevision: state.authenticatedSessionRevision,
        authenticationState: state.authenticationState,
        freshnessState: state.authenticationFreshness,
        evidenceRef: "evidence:current-auth-context:1"
      };
    }
  });
  const input = {
    inputText: intakeModule.TASK_TEXT,
    sourceBindingRequest: {
      rulesetVersion: bindingModule.RULESET_VERSION,
      sourceEventRef: source.sourceEventRef,
      expectedSourceEventRevision: "1",
      expectedSourceProviderRevision: "1",
      expectedPrincipalRevision: state.principalRevision,
      expectedVerificationMethodRevision: "1",
      expectedRoutingRevision: "1",
      expectedContextRevision: "1"
    }
  };
  return { state, counters, bindingLedger, intake, input };
}

function run() {
  const cases = [];
  const test = (name, fn) => { fn(); cases.push(name); };

  test("exact-task-authenticated-binding-classifies-read-only-intent", () => {
    const env = harness();
    const result = env.intake.classify(env.input);
    assert.equal(result.outcome, "INTENT_CLASSIFIED");
    assert.equal(result.source.inputDigest, hash(Buffer.from(intakeModule.TASK_TEXT, "utf8")));
    assert.equal(result.source.principalRef, env.state.principalRef);
    assert.equal(result.source.principalRevision, env.state.principalRevision);
    assert.equal(result.source.sessionRef, env.state.sessionRef);
    assert.equal(result.source.sessionRevision, env.state.sessionRevision);
    assert.equal(result.intentContract.source.naturalLanguage, intakeModule.TASK_TEXT);
    assert.equal(result.intentContract.AUTHORIZED.length, 0);
    assert.equal(result.intentContract.NOT_AUTHORIZED.length, 1);
    assert.equal(result.authority, "NONE");
    assert.equal(result.authorityEffect, "NONE");
    assert.equal(env.bindingLedger.records.length, 1);
    assert.equal(env.counters.effects, 0);
  });

  test("unsupported-text-fails-before-source-binding", () => {
    const env = harness();
    const result = env.intake.classify({ ...env.input, inputText: `${env.input.inputText} ` });
    assert.equal(result.reason, "TASK_NOT_ALLOWLISTED");
    assert.equal(env.counters.sourceBinding, 0);
  });

  test("extra-input-fields-fail-closed", () => {
    const env = harness();
    assert.equal(env.intake.classify({ ...env.input, authenticated: true }).reason, "INVALID_INPUT_SCHEMA");
    assert.equal(env.counters.sourceBinding, 0);
  });

  test("source-bytes-must-equal-exact-task", () => {
    const env = harness({ text: `${intakeModule.TASK_TEXT}\n` });
    assert.equal(env.intake.classify(env.input).reason, "SOURCE_BINDING_MISMATCH");
  });

  test("unknown-origin-fails-closed", () => {
    const env = harness({ sourceTrust: "UNKNOWN" });
    assert.equal(env.intake.classify(env.input).reason, "SOURCE_BINDING_MISMATCH");
  });

  test("unverified-origin-fails-closed", () => {
    const env = harness({ originState: "NOT_VERIFIED" });
    assert.equal(env.intake.classify(env.input).reason, "SOURCE_BINDING_MISMATCH");
  });

  test("missing-principal-fails-closed", () => {
    const env = harness({ principalRef: "" });
    assert.equal(env.intake.classify(env.input).outcome, "FAIL_CLOSED");
  });

  test("stale-authentication-context-fails-closed", () => {
    const env = harness({ authenticationFreshness: "STALE" });
    assert.equal(env.intake.classify(env.input).reason, "AUTHENTICATION_CONTEXT_NOT_CURRENT");
  });

  test("session-mismatch-fails-closed", () => {
    const env = harness({ authenticatedSessionRef: "session:other" });
    assert.equal(env.intake.classify(env.input).reason, "SOURCE_BINDING_MISMATCH");
  });

  test("authenticated-principal-mismatch-fails-closed", () => {
    const env = harness({ authenticatedPrincipalRef: "gt63:principal:other" });
    assert.equal(env.intake.classify(env.input).reason, "SOURCE_BINDING_MISMATCH");
  });

  test("principal-revision-mismatch-fails-closed", () => {
    const env = harness({ principalRevision: "2" });
    const input = clone(env.input);
    input.sourceBindingRequest.expectedPrincipalRevision = "1";
    assert.equal(env.intake.classify(input).reason, "SOURCE_BINDING_NOT_ACCEPTED");
  });

  test("routing-mismatch-fails-closed", () => {
    const env = harness({ routingState: "NOT_BOUND" });
    assert.equal(env.intake.classify(env.input).reason, "SOURCE_BINDING_MISMATCH");
  });

  test("contradiction-fails-closed", () => {
    const env = harness({ contradiction: "CONTRADICTORY_EVIDENCE" });
    assert.equal(env.intake.classify(env.input).reason, "SOURCE_BINDING_NOT_ACCEPTED");
  });

  test("unavailable-authentication-context-fails-closed", () => {
    const env = harness({ throwContext: true });
    assert.equal(env.intake.classify(env.input).reason, "AUTHENTICATION_CONTEXT_UNAVAILABLE");
  });

  test("all-terminal-results-preserve-no-authority", () => {
    for (const env of [harness(), harness({ sourceTrust: "UNKNOWN" }), harness({ throwContext: true })]) {
      const result = env.intake.classify(env.input);
      assert.equal(result.authority, "NONE");
      assert.equal(result.authorityEffect, "NONE");
    }
  });

  test("classification-does-not-execute-capabilities-or-effects", () => {
    const env = harness();
    const result = env.intake.classify(env.input);
    assert(!Object.hasOwn(result, "execution"));
    assert(!Object.hasOwn(result, "capabilityResult"));
    assert.equal(env.counters.effects, 0);
  });

  const summary = { status: "PASS", regression: "authenticated-task-intent-intake-v0", cases: cases.length, caseNames: cases };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

run();
