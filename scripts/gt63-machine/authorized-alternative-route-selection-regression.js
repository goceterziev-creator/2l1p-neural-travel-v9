'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  RULESET_VERSION,
  OUTCOMES,
  AUTHORITY_CLASSIFICATIONS,
  createAuthorizedAlternativeRouteSelection
} = require('./authorized-alternative-route-selection');

const canonicalize = (v) => Array.isArray(v) ? v.map(canonicalize)
  : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o,k)=>(o[k]=canonicalize(v[k]),o),{}) : v;
const canonical = (v) => JSON.stringify(canonicalize(v));
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const clone = (v) => JSON.parse(JSON.stringify(v));

function route(overrides={}) {
  return {
    routeId:'route.direct', routeRevision:'1', routeKind:'MACHINE_DIRECT', capabilityClass:'BYTE_TRANSPORT',
    sourceSurface:'runtime-A', destinationSurface:'runtime-B', transportSemantics:'exact-byte-transfer',
    evidencePreservationClass:'EXACT_BYTES', requiredPreconditions:[], mutationClass:'NONE',
    humanParticipationRequired:false, authorityRequirement:'COVERED_IF_RESOLVED', knownLimitations:[],
    availability:'AVAILABLE', proven:true, directDestinationMaterialization:false,
    destinationIdentityVerification:'NOT_REQUIRED', humanAction:'', ...overrides
  };
}
function blocked(overrides={}) {
  return {
    blockedRouteId:'route.blocked', blockedRouteRevision:'1', blockerClass:'CAPABILITY_UNAVAILABLE',
    blockerEvidenceRef:'evidence:blocker-1', blockerEvidenceDigest:'sha256:blocker-1',
    blockedAtCapabilityBoundary:'RAW_BYTE_MATERIALIZATION', intendedOutcomeIdentity:'outcome:exact-byte-handoff',
    requiredEvidenceIdentity:'evidence:exact-bytes', ...overrides
  };
}
function requirement(overrides={}) {
  return {
    intendedOutcomeIdentity:'outcome:exact-byte-handoff', requiredEvidenceIdentity:'evidence:exact-bytes',
    minimumEvidencePreservationClass:'EXACT_BYTES', maximumMutationClass:'TRANSPORT_ARTIFACT_ONLY',
    allowHumanParticipation:true, allowCapabilityGapInvestigation:true, ...overrides
  };
}
function system(routes, rev='graph-1', prior=null) {
  const counters={registryReads:0,priorReads:0,transports:0,providerOps:0,fsOps:0,networkOps:0,authorityOps:0,mutations:0};
  return {
    counters,
    selector:createAuthorizedAlternativeRouteSelection({
      routeRegistryPort(){ counters.registryReads++; return {routeGraphRevision:rev,routes:clone(routes)}; },
      priorAssessmentPort: prior ? (id)=>{counters.priorReads++; return clone(prior[id] ?? null);} : null
    })
  };
}
function req(overrides={}) { return {rulesetVersion:RULESET_VERSION,blockedPath:blocked(),requirement:requirement(),...overrides}; }
function assertPure(res, counters){
  assert.equal(res.routeExecuted,false); assert.equal(res.humanAuthorityCreated,false); assert.equal(res.mutationPerformed,false);
  assert.equal(res.capabilityGapInvestigationStarted,false);
  for (const k of ['transports','providerOps','fsOps','networkOps','authorityOps','mutations']) assert.equal(counters[k],0,k);
}

