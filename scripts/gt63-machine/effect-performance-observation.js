'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'effect-performance-observation-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({
  OBSERVED: 'OBSERVED',
  NOT_OBSERVED: 'NOT_OBSERVED',
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

function result(outcome, reason, observation = null) {
  return Object.freeze({
    outcome,
    reason: reason || null,
    observation: clone(observation),
    authority: AUTHORITY,
    continuationExecuted: outcome === OUTCOMES.OBSERVED,
    effectPerformed: outcome === OUTCOMES.OBSERVED,
    effectVerified: false
  });
}

function createEffectPerformanceObservation({ continuationCompletionObservationPort, runtimeEffectEvidencePort, observationLedger }) {
  if (typeof continuationCompletionObservationPort !== 'function' || typeof runtimeEffectEvidencePort !== 'function') {
    throw new TypeError('ports required');
  }
  if (!observationLedger || typeof observationLedger.get !== 'function' || typeof observationLedger.commit !== 'function') {
    throw new TypeError('observationLedger required');
  }

  function assess(request) {
    const fields = [
      'rulesetVersion', 'continuationCompletionObservationId', 'interactionId', 'interactionRevision',
      'gateId', 'gateRevision', 'authorityScopeDigest', 'continuationTargetRef',
      'expectedPrincipalRef', 'expectedPrincipalRevision', 'executionTargetRef',
      'runtimeEffectEvidenceRef'
    ];

    if (!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key => !fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.continuationCompletionObservationId)
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
      || !nonEmpty(request.runtimeEffectEvidenceRef)) {
      return result(OUTCOMES.INVALID, 'unsupported request schema or ruleset');
    }

    let completion;
    try {
      completion = continuationCompletionObservationPort({
        continuationCompletionObservationId: request.continuationCompletionObservationId
      });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'continuation completion observation unavailable');
    }

    if (!plain(completion)
      || completion.continuationCompletionObservationId !== request.continuationCompletionObservationId
      || completion.type !== 'GT63_CONTINUATION_COMPLETION_OBSERVATION'
      || completion.observationState !== 'OBSERVED'
      || completion.continuationExecuted !== true
      || completion.effectPerformed !== false
      || completion.effectVerified !== false
      || completion.authority !== AUTHORITY
      || completion.lifecycleState !== 'CURRENT'
      || completion.freshnessState !== 'CURRENT'
      || completion.contradictionState !== 'NONE'
      || !nonEmpty(completion.executionTargetRef)
      || !validScope(completion.contextScope)) {
      return result(OUTCOMES.UNKNOWN, 'continuation completion observation invalid or non-current');
    }

    let runtime;
    try {
      runtime = runtimeEffectEvidencePort({ runtimeEffectEvidenceRef: request.runtimeEffectEvidenceRef });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'runtime effect evidence unavailable');
    }

    if (!plain(runtime)
      || runtime.runtimeEffectEvidenceRef !== request.runtimeEffectEvidenceRef
      || runtime.lifecycleState !== 'CURRENT'
      || runtime.freshnessState !== 'CURRENT'
      || runtime.contradictionState !== 'NONE'
      || runtime.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN, 'runtime effect evidence invalid or non-current');
    }

    if (runtime.effectPerformed !== true) {
      return result(OUTCOMES.NOT_OBSERVED, 'runtime evidence does not positively establish effect performance');
    }

    if (runtime.continuationCompletionObservationId !== request.continuationCompletionObservationId
      || runtime.executionTargetRef !== request.executionTargetRef
      || runtime.interactionId !== request.interactionId
      || runtime.gateId !== request.gateId
      || runtime.gateRevision !== request.gateRevision
      || runtime.authorityScopeDigest !== request.authorityScopeDigest
      || runtime.continuationTargetRef !== request.continuationTargetRef
      || runtime.principalRef !== request.expectedPrincipalRef
      || runtime.principalRevision !== request.expectedPrincipalRevision
      || completion.executionTargetRef !== request.executionTargetRef
      || completion.principalRef !== request.expectedPrincipalRef
      || completion.principalRevision !== request.expectedPrincipalRevision) {
      return result(OUTCOMES.NOT_OBSERVED, 'runtime effect evidence mismatch');
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

    if (!covers(completion.contextScope, currentScope)) {
      return result(OUTCOMES.NOT_OBSERVED, 'continuation completion observation does not cover effect scope');
    }

    const material = {
      type: 'GT63_EFFECT_PERFORMANCE_OBSERVATION',
      schemaVersion: '1.0',
      rulesetVersion: RULESET_VERSION,
      continuationCompletionObservationId: completion.continuationCompletionObservationId,
      runtimeEffectEvidenceRef: runtime.runtimeEffectEvidenceRef,
      principalRef: request.expectedPrincipalRef,
      principalRevision: request.expectedPrincipalRevision,
      executionTargetRef: request.executionTargetRef,
      contextScope: currentScope,
      observationState: 'OBSERVED',
      authority: AUTHORITY,
      continuationExecuted: true,
      effectPerformed: true,
      effectVerified: false
    };

    const observation = {
      effectPerformanceObservationId: `effect-performance-observation:${digest(material).slice(7)}`,
      ...material
    };

    let prior;
    try {
      prior = observationLedger.get(observation.effectPerformanceObservationId);
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'observation ledger unavailable');
    }

    if (prior) {
      return stringify(prior) === stringify(observation)
        ? result(OUTCOMES.OBSERVED, 'same effect performance observation already accepted', prior)
        : result(OUTCOMES.UNKNOWN, 'effect performance observation identity conflict');
    }

    try {
      const committed = observationLedger.commit(
        observation.effectPerformanceObservationId,
        Object.freeze(clone(observation))
      );
      if (!committed || stringify(committed) !== stringify(observation)) {
        return result(OUTCOMES.UNKNOWN, 'observation ledger commit conflict');
      }
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'observation ledger commit conflict');
    }

    return result(OUTCOMES.OBSERVED, null, observation);
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
  createEffectPerformanceObservation,
  createMemoryLedger
};
