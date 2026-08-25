'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { CLAIM_OUTCOMES, CLAIM_STATES,
  createGovernedExecutionAttemptClaim } = require('./execution-attempt-claim');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const authorityScope = Object.freeze({ action: 'update-offer', offerId: 'offer-1' });

function attempt(overrides = {}) {
  return {
    type: 'EXECUTION_ATTEMPT', status: 'ATTEMPT_CREATED', executionAttemptId: 'attempt-1',
    attemptRevision: 1, attemptOrdinal: 1, previousExecutionAttemptId: null,
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-1',
    preparationEvidenceRef: 'preparation-evidence-1', preparationRevision: 1,
    dispatchId: 'dispatch-1', continuationId: 'continuation-1', interactionId: 'interaction-1',
    gateId: 'gate-1', gateRevision: 2, authorityEvidenceRef: 'authority-1',
    governanceEvaluationRef: 'evaluation-1', authorityCommittedRevision: 7,
    actionIdentity: 'offer.update', actionRevision: '1',
    continuationTargetRef: 'offer.update:offer-1', authorityScope: clone(authorityScope),
    executionOwnerIdentity: 'offer-execution-owner', inputRef: 'input:offer-1',
    expectedInputDigest: 'sha256:input-1', verifiedInputDigest: 'sha256:input-1',
    verifiedInputEvidenceRef: 'input-evidence-1', effectContractRef: 'effect-contract-1',
    effectContractRevision: '1', effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
    logicalEffectId: 'effect:execution-1:sha256:input-1',
    logicalEffectIdentityDerivation: 'logical-effect-binding',
    logicalEffectIdentityRevision: '1', resultEvidenceGrammarRef: 'result-grammar-1',
    resultEvidenceGrammarRevision: '1', retryEligibilityEvidenceRef: null,
    retrySafetyClass: null, singlePhysicalAttemptIdentity: true, claimStatus: 'UNCLAIMED',
    ...clone(overrides)
  };
}

function registration(overrides = {}) {
  return {
    type: 'EXECUTION_ADAPTER_REGISTRATION', status: 'REGISTERED',
    registrationIdentity: 'adapter-registration-1', registrationRevision: '1',
    adapterIdentity: 'offer-adapter', adapterRevision: '1', enabled: true,
    actionIdentity: 'offer.update', actionRevision: '1',
    continuationTargetRef: 'offer.update:offer-1',
    acceptedAuthorityScopeContract: clone(authorityScope),
    executionOwnerIdentity: 'offer-execution-owner', inputContractRef: 'offer-input-v1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    logicalEffectIdentityHandling: 'PRESERVE_EXACT', claimOwnershipCapability: true,
    ...clone(overrides)
  };
}

function owner(identity = 'worker-1', overrides = {}) {
  return { evidenceRef: `owner-evidence:${identity}`, record: {
    type: 'ATTEMPT_OWNER_IDENTITY', status: 'CURRENT', attemptOwnerIdentity: identity,
    identityRevision: '1', trustedMetadata: { transport: 'provider-neutral' }, ...clone(overrides) } };
}

function reassignment(previous, overrides = {}) {
  return { evidenceRef: `reassignment:${previous.attemptClaimId}`, record: {
    type: 'CLAIM_REASSIGNMENT_ELIGIBILITY', status: 'REASSIGNMENT_ELIGIBLE',
    executionAttemptId: previous.executionAttemptId,
    previousAttemptClaimId: previous.attemptClaimId,
    previousClaimRevision: previous.claimRevision,
    previousOwnershipState: previous.ownershipState,
    startStatus: 'NOT_STARTED_PROVEN', effectStatus: 'NO_EFFECT_PROVEN',
    lifecycleEvidenceRef: `lifecycle:${previous.attemptClaimId}`,
    reassignmentEligibilityRevision: 1, ...clone(overrides) } };
}

