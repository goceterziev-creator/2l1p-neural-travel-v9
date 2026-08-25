'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { EVIDENCE_ACCEPTANCE_OUTCOMES, RESOLUTION_OPERATION_OUTCOMES,
  EFFECT_OUTCOME_CLASSES, OBSERVATION_CLASSES,
  createGovernedEffectOutcomeResolution } = require('./effect-outcome-resolution');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const hash = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const compactCanonical = (value) => JSON.stringify((function sort(input) {
  if (Array.isArray(input)) return input.map(sort);
  if (input && typeof input === 'object') return Object.keys(input).sort().reduce((out, key) => {
    out[key] = sort(input[key]); return out;
  }, {});
  return input;
})(value));

function invocation(overrides = {}) {
  return { type: 'EFFECT_INVOCATION', status: 'INVOCATION_RETURNED',
    effectInvocationId: 'invocation-1', invocationRevision: 1,
    effectInvocationIntentId: 'intent-1', intentRevision: 1,
    executionStartId: 'start-1', startRevision: 1, executionAttemptId: 'attempt-1',
    attemptClaimId: 'claim-1', executionId: 'execution-1', executionAcceptanceId: 'acceptance-1',
    dispatchId: 'dispatch-1', continuationId: 'continuation-1', interactionId: 'interaction-1',
    gateId: 'gate-1', authorityEvidenceRef: 'authority-1',
    governanceEvaluationRef: 'evaluation-1', authorityScope: { action: 'update-offer', id: 'offer-1' },
    actionIdentity: 'offer.update', actionRevision: '1',
    continuationTargetRef: 'offer.update:offer-1', executionOwnerIdentity: 'execution-owner-1',
    inputRef: 'input:offer-1', verifiedInputDigest: 'sha256:input-1',
    verifiedInputEvidenceRef: 'input-evidence-1', effectContractRef: 'effect-contract-1',
    effectContractRevision: '1', effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY',
    logicalEffectId: 'logical-effect-1', resultEvidenceGrammarRef: 'result-grammar-1',
    resultEvidenceGrammarRevision: '1', invocationEnvelopeDigest: 'sha256:envelope-1',
    effectStatus: 'UNKNOWN', singleInvocationIdentityForIntent: true, ...clone(overrides) };
}

function source(overrides = {}) {
  return { evidenceRef: 'source-registration-evidence-1', record: {
    sourceIdentity: 'provider-status-source', sourceRevision: '1',
    sourceType: 'PROVIDER_STATUS', evidenceGrammarIdentity: 'effect-observation-grammar',
    evidenceGrammarRevision: '1', authenticityVerifierIdentity: 'signature-verifier',
    authenticityVerifierRevision: '1', effectContractRef: 'effect-contract-1',
    effectContractRevision: '1', effectClasses: ['IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT'],
    correlationMode: 'EXACT_INVOCATION_AND_LOGICAL_EFFECT',
    outcomePolicyIdentity: 'conservative-effect-policy', outcomePolicyRevision: '1',
    acquisitionMethods: ['PUSHED_PROVIDER_EVIDENCE', 'LOCAL_ADAPTER_RETURN'],
    claimCapabilities: ['OBSERVE_RETURN_ONLY', 'SUPPORT_EFFECT_OCCURRED',
      'SUPPORT_NO_EFFECT', 'SUPPORT_REJECTED_BEFORE_EFFECT',
      'SUPPORT_POSSIBLE_EFFECT', 'SUPPORT_UNKNOWN_ONLY'],
    trusted: true, historicalEvidenceAcceptance: true, ...clone(overrides) } };
}

const classification = Object.freeze({
  RETURN: ['TRANSPORT_RETURN_OBSERVED', 'OBSERVE_RETURN_ONLY'],
  ACK: ['REQUEST_ACKNOWLEDGED', 'SUPPORT_UNKNOWN_ONLY'],
  REJECT: ['REQUEST_REJECTED_OBSERVED', 'SUPPORT_REJECTED_BEFORE_EFFECT'],
  EFFECT: ['EFFECT_OCCURRED_OBSERVED', 'SUPPORT_EFFECT_OCCURRED'],
  NO_EFFECT: ['NO_EFFECT_OBSERVED', 'SUPPORT_NO_EFFECT'],
  POSSIBLE: ['DELIVERY_OR_PROCESSING_POSSIBLE', 'SUPPORT_POSSIBLE_EFFECT'],
  UNKNOWN: ['OUTCOME_UNKNOWN_OBSERVED', 'SUPPORT_UNKNOWN_ONLY']
});

