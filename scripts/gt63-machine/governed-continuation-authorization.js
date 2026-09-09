'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'governed-continuation-authorization-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
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

function result(outcome, reason, authorization = null) {
  return Object.freeze({
    outcome,
    reason: reason || null,
    authorization: clone(authorization),
    authority: AUTHORITY,
    continuationAuthorized: outcome === OUTCOMES.AUTHORIZED,
    continuationExecuted: false,
    executionAuthorityCreated: false,
    effectPerformed: false
  });
}

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

function createGovernedContinuationAuthorization({ gateSatisfactionPort, continuationRequirementPort, authorizationLedger }) {
  if (typeof gateSatisfactionPort !== 'function' || typeof continuationRequirementPort !== 'function') {
    throw new TypeError('ports required');
  }
  if (!authorizationLedger || typeof authorizationLedger.get !== 'function' || typeof authorizationLedger.commit !== 'function') {
    throw new TypeError('authorizationLedger required');
  }

  function assess(request) {
    const fields = [
      'rulesetVersion', 'gateSatisfactionId', 'interactionId', 'interactionRevision',
      'gateId', 'gateRevision', 'authorityScopeDigest', 'continuationTargetRef',
      'expectedPrincipalRef', 'expectedPrincipalRevision'
    ];

    if (!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key => !fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.gateSatisfactionId)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision)
      || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision)
      || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)) {
      return result(OUTCOMES.INVALID, 'unsupported request schema or ruleset');
    }

    let satisfaction;
    try {
      satisfaction = gateSatisfactionPort({ satisfactionId: request.gateSatisfactionId });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'gate satisfaction unavailable');
    }

    if (!plain(satisfaction)
      || satisfaction.satisfactionId !== request.gateSatisfactionId
      || satisfaction.type !== 'GT63_HUMAN_GATE_AUTHORIZATION_CONSUMPTION'
      || satisfaction.satisfactionState !== 'SATISFIED'
      || satisfaction.humanGateSatisfied !== true
      || satisfaction.authority !== AUTHORITY
      || satisfaction.continuationExecuted !== false
      || satisfaction.executionAuthorityCreated !== false
      || satisfaction.effectPerformed !== false
      || satisfaction.lifecycleState !== 'CURRENT'
      || satisfaction.freshnessState !== 'CURRENT'
      || satisfaction.contradictionState !== 'NONE'
      || !validScope(satisfaction.contextScope)) {
      return result(OUTCOMES.UNKNOWN, 'gate satisfaction invalid or non-current');
    }

    let requirement;
    try {
      requirement = continuationRequirementPort({
        continuationTargetRef: request.continuationTargetRef,
        interactionId: request.interactionId,
        interactionRevision: request.interactionRevision
      });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'continuation requirement unavailable');
    }

    if (!plain(requirement)
      || !nonEmpty(requirement.continuationRequirementEvidenceRef)
      || requirement.lifecycleState !== 'CURRENT'
      || requirement.freshnessState !== 'CURRENT'
      || requirement.contradictionState !== 'NONE'
      || requirement.authority !== AUTHORITY) {
      return result(OUTCOMES.UNKNOWN, 'continuation requirement invalid or non-current');
    }

    if (requirement.interactionId !== request.interactionId
      || requirement.gateId !== request.gateId
      || requirement.gateRevision !== request.gateRevision
      || requirement.authorityScopeDigest !== request.authorityScopeDigest
      || requirement.continuationTargetRef !== request.continuationTargetRef
      || request.interactionRevision < requirement.fromInteractionRevision
      || (requirement.throughInteractionRevision !== null
        && request.interactionRevision > requirement.throughInteractionRevision)) {
      return result(OUTCOMES.NOT_AUTHORIZED, 'continuation requirement mismatch');
    }

    if (satisfaction.principalRef !== request.expectedPrincipalRef
      || satisfaction.principalRevision !== request.expectedPrincipalRevision
      || requirement.requiredPrincipalRef !== request.expectedPrincipalRef
      || requirement.requiredPrincipalRevision !== request.expectedPrincipalRevision) {
      return result(OUTCOMES.NOT_AUTHORIZED, 'principal mismatch');
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

    if (!covers(satisfaction.contextScope, currentScope)) {
      return result(OUTCOMES.NOT_AUTHORIZED, 'gate satisfaction does not cover current continuation scope');
    }

    const material = {
      type: 'GT63_GOVERNED_CONTINUATION_AUTHORIZATION',
      schemaVersion: '1.0',
      rulesetVersion: RULESET_VERSION,
      gateSatisfactionId: satisfaction.satisfactionId,
      continuationRequirementEvidenceRef: requirement.continuationRequirementEvidenceRef,
      principalRef: request.expectedPrincipalRef,
      principalRevision: request.expectedPrincipalRevision,
      contextScope: currentScope,
      authorizationState: 'AUTHORIZED',
      authority: AUTHORITY,
      continuationAuthorized: true,
      continuationExecuted: false,
      executionAuthorityCreated: false,
      effectPerformed: false
    };

    const authorization = {
      continuationAuthorizationId: `continuation-authorization:${digest(material).slice(7)}`,
      ...material
    };

    let prior;
    try {
      prior = authorizationLedger.get(authorization.continuationAuthorizationId);
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'continuation authorization ledger unavailable');
    }

    if (prior) {
      return stringify(prior) === stringify(authorization)
        ? result(OUTCOMES.AUTHORIZED, 'same continuation authorization already accepted', prior)
        : result(OUTCOMES.UNKNOWN, 'continuation authorization identity conflict');
    }

    try {
      const committed = authorizationLedger.commit(
        authorization.continuationAuthorizationId,
        Object.freeze(clone(authorization))
      );
      if (!committed || stringify(committed) !== stringify(authorization)) {
        return result(OUTCOMES.UNKNOWN, 'continuation authorization ledger commit conflict');
      }
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'continuation authorization ledger commit conflict');
    }

    return result(OUTCOMES.AUTHORIZED, null, authorization);
  }

  return Object.freeze({ assess, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

function createMemoryLedger() {
  const records = new Map();
  return Object.freeze({
    get(key) {
      return records.has(key) ? records.get(key) : null;
    },
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
  createGovernedContinuationAuthorization,
  createMemoryLedger
};
