"use strict";

const assert = require("assert");
const crypto = require("crypto");
const {
  RULESET_VERSION: R,
  SCHEMA_VERSION_V01: S01,
  assessRuntimeResultOutputObservation: assessV0,
  assessRuntimeResultOutputObservationV01: assessV01,
} = require("./gt63-machine/runtime-result-output-observation");

const tests=[];
function test(name,fn){tests.push([name,fn]);}
function clone(value){return JSON.parse(JSON.stringify(value));}
function ev(o={}){return {observed:false,subjectBound:true,frameBound:true,provenanceValid:true,sourceTrusted:true,...o};}
function out(o={}){return {bytesObserved:false,byteLength:0,digest:"sha256:empty",encoding:"utf8",complete:true,truncated:false,subjectBound:true,frameBound:true,provenanceValid:true,sourceTrusted:true,...o};}
function input(o={}){return {rulesetVersion:R,provenanceScope:"scope:runtime",temporalFrameRef:"time:1",observationFrameRef:"frame:1",executionSubjectRef:"subject:1",artifactIdentityRef:"artifact:1",configurationIdentityRef:"config:1",dependencyAssessmentRef:"dep:1",entrypointIdentityRef:"entry:1",invocationIdentityRef:"invoke:1",executionObservationRef:"execobs:1",instrumentationIdentity:"instrument:test",instrumentationRevision:"1",evidenceRefs:["ev:coverage","ev:output"],subjectIdentityResolved:true,observationFrame:{status:"CLOSED",identityResolved:true,boundsValid:true,clockCorrelationValid:true},instrumentationCoverage:{status:"COMPLETE",provenanceValid:true,allSupportedOutputPathsCovered:true,enumerationComplete:true,instrumentationAvailable:true,unsupportedDynamicPath:false},stdoutObservation:out(),stderrObservation:out(),resultArtifactEvidence:ev(),resultCorrelationEvidence:ev(),contradictionStatus:"NONE",...o};}

test("v0-complete-negative",()=>assert.equal(assessV0(input()).resultOutputState,"NOT_OBSERVED"));
test("v0-stdout-positive-with-correlation",()=>assert.equal(assessV0(input({stdoutObservation:out({bytesObserved:true,byteLength:2,digest:"sha256:01",complete:true}),resultCorrelationEvidence:ev({observed:true})})).resultOutputState,"OBSERVED"));
test("v0-stdout-without-correlation-unknown",()=>assert.equal(assessV0(input({stdoutObservation:out({bytesObserved:true,byteLength:2,digest:"sha256:01"})})).resultOutputState,"UNKNOWN"));
test("v0-truncated-positive-unknown",()=>assert.equal(assessV0(input({stdoutObservation:out({bytesObserved:true,complete:false,truncated:true})})).stdoutState,"UNKNOWN"));
test("v0-partial-coverage-negative-unknown",()=>{const x=input();x.instrumentationCoverage.status="PARTIAL";assert.equal(assessV0(x).resultOutputState,"UNKNOWN");});
test("v0-open-frame-negative-unknown",()=>{const x=input();x.observationFrame.status="OPEN";assert.equal(assessV0(x).resultOutputState,"UNKNOWN");});
test("v0-contradiction-unknown",()=>assert.equal(assessV0(input({contradictionStatus:"CONTRADICTORY_EVIDENCE"})).resultOutputState,"UNKNOWN"));
test("v0-untrusted-positive-unknown",()=>assert.equal(assessV0(input({stdoutObservation:out({bytesObserved:true,sourceTrusted:false}),resultCorrelationEvidence:ev({observed:true})})).stdoutState,"UNKNOWN"));
test("v0-artifact-positive-correlated",()=>assert.equal(assessV0(input({resultArtifactEvidence:ev({observed:true}),resultCorrelationEvidence:ev({observed:true})})).resultOutputState,"OBSERVED"));
test("v0-authority-none",()=>assert.equal(assessV0(input()).authority,"NONE"));
test("v0-deterministic-evidence-set",()=>{const a=input({evidenceRefs:["z","a","a"]}),b=input({evidenceRefs:["a","z"]});assert.equal(assessV0(a).observationId,assessV0(b).observationId);});
test("v0-material-binding-changes-identity",()=>{const a=input(),b=input({dependencyAssessmentRef:"dep:2"});assert.notEqual(assessV0(a).observationId,assessV0(b).observationId);});
test("v0-unicode-nfc",()=>{const a=input({provenanceScope:"caf\u00e9"}),b=input({provenanceScope:"cafe\u0301"});assert.equal(assessV0(a).observationId,assessV0(b).observationId);});
test("v0-extra-field-fails",()=>assert.throws(()=>assessV0({...input(),extra:true}),/SCHEMA_UNSUPPORTED_FIELD/));
test("v0-wrong-type-fails",()=>assert.throws(()=>assessV0({...input(),subjectIdentityResolved:"yes"}),/SCHEMA_UNSUPPORTED_VALUE/));
test("v0-wrong-ruleset-fails",()=>assert.throws(()=>assessV0({...input(),rulesetVersion:"other"}),/UNSUPPORTED_RULESET_VERSION/));
test("v0-authoritative-negative-identity",()=>assert.equal(assessV0(input()).observationId,"sem:a56acacfdf2fcb3215a71a99e305f603801b7cfd765fa2781694eef3917278e9"));
test("v0-authoritative-positive-identity",()=>assert.equal(assessV0(input({stdoutObservation:out({bytesObserved:true,byteLength:2,digest:"sha256:01"}),resultCorrelationEvidence:ev({observed:true})})).observationId,"sem:659a39385a88fb9cfe0dc0fc4f8a45d9d68e1716566fc6a4b11642aec2ba558e"));