function grammar(overrides = {}) {
  return { identity: 'effect-observation-grammar', revision: '1',
    classifyAndCanonicalize(observation) {
      const mapped = classification[observation.kind];
      if (!mapped) throw new Error('unsupported observation');
      return { observationClass: mapped[0], requiredClaimCapability: mapped[1],
        canonicalBytes: canonicalStringify(observation) };
    }, ...overrides };
}

function isConflict(records, candidate = null) {
  const classes = [...records, ...(candidate ? [candidate] : [])].map((item) => item.observationClass);
  const effect = classes.includes('EFFECT_OCCURRED_OBSERVED');
  const noEffect = classes.includes('NO_EFFECT_OBSERVED')
    || classes.includes('REQUEST_REJECTED_OBSERVED');
  return effect && noEffect;
}

function policy(overrides = {}) {
  return { identity: 'conservative-effect-policy', revision: '1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    supportedOutcomeClasses: [...EFFECT_OUTCOME_CLASSES], atomicSingleEvidenceResolution: true,
    detectConflict: (records, candidate) => isConflict(records, candidate),
    resolveEvidenceSet(records) {
      if (isConflict(records)) return { effectOutcomeClass: 'EFFECT_EVIDENCE_CONFLICT' };
      const classes = records.map((item) => item.observationClass);
      if (classes.includes('EFFECT_OCCURRED_OBSERVED')) return {
        effectOutcomeClass: 'EFFECT_CONFIRMED' };
      if (classes.includes('NO_EFFECT_OBSERVED')) return {
        effectOutcomeClass: 'NO_EFFECT_CONFIRMED' };
      if (classes.includes('REQUEST_REJECTED_OBSERVED')) return {
        effectOutcomeClass: 'EFFECT_REJECTED_BEFORE_EFFECT' };
      if (classes.includes('DELIVERY_OR_PROCESSING_POSSIBLE')) return {
        effectOutcomeClass: 'EFFECT_POSSIBLE' };
      return { effectOutcomeClass: 'EFFECT_OUTCOME_UNKNOWN' };
    }, ...overrides };
}

function evidenceSet(invocationRecord, records, policyRecord = policy()) {
  const ordered = records.map(clone).sort((a, b) => a.evidenceOrdinal - b.evidenceOrdinal
    || a.effectOutcomeEvidenceId.localeCompare(b.effectOutcomeEvidenceId));
  const binding = { effectInvocationId: invocationRecord.effectInvocationId,
    invocationRevision: invocationRecord.invocationRevision,
    outcomePolicyIdentity: policyRecord.identity, outcomePolicyRevision: policyRecord.revision,
    evidenceSetRevision: ordered.length, evidence: ordered.map((item) => ({
      evidenceOrdinal: item.evidenceOrdinal,
      effectOutcomeEvidenceId: item.effectOutcomeEvidenceId,
      evidenceRevision: item.evidenceRevision,
      canonicalEvidenceDigest: item.canonicalEvidenceDigest })) };
  return { revision: ordered.length, digest: hash(compactCanonical(binding)) };
}

