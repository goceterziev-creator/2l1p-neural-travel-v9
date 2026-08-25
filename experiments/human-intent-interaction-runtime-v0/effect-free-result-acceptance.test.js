'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalStringify } = require('../human-intent-layer-v0/intent-layer');
const { RESULT_EVIDENCE_OUTCOMES, RESULT_ACCEPTANCE_OUTCOMES,
  createGovernedEffectFreeResultAcceptance } = require('./effect-free-result-acceptance');

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const digest = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const compactCanonical = (value) => JSON.stringify((function sort(input) {
  if (Array.isArray(input)) return input.map(sort);
  if (input && typeof input === 'object') return Object.keys(input).sort().reduce((out, key) => {
    out[key] = sort(input[key]); return out;
  }, {});
  return input;
})(value));

function start(overrides = {}) {
  return { type: 'EXECUTION_ATTEMPT_START', status: 'EXECUTION_ATTEMPT_STARTED',
    executionStartId: 'start-1', startRevision: 1, executionAttemptId: 'attempt-1',
    attemptRevision: 1, attemptClaimId: 'claim-1', claimRevision: 1,
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-1',
    dispatchId: 'dispatch-1', continuationId: 'continuation-1', interactionId: 'interaction-1',
    gateId: 'gate-1', authorityEvidenceRef: 'authority-1',
    governanceEvaluationRef: 'evaluation-1', authorityScope: { offerId: 'offer-1' },
    adapterRegistrationIdentity: 'adapter-registration-1', adapterRegistrationRevision: '1',
    adapterIdentity: 'pure-adapter', adapterRevision: '1',
    attemptOwnerIdentity: 'owner-1', actionIdentity: 'offer.calculate', actionRevision: '1',
    continuationTargetRef: 'offer.calculate:offer-1', executionOwnerIdentity: 'execution-owner-1',
    inputRef: 'input:offer-1', verifiedInputDigest: 'sha256:input-1',
    verifiedInputEvidenceRef: 'input-evidence-1', effectContractRef: 'effect-contract-none',
    effectContractRevision: '1', effectIdempotencyClass: 'NO_EXTERNAL_EFFECT',
    logicalEffectId: null, resultEvidenceGrammarRef: 'result-grammar-1',
    resultEvidenceGrammarRevision: '1', executionActivityStarted: true,
    singleAuthoritativeStart: true, ...clone(overrides) };
}

function source(overrides = {}) {
  return { evidenceRef: 'source-evidence-1', record: {
    type: 'RESULT_EVIDENCE_SOURCE_REGISTRATION', status: 'ENABLED',
    sourceIdentity: 'pure-result-source', sourceRevision: '1', trusted: true,
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    acquisitionMethods: ['PURE_COMPUTATION_RETURN', 'HISTORICAL_IMPORT'],
    correlationMode: 'EXACT_START_ATTEMPT_AND_INPUT', ...clone(overrides) } };
}

function grammar(overrides = {}) {
  return { ref: 'result-grammar-1', revision: '1',
    classifyAndCanonicalize(observation) {
      if (!['PARTIAL', 'FINAL'].includes(observation.kind)) throw new Error('invalid');
      return { evidenceClass: observation.kind === 'FINAL'
        ? 'FINAL_RESULT_OBSERVED' : 'PARTIAL_RESULT_OBSERVED',
      canonicalBytes: canonicalStringify(observation) };
    },
    evaluateEvidenceSet(records) {
      const final = records.filter((item) => item.evidenceClass === 'FINAL_RESULT_OBSERVED');
      if (final.length !== 1) return { accepted: false };
      return { accepted: true, resultRef: 'result:offer-1',
        resultDigest: 'sha256:result-1',
        acceptanceEvidenceRefs: [final[0].resultEvidenceId] };
    }, ...overrides };
}

function observation(kind = 'FINAL', overrides = {}) {
  return { kind, executionStartId: 'start-1', executionAttemptId: 'attempt-1',
    inputRef: 'input:offer-1', verifiedInputDigest: 'sha256:input-1',
    payload: kind === 'FINAL' ? { total: 42 } : { progress: 50 }, ...clone(overrides) };
}

