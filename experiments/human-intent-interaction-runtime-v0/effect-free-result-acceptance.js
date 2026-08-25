'use strict';

const crypto = require('node:crypto');

const RESULT_EVIDENCE_OUTCOMES = Object.freeze({
  RESULT_EVIDENCE_ACCEPTED: 'RESULT_EVIDENCE_ACCEPTED',
  RESULT_EVIDENCE_ALREADY_ACCEPTED: 'RESULT_EVIDENCE_ALREADY_ACCEPTED',
  START_NOT_FOUND: 'START_NOT_FOUND',
  BRANCH_MISMATCH: 'BRANCH_MISMATCH',
  EVIDENCE_NOT_APPLICABLE: 'EVIDENCE_NOT_APPLICABLE',
  RESULT_EVIDENCE_INVALID: 'RESULT_EVIDENCE_INVALID',
  RESULT_EVIDENCE_REJECTED: 'RESULT_EVIDENCE_REJECTED',
  RESULT_EVIDENCE_UNCERTAIN: 'RESULT_EVIDENCE_UNCERTAIN'
});

const RESULT_ACCEPTANCE_OUTCOMES = Object.freeze({
  RESULT_ACCEPTED: 'RESULT_ACCEPTED',
  RESULT_ALREADY_ACCEPTED: 'RESULT_ALREADY_ACCEPTED',
  START_NOT_FOUND: 'START_NOT_FOUND',
  BRANCH_MISMATCH: 'BRANCH_MISMATCH',
  EVIDENCE_SET_STALE: 'EVIDENCE_SET_STALE',
  RESULT_GRAMMAR_NOT_FOUND: 'RESULT_GRAMMAR_NOT_FOUND',
  RESULT_NOT_ACCEPTABLE: 'RESULT_NOT_ACCEPTABLE',
  RESULT_ACCEPTANCE_REJECTED: 'RESULT_ACCEPTANCE_REJECTED',
  RESULT_ACCEPTANCE_UNCERTAIN: 'RESULT_ACCEPTANCE_UNCERTAIN'
});

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function evidenceResult(outcome, reason = null, evidence = null) {
  return Object.freeze({ outcome, reason, evidence: clone(evidence), resultAccepted: false,
    executionCompleted: false, authorityCreated: false });
}

function acceptanceResult(outcome, reason = null, acceptance = null) {
  return Object.freeze({ outcome, reason, acceptance: clone(acceptance),
    executionCompleted: false, executionSuccessful: false, authorityCreated: false });
}

