"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const capability = require("./gt63-machine/authenticated-human-source-event-binding");

const ROOT = path.resolve(__dirname, "..");
const R = capability.RULESET_VERSION;
const O = capability.OUTCOMES;
const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function createLedger() {
  const records = [];
  return Object.freeze({
    findBySourceEventRef(sourceEventRef) {
      return Object.freeze(records.filter((record) => record.sourceEventRef === sourceEventRef));
    },
    listByContentDigest(contentDigest) {
      return Object.freeze(records.filter((record) => record.contentDigest === contentDigest));
    },
    commit(binding) {
      if (records.some((record) => record.sourceEventRef === binding.sourceEventRef
        || record.bindingId === binding.bindingId)) throw new Error("immutable-ledger-conflict");
      const stored = deepFreeze(clone(binding));
      records.push(stored);
      return stored;
    },
    records() { return Object.freeze(records.slice()); }
  });
}

function sourceEvent(overrides = {}) {
  return {
    type: "HUMAN_SOURCE_EVENT",
    sourceEventRef: "source-event:001",
    sourceEventRevision: "1",
    sourceProviderRef: "source:test-chat",
    sourceProviderRevision: "7",
    providerEventId: "provider-event:001",
    contentBytesBase64: Buffer.from("Approve exact gate G-1", "utf8").toString("base64"),
    contentEncoding: "utf8",
    contentMediaType: "text/plain",
    contentBindingContractRef: "content-binding:application-bytes",
    contentBindingContractRevision: "1",
    channelRef: "channel:alpha",
    channelRevision: "3",
    sessionRef: "session:alpha",
    sessionRevision: "4",
    occurredTemporalFrameRef: "time:occurred:001",
    receivedTemporalFrameRef: "time:received:001",
    interactionId: "interaction:001",
    contextRevision: "9",
    claimedActorRef: "principal:alice",
    presentationClass: "DIRECT",
    attributedPrincipalRef: null,
    sourceEventEvidenceRef: "evidence:source-event:001",
    ...overrides
  };
}

function sourceRegistry(overrides = {}) {
  return {
    sourceProviderRef: "source:test-chat",
    sourceProviderRevision: "7",
    trustState: "TRUSTED",
    verificationMethodRef: "verification:test-signature",
    verificationMethodRevision: "5",
    registryEvidenceRef: "evidence:source-registry:7",
    ...overrides
  };
}

function principal(overrides = {}) {
  return {
    principalRef: "principal:alice",
    principalNamespace: "identity:test",
    principalRevision: "11",
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    principalEvidenceRef: "evidence:principal:alice:11",
    displayName: "Alice",
    ...overrides
  };
}

function identityResolution(overrides = {}) {
  return {
    sourceEventRef: "source-event:001",
    sourceProviderRef: "source:test-chat",
    providerEventId: "provider-event:001",
    status: "RESOLVED",
    candidates: [principal()],
    resolutionEvidenceRef: "evidence:identity-resolution:001",
    ...overrides
  };
}

function method(overrides = {}) {
  return {
    verificationMethodRef: "verification:test-signature",
    verificationMethodRevision: "5",
    trustState: "TRUSTED",
    freshnessState: "CURRENT",
    methodEvidenceRef: "evidence:verification-method:5",
    ...overrides
  };
}

function routing(overrides = {}) {
  return {
    sourceEventRef: "source-event:001",
    providerEventId: "provider-event:001",
    interactionId: "interaction:001",
    contextRevision: "9",
    routingRevision: "13",
    sourceProviderRef: "source:test-chat",
    sourceProviderRevision: "7",
    channelRef: "channel:alpha",
    channelRevision: "3",
    sessionRef: "session:alpha",
    sessionRevision: "4",
    bindingState: "BOUND",
    routingEvidenceRef: "evidence:routing:13",
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    rulesetVersion: R,
    sourceEventRef: "source-event:001",
    expectedSourceEventRevision: "1",
    expectedSourceProviderRevision: "7",
    expectedPrincipalRevision: "11",
    expectedVerificationMethodRevision: "5",
    expectedRoutingRevision: "13",
    expectedContextRevision: "9",
    ...overrides
  };
}

