'use strict';

const crypto = require('node:crypto');

const EFFECT_OUTCOME_CLASSES = Object.freeze([
  'EFFECT_CONFIRMED',
  'NO_EFFECT_CONFIRMED',
  'EFFECT_REJECTED_BEFORE_EFFECT',
  'EFFECT_POSSIBLE',
  'EFFECT_OUTCOME_UNKNOWN',
  'EFFECT_EVIDENCE_CONFLICT'
]);

const FOLLOW_UP_ROUTES = Object.freeze({
  EFFECT_CAPABLE_RESULT_EVALUATION: 'EFFECT_CAPABLE_RESULT_EVALUATION',
  RETRY_ELIGIBILITY_EVALUATION: 'RETRY_ELIGIBILITY_EVALUATION',
  EVIDENCE_REQUIRED: 'EVIDENCE_REQUIRED'
});

const FOLLOW_UP_OPERATION_OUTCOMES = Object.freeze({
  FOLLOW_UP_DECIDED: 'FOLLOW_UP_DECIDED',
  FOLLOW_UP_ALREADY_RECORDED: 'FOLLOW_UP_ALREADY_RECORDED',
  RESOLUTION_NOT_FOUND: 'RESOLUTION_NOT_FOUND',
  RESOLUTION_NOT_CURRENT: 'RESOLUTION_NOT_CURRENT',
  RESOLUTION_INVALID: 'RESOLUTION_INVALID',
  IDENTITY_COLLISION: 'IDENTITY_COLLISION',
  FOLLOW_UP_DECISION_UNCERTAIN: 'FOLLOW_UP_DECISION_UNCERTAIN'
});

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

const canonicalStringify = (value) => JSON.stringify(canonicalize(value));
const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const sameValue = (left, right) => canonicalStringify(left) === canonicalStringify(right);

function operationResult(outcome, reason = null, decision = null) {
  return Object.freeze({
    outcome,
    reason,
    decision: clone(decision),
    retryAllowed: false,
    retryAuthorityCreated: false,
    attemptCreated: false,
    resultAccepted: false,
    executionCompleted: false,
    executionSucceeded: false,
    humanAuthorityCreated: false,
    selectedPathExecuted: false
  });
}

function coherentResolutionSnapshot(snapshot, request) {
  if (!snapshot || !nonEmptyString(snapshot.evidenceRef) || !snapshot.record) return null;
  const record = snapshot.record;
  const requiredStrings = [
    'effectOutcomeResolutionId',
    'effectInvocationId',
    'logicalEffectId',
    'invocationEvidenceRef',
    'effectContractRef',
    'effectContractRevision',
    'effectIdempotencyClass',
    'outcomePolicyIdentity',
    'outcomePolicyRevision',
    'evidenceSetDigest',
    'effectOutcomeClass'
  ];
  if (record.type !== 'EFFECT_OUTCOME_RESOLUTION'
    || record.status !== 'EFFECT_OUTCOME_RESOLVED'
    || requiredStrings.some((key) => !nonEmptyString(record[key]))
    || !Number.isInteger(record.resolutionRevision)
    || record.resolutionRevision < 1
    || !Number.isInteger(record.evidenceSetRevision)
    || record.evidenceSetRevision < 0
    || !EFFECT_OUTCOME_CLASSES.includes(record.effectOutcomeClass)
    || record.retryAllowed !== false
    || record.resultAccepted !== false
    || record.executionCompleted !== false
    || record.effectOutcomeResolutionId !== request.effectOutcomeResolutionId
    || record.effectInvocationId !== request.effectInvocationId) return null;
  return Object.freeze({ evidenceRef: snapshot.evidenceRef, record: clone(record) });
}

