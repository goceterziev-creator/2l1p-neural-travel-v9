"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  createAyaTrustedEligibilityQueryOwnerV0
} = require("./aya-trusted-eligibility-query-owner-v0");

const tests = [];

function test(name, body) {
  tests.push({ name, body });
}

function currentState() {
  return {
    lifecycleState: "CURRENT",
    freshnessState: "CURRENT",
    contradictionState: "NONE",
    authority: "NONE",
    authorityEffect: "NONE"
  };
}

function candidateSet() {
  return {
    type: "GT63_AYA_ELIGIBILITY_CANDIDATE_SET",
    schemaVersion: "1.0",
    snapshotRef: "snapshot:1",
    snapshotRevision: 1,
    authenticatedAccount: {
      accountRef: "account:1",
      accountRevision: "account-revision:1",
      principalRef: "principal:1",
      principalRevision: "principal-revision:1",
      principalEvidenceRef: "principal-evidence:1",
      ...currentState()
    },
    associations: [
      {
        type: "AYA_AUTHENTICATED_ACCOUNT_INTERACTION_ASSOCIATION",
        associationRef: "association:1",
        associationRevision: "association-revision:1",
        accountRef: "account:1",
        accountRevision: "account-revision:1",
        interactionId: "interaction:1",
        interactionRevision: 7,
        ...currentState()
      }
    ],
    interactions: [
      {
        interactionId: "interaction:1",
        interactionRevision: 7,
        ...currentState()
      }
    ],
    gateCandidates: [
      {
        gateId: "gate:1",
        gateRevision: 3,
        interactionId: "interaction:1",
        registeredInteractionRevision: 5,
        status: "PENDING",
        authorityScope: { z: true, a: 1 },
        continuationTargetRef: "target:1",
        continuationTargetRevision: "target-revision:1",
        ...currentState()
      }
    ],
    continuationTargets: [
      {
        continuationTargetRef: "target:1",
        continuationTargetRevision: "target-revision:1",
        ...currentState()
      }
    ],
    authority: "NONE",
    authorityEffect: "NONE"
  };
}

function raw(snapshot = candidateSet()) {
  return Buffer.from(JSON.stringify(snapshot), "utf8");
}

function ownerFor({
  snapshot = candidateSet(),
  rawSnapshot,
  provider,
  port = () => ({ authority: "NONE", eligible: true })
} = {}) {
  const bytes = rawSnapshot === undefined ? raw(snapshot) : rawSnapshot;
  return createAyaTrustedEligibilityQueryOwnerV0({
    withEligibilityCandidateSetSnapshot: provider || ((consume) => consume(bytes)),
    principalEligibilityPort: port
  });
}

function assertEnvelope(result, expected) {
  assert.equal(result.type, "GT63_AYA_TRUSTED_ELIGIBILITY_QUERY_OWNER_RESULT");
  assert.equal(result.schemaVersion, "1.0");
  assert.equal(result.rulesetVersion, "aya-trusted-eligibility-query-owner-v0.1.0");
  assert.equal(result.authority, "NONE");
  assert.equal(result.authorityEffect, "NONE");
  assert.equal(result.nonClaims.principalEligibilityInferredByOwner, false);
  assert.equal(result.nonClaims.roleCreated, false);
  assert.equal(result.nonClaims.assignmentCreated, false);
  assert.equal(result.nonClaims.delegationCreated, false);
  assert.equal(result.nonClaims.humanAuthorizationCreated, false);
  assert.equal(result.nonClaims.humanGateCreated, false);
  assert.equal(result.nonClaims.humanGateSatisfied, false);
  assert.equal(result.nonClaims.continuationAuthorityCreated, false);
  assert.equal(result.nonClaims.executionAuthorityCreated, false);
  assert.equal(result.nonClaims.effectAuthorized, false);
  assert.equal(result.nonClaims.offerMutationPerformed, false);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(result[key], value, key);
  }
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.nonClaims), true);
}

test("constructor accepts exactly the two data-property functions", () => {
  const owner = ownerFor();
  assert.deepEqual(Object.keys(owner), ["evaluate"]);
  assert.equal(Object.isFrozen(owner), true);
});

