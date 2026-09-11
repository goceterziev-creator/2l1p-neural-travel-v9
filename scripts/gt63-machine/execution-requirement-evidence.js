'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'execution-requirement-evidence-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({
  RESOLVED: 'RESOLVED',
  NOT_RESOLVED: 'NOT_RESOLVED',
  UNKNOWN: 'UNKNOWN',
  INVALID: 'INVALID'
});

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const plain = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const nonEmpty = value => typeof value === 'string' && value.length > 0;
const canonicalize = value => Array.isArray(value)
  ? value.map(canonicalize)
  : (plain(value)
      ? Object.keys(value).sort().reduce((out, key) => (out[key] = canonicalize(value[key]), out), {})
      : value);
const stringify = value => JSON.stringify(canonicalize(value));
const digest = value => `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(value), 'utf8')).digest('hex')}`;

function result(outcome, reason, evidence = null) {
  return Object.freeze({
    rulesetVersion: RULESET_VERSION,
    outcome,
    reason: reason || null,
    evidence: clone(evidence),
    authority: AUTHORITY,
    executionPermitted: false,
    executionStartPermitted: false,
    continuationExecuted: false,
    executionStarted: false,
    effectAuthorized: false,
    effectPerformed: false
  });
}

function validMaterial(material) {
  const fields = [
    'executionTargetRef','continuationTargetRef','interactionId','fromInteractionRevision','throughInteractionRevision',
    'gateId','gateRevision','authorityScopeDigest','requiredPrincipalRef','requiredPrincipalRevision',
    'lifecycleState','freshnessState','contradictionState'
  ];
  return plain(material)
    && Object.keys(material).length === fields.length
    && Object.keys(material).every(key => fields.includes(key))
    && nonEmpty(material.executionTargetRef)
    && nonEmpty(material.continuationTargetRef)
    && nonEmpty(material.interactionId)
    && Number.isInteger(material.fromInteractionRevision) && material.fromInteractionRevision >= 0
    && (material.throughInteractionRevision === null
      || (Number.isInteger(material.throughInteractionRevision)
        && material.throughInteractionRevision >= material.fromInteractionRevision))
    && nonEmpty(material.gateId)
    && Number.isInteger(material.gateRevision) && material.gateRevision > 0
    && /^sha256:[0-9a-f]{64}$/.test(material.authorityScopeDigest)
    && nonEmpty(material.requiredPrincipalRef)
    && nonEmpty(material.requiredPrincipalRevision)
    && material.lifecycleState === 'CURRENT'
    && material.freshnessState === 'CURRENT'
    && material.contradictionState === 'NONE';
}

function createExecutionRequirementEvidence({ requirementSourcePort } = {}) {
  if (typeof requirementSourcePort !== 'function') {
    throw new TypeError('requirementSourcePort must be a function');
  }

  function resolve(request) {
    const fields = [
      'rulesetVersion','executionTargetRef','continuationTargetRef','interactionId','interactionRevision',
      'gateId','gateRevision','authorityScopeDigest','expectedPrincipalRef','expectedPrincipalRevision'
    ];
    if (!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(key => !fields.includes(key))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.executionTargetRef)
      || !nonEmpty(request.continuationTargetRef)
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision < 0
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision < 1
      || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)
      || !nonEmpty(request.expectedPrincipalRef)
      || !nonEmpty(request.expectedPrincipalRevision)) {
      return result(OUTCOMES.INVALID, 'unsupported request schema or ruleset');
    }

    let material;
    try {
      material = requirementSourcePort({
        executionTargetRef: request.executionTargetRef,
        continuationTargetRef: request.continuationTargetRef,
        interactionId: request.interactionId,
        interactionRevision: request.interactionRevision
      });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'execution requirement source unavailable');
    }

    if (material == null) return result(OUTCOMES.NOT_RESOLVED, 'execution requirement not found');
    if (!validMaterial(material)) return result(OUTCOMES.UNKNOWN, 'execution requirement invalid, non-current, stale, or contradictory');

    if (material.executionTargetRef !== request.executionTargetRef
      || material.continuationTargetRef !== request.continuationTargetRef
      || material.interactionId !== request.interactionId
      || material.gateId !== request.gateId
      || material.gateRevision !== request.gateRevision
      || material.authorityScopeDigest !== request.authorityScopeDigest
      || material.requiredPrincipalRef !== request.expectedPrincipalRef
      || material.requiredPrincipalRevision !== request.expectedPrincipalRevision
      || request.interactionRevision < material.fromInteractionRevision
      || (material.throughInteractionRevision !== null
        && request.interactionRevision > material.throughInteractionRevision)) {
      return result(OUTCOMES.NOT_RESOLVED, 'execution requirement does not match requested execution scope');
    }

    const evidenceMaterial = {
      type: 'GT63_EXECUTION_REQUIREMENT_EVIDENCE',
      schemaVersion: '1.0',
      rulesetVersion: RULESET_VERSION,
      executionTargetRef: material.executionTargetRef,
      continuationTargetRef: material.continuationTargetRef,
      interactionId: material.interactionId,
      fromInteractionRevision: material.fromInteractionRevision,
      throughInteractionRevision: material.throughInteractionRevision,
      gateId: material.gateId,
      gateRevision: material.gateRevision,
      authorityScopeDigest: material.authorityScopeDigest,
      requiredPrincipalRef: material.requiredPrincipalRef,
      requiredPrincipalRevision: material.requiredPrincipalRevision,
      lifecycleState: 'CURRENT',
      freshnessState: 'CURRENT',
      contradictionState: 'NONE',
      authority: AUTHORITY,
      executionPermitted: false,
      executionStartPermitted: false,
      continuationExecuted: false,
      executionStarted: false,
      effectAuthorized: false,
      effectPerformed: false
    };

    const evidence = Object.freeze({
      executionRequirementEvidenceRef: `gt63-evidence:execution-requirement:${digest(evidenceMaterial).slice(7)}`,
      ...evidenceMaterial
    });
    return result(OUTCOMES.RESOLVED, null, evidence);
  }

  return Object.freeze({ resolve, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createExecutionRequirementEvidence
});