function createLedger({ attemptRecord = attempt(), seed = [], mode = 'NORMAL',
  errorCode = null, corruptReturn = false, corruptHistory = false } = {}) {
  const records = seed.map(clone);
  let commits = 0;
  return {
    records, get commits() { return commits; },
    findAttemptSnapshot(id) {
      if (!attemptRecord || attemptRecord.executionAttemptId !== id) return null;
      return { evidenceRef: 'attempt-evidence-1', record: clone(attemptRecord) };
    },
    findClaimsByAttempt(id) {
      const found = records.filter((record) => record.executionAttemptId === id).map(clone);
      return corruptHistory && found.length ? [{ ...found[0], claimOrdinal: 9 }] : found;
    },
    findClaimById(id) {
      return records.filter((record) => record.attemptClaimId === id).map(clone);
    },
    commitClaim(record, guards) {
      commits += 1;
      if (!guards || guards.attemptGuard.attemptRevision !== 1
        || guards.attemptGuard.claimStatus !== 'UNCLAIMED'
        || guards.historyGuard.historyRevision !== records.filter((entry) =>
          entry.executionAttemptId === record.executionAttemptId).length
        || guards.registrationGuard.registrationRevision !== '1'
        || guards.ownerGuard.attemptOwnerIdentity !== record.attemptOwnerIdentity
        || guards.compatibilityGuard.evidenceRef !== 'compatibility-evidence-1') {
        const error = new Error('guard changed'); error.code = 'CLAIM_STALE'; throw error;
      }
      if (errorCode) { const error = new Error(errorCode); error.code = errorCode; throw error; }
      if (mode === 'THROW_BEFORE') throw new Error('unavailable');
      if (records.some((entry) => entry.attemptClaimId === record.attemptClaimId)) {
        throw new Error('unique claim conflict');
      }
      records.push(clone(record));
      if (mode === 'STORE_THEN_THROW') throw new Error('response lost');
      return corruptReturn ? { ...clone(record), actionRevision: 'corrupt' } : clone(record);
    }
  };
}

function harness(overrides = {}) {
  const attemptRecord = Object.hasOwn(overrides, 'attemptRecord')
    ? overrides.attemptRecord : attempt();
  const registrationRecord = Object.hasOwn(overrides, 'registrationRecord')
    ? overrides.registrationRecord : registration();
  const reassignmentRecords = overrides.reassignmentRecords || new Map();
  const ledger = overrides.ledger || createLedger({ attemptRecord });
  const calls = { registration: 0, owner: 0, compatibility: 0, reassignment: 0,
    scheduler: 0, start: 0, executor: 0, product: 0, effect: 0, result: 0 };
  const component = createGovernedExecutionAttemptClaim({
    adapterRegistrationPort: (ref) => {
      calls.registration += 1;
      if (overrides.registrationError) throw new Error('registration unavailable');
      if (!registrationRecord || ref !== 'adapter-registration-evidence-1') return null;
      return { evidenceRef: ref, record: clone(registrationRecord) };
    },
    ownerIdentityPort: (identity) => {
      calls.owner += 1;
      if (overrides.ownerError) throw new Error('owner unavailable');
      if (Object.hasOwn(overrides, 'ownerSnapshot')) return clone(overrides.ownerSnapshot);
      return owner(identity);
    },
    scopeCompatibilityPort: (binding) => {
      calls.compatibility += 1;
      if (overrides.compatibilityError) throw new Error('compatibility unavailable');
      if (overrides.compatibility === false) return { compatible: false };
      const compatible = JSON.stringify(binding.authorityScope)
        === JSON.stringify(binding.acceptedAuthorityScopeContract)
        && binding.inputRef === 'input:offer-1'
        && binding.verifiedInputDigest === 'sha256:input-1'
        && binding.logicalEffectIdentityHandling === 'PRESERVE_EXACT';
      return { compatible, evidenceRef: compatible ? 'compatibility-evidence-1' : null };
    },
    reassignmentEligibilityPort: (ref) => {
      calls.reassignment += 1;
      if (overrides.reassignmentError) throw new Error('reassignment unavailable');
      return clone(reassignmentRecords.get(ref) || null);
    },
    claimLedger: ledger
  });
  return { component, ledger, calls };
}

const request = Object.freeze({ executionAttemptId: 'attempt-1', attemptClaimId: 'claim-1',
  adapterRegistrationEvidenceRef: 'adapter-registration-evidence-1',
  attemptOwnerIdentity: 'worker-1', expectedAttemptRevision: 1 });

function createClaim(overrides = {}) {
  const h = harness(overrides);
  const response = h.component.claim(request);
  assert.equal(response.outcome, 'ATTEMPT_CLAIMED');
  return { h, claim: response.claim };
}