function evidenceRequest(id = 'evidence-1', kind = 'FINAL', overrides = {}) {
  return { resultEvidenceId: id, executionStartId: 'start-1',
    sourceIdentity: 'pure-result-source', expectedSourceRevision: '1',
    expectedGrammarRevision: '1', acquisitionMethod: 'PURE_COMPUTATION_RETURN',
    observation: observation(kind), provenance: { producer: 'pure-adapter', sequence: 1 },
    ...clone(overrides) };
}

function setFor(startRecord, records, grammarRecord = grammar()) {
  const ordered = records.map(clone).sort((a, b) => a.evidenceOrdinal - b.evidenceOrdinal
    || a.resultEvidenceId.localeCompare(b.resultEvidenceId));
  const binding = { executionStartId: startRecord.executionStartId,
    startRevision: startRecord.startRevision, executionAttemptId: startRecord.executionAttemptId,
    resultEvidenceGrammarRef: grammarRecord.ref,
    resultEvidenceGrammarRevision: grammarRecord.revision,
    evidence: ordered.map((item) => ({ resultEvidenceId: item.resultEvidenceId,
      evidenceRevision: item.evidenceRevision, evidenceOrdinal: item.evidenceOrdinal,
      canonicalEvidenceDigest: item.canonicalEvidenceDigest })) };
  return { revision: ordered.length, digest: digest(compactCanonical(binding)) };
}

function createLedger({ evidenceSeed = [], acceptanceSeed = [], mode = 'NORMAL' } = {}) {
  const evidence = evidenceSeed.map(clone); const acceptances = acceptanceSeed.map(clone);
  return { evidence, acceptances,
    findEvidenceById(id) { return evidence.filter((item) => item.resultEvidenceId === id).map(clone); },
    listEvidenceForStart(id) { return evidence.filter((item) => item.executionStartId === id).map(clone); },
    commitEvidence(record, guards) {
      if (!guards || guards.startRevision !== 1 || guards.effectIdempotencyClass !== 'NO_EXTERNAL_EFFECT'
        || guards.resultEvidenceGrammarRevision !== '1'
        || guards.expectedEvidenceSetRevision !== evidence.length) throw new Error('guard');
      if (mode === 'EVIDENCE_THROW_BEFORE') throw new Error('uncertain');
      if (mode === 'EVIDENCE_STORE_THEN_THROW') { evidence.push(clone(record)); throw new Error('lost'); }
      if (mode === 'EVIDENCE_CORRUPT_RETURN') return { ...clone(record), inputRef: 'other' };
      evidence.push(clone(record)); return clone(record);
    },
    findAcceptanceById(id) { return acceptances.filter((item) => item.resultAcceptanceId === id).map(clone); },
    findCurrentAcceptanceForStart(id) { return acceptances.filter((item) =>
      item.executionStartId === id).sort((a, b) => b.acceptanceRevision - a.acceptanceRevision)
      .slice(0, 1).map(clone); },
    commitAcceptance(record, guards) {
      if (!guards || guards.startRevision !== 1 || guards.completionAbsent !== true
        || guards.expectedEvidenceSetRevision !== evidence.length) {
        const error = new Error('stale'); error.code = 'EVIDENCE_SET_STALE'; throw error;
      }
      if (mode === 'ACCEPTANCE_STALE') { const error = new Error('stale'); error.code = 'EVIDENCE_SET_STALE'; throw error; }
      if (mode === 'ACCEPTANCE_THROW_BEFORE') throw new Error('uncertain');
      if (mode === 'ACCEPTANCE_STORE_THEN_THROW') { acceptances.push(clone(record)); throw new Error('lost'); }
      if (mode === 'ACCEPTANCE_CORRUPT_RETURN') return { ...clone(record), acceptedResultDigest: 'wrong' };
      acceptances.push(clone(record)); return clone(record);
    } };
}