test("constructor rejects extra, inherited, accessor, symbol, and proxy dependencies", () => {
  const good = () => null;
  assert.throws(() => createAyaTrustedEligibilityQueryOwnerV0({
    withEligibilityCandidateSetSnapshot: good,
    principalEligibilityPort: good,
    extra: true
  }), TypeError);
  const inherited = Object.create({ principalEligibilityPort: good });
  inherited.withEligibilityCandidateSetSnapshot = good;
  assert.throws(() => createAyaTrustedEligibilityQueryOwnerV0(inherited), TypeError);
  const accessor = { principalEligibilityPort: good };
  Object.defineProperty(accessor, "withEligibilityCandidateSetSnapshot", {
    enumerable: true,
    get() { return good; }
  });
  assert.throws(() => createAyaTrustedEligibilityQueryOwnerV0(accessor), TypeError);
  const symbol = {
    withEligibilityCandidateSetSnapshot: good,
    principalEligibilityPort: good,
    [Symbol("extra")]: true
  };
  assert.throws(() => createAyaTrustedEligibilityQueryOwnerV0(symbol), TypeError);
  assert.throws(() => createAyaTrustedEligibilityQueryOwnerV0(new Proxy({
    withEligibilityCandidateSetSnapshot: good,
    principalEligibilityPort: good
  }, {})), TypeError);
});

test("evaluate arguments are rejected before either dependency is invoked", () => {
  let providerCalls = 0;
  let portCalls = 0;
  const owner = ownerFor({
    provider() { providerCalls += 1; },
    port() { portCalls += 1; }
  });
  const result = owner.evaluate("forbidden");
  assertEnvelope(result, {
    outcome: "QUERY_REJECTED",
    reason: "PUBLIC_ARGUMENTS_FORBIDDEN",
    queryState: "NOT_DERIVED",
    portState: "NOT_INVOKED",
    invocationCount: 0,
    eligibilityResult: null
  });
  assert.equal(providerCalls, 0);
  assert.equal(portCalls, 0);
});

test("valid candidate set derives one private frozen query and returns a defensive result copy", () => {
  let capturedQuery;
  const returned = { authority: "NONE", eligible: true, evidence: { revision: 1 } };
  const result = ownerFor({
    port(query) {
      capturedQuery = query;
      return returned;
    }
  }).evaluate();
  returned.eligible = false;
  returned.evidence.revision = 2;
  assertEnvelope(result, {
    outcome: "ELIGIBILITY_RESULT_RETURNED",
    reason: null,
    queryState: "DERIVED",
    portState: "RETURNED_VALUE",
    invocationCount: 1
  });
  assert.equal(result.eligibilityResult.eligible, true);
  assert.equal(result.eligibilityResult.evidence.revision, 1);
  assert.equal(Object.isFrozen(result.eligibilityResult), true);
  assert.equal(Object.isFrozen(result.eligibilityResult.evidence), true);
  assert.equal(Object.isFrozen(capturedQuery), true);
  assert.equal(Object.isFrozen(capturedQuery.contextScope), true);
  assert.equal(Object.values(result).includes(capturedQuery), false);
  assert.deepEqual(Object.keys(capturedQuery), [
    "principalRef",
    "principalRevision",
    "governanceAct",
    "contextScope"
  ]);
});

test("query fields and 0x00 domain-separated canonical digest are exact", () => {
  let query;
  const snapshot = candidateSet();
  snapshot.gateCandidates[0].authorityScope = { "ä": 2, a: 1, slash: "/", line: "\n" };
  ownerFor({ snapshot, port(value) { query = value; return null; } }).evaluate();
  const canonical = "{\"a\":1,\"line\":\"\\n\",\"slash\":\"/\",\"ä\":2}";
  const expectedDigest = `sha256:${createHash("sha256")
    .update(Buffer.concat([
      Buffer.from("GT63:AYA:TRUSTED_ELIGIBILITY_QUERY_OWNER:V0:AUTHORITY_SCOPE", "ascii"),
      Buffer.from([0x00]),
      Buffer.from(canonical, "utf8")
    ]))
    .digest("hex")}`;
  assert.deepEqual(query, {
    principalRef: "principal:1",
    principalRevision: "principal-revision:1",
    governanceAct: "GATE_AUTHORIZATION",
    contextScope: {
      scopeType: "GATE",
      interactionId: "interaction:1",
      fromInteractionRevision: 5,
      throughInteractionRevision: 7,
      gateId: "gate:1",
      gateRevision: 3,
      authorityScopeDigest: expectedDigest,
      continuationTargetRef: "target:1"
    }
  });
});