function coherentStartSnapshot(snapshot, expectedStartId) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
  const required = ['executionStartId', 'executionAttemptId', 'attemptClaimId',
    'executionId', 'executionAcceptanceId', 'dispatchId', 'continuationId',
    'interactionId', 'gateId', 'authorityEvidenceRef', 'governanceEvaluationRef',
    'adapterRegistrationIdentity', 'adapterRegistrationRevision', 'adapterIdentity',
    'adapterRevision', 'attemptOwnerIdentity', 'actionIdentity', 'actionRevision',
    'continuationTargetRef', 'executionOwnerIdentity', 'inputRef', 'verifiedInputDigest',
    'verifiedInputEvidenceRef', 'effectContractRef', 'effectContractRevision',
    'effectIdempotencyClass', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision'];
  if (record.type !== 'EXECUTION_ATTEMPT_START'
    || record.status !== 'EXECUTION_ATTEMPT_STARTED'
    || record.executionStartId !== expectedStartId
    || record.executionActivityStarted !== true
    || record.singleAuthoritativeStart !== true
    || !Number.isInteger(record.startRevision)
    || !Number.isInteger(record.attemptRevision)
    || !Number.isInteger(record.claimRevision)
    || record.authorityScope === undefined
    || required.some((key) => !nonEmptyString(record[key]))) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentSource(snapshot, request, start) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
  if (record.type !== 'RESULT_EVIDENCE_SOURCE_REGISTRATION'
    || record.status !== 'ENABLED' || record.trusted !== true
    || record.sourceIdentity !== request.sourceIdentity
    || record.sourceRevision !== request.expectedSourceRevision
    || record.resultEvidenceGrammarRef !== start.resultEvidenceGrammarRef
    || record.resultEvidenceGrammarRevision !== start.resultEvidenceGrammarRevision
    || !Array.isArray(record.acquisitionMethods)
    || !record.acquisitionMethods.includes(request.acquisitionMethod)
    || record.correlationMode !== 'EXACT_START_ATTEMPT_AND_INPUT') return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentGrammar(grammar, start, expectedRevision) {
  return Boolean(grammar && grammar.ref === start.resultEvidenceGrammarRef
    && grammar.revision === start.resultEvidenceGrammarRevision
    && grammar.revision === expectedRevision
    && typeof grammar.classifyAndCanonicalize === 'function'
    && typeof grammar.evaluateEvidenceSet === 'function');
}

function coherentEvidence(record) {
  const required = ['resultEvidenceId', 'executionStartId', 'startEvidenceRef',
    'executionAttemptId', 'executionId', 'actionIdentity', 'actionRevision',
    'continuationTargetRef', 'inputRef', 'verifiedInputDigest', 'effectContractRef',
    'effectContractRevision', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision', 'sourceIdentity', 'sourceRevision',
    'sourceEvidenceRef', 'verificationEvidenceRef', 'canonicalEvidenceDigest',
    'evidenceClass'];
  return Boolean(record && record.type === 'EFFECT_FREE_RESULT_EVIDENCE'
    && record.status === 'RESULT_EVIDENCE_ACCEPTED'
    && Number.isInteger(record.evidenceRevision)
    && Number.isInteger(record.evidenceOrdinal)
    && record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
    && record.logicalEffectId === null
    && record.authoritativeResult === false
    && record.executionCompleted === false
    && required.every((key) => nonEmptyString(record[key])));
}

function evidenceSetFor(start, records, grammar) {
  if (!Array.isArray(records) || records.some((item) => !coherentEvidence(item)
    || item.executionStartId !== start.executionStartId
    || item.executionAttemptId !== start.executionAttemptId
    || item.verifiedInputDigest !== start.verifiedInputDigest
    || item.resultEvidenceGrammarRef !== grammar.ref
    || item.resultEvidenceGrammarRevision !== grammar.revision)) return null;
  const ordered = records.map(clone).sort((a, b) => a.evidenceOrdinal - b.evidenceOrdinal
    || a.resultEvidenceId.localeCompare(b.resultEvidenceId));
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index].evidenceOrdinal !== index + 1) return null;
  }
  const binding = { executionStartId: start.executionStartId,
    startRevision: start.startRevision, executionAttemptId: start.executionAttemptId,
    resultEvidenceGrammarRef: grammar.ref, resultEvidenceGrammarRevision: grammar.revision,
    evidence: ordered.map((item) => ({ resultEvidenceId: item.resultEvidenceId,
      evidenceRevision: item.evidenceRevision, evidenceOrdinal: item.evidenceOrdinal,
      canonicalEvidenceDigest: item.canonicalEvidenceDigest })) };
  return Object.freeze({ records: ordered, revision: ordered.length,
    digest: sha256(canonicalStringify(binding)), binding: Object.freeze(binding) });
}

