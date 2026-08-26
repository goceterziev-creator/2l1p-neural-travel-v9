'use strict';

const crypto = require('node:crypto');

const RESULT_EVIDENCE_OUTCOMES = Object.freeze({
  RESULT_EVIDENCE_ACCEPTED: 'RESULT_EVIDENCE_ACCEPTED',
  RESULT_EVIDENCE_ALREADY_ACCEPTED: 'RESULT_EVIDENCE_ALREADY_ACCEPTED',
  START_NOT_FOUND: 'START_NOT_FOUND',
  OUTCOME_RESOLUTION_NOT_FOUND: 'OUTCOME_RESOLUTION_NOT_FOUND',
  OUTCOME_NOT_ELIGIBLE: 'OUTCOME_NOT_ELIGIBLE',
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
  OUTCOME_RESOLUTION_NOT_FOUND: 'OUTCOME_RESOLUTION_NOT_FOUND',
  OUTCOME_NOT_ELIGIBLE: 'OUTCOME_NOT_ELIGIBLE',
  BRANCH_MISMATCH: 'BRANCH_MISMATCH',
  EVIDENCE_SET_STALE: 'EVIDENCE_SET_STALE',
  RESULT_GRAMMAR_NOT_FOUND: 'RESULT_GRAMMAR_NOT_FOUND',
  RESULT_NOT_ACCEPTABLE: 'RESULT_NOT_ACCEPTABLE',
  RESULT_ACCEPTANCE_REJECTED: 'RESULT_ACCEPTANCE_REJECTED',
  RESULT_ACCEPTANCE_UNCERTAIN: 'RESULT_ACCEPTANCE_UNCERTAIN'
});

