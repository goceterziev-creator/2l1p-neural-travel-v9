'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'authorized-alternative-route-selection-v1.0.0';

const ROUTE_KINDS = Object.freeze([
  'MACHINE_DIRECT',
  'MACHINE_CONNECTOR',
  'LOCAL_RUNTIME',
  'HUMAN_PRIMARIUS_HANDOFF'
]);

const EVIDENCE_PRESERVATION_CLASSES = Object.freeze([
  'EXACT_BYTES',
  'CHECKSUM_VERIFIABLE_ARTIFACT',
  'READABLE_CONTENT_ONLY',
  'METADATA_ONLY'
]);

const MUTATION_CLASSES = Object.freeze([
  'NONE',
  'TRANSPORT_ARTIFACT_ONLY',
  'CANONICAL_MUTATION'
]);

const AUTHORITY_CLASSIFICATIONS = Object.freeze([
  'EXISTING_AUTHORITY_MAY_COVER_AFTER_RESOLUTION',
  'NEW_HUMAN_GATE_REQUIRED',
  'AUTHORITY_UNCERTAIN'
]);

const OUTCOMES = Object.freeze([
  'ALTERNATIVE_ROUTE_SELECTED',
  'NO_SUFFICIENT_KNOWN_ROUTE',
  'ROUTE_GRAPH_UNAVAILABLE',
  'BLOCKER_EVIDENCE_INVALID',
  'ROUTE_SELECTION_UNCERTAIN'
]);

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
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;

function result(outcome, reason, assessment = null) {
  return Object.freeze({
    outcome,
    reason: reason || null,
    assessment: clone(assessment),
    routeExecuted: false,
    humanAuthorityCreated: false,
    mutationPerformed: false,
    capabilityGapInvestigationStarted: false
  });
}

function validBlockedPath(blocked) {
  return Boolean(blocked
    && nonEmptyString(blocked.blockedRouteId)
    && nonEmptyString(blocked.blockedRouteRevision)
    && nonEmptyString(blocked.blockerClass)
    && nonEmptyString(blocked.blockerEvidenceRef)
    && nonEmptyString(blocked.blockerEvidenceDigest)
    && nonEmptyString(blocked.blockedAtCapabilityBoundary)
    && nonEmptyString(blocked.intendedOutcomeIdentity)
    && nonEmptyString(blocked.requiredEvidenceIdentity));
}

function validRequirement(req) {
  return Boolean(req
    && nonEmptyString(req.intendedOutcomeIdentity)
    && nonEmptyString(req.requiredEvidenceIdentity)
    && EVIDENCE_PRESERVATION_CLASSES.includes(req.minimumEvidencePreservationClass)
    && MUTATION_CLASSES.includes(req.maximumMutationClass)
    && typeof req.allowHumanParticipation === 'boolean'
    && typeof req.allowCapabilityGapInvestigation === 'boolean');
}

function preservationRank(value) {
  return {
    EXACT_BYTES: 4,
    CHECKSUM_VERIFIABLE_ARTIFACT: 3,
    READABLE_CONTENT_ONLY: 2,
    METADATA_ONLY: 1
  }[value] || 0;
}

function mutationRank(value) {
  return { NONE: 0, TRANSPORT_ARTIFACT_ONLY: 1, CANONICAL_MUTATION: 2 }[value] ?? 99;
}

function validRoute(route) {
  const keys = [
    'routeId', 'routeRevision', 'routeKind', 'capabilityClass', 'sourceSurface',
    'destinationSurface', 'transportSemantics', 'evidencePreservationClass',
    'mutationClass', 'authorityRequirement', 'availability'
  ];
  if (!route || keys.some((k) => !nonEmptyString(route[k]))) return false;
  if (!ROUTE_KINDS.includes(route.routeKind)) return false;
  if (!EVIDENCE_PRESERVATION_CLASSES.includes(route.evidencePreservationClass)) return false;
  if (!MUTATION_CLASSES.includes(route.mutationClass)) return false;
  if (!['AVAILABLE', 'BLOCKED', 'UNKNOWN'].includes(route.availability)) return false;
  if (!['COVERED_IF_RESOLVED', 'NEW_GATE_REQUIRED', 'UNKNOWN'].includes(route.authorityRequirement)) return false;
  if (typeof route.proven !== 'boolean') return false;
  if (typeof route.humanParticipationRequired !== 'boolean') return false;
  if (typeof route.directDestinationMaterialization !== 'boolean') return false;
  if (!['INDEPENDENT', 'UNAVAILABLE', 'NOT_REQUIRED'].includes(route.destinationIdentityVerification)) return false;
  if (route.humanParticipationRequired && route.directDestinationMaterialization && !nonEmptyString(route.humanAction)) return false;
  if (!Array.isArray(route.requiredPreconditions) || !Array.isArray(route.knownLimitations)) return false;
  if (Object.keys(route).some((k) => ![
    'routeId','routeRevision','routeKind','capabilityClass','sourceSurface','destinationSurface',
    'transportSemantics','evidencePreservationClass','requiredPreconditions','mutationClass',
    'humanParticipationRequired','authorityRequirement','knownLimitations','availability','proven',
    'directDestinationMaterialization','destinationIdentityVerification','humanAction'
  ].includes(k))) return false;
  return true;
}

