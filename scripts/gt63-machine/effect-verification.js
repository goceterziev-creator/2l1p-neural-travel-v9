'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'effect-verification-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({
  VERIFIED: 'VERIFIED',
  NOT_VERIFIED: 'NOT_VERIFIED',
  UNKNOWN: 'UNKNOWN',
  INVALID: 'INVALID'
});

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const nonEmpty = value => typeof value === 'string' && value.length > 0;
const plain = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

const stringify = value => JSON.stringify(canonicalize(value));
const digest = value => `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(value), 'utf8')).digest('hex')}`;

function validScope(scope) {
  return Boolean(
    plain(scope)
    && scope.scopeType === 'GATE'
    && nonEmpty(scope.interactionId)
    && Number.isInteger(scope.fromInteractionRevision)
    && scope.fromInteractionRevision >= 0
    && (scope.throughInteractionRevision === null
      || (Number.isInteger(scope.throughInteractionRevision)
        && scope.throughInteractionRevision >= scope.fromInteractionRevision))
    && nonEmpty(scope.gateId)
    && Number.isInteger(scope.gateRevision)
    && scope.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest)
    && nonEmpty(scope.continuationTargetRef)
  );
}

function covers(parent, child) {
  if (!validScope(parent) || !validScope(child)) return false;
  return parent.interactionId === child.interactionId
    && parent.gateId === child.gateId
    && parent.gateRevision === child.gateRevision
    && parent.authorityScopeDigest === child.authorityScopeDigest
    && parent.continuationTargetRef === child.continuationTargetRef
    && child.fromInteractionRevision >= parent.fromInteractionRevision
    && (parent.throughInteractionRevision === null
      || (child.throughInteractionRevision !== null
        && child.throughInteractionRevision <= parent.throughInteractionRevision));
}

function result(outcome, reason, verification = null) {
  return Object.freeze({
    outcome,
    reason: reason || null,
    verification: clone(verification),
    authority: AUTHORITY,
    effectPerformed: outcome === OUTCOMES.VERIFIED,
    effectVerified: outcome === OUTCOMES.VERIFIED,
    executionAuthorityCreated: false,
    additionalEffectAuthorized: false
  });
}