const CHANNELS=["DIRECT_RETURN","STRUCTURED_PROVIDER_RESPONSE","STDOUT","STDERR","RUNTIME_EVENT","TRACE_PAYLOAD","ARTIFACT","MESSAGE_RESPONSE","CALLBACK_PAYLOAD","MULTI_FRAGMENT_STREAM"];
function inventory(channel="DIRECT_RETURN",o={}){return {status:"COMPLETE",provenanceValid:true,unsupportedDynamicPath:false,channels:[{channel,applicable:true}],...o};}
function coverage01(o={}){return {status:"COMPLETE",provenanceValid:true,enumerationComplete:true,instrumentationAvailable:true,unresolvedCorrelationFrontier:false,...o};}
function ch(channel="DIRECT_RETURN",o={}){return {channel,surfaceIdentity:`surface:${channel}`,surfaceRevision:"1",observed:false,materiallyPresent:false,recognizedEmptyRepresentation:false,byteMetadataApplicable:true,byteLength:0,digest:"sha256:empty",encoding:"utf8",mediaType:"application/octet-stream",complete:true,truncated:false,subjectBound:true,executionBound:true,inputBound:true,frameBound:true,provenanceValid:true,sourceTrusted:true,fragmentStatus:"NOT_APPLICABLE",fragmentRevision:0,fragmentDigest:"sha256:none",sequenceValid:true,streamClosed:true,integrityStatus:"UNKNOWN",integrityProvenanceValid:true,grammarStatus:"NOT_APPLICABLE",grammarBindingValid:true,grammarApplicabilityEstablished:true,...o};}
function input01(o={}){return {schemaVersion:S01,rulesetVersion:R,provenanceScope:"scope:runtime",temporalFrameRef:"time:1",observationFrameRef:"frame:1",executionSubjectRef:"subject:1",artifactIdentityRef:"artifact:1",configurationIdentityRef:"config:1",dependencyAssessmentRef:"dep:1",entrypointIdentityRef:"entry:1",invocationIdentityRef:"invoke:1",executionObservationRef:"execobs:1",instrumentationIdentity:"instrument:test",instrumentationRevision:"1",executionStartRef:"start:1",executionInvocationRef:"execution-invocation:1",inputIdentityRef:"input:1",outputSurfaceIdentity:"output-surface:1",outputSurfaceRevision:"1",outputChannelInventoryRef:"inventory:1",expectedResultGrammarRef:"grammar:1",expectedResultGrammarRevision:"1",evidenceRefs:["ev:inventory","ev:capture"],subjectIdentityResolved:true,observationFrame:{status:"CLOSED",identityResolved:true,boundsValid:true,clockCorrelationValid:true},outputChannelInventory:inventory(),captureCoverage:coverage01(),channelObservations:[ch()],contradictionStatus:"NONE",...o};}
function channelState(result,channel){return result.channelStates.find(x=>x.channel===channel);}