function authorityClassification(route) {
  if (route.authorityRequirement === 'COVERED_IF_RESOLVED') {
    return AUTHORITY_CLASSIFICATIONS.EXISTING_AUTHORITY_MAY_COVER_AFTER_RESOLUTION;
  }
  if (route.authorityRequirement === 'NEW_GATE_REQUIRED') {
    return AUTHORITY_CLASSIFICATIONS.NEW_HUMAN_GATE_REQUIRED;
  }
  return AUTHORITY_CLASSIFICATIONS.AUTHORITY_UNCERTAIN;
}

function verifiedDirectHumanHandoff(route) {
  return Boolean(route.routeKind === 'HUMAN_PRIMARIUS_HANDOFF'
    && route.humanParticipationRequired
    && route.directDestinationMaterialization
    && route.destinationIdentityVerification === 'INDEPENDENT'
    && nonEmptyString(route.humanAction));
}

function isSufficient(route, requirement) {
  if (route.availability !== 'AVAILABLE') return false;
  if (!requirement.allowHumanParticipation && route.humanParticipationRequired) return false;
  if (preservationRank(route.evidencePreservationClass) < preservationRank(requirement.minimumEvidencePreservationClass)) return false;
  if (mutationRank(route.mutationClass) > mutationRank(requirement.maximumMutationClass)) return false;
  if (route.requiredPreconditions.includes('UNSATISFIED')) return false;
  if (route.humanParticipationRequired && route.directDestinationMaterialization
    && route.destinationIdentityVerification !== 'INDEPENDENT') return false;
  return true;
}

function routeSortKey(route) {
  const evidence = -preservationRank(route.evidencePreservationClass);
  const proven = route.proven ? 0 : 1;
  const authority = route.authorityRequirement === 'COVERED_IF_RESOLVED' ? 0
    : route.authorityRequirement === 'NEW_GATE_REQUIRED' ? 1 : 2;
  const mutation = mutationRank(route.mutationClass);
  const directHumanPreference = verifiedDirectHumanHandoff(route) ? 0
    : route.routeKind === 'MACHINE_DIRECT' ? 0 : 1;
  const semanticChange = route.routeKind === 'MACHINE_DIRECT' ? 0
    : verifiedDirectHumanHandoff(route) ? 1
      : route.routeKind === 'MACHINE_CONNECTOR' ? 2
        : route.routeKind === 'LOCAL_RUNTIME' ? 3 : 4;
  const capabilityNovelty = route.proven ? 0 : 1;
  const operationalComplexity = verifiedDirectHumanHandoff(route) ? 0
    : route.humanParticipationRequired ? 2
      : route.routeKind === 'MACHINE_DIRECT' ? 0 : 1;
  return [evidence, proven, authority, mutation, directHumanPreference, semanticChange,
    capabilityNovelty, operationalComplexity, route.routeId, route.routeRevision];
}