function runSuite() {
  const cases = [];
  const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  check('no-claim-without-authoritative-attempt', () => {
    assert.equal(harness({ attemptRecord: null }).component.claim(request).outcome,
      'ATTEMPT_NOT_FOUND');
  });
  check('caller-fabricated-attempt-fields-do-not-grant-claim', () => {
    assert.equal(harness({ attemptRecord: null }).component.claim({ ...request,
      status: 'ATTEMPT_CREATED', claimStatus: 'UNCLAIMED' }).outcome, 'ATTEMPT_NOT_FOUND');
  });
  check('stale-attempt-revision-fails-closed', () => {
    assert.equal(harness().component.claim({ ...request, expectedAttemptRevision: 2 }).outcome,
      'CLAIM_STALE');
  });
  check('corrupt-attempt-fails-closed', () => {
    assert.equal(harness({ attemptRecord: attempt({ verifiedInputDigest: '' }) })
      .component.claim(request).outcome, 'INVALID_ATTEMPT');
  });

  const primary = createClaim();
  check('claim-has-distinct-immutable-identity', () => {
    assert.equal(primary.claim.attemptClaimId, 'claim-1');
    assert.notEqual(primary.claim.attemptClaimId, primary.claim.executionAttemptId);
    assert.equal(primary.claim.claimRevision, 1);
  });
  check('exact-duplicate-returns-original-claim', () => {
    const duplicate = primary.h.component.claim(request);
    assert.equal(duplicate.outcome, 'ALREADY_CLAIMED');
    assert.deepEqual(duplicate.claim, primary.claim);
    assert.equal(primary.h.ledger.commits, 1);
  });
  check('post-commit-registration-drift-cannot-rewrite-original-claim', () => {
    const replay = harness({ ledger: primary.h.ledger,
      registrationRecord: registration({ enabled: false, registrationRevision: '2' }) })
      .component.claim(request);
    assert.equal(replay.outcome, 'ALREADY_CLAIMED');
    assert.deepEqual(replay.claim, primary.claim);
  });
  check('different-id-while-active-is-blocked', () => {
    assert.equal(primary.h.component.claim({ ...request, attemptClaimId: 'claim-2' }).outcome,
      'ACTIVE_CLAIM_EXISTS');
  });
  check('conflicting-owner-cannot-reuse-claim-id', () => {
    assert.equal(primary.h.component.claim({ ...request, attemptOwnerIdentity: 'worker-2' }).outcome,
      'CLAIM_REJECTED');
  });
  check('claim-id-cannot-cross-attempt-boundary', () => {
    const secondAttempt = attempt({ executionAttemptId: 'attempt-2', attemptOrdinal: 2,
      previousExecutionAttemptId: 'attempt-1' });
    const ledger = createLedger({ attemptRecord: secondAttempt, seed: [primary.claim] });
    assert.equal(harness({ attemptRecord: secondAttempt, ledger }).component.claim({ ...request,
      executionAttemptId: 'attempt-2' }).outcome, 'CLAIM_REJECTED');
  });

  check('exact-registration-is-required', () => {
    assert.equal(harness().component.claim({ ...request,
      adapterRegistrationEvidenceRef: 'missing' }).outcome, 'ADAPTER_NOT_REGISTERED');
  });
  check('disabled-registration-is-incompatible', () => {
    assert.equal(harness({ registrationRecord: registration({ enabled: false }) })
      .component.claim(request).outcome, 'ADAPTER_INCOMPATIBLE');
  });
  check('stale-registration-shape-is-incompatible', () => {
    assert.equal(harness({ registrationRecord: registration({ registrationRevision: '' }) })
      .component.claim(request).outcome, 'ADAPTER_INCOMPATIBLE');
  });
  for (const [name, changes] of [
    ['action', { actionIdentity: 'other.action' }],
    ['target', { continuationTargetRef: 'other.target' }],
    ['execution-owner-contract', { executionOwnerIdentity: 'other-owner' }],
    ['effect-contract', { effectContractRevision: '2' }],
    ['effect-class', { effectIdempotencyClass: 'NON_IDEMPOTENT' }],
    ['result-grammar', { resultEvidenceGrammarRevision: '2' }]
  ]) {
    check(`incompatible-${name}-is-rejected`, () => {
      assert.equal(harness({ registrationRecord: registration(changes) })
        .component.claim(request).outcome, 'ADAPTER_INCOMPATIBLE');
    });
  }
  check('scope-widening-is-rejected', () => {
    assert.equal(harness({ registrationRecord: registration({
      acceptedAuthorityScopeContract: { action: '*', offerId: '*' } }) })
      .component.claim(request).outcome, 'ADAPTER_INCOMPATIBLE');
  });
  check('input-contract-mismatch-is-rejected', () => {
    assert.equal(harness({ compatibility: false }).component.claim(request).outcome,
      'ADAPTER_INCOMPATIBLE');
  });
  check('logical-effect-handling-mismatch-is-rejected', () => {
    assert.equal(harness({ registrationRecord: registration({
      logicalEffectIdentityHandling: 'REDERIVE' }) }).component.claim(request).outcome,
    'ADAPTER_INCOMPATIBLE');
  });
  check('generic-execute-method-is-not-registration', () => {
    assert.equal(harness({ registrationRecord: { execute() {} } })
      .component.claim(request).outcome, 'ADAPTER_INCOMPATIBLE');
  });

  check('trusted-owner-identity-is-required', () => {
    assert.equal(harness({ ownerSnapshot: null }).component.claim(request).outcome,
      'CLAIM_REJECTED');
  });
  check('caller-cannot-override-trusted-owner', () => {
    const wrong = owner('other-worker');
    assert.equal(harness({ ownerSnapshot: wrong }).component.claim(request).outcome,
      'CLAIM_REJECTED');
  });
  check('trusted-metadata-is-not-authority-bearing', () => {
    const { claim } = createClaim({ ownerSnapshot: owner('worker-1', {
      trustedMetadata: { pid: 42, hostname: 'host-1' } }) });
    assert.equal('pid' in claim, false);
    assert.equal('hostname' in claim, false);
  });

  check('claim-preserves-exact-security-lineage', () => {
    assert.equal(primary.claim.executionId, 'execution-1');
    assert.equal(primary.claim.actionIdentity, 'offer.update');
    assert.deepEqual(primary.claim.authorityScope, authorityScope);
    assert.equal(primary.claim.verifiedInputDigest, 'sha256:input-1');
    assert.equal(primary.claim.logicalEffectId, 'effect:execution-1:sha256:input-1');
  });
  check('claim-is-exclusive-and-active', () => {
    assert.equal(primary.claim.exclusiveOwnership, true);
    assert.equal(primary.claim.ownershipState, 'ACTIVE');
  });

  const released = { ...clone(primary.claim), ownershipState: 'RELEASED' };
  check('release-alone-does-not-permit-reassignment', () => {
    const ledger = createLedger({ seed: [released] });
    assert.equal(harness({ ledger }).component.claim({ ...request, attemptClaimId: 'claim-2',
      attemptOwnerIdentity: 'worker-2' }).outcome, 'ATTEMPT_NOT_CLAIMABLE');
  });
  check('expiry-or-worker-loss-fields-do-not-permit-reassignment', () => {
    const ledger = createLedger({ seed: [released] });
    assert.equal(harness({ ledger }).component.claim({ ...request, attemptClaimId: 'claim-2',
      attemptOwnerIdentity: 'worker-2', expired: true, workerLost: true }).outcome,
    'ATTEMPT_NOT_CLAIMABLE');
  });
  check('unknown-start-blocks-reassignment', () => {
    const eligibility = reassignment(released, { startStatus: 'UNKNOWN' });
    const ledger = createLedger({ seed: [released] });
    const h = harness({ ledger, reassignmentRecords: new Map([[eligibility.evidenceRef,
      eligibility]]) });
    assert.equal(h.component.claim({ ...request, attemptClaimId: 'claim-2',
      attemptOwnerIdentity: 'worker-2', reassignmentEligibilityEvidenceRef:
      eligibility.evidenceRef }).outcome, 'ATTEMPT_NOT_CLAIMABLE');
  });
  check('possible-effect-blocks-reassignment', () => {
    const eligibility = reassignment(released, { effectStatus: 'POSSIBLE_EFFECT' });
    const h = harness({ ledger: createLedger({ seed: [released] }),
      reassignmentRecords: new Map([[eligibility.evidenceRef, eligibility]]) });
    assert.equal(h.component.claim({ ...request, attemptClaimId: 'claim-2',
      attemptOwnerIdentity: 'worker-2', reassignmentEligibilityEvidenceRef:
      eligibility.evidenceRef }).outcome, 'ATTEMPT_NOT_CLAIMABLE');
  });

  let reassigned;
  check('authoritative-safe-release-permits-same-attempt-reassignment', () => {
    const eligibility = reassignment(released);
    const ledger = createLedger({ seed: [released] });
    const h = harness({ ledger, reassignmentRecords: new Map([[eligibility.evidenceRef,
      eligibility]]) });
    reassigned = h.component.claim({ ...request, attemptClaimId: 'claim-2',
      attemptOwnerIdentity: 'worker-2', reassignmentEligibilityEvidenceRef:
      eligibility.evidenceRef });
    assert.equal(reassigned.outcome, 'ATTEMPT_CLAIMED');
    assert.equal(reassigned.claim.executionAttemptId, 'attempt-1');
    assert.equal(reassigned.claim.attemptClaimId, 'claim-2');
    assert.equal(reassigned.claim.previousAttemptClaimId, 'claim-1');
    assert.equal(reassigned.claim.claimOrdinal, 2);
  });
  check('first-claim-cannot-consume-reassignment-evidence', () => {
    assert.equal(harness().component.claim({ ...request,
      reassignmentEligibilityEvidenceRef: 'unexpected' }).outcome, 'CLAIM_REJECTED');
  });
  check('uncertain-prior-claim-blocks-reassignment', () => {
    const uncertain = { ...clone(primary.claim), ownershipState: 'UNCERTAIN' };
    assert.equal(harness({ ledger: createLedger({ seed: [uncertain] }) })
      .component.claim({ ...request, attemptClaimId: 'claim-2' }).outcome,
    'ACTIVE_CLAIM_EXISTS');
  });

  check('post-commit-response-loss-recovers-original-claim', () => {
    const ledger = createLedger({ mode: 'STORE_THEN_THROW' });
    const response = harness({ ledger }).component.claim(request);
    assert.equal(response.outcome, 'ALREADY_CLAIMED');
    assert.equal(response.claim.attemptClaimId, 'claim-1');
    assert.equal(ledger.records.length, 1);
  });
  check('pre-commit-failure-remains-uncertain', () => {
    const ledger = createLedger({ mode: 'THROW_BEFORE' });
    assert.equal(harness({ ledger }).component.claim(request).outcome, 'CLAIM_UNCERTAIN');
    assert.equal(ledger.records.length, 0);
  });
  for (const code of ['CLAIM_STALE', 'ACTIVE_CLAIM_EXISTS', 'ADAPTER_INCOMPATIBLE',
    'ATTEMPT_NOT_CLAIMABLE']) {
    check(`atomic-${code.toLowerCase()}-guard-fails-closed`, () => {
      assert.equal(harness({ ledger: createLedger({ errorCode: code }) })
        .component.claim(request).outcome, code);
    });
  }
  check('inconsistent-commit-result-is-uncertain', () => {
    assert.equal(harness({ ledger: createLedger({ corruptReturn: true }) })
      .component.claim(request).outcome, 'CLAIM_UNCERTAIN');
  });
  check('corrupt-claim-history-fails-closed', () => {
    assert.equal(harness({ ledger: createLedger({ seed: [primary.claim],
      corruptHistory: true }) }).component.claim({ ...request, attemptClaimId: 'claim-2' }).outcome,
    'INVALID_ATTEMPT');
  });

  check('claim-record-has-no-start-effect-or-result-evidence', () => {
    for (const key of ['schedulerAssignment', 'executionStart', 'executionAttemptStarted',
      'effectInvocationIntent', 'effectAcknowledgement', 'result', 'completed', 'success']) {
      assert.equal(key in primary.claim, false);
    }
  });
  check('component-exposes-claim-only', () => {
    assert.deepEqual(Object.keys(primary.h.component), ['claim']);
  });
  check('claim-invokes-no-downstream-operations', () => {
    const calls = primary.h.calls;
    assert.deepEqual({ scheduler: calls.scheduler, start: calls.start, executor: calls.executor,
      product: calls.product, effect: calls.effect, result: calls.result },
    { scheduler: 0, start: 0, executor: 0, product: 0, effect: 0, result: 0 });
  });
  check('claim-state-grammar-is-closed', () => {
    assert.deepEqual([...CLAIM_STATES].sort(), ['ACTIVE', 'RELEASED', 'REVOKED',
      'STALE', 'UNCERTAIN']);
  });
  check('outcome-grammar-is-exact-and-closed', () => {
    assert.deepEqual(Object.values(CLAIM_OUTCOMES).sort(), [
      'ACTIVE_CLAIM_EXISTS', 'ADAPTER_INCOMPATIBLE', 'ADAPTER_NOT_REGISTERED',
      'ALREADY_CLAIMED', 'ATTEMPT_CLAIMED', 'ATTEMPT_NOT_CLAIMABLE',
      'ATTEMPT_NOT_FOUND', 'CLAIM_REJECTED', 'CLAIM_STALE', 'CLAIM_UNCERTAIN',
      'INVALID_ATTEMPT'
    ]);
  });
  check('required-ports-are-validated', () => {
    assert.throws(() => createGovernedExecutionAttemptClaim({}), TypeError);
  });
  check('deterministic-equivalent-runs-produce-equivalent-claims', () => {
    const left = harness().component.claim(request);
    const right = harness().component.claim(request);
    assert.deepEqual(left, right);
    observations.push(left.claim, reassigned.claim);
  });

  const canonical = canonicalStringify({ cases, observations, primaryClaim: primary.claim,
    reassignedClaim: reassigned.claim, outcomes: Object.values(CLAIM_OUTCOMES),
    states: CLAIM_STATES });
  return { cases, canonical, hash: sha256(canonical) };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-execution-attempt-claim-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
