'use strict';

const crypto = require('node:crypto');

const EVIDENCE_ACCEPTANCE_OUTCOMES = Object.freeze({
  EFFECT_OUTCOME_EVIDENCE_ACCEPTED: 'EFFECT_OUTCOME_EVIDENCE_ACCEPTED',
  EVIDENCE_ALREADY_ACCEPTED: 'EVIDENCE_ALREADY_ACCEPTED',
  INVOCATION_NOT_FOUND: 'INVOCATION_NOT_FOUND',
  EVIDENCE_NOT_APPLICABLE: 'EVIDENCE_NOT_APPLICABLE',
  EVIDENCE_INVALID: 'EVIDENCE_INVALID',
  EVIDENCE_CONFLICT_DETECTED: 'EVIDENCE_CONFLICT_DETECTED',
  EVIDENCE_ACCEPTANCE_REJECTED: 'EVIDENCE_ACCEPTANCE_REJECTED',
  EVIDENCE_ACCEPTANCE_UNCERTAIN: 'EVIDENCE_ACCEPTANCE_UNCERTAIN'
});

const RESOLUTION_OPERATION_OUTCOMES = Object.freeze({
  EFFECT_OUTCOME_RESOLVED: 'EFFECT_OUTCOME_RESOLVED',
  RESOLUTION_ALREADY_RECORDED: 'RESOLUTION_ALREADY_RECORDED',
  INVOCATION_NOT_FOUND: 'INVOCATION_NOT_FOUND',
  EVIDENCE_SET_STALE: 'EVIDENCE_SET_STALE',
  RESOLUTION_POLICY_NOT_FOUND: 'RESOLUTION_POLICY_NOT_FOUND',
  RESOLUTION_REJECTED: 'RESOLUTION_REJECTED',
  RESOLUTION_UNCERTAIN: 'RESOLUTION_UNCERTAIN'
});

const EFFECT_OUTCOME_CLASSES = Object.freeze([
  'EFFECT_CONFIRMED',
  'NO_EFFECT_CONFIRMED',
  'EFFECT_REJECTED_BEFORE_EFFECT',
  'EFFECT_POSSIBLE',
  'EFFECT_OUTCOME_UNKNOWN',
  'EFFECT_EVIDENCE_CONFLICT'
]);

const OBSERVATION_CLASSES = Object.freeze([
  'TRANSPORT_RETURN_OBSERVED',
  'REQUEST_ACKNOWLEDGED',
  'REQUEST_REJECTED_OBSERVED',
  'EFFECT_OCCURRED_OBSERVED',
  'NO_EFFECT_OBSERVED',
  'DELIVERY_OR_PROCESSING_POSSIBLE',
  'OUTCOME_UNKNOWN_OBSERVED'
]);

const EFFECT_CLASSES = Object.freeze([
  'IDEMPOTENT_WITH_STABLE_KEY', 'NON_IDEMPOTENT'
]);

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => {
    out[key] = canonicalize(value[key]); return out;
  }, {});
  return value;
};
const canonicalStringify = (value) => JSON.stringify(canonicalize(value));
const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const sameValue = (left, right) => canonicalStringify(left) === canonicalStringify(right);

function acceptanceResult(outcome, reason = null, evidence = null) {
  return Object.freeze({ outcome, reason, evidence: clone(evidence),
    authoritativeEffectOutcome: null, retryAllowed: false,
    resultAccepted: false, executionCompleted: false });
}

function resolutionResult(outcome, reason = null, resolution = null) {
  return Object.freeze({ outcome, reason, resolution: clone(resolution), retryAllowed: false,
    resultAccepted: false, executionCompleted: false });
}