function coherentAcceptance(record) {
  const required = ['resultAcceptanceId', 'executionStartId', 'startEvidenceRef',
    'executionAttemptId', 'executionId', 'actionIdentity', 'actionRevision',
    'continuationTargetRef', 'inputRef', 'verifiedInputDigest', 'effectContractRef',
    'effectContractRevision', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision', 'evidenceSetDigest', 'acceptedResultRef',
    'acceptedResultDigest'];
  return Boolean(record && record.type === 'EFFECT_FREE_RESULT_ACCEPTANCE'
    && record.status === 'RESULT_ACCEPTED'
    && Number.isInteger(record.acceptanceRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
    && record.logicalEffectId === null
    && record.resultAccepted === true
    && record.executionCompleted === false
    && record.executionSuccessful === false
    && required.every((key) => nonEmptyString(record[key])));
}

function createGovernedEffectFreeResultAcceptance({ startSnapshotPort,
  resultEvidenceSourceRegistryPort, resultEvidenceGrammarRegistryPort,
  resultEvidenceVerifierPort, resultLedger }) {
  for (const [name, port] of Object.entries({ startSnapshotPort,
    resultEvidenceSourceRegistryPort, resultEvidenceGrammarRegistryPort,
    resultEvidenceVerifierPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  const requiredLedger = ['findEvidenceById', 'listEvidenceForStart',
    'commitEvidence', 'findAcceptanceById', 'findCurrentAcceptanceForStart',
    'commitAcceptance'];
  if (!resultLedger || !requiredLedger.every((name) => typeof resultLedger[name] === 'function')) {
    throw new TypeError(`resultLedger must implement ${requiredLedger.join(', ')}`);
  }

  function resolveStart(startId, missingOutcome, invalidOutcome) {
    let raw;
    try { raw = startSnapshotPort(startId); } catch (_) {
      return { failure: { uncertain: true, reason: 'authoritative Start is unavailable' } };
    }
    if (raw === null || raw === undefined) return { failure: { outcome: missingOutcome,
      reason: 'authoritative EXECUTION_ATTEMPT_STARTED is absent' } };
    const snapshot = coherentStartSnapshot(raw, startId);
    if (!snapshot) return { failure: { outcome: invalidOutcome,
      reason: 'authoritative Start is invalid or incoherent' } };
    if (snapshot.record.effectIdempotencyClass !== 'NO_EXTERNAL_EFFECT'
      || snapshot.record.logicalEffectId !== null) return { failure: {
      outcome: 'BRANCH_MISMATCH', reason: 'only NO_EXTERNAL_EFFECT may enter this branch' } };
    return { snapshot, start: snapshot.record };
  }

  function acceptEvidence(request = {}) {
    const strings = ['resultEvidenceId', 'executionStartId', 'sourceIdentity',
      'expectedSourceRevision', 'expectedGrammarRevision', 'acquisitionMethod'];
    if (strings.some((key) => !nonEmptyString(request[key]))
      || !request.observation || typeof request.observation !== 'object'
      || !request.provenance || typeof request.provenance !== 'object') {
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_REJECTED,
        'evidence identity, Start, source revisions, observation and provenance are required');
    }
    const resolved = resolveStart(request.executionStartId,
      RESULT_EVIDENCE_OUTCOMES.START_NOT_FOUND,
      RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_INVALID);
    if (resolved.failure) return evidenceResult(resolved.failure.uncertain
      ? RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_UNCERTAIN : resolved.failure.outcome,
    resolved.failure.reason);
    const { snapshot, start } = resolved;

    let rawSource;
    let grammar;
    try {
      rawSource = resultEvidenceSourceRegistryPort(request.sourceIdentity,
        request.expectedSourceRevision);
      grammar = resultEvidenceGrammarRegistryPort(start.resultEvidenceGrammarRef,
        request.expectedGrammarRevision);
    } catch (_) {
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_UNCERTAIN,
        'result source or grammar registry is unavailable');
    }
    const source = coherentSource(rawSource, request, start);
    if (!source || !coherentGrammar(grammar, start, request.expectedGrammarRevision)) {
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_INVALID,
        'result evidence source or frozen grammar is untrusted, incompatible or stale');
    }
    let classified;
    try { classified = grammar.classifyAndCanonicalize(clone(request.observation)); } catch (_) {
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_INVALID,
        'result observation cannot be classified or canonicalized');
    }
    if (!classified || !nonEmptyString(classified.evidenceClass)
      || !nonEmptyString(classified.canonicalBytes)) return evidenceResult(
      RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_INVALID,
      'result grammar returned invalid evidence classification');
    if (request.observation.executionStartId !== start.executionStartId
      || request.observation.executionAttemptId !== start.executionAttemptId
      || request.observation.inputRef !== start.inputRef
      || request.observation.verifiedInputDigest !== start.verifiedInputDigest) {
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.EVIDENCE_NOT_APPLICABLE,
        'observation does not correlate to the exact Start, attempt and immutable input');
    }
    let verification;
    try { verification = resultEvidenceVerifierPort(Object.freeze({ start: clone(start),
      source: clone(source.record), observation: clone(request.observation),
      provenance: clone(request.provenance), canonicalBytes: classified.canonicalBytes })); } catch (_) {
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_UNCERTAIN,
        'result evidence verification is unavailable');
    }
    if (!verification || verification.verified !== true
      || !nonEmptyString(verification.evidenceRef)) return evidenceResult(
      RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_INVALID,
      'result evidence authenticity or provenance is not verified');

    let byId;
    let evidence;
    try {
      byId = resultLedger.findEvidenceById(request.resultEvidenceId);
      evidence = resultLedger.listEvidenceForStart(start.executionStartId);
    } catch (_) {
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_UNCERTAIN,
        'result evidence ledger is unavailable');
    }
    if (!Array.isArray(byId) || byId.length > 1 || !Array.isArray(evidence)) {
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_UNCERTAIN,
        'result evidence ledger is conflicting or corrupt');
    }
    const priorSet = evidenceSetFor(start, evidence, grammar);
    if (!priorSet) return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_UNCERTAIN,
      'existing result evidence history is conflicting or corrupt');
    const canonicalEvidenceDigest = sha256(canonicalStringify({
      sourceIdentity: source.record.sourceIdentity, sourceRevision: source.record.sourceRevision,
      grammarRef: grammar.ref, grammarRevision: grammar.revision,
      acquisitionMethod: request.acquisitionMethod, canonicalBytes: classified.canonicalBytes,
      provenance: request.provenance, verificationEvidenceRef: verification.evidenceRef }));
    const record = Object.freeze({ type: 'EFFECT_FREE_RESULT_EVIDENCE',
      status: 'RESULT_EVIDENCE_ACCEPTED', resultEvidenceId: request.resultEvidenceId,
      evidenceRevision: 1, evidenceOrdinal: byId.length === 1
        ? byId[0].evidenceOrdinal : priorSet.revision + 1,
      executionStartId: start.executionStartId, startEvidenceRef: snapshot.evidenceRef,
      startRevision: start.startRevision, executionAttemptId: start.executionAttemptId,
      attemptClaimId: start.attemptClaimId, executionId: start.executionId,
      executionAcceptanceId: start.executionAcceptanceId, dispatchId: start.dispatchId,
      continuationId: start.continuationId, interactionId: start.interactionId,
      gateId: start.gateId, authorityScope: clone(start.authorityScope),
      actionIdentity: start.actionIdentity, actionRevision: start.actionRevision,
      continuationTargetRef: start.continuationTargetRef,
      executionOwnerIdentity: start.executionOwnerIdentity, inputRef: start.inputRef,
      verifiedInputDigest: start.verifiedInputDigest,
      verifiedInputEvidenceRef: start.verifiedInputEvidenceRef,
      effectContractRef: start.effectContractRef,
      effectContractRevision: start.effectContractRevision,
      effectIdempotencyClass: start.effectIdempotencyClass, logicalEffectId: null,
      resultEvidenceGrammarRef: grammar.ref, resultEvidenceGrammarRevision: grammar.revision,
      sourceIdentity: source.record.sourceIdentity, sourceRevision: source.record.sourceRevision,
      sourceEvidenceRef: source.evidenceRef, acquisitionMethod: request.acquisitionMethod,
      provenance: clone(request.provenance), evidenceClass: classified.evidenceClass,
      canonicalEvidenceDigest, verificationEvidenceRef: verification.evidenceRef,
      authoritativeResult: false, executionCompleted: false, authorityCreated: false });
    if (byId.length === 1) {
      return coherentEvidence(byId[0]) && sameValue(byId[0], record)
        ? evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_ALREADY_ACCEPTED,
          null, byId[0])
        : evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_REJECTED,
          'result evidence identity is already bound differently');
    }
    const guards = Object.freeze({ startEvidenceRef: snapshot.evidenceRef,
      startRevision: start.startRevision, effectIdempotencyClass: 'NO_EXTERNAL_EFFECT',
      expectedEvidenceSetRevision: priorSet.revision,
      expectedEvidenceSetDigest: priorSet.digest,
      sourceIdentity: source.record.sourceIdentity, sourceRevision: source.record.sourceRevision,
      resultEvidenceGrammarRef: grammar.ref, resultEvidenceGrammarRevision: grammar.revision,
      exactCorrelation: true, uniqueResultEvidenceId: true });
    try {
      const committed = resultLedger.commitEvidence(clone(record), guards);
      return coherentEvidence(committed) && sameValue(committed, record)
        ? evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_ACCEPTED, null, committed)
        : evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_UNCERTAIN,
          'ledger returned inconsistent result evidence');
    } catch (_) {
      let recovered = [];
      try { recovered = resultLedger.findEvidenceById(request.resultEvidenceId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentEvidence(recovered[0]) && sameValue(recovered[0], record)) {
        return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_ALREADY_ACCEPTED,
          'result evidence recovered after response loss', recovered[0]);
      }
      return evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_UNCERTAIN,
        'atomic result evidence persistence failed or is uncertain');
    }
  }

  function acceptResult(request = {}) {
    const strings = ['resultAcceptanceId', 'executionStartId', 'expectedGrammarRevision',
      'expectedEvidenceSetDigest'];
    if (strings.some((key) => !nonEmptyString(request[key]))
      || !Number.isInteger(request.expectedEvidenceSetRevision)) return acceptanceResult(
      RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_REJECTED,
      'acceptance identity, Start, grammar and evidence-set expectations are required');
    const resolved = resolveStart(request.executionStartId,
      RESULT_ACCEPTANCE_OUTCOMES.START_NOT_FOUND,
      RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_REJECTED);
    if (resolved.failure) return acceptanceResult(resolved.failure.uncertain
      ? RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN : resolved.failure.outcome,
    resolved.failure.reason);
    const { snapshot, start } = resolved;
    let grammar;
    try { grammar = resultEvidenceGrammarRegistryPort(start.resultEvidenceGrammarRef,
      request.expectedGrammarRevision); } catch (_) {
      return acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN,
        'result grammar registry is unavailable');
    }
    if (!coherentGrammar(grammar, start, request.expectedGrammarRevision)) return acceptanceResult(
      RESULT_ACCEPTANCE_OUTCOMES.RESULT_GRAMMAR_NOT_FOUND,
      'exact frozen result grammar is absent or stale');
    let evidence;
    let byId;
    let current;
    try {
      evidence = resultLedger.listEvidenceForStart(start.executionStartId);
      byId = resultLedger.findAcceptanceById(request.resultAcceptanceId);
      current = resultLedger.findCurrentAcceptanceForStart(start.executionStartId);
    } catch (_) {
      return acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN,
        'result acceptance ledger is unavailable');
    }
    if (!Array.isArray(evidence) || !Array.isArray(byId) || byId.length > 1
      || !Array.isArray(current) || current.length > 1) return acceptanceResult(
      RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN,
      'result acceptance ledger is conflicting or corrupt');
    const set = evidenceSetFor(start, evidence, grammar);
    if (!set) return acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN,
      'accepted result evidence history is conflicting or corrupt');
    if (set.revision !== request.expectedEvidenceSetRevision
      || set.digest !== request.expectedEvidenceSetDigest) return acceptanceResult(
      RESULT_ACCEPTANCE_OUTCOMES.EVIDENCE_SET_STALE, 'expected result evidence set is stale');
    let decision;
    try { decision = grammar.evaluateEvidenceSet(clone(set.records)); } catch (_) {
      return acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN,
        'result grammar evaluation is unavailable');
    }
    if (!decision || decision.accepted !== true || !nonEmptyString(decision.resultRef)
      || !nonEmptyString(decision.resultDigest)
      || !Array.isArray(decision.acceptanceEvidenceRefs)
      || decision.acceptanceEvidenceRefs.some((id) =>
        !set.records.some((item) => item.resultEvidenceId === id))) {
      return acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_NOT_ACCEPTABLE,
        'accepted evidence does not satisfy the frozen result grammar');
    }
    const previous = current[0] || null;
    if (previous && !coherentAcceptance(previous)) return acceptanceResult(
      RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN,
      'current result acceptance is corrupt');
    const record = Object.freeze({ type: 'EFFECT_FREE_RESULT_ACCEPTANCE',
      status: 'RESULT_ACCEPTED', resultAcceptanceId: request.resultAcceptanceId,
      acceptanceRevision: previous ? previous.acceptanceRevision + 1 : 1,
      supersedesResultAcceptanceRef: previous ? previous.resultAcceptanceId : null,
      executionStartId: start.executionStartId, startEvidenceRef: snapshot.evidenceRef,
      startRevision: start.startRevision, executionAttemptId: start.executionAttemptId,
      attemptClaimId: start.attemptClaimId, executionId: start.executionId,
      executionAcceptanceId: start.executionAcceptanceId, dispatchId: start.dispatchId,
      continuationId: start.continuationId, interactionId: start.interactionId,
      gateId: start.gateId, authorityScope: clone(start.authorityScope),
      actionIdentity: start.actionIdentity, actionRevision: start.actionRevision,
      continuationTargetRef: start.continuationTargetRef,
      executionOwnerIdentity: start.executionOwnerIdentity, inputRef: start.inputRef,
      verifiedInputDigest: start.verifiedInputDigest,
      effectContractRef: start.effectContractRef,
      effectContractRevision: start.effectContractRevision,
      effectIdempotencyClass: 'NO_EXTERNAL_EFFECT', logicalEffectId: null,
      resultEvidenceGrammarRef: grammar.ref, resultEvidenceGrammarRevision: grammar.revision,
      evidenceSetRevision: set.revision, evidenceSetDigest: set.digest,
      evidenceRefs: set.records.map((item) => item.resultEvidenceId),
      acceptanceEvidenceRefs: clone(decision.acceptanceEvidenceRefs),
      acceptedResultRef: decision.resultRef, acceptedResultDigest: decision.resultDigest,
      resultAccepted: true, executionCompleted: false, executionSuccessful: false,
      authorityCreated: false });
    if (byId.length === 1) {
      const prior = byId[0];
      if (coherentAcceptance(prior)
        && prior.resultAcceptanceId === record.resultAcceptanceId
        && prior.executionStartId === record.executionStartId
        && prior.evidenceSetRevision === record.evidenceSetRevision
        && prior.evidenceSetDigest === record.evidenceSetDigest
        && prior.acceptedResultDigest === record.acceptedResultDigest) {
        return acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ALREADY_ACCEPTED,
          null, prior);
      }
      return acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_REJECTED,
        'result acceptance identity is already bound differently');
    }
    const guards = Object.freeze({ startEvidenceRef: snapshot.evidenceRef,
      startRevision: start.startRevision, effectIdempotencyClass: 'NO_EXTERNAL_EFFECT',
      resultEvidenceGrammarRef: grammar.ref, resultEvidenceGrammarRevision: grammar.revision,
      expectedEvidenceSetRevision: set.revision, expectedEvidenceSetDigest: set.digest,
      expectedCurrentAcceptanceId: previous ? previous.resultAcceptanceId : null,
      uniqueResultAcceptanceId: true, completionAbsent: true });
    try {
      const committed = resultLedger.commitAcceptance(clone(record), guards);
      return coherentAcceptance(committed) && sameValue(committed, record)
        ? acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTED, null, committed)
        : acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN,
          'ledger returned inconsistent result acceptance');
    } catch (error) {
      let recovered = [];
      try { recovered = resultLedger.findAcceptanceById(request.resultAcceptanceId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentAcceptance(recovered[0]) && sameValue(recovered[0], record)) {
        return acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ALREADY_ACCEPTED,
          'result acceptance recovered after response loss', recovered[0]);
      }
      return acceptanceResult(error && error.code === 'EVIDENCE_SET_STALE'
        ? RESULT_ACCEPTANCE_OUTCOMES.EVIDENCE_SET_STALE
        : RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTANCE_UNCERTAIN,
      'atomic result acceptance persistence failed or is uncertain');
    }
  }

  return Object.freeze({ acceptEvidence, acceptResult });
}

module.exports = { RESULT_EVIDENCE_OUTCOMES, RESULT_ACCEPTANCE_OUTCOMES,
  createGovernedEffectFreeResultAcceptance };
