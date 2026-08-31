"use strict";

const crypto = require("crypto");

const RULESET_VERSION = "semantic-evidence-v1.0.1";
const SCHEMA_VERSION = "1.0";
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
module.exports=Object.freeze({RULESET_VERSION,assessRuntimeResultOutputObservation});