function harness(overrides = {}) {
  const startRecord = overrides.startRecord === undefined ? start() : overrides.startRecord;
  const sourceSnapshot = overrides.sourceSnapshot === undefined ? source() : overrides.sourceSnapshot;
  const grammarRecord = overrides.grammarRecord === undefined ? grammar() : overrides.grammarRecord;
  const ledger = overrides.ledger || createLedger();
  const calls = { start: 0, source: 0, grammar: 0, verifier: 0,
    provider: 0, executor: 0, product: 0, effect: 0, completion: 0, authority: 0 };
  const component = createGovernedEffectFreeResultAcceptance({
    startSnapshotPort(id) { calls.start += 1; if (overrides.startError) throw new Error('x');
      return startRecord && id === startRecord.executionStartId
        ? { evidenceRef: 'start-evidence-1', record: clone(startRecord) } : null; },
    resultEvidenceSourceRegistryPort() { calls.source += 1; if (overrides.sourceError) throw new Error('x'); return sourceSnapshot; },
    resultEvidenceGrammarRegistryPort() { calls.grammar += 1; if (overrides.grammarError) throw new Error('x'); return grammarRecord; },
    resultEvidenceVerifierPort(binding) { calls.verifier += 1; if (overrides.verifierError) throw new Error('x');
      if (overrides.verification !== undefined) return clone(overrides.verification);
      return { verified: true, evidenceRef: `verification:${digest(binding.canonicalBytes)}` }; },
    resultLedger: ledger });
  return { component, startRecord, sourceSnapshot, grammarRecord, ledger, calls };
}

function accept(h, id = 'evidence-1', kind = 'FINAL', overrides = {}) {
  return h.component.acceptEvidence(evidenceRequest(id, kind, overrides));
}

function acceptResult(h, id = 'acceptance-1', overrides = {}) {
  const set = setFor(h.startRecord || start(), h.ledger.evidence,
    h.grammarRecord || grammar());
  return h.component.acceptResult({ resultAcceptanceId: id, executionStartId: 'start-1',
    expectedGrammarRevision: '1', expectedEvidenceSetRevision: set.revision,
    expectedEvidenceSetDigest: set.digest, ...clone(overrides) });
}