function compareKeys(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function createAuthorizedAlternativeRouteSelection({ routeRegistryPort, priorAssessmentPort = null }) {
  if (typeof routeRegistryPort !== 'function') {
    throw new TypeError('routeRegistryPort must be a function');
  }
  if (priorAssessmentPort !== null && typeof priorAssessmentPort !== 'function') {
    throw new TypeError('priorAssessmentPort must be a function or null');
  }

  function assess(request) {
    if (!request || request.rulesetVersion !== RULESET_VERSION) {
      return result(OUTCOMES.ROUTE_SELECTION_UNCERTAIN, 'unsupported or missing ruleset');
    }
    const allowed = ['rulesetVersion', 'blockedPath', 'requirement'];
    if (Object.keys(request).some((k) => !allowed.includes(k))) {
      return result(OUTCOMES.ROUTE_SELECTION_UNCERTAIN, 'unsupported request schema');
    }
    if (!validBlockedPath(request.blockedPath)) {
      return result(OUTCOMES.BLOCKER_EVIDENCE_INVALID, 'blocked-path evidence is incomplete');
    }
    if (!validRequirement(request.requirement)) {
      return result(OUTCOMES.ROUTE_SELECTION_UNCERTAIN, 'requirement is invalid');
    }
    if (request.blockedPath.intendedOutcomeIdentity !== request.requirement.intendedOutcomeIdentity
      || request.blockedPath.requiredEvidenceIdentity !== request.requirement.requiredEvidenceIdentity) {
      return result(OUTCOMES.BLOCKER_EVIDENCE_INVALID, 'blocker and requirement identity mismatch');
    }

    let registry;
    try {
      registry = routeRegistryPort();
    } catch (_) {
      return result(OUTCOMES.ROUTE_GRAPH_UNAVAILABLE, 'authoritative route registry unavailable');
    }
    if (!registry || !nonEmptyString(registry.routeGraphRevision) || !Array.isArray(registry.routes)) {
      return result(OUTCOMES.ROUTE_GRAPH_UNAVAILABLE, 'authoritative route registry invalid');
    }
    if (registry.routes.some((r) => !validRoute(r))) {
      return result(OUTCOMES.ROUTE_SELECTION_UNCERTAIN, 'route registry contains invalid route records');
    }
    const duplicate = registry.routes.some((r, i, arr) => arr.findIndex(x => x.routeId === r.routeId && x.routeRevision === r.routeRevision) !== i);
    if (duplicate) return result(OUTCOMES.ROUTE_SELECTION_UNCERTAIN, 'route registry contains duplicate route identity');

    const assessmentBinding = {
      intendedOutcomeIdentity: request.requirement.intendedOutcomeIdentity,
      requiredEvidenceIdentity: request.requirement.requiredEvidenceIdentity,
      blockedRouteId: request.blockedPath.blockedRouteId,
      blockedRouteRevision: request.blockedPath.blockedRouteRevision,
      blockerEvidenceDigest: request.blockedPath.blockerEvidenceDigest,
      routeGraphRevision: registry.routeGraphRevision,
      minimumEvidencePreservationClass: request.requirement.minimumEvidencePreservationClass,
      maximumMutationClass: request.requirement.maximumMutationClass,
      allowHumanParticipation: request.requirement.allowHumanParticipation
    };
    const routeAssessmentId = `route-assessment:${sha256(canonicalStringify(assessmentBinding))}`;

    if (priorAssessmentPort) {
      let prior;
      try { prior = priorAssessmentPort(routeAssessmentId); } catch (_) {
        return result(OUTCOMES.ROUTE_SELECTION_UNCERTAIN, 'prior route assessment unavailable');
      }
      if (prior !== null && prior !== undefined) {
        if (!prior || prior.routeAssessmentId !== routeAssessmentId || prior.routeGraphRevision !== registry.routeGraphRevision) {
          return result(OUTCOMES.ROUTE_SELECTION_UNCERTAIN, 'prior route assessment identity conflict');
        }
        return result(prior.outcome, 'same route assessment already exists', prior);
      }
    }

    const sufficient = registry.routes
      .filter((r) => !(r.routeId === request.blockedPath.blockedRouteId && r.routeRevision === request.blockedPath.blockedRouteRevision))
      .filter((r) => isSufficient(r, request.requirement))
      .sort((a, b) => compareKeys(routeSortKey(a), routeSortKey(b)));

    if (sufficient.length === 0) {
      const assessment = Object.freeze({
        type: 'AUTHORIZED_ALTERNATIVE_ROUTE_ASSESSMENT',
        status: 'NO_SUFFICIENT_KNOWN_ROUTE',
        routeAssessmentId,
        routeGraphRevision: registry.routeGraphRevision,
        ...clone(assessmentBinding),
        selectedRoute: null,
        authorityClassification: null,
        capabilityGapInvestigationWarranted: request.requirement.allowCapabilityGapInvestigation,
        routeExecuted: false,
        humanAuthorityCreated: false,
        mutationPerformed: false
      });
      return result(OUTCOMES.NO_SUFFICIENT_KNOWN_ROUTE, null, assessment);
    }

    const selected = sufficient[0];
    const assessment = Object.freeze({
      type: 'AUTHORIZED_ALTERNATIVE_ROUTE_ASSESSMENT',
      status: 'ALTERNATIVE_ROUTE_SELECTED',
      routeAssessmentId,
      routeGraphRevision: registry.routeGraphRevision,
      ...clone(assessmentBinding),
      selectedRoute: clone(selected),
      authorityClassification: authorityClassification(selected),
      capabilityGapInvestigationWarranted: false,
      presentationEvidence: verifiedDirectHumanHandoff(selected) ? Object.freeze({
        showHumanActionFirst: true,
        humanAction: selected.humanAction,
        identityChain: 'source identity → human handoff → destination identity → equality → PASS'
      }) : null,
      routeExecuted: false,
      humanAuthorityCreated: false,
      mutationPerformed: false
    });
    return result(OUTCOMES.ALTERNATIVE_ROUTE_SELECTED, null, assessment);
  }

  return Object.freeze({ assess });
}

module.exports = {
  RULESET_VERSION,
  ROUTE_KINDS,
  EVIDENCE_PRESERVATION_CLASSES,
  MUTATION_CLASSES,
  AUTHORITY_CLASSIFICATIONS,
  OUTCOMES,
  createAuthorizedAlternativeRouteSelection
};