for(const channel of CHANNELS){
  test(`v01-${channel}-material-presence`,()=>{const r=assessV01(input01({outputChannelInventory:inventory(channel),channelObservations:[ch(channel,{observed:true,materiallyPresent:true,integrityStatus:"VERIFIED"})]}));assert.equal(r.resultOutputState,"RESULT_OUTPUT_EVIDENCE_OBSERVED");assert.equal(channelState(r,channel).presenceState,"OUTPUT_OBSERVED");});
  test(`v01-${channel}-empty-representation`,()=>{const r=assessV01(input01({outputChannelInventory:inventory(channel),channelObservations:[ch(channel,{observed:true,recognizedEmptyRepresentation:true,grammarStatus:"PARSEABLE",integrityStatus:"VERIFIED"})]}));assert.equal(r.resultOutputState,"RESULT_OUTPUT_EVIDENCE_OBSERVED");assert.equal(channelState(r,channel).presenceState,"EMPTY_RESULT_REPRESENTATION_OBSERVED");});
  test(`v01-${channel}-partial-presence-not-completion`,()=>{const r=assessV01(input01({outputChannelInventory:inventory(channel),channelObservations:[ch(channel,{observed:true,materiallyPresent:true,complete:false,truncated:true,fragmentStatus:"PARTIAL",sequenceValid:false,streamClosed:false,integrityStatus:"VERIFIED"})]}));const s=channelState(r,channel);assert.equal(s.presenceState,"OUTPUT_OBSERVED");assert.equal(s.captureCompletenessState,"CAPTURE_PARTIAL");assert.equal(s.fragmentSetState,"FRAGMENT_SET_PARTIAL");assert.equal(r.resultOutputState,"RESULT_OUTPUT_EVIDENCE_OBSERVED");});
  test(`v01-${channel}-complete-negative`,()=>{const r=assessV01(input01({outputChannelInventory:inventory(channel),channelObservations:[ch(channel)]}));assert.equal(r.resultOutputState,"NO_RESULT_OUTPUT_EVIDENCE_IN_COMPLETE_FRAME");assert.equal(channelState(r,channel).presenceState,"NOT_OBSERVED_IN_COMPLETE_FRAME");});
}