const EFFECT_CAPABLE_CLASSES = Object.freeze([
  'IDEMPOTENT_WITH_STABLE_KEY',
  'NON_IDEMPOTENT'
]);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function sameValue(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function evidenceResult(outcome, reason = null, evidence = null) {
  return Object.freeze({ outcome, reason, evidence: clone(evidence),
    authoritativeResult: false, resultAccepted: false, executionCompleted: false,
    executionSuccessful: false, authorityCreated: false });
}

function acceptanceResult(outcome, reason = null, acceptance = null) {
  return Object.freeze({ outcome, reason, acceptance: clone(acceptance),
    resultAccepted: Boolean(acceptance && acceptance.resultAccepted === true),
    executionCompleted: false, executionSuccessful: false, authorityCreated: false });
}

function coherentStartSnapshot(snapshot) {
  const required = ['evidenceRef', 'executionStartId', 'executionAttemptId', 'attemptClaimId',
    'executionId', 'executionAcceptanceId', 'dispatchId', 'continuationId', 'interactionId',
    'gateId', 'actionIdentity', 'actionRevision', 'continuationTargetRef',
    'executionOwnerIdentity', 'inputRef', 'verifiedInputDigest', 'effectContractRef',
    'effectContractRevision', 'resultEvidenceGrammarRef',
    'resultEvidenceGrammarRevision'];
  const record = snapshot && snapshot.record;
  return Boolean(record && snapshot && required.every((key) =>
    nonEmptyString(key === 'evidenceRef' ? snapshot.evidenceRef : record[key]))
    && record.type === 'EXECUTION_ATTEMPT_START'
    && record.status === 'EXECUTION_ATTEMPT_STARTED'
    && Number.isInteger(record.startRevision)
    && Number.isInteger(record.attemptRevision)
    && Number.isInteger(record.claimRevision)
    && [...EFFECT_CAPABLE_CLASSES, 'NO_EXTERNAL_EFFECT'].includes(record.effectIdempotencyClass)
    && (record.effectIdempotencyClass === 'NO_EXTERNAL_EFFECT'
      ? record.logicalEffectId === null : nonEmptyString(record.logicalEffectId))
    && record.executionActivityStarted === true
    && record.singleAuthoritativeStart === true);
}

function coherentResolutionSnapshot(snapshot, start) {
  const record = snapshot && snapshot.record;
  const required = ['evidenceRef', 'effectOutcomeResolutionId', 'effectInvocationId',
    'logicalEffectId', 'effectContractRef', 'effectContractRevision', 'evidenceSetDigest'];
  return Boolean(record && required.every((key) =>
    nonEmptyString(key === 'evidenceRef' ? snapshot.evidenceRef : record[key]))
    && record.type === 'EFFECT_OUTCOME_RESOLUTION'
    && record.status === 'EFFECT_OUTCOME_RESOLVED'
    && Number.isInteger(record.resolutionRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && record.effectOutcomeClass === 'EFFECT_CONFIRMED'
    && record.resultAccepted === false
    && record.executionCompleted === false
    && record.logicalEffectId === start.logicalEffectId
    && record.effectContractRef === start.effectContractRef
    && record.effectContractRevision === start.effectContractRevision
    && record.effectIdempotencyClass === start.effectIdempotencyClass);
}

function coherentSource(snapshot, request, start) {
  const record = snapshot && snapshot.record;
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && record.type === 'RESULT_EVIDENCE_SOURCE_REGISTRATION'
    && record.status === 'ENABLED'
    && record.sourceIdentity === request.sourceIdentity
    && record.sourceRevision === request.expectedSourceRevision
    && record.resultEvidenceGrammarRef === start.resultEvidenceGrammarRef
    && record.resultEvidenceGrammarRevision === start.resultEvidenceGrammarRevision
    && record.effectContractRef === start.effectContractRef
    && record.effectContractRevision === start.effectContractRevision
    && record.effectCapableResultEvidence === true);
}

function coherentGrammar(snapshot, start) {
  const record = snapshot && snapshot.record;
  return Boolean(record && nonEmptyString(snapshot.evidenceRef)
    && record.type === 'RESULT_EVIDENCE_GRAMMAR'
    && record.status === 'ENABLED'
    && record.ref === start.resultEvidenceGrammarRef
    && record.revision === start.resultEvidenceGrammarRevision
    && typeof record.evaluateEvidenceSet === 'function');
}

function coherentEvidence(record) {
  const required = ['resultEvidenceId', 'executionStartId', 'startEvidenceRef',
    'executionAttemptId', 'executionId', 'effectOutcomeResolutionId',
    'outcomeResolutionEvidenceRef', 'effectInvocationId', 'logicalEffectId',
    'actionIdentity', 'actionRevision', 'continuationTargetRef', 'inputRef',
    'verifiedInputDigest', 'effectContractRef', 'effectContractRevision',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision', 'sourceIdentity',
    'sourceRevision', 'sourceEvidenceRef', 'verificationEvidenceRef',
    'canonicalEvidenceDigest', 'evidenceClass'];
  return Boolean(record && record.type === 'EFFECT_CAPABLE_RESULT_EVIDENCE'
    && record.status === 'RESULT_EVIDENCE_ACCEPTED'
    && Number.isInteger(record.evidenceRevision)
    && Number.isInteger(record.evidenceOrdinal)
    && EFFECT_CAPABLE_CLASSES.includes(record.effectIdempotencyClass)
    && record.effectOutcomeClass === 'EFFECT_CONFIRMED'
    && record.authoritativeResult === false
    && record.resultAccepted === false
    && record.executionCompleted === false
    && required.every((key) => nonEmptyString(record[key])));
}

function evidenceSetFor(start, resolution, records, grammar) {
  if (!Array.isArray(records) || records.some((item) => !coherentEvidence(item)
    || item.executionStartId !== start.executionStartId
    || item.executionAttemptId !== start.executionAttemptId
    || item.effectOutcomeResolutionId !== resolution.effectOutcomeResolutionId
    || item.effectInvocationId !== resolution.effectInvocationId
    || item.logicalEffectId !== start.logicalEffectId
    || item.verifiedInputDigest !== start.verifiedInputDigest
    || item.resultEvidenceGrammarRef !== grammar.ref
    || item.resultEvidenceGrammarRevision !== grammar.revision)) return null;
  const ordered = records.map(clone).sort((left, right) =>
    left.evidenceOrdinal - right.evidenceOrdinal
    || left.resultEvidenceId.localeCompare(right.resultEvidenceId));
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index].evidenceOrdinal !== index + 1) return null;
  }
  const binding = { executionStartId: start.executionStartId,
    startRevision: start.startRevision, executionAttemptId: start.executionAttemptId,
    effectOutcomeResolutionId: resolution.effectOutcomeResolutionId,
    outcomeResolutionRevision: resolution.resolutionRevision,
    effectInvocationId: resolution.effectInvocationId, logicalEffectId: start.logicalEffectId,
    resultEvidenceGrammarRef: grammar.ref, resultEvidenceGrammarRevision: grammar.revision,
    evidence: ordered.map((item) => ({ resultEvidenceId: item.resultEvidenceId,
      evidenceRevision: item.evidenceRevision, evidenceOrdinal: item.evidenceOrdinal,
      canonicalEvidenceDigest: item.canonicalEvidenceDigest })) };
  return Object.freeze({ records: ordered, revision: ordered.length,
    digest: digest(binding), binding: Object.freeze(binding) });
}