function routeFor(effectOutcomeClass) {
  if (effectOutcomeClass === 'EFFECT_CONFIRMED') {
    return FOLLOW_UP_ROUTES.EFFECT_CAPABLE_RESULT_EVALUATION;
  }
  if (effectOutcomeClass === 'NO_EFFECT_CONFIRMED'
    || effectOutcomeClass === 'EFFECT_REJECTED_BEFORE_EFFECT') {
    return FOLLOW_UP_ROUTES.RETRY_ELIGIBILITY_EVALUATION;
  }
  if (['EFFECT_POSSIBLE', 'EFFECT_OUTCOME_UNKNOWN', 'EFFECT_EVIDENCE_CONFLICT']
    .includes(effectOutcomeClass)) {
    return FOLLOW_UP_ROUTES.EVIDENCE_REQUIRED;
  }
  return null;
}

function coherentExistingDecision(record) {
  const requiredStrings = [
    'followUpDecisionId',
    'effectOutcomeResolutionId',
    'outcomeResolutionEvidenceRef',
    'effectInvocationId',
    'logicalEffectId',
    'invocationEvidenceRef',
    'effectContractRef',
    'effectContractRevision',
    'effectIdempotencyClass',
    'outcomePolicyIdentity',
    'outcomePolicyRevision',
    'evidenceSetDigest',
    'effectOutcomeClass',
    'selectedRoute',
    'decisionBindingDigest'
  ];
  return Boolean(record
    && record.type === 'GOVERNED_FOLLOW_UP_DECISION'
    && record.status === 'FOLLOW_UP_DECIDED'
    && requiredStrings.every((key) => nonEmptyString(record[key]))
    && Number.isInteger(record.decisionRevision)
    && record.decisionRevision === 1
    && Number.isInteger(record.outcomeResolutionRevision)
    && Number.isInteger(record.evidenceSetRevision)
    && EFFECT_OUTCOME_CLASSES.includes(record.effectOutcomeClass)
    && Object.values(FOLLOW_UP_ROUTES).includes(record.selectedRoute)
    && record.retryAllowed === false
    && record.retryAuthorityCreated === false
    && record.attemptCreated === false
    && record.resultAccepted === false
    && record.executionCompleted === false
    && record.executionSucceeded === false
    && record.humanAuthorityCreated === false
    && record.selectedPathExecuted === false);
}