function system(overrides = {}) {
  const state = {
    source: sourceEvent(),
    registry: sourceRegistry(),
    identity: identityResolution(),
    method: method(),
    routing: routing(),
    verificationPatch: {},
    failPort: null,
    ledger: createLedger(),
    ...overrides
  };
  const counters = {
    source: 0, registry: 0, identity: 0, method: 0, verifier: 0,
    routing: 0, authorityWrites: 0, eligibilityChecks: 0
  };
  function provided(name, value) {
    counters[name] += 1;
    if (state.failPort === name) throw new Error(`${name}-unavailable`);
    return clone(value);
  }
  const binding = capability.createAuthenticatedHumanSourceEventBinding({
    sourceEventSnapshotPort() { return provided("source", state.source); },
    sourceRegistryPort() { return provided("registry", state.registry); },
    principalIdentityPort() { return provided("identity", state.identity); },
    verificationMethodPort() { return provided("method", state.method); },
    originVerifierPort(input) {
      counters.verifier += 1;
      if (state.failPort === "verifier") throw new Error("verifier-unavailable");
      const candidate = state.identity.status === "RESOLVED" ? state.identity.candidates[0] : null;
      return clone({
        verificationState: candidate ? "VERIFIED" : "UNKNOWN",
        verifiedPrincipalRef: candidate ? candidate.principalRef : null,
        verifiedSourceEventRef: state.source.sourceEventRef,
        verifiedContentDigest: `sha256:${crypto.createHash("sha256")
          .update(Buffer.from(input.sourceEvent.contentBytesBase64, "base64")).digest("hex")}`,
        verifiedChannelRef: state.source.channelRef,
        verifiedSessionRef: state.source.sessionRef,
        freshnessState: "CURRENT",
        contradictionState: "NONE",
        evidenceRefs: ["evidence:origin:002", "evidence:origin:001"],
        ...state.verificationPatch
      });
    },
    interactionRoutingPort() { return provided("routing", state.routing); },
    bindingLedger: state.ledger
  });
  return { binding, state, counters };
}

function expectNoAuthority(result, counters) {
  assert.equal(result.authority, "NONE");
  if (result.binding) assert.equal(result.binding.authority, "NONE");
  assert.equal(counters.authorityWrites, 0);
  assert.equal(counters.eligibilityChecks, 0);
  for (const forbidden of ["ACTION_AUTHORIZED", "ELIGIBLE_PRINCIPAL", "INTENT_ACCEPTED"]){
    assert(!JSON.stringify(result).includes(forbidden));
  }
}