function createEffectVerification({ effectObservationPort, verificationEvidencePort, verificationLedger }) {
  if (typeof effectObservationPort !== 'function' || typeof verificationEvidencePort !== 'function') {
    throw new TypeError('ports required');
  }
  if (!verificationLedger || typeof verificationLedger.get !== 'function' || typeof verificationLedger.commit !== 'function') {
    throw new TypeError('verificationLedger required');
  }

  function assess(request) {
    const fields = [
      'rulesetVersion', 'effectPerformanceObservationId', 'interactionId', 'interactionRevision',
      'gateId', 'gateRevision', 'authorityScopeDigest', 'continuationTargetRef',
      'expectedPrincipalRef', 'expectedPrincipalRevision', 'executionTargetRef',
      'verificationEvidenceRef'
    ];

    if (!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key => !fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.effectPerformanceObservationId)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision)
      || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision)
      || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)
      || !nonEmpty(request.executionTargetRef)
      || !nonEmpty(request.verificationEvidenceRef)) {
      return result(OUTCOMES.INVALID, 'unsupported request schema or ruleset');
    }

    let observation;
    try {
      observation = effectObservationPort({
        effectPerformanceObservationId: request.effectPerformanceObservationId
      });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'effect performance observation unavailable');
    }

    if (!plain(observation)
      || observation.effectPerformanceObservationId !== request.effectPerformanceObservationId
      || observation.type !== 'GT63_EFFECT_PERFORMANCE_OBSERVATION'
      || observation.observationState !== 'OBSERVED'
      || observation.effectPerformed !== true
      || observation.effectVerified !== false
      || observation.authority !== AUTHORITY
      || observation.lifecycleState !== 'CURRENT'
      || observation.freshnessState !== 'CURRENT'
      || observation.contradictionState !== 'NONE'
      || !nonEmpty(observation.executionTargetRef)
      || !validScope(observation.contextScope)) {
      return result(OUTCOMES.UNKNOWN, 'effect performance observation invalid or non-current');
    }

    let evidence;
    try {
      evidence = verificationEvidencePort({ verificationEvidenceRef: request.verificationEvidenceRef });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'verification evidence unavailable');
    }

    if (!plain(evidence)
      || evidence.verificationEvidenceRef !== request.verificationEvidenceRef
      || evidence.lifecycleState !== 'CURRENT'
      || evidence.freshnessState !== 'CURRENT'
      || evidence.contradictionState !== 'NONE'
      || evidence.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN, 'verification evidence invalid or non-current');
    }

    if (evidence.effectVerified !== true) {
      return result(OUTCOMES.NOT_VERIFIED, 'verification evidence does not positively establish effect correctness');
    }

    if (evidence.effectPerformanceObservationId !== request.effectPerformanceObservationId
      || evidence.executionTargetRef !== request.executionTargetRef
      || evidence.interactionId !== request.interactionId
      || evidence.gateId !== request.gateId
      || evidence.gateRevision !== request.gateRevision
      || evidence.authorityScopeDigest !== request.authorityScopeDigest
      || evidence.continuationTargetRef !== request.continuationTargetRef
      || evidence.principalRef !== request.expectedPrincipalRef
      || evidence.principalRevision !== request.expectedPrincipalRevision
      || observation.executionTargetRef !== request.executionTargetRef
      || observation.principalRef !== request.expectedPrincipalRef
      || observation.principalRevision !== request.expectedPrincipalRevision) {
      return result(OUTCOMES.NOT_VERIFIED, 'verification evidence mismatch');
    }

    const currentScope = {
      scopeType: 'GATE',
      interactionId: request.interactionId,
      fromInteractionRevision: request.interactionRevision,
      throughInteractionRevision: request.interactionRevision,
      gateId: request.gateId,
      gateRevision: request.gateRevision,
      authorityScopeDigest: request.authorityScopeDigest,
      continuationTargetRef: request.continuationTargetRef
    };

    if (!covers(observation.contextScope, currentScope)) {
      return result(OUTCOMES.NOT_VERIFIED, 'effect observation does not cover verification scope');
    }

    const material = {
      type: 'GT63_EFFECT_VERIFICATION',
      schemaVersion: '1.0',
      rulesetVersion: RULESET_VERSION,
      effectPerformanceObservationId: observation.effectPerformanceObservationId,
      verificationEvidenceRef: evidence.verificationEvidenceRef,
      principalRef: request.expectedPrincipalRef,
      principalRevision: request.expectedPrincipalRevision,
      executionTargetRef: request.executionTargetRef,
      contextScope: currentScope,
      verificationState: 'VERIFIED',
      authority: AUTHORITY,
      effectPerformed: true,
      effectVerified: true,
      executionAuthorityCreated: false,
      additionalEffectAuthorized: false
    };

    const verification = {
      effectVerificationId: `effect-verification:${digest(material).slice(7)}`,
      ...material
    };

    let prior;
    try {
      prior = verificationLedger.get(verification.effectVerificationId);
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'verification ledger unavailable');
    }

    if (prior) {
      return stringify(prior) === stringify(verification)
        ? result(OUTCOMES.VERIFIED, 'same effect verification already accepted', prior)
        : result(OUTCOMES.UNKNOWN, 'effect verification identity conflict');
    }

    try {
      const committed = verificationLedger.commit(
        verification.effectVerificationId,
        Object.freeze(clone(verification))
      );
      if (!committed || stringify(committed) !== stringify(verification)) {
        return result(OUTCOMES.UNKNOWN, 'verification ledger commit conflict');
      }
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'verification ledger commit conflict');
    }

    return result(OUTCOMES.VERIFIED, null, verification);
  }

  return Object.freeze({ assess, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

function createMemoryLedger() {
  const records = new Map();
  return Object.freeze({
    get(key) { return records.has(key) ? records.get(key) : null; },
    commit(key, value) {
      if (records.has(key)) throw new Error('immutable-ledger-conflict');
      records.set(key, Object.freeze(clone(value)));
      return records.get(key);
    }
  });
}

module.exports = {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createEffectVerification,
  createMemoryLedger
};