test("v01-uncorrelated-presence-unknown-aggregate",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{observed:true,materiallyPresent:true,inputBound:false,integrityStatus:"VERIFIED"})];const r=assessV01(x);assert.equal(channelState(r,"DIRECT_RETURN").correlationState,"NOT_CORRELATED_TO_EXACT_EXECUTION");assert.equal(r.resultOutputState,"UNKNOWN");});
test("v01-invalid-integrity-presence-unknown-aggregate",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{observed:true,materiallyPresent:true,integrityStatus:"INVALID"})];const r=assessV01(x);assert.equal(channelState(r,"DIRECT_RETURN").presenceState,"OUTPUT_OBSERVED");assert.equal(channelState(r,"DIRECT_RETURN").integrityState,"INTEGRITY_INVALID");assert.equal(r.resultOutputState,"UNKNOWN");});
test("v01-contradiction-fails-closed",()=>{const x=input01({contradictionStatus:"CONTRADICTORY_EVIDENCE"});x.channelObservations=[ch("DIRECT_RETURN",{observed:true,materiallyPresent:true,integrityStatus:"VERIFIED"})];assert.equal(assessV01(x).resultOutputState,"UNKNOWN");});
test("v01-open-frame-negative-unknown",()=>{const x=input01();x.observationFrame.status="OPEN";assert.equal(assessV01(x).resultOutputState,"UNKNOWN");});
test("v01-partial-inventory-negative-unknown",()=>{const x=input01();x.outputChannelInventory.status="PARTIAL";assert.equal(assessV01(x).resultOutputState,"UNKNOWN");});
test("v01-dynamic-path-negative-unknown",()=>{const x=input01();x.outputChannelInventory.unsupportedDynamicPath=true;assert.equal(assessV01(x).resultOutputState,"UNKNOWN");});
test("v01-partial-capture-negative-unknown",()=>{const x=input01();x.captureCoverage.status="PARTIAL";assert.equal(assessV01(x).resultOutputState,"UNKNOWN");});
test("v01-unresolved-frontier-negative-unknown",()=>{const x=input01();x.captureCoverage.unresolvedCorrelationFrontier=true;assert.equal(assessV01(x).resultOutputState,"UNKNOWN");});
test("v01-missing-applicable-channel-negative-unknown",()=>{const x=input01();x.channelObservations=[];assert.equal(assessV01(x).resultOutputState,"UNKNOWN");});
test("v01-inapplicable-channel-does-not-block-negative",()=>{const x=input01();x.outputChannelInventory.channels.push({channel:"STDERR",applicable:false});assert.equal(assessV01(x).resultOutputState,"NO_RESULT_OUTPUT_EVIDENCE_IN_COMPLETE_FRAME");});
test("v01-incomplete-fragment-closure-blocks-negative",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{fragmentStatus:"COMPLETE",streamClosed:false})];assert.equal(assessV01(x).resultOutputState,"UNKNOWN");});
test("v01-grammar-unparseable-distinct",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{observed:true,materiallyPresent:true,grammarStatus:"UNPARSEABLE"})];assert.equal(channelState(assessV01(x),"DIRECT_RETURN").grammarState,"UNPARSEABLE_UNDER_BOUND_GRAMMAR");});
test("v01-grammar-unsupported-distinct",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{observed:true,materiallyPresent:true,grammarStatus:"UNSUPPORTED"})];assert.equal(channelState(assessV01(x),"DIRECT_RETURN").grammarState,"GRAMMAR_UNSUPPORTED");});
test("v01-empty-without-bound-grammar-unknown",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{observed:true,recognizedEmptyRepresentation:true,grammarStatus:"PARSEABLE",grammarBindingValid:false})];assert.equal(channelState(assessV01(x),"DIRECT_RETURN").presenceState,"UNKNOWN");});
test("v01-stdout-metadata-preserved",()=>{const x=input01({outputChannelInventory:inventory("STDOUT"),channelObservations:[ch("STDOUT",{observed:true,materiallyPresent:true,byteLength:7,digest:"sha256:seven",encoding:"utf16le",mediaType:"text/plain",integrityStatus:"VERIFIED"})]});assert.deepEqual(channelState(assessV01(x),"STDOUT").metadata,{byteLength:7,digest:"sha256:seven",encoding:"utf16le",mediaType:"text/plain",complete:true,truncated:false});});
test("v01-stderr-metadata-preserved",()=>{const x=input01({outputChannelInventory:inventory("STDERR"),channelObservations:[ch("STDERR",{observed:true,materiallyPresent:true,byteLength:3,digest:"sha256:three",encoding:"utf8",mediaType:"text/plain",integrityStatus:"VERIFIED"})]});assert.equal(channelState(assessV01(x),"STDERR").metadata.byteLength,3);});
test("v01-authority-none-everywhere",()=>{const r=assessV01(input01());assert.equal(r.authority,"NONE");assert(r.observationStates.every(x=>x.authority==="NONE"));});
test("v01-six-statements-per-channel-plus-aggregate",()=>assert.equal(assessV01(input01()).observationStates.length,7));
test("v01-deterministic-evidence-set",()=>{const a=input01({evidenceRefs:["z","a","a"]}),b=input01({evidenceRefs:["a","z"]});assert.equal(assessV01(a).observationId,assessV01(b).observationId);});
test("v01-deterministic-channel-order",()=>{const a=input01(),b=input01();a.outputChannelInventory.channels=[{channel:"STDERR",applicable:false},{channel:"DIRECT_RETURN",applicable:true}];b.outputChannelInventory.channels=[...a.outputChannelInventory.channels].reverse();a.channelObservations=[ch("STDERR"),ch("DIRECT_RETURN")];b.channelObservations=[...a.channelObservations].reverse();assert.equal(assessV01(a).observationId,assessV01(b).observationId);});
test("v01-unicode-nfc",()=>{const a=input01({provenanceScope:"caf\u00e9"}),b=input01({provenanceScope:"cafe\u0301"});assert.equal(assessV01(a).observationId,assessV01(b).observationId);});