function createLedger({ evidenceSeed = [], resolutionSeed = [], mode = 'NORMAL' } = {}) {
  const evidence = evidenceSeed.map(clone); const resolutions = resolutionSeed.map(clone);
  let evidenceCommits = 0; let resolutionCommits = 0; let atomicCommits = 0;
  return { evidence, resolutions,
    get evidenceCommits() { return evidenceCommits; },
    get resolutionCommits() { return resolutionCommits; },
    get atomicCommits() { return atomicCommits; },
    findEvidenceById(id) { return evidence.filter((item) => item.effectOutcomeEvidenceId === id).map(clone); },
    listEvidenceForInvocation(id) { return evidence.filter((item) => item.effectInvocationId === id).map(clone); },
    findResolutionById(id) { return resolutions.filter((item) => item.effectOutcomeResolutionId === id).map(clone); },
    findCurrentResolutionForInvocation(id) {
      const found = resolutions.filter((item) => item.effectInvocationId === id)
        .sort((a, b) => b.resolutionRevision - a.resolutionRevision);
      return found.length ? [clone(found[0])] : [];
    },
    commitAcceptedEvidence(record, guards) {
      evidenceCommits += 1;
      if (mode === 'EVIDENCE_THROW_BEFORE') throw new Error('uncertain');
      if (guards.expectedEvidenceSetRevision !== evidence.length) {
        const error = new Error('stale'); error.code = 'EVIDENCE_SET_STALE'; throw error;
      }
      evidence.push(clone(record));
      if (mode === 'EVIDENCE_STORE_THEN_THROW') throw new Error('response lost');
      if (mode === 'EVIDENCE_CORRUPT_RETURN') return { ...clone(record), logicalEffectId: 'wrong' };
      return clone(record);
    },
    commitResolution(record, guards) {
      resolutionCommits += 1;
      if (mode === 'RESOLUTION_THROW_BEFORE') throw new Error('uncertain');
      if (mode === 'RESOLUTION_STALE' || guards.expectedEvidenceSetRevision !== evidence.length) {
        const error = new Error('stale'); error.code = 'EVIDENCE_SET_STALE'; throw error;
      }
      resolutions.push(clone(record));
      if (mode === 'RESOLUTION_STORE_THEN_THROW') throw new Error('response lost');
      if (mode === 'RESOLUTION_CORRUPT_RETURN') return { ...clone(record), evidenceSetDigest: 'wrong' };
      return clone(record);
    },
    commitEvidenceAndResolution(evidenceRecord, resolutionRecord, guards) {
      atomicCommits += 1;
      if (mode === 'ATOMIC_THROW_BEFORE') throw new Error('uncertain');
      assert.equal(guards.committedEvidenceSetRevision, evidence.length + 1);
      evidence.push(clone(evidenceRecord)); resolutions.push(clone(resolutionRecord));
      if (mode === 'ATOMIC_STORE_BOTH_THEN_THROW') throw new Error('response lost');
      if (mode === 'ATOMIC_CORRUPT_RETURN') return { evidence: evidenceRecord,
        resolution: { ...resolutionRecord, logicalEffectId: 'wrong' } };
      return { evidence: clone(evidenceRecord), resolution: clone(resolutionRecord) };
    }
  };
}

function createHarness({ invocationRecord = invocation(), invocationMissing = false,
  sourceRecord = source(), grammarContract = grammar(), policyContract = policy(),
  verifierMode = 'VERIFIED', ledger = createLedger() } = {}) {
  const calls = { invocation: 0, source: 0, grammar: 0, policy: 0, verifier: 0,
    provider: 0, reconciliation: 0, product: 0, effect: 0, retry: 0, result: 0,
    completion: 0 };
  const component = createGovernedEffectOutcomeResolution({
    invocationSnapshotPort(id) { calls.invocation += 1;
      if (invocationMissing || id !== invocationRecord.effectInvocationId) return null;
      return { evidenceRef: 'invocation-evidence-1', record: clone(invocationRecord) }; },
    evidenceSourceRegistryPort(identity, revision) { calls.source += 1;
      return identity === sourceRecord.record.sourceIdentity
        && revision === sourceRecord.record.sourceRevision ? clone(sourceRecord) : null; },
    evidenceGrammarRegistryPort(identity, revision) { calls.grammar += 1;
      return identity === grammarContract.identity && revision === grammarContract.revision
        ? grammarContract : null; },
    outcomePolicyRegistryPort(identity, revision) { calls.policy += 1;
      return identity === policyContract.identity && revision === policyContract.revision
        ? policyContract : null; },
    evidenceVerifierPort(binding) { calls.verifier += 1;
      if (verifierMode === 'THROW') throw new Error('unavailable');
      if (verifierMode === 'INVALID') return { verified: false };
      return { verified: true, evidenceRef: `verification:${binding.observation.kind}`,
        verifiedClaims: clone(binding.observation.proof || {}) }; },
    outcomeLedger: ledger
  });
  return { component, calls, ledger, invocationRecord, policyContract };
}

function observation(kind, invocationRecord = invocation(), proof = {}) {
  return { kind, effectInvocationId: invocationRecord.effectInvocationId,
    logicalEffectId: invocationRecord.logicalEffectId, providerEvidence: `provider:${kind}`,
    proof: clone(proof) };
}

function evidenceRequest(id, kind, invocationRecord = invocation(), proof = {}, overrides = {}) {
  return { effectOutcomeEvidenceId: id, effectInvocationId: invocationRecord.effectInvocationId,
    sourceIdentity: 'provider-status-source', expectedSourceRevision: '1',
    expectedGrammarRevision: '1', expectedPolicyRevision: '1',
    acquisitionMethod: 'PUSHED_PROVIDER_EVIDENCE',
    observation: observation(kind, invocationRecord, proof),
    provenance: { providerEvidenceRef: `provider-ref:${id}` }, ...clone(overrides) };
}