function coherentAcceptance(record) {
  const required = ['resultAcceptanceId', 'executionStartId', 'startEvidenceRef',
    'executionAttemptId', 'executionId', 'effectOutcomeResolutionId',
    'outcomeResolutionEvidenceRef', 'effectInvocationId', 'logicalEffectId',
    'actionIdentity', 'actionRevision', 'continuationTargetRef', 'inputRef',
    'verifiedInputDigest', 'effectContractRef', 'effectContractRevision',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision', 'evidenceSetDigest',
    'acceptedResultRef', 'acceptedResultDigest'];
  return Boolean(record && record.type === 'EFFECT_CAPABLE_RESULT_ACCEPTANCE'
    && record.status === 'RESULT_ACCEPTED'
    && Number.isInteger(record.acceptanceRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && EFFECT_CAPABLE_CLASSES.includes(record.effectIdempotencyClass)
    && record.effectOutcomeClass === 'EFFECT_CONFIRMED'
    && record.resultAccepted === true
    && record.executionCompleted === false
    && record.executionSuccessful === false
    && required.every((key) => nonEmptyString(record[key])));
}

function createGovernedEffectCapableResultAcceptance({ startSnapshotPort,
  outcomeResolutionSnapshotPort, currentOutcomeResolutionPort,
  resultEvidenceSourceRegistryPort, resultEvidenceGrammarRegistryPort,
  resultEvidenceVerifierPort, resultLedger }) {
  for (const [name, port] of Object.entries({ startSnapshotPort,
    outcomeResolutionSnapshotPort, currentOutcomeResolutionPort,
    resultEvidenceSourceRegistryPort, resultEvidenceGrammarRegistryPort,
    resultEvidenceVerifierPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  const requiredLedger = ['findEvidenceById', 'listEvidenceForStart', 'commitEvidence',
    'findAcceptanceById', 'findCurrentAcceptanceForStart', 'commitAcceptance'];
  if (!resultLedger || requiredLedger.some((name) => typeof resultLedger[name] !== 'function')) {
    throw new TypeError(`resultLedger must implement ${requiredLedger.join(', ')}`);
  }

  function resolveAuthoritative(request, operation) {
    if (!nonEmptyString(request.executionStartId)) return { failure: operation(
      'START_NOT_FOUND', 'authoritative Start identity is required') };
    let startSnapshot;
    try { startSnapshot = startSnapshotPort(request.executionStartId); } catch (_) {
      return { failure: operation('START_NOT_FOUND', 'authoritative Start is unavailable') };
    }
    if (!coherentStartSnapshot(startSnapshot)
      || startSnapshot.record.executionStartId !== request.executionStartId) return { failure:
      operation('START_NOT_FOUND', 'authoritative EXECUTION_ATTEMPT_STARTED was not found') };
    const start = startSnapshot.record;
    if (!EFFECT_CAPABLE_CLASSES.includes(start.effectIdempotencyClass)) return { failure:
      operation('BRANCH_MISMATCH', 'only effect-capable classes may enter this branch') };
    if (!nonEmptyString(request.effectOutcomeResolutionId)) return { failure:
      operation('OUTCOME_RESOLUTION_NOT_FOUND', 'authoritative effect outcome is required') };
    let resolutionSnapshot;
    try { resolutionSnapshot = outcomeResolutionSnapshotPort(request.effectOutcomeResolutionId); }
    catch (_) { return { failure: operation('OUTCOME_RESOLUTION_NOT_FOUND',
      'authoritative effect outcome is unavailable') }; }
    const resolution = resolutionSnapshot && resolutionSnapshot.record;
    if (!resolution || resolution.effectOutcomeResolutionId !== request.effectOutcomeResolutionId) {
      return { failure: operation('OUTCOME_RESOLUTION_NOT_FOUND',
        'authoritative effect outcome was not found') };
    }
    if (resolution.effectOutcomeClass !== 'EFFECT_CONFIRMED') return { failure:
      operation('OUTCOME_NOT_ELIGIBLE', 'only EFFECT_CONFIRMED may support result acceptance') };
    if (!coherentResolutionSnapshot(resolutionSnapshot, start)) return { failure:
      operation('OUTCOME_NOT_ELIGIBLE', 'effect outcome is stale, corrupt or mismatched') };
    let current;
    try { current = currentOutcomeResolutionPort(resolution.effectInvocationId); } catch (_) {
      return { failure: operation('OUTCOME_NOT_ELIGIBLE',
        'current effect outcome resolution is unavailable') };
    }
    if (!current || current.evidenceRef !== resolutionSnapshot.evidenceRef
      || !sameValue(current.record, resolution)) return { failure: operation(
      'OUTCOME_NOT_ELIGIBLE', 'effect outcome resolution is not current') };
    return { startSnapshot, start, resolutionSnapshot, resolution };
  }

  function resolveGrammar(start, operation) {
    let snapshot;
    try { snapshot = resultEvidenceGrammarRegistryPort(start.resultEvidenceGrammarRef,
      start.resultEvidenceGrammarRevision); } catch (_) {
      return { failure: operation('RESULT_GRAMMAR_NOT_FOUND',
        'result grammar registry is unavailable') };
    }
    return coherentGrammar(snapshot, start) ? { snapshot, grammar: snapshot.record }
      : { failure: operation('RESULT_GRAMMAR_NOT_FOUND',
        'exact frozen result grammar is absent or stale') };
  }

  function acceptEvidence(request = {}) {
    const operation = (outcome, reason) => evidenceResult(
      RESULT_EVIDENCE_OUTCOMES[outcome], reason);
    const strings = ['resultEvidenceId', 'executionStartId', 'effectOutcomeResolutionId',
      'sourceIdentity', 'expectedSourceRevision'];
    if (strings.some((key) => !nonEmptyString(request[key]))) return operation(
      'RESULT_EVIDENCE_INVALID', 'exact evidence request identity is required');
    const authoritative = resolveAuthoritative(request, operation);
    if (authoritative.failure) return authoritative.failure;
    const { startSnapshot, start, resolutionSnapshot, resolution } = authoritative;
    let sourceSnapshot;
    try { sourceSnapshot = resultEvidenceSourceRegistryPort(request.sourceIdentity,
      request.expectedSourceRevision); } catch (_) {
      return operation('RESULT_EVIDENCE_UNCERTAIN', 'evidence source registry is unavailable');
    }
    if (!coherentSource(sourceSnapshot, request, start)) return operation(
      'EVIDENCE_NOT_APPLICABLE', 'trusted compatible evidence source is absent or stale');
    const grammarResolved = resolveGrammar(start, operation);
    if (grammarResolved.failure) return operation('EVIDENCE_NOT_APPLICABLE',
      grammarResolved.failure.reason);
    let verified;
    try { verified = resultEvidenceVerifierPort(Object.freeze({
      rawEvidence: clone(request.rawEvidence), source: clone(sourceSnapshot.record),
      start: clone(start), resolution: clone(resolution) })); } catch (_) {
      return operation('RESULT_EVIDENCE_UNCERTAIN', 'result evidence verifier is unavailable');
    }
    if (!verified || verified.valid !== true || !nonEmptyString(verified.sourceEvidenceRef)
      || !nonEmptyString(verified.verificationEvidenceRef)
      || !nonEmptyString(verified.evidenceClass)
      || verified.executionStartId !== start.executionStartId
      || verified.executionAttemptId !== start.executionAttemptId
      || verified.effectInvocationId !== resolution.effectInvocationId
      || verified.logicalEffectId !== start.logicalEffectId
      || verified.verifiedInputDigest !== start.verifiedInputDigest) return operation(
      'RESULT_EVIDENCE_INVALID', 'evidence verification or exact correlation failed');
    const canonicalEvidence = canonicalize(verified.canonicalEvidence);
    const canonicalEvidenceDigest = digest(canonicalEvidence);
    if (nonEmptyString(verified.canonicalEvidenceDigest)
      && verified.canonicalEvidenceDigest !== canonicalEvidenceDigest) return operation(
      'RESULT_EVIDENCE_INVALID', 'canonical evidence digest does not match verified bytes');
    let byId; let records;
    try {
      byId = resultLedger.findEvidenceById(request.resultEvidenceId);
      records = resultLedger.listEvidenceForStart(start.executionStartId);
    } catch (_) { return operation('RESULT_EVIDENCE_UNCERTAIN', 'result ledger is unavailable'); }
    if (!Array.isArray(byId) || byId.length > 1 || !Array.isArray(records)
      || records.some((item) => !coherentEvidence(item))) return operation(
      'RESULT_EVIDENCE_UNCERTAIN', 'result evidence ledger is conflicting or corrupt');
    const record = Object.freeze({ type: 'EFFECT_CAPABLE_RESULT_EVIDENCE',
      status: 'RESULT_EVIDENCE_ACCEPTED', resultEvidenceId: request.resultEvidenceId,
      evidenceRevision: byId.length === 1 ? byId[0].evidenceRevision : 1,
      evidenceOrdinal: byId.length === 1 ? byId[0].evidenceOrdinal : records.length + 1,
      executionStartId: start.executionStartId,
      startEvidenceRef: startSnapshot.evidenceRef, startRevision: start.startRevision,
      executionAttemptId: start.executionAttemptId, attemptClaimId: start.attemptClaimId,
      executionId: start.executionId, executionAcceptanceId: start.executionAcceptanceId,
      dispatchId: start.dispatchId, continuationId: start.continuationId,
      interactionId: start.interactionId, gateId: start.gateId,
      authorityScope: clone(start.authorityScope), actionIdentity: start.actionIdentity,
      actionRevision: start.actionRevision, continuationTargetRef: start.continuationTargetRef,
      executionOwnerIdentity: start.executionOwnerIdentity, inputRef: start.inputRef,
      verifiedInputDigest: start.verifiedInputDigest,
      effectOutcomeResolutionId: resolution.effectOutcomeResolutionId,
      outcomeResolutionEvidenceRef: resolutionSnapshot.evidenceRef,
      outcomeResolutionRevision: resolution.resolutionRevision,
      effectInvocationId: resolution.effectInvocationId,
      effectOutcomeClass: 'EFFECT_CONFIRMED', logicalEffectId: start.logicalEffectId,
      effectContractRef: start.effectContractRef,
      effectContractRevision: start.effectContractRevision,
      effectIdempotencyClass: start.effectIdempotencyClass,
      resultEvidenceGrammarRef: start.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: start.resultEvidenceGrammarRevision,
      sourceIdentity: sourceSnapshot.record.sourceIdentity,
      sourceRevision: sourceSnapshot.record.sourceRevision,
      sourceRegistryEvidenceRef: sourceSnapshot.evidenceRef,
      sourceEvidenceRef: verified.sourceEvidenceRef,
      verificationEvidenceRef: verified.verificationEvidenceRef,
      evidenceClass: verified.evidenceClass, canonicalEvidence,
      canonicalEvidenceDigest, authoritativeResult: false, resultAccepted: false,
      executionCompleted: false, executionSuccessful: false, authorityCreated: false });
    if (byId.length === 1) {
      return coherentEvidence(byId[0]) && sameValue(byId[0], record)
        ? evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_ALREADY_ACCEPTED, null, byId[0])
        : operation('RESULT_EVIDENCE_REJECTED',
          'result evidence identity is already bound differently');
    }
    const guards = Object.freeze({ startEvidenceRef: startSnapshot.evidenceRef,
      startRevision: start.startRevision,
      outcomeResolutionEvidenceRef: resolutionSnapshot.evidenceRef,
      outcomeResolutionRevision: resolution.resolutionRevision,
      expectedCurrentOutcomeResolutionId: resolution.effectOutcomeResolutionId,
      effectOutcomeClass: 'EFFECT_CONFIRMED', effectInvocationId: resolution.effectInvocationId,
      logicalEffectId: start.logicalEffectId, sourceRegistryEvidenceRef: sourceSnapshot.evidenceRef,
      sourceRevision: sourceSnapshot.record.sourceRevision,
      resultEvidenceGrammarRef: start.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: start.resultEvidenceGrammarRevision,
      expectedEvidenceHistoryRevision: records.length, uniqueResultEvidenceId: true,
      completionAbsent: true });
    try {
      const committed = resultLedger.commitEvidence(clone(record), guards);
      return coherentEvidence(committed) && sameValue(committed, record)
        ? evidenceResult(RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_ACCEPTED, null, committed)
        : operation('RESULT_EVIDENCE_UNCERTAIN', 'ledger returned inconsistent result evidence');
    } catch (_) {
      let recovered = [];
      try { recovered = resultLedger.findEvidenceById(request.resultEvidenceId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentEvidence(recovered[0]) && sameValue(recovered[0], record)) return evidenceResult(
        RESULT_EVIDENCE_OUTCOMES.RESULT_EVIDENCE_ALREADY_ACCEPTED,
        'result evidence recovered after response loss', recovered[0]);
      return operation('RESULT_EVIDENCE_UNCERTAIN',
        'atomic result evidence persistence failed or is uncertain');
    }
  }

  function acceptResult(request = {}) {
    const operation = (outcome, reason) => acceptanceResult(
      RESULT_ACCEPTANCE_OUTCOMES[outcome], reason);
    const strings = ['resultAcceptanceId', 'executionStartId', 'effectOutcomeResolutionId',
      'expectedEvidenceSetDigest'];
    if (strings.some((key) => !nonEmptyString(request[key]))
      || !Number.isInteger(request.expectedEvidenceSetRevision)) return operation(
      'RESULT_ACCEPTANCE_REJECTED', 'exact result acceptance request identity is required');
    const authoritative = resolveAuthoritative(request, operation);
    if (authoritative.failure) return authoritative.failure;
    const { startSnapshot, start, resolutionSnapshot, resolution } = authoritative;
    const grammarResolved = resolveGrammar(start, operation);
    if (grammarResolved.failure) return grammarResolved.failure;
    const { grammar } = grammarResolved;
    let records; let byId; let current;
    try {
      records = resultLedger.listEvidenceForStart(start.executionStartId);
      byId = resultLedger.findAcceptanceById(request.resultAcceptanceId);
      current = resultLedger.findCurrentAcceptanceForStart(start.executionStartId);
    } catch (_) { return operation('RESULT_ACCEPTANCE_UNCERTAIN',
      'result acceptance ledger is unavailable'); }
    if (!Array.isArray(records) || !Array.isArray(byId) || byId.length > 1
      || !Array.isArray(current) || current.length > 1) return operation(
      'RESULT_ACCEPTANCE_UNCERTAIN', 'result acceptance ledger is conflicting or corrupt');
    const set = evidenceSetFor(start, resolution, records, grammar);
    if (!set) return operation('RESULT_ACCEPTANCE_UNCERTAIN',
      'accepted result evidence history is conflicting or corrupt');
    if (set.revision !== request.expectedEvidenceSetRevision
      || set.digest !== request.expectedEvidenceSetDigest) return operation(
      'EVIDENCE_SET_STALE', 'expected result evidence set is stale');
    if (set.revision === 0) return operation('RESULT_NOT_ACCEPTABLE',
      'an empty evidence set cannot establish an accepted result');
    let decision;
    try { decision = grammar.evaluateEvidenceSet(clone(set.records)); } catch (_) {
      return operation('RESULT_ACCEPTANCE_UNCERTAIN', 'result grammar evaluation is unavailable');
    }
    if (!decision || decision.accepted !== true || !nonEmptyString(decision.resultRef)
      || !nonEmptyString(decision.resultDigest)
      || !Array.isArray(decision.acceptanceEvidenceRefs)
      || decision.acceptanceEvidenceRefs.some((id) =>
        !set.records.some((item) => item.resultEvidenceId === id))) return operation(
      'RESULT_NOT_ACCEPTABLE', 'accepted evidence does not satisfy the frozen result grammar');
    const previous = current[0] || null;
    if (previous && !coherentAcceptance(previous)) return operation(
      'RESULT_ACCEPTANCE_UNCERTAIN', 'current result acceptance is corrupt');
    const record = Object.freeze({ type: 'EFFECT_CAPABLE_RESULT_ACCEPTANCE',
      status: 'RESULT_ACCEPTED', resultAcceptanceId: request.resultAcceptanceId,
      acceptanceRevision: byId.length === 1 ? byId[0].acceptanceRevision
        : (previous ? previous.acceptanceRevision + 1 : 1),
      supersedesResultAcceptanceRef: byId.length === 1
        ? byId[0].supersedesResultAcceptanceRef
        : (previous ? previous.resultAcceptanceId : null),
      executionStartId: start.executionStartId, startEvidenceRef: startSnapshot.evidenceRef,
      startRevision: start.startRevision, executionAttemptId: start.executionAttemptId,
      attemptClaimId: start.attemptClaimId, executionId: start.executionId,
      executionAcceptanceId: start.executionAcceptanceId, dispatchId: start.dispatchId,
      continuationId: start.continuationId, interactionId: start.interactionId,
      gateId: start.gateId, authorityScope: clone(start.authorityScope),
      actionIdentity: start.actionIdentity, actionRevision: start.actionRevision,
      continuationTargetRef: start.continuationTargetRef,
      executionOwnerIdentity: start.executionOwnerIdentity, inputRef: start.inputRef,
      verifiedInputDigest: start.verifiedInputDigest,
      effectOutcomeResolutionId: resolution.effectOutcomeResolutionId,
      outcomeResolutionEvidenceRef: resolutionSnapshot.evidenceRef,
      outcomeResolutionRevision: resolution.resolutionRevision,
      effectInvocationId: resolution.effectInvocationId,
      effectOutcomeClass: 'EFFECT_CONFIRMED', logicalEffectId: start.logicalEffectId,
      effectContractRef: start.effectContractRef,
      effectContractRevision: start.effectContractRevision,
      effectIdempotencyClass: start.effectIdempotencyClass,
      resultEvidenceGrammarRef: grammar.ref, resultEvidenceGrammarRevision: grammar.revision,
      evidenceSetRevision: set.revision, evidenceSetDigest: set.digest,
      evidenceRefs: set.records.map((item) => item.resultEvidenceId),
      acceptanceEvidenceRefs: clone(decision.acceptanceEvidenceRefs),
      acceptedResultRef: decision.resultRef, acceptedResultDigest: decision.resultDigest,
      resultAccepted: true, executionCompleted: false, executionSuccessful: false,
      authorityCreated: false });
    if (byId.length === 1) {
      const prior = byId[0];
      if (coherentAcceptance(prior) && sameValue(prior, record)) return acceptanceResult(
        RESULT_ACCEPTANCE_OUTCOMES.RESULT_ALREADY_ACCEPTED, null, prior);
      return operation('RESULT_ACCEPTANCE_REJECTED',
        'result acceptance identity is already bound differently');
    }
    const guards = Object.freeze({ startEvidenceRef: startSnapshot.evidenceRef,
      startRevision: start.startRevision,
      outcomeResolutionEvidenceRef: resolutionSnapshot.evidenceRef,
      outcomeResolutionRevision: resolution.resolutionRevision,
      expectedCurrentOutcomeResolutionId: resolution.effectOutcomeResolutionId,
      effectOutcomeClass: 'EFFECT_CONFIRMED', effectInvocationId: resolution.effectInvocationId,
      logicalEffectId: start.logicalEffectId,
      resultEvidenceGrammarRef: grammar.ref, resultEvidenceGrammarRevision: grammar.revision,
      expectedEvidenceSetRevision: set.revision, expectedEvidenceSetDigest: set.digest,
      expectedCurrentAcceptanceId: previous ? previous.resultAcceptanceId : null,
      uniqueResultAcceptanceId: true, completionAbsent: true });
    try {
      const committed = resultLedger.commitAcceptance(clone(record), guards);
      return coherentAcceptance(committed) && sameValue(committed, record)
        ? acceptanceResult(RESULT_ACCEPTANCE_OUTCOMES.RESULT_ACCEPTED, null, committed)
        : operation('RESULT_ACCEPTANCE_UNCERTAIN',
          'ledger returned inconsistent result acceptance');
    } catch (_) {
      let recovered = [];
      try { recovered = resultLedger.findAcceptanceById(request.resultAcceptanceId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentAcceptance(recovered[0]) && sameValue(recovered[0], record)) return acceptanceResult(
        RESULT_ACCEPTANCE_OUTCOMES.RESULT_ALREADY_ACCEPTED,
        'result acceptance recovered after response loss', recovered[0]);
      return operation('RESULT_ACCEPTANCE_UNCERTAIN',
        'atomic result acceptance persistence failed or is uncertain');
    }
  }

  return Object.freeze({ acceptEvidence, acceptResult });
}

module.exports = { RESULT_EVIDENCE_OUTCOMES, RESULT_ACCEPTANCE_OUTCOMES,
  EFFECT_CAPABLE_CLASSES, createGovernedEffectCapableResultAcceptance,
  canonicalStringify, digest };