test("null eligibility return remains opaque and is not eligibility proof", () => {
  const result = ownerFor({ port: () => null }).evaluate();
  assertEnvelope(result, {
    outcome: "RETURNED_NULL",
    reason: null,
    queryState: "DERIVED",
    portState: "RETURNED_NULL",
    invocationCount: 1,
    eligibilityResult: null
  });
});

test("eligibility-port throw is contained", () => {
  const result = ownerFor({ port() { throw new Error("provider failure"); } }).evaluate();
  assertEnvelope(result, {
    outcome: "EVALUATION_ERROR",
    reason: "PRINCIPAL_ELIGIBILITY_PORT_THREW",
    queryState: "DERIVED",
    portState: "THREW",
    invocationCount: 1,
    eligibilityResult: null
  });
});

test("eligibility-port Promise and arbitrary thenable returns are rejected", () => {
  for (const value of [Promise.resolve(null), { then() {} }]) {
    const result = ownerFor({ port: () => value }).evaluate();
    assertEnvelope(result, {
      outcome: "EVALUATION_ERROR",
      reason: "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_ASYNC",
      queryState: "DERIVED",
      portState: "RETURNED_ASYNC",
      invocationCount: 1,
      eligibilityResult: null
    });
  }
});

test("malformed eligibility structures, authority, effects, and claims are rejected", () => {
  const malformed = [
    true,
    [],
    { authority: "SOME" },
    { authority: "NONE", authorityEffect: "WRITE" },
    { authority: "NONE", nonClaims: { roleCreated: true } },
    { authority: "NONE", roleCreated: true },
    { authority: "NONE", value: undefined },
    { authority: "NONE", value: 1.5 },
    { authority: "NONE", value: -0 },
    { authority: "NONE", value: BigInt(1) },
    { authority: "NONE", value: new Date(0) },
    new Proxy({ authority: "NONE" }, {})
  ];
  const cyclic = { authority: "NONE" };
  cyclic.self = cyclic;
  malformed.push(cyclic);
  const shared = { value: 1 };
  malformed.push({ authority: "NONE", left: shared, right: shared });
  for (const value of malformed) {
    const result = ownerFor({ port: () => value }).evaluate();
    assert.equal(result.reason, "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
    assert.equal(result.portState, "RETURNED_MALFORMED");
    assert.equal(result.invocationCount, 1);
  }
});

test("eligibility-result accessors are rejected without invoking the getter", () => {
  let getterCalls = 0;
  const value = { authority: "NONE" };
  Object.defineProperty(value, "secret", {
    enumerable: true,
    get() { getterCalls += 1; return "not read"; }
  });
  const result = ownerFor({ port: () => value }).evaluate();
  assert.equal(result.reason, "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
  assert.equal(getterCalls, 0);
});

test("eligibility-result then accessor is malformed and is never invoked", () => {
  let getterCalls = 0;
  const value = { authority: "NONE" };
  Object.defineProperty(value, "then", {
    enumerable: true,
    get() { getterCalls += 1; return () => {}; }
  });
  const result = ownerFor({ port: () => value }).evaluate();
  assert.equal(result.reason, "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
  assert.equal(result.portState, "RETURNED_MALFORMED");
  assert.equal(getterCalls, 0);
});

test("eligibility-result Proxy is malformed without invoking its get trap", () => {
  let getTrapCalls = 0;
  const value = new Proxy({ authority: "NONE" }, {
    get(target, key, receiver) {
      getTrapCalls += 1;
      return Reflect.get(target, key, receiver);
    }
  });
  const result = ownerFor({ port: () => value }).evaluate();
  assert.equal(result.reason, "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
  assert.equal(result.portState, "RETURNED_MALFORMED");
  assert.equal(getTrapCalls, 0);
});

test("eligibility-result nonClaims must be a plain object", () => {
  for (const nonClaims of [true, null, []]) {
    const result = ownerFor({
      port: () => ({ authority: "NONE", nonClaims })
    }).evaluate();
    assert.equal(result.reason, "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
    assert.equal(result.portState, "RETURNED_MALFORMED");
  }
});

test("eligibility-result nonClaims accepts only false boolean values", () => {
  const accepted = ownerFor({
    port: () => ({
      authority: "NONE",
      nonClaims: {
        roleCreated: false,
        executionAuthorityCreated: false
      }
    })
  }).evaluate();
  assert.equal(accepted.outcome, "ELIGIBILITY_RESULT_RETURNED");
  assert.equal(accepted.eligibilityResult.nonClaims.roleCreated, false);
  assert.equal(accepted.eligibilityResult.nonClaims.executionAuthorityCreated, false);

  for (const value of [true, 0, "false", null, {}, []]) {
    const result = ownerFor({
      port: () => ({ authority: "NONE", nonClaims: { claim: value } })
    }).evaluate();
    assert.equal(result.reason, "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
    assert.equal(result.portState, "RETURNED_MALFORMED");
  }
});

test("returned query identity or nested query identity is never exposed as evidence", () => {
  let directResult;
  directResult = ownerFor({ port: (query) => query }).evaluate();
  assert.equal(directResult.reason, "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
  const nestedResult = ownerFor({
    port: (query) => ({ authority: "NONE", leakedQuery: query.contextScope })
  }).evaluate();
  assert.equal(nestedResult.reason, "PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
});

test("snapshot provider must call consume exactly once synchronously", () => {
  const zero = ownerFor({ provider: () => undefined }).evaluate();
  assert.equal(zero.reason, "SNAPSHOT_CALLBACK_CARDINALITY_VIOLATION");

  const twice = ownerFor({
    provider(consume) {
      const first = consume(raw());
      try { consume(raw()); } catch {}
      return first;
    }
  }).evaluate();
  assert.equal(twice.reason, "SNAPSHOT_CALLBACK_CARDINALITY_VIOLATION");
  assert.equal(twice.invocationCount, 1);
});

test("late consume invocation throws and cannot revise the completed result", () => {
  let savedConsume;
  const result = ownerFor({
    provider(consume) {
      savedConsume = consume;
      return consume(raw());
    }
  }).evaluate();
  assert.equal(result.outcome, "ELIGIBILITY_RESULT_RETURNED");
  assert.throws(() => savedConsume(raw()));
  assert.equal(result.outcome, "ELIGIBILITY_RESULT_RETURNED");
});

test("post-callback provider violations override provisional outcome in fixed precedence", () => {
  const thrown = ownerFor({
    provider(consume) {
      consume(raw());
      throw new Error("after callback");
    }
  }).evaluate();
  assert.equal(thrown.reason, "SNAPSHOT_PROVIDER_THREW");
  assert.equal(thrown.invocationCount, 1);

  const asyncReturn = ownerFor({
    provider(consume) {
      consume(raw());
      return Promise.resolve(null);
    }
  }).evaluate();
  assert.equal(asyncReturn.reason, "SNAPSHOT_PROVIDER_RETURNED_ASYNC");
  assert.equal(asyncReturn.invocationCount, 1);

  const mismatch = ownerFor({
    provider(consume) {
      consume(raw());
      return { different: true };
    }
  }).evaluate();
  assert.equal(mismatch.reason, "SNAPSHOT_RETURN_CONTRACT_VIOLATION");
  assert.equal(mismatch.invocationCount, 1);

  const cardinalityBeforeThrow = ownerFor({
    provider(consume) {
      consume(raw());
      consume(raw());
    }
  }).evaluate();
  assert.equal(cardinalityBeforeThrow.reason, "SNAPSHOT_CALLBACK_CARDINALITY_VIOLATION");
});

test("raw snapshot must be a bounded non-BOM Buffer with fatal UTF-8", () => {
  const cases = [
    "not-a-buffer",
    Buffer.alloc(0),
    Buffer.alloc(1_048_577, 0x20),
    Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]),
    Buffer.from([0xc3, 0x28])
  ];
  for (const value of cases) {
    const result = ownerFor({ rawSnapshot: value }).evaluate();
    assert.equal(result.reason, "SNAPSHOT_BYTES_INVALID");
    assert.equal(result.invocationCount, 0);
  }
});

test("only one JSON document and only JSON whitespace around it are accepted", () => {
  for (const value of [
    Buffer.from(`${JSON.stringify(candidateSet())}{}`, "utf8"),
    Buffer.from(`\u00a0${JSON.stringify(candidateSet())}`, "utf8"),
    Buffer.from("{", "utf8")
  ]) {
    const result = ownerFor({ rawSnapshot: value }).evaluate();
    assert.equal(result.reason, "SNAPSHOT_SCHEMA_INVALID");
  }
  const accepted = ownerFor({
    rawSnapshot: Buffer.from(` \t\r\n${JSON.stringify(candidateSet())}\r\n`, "utf8")
  }).evaluate();
  assert.equal(accepted.outcome, "ELIGIBILITY_RESULT_RETURNED");
});

test("duplicate decoded keys are rejected before object materialization", () => {
  const outside = JSON.stringify(candidateSet()).replace(
    "\"snapshotRef\":\"snapshot:1\"",
    "\"snapshotRef\":\"snapshot:1\",\"snapshot\\u0052ef\":\"snapshot:2\""
  );
  assert.equal(
    ownerFor({ rawSnapshot: Buffer.from(outside, "utf8") }).evaluate().reason,
    "SNAPSHOT_SCHEMA_INVALID"
  );

  const inside = JSON.stringify(candidateSet()).replace(
    "\"authorityScope\":{\"z\":true,\"a\":1}",
    "\"authorityScope\":{\"a\":1,\"\\u0061\":2}"
  );
  assert.equal(
    ownerFor({ rawSnapshot: Buffer.from(inside, "utf8") }).evaluate().reason,
    "AUTHORITY_SCOPE_INVALID"
  );
});

test("restricted JSON numbers, scalar strings, and depth are enforced", () => {
  const base = JSON.stringify(candidateSet());
  const invalidNumbers = ["-0", "1.5", "1e2", "9007199254740992"];
  for (const number of invalidNumbers) {
    const value = base.replace("\"authorityScope\":{\"z\":true,\"a\":1}", `\"authorityScope\":{\"n\":${number}}`);
    assert.equal(
      ownerFor({ rawSnapshot: Buffer.from(value, "utf8") }).evaluate().reason,
      "AUTHORITY_SCOPE_INVALID"
    );
  }
  const unpaired = base.replace("\"snapshot:1\"", "\"\\ud800\"");
  assert.equal(ownerFor({ rawSnapshot: Buffer.from(unpaired, "utf8") }).evaluate().reason, "SNAPSHOT_SCHEMA_INVALID");
  const nested = `${"[".repeat(64)}0${"]".repeat(64)}`;
  const tooDeep = base.replace("\"authorityScope\":{\"z\":true,\"a\":1}", `\"authorityScope\":{\"n\":${nested}}`);
  assert.equal(ownerFor({ rawSnapshot: Buffer.from(tooDeep, "utf8") }).evaluate().reason, "AUTHORITY_SCOPE_INVALID");
});

test("candidate-set exact schema, revisions, enums, and all-record validation are enforced", () => {
  const extra = candidateSet();
  extra.extra = true;
  assert.equal(ownerFor({ snapshot: extra }).evaluate().reason, "SNAPSHOT_SCHEMA_INVALID");
  const revision = candidateSet();
  revision.gateCandidates[0].gateRevision = 0;
  assert.equal(ownerFor({ snapshot: revision }).evaluate().reason, "SNAPSHOT_SCHEMA_INVALID");
  const state = candidateSet();
  state.continuationTargets.push({ malformed: true });
  assert.equal(ownerFor({ snapshot: state }).evaluate().reason, "SNAPSHOT_SCHEMA_INVALID");
});

test("authority is NONE throughout the candidate set", () => {
  const snapshot = candidateSet();
  snapshot.gateCandidates[0].authorityEffect = "EXECUTE";
  const result = ownerFor({ snapshot }).evaluate();
  assert.equal(result.reason, "SNAPSHOT_AUTHORITY_MISMATCH");
  assert.equal(result.invocationCount, 0);
});

test("NFC fields must already be normalized", () => {
  const snapshot = candidateSet();
  snapshot.gateCandidates[0].gateId = "gate:e\u0301";
  const result = ownerFor({ snapshot }).evaluate();
  assert.equal(result.reason, "NFC_REQUIREMENT_VIOLATION");
});

test("authenticated account must be current", () => {
  const snapshot = candidateSet();
  snapshot.authenticatedAccount.freshnessState = "STALE";
  const result = ownerFor({ snapshot }).evaluate();
  assert.equal(result.outcome, "QUERY_NOT_DERIVED");
  assert.equal(result.reason, "AUTHENTICATED_ACCOUNT_NOT_CURRENT");
});

test("association matching, currentness, and conflict precedence are deterministic", () => {
  const mismatch = candidateSet();
  mismatch.associations[0].accountRevision = "other";
  assert.equal(ownerFor({ snapshot: mismatch }).evaluate().reason, "ASSOCIATION_MISMATCH");

  const stale = candidateSet();
  stale.associations[0].freshnessState = "STALE";
  assert.equal(ownerFor({ snapshot: stale }).evaluate().reason, "ASSOCIATION_NOT_CURRENT");

  const conflict = candidateSet();
  conflict.associations[0].contradictionState = "CONFLICT";
  assert.equal(ownerFor({ snapshot: conflict }).evaluate().reason, "CANDIDATE_IDENTITY_CONFLICT");
});

test("interaction matching and currentness are deterministic", () => {
  const mismatch = candidateSet();
  mismatch.interactions[0].interactionRevision = 8;
  assert.equal(ownerFor({ snapshot: mismatch }).evaluate().reason, "INTERACTION_MISMATCH");

  const stale = candidateSet();
  stale.interactions[0].lifecycleState = "SUPERSEDED";
  assert.equal(ownerFor({ snapshot: stale }).evaluate().reason, "INTERACTION_NOT_CURRENT");
});

test("Gate cardinality, registered revision, and PENDING state are enforced", () => {
  const none = candidateSet();
  none.gateCandidates = [];
  assert.equal(ownerFor({ snapshot: none }).evaluate().reason, "NO_CURRENT_GATE");

  const multiple = candidateSet();
  multiple.gateCandidates.push({ ...multiple.gateCandidates[0], gateId: "gate:2" });
  assert.equal(ownerFor({ snapshot: multiple }).evaluate().reason, "MULTIPLE_CURRENT_GATES");

  const future = candidateSet();
  future.gateCandidates[0].registeredInteractionRevision = 8;
  assert.equal(ownerFor({ snapshot: future }).evaluate().reason, "INTERACTION_MISMATCH");

  const satisfied = candidateSet();
  satisfied.gateCandidates[0].status = "SATISFIED";
  assert.equal(ownerFor({ snapshot: satisfied }).evaluate().reason, "CURRENT_GATE_NOT_PENDING");
});

test("continuation target identity and currentness are enforced", () => {
  const mismatch = candidateSet();
  mismatch.continuationTargets[0].continuationTargetRevision = "other";
  assert.equal(ownerFor({ snapshot: mismatch }).evaluate().reason, "CONTINUATION_TARGET_MISMATCH");

  const stale = candidateSet();
  stale.continuationTargets[0].freshnessState = "STALE";
  assert.equal(ownerFor({ snapshot: stale }).evaluate().reason, "CONTINUATION_TARGET_NOT_CURRENT");
});

function run() {
  let passed = 0;
  for (const { name, body } of tests) {
    body();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  }
  process.stdout.write(`PASS ${passed}/${tests.length}\n`);
}

if (require.main === module) {
  run();
}

module.exports = Object.freeze({ run });