function runSuite() {
  const cases = []; const observations = [];
  const check = (name, fn) => { fn(); cases.push(name); };

  check('authoritative-start-required-for-evidence', () => assert.equal(accept(harness({ startRecord: null })).outcome, 'START_NOT_FOUND'));
  check('authoritative-start-required-for-acceptance', () => assert.equal(acceptResult(harness({ startRecord: null })).outcome, 'START_NOT_FOUND'));
  check('fabricated-start-fields-grant-nothing', () => { const h = harness(); const result = accept(h, 'evidence-1', 'FINAL', { callerStart: start({ executionStartId: 'fake' }) }); assert.equal(result.evidence.executionStartId, 'start-1'); });
  check('corrupt-start-rejected', () => assert.equal(accept(harness({ startRecord: start({ singleAuthoritativeStart: false }) })).outcome, 'RESULT_EVIDENCE_INVALID'));
  check('effect-capable-branch-rejected-for-evidence', () => assert.equal(accept(harness({ startRecord: start({ effectIdempotencyClass: 'NON_IDEMPOTENT', logicalEffectId: 'effect-1' }) })).outcome, 'BRANCH_MISMATCH'));
  check('effect-capable-branch-rejected-for-acceptance', () => assert.equal(acceptResult(harness({ startRecord: start({ effectIdempotencyClass: 'IDEMPOTENT_WITH_STABLE_KEY', logicalEffectId: 'effect-1' }) })).outcome, 'BRANCH_MISMATCH'));
  check('trusted-source-required', () => assert.equal(accept(harness({ sourceSnapshot: source({ trusted: false }) })).outcome, 'RESULT_EVIDENCE_INVALID'));
  check('source-revision-exact', () => assert.equal(accept(harness(), 'evidence-1', 'FINAL', { expectedSourceRevision: '2' }).outcome, 'RESULT_EVIDENCE_INVALID'));
  check('source-grammar-binding-exact', () => assert.equal(accept(harness({ sourceSnapshot: source({ resultEvidenceGrammarRevision: '2' }) })).outcome, 'RESULT_EVIDENCE_INVALID'));
  check('acquisition-method-registered', () => assert.equal(accept(harness(), 'evidence-1', 'FINAL', { acquisitionMethod: 'CALLER_SELECTED' }).outcome, 'RESULT_EVIDENCE_INVALID'));
  check('frozen-grammar-revision-required', () => assert.equal(accept(harness(), 'evidence-1', 'FINAL', { expectedGrammarRevision: '2' }).outcome, 'RESULT_EVIDENCE_INVALID'));
  check('wrong-start-correlation-rejected', () => assert.equal(accept(harness(), 'evidence-1', 'FINAL', { observation: observation('FINAL', { executionStartId: 'other' }) }).outcome, 'EVIDENCE_NOT_APPLICABLE'));
  check('wrong-attempt-correlation-rejected', () => assert.equal(accept(harness(), 'evidence-1', 'FINAL', { observation: observation('FINAL', { executionAttemptId: 'other' }) }).outcome, 'EVIDENCE_NOT_APPLICABLE'));
  check('replacement-input-rejected', () => assert.equal(accept(harness(), 'evidence-1', 'FINAL', { observation: observation('FINAL', { verifiedInputDigest: 'sha256:other' }) }).outcome, 'EVIDENCE_NOT_APPLICABLE'));
  check('unverified-evidence-rejected', () => assert.equal(accept(harness({ verification: { verified: false } })).outcome, 'RESULT_EVIDENCE_INVALID'));
  check('invalid-evidence-grammar-fails-closed', () => assert.equal(accept(harness(), 'evidence-1', 'OTHER').outcome, 'RESULT_EVIDENCE_INVALID'));
  check('immutable-result-evidence-identity', () => { const result = accept(harness()); assert.equal(result.evidence.resultEvidenceId, 'evidence-1'); assert.equal(result.evidence.authoritativeResult, false); observations.push(result.evidence); });
  check('canonical-evidence-digest-deterministic', () => { const left = accept(harness()).evidence; const right = accept(harness()).evidence; assert.equal(left.canonicalEvidenceDigest, right.canonicalEvidenceDigest); });
  check('exact-evidence-duplicate-deterministic', () => { const h = harness(); const first = accept(h); const second = accept(h); assert.equal(second.outcome, 'RESULT_EVIDENCE_ALREADY_ACCEPTED'); assert.deepEqual(second.evidence, first.evidence); });
  check('same-evidence-id-changed-bytes-rejected', () => { const h = harness(); accept(h); assert.equal(accept(h, 'evidence-1', 'PARTIAL').outcome, 'RESULT_EVIDENCE_REJECTED'); });
  check('cross-start-evidence-id-collision-rejected', () => { const first = harness(); const record = accept(first).evidence; const otherStart = start({ executionStartId: 'start-2', executionAttemptId: 'attempt-2' }); const h = harness({ startRecord: otherStart, ledger: createLedger({ evidenceSeed: [record] }) }); const req = evidenceRequest('evidence-1', 'FINAL', { executionStartId: 'start-2', observation: observation('FINAL', { executionStartId: 'start-2', executionAttemptId: 'attempt-2' }) }); assert.equal(h.component.acceptEvidence(req).outcome, 'RESULT_EVIDENCE_REJECTED'); });
  check('multiple-observations-append-ordinals', () => { const h = harness(); const first = accept(h, 'evidence-1', 'PARTIAL'); const second = accept(h, 'evidence-2', 'FINAL'); assert.deepEqual([first.evidence.evidenceOrdinal, second.evidence.evidenceOrdinal], [1, 2]); });
  check('historical-acquisition-does-not-create-operational-authority', () => { const h = harness(); const result = accept(h, 'evidence-1', 'FINAL', { acquisitionMethod: 'HISTORICAL_IMPORT' }); assert.deepEqual([result.authorityCreated, result.evidence.authorityCreated], [false, false]); });
  check('evidence-response-loss-recovers-same-id', () => assert.equal(accept(harness({ ledger: createLedger({ mode: 'EVIDENCE_STORE_THEN_THROW' }) })).outcome, 'RESULT_EVIDENCE_ALREADY_ACCEPTED'));
  check('evidence-commit-uncertainty-fails-closed', () => { const h = harness({ ledger: createLedger({ mode: 'EVIDENCE_THROW_BEFORE' }) }); assert.equal(accept(h).outcome, 'RESULT_EVIDENCE_UNCERTAIN'); assert.equal(h.ledger.evidence.length, 0); });
  check('corrupt-evidence-commit-return-fails-closed', () => assert.equal(accept(harness({ ledger: createLedger({ mode: 'EVIDENCE_CORRUPT_RETURN' }) })).outcome, 'RESULT_EVIDENCE_UNCERTAIN'));
  check('evidence-acceptance-is-not-result-acceptance', () => { const result = accept(harness()); assert.equal(result.resultAccepted, false); assert.equal(result.evidence.authoritativeResult, false); });

  check('partial-evidence-does-not-satisfy-grammar', () => { const h = harness(); accept(h, 'evidence-1', 'PARTIAL'); assert.equal(acceptResult(h).outcome, 'RESULT_NOT_ACCEPTABLE'); });
  check('exact-evidence-set-required', () => { const h = harness(); accept(h); assert.equal(acceptResult(h, 'acceptance-1', { expectedEvidenceSetRevision: 2 }).outcome, 'EVIDENCE_SET_STALE'); });
  check('exact-evidence-set-digest-required', () => { const h = harness(); accept(h); assert.equal(acceptResult(h, 'acceptance-1', { expectedEvidenceSetDigest: 'sha256:other' }).outcome, 'EVIDENCE_SET_STALE'); });
  check('acceptance-uses-frozen-grammar-revision', () => { const h = harness(); accept(h); assert.equal(acceptResult(h, 'acceptance-1', { expectedGrammarRevision: '2' }).outcome, 'RESULT_GRAMMAR_NOT_FOUND'); });
  check('immutable-result-acceptance-identity', () => { const h = harness(); accept(h); const result = acceptResult(h); assert.equal(result.acceptance.resultAcceptanceId, 'acceptance-1'); observations.push(result.acceptance); });
  check('accepted-result-binds-exact-result-digest', () => { const h = harness(); accept(h); const result = acceptResult(h); assert.deepEqual([result.acceptance.acceptedResultRef, result.acceptance.acceptedResultDigest], ['result:offer-1', 'sha256:result-1']); });
  check('acceptance-binds-canonical-evidence-set', () => { const h = harness(); accept(h); const set = setFor(h.startRecord, h.ledger.evidence); const result = acceptResult(h); assert.deepEqual([result.acceptance.evidenceSetRevision, result.acceptance.evidenceSetDigest], [set.revision, set.digest]); });
  check('exact-acceptance-duplicate-deterministic', () => { const h = harness(); accept(h); const first = acceptResult(h); const second = acceptResult(h); assert.equal(second.outcome, 'RESULT_ALREADY_ACCEPTED'); assert.deepEqual(second.acceptance, first.acceptance); });
  check('same-acceptance-id-different-set-rejected', () => { const h = harness(); accept(h); acceptResult(h); accept(h, 'evidence-2', 'PARTIAL'); assert.equal(acceptResult(h).outcome, 'RESULT_ACCEPTANCE_REJECTED'); });
  check('later-evidence-creates-superseding-acceptance', () => { const h = harness(); accept(h); const first = acceptResult(h).acceptance; accept(h, 'evidence-2', 'PARTIAL'); const second = acceptResult(h, 'acceptance-2').acceptance; assert.equal(second.acceptanceRevision, 2); assert.equal(second.supersedesResultAcceptanceRef, 'acceptance-1'); assert.equal(h.ledger.acceptances[0].acceptedResultDigest, first.acceptedResultDigest); });
  check('acceptance-response-loss-recovers-same-id', () => { const h = harness({ ledger: createLedger({ mode: 'ACCEPTANCE_STORE_THEN_THROW' }) }); accept(h); assert.equal(acceptResult(h).outcome, 'RESULT_ALREADY_ACCEPTED'); });
  check('acceptance-commit-uncertainty-fails-closed', () => { const h = harness({ ledger: createLedger({ mode: 'ACCEPTANCE_THROW_BEFORE' }) }); accept(h); assert.equal(acceptResult(h).outcome, 'RESULT_ACCEPTANCE_UNCERTAIN'); assert.equal(h.ledger.acceptances.length, 0); });
  check('concurrent-evidence-set-change-fails-closed', () => { const h = harness({ ledger: createLedger({ mode: 'ACCEPTANCE_STALE' }) }); accept(h); assert.equal(acceptResult(h).outcome, 'EVIDENCE_SET_STALE'); });
  check('corrupt-acceptance-commit-return-fails-closed', () => { const h = harness({ ledger: createLedger({ mode: 'ACCEPTANCE_CORRUPT_RETURN' }) }); accept(h); assert.equal(acceptResult(h).outcome, 'RESULT_ACCEPTANCE_UNCERTAIN'); });
  check('conflicting-evidence-ledger-fails-closed', () => { const h1 = harness(); const record = accept(h1).evidence; const h = harness({ ledger: createLedger({ evidenceSeed: [record, record] }) }); assert.equal(acceptResult(h).outcome, 'RESULT_ACCEPTANCE_UNCERTAIN'); });
  check('exact-lineage-preserved', () => { const h = harness(); accept(h); const record = acceptResult(h).acceptance; assert.deepEqual([record.executionAttemptId, record.actionIdentity, record.continuationTargetRef, record.authorityScope, record.inputRef, record.verifiedInputDigest], ['attempt-1', 'offer.calculate', 'offer.calculate:offer-1', { offerId: 'offer-1' }, 'input:offer-1', 'sha256:input-1']); });
  check('result-acceptance-is-not-completion-or-success', () => { const h = harness(); accept(h); const result = acceptResult(h); assert.deepEqual([result.executionCompleted, result.executionSuccessful, result.acceptance.executionCompleted, result.acceptance.executionSuccessful], [false, false, false, false]); });
  check('result-acceptance-creates-no-authority', () => { const h = harness(); accept(h); const result = acceptResult(h); assert.deepEqual([result.authorityCreated, result.acceptance.authorityCreated], [false, false]); });
  check('component-exposes-only-two-bounded-operations', () => assert.deepEqual(Object.keys(harness().component), ['acceptEvidence', 'acceptResult']));
  check('evidence-outcome-grammar-exact', () => assert.deepEqual(Object.values(RESULT_EVIDENCE_OUTCOMES).sort(), ['BRANCH_MISMATCH', 'EVIDENCE_NOT_APPLICABLE', 'RESULT_EVIDENCE_ACCEPTED', 'RESULT_EVIDENCE_ALREADY_ACCEPTED', 'RESULT_EVIDENCE_INVALID', 'RESULT_EVIDENCE_REJECTED', 'RESULT_EVIDENCE_UNCERTAIN', 'START_NOT_FOUND']));
  check('acceptance-outcome-grammar-exact', () => assert.deepEqual(Object.values(RESULT_ACCEPTANCE_OUTCOMES).sort(), ['BRANCH_MISMATCH', 'EVIDENCE_SET_STALE', 'RESULT_ACCEPTANCE_REJECTED', 'RESULT_ACCEPTANCE_UNCERTAIN', 'RESULT_ACCEPTED', 'RESULT_ALREADY_ACCEPTED', 'RESULT_GRAMMAR_NOT_FOUND', 'RESULT_NOT_ACCEPTABLE', 'START_NOT_FOUND']));
  check('required-ports-validated', () => assert.throws(() => createGovernedEffectFreeResultAcceptance({}), TypeError));
  check('no-provider-executor-product-effect-completion-operations', () => { const h = harness(); accept(h); acceptResult(h); assert.deepEqual([h.calls.provider, h.calls.executor, h.calls.product, h.calls.effect, h.calls.completion, h.calls.authority], [0, 0, 0, 0, 0, 0]); });
  check('equivalent-complete-runs-are-deterministic', () => { const left = harness(); const right = harness(); const le = accept(left); const re = accept(right); const la = acceptResult(left); const ra = acceptResult(right); assert.deepEqual([le, la], [re, ra]); observations.push(le.evidence, la.acceptance); });

  const canonical = canonicalStringify({ cases, observations,
    evidenceOutcomes: Object.values(RESULT_EVIDENCE_OUTCOMES),
    acceptanceOutcomes: Object.values(RESULT_ACCEPTANCE_OUTCOMES) });
  return { cases, canonical,
    hash: crypto.createHash('sha256').update(canonical).digest('hex') };
}

const first = runSuite(); const second = runSuite();
assert.equal(first.canonical, second.canonical);
console.log(canonicalStringify({ suite: 'governed-effect-free-result-acceptance-v0',
  status: 'PASS', cases: first.cases.length, deterministic: true, hash: first.hash }));