function coherentInvocationSnapshot(snapshot, effectInvocationId) {
  const record = snapshot && snapshot.record;
  const required = ['effectInvocationId', 'effectInvocationIntentId', 'executionStartId',
    'executionAttemptId', 'attemptClaimId', 'executionId', 'executionAcceptanceId',
    'dispatchId', 'continuationId', 'interactionId', 'gateId', 'authorityEvidenceRef',
    'governanceEvaluationRef', 'actionIdentity', 'actionRevision', 'continuationTargetRef',
    'executionOwnerIdentity', 'inputRef', 'verifiedInputDigest', 'verifiedInputEvidenceRef',
    'effectContractRef', 'effectContractRevision', 'effectIdempotencyClass',
    'logicalEffectId', 'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision',
    'invocationEnvelopeDigest'];
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !record
    || record.type !== 'EFFECT_INVOCATION'
    || !['EFFECT_INVOCATION_STARTED', 'INVOCATION_RETURNED',
      'INVOCATION_UNCERTAIN'].includes(record.status)
    || record.effectInvocationId !== effectInvocationId
    || record.effectStatus !== 'UNKNOWN'
    || record.singleInvocationIdentityForIntent !== true
    || !Number.isInteger(record.invocationRevision)
    || record.authorityScope === undefined
    || required.some((key) => !nonEmptyString(record[key]))
    || !EFFECT_CLASSES.includes(record.effectIdempotencyClass)) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentSource(snapshot, request, invocation) {
  const record = snapshot && snapshot.record;
  const required = ['sourceIdentity', 'sourceRevision', 'sourceType',
    'evidenceGrammarIdentity', 'evidenceGrammarRevision', 'authenticityVerifierIdentity',
    'authenticityVerifierRevision', 'effectContractRef', 'effectContractRevision',
    'correlationMode', 'outcomePolicyIdentity', 'outcomePolicyRevision'];
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !record
    || required.some((key) => !nonEmptyString(record[key]))
    || record.sourceIdentity !== request.sourceIdentity
    || record.sourceRevision !== request.expectedSourceRevision
    || record.evidenceGrammarRevision !== request.expectedGrammarRevision
    || record.outcomePolicyRevision !== request.expectedPolicyRevision
    || record.trusted !== true || record.historicalEvidenceAcceptance !== true
    || !Array.isArray(record.acquisitionMethods)
    || !record.acquisitionMethods.includes(request.acquisitionMethod)
    || !Array.isArray(record.claimCapabilities)
    || record.effectContractRef !== invocation.effectContractRef
    || record.effectContractRevision !== invocation.effectContractRevision
    || !Array.isArray(record.effectClasses)
    || !record.effectClasses.includes(invocation.effectIdempotencyClass)
    || record.correlationMode !== 'EXACT_INVOCATION_AND_LOGICAL_EFFECT') return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function coherentGrammar(contract, source) {
  return Boolean(contract && contract.identity === source.record.evidenceGrammarIdentity
    && contract.revision === source.record.evidenceGrammarRevision
    && typeof contract.classifyAndCanonicalize === 'function');
}

function coherentPolicy(contract, source, invocation) {
  return Boolean(contract && contract.identity === source.record.outcomePolicyIdentity
    && contract.revision === source.record.outcomePolicyRevision
    && contract.effectContractRef === invocation.effectContractRef
    && contract.effectContractRevision === invocation.effectContractRevision
    && Array.isArray(contract.supportedOutcomeClasses)
    && EFFECT_OUTCOME_CLASSES.every((value) => contract.supportedOutcomeClasses.includes(value))
    && typeof contract.detectConflict === 'function'
    && typeof contract.resolveEvidenceSet === 'function');
}

function coherentEvidence(record) {
  const required = ['effectOutcomeEvidenceId', 'effectInvocationId',
    'invocationEvidenceRef', 'effectInvocationIntentId', 'executionStartId',
    'executionAttemptId', 'attemptClaimId', 'executionId', 'logicalEffectId',
    'effectContractRef', 'effectContractRevision', 'effectIdempotencyClass',
    'invocationEnvelopeDigest', 'sourceEvidenceRef', 'sourceIdentity', 'sourceRevision',
    'sourceType', 'evidenceGrammarIdentity', 'evidenceGrammarRevision',
    'outcomePolicyIdentity', 'outcomePolicyRevision', 'acquisitionMethod',
    'observationClass', 'requiredClaimCapability', 'canonicalEvidenceDigest',
    'verificationEvidenceRef'];
  return Boolean(record && record.type === 'EFFECT_OUTCOME_EVIDENCE'
    && record.status === 'EFFECT_OUTCOME_EVIDENCE_ACCEPTED'
    && Number.isInteger(record.evidenceRevision)
    && Number.isInteger(record.evidenceOrdinal) && record.evidenceOrdinal > 0
    && Number.isInteger(record.invocationRevision)
    && record.authoritativeConclusion === false
    && record.authorityScope !== undefined
    && OBSERVATION_CLASSES.includes(record.observationClass)
    && required.every((key) => nonEmptyString(record[key])));
}

