"use strict";

const crypto = require("crypto");

const RULESET_VERSION = "semantic-evidence-v1.0.1";
const SCHEMA_VERSION = "1.0";
const SCHEMA_VERSION_V01 = "runtime-result-output-observation-v0.1";
const STATE = new Set(["OBSERVED", "NOT_OBSERVED", "UNKNOWN"]);
const FRAME = new Set(["CLOSED", "OPEN", "UNKNOWN"]);
const COVERAGE = new Set(["COMPLETE", "PARTIAL", "UNKNOWN"]);
const CONTRADICTION = new Set(["NONE", "CONTRADICTORY_EVIDENCE"]);

function fail(kind, field, value) {
  const suffix = value === undefined ? "" : `:${String(value)}`;
  throw new Error(`${kind}:${field}${suffix}`);
}
function object(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function exact(value, fields, name = "input") {
  if (!object(value)) fail("SCHEMA_UNSUPPORTED_FIELD", name);
  for (const key of Object.keys(value)) if (!fields.has(key)) fail("SCHEMA_UNSUPPORTED_FIELD", key);
}
function string(value, field) { if (typeof value[field] !== "string" || !value[field]) fail("SCHEMA_UNSUPPORTED_VALUE", field, value[field]); }
function bool(value, field) { if (typeof value[field] !== "boolean") fail("SCHEMA_UNSUPPORTED_VALUE", field, value[field]); }
function enumeration(value, field, values) { if (!values.has(value[field])) fail("SCHEMA_UNSUPPORTED_VALUE", field, value[field]); }
function compare(a,b){const aa=Array.from(String(a)),bb=Array.from(String(b));for(let i=0;i<Math.min(aa.length,bb.length);i++){const d=aa[i].codePointAt(0)-bb[i].codePointAt(0);if(d)return d;}return aa.length-bb.length;}
function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort(compare).map(k=>`${JSON.stringify(k.normalize("NFC"))}:${canonical(value[k])}`).join(",")}}`;
  fail("SCHEMA_UNSUPPORTED_VALUE", "canonicalType", typeof value);
}
function digest(value){return `sha256:${crypto.createHash("sha256").update(value,"utf8").digest("hex")}`;}
function evidence(value,name){
  exact(value,new Set(["observed","subjectBound","frameBound","provenanceValid","sourceTrusted"]),name);
  for(const k of ["observed","subjectBound","frameBound","provenanceValid","sourceTrusted"]) bool(value,k);
  return value;
}
function frame(value){
  exact(value,new Set(["status","identityResolved","boundsValid","clockCorrelationValid"]),"observationFrame");
  enumeration(value,"status",FRAME); for(const k of ["identityResolved","boundsValid","clockCorrelationValid"]) bool(value,k); return value;
}
function coverage(value){
  exact(value,new Set(["status","provenanceValid","allSupportedOutputPathsCovered","enumerationComplete","instrumentationAvailable","unsupportedDynamicPath"]),"instrumentationCoverage");
  enumeration(value,"status",COVERAGE); for(const k of ["provenanceValid","allSupportedOutputPathsCovered","enumerationComplete","instrumentationAvailable","unsupportedDynamicPath"]) bool(value,k); return value;
}
function trustworthy(e){return e.observed&&e.subjectBound&&e.frameBound&&e.provenanceValid&&e.sourceTrusted;}
function complete(f,c){return f.status==="CLOSED"&&f.identityResolved&&f.boundsValid&&f.clockCorrelationValid&&c.status==="COMPLETE"&&c.provenanceValid&&c.allSupportedOutputPathsCovered&&c.enumerationComplete&&c.instrumentationAvailable&&!c.unsupportedDynamicPath;}
function output(value,name){
  exact(value,new Set(["bytesObserved","byteLength","digest","encoding","complete","truncated","subjectBound","frameBound","provenanceValid","sourceTrusted"]),name);
  for(const k of ["bytesObserved","complete","truncated","subjectBound","frameBound","provenanceValid","sourceTrusted"]) bool(value,k);
  if(!Number.isInteger(value.byteLength)||value.byteLength<0) fail("SCHEMA_UNSUPPORTED_VALUE",`${name}.byteLength`,value.byteLength);
  for(const k of ["digest","encoding"]) string(value,k);
  return value;
}
function assessRuntimeResultOutputObservation(input){
  exact(input,new Set(["rulesetVersion","provenanceScope","temporalFrameRef","observationFrameRef","executionSubjectRef","artifactIdentityRef","configurationIdentityRef","dependencyAssessmentRef","entrypointIdentityRef","invocationIdentityRef","executionObservationRef","instrumentationIdentity","instrumentationRevision","evidenceRefs","subjectIdentityResolved","observationFrame","instrumentationCoverage","stdoutObservation","stderrObservation","resultArtifactEvidence","resultCorrelationEvidence","contradictionStatus"]));
  if(input.rulesetVersion!==RULESET_VERSION) fail("UNSUPPORTED_RULESET_VERSION","rulesetVersion",input.rulesetVersion);
  for(const k of ["provenanceScope","temporalFrameRef","observationFrameRef","executionSubjectRef","artifactIdentityRef","configurationIdentityRef","dependencyAssessmentRef","entrypointIdentityRef","invocationIdentityRef","executionObservationRef","instrumentationIdentity","instrumentationRevision"]) string(input,k);
  if(!Array.isArray(input.evidenceRefs)||input.evidenceRefs.some(v=>typeof v!=="string"||!v)) fail("SCHEMA_UNSUPPORTED_VALUE","evidenceRefs");
  bool(input,"subjectIdentityResolved"); enumeration(input,"contradictionStatus",CONTRADICTION);
  const f=frame(input.observationFrame),c=coverage(input.instrumentationCoverage),out=output(input.stdoutObservation,"stdoutObservation"),err=output(input.stderrObservation,"stderrObservation");
  const artifact=evidence(input.resultArtifactEvidence,"resultArtifactEvidence"),correlation=evidence(input.resultCorrelationEvidence,"resultCorrelationEvidence");
  const contradiction=input.contradictionStatus==="CONTRADICTORY_EVIDENCE", negative=input.subjectIdentityResolved&&complete(f,c)&&!contradiction;
  function state(e,positive,wasObserved=x=>x.observed){if(input.subjectIdentityResolved&&!contradiction&&positive(e))return "OBSERVED";if(negative&&!wasObserved(e))return "NOT_OBSERVED";return "UNKNOWN";}
  const stdoutState=state(out,e=>e.bytesObserved&&e.complete&&!e.truncated&&e.subjectBound&&e.frameBound&&e.provenanceValid&&e.sourceTrusted,e=>e.bytesObserved);
  const stderrState=state(err,e=>e.bytesObserved&&e.complete&&!e.truncated&&e.subjectBound&&e.frameBound&&e.provenanceValid&&e.sourceTrusted,e=>e.bytesObserved);
  const artifactState=state(artifact,trustworthy), correlationState=state(correlation,trustworthy);
  let aggregate="UNKNOWN";
  if(correlationState==="OBSERVED"&&(stdoutState==="OBSERVED"||stderrState==="OBSERVED"||artifactState==="OBSERVED")) aggregate="OBSERVED";
  else if(negative&&stdoutState==="NOT_OBSERVED"&&stderrState==="NOT_OBSERVED"&&artifactState==="NOT_OBSERVED") aggregate="NOT_OBSERVED";
  const material={capability:"semantic-evidence-runtime-result-output-observation",schemaVersion:SCHEMA_VERSION,rulesetVersion:RULESET_VERSION,provenanceScope:input.provenanceScope,temporalFrameRef:input.temporalFrameRef,observationFrameRef:input.observationFrameRef,executionSubjectRef:input.executionSubjectRef,artifactIdentityRef:input.artifactIdentityRef,configurationIdentityRef:input.configurationIdentityRef,dependencyAssessmentRef:input.dependencyAssessmentRef,entrypointIdentityRef:input.entrypointIdentityRef,invocationIdentityRef:input.invocationIdentityRef,executionObservationRef:input.executionObservationRef,instrumentationIdentity:input.instrumentationIdentity,instrumentationRevision:input.instrumentationRevision,evidenceRefs:Array.from(new Set(input.evidenceRefs.map(v=>v.normalize("NFC")))).sort(compare),contradictionStatus:input.contradictionStatus,stdoutState,stderrState,resultArtifactState:artifactState,resultCorrelationState:correlationState,resultOutputState:aggregate,stdout:stdoutState==="OBSERVED"?{byteLength:out.byteLength,digest:out.digest,encoding:out.encoding,complete:true,truncated:false}:null,stderr:stderrState==="OBSERVED"?{byteLength:err.byteLength,digest:err.digest,encoding:err.encoding,complete:true,truncated:false}:null};
  return Object.freeze({observationId:`sem:${digest(canonical(material)).slice(7)}`,...material,authority:"NONE"});
}

const CHANNELS = new Set(["DIRECT_RETURN","STRUCTURED_PROVIDER_RESPONSE","STDOUT","STDERR","RUNTIME_EVENT","TRACE_PAYLOAD","ARTIFACT","MESSAGE_RESPONSE","CALLBACK_PAYLOAD","MULTI_FRAGMENT_STREAM"]);
const FRAGMENT = new Set(["COMPLETE","PARTIAL","NOT_APPLICABLE","UNKNOWN"]);
const INTEGRITY = new Set(["VERIFIED","INVALID","UNKNOWN"]);
const GRAMMAR = new Set(["PARSEABLE","UNPARSEABLE","UNSUPPORTED","NOT_APPLICABLE","UNKNOWN"]);

function channelInventory(value){
  exact(value,new Set(["status","provenanceValid","unsupportedDynamicPath","channels"]),"outputChannelInventory");
  enumeration(value,"status",COVERAGE); bool(value,"provenanceValid"); bool(value,"unsupportedDynamicPath");
  if(!Array.isArray(value.channels)||value.channels.length===0) fail("SCHEMA_UNSUPPORTED_VALUE","outputChannelInventory.channels");
  const seen=new Set();
  for(const item of value.channels){
    exact(item,new Set(["channel","applicable"]),"outputChannelInventory.channels");
    enumeration(item,"channel",CHANNELS); bool(item,"applicable");
    if(seen.has(item.channel)) fail("SCHEMA_UNSUPPORTED_VALUE","outputChannelInventory.channels.duplicate",item.channel);
    seen.add(item.channel);
  }
  return value;
}
function captureCoverage(value){
  exact(value,new Set(["status","provenanceValid","enumerationComplete","instrumentationAvailable","unresolvedCorrelationFrontier"]),"captureCoverage");
  enumeration(value,"status",COVERAGE);
  for(const k of ["provenanceValid","enumerationComplete","instrumentationAvailable","unresolvedCorrelationFrontier"]) bool(value,k);
  return value;
}
function channelObservation(value,index){
  const name=`channelObservations[${index}]`;
  exact(value,new Set(["channel","surfaceIdentity","surfaceRevision","observed","materiallyPresent","recognizedEmptyRepresentation","byteMetadataApplicable","byteLength","digest","encoding","mediaType","complete","truncated","subjectBound","executionBound","inputBound","frameBound","provenanceValid","sourceTrusted","fragmentStatus","fragmentRevision","fragmentDigest","sequenceValid","streamClosed","integrityStatus","integrityProvenanceValid","grammarStatus","grammarBindingValid","grammarApplicabilityEstablished"]),name);
  enumeration(value,"channel",CHANNELS);
  for(const k of ["surfaceIdentity","surfaceRevision","digest","encoding","mediaType","fragmentDigest"]) string(value,k);
  for(const k of ["observed","materiallyPresent","recognizedEmptyRepresentation","byteMetadataApplicable","complete","truncated","subjectBound","executionBound","inputBound","frameBound","provenanceValid","sourceTrusted","sequenceValid","streamClosed","integrityProvenanceValid","grammarBindingValid","grammarApplicabilityEstablished"]) bool(value,k);
  if(!Number.isInteger(value.byteLength)||value.byteLength<0) fail("SCHEMA_UNSUPPORTED_VALUE",`${name}.byteLength`,value.byteLength);
  if(!Number.isInteger(value.fragmentRevision)||value.fragmentRevision<0) fail("SCHEMA_UNSUPPORTED_VALUE",`${name}.fragmentRevision`,value.fragmentRevision);
  enumeration(value,"fragmentStatus",FRAGMENT); enumeration(value,"integrityStatus",INTEGRITY); enumeration(value,"grammarStatus",GRAMMAR);
  if(value.materiallyPresent&&value.recognizedEmptyRepresentation) fail("SCHEMA_UNSUPPORTED_VALUE",`${name}.presenceConflict`);
  if((value.materiallyPresent||value.recognizedEmptyRepresentation)&&!value.observed) fail("SCHEMA_UNSUPPORTED_VALUE",`${name}.observed`);
  if(value.complete&&value.truncated) fail("SCHEMA_UNSUPPORTED_VALUE",`${name}.captureConflict`);
  return value;
}
function v01CompleteFrame(f){return f.status==="CLOSED"&&f.identityResolved&&f.boundsValid&&f.clockCorrelationValid;}
function normalizedInventory(inv){return inv.channels.map(x=>({channel:x.channel,applicable:x.applicable})).sort((a,b)=>compare(a.channel,b.channel));}
function observationSummary(o){return {channel:o.channel,surfaceIdentity:o.surfaceIdentity,surfaceRevision:o.surfaceRevision,observed:o.observed,materiallyPresent:o.materiallyPresent,recognizedEmptyRepresentation:o.recognizedEmptyRepresentation,byteMetadataApplicable:o.byteMetadataApplicable,byteLength:o.byteLength,digest:o.digest,encoding:o.encoding,mediaType:o.mediaType,complete:o.complete,truncated:o.truncated,subjectBound:o.subjectBound,executionBound:o.executionBound,inputBound:o.inputBound,frameBound:o.frameBound,provenanceValid:o.provenanceValid,sourceTrusted:o.sourceTrusted,fragmentStatus:o.fragmentStatus,fragmentRevision:o.fragmentRevision,fragmentDigest:o.fragmentDigest,sequenceValid:o.sequenceValid,streamClosed:o.streamClosed,integrityStatus:o.integrityStatus,integrityProvenanceValid:o.integrityProvenanceValid,grammarStatus:o.grammarStatus,grammarBindingValid:o.grammarBindingValid,grammarApplicabilityEstablished:o.grammarApplicabilityEstablished};}
function statement(dimension,state,base){const material={dimension,state,...base};return Object.freeze({statementId:`sem:${digest(canonical(material)).slice(7)}`,dimension,state,authority:"NONE"});}

function assessRuntimeResultOutputObservationV01(input){
  exact(input,new Set(["schemaVersion","rulesetVersion","provenanceScope","temporalFrameRef","observationFrameRef","executionSubjectRef","artifactIdentityRef","configurationIdentityRef","dependencyAssessmentRef","entrypointIdentityRef","invocationIdentityRef","executionObservationRef","instrumentationIdentity","instrumentationRevision","executionStartRef","executionInvocationRef","inputIdentityRef","outputSurfaceIdentity","outputSurfaceRevision","outputChannelInventoryRef","expectedResultGrammarRef","expectedResultGrammarRevision","evidenceRefs","subjectIdentityResolved","observationFrame","outputChannelInventory","captureCoverage","channelObservations","contradictionStatus"]));
  if(input.schemaVersion!==SCHEMA_VERSION_V01) fail("UNSUPPORTED_SCHEMA_VERSION","schemaVersion",input.schemaVersion);
  if(input.rulesetVersion!==RULESET_VERSION) fail("UNSUPPORTED_RULESET_VERSION","rulesetVersion",input.rulesetVersion);
  for(const k of ["provenanceScope","temporalFrameRef","observationFrameRef","executionSubjectRef","artifactIdentityRef","configurationIdentityRef","dependencyAssessmentRef","entrypointIdentityRef","invocationIdentityRef","executionObservationRef","instrumentationIdentity","instrumentationRevision","executionStartRef","executionInvocationRef","inputIdentityRef","outputSurfaceIdentity","outputSurfaceRevision","outputChannelInventoryRef","expectedResultGrammarRef","expectedResultGrammarRevision"]) string(input,k);
  if(!Array.isArray(input.evidenceRefs)||input.evidenceRefs.some(v=>typeof v!=="string"||!v)) fail("SCHEMA_UNSUPPORTED_VALUE","evidenceRefs");
  bool(input,"subjectIdentityResolved"); enumeration(input,"contradictionStatus",CONTRADICTION);
  const f=frame(input.observationFrame),inv=channelInventory(input.outputChannelInventory),cov=captureCoverage(input.captureCoverage);
  if(!Array.isArray(input.channelObservations)) fail("SCHEMA_UNSUPPORTED_VALUE","channelObservations");
  const seen=new Set(),observations=input.channelObservations.map((v,i)=>{const o=channelObservation(v,i);if(seen.has(o.channel))fail("SCHEMA_UNSUPPORTED_VALUE","channelObservations.duplicate",o.channel);seen.add(o.channel);return o;});
  const inventoryChannels=new Set(inv.channels.map(x=>x.channel));
  for(const o of observations) if(!inventoryChannels.has(o.channel)) fail("SCHEMA_UNSUPPORTED_VALUE","channelObservations.notInventoried",o.channel);
  const contradiction=input.contradictionStatus==="CONTRADICTORY_EVIDENCE";
  const applicable=inv.channels.filter(x=>x.applicable).map(x=>x.channel);
  const byChannel=new Map(observations.map(x=>[x.channel,x]));
  const negativeComplete=input.subjectIdentityResolved&&!contradiction&&v01CompleteFrame(f)&&inv.status==="COMPLETE"&&inv.provenanceValid&&!inv.unsupportedDynamicPath&&cov.status==="COMPLETE"&&cov.provenanceValid&&cov.enumerationComplete&&cov.instrumentationAvailable&&!cov.unresolvedCorrelationFrontier&&applicable.every(ch=>{const o=byChannel.get(ch);return o&&!o.observed&&(o.fragmentStatus==="NOT_APPLICABLE"||(o.fragmentStatus==="COMPLETE"&&o.sequenceValid&&o.streamClosed));});
  const channelStates=observations.slice().sort((a,b)=>compare(a.channel,b.channel)).map(o=>{
    const trusted=o.observed&&o.frameBound&&o.provenanceValid&&o.sourceTrusted;
    const empty=trusted&&o.recognizedEmptyRepresentation&&o.grammarStatus==="PARSEABLE"&&o.grammarBindingValid&&o.grammarApplicabilityEstablished;
    const material=trusted&&o.materiallyPresent;
    const physical=empty||material;
    const correlated=physical&&input.subjectIdentityResolved&&o.subjectBound&&o.executionBound&&o.inputBound;
    const presence=contradiction?"UNKNOWN":material?"OUTPUT_OBSERVED":empty?"EMPTY_RESULT_REPRESENTATION_OBSERVED":negativeComplete&&!o.observed?"NOT_OBSERVED_IN_COMPLETE_FRAME":"UNKNOWN";
    const correlation=contradiction?"UNKNOWN":correlated?"CORRELATED_TO_EXACT_EXECUTION":physical?"NOT_CORRELATED_TO_EXACT_EXECUTION":"UNKNOWN";
    const capture=o.complete&&!o.truncated?"CAPTURE_COMPLETE":o.observed&&(o.truncated||!o.complete)?"CAPTURE_PARTIAL":"UNKNOWN";
    const fragments=o.fragmentStatus==="COMPLETE"&&o.sequenceValid&&o.streamClosed?"FRAGMENT_SET_COMPLETE":o.fragmentStatus==="PARTIAL"||o.fragmentStatus==="COMPLETE"?"FRAGMENT_SET_PARTIAL":o.fragmentStatus==="NOT_APPLICABLE"?"NOT_APPLICABLE":"UNKNOWN";
    const integrity=o.integrityStatus==="VERIFIED"&&o.integrityProvenanceValid?"INTEGRITY_VERIFIED":o.integrityStatus==="INVALID"&&o.integrityProvenanceValid?"INTEGRITY_INVALID":"UNKNOWN";
    let grammar="UNKNOWN";
    if(o.grammarStatus==="PARSEABLE"&&o.grammarBindingValid&&o.grammarApplicabilityEstablished) grammar="PARSEABLE_UNDER_BOUND_GRAMMAR";
    else if(o.grammarStatus==="UNPARSEABLE"&&o.grammarBindingValid&&o.grammarApplicabilityEstablished) grammar="UNPARSEABLE_UNDER_BOUND_GRAMMAR";
    else if(o.grammarStatus==="UNSUPPORTED"&&o.grammarApplicabilityEstablished) grammar="GRAMMAR_UNSUPPORTED";
    else if(o.grammarStatus==="NOT_APPLICABLE") grammar="NOT_APPLICABLE";
    return {channel:o.channel,presenceState:presence,correlationState:correlation,captureCompletenessState:capture,fragmentSetState:fragments,integrityState:integrity,grammarState:grammar,correlatedPresence:correlated,integrityInvalid:integrity==="INTEGRITY_INVALID",metadata:o.byteMetadataApplicable?{byteLength:o.byteLength,digest:o.digest,encoding:o.encoding,mediaType:o.mediaType,complete:o.complete,truncated:o.truncated}:null};
  });
  let aggregate="UNKNOWN";
  if(!contradiction&&channelStates.some(x=>x.correlatedPresence&&!x.integrityInvalid)) aggregate="RESULT_OUTPUT_EVIDENCE_OBSERVED";
  else if(negativeComplete) aggregate="NO_RESULT_OUTPUT_EVIDENCE_IN_COMPLETE_FRAME";
  const base={capability:"semantic-evidence-runtime-result-output-observation",schemaVersion:SCHEMA_VERSION_V01,rulesetVersion:RULESET_VERSION,provenanceScope:input.provenanceScope,temporalFrameRef:input.temporalFrameRef,observationFrameRef:input.observationFrameRef,executionSubjectRef:input.executionSubjectRef,artifactIdentityRef:input.artifactIdentityRef,configurationIdentityRef:input.configurationIdentityRef,dependencyAssessmentRef:input.dependencyAssessmentRef,entrypointIdentityRef:input.entrypointIdentityRef,invocationIdentityRef:input.invocationIdentityRef,executionObservationRef:input.executionObservationRef,instrumentationIdentity:input.instrumentationIdentity,instrumentationRevision:input.instrumentationRevision,executionStartRef:input.executionStartRef,executionInvocationRef:input.executionInvocationRef,inputIdentityRef:input.inputIdentityRef,outputSurfaceIdentity:input.outputSurfaceIdentity,outputSurfaceRevision:input.outputSurfaceRevision,outputChannelInventoryRef:input.outputChannelInventoryRef,expectedResultGrammarRef:input.expectedResultGrammarRef,expectedResultGrammarRevision:input.expectedResultGrammarRevision,evidenceRefs:Array.from(new Set(input.evidenceRefs.map(v=>v.normalize("NFC")))).sort(compare),subjectIdentityResolved:input.subjectIdentityResolved,observationFrame:{status:f.status,identityResolved:f.identityResolved,boundsValid:f.boundsValid,clockCorrelationValid:f.clockCorrelationValid},outputChannelInventory:{status:inv.status,provenanceValid:inv.provenanceValid,unsupportedDynamicPath:inv.unsupportedDynamicPath,channels:normalizedInventory(inv)},captureCoverage:{status:cov.status,provenanceValid:cov.provenanceValid,enumerationComplete:cov.enumerationComplete,instrumentationAvailable:cov.instrumentationAvailable,unresolvedCorrelationFrontier:cov.unresolvedCorrelationFrontier},contradictionStatus:input.contradictionStatus,channelObservations:observations.map(observationSummary).sort((a,b)=>compare(a.channel,b.channel))};
  const observationStates=[];
  for(const c of channelStates) for(const [dimension,state] of [["presence",c.presenceState],["correlation",c.correlationState],["captureCompleteness",c.captureCompletenessState],["fragmentSet",c.fragmentSetState],["integrity",c.integrityState],["grammar",c.grammarState]]) observationStates.push(statement(`${c.channel}.${dimension}`,state,base));
  observationStates.push(statement("resultOutput",aggregate,base));
  const material={...base,resultOutputState:aggregate,channelStates:channelStates.map(({correlatedPresence,integrityInvalid,...x})=>x),observationStates};
  return Object.freeze({observationId:`sem:${digest(canonical(material)).slice(7)}`,...material,authority:"NONE"});
}

module.exports=Object.freeze({RULESET_VERSION,SCHEMA_VERSION_V01,assessRuntimeResultOutputObservation,assessRuntimeResultOutputObservationV01});
