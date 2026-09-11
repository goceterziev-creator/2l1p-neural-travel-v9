'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'gate-requirement-evidence-v0.1.0';
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
const canonicalize = value => Array.isArray(value) ? value.map(canonicalize) : (plain(value) ? Object.keys(value).sort().reduce((out,key)=>(out[key]=canonicalize(value[key]),out),{}) : value);
const stringify = value => JSON.stringify(canonicalize(value));
const digest = value => `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(value),'utf8')).digest('hex')}`;

function result(outcome, reason, evidence = null) {
  return Object.freeze({
    rulesetVersion: RULESET_VERSION,
    outcome,
    reason: reason || null,
    evidence: clone(evidence),
    authority: AUTHORITY,
    humanGateSatisfied: false,
    continuationAuthorized: false,
    continuationExecuted: false,
    executionAuthorityCreated: false,
    effectAuthorized: false,
    effectPerformed: false
  });
}

function validMaterial(material) {
  const fields = [
    'gateId','gateRevision','interactionId','fromInteractionRevision','throughInteractionRevision',
    'authorityScopeDigest','continuationTargetRef','requiredPrincipalRef','requiredPrincipalRevision',
    'lifecycleState','temporalState','contradictionState'
  ];
  return plain(material)
    && Object.keys(material).length === fields.length
    && Object.keys(material).every(k => fields.includes(k))
    && nonEmpty(material.gateId)
    && Number.isInteger(material.gateRevision) && material.gateRevision > 0
    && nonEmpty(material.interactionId)
    && Number.isInteger(material.fromInteractionRevision) && material.fromInteractionRevision >= 0
    && (material.throughInteractionRevision === null || (Number.isInteger(material.throughInteractionRevision) && material.throughInteractionRevision >= material.fromInteractionRevision))
    && /^sha256:[0-9a-f]{64}$/.test(material.authorityScopeDigest)
    && nonEmpty(material.continuationTargetRef)
    && nonEmpty(material.requiredPrincipalRef)
    && nonEmpty(material.requiredPrincipalRevision)
    && material.lifecycleState === 'CURRENT'
    && material.temporalState === 'CURRENT'
    && material.contradictionState === 'NONE';
}

function createGateRequirementEvidence({ requirementSourcePort } = {}) {
  if (typeof requirementSourcePort !== 'function') throw new TypeError('requirementSourcePort must be a function');

  function resolve(request) {
    const fields = ['rulesetVersion','gateId','gateRevision','interactionId','interactionRevision'];
    if (!plain(request)
      || Object.keys(request).length !== fields.length
      || Object.keys(request).some(k => !fields.includes(k))
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.gateId)
      || !Number.isInteger(request.gateRevision) || request.gateRevision < 1
      || !nonEmpty(request.interactionId)
      || !Number.isInteger(request.interactionRevision) || request.interactionRevision < 0) {
      return result(OUTCOMES.INVALID, 'unsupported request schema or ruleset');
    }

    let material;
    try {
      material = requirementSourcePort({
        gateId: request.gateId,
        gateRevision: request.gateRevision,
        interactionId: request.interactionId,
        interactionRevision: request.interactionRevision
      });
    } catch (_) {
      return result(OUTCOMES.UNKNOWN, 'gate requirement source unavailable');
    }

    if (material == null) return result(OUTCOMES.NOT_RESOLVED, 'gate requirement not found');
    if (!validMaterial(material)) return result(OUTCOMES.UNKNOWN, 'gate requirement invalid, non-current, or contradictory');
    if (material.gateId !== request.gateId
      || material.gateRevision !== request.gateRevision
      || material.interactionId !== request.interactionId
      || request.interactionRevision < material.fromInteractionRevision
      || (material.throughInteractionRevision !== null && request.interactionRevision > material.throughInteractionRevision)) {
      return result(OUTCOMES.NOT_RESOLVED, 'gate requirement does not cover requested interaction revision');
    }

    const evidenceMaterial = {
      type: 'GT63_GATE_REQUIREMENT_EVIDENCE',
      schemaVersion: '1.0',
      rulesetVersion: RULESET_VERSION,
      gateId: material.gateId,
      gateRevision: material.gateRevision,
      interactionId: material.interactionId,
      fromInteractionRevision: material.fromInteractionRevision,
      throughInteractionRevision: material.throughInteractionRevision,
      authorityScopeDigest: material.authorityScopeDigest,
      continuationTargetRef: material.continuationTargetRef,
      requiredPrincipalRef: material.requiredPrincipalRef,
      requiredPrincipalRevision: material.requiredPrincipalRevision,
      lifecycleState: 'CURRENT',
      temporalState: 'CURRENT',
      contradictionState: 'NONE',
      authority: AUTHORITY,
      humanGateSatisfied: false,
      continuationAuthorized: false,
      continuationExecuted: false,
      executionAuthorityCreated: false,
      effectAuthorized: false,
      effectPerformed: false
    };

    const evidence = Object.freeze({
      gateRequirementEvidenceRef: `gt63-evidence:gate-requirement:${digest(evidenceMaterial).slice(7)}`,
      ...evidenceMaterial
    });
    return result(OUTCOMES.RESOLVED, null, evidence);
  }

  return Object.freeze({ resolve, rulesetVersion: RULESET_VERSION, authority: AUTHORITY });
}

module.exports = Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createGateRequirementEvidence });