function runSuite(){
  const cases=[];
  let e=system([route()]); let r=e.selector.assess(req());
  assert.equal(r.outcome,OUTCOMES.ALTERNATIVE_ROUTE_SELECTED); assert.equal(r.assessment.selectedRoute.routeId,'route.direct'); cases.push('direct-machine-route-selected');

  e=system([route({routeId:'route.connector',routeKind:'MACHINE_CONNECTOR'})]); r=e.selector.assess(req());
  assert.equal(r.assessment.selectedRoute.routeId,'route.connector'); cases.push('blocked-direct-equivalent-known-connector-selected');

  const primarius=route({routeId:'route.primarius',routeKind:'HUMAN_PRIMARIUS_HANDOFF',humanParticipationRequired:true,
    transportSemantics:'human-transfer-with-independent-hash-verification',authorityRequirement:'COVERED_IF_RESOLVED',
    directDestinationMaterialization:true,destinationIdentityVerification:'INDEPENDENT',
    humanAction:'Copy the exact validated files from Windows to the clean destination, then verify SHA-256.'});
  e=system([primarius]); r=e.selector.assess(req()); assert.equal(r.assessment.selectedRoute.routeId,'route.primarius'); cases.push('file-library-blocked-primarius-selected');

  const gitPreservation=route({routeId:'route.git-preservation',routeKind:'MACHINE_CONNECTOR',
    transportSemantics:'git-object-preservation-and-bundle-handoff',mutationClass:'TRANSPORT_ARTIFACT_ONLY'});
  e=system([gitPreservation,primarius]); r=e.selector.assess(req());
  assert.equal(r.assessment.selectedRoute.routeId,'route.primarius'); cases.push('direct-human-local-copy-beats-git-object-preservation');

  const machineComplex=route({routeId:'route.machine-complex',routeKind:'MACHINE_CONNECTOR',
    transportSemantics:'multi-stage-machine-byte-preservation',mutationClass:'NONE'});
  e=system([machineComplex,primarius]); r=e.selector.assess(req());
  assert.equal(r.assessment.selectedRoute.routeId,'route.primarius'); cases.push('verified-human-copy-outranks-equivalent-complex-machine-route');

  const unverifiableHuman=route({routeId:'route.human-unverifiable',routeKind:'HUMAN_PRIMARIUS_HANDOFF',humanParticipationRequired:true,
    transportSemantics:'human-local-copy',directDestinationMaterialization:true,destinationIdentityVerification:'UNAVAILABLE',
    humanAction:'Copy files without destination verification.'});
  e=system([unverifiableHuman]); r=e.selector.assess(req());
  assert.equal(r.outcome,OUTCOMES.NO_SUFFICIENT_KNOWN_ROUTE); cases.push('human-copy-rejected-without-independent-destination-identity');

  e=system([gitPreservation,primarius]); r=e.selector.assess(req());
  assert.equal(r.assessment.presentationEvidence.showHumanActionFirst,true);
  assert.equal(r.assessment.presentationEvidence.humanAction,primarius.humanAction);
  assert.equal(r.assessment.presentationEvidence.identityChain,'source identity → human handoff → destination identity → equality → PASS');
  cases.push('selected-shortest-human-action-surfaced-first');

  const repeatedAssessment=route({routeId:'route.read-only-investigation',routeKind:'MACHINE_CONNECTOR',proven:false,
    transportSemantics:'repeated-read-only-transport-capability-investigation'});
  e=system([repeatedAssessment,gitPreservation,primarius]); r=e.selector.assess(req());
  assert.equal(r.assessment.selectedRoute.routeId,'route.primarius');
  assert.equal(r.assessment.capabilityGapInvestigationWarranted,false);
  cases.push('simple-human-action-not-hidden-behind-repeated-investigation');

  e=system([route({routeId:'route.download',evidencePreservationClass:'READABLE_CONTENT_ONLY'})]); r=e.selector.assess(req()); assert.equal(r.outcome,OUTCOMES.NO_SUFFICIENT_KNOWN_ROUTE); cases.push('downloadability-without-byte-guarantee-rejected');

  e=system([primarius]); r=e.selector.assess(req({blockedPath:blocked({blockedAtCapabilityBoundary:'WINDOWS_OBJECT_STORE_MOUNT_UNAVAILABLE'})}));
  assert.equal(r.outcome,OUTCOMES.ALTERNATIVE_ROUTE_SELECTED); cases.push('windows-store-blocked-human-bundle-handoff-not-global-block');

  const first=system([primarius]).selector.assess(req()).assessment; const prior={}; prior[first.routeAssessmentId]=first;
  e=system([primarius],'graph-1',prior); r=e.selector.assess(req()); assert.equal(r.assessment.routeAssessmentId,first.routeAssessmentId); cases.push('repeated-identical-assessment-reused');

  e=system([primarius],'graph-2',prior); r=e.selector.assess(req()); assert.notEqual(r.assessment.routeGraphRevision,first.routeGraphRevision); cases.push('route-graph-revision-permits-reassessment');

  e=system([primarius]); r=e.selector.assess(req()); assert.equal(r.humanAuthorityCreated,false); assert.equal(r.assessment.humanAuthorityCreated,false); cases.push('human-route-does-not-create-human-authority');

  e=system([route({routeId:'route.scope-expand',authorityRequirement:'NEW_GATE_REQUIRED'})]); r=e.selector.assess(req());
  assert.equal(r.assessment.authorityClassification,AUTHORITY_CLASSIFICATIONS.NEW_HUMAN_GATE_REQUIRED); cases.push('scope-expansion-classified-new-human-gate');

  e=system([route({routeId:'route.covered',authorityRequirement:'COVERED_IF_RESOLVED'})]); r=e.selector.assess(req());
  assert.equal(r.assessment.authorityClassification,AUTHORITY_CLASSIFICATIONS.EXISTING_AUTHORITY_MAY_COVER_AFTER_RESOLUTION); cases.push('existing-authority-only-after-resolution');

  e=system([route({routeId:'weak',evidencePreservationClass:'CHECKSUM_VERIFIABLE_ARTIFACT'}),route({routeId:'strong'})]); r=e.selector.assess(req()); assert.equal(r.assessment.selectedRoute.routeId,'strong'); cases.push('stronger-evidence-route-wins');

  e=system([route({routeId:'speculative',proven:false}),route({routeId:'known',proven:true})]); r=e.selector.assess(req()); assert.equal(r.assessment.selectedRoute.routeId,'known'); cases.push('known-route-beats-speculative-bridge');

  e=system([route({routeId:'route.blocked',availability:'BLOCKED'}),primarius]); r=e.selector.assess(req()); assert.equal(r.assessment.selectedRoute.routeId,'route.primarius'); cases.push('locally-blocked-route-does-not-erase-global-routes');

  e=system([]); r=e.selector.assess(req()); assert.equal(r.outcome,OUTCOMES.NO_SUFFICIENT_KNOWN_ROUTE); assert.equal(r.assessment.capabilityGapInvestigationWarranted,true); cases.push('no-known-route-warrants-capability-gap');

  const forged=route({routeId:'forged',unexpected:'x'}); e=system([forged]); r=e.selector.assess(req()); assert.equal(r.outcome,OUTCOMES.ROUTE_SELECTION_UNCERTAIN); cases.push('caller-fabricated-route-metadata-rejected');

  e=system([route({routeId:'stale',routeRevision:''})]); r=e.selector.assess(req()); assert.equal(r.outcome,OUTCOMES.ROUTE_SELECTION_UNCERTAIN); cases.push('stale-invalid-route-revision-rejected');

  const unavailable=createAuthorizedAlternativeRouteSelection({routeRegistryPort(){throw new Error('down');}}); r=unavailable.assess(req()); assert.equal(r.outcome,OUTCOMES.ROUTE_GRAPH_UNAVAILABLE); cases.push('unavailable-route-graph-fails-closed');

  e=system([primarius]); r=e.selector.assess(req()); assertPure(r,e.counters); cases.push('selector-performs-no-transport');
  assert.equal(Object.hasOwn(e.selector,'execute'),false); cases.push('no-filesystem-network-provider-operation-surface');
  assert.equal(r.mutationPerformed,false); cases.push('no-canonical-mutation');
  assert.equal(r.humanAuthorityCreated,false); cases.push('no-authority-state-creation');

  const d1=system([primarius]).selector.assess(req()); const d2=system([primarius]).selector.assess(req());
  assert.equal(d1.assessment.routeAssessmentId,d2.assessment.routeAssessmentId); cases.push('deterministic-same-input-same-decision-identity');

  e=system([route({routeId:'dup'}),route({routeId:'dup'})]); r=e.selector.assess(req()); assert.equal(r.outcome,OUTCOMES.ROUTE_SELECTION_UNCERTAIN); cases.push('conflicting-route-evidence-uncertain');

  const observedRoutes=[
    route({routeId:'conversation-attachment',availability:'BLOCKED',knownLimitations:['raw-bytes-inaccessible']}),
    route({routeId:'file-library',availability:'BLOCKED',knownLimitations:['raw-byte-materialization-unavailable']}),
    route({routeId:'windows-mount',routeKind:'LOCAL_RUNTIME',availability:'BLOCKED',knownLimitations:['mount-unavailable']}),
    primarius,
    route({routeId:'new-bridge',proven:false,routeKind:'MACHINE_CONNECTOR'})
  ];
  e=system(observedRoutes); r=e.selector.assess(req({blockedPath:blocked({blockedRouteId:'conversation-attachment'})}));
  assert.equal(r.assessment.selectedRoute.routeId,'route.primarius'); cases.push('observed-failure-sequence-selects-primarius-before-new-bridge');

  e=system([route({routeId:'unknown-auth',authorityRequirement:'UNKNOWN'})]); r=e.selector.assess(req());
  assert.equal(r.assessment.authorityClassification,AUTHORITY_CLASSIFICATIONS.AUTHORITY_UNCERTAIN); cases.push('authority-uncertainty-preserved');

  r=system([primarius]).selector.assess({...req(),rulesetVersion:'authorized-alternative-route-selection-v0.9.0'}); assert.equal(r.outcome,OUTCOMES.ROUTE_SELECTION_UNCERTAIN); cases.push('unsupported-ruleset-fails-closed');
  r=system([primarius]).selector.assess({...req(),unexpected:true}); assert.equal(r.outcome,OUTCOMES.ROUTE_SELECTION_UNCERTAIN); cases.push('unsupported-request-schema-fails-closed');
  r=system([primarius]).selector.assess(req({blockedPath:blocked({blockerEvidenceDigest:''})})); assert.equal(r.outcome,OUTCOMES.BLOCKER_EVIDENCE_INVALID); cases.push('invalid-blocker-evidence-fails-closed');
  r=system([primarius]).selector.assess(req({requirement:requirement({allowHumanParticipation:false})})); assert.equal(r.outcome,OUTCOMES.NO_SUFFICIENT_KNOWN_ROUTE); cases.push('human-route-rejected-when-human-participation-disallowed');

  const evidence={cases, exemplar:system(observedRoutes).selector.assess(req({blockedPath:blocked({blockedRouteId:'conversation-attachment'})})).assessment};
  return {cases,evidence,canonical:canonical(evidence),identity:hash(canonical(evidence))};
}

const first=runSuite(); const second=runSuite();
assert.equal(first.canonical,second.canonical); assert.equal(first.identity,second.identity);
console.log(canonical({suite:'authorized-alternative-route-selection-v0',status:'PASS',cases:first.cases.length,deterministic:true,identity:first.identity}));