function accept(h, id, kind, proof = {}, overrides = {}) {
  return h.component.acceptEvidence(evidenceRequest(id, kind, h.invocationRecord, proof, overrides));
}

function resolve(h, id, overrides = {}) {
  const set = evidenceSet(h.invocationRecord, h.ledger.evidence, h.policyContract);
  return h.component.resolveOutcome({ effectOutcomeResolutionId: id,
    effectInvocationId: h.invocationRecord.effectInvocationId,
    expectedPolicyRevision: '1', expectedEvidenceSetRevision: set.revision,
    expectedEvidenceSetDigest: set.digest, ...clone(overrides) });
}

const noEffectProof = Object.freeze({ causallyExcludesAllEffectOperations: true,
  coversInvocationInterval: true, noHiddenRetry: true, sourceCompletenessVerified: true });
const rejectionProof = Object.freeze({ rejectionPrecedesDelivery: true,
  rejectionPrecedesProcessing: true, rejectionPrecedesEffect: true, noHiddenRetry: true });

function runSuite() {
  const cases = []; const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  check('authoritative-invocation-required', () => assert.equal(accept(createHarness({ invocationMissing: true }), 'e-1', 'EFFECT').outcome, 'INVOCATION_NOT_FOUND'));
  check('fabricated-invocation-fields-do-not-grant-acceptance', () => { const h = createHarness({ invocationMissing: true }); assert.equal(h.component.acceptEvidence(evidenceRequest('e-1', 'EFFECT', invocation(), {}, { fabricatedInvocation: invocation() })).outcome, 'INVOCATION_NOT_FOUND'); });
  check('wrong-invocation-correlation-rejected', () => { const h = createHarness(); const request = evidenceRequest('e-1', 'EFFECT'); request.observation.effectInvocationId = 'other'; assert.equal(h.component.acceptEvidence(request).outcome, 'EVIDENCE_NOT_APPLICABLE'); });
  check('wrong-logical-effect-correlation-rejected', () => { const h = createHarness(); const request = evidenceRequest('e-1', 'EFFECT'); request.observation.logicalEffectId = 'other'; assert.equal(h.component.acceptEvidence(request).outcome, 'EVIDENCE_NOT_APPLICABLE'); });
  check('caller-source-metadata-cannot-override-registry', () => { const h = createHarness(); const result = h.component.acceptEvidence(evidenceRequest('e-1', 'EFFECT', invocation(), {}, { sourceRegistration: source({ sourceRevision: 'caller' }) })); assert.equal(result.evidence.sourceRevision, '1'); });
  check('source-revision-exact', () => assert.equal(createHarness().component.acceptEvidence({ ...evidenceRequest('e-1', 'EFFECT'), expectedSourceRevision: '2' }).outcome, 'EVIDENCE_INVALID'));
  check('grammar-revision-exact', () => assert.equal(createHarness().component.acceptEvidence({ ...evidenceRequest('e-1', 'EFFECT'), expectedGrammarRevision: '2' }).outcome, 'EVIDENCE_INVALID'));
  check('policy-revision-exact', () => assert.equal(createHarness().component.acceptEvidence({ ...evidenceRequest('e-1', 'EFFECT'), expectedPolicyRevision: '2' }).outcome, 'EVIDENCE_INVALID'));
  check('untrusted-source-rejected', () => assert.equal(accept(createHarness({ sourceRecord: source({ trusted: false }) }), 'e-1', 'EFFECT').outcome, 'EVIDENCE_INVALID'));
  check('source-claim-capability-enforced', () => assert.equal(accept(createHarness({ sourceRecord: source({ claimCapabilities: ['SUPPORT_UNKNOWN_ONLY'] }) }), 'e-1', 'EFFECT').outcome, 'EVIDENCE_INVALID'));
  check('unverified-evidence-rejected', () => assert.equal(accept(createHarness({ verifierMode: 'INVALID' }), 'e-1', 'EFFECT').outcome, 'EVIDENCE_INVALID'));
  check('verifier-unavailable-is-uncertain', () => assert.equal(accept(createHarness({ verifierMode: 'THROW' }), 'e-1', 'EFFECT').outcome, 'EVIDENCE_ACCEPTANCE_UNCERTAIN'));
  check('evidence-acceptance-is-not-conclusion', () => { const result = accept(createHarness(), 'e-1', 'EFFECT'); assert.equal(result.outcome, 'EFFECT_OUTCOME_EVIDENCE_ACCEPTED'); assert.equal(result.authoritativeEffectOutcome, null); });
  check('immutable-evidence-identity', () => { const result = accept(createHarness(), 'e-1', 'EFFECT'); assert.equal(result.evidence.effectOutcomeEvidenceId, 'e-1'); assert.equal(result.evidence.authoritativeConclusion, false); });
  check('canonical-evidence-digest-deterministic', () => { const left = accept(createHarness(), 'e-1', 'EFFECT'); const right = accept(createHarness(), 'e-1', 'EFFECT'); assert.equal(left.evidence.canonicalEvidenceDigest, right.evidence.canonicalEvidenceDigest); });
  check('multiple-evidence-records-allowed', () => { const h = createHarness(); accept(h, 'e-1', 'UNKNOWN'); accept(h, 'e-2', 'POSSIBLE'); assert.deepEqual(h.ledger.evidence.map((item) => item.evidenceOrdinal), [1, 2]); });
  check('exact-evidence-duplicate-deterministic', () => { const h = createHarness(); const first = accept(h, 'e-1', 'EFFECT'); const second = accept(h, 'e-1', 'EFFECT'); assert.equal(second.outcome, 'EVIDENCE_ALREADY_ACCEPTED'); assert.deepEqual(second.evidence, first.evidence); });
  check('same-id-changed-bytes-rejected', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); assert.equal(accept(h, 'e-1', 'UNKNOWN').outcome, 'EVIDENCE_ACCEPTANCE_REJECTED'); });
  check('cross-invocation-evidence-id-collision-rejected', () => { const first = createHarness(); const accepted = accept(first, 'e-1', 'EFFECT').evidence; const otherInvocation = invocation({ effectInvocationId: 'invocation-2', logicalEffectId: 'logical-effect-2' }); const other = createHarness({ invocationRecord: otherInvocation, ledger: createLedger({ evidenceSeed: [accepted] }) }); assert.equal(accept(other, 'e-1', 'EFFECT').outcome, 'EVIDENCE_ACCEPTANCE_REJECTED'); });
  check('contradiction-is-derived', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); const conflicting = accept(h, 'e-2', 'NO_EFFECT', noEffectProof); assert.equal(conflicting.outcome, 'EVIDENCE_CONFLICT_DETECTED'); assert.equal('contradiction' in conflicting.evidence.provenance, false); });
  check('evidence-response-loss-recovers-same-id', () => { const h = createHarness({ ledger: createLedger({ mode: 'EVIDENCE_STORE_THEN_THROW' }) }); assert.equal(accept(h, 'e-1', 'EFFECT').outcome, 'EVIDENCE_ALREADY_ACCEPTED'); });
  check('evidence-commit-uncertainty-does-not-create-truth', () => { const h = createHarness({ ledger: createLedger({ mode: 'EVIDENCE_THROW_BEFORE' }) }); const result = accept(h, 'e-1', 'EFFECT'); assert.equal(result.outcome, 'EVIDENCE_ACCEPTANCE_UNCERTAIN'); assert.equal(h.ledger.evidence.length, 0); });
  check('inconsistent-evidence-commit-fails-closed', () => assert.equal(accept(createHarness({ ledger: createLedger({ mode: 'EVIDENCE_CORRUPT_RETURN' }) }), 'e-1', 'EFFECT').outcome, 'EVIDENCE_ACCEPTANCE_UNCERTAIN'));

  for (const [kind, proof, expected] of [
    ['EFFECT', {}, 'EFFECT_CONFIRMED'], ['NO_EFFECT', noEffectProof, 'NO_EFFECT_CONFIRMED'],
    ['REJECT', rejectionProof, 'EFFECT_REJECTED_BEFORE_EFFECT'],
    ['POSSIBLE', {}, 'EFFECT_POSSIBLE'], ['UNKNOWN', {}, 'EFFECT_OUTCOME_UNKNOWN']]) {
    check(`resolution-class-${expected.toLowerCase()}`, () => { const h = createHarness(); accept(h, 'e-1', kind, proof); const result = resolve(h, 'r-1'); assert.equal(result.outcome, 'EFFECT_OUTCOME_RESOLVED'); assert.equal(result.resolution.effectOutcomeClass, expected); observations.push(result.resolution); });
  }
  check('resolution-class-effect-evidence-conflict', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); accept(h, 'e-2', 'NO_EFFECT', noEffectProof); assert.equal(resolve(h, 'r-1').resolution.effectOutcomeClass, 'EFFECT_EVIDENCE_CONFLICT'); });
  check('non-effect-requires-complete-causal-proof', () => { const h = createHarness(); accept(h, 'e-1', 'NO_EFFECT', { noHiddenRetry: true }); assert.equal(resolve(h, 'r-1').outcome, 'RESOLUTION_REJECTED'); });
  check('rejection-requires-before-effect-proof', () => { const h = createHarness(); accept(h, 'e-1', 'REJECT', { noHiddenRetry: true }); assert.equal(resolve(h, 'r-1').outcome, 'RESOLUTION_REJECTED'); });
  for (const kind of ['RETURN', 'ACK', 'UNKNOWN']) {
    check(`generic-${kind.toLowerCase()}-cannot-prove-non-effect`, () => { const h = createHarness(); accept(h, 'e-1', kind); assert.notEqual(resolve(h, 'r-1').resolution.effectOutcomeClass, 'NO_EFFECT_CONFIRMED'); });
  }
  check('resolution-binds-exact-evidence-set', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); const result = resolve(h, 'r-1'); const set = evidenceSet(h.invocationRecord, h.ledger.evidence); assert.deepEqual([result.resolution.evidenceSetRevision, result.resolution.evidenceSetDigest], [set.revision, set.digest]); });
  check('immutable-resolution-identity', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); assert.equal(resolve(h, 'r-1').resolution.effectOutcomeResolutionId, 'r-1'); });
  check('exact-resolution-duplicate-deterministic', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); const first = resolve(h, 'r-1'); const second = resolve(h, 'r-1'); assert.equal(second.outcome, 'RESOLUTION_ALREADY_RECORDED'); assert.deepEqual(second.resolution, first.resolution); });
  check('resolution-id-collision-rejected', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); resolve(h, 'r-1'); accept(h, 'e-2', 'POSSIBLE'); assert.equal(resolve(h, 'r-1').outcome, 'RESOLUTION_REJECTED'); });
  check('later-evidence-supersedes-without-rewrite', () => { const h = createHarness(); accept(h, 'e-1', 'UNKNOWN'); const first = resolve(h, 'r-1').resolution; accept(h, 'e-2', 'EFFECT'); const second = resolve(h, 'r-2').resolution; assert.equal(second.supersedesResolutionRef, 'r-1'); assert.equal(second.resolutionRevision, 2); assert.equal(h.ledger.resolutions[0].effectOutcomeClass, first.effectOutcomeClass); });
  check('stale-evidence-set-fails-closed', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); const set = evidenceSet(h.invocationRecord, h.ledger.evidence); accept(h, 'e-2', 'POSSIBLE'); const result = h.component.resolveOutcome({ effectOutcomeResolutionId: 'r-1', effectInvocationId: 'invocation-1', expectedPolicyRevision: '1', expectedEvidenceSetRevision: set.revision, expectedEvidenceSetDigest: set.digest }); assert.equal(result.outcome, 'EVIDENCE_SET_STALE'); });
  check('concurrent-evidence-guard-fails-closed', () => { const h = createHarness({ ledger: createLedger({ mode: 'RESOLUTION_STALE' }) }); accept(h, 'e-1', 'EFFECT'); assert.equal(resolve(h, 'r-1').outcome, 'EVIDENCE_SET_STALE'); });
  check('resolution-response-loss-recovers-same-id', () => { const ledger = createLedger({ mode: 'RESOLUTION_STORE_THEN_THROW' }); const h = createHarness({ ledger }); accept(h, 'e-1', 'EFFECT'); assert.equal(resolve(h, 'r-1').outcome, 'RESOLUTION_ALREADY_RECORDED'); });
  check('resolution-commit-uncertainty-is-not-truth', () => { const ledger = createLedger({ mode: 'RESOLUTION_THROW_BEFORE' }); const h = createHarness({ ledger }); accept(h, 'e-1', 'EFFECT'); assert.equal(resolve(h, 'r-1').outcome, 'RESOLUTION_UNCERTAIN'); assert.equal(ledger.resolutions.length, 0); });
  check('inconsistent-resolution-commit-fails-closed', () => { const h = createHarness({ ledger: createLedger({ mode: 'RESOLUTION_CORRUPT_RETURN' }) }); accept(h, 'e-1', 'EFFECT'); assert.equal(resolve(h, 'r-1').outcome, 'RESOLUTION_UNCERTAIN'); });
  check('missing-policy-fails-closed', () => { const h = createHarness({ policyContract: { identity: 'wrong', revision: '1' } }); assert.equal(accept(h, 'e-1', 'EFFECT').outcome, 'EVIDENCE_INVALID'); });
  check('missing-resolution-policy-has-exact-outcome', () => { const accepted = createHarness(); accept(accepted, 'e-1', 'EFFECT'); const set = evidenceSet(accepted.invocationRecord, accepted.ledger.evidence); const missing = createHarness({ ledger: accepted.ledger, policyContract: { identity: 'wrong', revision: '1' } }); const result = missing.component.resolveOutcome({ effectOutcomeResolutionId: 'r-1', effectInvocationId: 'invocation-1', expectedPolicyRevision: '1', expectedEvidenceSetRevision: set.revision, expectedEvidenceSetDigest: set.digest }); assert.equal(result.outcome, 'RESOLUTION_POLICY_NOT_FOUND'); });

  check('atomic-accept-and-resolve-commits-two-records', () => { const h = createHarness(); const result = h.component.acceptAndResolve({ evidenceRequest: evidenceRequest('e-1', 'EFFECT'), resolutionRequest: { effectOutcomeResolutionId: 'r-1' } }); assert.equal(result.evidence.outcome, 'EFFECT_OUTCOME_EVIDENCE_ACCEPTED'); assert.equal(result.resolution.outcome, 'EFFECT_OUTCOME_RESOLVED'); assert.deepEqual([h.ledger.evidence.length, h.ledger.resolutions.length], [1, 1]); });
  check('atomic-failure-leaves-no-partial-record', () => { const ledger = createLedger({ mode: 'ATOMIC_THROW_BEFORE' }); const h = createHarness({ ledger }); const result = h.component.acceptAndResolve({ evidenceRequest: evidenceRequest('e-1', 'EFFECT'), resolutionRequest: { effectOutcomeResolutionId: 'r-1' } }); assert.equal(result.resolution.outcome, 'RESOLUTION_UNCERTAIN'); assert.deepEqual([ledger.evidence.length, ledger.resolutions.length], [0, 0]); });
  check('atomic-response-loss-recovers-both-records', () => { const ledger = createLedger({ mode: 'ATOMIC_STORE_BOTH_THEN_THROW' }); const h = createHarness({ ledger }); const result = h.component.acceptAndResolve({ evidenceRequest: evidenceRequest('e-1', 'EFFECT'), resolutionRequest: { effectOutcomeResolutionId: 'r-1' } }); assert.equal(result.evidence.outcome, 'EVIDENCE_ALREADY_ACCEPTED'); assert.equal(result.resolution.outcome, 'RESOLUTION_ALREADY_RECORDED'); });
  check('atomic-path-rejects-conflicting-evidence', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); const result = h.component.acceptAndResolve({ evidenceRequest: evidenceRequest('e-2', 'NO_EFFECT', invocation(), noEffectProof), resolutionRequest: { effectOutcomeResolutionId: 'r-1' } }); assert.equal(result.evidence.outcome, 'EVIDENCE_ACCEPTANCE_REJECTED'); assert.equal(h.ledger.evidence.length, 1); });
  check('atomic-path-requires-policy-eligibility', () => { const h = createHarness({ policyContract: policy({ atomicSingleEvidenceResolution: false }) }); const result = h.component.acceptAndResolve({ evidenceRequest: evidenceRequest('e-1', 'EFFECT'), resolutionRequest: { effectOutcomeResolutionId: 'r-1' } }); assert.equal(result.evidence.outcome, 'EVIDENCE_ACCEPTANCE_REJECTED'); });

  check('resolution-never-emits-retry-authority', () => { const h = createHarness(); accept(h, 'e-1', 'NO_EFFECT', noEffectProof); const result = resolve(h, 'r-1'); assert.equal(result.retryAllowed, false); assert.equal(result.resolution.retryAllowed, false); assert.equal('retryAllowed' in result.resolution.retryHandoff, false); });
  check('confirmed-effect-handoff-preserves-logical-effect', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); const result = resolve(h, 'r-1'); assert.equal(result.resolution.retryHandoff.logicalEffectId, 'logical-effect-1'); });
  check('effect-outcome-is-not-result-or-completion', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); const result = resolve(h, 'r-1'); assert.deepEqual([result.resultAccepted, result.executionCompleted, result.resolution.resultAccepted, result.resolution.executionCompleted], [false, false, false, false]); });
  check('no-external-effect-is-excluded', () => { const noEffectInvocation = invocation({ effectIdempotencyClass: 'NO_EXTERNAL_EFFECT', logicalEffectId: null }); assert.equal(accept(createHarness({ invocationRecord: noEffectInvocation }), 'e-1', 'UNKNOWN').outcome, 'EVIDENCE_INVALID'); });
  check('historical-evidence-does-not-require-current-claim-owner-adapter', () => { const h = createHarness(); const accepted = accept(h, 'e-1', 'EFFECT', {}, { currentClaim: false, ownerCurrent: false, adapterCurrent: false }); assert.equal(accepted.outcome, 'EFFECT_OUTCOME_EVIDENCE_ACCEPTED'); });
  check('component-exposes-only-three-bounded-operations', () => assert.deepEqual(Object.keys(createHarness().component), ['acceptEvidence', 'resolveOutcome', 'acceptAndResolve']));
  check('evidence-outcome-grammar-exact', () => assert.deepEqual(Object.values(EVIDENCE_ACCEPTANCE_OUTCOMES).sort(), ['EFFECT_OUTCOME_EVIDENCE_ACCEPTED', 'EVIDENCE_ACCEPTANCE_REJECTED', 'EVIDENCE_ACCEPTANCE_UNCERTAIN', 'EVIDENCE_ALREADY_ACCEPTED', 'EVIDENCE_CONFLICT_DETECTED', 'EVIDENCE_INVALID', 'EVIDENCE_NOT_APPLICABLE', 'INVOCATION_NOT_FOUND']));
  check('resolution-operation-grammar-exact', () => assert.deepEqual(Object.values(RESOLUTION_OPERATION_OUTCOMES).sort(), ['EFFECT_OUTCOME_RESOLVED', 'EVIDENCE_SET_STALE', 'INVOCATION_NOT_FOUND', 'RESOLUTION_ALREADY_RECORDED', 'RESOLUTION_POLICY_NOT_FOUND', 'RESOLUTION_REJECTED', 'RESOLUTION_UNCERTAIN']));
  check('resolution-class-grammar-exact', () => assert.deepEqual(EFFECT_OUTCOME_CLASSES, ['EFFECT_CONFIRMED', 'NO_EFFECT_CONFIRMED', 'EFFECT_REJECTED_BEFORE_EFFECT', 'EFFECT_POSSIBLE', 'EFFECT_OUTCOME_UNKNOWN', 'EFFECT_EVIDENCE_CONFLICT']));
  check('observation-grammar-exact', () => assert.deepEqual(OBSERVATION_CLASSES, ['TRANSPORT_RETURN_OBSERVED', 'REQUEST_ACKNOWLEDGED', 'REQUEST_REJECTED_OBSERVED', 'EFFECT_OCCURRED_OBSERVED', 'NO_EFFECT_OBSERVED', 'DELIVERY_OR_PROCESSING_POSSIBLE', 'OUTCOME_UNKNOWN_OBSERVED']));
  check('required-ports-validated', () => assert.throws(() => createGovernedEffectOutcomeResolution({}), TypeError));
  check('no-provider-reconciliation-or-product-calls', () => { const h = createHarness(); accept(h, 'e-1', 'EFFECT'); resolve(h, 'r-1'); assert.deepEqual({ provider: h.calls.provider, reconciliation: h.calls.reconciliation, product: h.calls.product, effect: h.calls.effect, retry: h.calls.retry, result: h.calls.result, completion: h.calls.completion }, { provider: 0, reconciliation: 0, product: 0, effect: 0, retry: 0, result: 0, completion: 0 }); });
  check('equivalent-complete-runs-are-deterministic', () => { const left = createHarness(); const right = createHarness(); const leftEvidence = accept(left, 'e-1', 'EFFECT'); const rightEvidence = accept(right, 'e-1', 'EFFECT'); const leftResolution = resolve(left, 'r-1'); const rightResolution = resolve(right, 'r-1'); assert.deepEqual([leftEvidence, leftResolution], [rightEvidence, rightResolution]); observations.push(leftEvidence.evidence, leftResolution.resolution); });

  const canonical = canonicalStringify({ cases, observations,
    evidenceOutcomes: Object.values(EVIDENCE_ACCEPTANCE_OUTCOMES),
    resolutionOutcomes: Object.values(RESOLUTION_OPERATION_OUTCOMES),
    effectOutcomeClasses: EFFECT_OUTCOME_CLASSES });
  return { cases, canonical, hash: crypto.createHash('sha256').update(canonical).digest('hex') };
}

const first = runSuite();
const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-effect-outcome-resolution-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
