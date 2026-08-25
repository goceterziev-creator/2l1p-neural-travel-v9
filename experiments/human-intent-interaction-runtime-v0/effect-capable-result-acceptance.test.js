'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { RESULT_EVIDENCE_OUTCOMES, RESULT_ACCEPTANCE_OUTCOMES,
  createGovernedEffectCapableResultAcceptance, canonicalStringify, digest } = require(
  './effect-capable-result-acceptance');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function start(overrides = {}) {
  return { type: 'EXECUTION_ATTEMPT_START', status: 'EXECUTION_ATTEMPT_STARTED',
    executionStartId: 'start-1', startRevision: 1, executionAttemptId: 'attempt-1',
    attemptRevision: 1, attemptClaimId: 'claim-1', claimRevision: 1,
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-1',
    dispatchId: 'dispatch-1', continuationId: 'continuation-1', interactionId: 'interaction-1',
    gateId: 'gate-1', authorityScope: { tenant: 'tenant-1' },
    actionIdentity: 'action-1', actionRevision: '1',
    continuationTargetRef: 'target-1', executionOwnerIdentity: 'execution-owner-1',
    inputRef: 'input-1', verifiedInputDigest: 'input-digest-1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY', logicalEffectId: 'effect-1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    executionActivityStarted: true, singleAuthoritativeStart: true, ...clone(overrides) };
}

function resolution(overrides = {}) {
  return { type: 'EFFECT_OUTCOME_RESOLUTION', status: 'EFFECT_OUTCOME_RESOLVED',
    effectOutcomeResolutionId: 'resolution-1', resolutionRevision: 1,
    effectInvocationId: 'invocation-1', logicalEffectId: 'effect-1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY', evidenceSetRevision: 1,
    evidenceSetDigest: 'outcome-set-digest-1', effectOutcomeClass: 'EFFECT_CONFIRMED',
    resultAccepted: false, executionCompleted: false, ...clone(overrides) };
}

function harness(options = {}) {
  const starts = new Map(); const resolutions = new Map();
  const evidence = []; const acceptances = [];
  const calls = { provider: 0, executor: 0, product: 0, effect: 0, completion: 0,
    retry: 0, authority: 0 };
  const startRecord = start(options.startOverrides);
  const resolutionRecord = resolution(options.resolutionOverrides);
  if (!options.noStart) starts.set(startRecord.executionStartId,
    { evidenceRef: 'start-evidence-1', record: startRecord });
  if (!options.noResolution) resolutions.set(resolutionRecord.effectOutcomeResolutionId,
    { evidenceRef: 'resolution-evidence-1', record: resolutionRecord });
  const sourceRecord = { type: 'RESULT_EVIDENCE_SOURCE_REGISTRATION', status: 'ENABLED',
    sourceIdentity: 'source-1', sourceRevision: '1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    effectContractRef: 'effect-contract-1', effectContractRevision: '1',
    effectCapableResultEvidence: true, ...clone(options.sourceOverrides || {}) };
  const grammarRecord = { type: 'RESULT_EVIDENCE_GRAMMAR', status: 'ENABLED',
    ref: 'result-grammar-1', revision: '1',
    evaluateEvidenceSet(records) { return options.notAcceptable
      ? { accepted: false }
      : { accepted: true, resultRef: 'result-1', resultDigest: 'result-digest-1',
        acceptanceEvidenceRefs: records.map((item) => item.resultEvidenceId) }; },
    ...clone(options.grammarOverrides || {}) };
  let failEvidence = options.failEvidence || null;
  let failAcceptance = options.failAcceptance || null;
  const ledger = {
    findEvidenceById(id) { return evidence.filter((item) => item.resultEvidenceId === id).map(clone); },
    listEvidenceForStart(id) { return evidence.filter((item) => item.executionStartId === id).map(clone); },
    commitEvidence(record, guards) {
      if (failEvidence === 'uncertain') throw new Error('uncertain');
      if (failEvidence === 'response-loss') { evidence.push(clone(record)); failEvidence = null;
        throw new Error('response loss'); }
      assert.equal(guards.expectedCurrentOutcomeResolutionId, 'resolution-1');
      assert.equal(guards.effectOutcomeClass, 'EFFECT_CONFIRMED');
      assert.equal(guards.completionAbsent, true);
      evidence.push(clone(record)); return clone(record);
    },
    findAcceptanceById(id) { return acceptances.filter((item) => item.resultAcceptanceId === id).map(clone); },
    findCurrentAcceptanceForStart(id) { const found = acceptances.filter((item) =>
      item.executionStartId === id); return found.length ? [clone(found.at(-1))] : []; },
    commitAcceptance(record, guards) {
      if (failAcceptance === 'uncertain') throw new Error('uncertain');
      if (failAcceptance === 'response-loss') { acceptances.push(clone(record)); failAcceptance = null;
        throw new Error('response loss'); }
      assert.equal(guards.expectedCurrentOutcomeResolutionId, 'resolution-1');
      assert.equal(guards.effectOutcomeClass, 'EFFECT_CONFIRMED');
      assert.equal(guards.completionAbsent, true);
      acceptances.push(clone(record)); return clone(record);
    }
  };
  const component = createGovernedEffectCapableResultAcceptance({
    startSnapshotPort: (id) => clone(starts.get(id)),
    outcomeResolutionSnapshotPort: (id) => clone(resolutions.get(id)),
    currentOutcomeResolutionPort: () => options.staleResolution
      ? { evidenceRef: 'resolution-evidence-2', record: resolutionRecord }
      : clone(resolutions.get('resolution-1')),
    resultEvidenceSourceRegistryPort: () => options.noSource ? null
      : { evidenceRef: 'source-registry-evidence-1', record: sourceRecord },
    resultEvidenceGrammarRegistryPort: () => options.noGrammar ? null
      : { evidenceRef: 'grammar-registry-evidence-1', record: grammarRecord },
    resultEvidenceVerifierPort: ({ rawEvidence, start: currentStart, resolution: currentResolution }) => {
      if (options.invalidEvidence) return { valid: false };
      const canonicalEvidence = clone(rawEvidence);
      return { valid: true, sourceEvidenceRef: 'source-observation-1',
        verificationEvidenceRef: 'verification-1', evidenceClass: 'RESULT_OBSERVATION',
        executionStartId: currentStart.executionStartId,
        executionAttemptId: currentStart.executionAttemptId,
        effectInvocationId: currentResolution.effectInvocationId,
        logicalEffectId: currentStart.logicalEffectId,
        verifiedInputDigest: currentStart.verifiedInputDigest, canonicalEvidence,
        canonicalEvidenceDigest: options.badDigest ? 'bad-digest' : digest(canonicalEvidence) };
    }, resultLedger: ledger });
  return { component, starts, resolutions, evidence, acceptances, calls,
    startRecord, resolutionRecord, sourceRecord, grammarRecord };
}

function evidenceRequest(overrides = {}) {
  return { resultEvidenceId: 'result-evidence-1', executionStartId: 'start-1',
    effectOutcomeResolutionId: 'resolution-1', sourceIdentity: 'source-1',
    expectedSourceRevision: '1', rawEvidence: { value: 'bounded-result' }, ...overrides };
}

function acceptEvidence(h, overrides = {}) { return h.component.acceptEvidence(evidenceRequest(overrides)); }

function setFor(h) {
  const items = h.evidence.slice().sort((a, b) => a.evidenceOrdinal - b.evidenceOrdinal);
  const binding = { executionStartId: h.startRecord.executionStartId,
    startRevision: h.startRecord.startRevision,
    executionAttemptId: h.startRecord.executionAttemptId,
    effectOutcomeResolutionId: h.resolutionRecord.effectOutcomeResolutionId,
    outcomeResolutionRevision: h.resolutionRecord.resolutionRevision,
    effectInvocationId: h.resolutionRecord.effectInvocationId,
    logicalEffectId: h.startRecord.logicalEffectId,
    resultEvidenceGrammarRef: h.grammarRecord.ref,
    resultEvidenceGrammarRevision: h.grammarRecord.revision,
    evidence: items.map((item) => ({ resultEvidenceId: item.resultEvidenceId,
      evidenceRevision: item.evidenceRevision, evidenceOrdinal: item.evidenceOrdinal,
      canonicalEvidenceDigest: item.canonicalEvidenceDigest })) };
  return { revision: items.length, digest: digest(binding) };
}

function resultRequest(h, overrides = {}) {
  const set = setFor(h);
  return { resultAcceptanceId: 'result-acceptance-1', executionStartId: 'start-1',
    effectOutcomeResolutionId: 'resolution-1', expectedEvidenceSetRevision: set.revision,
    expectedEvidenceSetDigest: set.digest, ...overrides };
}

function acceptResult(h, overrides = {}) { return h.component.acceptResult(resultRequest(h, overrides)); }

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

check('authoritative-start-required', () => assert.equal(acceptEvidence(harness({ noStart: true })).outcome, 'START_NOT_FOUND'));
check('fabricated-start-fields-do-not-grant-evidence', () => assert.equal(acceptEvidence(harness({ noStart: true }), { actionIdentity: 'action-1' }).outcome, 'START_NOT_FOUND'));
check('authoritative-resolution-required', () => assert.equal(acceptEvidence(harness({ noResolution: true })).outcome, 'OUTCOME_RESOLUTION_NOT_FOUND'));
for (const outcome of ['NO_EFFECT_CONFIRMED', 'EFFECT_REJECTED_BEFORE_EFFECT', 'EFFECT_POSSIBLE', 'EFFECT_OUTCOME_UNKNOWN', 'EFFECT_EVIDENCE_CONFLICT']) {
  check(`outcome-${outcome}-not-eligible`, () => assert.equal(acceptEvidence(harness({ resolutionOverrides: { effectOutcomeClass: outcome } })).outcome, 'OUTCOME_NOT_ELIGIBLE'));
}
check('no-external-effect-branch-rejected', () => assert.equal(acceptEvidence(harness({ startOverrides: { effectIdempotencyClass: 'NO_EXTERNAL_EFFECT', logicalEffectId: null } })).outcome, 'BRANCH_MISMATCH'));
check('stale-resolution-rejected', () => assert.equal(acceptEvidence(harness({ staleResolution: true })).outcome, 'OUTCOME_NOT_ELIGIBLE'));
check('resolution-logical-effect-mismatch-rejected', () => assert.equal(acceptEvidence(harness({ resolutionOverrides: { logicalEffectId: 'other' } })).outcome, 'OUTCOME_NOT_ELIGIBLE'));
check('resolution-contract-mismatch-rejected', () => assert.equal(acceptEvidence(harness({ resolutionOverrides: { effectContractRevision: '2' } })).outcome, 'OUTCOME_NOT_ELIGIBLE'));
check('trusted-source-required', () => assert.equal(acceptEvidence(harness({ noSource: true })).outcome, 'EVIDENCE_NOT_APPLICABLE'));
check('source-revision-exact', () => assert.equal(acceptEvidence(harness(), { expectedSourceRevision: '2' }).outcome, 'EVIDENCE_NOT_APPLICABLE'));
check('source-effect-capability-required', () => assert.equal(acceptEvidence(harness({ sourceOverrides: { effectCapableResultEvidence: false } })).outcome, 'EVIDENCE_NOT_APPLICABLE'));
check('invalid-evidence-rejected', () => assert.equal(acceptEvidence(harness({ invalidEvidence: true })).outcome, 'RESULT_EVIDENCE_INVALID'));
check('canonical-digest-mismatch-rejected', () => assert.equal(acceptEvidence(harness({ badDigest: true })).outcome, 'RESULT_EVIDENCE_INVALID'));
check('evidence-accepted', () => assert.equal(acceptEvidence(harness()).outcome, 'RESULT_EVIDENCE_ACCEPTED'));
check('evidence-remains-observation', () => { const result = acceptEvidence(harness()); assert.deepEqual([result.authoritativeResult, result.resultAccepted, result.executionCompleted], [false, false, false]); });
check('exact-lineage-preserved', () => { const h = harness(); const record = acceptEvidence(h).evidence; assert.deepEqual([record.executionStartId, record.executionAttemptId, record.effectOutcomeResolutionId, record.effectInvocationId, record.logicalEffectId, record.actionIdentity, record.verifiedInputDigest], ['start-1', 'attempt-1', 'resolution-1', 'invocation-1', 'effect-1', 'action-1', 'input-digest-1']); });
check('exact-duplicate-deterministic', () => { const h = harness(); const first = acceptEvidence(h); const second = acceptEvidence(h); assert.equal(second.outcome, 'RESULT_EVIDENCE_ALREADY_ACCEPTED'); assert.deepEqual(second.evidence, first.evidence); });
check('same-id-changed-bytes-rejected', () => { const h = harness(); acceptEvidence(h); assert.equal(acceptEvidence(h, { rawEvidence: { value: 'changed' } }).outcome, 'RESULT_EVIDENCE_REJECTED'); });
check('multiple-evidence-observations-allowed', () => { const h = harness(); acceptEvidence(h); const second = acceptEvidence(h, { resultEvidenceId: 'result-evidence-2', rawEvidence: { value: 'second' } }); assert.equal(second.evidence.evidenceOrdinal, 2); });
check('response-loss-recovers-evidence', () => assert.equal(acceptEvidence(harness({ failEvidence: 'response-loss' })).outcome, 'RESULT_EVIDENCE_ALREADY_ACCEPTED'));
check('uncertain-evidence-commit-fails-closed', () => assert.equal(acceptEvidence(harness({ failEvidence: 'uncertain' })).outcome, 'RESULT_EVIDENCE_UNCERTAIN'));
check('result-requires-authoritative-start', () => { const h = harness(); acceptEvidence(h); h.starts.clear(); assert.equal(acceptResult(h).outcome, 'START_NOT_FOUND'); });
check('result-requires-authoritative-current-resolution', () => { const h = harness(); acceptEvidence(h); h.resolutions.clear(); assert.equal(acceptResult(h).outcome, 'OUTCOME_RESOLUTION_NOT_FOUND'); });
check('result-requires-frozen-grammar', () => { const h = harness({ noGrammar: true }); acceptEvidence(h); assert.equal(acceptResult(h).outcome, 'RESULT_GRAMMAR_NOT_FOUND'); });
check('empty-evidence-set-not-acceptable', () => { const h = harness(); assert.equal(acceptResult(h).outcome, 'RESULT_NOT_ACCEPTABLE'); });
check('stale-evidence-set-rejected', () => { const h = harness(); acceptEvidence(h); assert.equal(acceptResult(h, { expectedEvidenceSetDigest: 'stale' }).outcome, 'EVIDENCE_SET_STALE'); });
check('grammar-rejection-preserved', () => { const h = harness({ notAcceptable: true }); acceptEvidence(h); assert.equal(acceptResult(h).outcome, 'RESULT_NOT_ACCEPTABLE'); });
check('result-accepted', () => { const h = harness(); acceptEvidence(h); assert.equal(acceptResult(h).outcome, 'RESULT_ACCEPTED'); });
check('result-effect-and-evidence-distinct', () => { const h = harness(); const evidence = acceptEvidence(h).evidence; const acceptance = acceptResult(h).acceptance; assert.deepEqual([evidence.authoritativeResult, acceptance.resultAccepted, acceptance.effectOutcomeClass, acceptance.executionCompleted], [false, true, 'EFFECT_CONFIRMED', false]); });
check('result-acceptance-binds-exact-set', () => { const h = harness(); acceptEvidence(h); const set = setFor(h); const record = acceptResult(h).acceptance; assert.deepEqual([record.evidenceSetRevision, record.evidenceSetDigest], [set.revision, set.digest]); });
check('result-acceptance-binds-invocation', () => { const h = harness(); acceptEvidence(h); const record = acceptResult(h).acceptance; assert.deepEqual([record.effectInvocationId, record.logicalEffectId, record.effectOutcomeResolutionId], ['invocation-1', 'effect-1', 'resolution-1']); });
check('exact-result-duplicate-deterministic', () => { const h = harness(); acceptEvidence(h); const first = acceptResult(h); const second = acceptResult(h); assert.equal(second.outcome, 'RESULT_ALREADY_ACCEPTED'); assert.deepEqual(second.acceptance, first.acceptance); });
check('result-id-collision-rejected', () => { const h = harness(); acceptEvidence(h); acceptResult(h); acceptEvidence(h, { resultEvidenceId: 'result-evidence-2', rawEvidence: { value: 'new' } }); assert.equal(acceptResult(h, { expectedEvidenceSetRevision: 2, expectedEvidenceSetDigest: setFor(h).digest }).outcome, 'RESULT_ACCEPTANCE_REJECTED'); });
check('later-evidence-supersedes-with-new-id', () => { const h = harness(); acceptEvidence(h); acceptResult(h); acceptEvidence(h, { resultEvidenceId: 'result-evidence-2', rawEvidence: { value: 'new' } }); const result = acceptResult(h, { resultAcceptanceId: 'result-acceptance-2' }); assert.deepEqual([result.acceptance.acceptanceRevision, result.acceptance.supersedesResultAcceptanceRef], [2, 'result-acceptance-1']); });
check('historical-acceptance-remains-immutable', () => { const h = harness(); acceptEvidence(h); const first = clone(acceptResult(h).acceptance); acceptEvidence(h, { resultEvidenceId: 'result-evidence-2', rawEvidence: { value: 'new' } }); acceptResult(h, { resultAcceptanceId: 'result-acceptance-2' }); assert.deepEqual(h.acceptances[0], first); });
check('acceptance-response-loss-recovers', () => { const h = harness({ failAcceptance: 'response-loss' }); acceptEvidence(h); assert.equal(acceptResult(h).outcome, 'RESULT_ALREADY_ACCEPTED'); });
check('acceptance-uncertainty-fails-closed', () => { const h = harness({ failAcceptance: 'uncertain' }); acceptEvidence(h); assert.equal(acceptResult(h).outcome, 'RESULT_ACCEPTANCE_UNCERTAIN'); });
check('non-idempotent-confirmed-effect-supported', () => { const h = harness({ startOverrides: { effectIdempotencyClass: 'NON_IDEMPOTENT' }, resolutionOverrides: { effectIdempotencyClass: 'NON_IDEMPOTENT' } }); acceptEvidence(h); assert.equal(acceptResult(h).outcome, 'RESULT_ACCEPTED'); });
check('idempotency-does-not-create-retry-authority', () => { const h = harness(); acceptEvidence(h); const record = acceptResult(h).acceptance; assert.equal('retryAllowed' in record, false); });
check('result-acceptance-is-not-completion-or-success', () => { const h = harness(); acceptEvidence(h); const result = acceptResult(h); assert.deepEqual([result.executionCompleted, result.executionSuccessful, result.acceptance.executionCompleted, result.acceptance.executionSuccessful], [false, false, false, false]); });
check('no-human-authority-created', () => { const h = harness(); acceptEvidence(h); assert.equal(acceptResult(h).acceptance.authorityCreated, false); });
check('evidence-outcome-grammar-exact', () => assert.deepEqual(Object.values(RESULT_EVIDENCE_OUTCOMES).sort(), ['BRANCH_MISMATCH', 'EVIDENCE_NOT_APPLICABLE', 'OUTCOME_NOT_ELIGIBLE', 'OUTCOME_RESOLUTION_NOT_FOUND', 'RESULT_EVIDENCE_ACCEPTED', 'RESULT_EVIDENCE_ALREADY_ACCEPTED', 'RESULT_EVIDENCE_INVALID', 'RESULT_EVIDENCE_REJECTED', 'RESULT_EVIDENCE_UNCERTAIN', 'START_NOT_FOUND']));
check('acceptance-outcome-grammar-exact', () => assert.deepEqual(Object.values(RESULT_ACCEPTANCE_OUTCOMES).sort(), ['BRANCH_MISMATCH', 'EVIDENCE_SET_STALE', 'OUTCOME_NOT_ELIGIBLE', 'OUTCOME_RESOLUTION_NOT_FOUND', 'RESULT_ACCEPTANCE_REJECTED', 'RESULT_ACCEPTANCE_UNCERTAIN', 'RESULT_ACCEPTED', 'RESULT_ALREADY_ACCEPTED', 'RESULT_GRAMMAR_NOT_FOUND', 'RESULT_NOT_ACCEPTABLE', 'START_NOT_FOUND']));
check('canonical-serialization-deterministic', () => assert.equal(canonicalStringify({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}'));
check('canonical-digest-deterministic', () => assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 })));
check('no-provider-executor-product-effect-completion-operations', () => { const h = harness(); acceptEvidence(h); acceptResult(h); assert.deepEqual(Object.values(h.calls), [0, 0, 0, 0, 0, 0, 0]); });

const results = [];
for (const item of checks) {
  try { item.fn(); results.push({ name: item.name, status: 'PASS' }); }
  catch (error) { results.push({ name: item.name, status: 'FAIL', error: error.message }); }
}
const passed = results.filter((item) => item.status === 'PASS').length;
const failed = results.length - passed;
const hash = crypto.createHash('sha256').update(canonicalStringify(results)).digest('hex');
const output = { suite: 'governed-effect-capable-result-acceptance-v0',
  status: failed === 0 ? 'PASS' : 'FAIL', passed, failed, total: results.length, hash, results };
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (failed) process.exitCode = 1;
