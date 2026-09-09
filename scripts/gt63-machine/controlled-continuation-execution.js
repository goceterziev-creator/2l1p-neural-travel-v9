'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'controlled-continuation-execution-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({
  EXECUTABLE: 'EXECUTABLE',
  NOT_EXECUTABLE: 'NOT_EXECUTABLE',
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

function result(outcome, reason, executionIntent = null) {
  return Object.freeze({
    outcome,
    reason: reason || null,
    executionIntent: clone(executionIntent),
    authority: AUTHORITY,
    continuationExecutionPermitted: outcome === OUTCOMES.EXECUTABLE,
    continuationExecuted: false,
    executionStarted: false,
    effectPerformed: false,
    effectVerified: false
  });
}

function createControlledContinuationExecution({ continuationAuthorizationPort, executionRequirementPort, executionLedger }) {
  if (typeof continuationAuthorizationPort !== 'function' || typeof executionRequirementPort !== 'function') {
    throw new TypeError('ports required');
  }
  if (!executionLedger || typeof executionLedger.get !== 'function' || typeof executionLedger.commit !== 'function') {
    throw new TypeError('executionLedger required');
  }

  function assess(request) {
    const fields = [
      'rulesetVersion', 'continuationAuthorizationId', 'interactionId', 'interactionRevision',
      'gateId', 'gateRevision', 'authorityScopeDigest', 'continuationTargetRef',
      'expectedPrincipalRef', 'expectedPrincipalRevision', 'executionTargetRef'
    ];

    if (!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key => !fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.continuationAuthorizationId)
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

    let authorization;
    try {
      authorization = continuationAuthorizationPort({ continuationAuthorizationId: request.continuationAuthorizationId });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'continuation authorization unavailable');
    }

    if (!plain(authorization)
      || authorization.continuationAuthorizationId !== request.continuationAuthorizationId
      || authorization.type !== 'GT63_GOVERNED_CONTINUATION_AUTHORIZATION'
      || authorization.authorizationState !== 'AUTHORIZED'
      || authorization.continuationAuthorized !== true
      || authorization.authority !== AUTHORITY
      || authorization.continuationExecuted !== false
      || authorization.executionAuthorityCreated !== false
      || authorization.effectPerformed !== false
      || authorization.lifecycleState !== 'CURRENT'
      || authorization.freshnessState !== 'CURRENT'
      || authorization.contradictionState !== 'NONE'
      || !validScope(authorization.contextScope)) {
      return result(OUTCOMES.UNKNOWN, 'continuation authorization invalid or non-current');
    }

    let requirement;
    try {
      requirement = executionRequirementPort({
        executionTargetRef: request.executionTargetRef,
        continuationTargetRef: request.continuationTargetRef,
        interactionId: request.interactionId,
        interactionRevision: request.interactionRevision
      });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'execution requirement unavailable');
    }

    if (!plain(requirement)
      || !nonEmpty(requirement.executionRequirementEvidenceRef)
      || requirement.lifecycleState !== 'CURRENT'
      || requirement.freshnessState !== 'CURRENT'
      || requirement.contradictionState !== 'NONE'
      || requirement.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN, 'execution requirement invalid or non-current');
    }

    if (requirement.interactionId !== request.interactionId
      || requirement.gateId !== request.gateId
      || requirement.gateRevision !== request.gateRevision
      || requirement.authorityScopeDigest !== request.authorityScopeDigest
      || requirement.continuationTargetRef !== request.continuationTargetRef
      || requirement.executionTargetRef !== request.executionTargetRef
      || request.interactionRevision < requirement.fromInteractionRevision
      || (requirement.throughInteractionRevision !== null
        && request.interactionRevision > requirement.throughInteractionRevision)) {
      return result(OUTCOMES.NOT_EXECUTABLE, 'execution requirement mismatch');
    }

    if (authorization.principalRef !== request.expectedPrincipalRef
      || authorization.principalRevision !== request.expectedPrincipalRevision
      || requirement.requiredPrincipalRef !== request.expectedPrincipalRef
      || requirement.requiredPrincipalRevision !== request.expectedPrincipalRevision) {
      return result(OUTCOMES.NOT_EXECUTABLE, 'principal mismatch');
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

    if (!covers(authorization.contextScope, currentScope)) {
      return result(OUTCOMES.NOT_EXECUTABLE, 'continuation authorization does not cover current execution scope');
    }

    const material = {
      type: 'GT63_CONTROLLED_CONTINUATION_EXECUTION_INTENT',
      schemaVersion: '1.0',
      rulesetVersion: RULESET_VERSION,
      continuationAuthorizationId: authorization.continuationAuthorizationId,
      executionRequirementEvidenceRef: requirement.executionRequirementEvidenceRef,
      principalRef: request.expectedPrincipalRef,
      principalRevision: request.expectedPrincipalRevision,
      executionTargetRef: request.executionTargetRef,
      contextScope: currentScope,
      executionState: 'PERMITTED',
      authority: AUTHORITY,
      continuationExecutionPermitted: true,
      continuationExecuted: false,
      executionStarted: false,
      effectPerformed: false,
      effectVerified: false
    };

    const executionIntent = {
      executionIntentId: `continuation-execution-intent:${digest(material).slice(7)}`,
      ...material
    };

    let prior;
    try {
      prior = executionLedger.get(executionIntent.executionIntentId);
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'execution ledger unavailable');
    }

    if (prior) {
      return stringify(prior) === stringify(executionIntent)
        ? result(OUTCOMES.EXECUTABLE, 'same execution intent already accepted', prior)
        : result(OUTCOMES.UNKNOWN, 'execution intent identity conflict');
    }

    try {
      const committed = executionLedger.commit(executionIntent.executionIntentId, Object.freeze(clone(executionIntent)));
      if (!committed || stringify(committed) !== stringify(executionIntent)) {
        return result(OUTCOMES.UNKNOWN, 'execution ledger commit conflict');
      }
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'execution ledger commit conflict');
    }

    return result(OUTCOMES.EXECUTABLE, null, executionIntent);
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
  createControlledContinuationExecution,
  createMemoryLedger
};