for(const field of ["dependencyAssessmentRef","entrypointIdentityRef","invocationIdentityRef","executionObservationRef","instrumentationIdentity","instrumentationRevision","executionStartRef","executionInvocationRef","inputIdentityRef","outputSurfaceIdentity","outputSurfaceRevision","outputChannelInventoryRef","expectedResultGrammarRef","expectedResultGrammarRevision"]){
  test(`v01-binding-${field}-changes-identity`,()=>{const a=input01(),b=input01({[field]:`${a[field]}:changed`});assert.notEqual(assessV01(a).observationId,assessV01(b).observationId);});
}
test("v01-fragment-revision-changes-identity",()=>{const a=input01(),b=input01();b.channelObservations[0].fragmentRevision=2;assert.notEqual(assessV01(a).observationId,assessV01(b).observationId);});
test("v01-fragment-digest-changes-identity",()=>{const a=input01(),b=input01();b.channelObservations[0].fragmentDigest="sha256:changed";assert.notEqual(assessV01(a).observationId,assessV01(b).observationId);});
test("v01-wrong-schema-fails",()=>assert.throws(()=>assessV01({...input01(),schemaVersion:"1.0"}),/UNSUPPORTED_SCHEMA_VERSION/));
test("v01-wrong-ruleset-fails",()=>assert.throws(()=>assessV01({...input01(),rulesetVersion:"other"}),/UNSUPPORTED_RULESET_VERSION/));
test("v01-extra-field-fails",()=>assert.throws(()=>assessV01({...input01(),extra:true}),/SCHEMA_UNSUPPORTED_FIELD/));
test("v01-duplicate-inventory-channel-fails",()=>{const x=input01();x.outputChannelInventory.channels.push({channel:"DIRECT_RETURN",applicable:true});assert.throws(()=>assessV01(x),/duplicate/);});
test("v01-duplicate-observation-channel-fails",()=>{const x=input01();x.channelObservations.push(ch());assert.throws(()=>assessV01(x),/duplicate/);});
test("v01-uninventoried-observation-fails",()=>{const x=input01();x.channelObservations.push(ch("STDERR"));assert.throws(()=>assessV01(x),/notInventoried/);});
test("v01-conflicting-presence-fails",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{observed:true,materiallyPresent:true,recognizedEmptyRepresentation:true})];assert.throws(()=>assessV01(x),/presenceConflict/);});
test("v01-complete-truncated-fails",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{truncated:true})];assert.throws(()=>assessV01(x),/captureConflict/);});
test("v01-presence-without-observation-fails",()=>{const x=input01();x.channelObservations=[ch("DIRECT_RETURN",{materiallyPresent:true})];assert.throws(()=>assessV01(x),/observed/);});

let passed=0;
for(const [name,fn] of tests){try{fn();passed++;}catch(error){console.error(`FAIL ${name}: ${error.stack||error}`);process.exitCode=1;}}
if(process.exitCode) process.exit();
const validationMaterial={suite:"runtime-result-output-observation-v0.1-provider-free-regression",cases:tests.map(([name])=>name),passed};
const validationIdentity=crypto.createHash("sha256").update(JSON.stringify(validationMaterial)).digest("hex");
console.log(`${passed}/${tests.length} PASS`);
console.log(`validation identity ${validationIdentity}`);
