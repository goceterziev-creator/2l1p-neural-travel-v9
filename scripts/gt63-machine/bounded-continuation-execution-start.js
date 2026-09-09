'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'bounded-continuation-execution-start-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({
  STARTABLE: 'STARTABLE',
  NOT_STARTABLE: 'NOT_STARTABLE',
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

function result(outcome, reason, startRecord = null) {
  return Object.freeze({
    outcome,
    reason: reason || null,
    startRecord: clone(startRecord),
    authority: AUTHORITY,
    executionStartPermitted: outcome === OUTCOMES.STARTABLE,
    executionStarted: false,
    continuationExecuted: false,
    effectPerformed: false,
    effectVerified: false
  });
}

function createBoundedContinuationExecutionStart({ executionIntentPort, executionStartRequirementPort, startLedger }) {
  if (typeof executionIntentPort !== 'function' || typeof executionStartRequirementPort !== 'function') {
    throw new TypeError('ports required');
  }
  if (!startLedger || typeof startLedger.get !== 'function' || typeof startLedger.commit !== 'function') {
    throw new TypeError('startLedger required');
  }

  function assess(request) {
    const fields = [
      'rulesetVersion', 'executionIntentId', 'interactionId', 'interactionRevision',
      'gateId', 'gateRevision', 'authorityScopeDigest', 'continuationTargetRef',
      'expectedPrincipalRef', 'expectedPrincipalRevision', 'executionTargetRef'
    ];

    if (!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key => !fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.executionIntentId)
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
      || !nonEmpty(request.executionTargetRef)) {
      return result(OUTCOMES.INVALID, 'unsupported request schema or ruleset');
    }

    let intent;
    try {
      intent = executionIntentPort({ executionIntentId: request.executionIntentId });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'execution intent unavailable');
    }

    if (!plain(intent)
      || intent.executionIntentId !== request.executionIntentId
      || intent.type !== 'GT63_CONTROLLED_CONTINUATION_EXECUTION_INTENT'
      || intent.executionState !== 'PERMITTED'
      || intent.continuationExecutionPermitted !== true
      || intent.authority !== AUTHORITY
      || intent.continuationExecuted !== false
      || intent.executionStarted !== false
      || intent.effectPerformed !== false
      || intent.effectVerified !== false
      || intent.lifecycleState !== 'CURRENT'
      || intent.freshnessState !== 'CURRENT'
      || intent.contradictionState !== 'NONE'
      || !nonEmpty(intent.executionTargetRef)
      || !validScope(intent.contextScope)) {
      return result(OUTCOMES.UNKNOWN, 'execution intent invalid or non-current');
    }

    let requirement;
    try {
      requirement = executionStartRequirementPort({
        executionTargetRef: request.executionTargetRef,
        continuationTargetRef: request.continuationTargetRef,
        interactionId: request.interactionId,
        interactionRevision: request.interactionRevision
      });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'execution start requirement unavailable');
    }

    if (!plain(requirement)
      || !nonEmpty(requirement.executionStartRequirementEvidenceRef)
      || requirement.lifecycleState !== 'CURRENT'
      || requirement.freshnessState !== 'CURRENT'
      || requirement.contradictionState !== 'NONE'
      || requirement.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN, 'execution start requirement invalid or non-current');
    }

    if (intent.executionTargetRef !== request.executionTargetRef
      || requirement.executionTargetRef !== request.executionTargetRef
      || requirement.interactionId !== request.interactionId
      || requirement.gateId !== request.gateId
      || requirement.gateRevision !== request.gateRevision
      || requirement.authorityScopeDigest !== request.authorityScopeDigest
      || requirement.continuationTargetRef !== request.continuationTargetRef
      || request.interactionRevision < requirement.fromInteractionRevision
      || (requirement.throughInteractionRevision !== null
        && request.interactionRevision > requirement.throughInteractionRevision)) {
      return result(OUTCOMES.NOT_STARTABLE, 'execution start requirement mismatch');
    }

    if (intent.principalRef !== request.expectedPrincipalRef
      || intent.principalRevision !== request.expectedPrincipalRevision
      || requirement.requiredPrincipalRef !== request.expectedPrincipalRef
      || requirement.requiredPrincipalRevision !== request.expectedPrincipalRevision) {
      return result(OUTCOMES.NOT_STARTABLE, 'principal mismatch');
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

    if (!covers(intent.contextScope, currentScope)) {
      return result(OUTCOMES.NOT_STARTABLE, 'execution intent does not cover current start scope');
    }

    const material = {
      type: 'GT63_BOUNDED_CONTINUATION_EXECUTION_START',
      schemaVersion: '1.0',
      rulesetVersion: RULESET_VERSION,
      executionIntentId: intent.executionIntentId,
      executionStartRequirementEvidenceRef: requirement.executionStartRequirementEvidenceRef,
      principalRef: request.expectedPrincipalRef,
      principalRevision: request.expectedPrincipalRevision,
      executionTargetRef: request.executionTargetRef,
      contextScope: currentScope,
      startState: 'PERMITTED',
      authority: AUTHORITY,
      executionStartPermitted: true,
      executionStarted: false,
      continuationExecuted: false,
      effectPerformed: false,
      effectVerified: false
    };

    const startRecord = {
      executionStartId: `continuation-execution-start:${digest(material).slice(7)}`,
      ...material
    };

    let prior;
    try {
      prior = startLedger.get(startRecord.executionStartId);
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'execution start ledger unavailable');
    }

    if (prior) {
      return stringify(prior) === stringify(startRecord)
        ? result(OUTCOMES.STARTABLE, 'same execution start already accepted', prior)
        : result(OUTCOMES.UNKNOWN, 'execution start identity conflict');
    }

    try {
      const committed = startLedger.commit(startRecord.executionStartId, Object.freeze(clone(startRecord)));
      if (!committed || stringify(committed) !== stringify(startRecord)) {
        return result(OUTCOMES.UNKNOWN, 'execution start ledger commit conflict');
      }
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'execution start ledger commit conflict');
    }

    return result(OUTCOMES.STARTABLE, null, startRecord);
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
  createBoundedContinuationExecutionStart,
  createMemoryLedger
};
