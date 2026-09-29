'use strict';

const RULESET_VERSION = 'aya-live-principal-boundary-v0.1.0';
const AUTHORITY = 'NONE';
const AUTHORITY_EFFECT = 'NONE';

const OUTCOMES = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  UNKNOWN: 'UNKNOWN',
  INVALID: 'INVALID'
});

const EPOCH_CURRENTNESS = Object.freeze({
  CURRENT: 'CURRENT',
  UNKNOWN: 'UNKNOWN',
  MISMATCH: 'MISMATCH'
});

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0;
}

function presentNonEmpty(value) {
  return value !== null && value !== undefined && nonEmpty(String(value));
}

function baseResult({ bindingAssessment, principalAuthEpochCurrentness, reason, sourceMaterial }) {
  return Object.freeze({
    type: 'AYA_LIVE_GT63_PRINCIPAL_SOURCE_ASSESSMENT',
    rulesetVersion: RULESET_VERSION,
    bindingAssessment,
    principalAuthEpochCurrentness,
    sourceMaterialProduced: Boolean(sourceMaterial),
    authenticatedPrincipalSourceMaterial: sourceMaterial ? clone(sourceMaterial) : null,
    reason: reason || null,
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT,
    acceptedGt63PrincipalCreated: false,
    principalEligibilityCreated: false,
    roleCreated: false,
    humanGateCreated: false,
    governancePackageCreated: false,
    effectAuthorizationCreated: false,
    offerMutationPerformed: false
  });
}

function currentnessFromAssessment(assessment = {}) {
  if (assessment.outcome === OUTCOMES.ACCEPTED) return EPOCH_CURRENTNESS.CURRENT;
  if (/principalAuthEpoch.*does not match/i.test(String(assessment.reason || ''))) {
    return EPOCH_CURRENTNESS.MISMATCH;
  }
  return EPOCH_CURRENTNESS.UNKNOWN;
}

function buildSourceMaterial(source = {}) {
  if (!plain(source)) return null;
  const required = [
    'bindingRef',
    'authenticationEventIdentity',
    'aClassEvidenceIdentity',
    'aClassEvidenceRevision',
    'applicationUserId',
    'agencyId',
    'sessionRef',
    'sessionVersion',
    'observedPrincipalAuthEpoch',
    'observedPrincipalRevision',
    'currentPrincipalAuthEpoch',
    'currentPrincipalRevision'
  ];
  if (required.some((key) => !presentNonEmpty(source[key]))) return null;
  return {
    type: 'AYA_AUTHENTICATED_PRINCIPAL_SOURCE_MATERIAL',
    sourceMaterialType: source.type || 'AYA_AUTH_EVENT_SESSION_BOUND_SOURCE_MATERIAL',
    sourceRulesetVersion: source.rulesetVersion || null,
    bindingRef: source.bindingRef,
    authenticationEventIdentity: source.authenticationEventIdentity,
    aClassEvidenceIdentity: source.aClassEvidenceIdentity,
    aClassEvidenceRevision: source.aClassEvidenceRevision,
    applicationUserId: source.applicationUserId,
    agencyId: source.agencyId,
    sessionRef: source.sessionRef,
    sessionVersion: source.sessionVersion,
    observedPrincipalAuthEpochState: source.observedPrincipalAuthEpochState || null,
    observedPrincipalAuthEpoch: source.observedPrincipalAuthEpoch,
    observedPrincipalRevision: source.observedPrincipalRevision,
    currentPrincipalAuthEpoch: source.currentPrincipalAuthEpoch,
    currentPrincipalRevision: source.currentPrincipalRevision,
    lifecycleState: source.lifecycleState || null,
    freshnessState: source.freshnessState || null,
    contradictionState: source.contradictionState || null,
    authority: AUTHORITY,
    authorityEffect: AUTHORITY_EFFECT
  };
}

function assessLivePrincipalBoundary({
  req,
  currentDbUser,
  store,
  authEventSessionBinding,
  now = Date.now(),
  bindingAssessment
} = {}) {
  const assessment = bindingAssessment || (
    authEventSessionBinding &&
    typeof authEventSessionBinding.assessCurrentRequestBinding === 'function'
      ? authEventSessionBinding.assessCurrentRequestBinding({ req, currentDbUser, store, now })
      : null
  );

  if (!plain(assessment) || !nonEmpty(assessment.outcome)) {
    return baseResult({
      bindingAssessment: OUTCOMES.UNKNOWN,
      principalAuthEpochCurrentness: EPOCH_CURRENTNESS.UNKNOWN,
      reason: 'auth-event/session binding assessment unavailable'
    });
  }

  if (assessment.outcome !== OUTCOMES.ACCEPTED) {
    return baseResult({
      bindingAssessment: assessment.outcome,
      principalAuthEpochCurrentness: currentnessFromAssessment(assessment),
      reason: assessment.reason || null
    });
  }

  const sourceMaterial = buildSourceMaterial(assessment.sourceMaterial);
  if (!sourceMaterial) {
    return baseResult({
      bindingAssessment: OUTCOMES.UNKNOWN,
      principalAuthEpochCurrentness: EPOCH_CURRENTNESS.UNKNOWN,
      reason: 'accepted binding assessment did not include complete principal source material'
    });
  }

  return baseResult({
    bindingAssessment: OUTCOMES.ACCEPTED,
    principalAuthEpochCurrentness: EPOCH_CURRENTNESS.CURRENT,
    sourceMaterial
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  AUTHORITY_EFFECT,
  OUTCOMES,
  EPOCH_CURRENTNESS,
  assessLivePrincipalBoundary
});