function runSuite() {
  const cases = [];
  const ok = (name, fn) => { fn(); cases.push(name); };

  ok("exact-schema-rejection", () => {
    const env = system();
    const response = env.binding.accept({ ...request(), extra: true });
    assert.equal(response.outcome, O.REJECTED);
    assert.equal(env.counters.source, 0);
  });
  ok("unsupported-ruleset-rejection", () => {
    const env = system();
    assert.equal(env.binding.accept(request({ rulesetVersion: "binding-v0" })).outcome, O.REJECTED);
  });
  ok("caller-authenticated-flag-rejected", () => {
    const env = system();
    assert.equal(env.binding.accept({ ...request(), authenticated: true }).outcome, O.REJECTED);
  });
  ok("accepted-exact-human-origin-binding", () => {
    const env = system();
    const response = env.binding.accept(request());
    assert.equal(response.outcome, O.ACCEPTED);
    assert.equal(response.binding.originAuthenticationState, "AUTHENTICATED");
    assert.equal(response.binding.contentIntegrityState, "EXACT_BYTES");
    assert.equal(response.binding.interactionBindingState, "BOUND");
    expectNoAuthority(response, env.counters);
  });
  ok("fabricated-actor-ref-does-not-define-principal", () => {
    const env = system({ source: sourceEvent({ claimedActorRef: "principal:mallory" }) });
    const response = env.binding.accept(request());
    assert.equal(response.binding.principalRef, "principal:alice");
    assert.equal(response.binding.claimedActorRelation, "DIFFERS_FROM_VERIFIED_PRINCIPAL");
    assert.equal(response.binding.originAuthenticationState, "AUTHENTICATED");
  });
  ok("copied-forwarded-approval-binds-forwarder-not-attribution", () => {
    const operator = principal({ principalRef: "principal:bob", principalRevision: "21", principalEvidenceRef: "evidence:principal:bob:21" });
    const env = system({
      source: sourceEvent({ claimedActorRef: "principal:bob", presentationClass: "FORWARDED", attributedPrincipalRef: "principal:alice" }),
      identity: identityResolution({ candidates: [operator] })
    });
    const response = env.binding.accept(request({ expectedPrincipalRevision: "21" }));
    assert.equal(response.binding.principalRef, "principal:bob");
    assert.equal(response.binding.attributionState, "UNVERIFIED_ATTRIBUTION");
    assert.equal(response.binding.delegationState, "UNRESOLVED");
  });
  ok("old-event-replay-stale", () => {
    const env = system({ verificationPatch: { freshnessState: "STALE" } });
    assert.equal(env.binding.accept(request()).outcome, O.STALE);
    assert.equal(env.state.ledger.records().length, 0);
  });
  ok("wrong-interaction-preserved-not-bound", () => {
    const env = system({ routing: routing({ interactionId: "interaction:other" }) });
    const response = env.binding.accept(request());
    assert.equal(response.outcome, O.ACCEPTED);
    assert.equal(response.binding.interactionBindingState, "NOT_BOUND");
  });
  ok("changed-bytes-under-same-event-id-conflict", () => {
    const env = system();
    const first = env.binding.accept(request());
    assert.equal(first.outcome, O.ACCEPTED);
    env.state.source.contentBytesBase64 = Buffer.from("Different exact bytes", "utf8").toString("base64");
    const second = env.binding.accept(request());
    assert.equal(second.outcome, O.IDENTITY_CONFLICT);
    assert.equal(env.state.ledger.records().length, 1);
  });
  ok("revoked-principal-preserves-historical-authorship", () => {
    const revoked = principal({ lifecycleState: "REVOKED" });
    const env = system({ identity: identityResolution({ candidates: [revoked] }) });
    const response = env.binding.accept(request());
    assert.equal(response.outcome, O.ACCEPTED);
    assert.equal(response.binding.originAuthenticationState, "AUTHENTICATED");
    assert.equal(response.binding.principalLifecycleState, "REVOKED");
    assert(!Object.hasOwn(response.binding, "eligible"));
  });
  ok("later-revocation-does-not-rewrite-accepted-authorship", () => {
    const env = system();
    const first = env.binding.accept(request());
    env.state.identity.candidates[0].lifecycleState = "REVOKED";
    env.state.identity.candidates[0].principalRevision = "12";
    env.state.identity.candidates[0].principalEvidenceRef = "evidence:principal:alice:12";
    const replay = env.binding.accept(request());
    assert.equal(replay.outcome, O.ALREADY_ACCEPTED);
    assert.equal(replay.binding.bindingId, first.binding.bindingId);
    assert.equal(replay.binding.principalLifecycleState, "CURRENT");
    assert.equal(env.state.ledger.records().length, 1);
  });
  ok("stale-principal-evidence-rejected-as-stale", () => {
    const stale = principal({ freshnessState: "STALE" });
    const env = system({ identity: identityResolution({ candidates: [stale] }) });
    assert.equal(env.binding.accept(request()).outcome, O.STALE);
  });
  ok("stale-verification-method-rejected-as-stale", () => {
    const env = system({ method: method({ freshnessState: "STALE" }) });
    assert.equal(env.binding.accept(request()).outcome, O.STALE);
  });
  ok("missing-principal-preserves-unknown", () => {
    const env = system({ identity: identityResolution({ status: "MISSING", candidates: [] }) });
    const response = env.binding.accept(request({ expectedPrincipalRevision: null }));
    assert.equal(response.outcome, O.ACCEPTED);
    assert.equal(response.binding.principalResolutionState, "MISSING");
    assert.equal(response.binding.originAuthenticationState, "UNKNOWN");
  });
  ok("ambiguous-principal-preserves-unknown", () => {
    const second = principal({ principalRef: "principal:alice-duplicate", principalRevision: "12", principalEvidenceRef: "evidence:principal:duplicate" });
    const env = system({ identity: identityResolution({ status: "AMBIGUOUS", candidates: [principal(), second] }) });
    const response = env.binding.accept(request({ expectedPrincipalRevision: null }));
    assert.equal(response.outcome, O.ACCEPTED);
    assert.equal(response.binding.principalResolutionState, "AMBIGUOUS");
    assert.equal(response.binding.originAuthenticationState, "UNKNOWN");
  });
  ok("trusted-channel-unverified-sender", () => {
    const env = system({ verificationPatch: {
      verificationState: "NOT_VERIFIED", verifiedPrincipalRef: null,
      verifiedSourceEventRef: null, verifiedContentDigest: null,
      verifiedChannelRef: null, verifiedSessionRef: null
    } });
    const response = env.binding.accept(request());
    assert.equal(response.outcome, O.ACCEPTED);
    assert.equal(response.binding.sourceTrustState, "TRUSTED");
    assert.equal(response.binding.originAuthenticationState, "NOT_AUTHENTICATED");
  });
  ok("verified-sender-untrusted-source-not-authenticated", () => {
    const env = system({ registry: sourceRegistry({ trustState: "UNTRUSTED" }) });
    const response = env.binding.accept(request());
    assert.equal(response.outcome, O.ACCEPTED);
    assert.equal(response.binding.sourceTrustState, "UNTRUSTED");
    assert.equal(response.binding.originAuthenticationState, "UNKNOWN");
  });
  ok("delegated-operator-remains-unresolved", () => {
    const operator = principal({ principalRef: "principal:operator", principalRevision: "31", principalEvidenceRef: "evidence:operator:31" });
    const env = system({
      source: sourceEvent({ claimedActorRef: "principal:operator", attributedPrincipalRef: "principal:owner" }),
      identity: identityResolution({ candidates: [operator] })
    });
    const response = env.binding.accept(request({ expectedPrincipalRevision: "31" }));
    assert.equal(response.binding.principalRef, "principal:operator");
    assert.equal(response.binding.delegationState, "UNRESOLVED");
    assert(!Object.hasOwn(response.binding, "delegationValid"));
  });
  ok("contradictory-trusted-verifiers-conflict", () => {
    const env = system({ verificationPatch: { contradictionState: "CONTRADICTORY_EVIDENCE" } });
    assert.equal(env.binding.accept(request()).outcome, O.IDENTITY_CONFLICT);
    assert.equal(env.state.ledger.records().length, 0);
  });
  ok("duplicate-same-event-is-idempotent", () => {
    const env = system();
    const first = env.binding.accept(request());
    const second = env.binding.accept(request());
    assert.equal(first.outcome, O.ACCEPTED);
    assert.equal(second.outcome, O.ALREADY_ACCEPTED);
    assert.equal(first.binding.bindingId, second.binding.bindingId);
    assert.equal(env.state.ledger.records().length, 1);
  });
  ok("same-content-new-event-is-distinct-and-linked", () => {
    const env = system();
    const first = env.binding.accept(request());
    env.state.source = sourceEvent({
      sourceEventRef: "source-event:002", providerEventId: "provider-event:002",
      sourceEventEvidenceRef: "evidence:source-event:002"
    });
    env.state.identity = identityResolution({
      sourceEventRef: "source-event:002", providerEventId: "provider-event:002"
    });
    env.state.routing = routing({
      sourceEventRef: "source-event:002", providerEventId: "provider-event:002"
    });
    const second = env.binding.accept(request({ sourceEventRef: "source-event:002" }));
    assert.equal(second.outcome, O.ACCEPTED);
    assert.notEqual(first.binding.bindingId, second.binding.bindingId);
    assert.deepEqual(second.binding.priorContentEventRefs, ["source-event:001"]);
    assert.equal(env.state.ledger.records().length, 2);
  });
  ok("source-registry-unavailable-preserves-uncertain", () => {
    const env = system({ failPort: "registry" });
    const response = env.binding.accept(request());
    assert.equal(response.outcome, O.UNCERTAIN);
    assert.equal(response.binding, null);
  });
  ok("unicode-exact-byte-distinction", () => {
    const composed = system({ source: sourceEvent({
      sourceEventRef: "source-event:unicode-composed", providerEventId: "unicode-composed",
      contentBytesBase64: Buffer.from("caf\u00e9", "utf8").toString("base64"),
      sourceEventEvidenceRef: "evidence:unicode-composed"
    }), identity: identityResolution({
      sourceEventRef: "source-event:unicode-composed", providerEventId: "unicode-composed"
    }), routing: routing({
      sourceEventRef: "source-event:unicode-composed", providerEventId: "unicode-composed"
    }) });
    const decomposed = system({ source: sourceEvent({
      sourceEventRef: "source-event:unicode-decomposed", providerEventId: "unicode-decomposed",
      contentBytesBase64: Buffer.from("cafe\u0301", "utf8").toString("base64"),
      sourceEventEvidenceRef: "evidence:unicode-decomposed"
    }), identity: identityResolution({
      sourceEventRef: "source-event:unicode-decomposed", providerEventId: "unicode-decomposed"
    }), routing: routing({
      sourceEventRef: "source-event:unicode-decomposed", providerEventId: "unicode-decomposed"
    }) });
    const left = composed.binding.accept(request({ sourceEventRef: "source-event:unicode-composed" }));
    const right = decomposed.binding.accept(request({ sourceEventRef: "source-event:unicode-decomposed" }));
    assert.notEqual(left.binding.contentDigest, right.binding.contentDigest);
    assert.notEqual(left.binding.bindingId, right.binding.bindingId);
  });
  ok("evidence-ref-deduplication-and-order", () => {
    const left = system({ verificationPatch: { evidenceRefs: ["evidence:z", "evidence:a", "evidence:z"] } });
    const right = system({ verificationPatch: { evidenceRefs: ["evidence:a", "evidence:z"] } });
    const a = left.binding.accept(request());
    const b = right.binding.accept(request());
    assert.equal(a.binding.bindingId, b.binding.bindingId);
    assert.deepEqual(a.binding.evidenceRefs, [...new Set(a.binding.evidenceRefs)].sort());
  });
  ok("material-field-mutation-changes-binding-id", () => {
    const left = system();
    const right = system({
      source: sourceEvent({ contextRevision: "10" }),
      routing: routing({ contextRevision: "10" })
    });
    const a = left.binding.accept(request());
    const b = right.binding.accept(request({ expectedContextRevision: "10" }));
    assert.notEqual(a.binding.bindingId, b.binding.bindingId);
  });
  ok("nonmaterial-display-name-mutation-does-not-change-id", () => {
    const left = system();
    const renamed = principal({ displayName: "Alice Renamed" });
    const right = system({ identity: identityResolution({ candidates: [renamed] }) });
    const a = left.binding.accept(request());
    const b = right.binding.accept(request());
    assert.equal(a.binding.bindingId, b.binding.bindingId);
    assert.deepEqual(a.binding, b.binding);
  });
  ok("immutable-ledger-record", () => {
    const env = system();
    const response = env.binding.accept(request());
    const stored = env.state.ledger.records()[0];
    assert(Object.isFrozen(stored));
    assert(Object.isFrozen(stored.evidenceRefs));
    assert.throws(() => { stored.principalRef = "principal:mallory"; }, TypeError);
    assert.equal(stored.bindingId, response.binding.bindingId);
  });
  ok("authority-is-always-none", () => {
    for (const env of [system(), system({ failPort: "registry" }), system({ verificationPatch: { freshnessState: "STALE" } })]) {
      expectNoAuthority(env.binding.accept(request()), env.counters);
    }
  });
  ok("wrong-event-revision-is-stale", () => {
    const env = system();
    assert.equal(env.binding.accept(request({ expectedSourceEventRevision: "0" })).outcome, O.STALE);
  });
  ok("wrong-provider-revision-is-stale", () => {
    const env = system();
    assert.equal(env.binding.accept(request({ expectedSourceProviderRevision: "6" })).outcome, O.STALE);
  });
  ok("wrong-principal-revision-is-stale", () => {
    const env = system();
    assert.equal(env.binding.accept(request({ expectedPrincipalRevision: "10" })).outcome, O.STALE);
  });
  ok("wrong-routing-revision-is-stale", () => {
    const env = system();
    assert.equal(env.binding.accept(request({ expectedRoutingRevision: "12" })).outcome, O.STALE);
  });
  ok("verified-principal-mismatch-is-conflict", () => {
    const env = system({ verificationPatch: { verifiedPrincipalRef: "principal:mallory" } });
    assert.equal(env.binding.accept(request()).outcome, O.IDENTITY_CONFLICT);
  });
  ok("invalid-port-evidence-preserves-uncertain", () => {
    const env = system({ routing: { invalid: true } });
    assert.equal(env.binding.accept(request()).outcome, O.UNCERTAIN);
  });
  ok("invalid-base64-source-evidence-rejected", () => {
    const env = system({ source: sourceEvent({ contentBytesBase64: "not-base64" }) });
    assert.equal(env.binding.accept(request()).outcome, O.REJECTED);
  });
  ok("source-isolation-audit", () => {
    const source = fs.readFileSync(path.join(ROOT, "scripts/gt63-machine/authenticated-human-source-event-binding.js"), "utf8");
    for (const forbidden of [
      "require(\"node:fs\")", "require('node:fs')", "require(\"node:path\")", "require('node:path')",
      "process.env", "process.cwd", "Date.", "new Date", "performance.now", "Math.random",
      "localeCompare", "Intl", "child_process", "execSync", "spawn", "fetch("
    ]) assert(!source.includes(forbidden), `forbidden:${forbidden}`);
  });
  ok("syntax-checks", () => {
    for (const file of [
      "scripts/gt63-machine/authenticated-human-source-event-binding.js",
      "scripts/gt63-machine-authenticated-human-source-event-binding-regression.js"
    ]) {
      const checked = childProcess.spawnSync(process.execPath, ["--check", file], { cwd: ROOT, encoding: "utf8" });
      assert.equal(checked.status, 0, checked.stderr || checked.stdout);
    }
  });

  const sample = system().binding.accept(request());
  const semantic = {
    cases,
    rulesetVersion: R,
    outcomes: Object.values(O),
    sampleBindingId: sample.binding.bindingId,
    sampleContentDigest: sample.binding.contentDigest,
    authority: sample.authority
  };
  return deepFreeze({
    status: "PASS",
    workflow: "authenticated-human-source-event-binding-v0-regression",
    cases: cases.length,
    validationIdentity: hash(JSON.stringify(semantic)),
    semantic
  });
}

const first = runSuite();
const second = runSuite();
assert.equal(JSON.stringify(first), JSON.stringify(second));
process.stdout.write(`${JSON.stringify({ ...first, deterministicRuns: 2, outputHash: hash(JSON.stringify(first)) })}\n`);