function evidenceSetFor(invocation, evidence, policy) {
  const ordered = evidence.map(clone).sort((a, b) => a.evidenceOrdinal - b.evidenceOrdinal
    || a.effectOutcomeEvidenceId.localeCompare(b.effectOutcomeEvidenceId));
  for (let index = 0; index < ordered.length; index += 1) {
    if (!coherentEvidence(ordered[index])
      || ordered[index].effectInvocationId !== invocation.effectInvocationId
      || ordered[index].logicalEffectId !== invocation.logicalEffectId
      || ordered[index].evidenceOrdinal !== index + 1) return null;
  }
  const tuples = ordered.map((item) => ({ evidenceOrdinal: item.evidenceOrdinal,
    effectOutcomeEvidenceId: item.effectOutcomeEvidenceId,
    evidenceRevision: item.evidenceRevision,
    canonicalEvidenceDigest: item.canonicalEvidenceDigest }));
  const binding = { effectInvocationId: invocation.effectInvocationId,
    invocationRevision: invocation.invocationRevision,
    outcomePolicyIdentity: policy.identity, outcomePolicyRevision: policy.revision,
    evidenceSetRevision: ordered.length, evidence: tuples };
  return Object.freeze({ records: ordered, revision: ordered.length,
    digest: sha256(canonicalStringify(binding)), binding: Object.freeze(binding) });
}

function hasProof(evidence, key) {
  return evidence.some((item) => item.verifiedClaims && item.verifiedClaims[key] === true);
}

function validateResolvedClass(effectOutcomeClass, evidenceSet) {
  if (!EFFECT_OUTCOME_CLASSES.includes(effectOutcomeClass)) return false;
  if (effectOutcomeClass === 'EFFECT_CONFIRMED') {
    return evidenceSet.records.some((item) => item.observationClass === 'EFFECT_OCCURRED_OBSERVED'
      && item.requiredClaimCapability === 'SUPPORT_EFFECT_OCCURRED');
  }
  if (effectOutcomeClass === 'NO_EFFECT_CONFIRMED') {
    return evidenceSet.records.some((item) => item.observationClass === 'NO_EFFECT_OBSERVED'
      && item.requiredClaimCapability === 'SUPPORT_NO_EFFECT')
      && ['causallyExcludesAllEffectOperations', 'coversInvocationInterval',
        'noHiddenRetry', 'sourceCompletenessVerified'].every((key) => hasProof(evidenceSet.records, key));
  }
  if (effectOutcomeClass === 'EFFECT_REJECTED_BEFORE_EFFECT') {
    return evidenceSet.records.some((item) => item.observationClass === 'REQUEST_REJECTED_OBSERVED'
      && item.requiredClaimCapability === 'SUPPORT_REJECTED_BEFORE_EFFECT')
      && ['rejectionPrecedesDelivery', 'rejectionPrecedesProcessing',
        'rejectionPrecedesEffect', 'noHiddenRetry'].every((key) => hasProof(evidenceSet.records, key));
  }
  return true;
}