function createGovernedFollowUpDecision({ currentResolutionSnapshotPort, decisionLedger }) {
  if (typeof currentResolutionSnapshotPort !== 'function') {
    throw new TypeError('currentResolutionSnapshotPort must be a function');
  }
  const requiredLedger = ['findDecisionById', 'commitDecision'];
  if (!decisionLedger || !requiredLedger.every((name) => typeof decisionLedger[name] === 'function')) {
    throw new TypeError(`decisionLedger must implement ${requiredLedger.join(', ')}`);
  }

  function decide(request) {
    if (!request
      || !nonEmptyString(request.effectInvocationId)
      || !nonEmptyString(request.effectOutcomeResolutionId)
      || !Number.isInteger(request.expectedResolutionRevision)
      || request.expectedResolutionRevision < 1
      || !Number.isInteger(request.expectedEvidenceSetRevision)
      || request.expectedEvidenceSetRevision < 0
      || !nonEmptyString(request.expectedEvidenceSetDigest)
      || !nonEmptyString(request.expectedResolutionEvidenceRef)) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_INVALID,
        'exact invocation, current resolution identity/revision/evidence-set and evidence reference are required');
    }

    let rawResolution;
    try {
      rawResolution = currentResolutionSnapshotPort(request.effectInvocationId);
    } catch (_) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN,
        'authoritative current outcome resolution is unavailable');
    }
    if (rawResolution === null || rawResolution === undefined) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_NOT_FOUND,
        'authoritative current outcome resolution is absent');
    }

    const snapshot = coherentResolutionSnapshot(rawResolution, request);
    if (!snapshot) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_INVALID,
        'authoritative outcome resolution evidence is incoherent');
    }
    const resolution = snapshot.record;

    if (snapshot.evidenceRef !== request.expectedResolutionEvidenceRef
      || resolution.resolutionRevision !== request.expectedResolutionRevision
      || resolution.evidenceSetRevision !== request.expectedEvidenceSetRevision
      || resolution.evidenceSetDigest !== request.expectedEvidenceSetDigest) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_NOT_CURRENT,
        'requested resolution evidence is stale or superseded');
    }

    const selectedRoute = routeFor(resolution.effectOutcomeClass);
    if (!selectedRoute) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.RESOLUTION_INVALID,
        'outcome class is outside the closed routing grammar');
    }

    const binding = Object.freeze({
      effectInvocationId: resolution.effectInvocationId,
      effectOutcomeResolutionId: resolution.effectOutcomeResolutionId,
      outcomeResolutionEvidenceRef: snapshot.evidenceRef,
      outcomeResolutionRevision: resolution.resolutionRevision,
      logicalEffectId: resolution.logicalEffectId,
      invocationEvidenceRef: resolution.invocationEvidenceRef,
      effectContractRef: resolution.effectContractRef,
      effectContractRevision: resolution.effectContractRevision,
      effectIdempotencyClass: resolution.effectIdempotencyClass,
      outcomePolicyIdentity: resolution.outcomePolicyIdentity,
      outcomePolicyRevision: resolution.outcomePolicyRevision,
      evidenceSetRevision: resolution.evidenceSetRevision,
      evidenceSetDigest: resolution.evidenceSetDigest,
      effectOutcomeClass: resolution.effectOutcomeClass,
      selectedRoute
    });
    const decisionBindingDigest = sha256(canonicalStringify(binding));
    const followUpDecisionId = `follow-up-decision:${decisionBindingDigest}`;

    const decision = Object.freeze({
      type: 'GOVERNED_FOLLOW_UP_DECISION',
      status: 'FOLLOW_UP_DECIDED',
      followUpDecisionId,
      decisionRevision: 1,
      ...clone(binding),
      decisionBindingDigest,
      retryAllowed: false,
      retryAuthorityCreated: false,
      attemptCreated: false,
      resultAccepted: false,
      executionCompleted: false,
      executionSucceeded: false,
      humanAuthorityCreated: false,
      selectedPathExecuted: false
    });

    let existing;
    try {
      existing = decisionLedger.findDecisionById(followUpDecisionId);
    } catch (_) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN,
        'follow-up decision ledger is unavailable');
    }
    if (!Array.isArray(existing) || existing.length > 1) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN,
        'follow-up decision ledger is conflicting or corrupt');
    }
    if (existing.length === 1) {
      if (!coherentExistingDecision(existing[0]) || !sameValue(existing[0], decision)) {
        return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.IDENTITY_COLLISION,
          'deterministic follow-up decision identity is already bound to different bytes');
      }
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_ALREADY_RECORDED,
        'same deterministic follow-up decision already exists', existing[0]);
    }

    try {
      decisionLedger.commitDecision(clone(decision));
    } catch (_) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN,
        'follow-up decision commit outcome is uncertain');
    }

    let committed;
    try {
      committed = decisionLedger.findDecisionById(followUpDecisionId);
    } catch (_) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN,
        'committed follow-up decision cannot be re-read');
    }
    if (!Array.isArray(committed) || committed.length !== 1
      || !coherentExistingDecision(committed[0])
      || !sameValue(committed[0], decision)) {
      return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECISION_UNCERTAIN,
        'committed follow-up decision is not durably identical');
    }

    return operationResult(FOLLOW_UP_OPERATION_OUTCOMES.FOLLOW_UP_DECIDED, null, committed[0]);
  }

  return Object.freeze({ decide });
}

module.exports = {
  EFFECT_OUTCOME_CLASSES,
  FOLLOW_UP_ROUTES,
  FOLLOW_UP_OPERATION_OUTCOMES,
  createGovernedFollowUpDecision
};
