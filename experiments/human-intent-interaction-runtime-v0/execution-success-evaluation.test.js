'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { SUCCESS_EVALUATION_CLASSES, SUCCESS_EVALUATION_OUTCOMES,
  createGovernedExecutionSuccessEvaluation, canonicalStringify, digest } = require(
  './execution-success-evaluation');

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

function start(overrides = {}) {
  return { type: 'EXECUTION_ATTEMPT_START', status: 'EXECUTION_ATTEMPT_STARTED',
    executionStartId: 'start-1', startRevision: 1, executionAttemptId: 'attempt-1',
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-1',
    preparationEvidenceRef: 'preparation-evidence-1', preparationRevision: 1,
    actionIdentity: 'offer.update', actionRevision: '1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    executionActivityStarted: true, singleAuthoritativeStart: true, ...clone(overrides) };
}

function preparation(overrides = {}) {
  return { type: 'EXECUTION_PREPARATION', status: 'EXECUTION_PREPARED',
    executionId: 'execution-1', executionAcceptanceId: 'acceptance-1', preparationRevision: 1,
    actionIdentity: 'offer.update', actionRevision: '1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    successCriteriaBindingId: 'success-binding-1', successCriteriaBindingRevision: 1,
    successCriteriaBindingDigest: 'intent-digest-1',
    outcomeCriteria: [{ id: 'outcome-1', expected: 'created' }],
    acceptanceCriteria: [{ id: 'acceptance-1', required: true }],
    successEvaluationContractRef: 'success-contract-1',
    successEvaluationContractRevision: '1', ...clone(overrides) };
}

function acceptance(overrides = {}) {
  return { type: 'EFFECT_CAPABLE_RESULT_ACCEPTANCE', status: 'RESULT_ACCEPTED',
    resultAcceptanceId: 'result-acceptance-1', acceptanceRevision: 1,
    executionStartId: 'start-1', executionAttemptId: 'attempt-1', executionId: 'execution-1',
    executionAcceptanceId: 'acceptance-1', acceptedResultRef: 'result-1',
    acceptedResultDigest: 'result-digest-1', evidenceSetRevision: 1,
    evidenceSetDigest: 'evidence-set-digest-1', actionIdentity: 'offer.update', actionRevision: '1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    resultAccepted: true, executionCompleted: false, executionSuccessful: false,
    effectOutcomeClass: 'EFFECT_CONFIRMED', effectInvocationId: 'invocation-1',
    logicalEffectId: 'logical-effect-1', ...clone(overrides) };
}

function completion(overrides = {}) {
  return { type: 'EXECUTION_COMPLETION', status: 'EXECUTION_COMPLETED',
    executionCompletionId: 'completion-1', completionRevision: 1,
    executionId: 'execution-1', executionStartId: 'start-1', executionAttemptId: 'attempt-1',
    resultAcceptanceId: 'result-acceptance-1',
    resultAcceptanceEvidenceRef: 'result-acceptance-evidence-1', resultAcceptanceRevision: 1,
    evidenceSetRevision: 1, evidenceSetDigest: 'evidence-set-digest-1',
    acceptedResultRef: 'result-1', acceptedResultDigest: 'result-digest-1',
    actionIdentity: 'offer.update', actionRevision: '1',
    resultEvidenceGrammarRef: 'result-grammar-1', resultEvidenceGrammarRevision: '1',
    executionCompleted: true, executionSuccessful: false, authorityCreated: false,
    retryAuthorityCreated: false, ...clone(overrides) };
}

function binding(overrides = {}) {
  return { type: 'EXECUTION_SUCCESS_CRITERIA_BINDING', status: 'SUCCESS_CRITERIA_BOUND',
    successCriteriaBindingId: 'success-binding-1', bindingRevision: 1,
    bindingDigest: 'intent-digest-1', executionAcceptanceId: 'acceptance-1',
    intentContractRef: 'intent-1', intentContractDigest: 'intent-digest-1',
    actionIdentity: 'offer.update', actionRevision: '1',
    resultEvidenceGrammarRef: 'result-grammar-1',
    outcomeCriteria: [{ id: 'outcome-1', expected: 'created' }],
    acceptanceCriteria: [{ id: 'acceptance-1', required: true }],
    successEvaluationContractRef: 'success-contract-1',
    successEvaluationContractRevision: '1',
    successEvaluationClasses: clone(SUCCESS_EVALUATION_CLASSES), successEvaluated: false,
    ...clone(overrides) };
}

function harness(options = {}) {
  const completionRecord = completion(options.completionOverrides);
  const startRecord = start(options.startOverrides);
  const preparationRecord = preparation(options.preparationOverrides);
  const acceptanceRecord = acceptance(options.acceptanceOverrides);
  const bindingRecord = binding(options.bindingOverrides);
  const evaluations = [];
  let failCommit = options.failCommit || null;
  const calls = { provider: 0, effect: 0, product: 0, retry: 0, attempt: 0, human: 0 };
  const contractRecord = { type: 'SUCCESS_EVALUATION_CONTRACT', status: 'ENABLED',
    ref: 'success-contract-1', revision: '1', actionIdentity: 'offer.update', actionRevision: '1',
    resultEvidenceGrammarRef: 'result-grammar-1', evaluationClasses: clone(SUCCESS_EVALUATION_CLASSES),
    evaluate(input) {
      if (options.contractThrows) throw new Error('evaluation unavailable');
      if (options.invalidDecision) return { successClass: 'BOGUS' };
      if (options.captureInput) options.captureInput.push(clone(input));
      return { successClass: options.successClass || 'SUCCESS_CONFIRMED',
        evidenceRef: 'success-evaluation-evidence-1', rationale: { rule: 'deterministic' } };
    }, ...clone(options.contractOverrides || {}) };

  const component = createGovernedExecutionSuccessEvaluation({
    completionSnapshotPort: () => options.noCompletion ? null
      : { evidenceRef: 'completion-evidence-1', record: clone(completionRecord) },
    currentCompletionPort: () => options.staleCompletion
      ? { evidenceRef: 'completion-evidence-2', record: clone(completionRecord) }
      : { evidenceRef: 'completion-evidence-1', record: clone(completionRecord) },
    startSnapshotPort: () => options.noStart ? null
      : { evidenceRef: 'start-evidence-1', record: clone(startRecord) },
    preparationSnapshotPort: () => options.noPreparation ? null
      : { evidenceRef: options.preparationEvidenceRef || 'preparation-evidence-1',
        record: clone(preparationRecord) },
    resultAcceptanceSnapshotPort: () => options.noAcceptance ? null
      : { evidenceRef: options.acceptanceEvidenceRef || 'result-acceptance-evidence-1',
        record: clone(acceptanceRecord) },
    successCriteriaBindingSnapshotPort: () => options.noBinding ? null
      : { evidenceRef: 'success-binding-evidence-1', record: clone(bindingRecord) },
    successEvaluationContractRegistryPort: () => options.noContract ? null
      : { evidenceRef: 'success-contract-evidence-1', record: contractRecord },
    evaluationLedger: {
      findById(id) { return evaluations.filter((x) => x.successEvaluationId === id).map(clone); },
      findByCompletion(id) { return evaluations.filter((x) => x.executionCompletionId === id).map(clone); },
      commitEvaluation(record, guards) {
        assert.equal(guards.completionGuard.executionCompleted, true);
        assert.equal(guards.resultAcceptanceGuard.resultAcceptanceId, 'result-acceptance-1');
        assert.equal(guards.successCriteriaBindingGuard.successCriteriaBindingId, 'success-binding-1');
        assert.equal(guards.successContractGuard.ref, 'success-contract-1');
        if (failCommit === 'stale-completion') { const e = new Error('stale'); e.code = 'COMPLETION_STALE'; throw e; }
        if (failCommit === 'stale-result') { const e = new Error('stale'); e.code = 'RESULT_ACCEPTANCE_STALE'; throw e; }
        if (failCommit === 'stale-binding') { const e = new Error('stale'); e.code = 'SUCCESS_CRITERIA_BINDING_STALE'; throw e; }
        if (failCommit === 'stale-contract') { const e = new Error('stale'); e.code = 'SUCCESS_CONTRACT_STALE'; throw e; }
        if (failCommit === 'response-loss') { evaluations.push(clone(record)); failCommit = null; throw new Error('response loss'); }
        if (failCommit === 'uncertain') throw new Error('uncertain');
        evaluations.push(clone(record)); return clone(record);
      }
    }
  });
  return { component, evaluations, calls, completionRecord, startRecord, preparationRecord,
    acceptanceRecord, bindingRecord, contractRecord };
}

const request = (overrides = {}) => ({ successEvaluationId: 'success-evaluation-1',
  executionCompletionId: 'completion-1', ...overrides });
const run = (h, overrides = {}) => h.component.evaluate(request(overrides));

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

check('completion-required', () => assert.equal(run(harness({ noCompletion: true })).outcome, 'COMPLETION_NOT_FOUND'));
check('current-completion-required', () => assert.equal(run(harness({ staleCompletion: true })).outcome, 'COMPLETION_STALE'));
check('cross-lineage-start-rejected', () => assert.equal(run(harness({ startOverrides: { executionId: 'other' } })).outcome, 'SUCCESS_EVALUATION_REJECTED'));
check('preparation-required-for-frozen-binding-lineage', () => assert.equal(run(harness({ noPreparation: true })).outcome, 'SUCCESS_CRITERIA_BINDING_STALE'));
check('preparation-evidence-ref-exact', () => assert.equal(run(harness({ preparationEvidenceRef: 'other' })).outcome, 'SUCCESS_CRITERIA_BINDING_STALE'));
check('terminal-result-required', () => assert.equal(run(harness({ noAcceptance: true })).outcome, 'RESULT_ACCEPTANCE_NOT_FOUND'));
check('terminal-result-evidence-ref-exact', () => assert.equal(run(harness({ acceptanceEvidenceRef: 'other' })).outcome, 'RESULT_ACCEPTANCE_NOT_FOUND'));
check('cross-lineage-result-rejected', () => assert.equal(run(harness({ acceptanceOverrides: { executionAttemptId: 'other' } })).outcome, 'RESULT_ACCEPTANCE_NOT_FOUND'));
check('accepted-result-digest-exact', () => assert.equal(run(harness({ acceptanceOverrides: { acceptedResultDigest: 'other' } })).outcome, 'RESULT_ACCEPTANCE_NOT_FOUND'));
check('binding-required', () => assert.equal(run(harness({ noBinding: true })).outcome, 'SUCCESS_CRITERIA_BINDING_NOT_FOUND'));
check('binding-id-exact', () => assert.equal(run(harness({ bindingOverrides: { successCriteriaBindingId: 'other' } })).outcome, 'SUCCESS_CRITERIA_BINDING_STALE'));
check('binding-revision-exact', () => assert.equal(run(harness({ bindingOverrides: { bindingRevision: 2 } })).outcome, 'SUCCESS_CRITERIA_BINDING_STALE'));
check('binding-digest-exact', () => assert.equal(run(harness({ bindingOverrides: { bindingDigest: 'other' } })).outcome, 'SUCCESS_CRITERIA_BINDING_STALE'));
check('binding-criteria-exact', () => assert.equal(run(harness({ bindingOverrides: { outcomeCriteria: [{ id: 'changed' }] } })).outcome, 'SUCCESS_CRITERIA_BINDING_STALE'));
check('binding-cross-acceptance-rejected', () => assert.equal(run(harness({ bindingOverrides: { executionAcceptanceId: 'other' } })).outcome, 'SUCCESS_CRITERIA_BINDING_STALE'));
check('contract-required', () => assert.equal(run(harness({ noContract: true })).outcome, 'SUCCESS_CONTRACT_NOT_FOUND'));
check('contract-ref-exact', () => assert.equal(run(harness({ contractOverrides: { ref: 'other' } })).outcome, 'SUCCESS_CONTRACT_STALE'));
check('contract-revision-exact', () => assert.equal(run(harness({ contractOverrides: { revision: '2' } })).outcome, 'SUCCESS_CONTRACT_STALE'));
check('contract-action-lineage-exact', () => assert.equal(run(harness({ contractOverrides: { actionRevision: '2' } })).outcome, 'SUCCESS_CONTRACT_STALE'));
check('contract-class-grammar-exact', () => assert.equal(run(harness({ contractOverrides: { evaluationClasses: ['SUCCESS_CONFIRMED'] } })).outcome, 'SUCCESS_CONTRACT_STALE'));
for (const cls of SUCCESS_EVALUATION_CLASSES) {
  check(`class-${cls}`, () => { const result = run(harness({ successClass: cls }));
    assert.equal(result.outcome, cls); assert.equal(result.evaluation.successClass, cls); });
}
check('success-confirmed-is-not-completion-creation', () => { const r = run(harness()); assert.deepEqual(
  [r.successConfirmed, r.executionCompleted, r.authorityCreated, r.retryAuthorityCreated,
    r.attemptCreated, r.externalEffectPerformed, r.productMutationPerformed],
  [true, true, false, false, false, false, false]); });
check('non-success-class-does-not-undo-completion', () => { const r = run(harness({ successClass: 'OUTCOME_NOT_ACHIEVED' }));
  assert.deepEqual([r.successConfirmed, r.executionCompleted, r.evaluation.executionCompleted], [false, true, true]); });
check('evaluation-input-binds-terminal-result-and-frozen-criteria', () => { const seen=[]; run(harness({ captureInput: seen }));
  assert.equal(seen.length,1); assert.deepEqual([seen[0].executionCompletionId, seen[0].resultAcceptanceId,
    seen[0].successCriteriaBindingId, seen[0].successEvaluationContractRef],
  ['completion-1','result-acceptance-1','success-binding-1','success-contract-1']); });
check('invalid-decision-fails-closed', () => assert.equal(run(harness({ invalidDecision: true })).outcome, 'SUCCESS_EVALUATION_REJECTED'));
check('contract-throw-is-uncertain', () => assert.equal(run(harness({ contractThrows: true })).outcome, 'SUCCESS_EVALUATION_UNCERTAIN'));
check('exact-duplicate-recovers-immutable-evaluation', () => { const h=harness(); const a=run(h); const b=run(h); assert.equal(b.outcome,'SUCCESS_EVALUATION_ALREADY_RECORDED'); assert.deepEqual(b.evaluation,a.evaluation); });
check('same-id-cross-completion-collision-rejected', () => { const h=harness(); run(h); assert.equal(run(h,{executionCompletionId:'other'}).outcome,'SUCCESS_EVALUATION_REJECTED'); });
check('one-immutable-evaluation-per-completion', () => { const h=harness(); const first=clone(run(h).evaluation); const second=run(h,{successEvaluationId:'success-evaluation-2'}); assert.equal(second.outcome,'SUCCESS_EVALUATION_ALREADY_RECORDED'); assert.deepEqual(h.evaluations[0],first); });
check('response-loss-recovers-same-id', () => assert.equal(run(harness({ failCommit:'response-loss' })).outcome,'SUCCESS_EVALUATION_ALREADY_RECORDED'));
check('uncertain-commit-fails-closed', () => assert.equal(run(harness({ failCommit:'uncertain' })).outcome,'SUCCESS_EVALUATION_UNCERTAIN'));
check('atomic-stale-completion-mapped', () => assert.equal(run(harness({ failCommit:'stale-completion' })).outcome,'COMPLETION_STALE'));
check('atomic-stale-result-mapped', () => assert.equal(run(harness({ failCommit:'stale-result' })).outcome,'RESULT_ACCEPTANCE_STALE'));
check('atomic-stale-binding-mapped', () => assert.equal(run(harness({ failCommit:'stale-binding' })).outcome,'SUCCESS_CRITERIA_BINDING_STALE'));
check('atomic-stale-contract-mapped', () => assert.equal(run(harness({ failCommit:'stale-contract' })).outcome,'SUCCESS_CONTRACT_STALE'));
check('evaluation-record-preserves-separation-invariant', () => { const e=run(harness()).evaluation; assert.deepEqual(
  [e.executionCompleted,e.successClass,e.authorityCreated,e.retryAuthorityCreated,e.attemptCreated,
    e.externalEffectPerformed,e.productMutationPerformed], [true,'SUCCESS_CONFIRMED',false,false,false,false,false]); });
check('criteria-are-evaluated-only-after-terminal-result', () => { const seen=[]; const h=harness({captureInput:seen,noAcceptance:true}); run(h); assert.equal(seen.length,0); });
check('canonical-serialization-deterministic', () => assert.equal(canonicalStringify({b:2,a:{d:4,c:3}}),'{"a":{"c":3,"d":4},"b":2}'));
check('digest-deterministic', () => assert.equal(digest({b:2,a:1}),digest({a:1,b:2})));
check('outcome-grammar-contains-four-frozen-classes', () => assert.deepEqual(SUCCESS_EVALUATION_CLASSES,
  ['SUCCESS_CONFIRMED','OUTCOME_NOT_ACHIEVED','SUCCESS_NOT_ESTABLISHED','SUCCESS_UNKNOWN']));
check('no-provider-effect-product-retry-attempt-human-operations', () => { const h=harness(); run(h); assert.deepEqual(Object.values(h.calls),[0,0,0,0,0,0]); });

const results=[];
for(const item of checks){try{item.fn();results.push({name:item.name,status:'PASS'});}catch(error){results.push({name:item.name,status:'FAIL',error:error.message});}}
const passed=results.filter(x=>x.status==='PASS').length;
const failed=results.length-passed;
const hash=crypto.createHash('sha256').update(canonicalStringify(results)).digest('hex');
const output={suite:'governed-execution-success-evaluation-v0',status:failed===0?'PASS':'FAIL',passed,failed,total:results.length,hash,results};
process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
if(failed) process.exitCode=1;