function coherentResolution(record) {
  const required = ['effectOutcomeResolutionId', 'effectInvocationId', 'logicalEffectId',
    'invocationEvidenceRef', 'effectContractRef', 'effectContractRevision',
    'effectIdempotencyClass', 'outcomePolicyIdentity', 'outcomePolicyRevision',
    'evidenceSetDigest', 'effectOutcomeClass'];
  return Boolean(record && record.type === 'EFFECT_OUTCOME_RESOLUTION'
    && record.status === 'EFFECT_OUTCOME_RESOLVED'
    && Number.isInteger(record.resolutionRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && EFFECT_OUTCOME_CLASSES.includes(record.effectOutcomeClass)
    && record.resultAccepted === false && record.executionCompleted === false
    && record.retryAllowed === false
    && required.every((key) => nonEmptyString(record[key])));
}

function createGovernedEffectOutcomeResolution({ invocationSnapshotPort,
  evidenceSourceRegistryPort, evidenceGrammarRegistryPort, outcomePolicyRegistryPort,
  evidenceVerifierPort, outcomeLedger }) {
  for (const [name, port] of Object.entries({ invocationSnapshotPort,
    evidenceSourceRegistryPort, evidenceGrammarRegistryPort, outcomePolicyRegistryPort,
    evidenceVerifierPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  const requiredLedger = ['findEvidenceById', 'listEvidenceForInvocation',
    'commitAcceptedEvidence', 'findResolutionById', 'findCurrentResolutionForInvocation',
    'commitResolution', 'commitEvidenceAndResolution'];
  if (!outcomeLedger || !requiredLedger.every((name) => typeof outcomeLedger[name] === 'function')) {
    throw new TypeError(`outcomeLedger must implement ${requiredLedger.join(', ')}`);
  }

  function prepareEvidence(request) {
    const stringFields = ['effectOutcomeEvidenceId', 'effectInvocationId', 'sourceIdentity',
      'expectedSourceRevision', 'expectedGrammarRevision', 'expectedPolicyRevision',
      'acquisitionMethod'];
    if (!request || stringFields.some((key) => !nonEmptyString(request[key]))
      || !request.observation || typeof request.observation !== 'object'
      || !request.provenance || typeof request.provenance !== 'object') {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_REJECTED,
        'evidence identity, invocation, source revisions, observation and provenance are required') };
    }
    let rawInvocation;
    try { rawInvocation = invocationSnapshotPort(request.effectInvocationId); } catch (_) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
        'authoritative invocation is unavailable') };
    }
    if (rawInvocation === null || rawInvocation === undefined) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.INVOCATION_NOT_FOUND,
        'authoritative physical invocation is absent') };
    }
    const invocationSnapshot = coherentInvocationSnapshot(rawInvocation, request.effectInvocationId);
    if (!invocationSnapshot) return { failure: acceptanceResult(
      EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_INVALID, 'invocation evidence is incoherent') };
    const invocation = invocationSnapshot.record;

    let rawSource;
    try { rawSource = evidenceSourceRegistryPort(request.sourceIdentity,
      request.expectedSourceRevision); } catch (_) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
        'evidence source registry is unavailable') };
    }
    const source = coherentSource(rawSource, request, invocation);
    if (!source) return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_INVALID,
      'evidence source is untrusted, incompatible or stale') };

    let grammar;
    let policy;
    try {
      grammar = evidenceGrammarRegistryPort(source.record.evidenceGrammarIdentity,
        request.expectedGrammarRevision);
      policy = outcomePolicyRegistryPort(source.record.outcomePolicyIdentity,
        request.expectedPolicyRevision);
    } catch (_) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
        'evidence grammar or outcome policy is unavailable') };
    }
    if (!coherentGrammar(grammar, source)) return { failure: acceptanceResult(
      EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_INVALID, 'evidence grammar is invalid or stale') };
    if (!coherentPolicy(policy, source, invocation)) return { failure: acceptanceResult(
      EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_INVALID, 'outcome policy is invalid or stale') };

    let classified;
    try { classified = grammar.classifyAndCanonicalize(clone(request.observation)); } catch (_) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_INVALID,
        'observation cannot be classified or canonicalized') };
    }
    if (!classified || !OBSERVATION_CLASSES.includes(classified.observationClass)
      || !nonEmptyString(classified.requiredClaimCapability)
      || !nonEmptyString(classified.canonicalBytes)
      || !source.record.claimCapabilities.includes(classified.requiredClaimCapability)) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_INVALID,
        'observation exceeds source claim capability') };
    }
    if (request.observation.effectInvocationId !== invocation.effectInvocationId
      || request.observation.logicalEffectId !== invocation.logicalEffectId) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_NOT_APPLICABLE,
        'observation does not correlate to the exact invocation and logical effect') };
    }

    let verification;
    try { verification = evidenceVerifierPort(Object.freeze({ invocation: clone(invocation),
      source: clone(source.record), observation: clone(request.observation),
      provenance: clone(request.provenance), canonicalBytes: classified.canonicalBytes })); } catch (_) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
        'evidence authenticity verification is unavailable') };
    }
    if (!verification || verification.verified !== true
      || !nonEmptyString(verification.evidenceRef)
      || !verification.verifiedClaims || typeof verification.verifiedClaims !== 'object') {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_INVALID,
        'evidence authenticity or provenance is not verified') };
    }

    let existing;
    let allEvidence;
    try {
      existing = outcomeLedger.findEvidenceById(request.effectOutcomeEvidenceId);
      allEvidence = outcomeLedger.listEvidenceForInvocation(request.effectInvocationId);
    } catch (_) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
        'evidence ledger is unavailable') };
    }
    if (!Array.isArray(existing) || existing.length > 1 || !Array.isArray(allEvidence)) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
        'evidence ledger is conflicting or corrupt') };
    }
    const baseSet = evidenceSetFor(invocation, allEvidence, policy);
    if (!baseSet) return { failure: acceptanceResult(
      EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
      'existing evidence history is conflicting or corrupt') };

    const canonicalEvidenceDigest = sha256(canonicalStringify({
      sourceIdentity: source.record.sourceIdentity, sourceRevision: source.record.sourceRevision,
      grammarIdentity: grammar.identity, grammarRevision: grammar.revision,
      acquisitionMethod: request.acquisitionMethod, canonicalBytes: classified.canonicalBytes,
      provenance: request.provenance, verificationEvidenceRef: verification.evidenceRef
    }));
    const record = Object.freeze({ type: 'EFFECT_OUTCOME_EVIDENCE',
      status: 'EFFECT_OUTCOME_EVIDENCE_ACCEPTED',
      effectOutcomeEvidenceId: request.effectOutcomeEvidenceId, evidenceRevision: 1,
      evidenceOrdinal: existing.length === 1 ? existing[0].evidenceOrdinal : baseSet.revision + 1,
      effectInvocationId: invocation.effectInvocationId,
      invocationEvidenceRef: invocationSnapshot.evidenceRef,
      invocationRevision: invocation.invocationRevision,
      effectInvocationIntentId: invocation.effectInvocationIntentId,
      executionStartId: invocation.executionStartId,
      executionAttemptId: invocation.executionAttemptId,
      attemptClaimId: invocation.attemptClaimId, executionId: invocation.executionId,
      executionAcceptanceId: invocation.executionAcceptanceId, dispatchId: invocation.dispatchId,
      continuationId: invocation.continuationId, interactionId: invocation.interactionId,
      gateId: invocation.gateId, authorityScope: clone(invocation.authorityScope),
      actionIdentity: invocation.actionIdentity, actionRevision: invocation.actionRevision,
      continuationTargetRef: invocation.continuationTargetRef,
      inputRef: invocation.inputRef, verifiedInputDigest: invocation.verifiedInputDigest,
      effectContractRef: invocation.effectContractRef,
      effectContractRevision: invocation.effectContractRevision,
      effectIdempotencyClass: invocation.effectIdempotencyClass,
      logicalEffectId: invocation.logicalEffectId,
      resultEvidenceGrammarRef: invocation.resultEvidenceGrammarRef,
      resultEvidenceGrammarRevision: invocation.resultEvidenceGrammarRevision,
      invocationEnvelopeDigest: invocation.invocationEnvelopeDigest,
      sourceEvidenceRef: source.evidenceRef, sourceIdentity: source.record.sourceIdentity,
      sourceRevision: source.record.sourceRevision, sourceType: source.record.sourceType,
      evidenceGrammarIdentity: grammar.identity, evidenceGrammarRevision: grammar.revision,
      outcomePolicyIdentity: policy.identity, outcomePolicyRevision: policy.revision,
      acquisitionMethod: request.acquisitionMethod,
      provenance: clone(request.provenance), observationClass: classified.observationClass,
      requiredClaimCapability: classified.requiredClaimCapability,
      canonicalEvidenceDigest, verificationEvidenceRef: verification.evidenceRef,
      verifiedClaims: clone(verification.verifiedClaims), authoritativeConclusion: false });

    if (existing.length === 1) {
      const prior = existing[0];
      if (coherentEvidence(prior) && sameValue(prior, record)) {
        return { duplicate: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ALREADY_ACCEPTED,
          null, prior) };
      }
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_REJECTED,
        'evidence identity is already bound to different canonical bytes or invocation') };
    }
    let conflict;
    try { conflict = policy.detectConflict(baseSet.records, clone(record)); } catch (_) {
      return { failure: acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
        'conflict evaluation is unavailable') };
    }
    if (typeof conflict !== 'boolean') return { failure: acceptanceResult(
      EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_INVALID, 'conflict evaluation is invalid') };
    return { invocationSnapshot, invocation, source, grammar, policy, baseSet, record, conflict };
  }

  function acceptEvidence(request = {}) {
    const prepared = prepareEvidence(request);
    if (prepared.failure) return prepared.failure;
    if (prepared.duplicate) return prepared.duplicate;
    const guards = Object.freeze({ invocationEvidenceRef: prepared.invocationSnapshot.evidenceRef,
      invocationRevision: prepared.invocation.invocationRevision,
      sourceIdentity: prepared.source.record.sourceIdentity,
      sourceRevision: prepared.source.record.sourceRevision,
      grammarRevision: prepared.grammar.revision, policyRevision: prepared.policy.revision,
      expectedEvidenceSetRevision: prepared.baseSet.revision,
      expectedEvidenceSetDigest: prepared.baseSet.digest,
      uniqueEvidenceId: true, exactCorrelation: true });
    try {
      const committed = outcomeLedger.commitAcceptedEvidence(clone(prepared.record), guards);
      if (!coherentEvidence(committed) || !sameValue(committed, prepared.record)) {
        return acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
          'ledger returned inconsistent accepted evidence');
      }
      return acceptanceResult(prepared.conflict
        ? EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_CONFLICT_DETECTED
        : EVIDENCE_ACCEPTANCE_OUTCOMES.EFFECT_OUTCOME_EVIDENCE_ACCEPTED,
      null, committed);
    } catch (error) {
      let recovered = [];
      try { recovered = outcomeLedger.findEvidenceById(request.effectOutcomeEvidenceId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentEvidence(recovered[0]) && sameValue(recovered[0], prepared.record)) {
        return acceptanceResult(EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ALREADY_ACCEPTED,
          'accepted evidence recovered after response loss', recovered[0]);
      }
      return acceptanceResult(error && error.code === 'EVIDENCE_SET_STALE'
        ? EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_REJECTED
        : EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
      'atomic evidence persistence failed or is uncertain');
    }
  }

  function prepareResolution(request, additionalEvidence = null) {
    const strings = ['effectOutcomeResolutionId', 'effectInvocationId',
      'expectedPolicyRevision', 'expectedEvidenceSetDigest'];
    if (!request || strings.some((key) => !nonEmptyString(request[key]))
      || !Number.isInteger(request.expectedEvidenceSetRevision)) {
      return { failure: resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_REJECTED,
        'resolution identity, invocation, policy and evidence-set expectations are required') };
    }
    let rawInvocation;
    try { rawInvocation = invocationSnapshotPort(request.effectInvocationId); } catch (_) {
      return { failure: resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
        'authoritative invocation is unavailable') };
    }
    if (rawInvocation === null || rawInvocation === undefined) return { failure: resolutionResult(
      RESOLUTION_OPERATION_OUTCOMES.INVOCATION_NOT_FOUND, 'authoritative invocation is absent') };
    const invocationSnapshot = coherentInvocationSnapshot(rawInvocation, request.effectInvocationId);
    if (!invocationSnapshot) return { failure: resolutionResult(
      RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_REJECTED, 'invocation evidence is incoherent') };
    const invocation = invocationSnapshot.record;

    let evidence;
    let byId;
    let current;
    try {
      evidence = outcomeLedger.listEvidenceForInvocation(request.effectInvocationId);
      byId = outcomeLedger.findResolutionById(request.effectOutcomeResolutionId);
      current = outcomeLedger.findCurrentResolutionForInvocation(request.effectInvocationId);
    } catch (_) {
      return { failure: resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
        'resolution ledger is unavailable') };
    }
    if (!Array.isArray(evidence) || !Array.isArray(byId) || byId.length > 1
      || !Array.isArray(current) || current.length > 1) return { failure: resolutionResult(
      RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
      'resolution ledger is conflicting or corrupt') };
    if (additionalEvidence) evidence = [...evidence, clone(additionalEvidence)];

    let policy;
    try {
      const policyIdentity = evidence[0] && evidence[0].outcomePolicyIdentity;
      policy = outcomePolicyRegistryPort(policyIdentity, request.expectedPolicyRevision);
    } catch (_) {
      return { failure: resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
        'outcome policy registry is unavailable') };
    }
    if (!policy || !nonEmptyString(policy.identity)
      || policy.revision !== request.expectedPolicyRevision
      || policy.effectContractRef !== invocation.effectContractRef
      || policy.effectContractRevision !== invocation.effectContractRevision
      || !Array.isArray(policy.supportedOutcomeClasses)
      || !EFFECT_OUTCOME_CLASSES.every((value) => policy.supportedOutcomeClasses.includes(value))
      || typeof policy.resolveEvidenceSet !== 'function') return { failure: resolutionResult(
      RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_POLICY_NOT_FOUND,
      'exact compatible outcome policy is absent') };

    const evidenceSet = evidenceSetFor(invocation, evidence, policy);
    if (!evidenceSet) return { failure: resolutionResult(
      RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
      'accepted evidence history is corrupt') };
    if (evidenceSet.revision !== request.expectedEvidenceSetRevision
      || evidenceSet.digest !== request.expectedEvidenceSetDigest) return { failure: resolutionResult(
      RESOLUTION_OPERATION_OUTCOMES.EVIDENCE_SET_STALE,
      'expected evidence set is stale') };

    let decision;
    try { decision = policy.resolveEvidenceSet(clone(evidenceSet.records)); } catch (_) {
      return { failure: resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
        'outcome policy evaluation is unavailable') };
    }
    if (!decision || !validateResolvedClass(decision.effectOutcomeClass, evidenceSet)) {
      return { failure: resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_REJECTED,
        'outcome conclusion is unsupported by accepted evidence') };
    }
    if (byId.length === 1) {
      const prior = byId[0];
      if (coherentResolution(prior)
        && prior.effectInvocationId === invocation.effectInvocationId
        && prior.logicalEffectId === invocation.logicalEffectId
        && prior.outcomePolicyIdentity === policy.identity
        && prior.outcomePolicyRevision === policy.revision
        && prior.evidenceSetRevision === evidenceSet.revision
        && prior.evidenceSetDigest === evidenceSet.digest
        && prior.effectOutcomeClass === decision.effectOutcomeClass) {
        return { duplicate: resolutionResult(
          RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_ALREADY_RECORDED, null, prior) };
      }
      return { failure: resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_REJECTED,
        'resolution identity is already bound differently') };
    }
    const previous = current[0] || null;
    if (previous && !coherentResolution(previous)) return { failure: resolutionResult(
      RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
      'current resolution evidence is corrupt') };
    const resolution = Object.freeze({ type: 'EFFECT_OUTCOME_RESOLUTION',
      status: 'EFFECT_OUTCOME_RESOLVED',
      effectOutcomeResolutionId: request.effectOutcomeResolutionId,
      resolutionRevision: previous ? previous.resolutionRevision + 1 : 1,
      supersedesResolutionRef: previous ? previous.effectOutcomeResolutionId : null,
      effectInvocationId: invocation.effectInvocationId,
      invocationEvidenceRef: invocationSnapshot.evidenceRef,
      invocationRevision: invocation.invocationRevision,
      logicalEffectId: invocation.logicalEffectId,
      effectContractRef: invocation.effectContractRef,
      effectContractRevision: invocation.effectContractRevision,
      effectIdempotencyClass: invocation.effectIdempotencyClass,
      outcomePolicyIdentity: policy.identity, outcomePolicyRevision: policy.revision,
      evidenceSetRevision: evidenceSet.revision, evidenceSetDigest: evidenceSet.digest,
      evidenceRefs: evidenceSet.records.map((item) => item.effectOutcomeEvidenceId),
      effectOutcomeClass: decision.effectOutcomeClass,
      resolutionEvidenceRefs: Array.isArray(decision.resolutionEvidenceRefs)
        ? clone(decision.resolutionEvidenceRefs) : [],
      retryHandoff: Object.freeze({ effectOutcomeClass: decision.effectOutcomeClass,
        effectInvocationId: invocation.effectInvocationId,
        logicalEffectId: invocation.logicalEffectId,
        effectContractRevision: invocation.effectContractRevision,
        evidenceSetDigest: evidenceSet.digest }),
      retryAllowed: false, resultAccepted: false, executionCompleted: false });
    return { invocationSnapshot, invocation, policy, evidenceSet, previous, resolution };
  }

  function resolveOutcome(request = {}) {
    const prepared = prepareResolution(request);
    if (prepared.failure) return prepared.failure;
    if (prepared.duplicate) return prepared.duplicate;
    const guards = Object.freeze({ invocationEvidenceRef: prepared.invocationSnapshot.evidenceRef,
      invocationRevision: prepared.invocation.invocationRevision,
      expectedEvidenceSetRevision: prepared.evidenceSet.revision,
      expectedEvidenceSetDigest: prepared.evidenceSet.digest,
      expectedCurrentResolutionId: prepared.previous
        ? prepared.previous.effectOutcomeResolutionId : null,
      policyIdentity: prepared.policy.identity, policyRevision: prepared.policy.revision,
      uniqueResolutionId: true });
    try {
      const committed = outcomeLedger.commitResolution(clone(prepared.resolution), guards);
      return coherentResolution(committed) && sameValue(committed, prepared.resolution)
        ? resolutionResult(RESOLUTION_OPERATION_OUTCOMES.EFFECT_OUTCOME_RESOLVED, null, committed)
        : resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
          'ledger returned inconsistent resolution');
    } catch (error) {
      let recovered = [];
      try { recovered = outcomeLedger.findResolutionById(request.effectOutcomeResolutionId); } catch (_) {}
      if (Array.isArray(recovered) && recovered.length === 1
        && coherentResolution(recovered[0]) && sameValue(recovered[0], prepared.resolution)) {
        return resolutionResult(RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_ALREADY_RECORDED,
          'resolution recovered after response loss', recovered[0]);
      }
      return resolutionResult(error && error.code === 'EVIDENCE_SET_STALE'
        ? RESOLUTION_OPERATION_OUTCOMES.EVIDENCE_SET_STALE
        : RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
      'resolution persistence failed or is uncertain');
    }
  }

  function acceptAndResolve({ evidenceRequest, resolutionRequest } = {}) {
    const evidencePrepared = prepareEvidence(evidenceRequest || {});
    if (evidencePrepared.failure) return Object.freeze({ evidence: evidencePrepared.failure,
      resolution: null, atomic: true });
    if (evidencePrepared.duplicate) return Object.freeze({ evidence: evidencePrepared.duplicate,
      resolution: null, atomic: true });
    if (evidencePrepared.conflict || evidencePrepared.policy.atomicSingleEvidenceResolution !== true) {
      return Object.freeze({ evidence: acceptanceResult(
        EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_REJECTED,
        'atomic resolution is not eligible'), resolution: null, atomic: true });
    }
    const expectedSet = evidenceSetFor(evidencePrepared.invocation,
      [...evidencePrepared.baseSet.records, evidencePrepared.record], evidencePrepared.policy);
    const exactResolutionRequest = { ...clone(resolutionRequest || {}),
      effectInvocationId: evidencePrepared.invocation.effectInvocationId,
      expectedPolicyRevision: evidencePrepared.policy.revision,
      expectedEvidenceSetRevision: expectedSet.revision,
      expectedEvidenceSetDigest: expectedSet.digest };
    const resolutionPrepared = prepareResolution(exactResolutionRequest, evidencePrepared.record);
    if (resolutionPrepared.failure) return Object.freeze({ evidence: acceptanceResult(
      EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_REJECTED,
      'atomic resolution preparation failed'), resolution: resolutionPrepared.failure, atomic: true });
    if (resolutionPrepared.duplicate) return Object.freeze({ evidence: acceptanceResult(
      EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_REJECTED,
      'atomic resolution identity already exists'), resolution: resolutionPrepared.duplicate, atomic: true });
    const guards = Object.freeze({ invocationEvidenceRef: evidencePrepared.invocationSnapshot.evidenceRef,
      invocationRevision: evidencePrepared.invocation.invocationRevision,
      expectedPriorEvidenceSetRevision: evidencePrepared.baseSet.revision,
      expectedPriorEvidenceSetDigest: evidencePrepared.baseSet.digest,
      committedEvidenceSetRevision: resolutionPrepared.evidenceSet.revision,
      committedEvidenceSetDigest: resolutionPrepared.evidenceSet.digest,
      uniqueEvidenceId: true, uniqueResolutionId: true,
      expectedCurrentResolutionId: resolutionPrepared.previous
        ? resolutionPrepared.previous.effectOutcomeResolutionId : null });
    try {
      const committed = outcomeLedger.commitEvidenceAndResolution(clone(evidencePrepared.record),
        clone(resolutionPrepared.resolution), guards);
      if (!committed || !sameValue(committed.evidence, evidencePrepared.record)
        || !sameValue(committed.resolution, resolutionPrepared.resolution)) {
        return Object.freeze({ evidence: acceptanceResult(
          EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
          'atomic ledger returned inconsistent records'), resolution: resolutionResult(
          RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
          'atomic ledger returned inconsistent records'), atomic: true });
      }
      return Object.freeze({ evidence: acceptanceResult(
        EVIDENCE_ACCEPTANCE_OUTCOMES.EFFECT_OUTCOME_EVIDENCE_ACCEPTED,
        null, committed.evidence), resolution: resolutionResult(
        RESOLUTION_OPERATION_OUTCOMES.EFFECT_OUTCOME_RESOLVED,
        null, committed.resolution), atomic: true });
    } catch (_) {
      let evidenceFound = [];
      let resolutionFound = [];
      try {
        evidenceFound = outcomeLedger.findEvidenceById(evidenceRequest.effectOutcomeEvidenceId);
        resolutionFound = outcomeLedger.findResolutionById(
          resolutionRequest.effectOutcomeResolutionId);
      } catch (_) {}
      if (Array.isArray(evidenceFound) && evidenceFound.length === 1
        && Array.isArray(resolutionFound) && resolutionFound.length === 1
        && sameValue(evidenceFound[0], evidencePrepared.record)
        && sameValue(resolutionFound[0], resolutionPrepared.resolution)) {
        return Object.freeze({ evidence: acceptanceResult(
          EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ALREADY_ACCEPTED,
          'atomic records recovered', evidenceFound[0]), resolution: resolutionResult(
          RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_ALREADY_RECORDED,
          'atomic records recovered', resolutionFound[0]), atomic: true });
      }
      return Object.freeze({ evidence: acceptanceResult(
        EVIDENCE_ACCEPTANCE_OUTCOMES.EVIDENCE_ACCEPTANCE_UNCERTAIN,
        'atomic persistence is uncertain'), resolution: resolutionResult(
        RESOLUTION_OPERATION_OUTCOMES.RESOLUTION_UNCERTAIN,
        'atomic persistence is uncertain'), atomic: true });
    }
  }

  return Object.freeze({ acceptEvidence, resolveOutcome, acceptAndResolve });
}

module.exports = { EVIDENCE_ACCEPTANCE_OUTCOMES, RESOLUTION_OPERATION_OUTCOMES,
  EFFECT_OUTCOME_CLASSES, OBSERVATION_CLASSES,
  createGovernedEffectOutcomeResolution };
