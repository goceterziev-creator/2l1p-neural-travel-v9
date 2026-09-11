"use strict";

const RULESET_VERSION="governance-principal-eligibility-evidence-lookup-v0.1.0";
const AUTHORITY="NONE";
const OUTCOMES=Object.freeze({
  PRINCIPAL_RESOLVED:"GOVERNANCE_PRINCIPAL_IDENTITY_BOUND",
  PRINCIPAL_UNKNOWN:"GOVERNANCE_PRINCIPAL_IDENTITY_UNKNOWN",
  PRINCIPAL_INVALID:"GOVERNANCE_PRINCIPAL_IDENTITY_INVALID",
  ELIGIBILITY_RESOLVED:"PRINCIPAL_ELIGIBILITY_RESOLVED",
  ELIGIBILITY_UNKNOWN:"PRINCIPAL_ELIGIBILITY_UNKNOWN",
  ELIGIBILITY_INVALID:"PRINCIPAL_ELIGIBILITY_INVALID"
});
function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function exact(v,fields){return plain(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k));}
function scopeDigest(scope){return JSON.stringify(scope);}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false});}
function validPrincipal(e){return plain(e)&&e.type==="GT63_GOVERNANCE_PRINCIPAL_IDENTITY_BINDING_EVIDENCE"&&nonEmpty(e.principalRef)&&nonEmpty(e.principalRevision)&&nonEmpty(e.principalEvidenceRef)&&e.lifecycleState==="CURRENT"&&e.freshnessState==="CURRENT"&&e.contradictionState==="NONE"&&e.authority===AUTHORITY;}
function validEligibility(e){return plain(e)&&e.type==="GT63_PRINCIPAL_ELIGIBILITY_EVIDENCE"&&nonEmpty(e.eligibilityEvidenceRef)&&nonEmpty(e.principalRef)&&nonEmpty(e.principalRevision)&&nonEmpty(e.principalEvidenceRef)&&["ELIGIBLE","NOT_ELIGIBLE","UNKNOWN"].includes(e.eligibilityState)&&e.governanceAct==="GATE_AUTHORIZATION"&&plain(e.contextScope)&&e.lifecycleState==="CURRENT"&&e.freshnessState==="CURRENT"&&e.contradictionState==="NONE"&&e.authority===AUTHORITY;}
function principalKey(r){return `${r.principalRef}\u0000${r.principalRevision}`;}
function eligibilityKey(r){return `${r.principalRef}\u0000${r.principalRevision}\u0000${r.governanceAct}\u0000${scopeDigest(r.contextScope)}`;}
function createMemoryRegistry({principalEvidence=[],eligibilityEvidence=[]}={}){
  const principals=new Map(),eligibilities=new Map();
  for(const e of principalEvidence){if(!validPrincipal(e))throw new TypeError("invalid principal evidence");const k=principalKey(e);if(principals.has(k))throw new TypeError("duplicate principal evidence identity");principals.set(k,freeze(clone(e)));}
  for(const e of eligibilityEvidence){if(!validEligibility(e))throw new TypeError("invalid eligibility evidence");const k=eligibilityKey(e);if(eligibilities.has(k))throw new TypeError("duplicate eligibility evidence identity");eligibilities.set(k,freeze(clone(e)));}
  return Object.freeze({getPrincipal:r=>principals.has(principalKey(r))?principals.get(principalKey(r)):null,getEligibility:r=>eligibilities.has(eligibilityKey(r))?eligibilities.get(eligibilityKey(r)):null});
}
function createGovernancePrincipalEligibilityEvidenceLookup({registry}={}){
  if(!registry||typeof registry.getPrincipal!=="function"||typeof registry.getEligibility!=="function")throw new TypeError("registry lookup functions required");
  function governancePrincipalBindingPort(request){
    if(!plain(request)||!nonEmpty(request.principalRef)||!nonEmpty(request.principalRevision))return result(OUTCOMES.PRINCIPAL_INVALID,"unsupported principal lookup request");
    let records;try{records=registry.getPrincipal(freeze(clone({principalRef:request.principalRef,principalRevision:request.principalRevision})));}catch(_){return result(OUTCOMES.PRINCIPAL_UNKNOWN,"principal evidence registry unavailable");}
    if(records==null)return result(OUTCOMES.PRINCIPAL_UNKNOWN,"principal evidence not found");const list=Array.isArray(records)?records:[records];if(list.length!==1)return result(OUTCOMES.PRINCIPAL_UNKNOWN,"principal evidence identity conflict");const e=list[0];if(!validPrincipal(e)||e.principalRef!==request.principalRef||e.principalRevision!==request.principalRevision)return result(OUTCOMES.PRINCIPAL_UNKNOWN,"principal evidence invalid or mismatched");return result(OUTCOMES.PRINCIPAL_RESOLVED,null,e);
  }
  function principalEligibilityEvidencePort(request){
    const fields=["principalRef","principalRevision","governanceAct","contextScope"];
    if(!exact(request,fields)||!nonEmpty(request.principalRef)||!nonEmpty(request.principalRevision)||request.governanceAct!=="GATE_AUTHORIZATION"||!plain(request.contextScope))return result(OUTCOMES.ELIGIBILITY_INVALID,"unsupported eligibility lookup request");
    let records;try{records=registry.getEligibility(freeze(clone(request)));}catch(_){return result(OUTCOMES.ELIGIBILITY_UNKNOWN,"eligibility evidence registry unavailable");}
    if(records==null)return result(OUTCOMES.ELIGIBILITY_UNKNOWN,"eligibility evidence not found");const list=Array.isArray(records)?records:[records];if(list.length!==1)return result(OUTCOMES.ELIGIBILITY_UNKNOWN,"eligibility evidence identity conflict");const e=list[0];if(!validEligibility(e)||e.principalRef!==request.principalRef||e.principalRevision!==request.principalRevision||e.governanceAct!==request.governanceAct||scopeDigest(e.contextScope)!==scopeDigest(request.contextScope))return result(OUTCOMES.ELIGIBILITY_UNKNOWN,"eligibility evidence invalid or mismatched");return result(OUTCOMES.ELIGIBILITY_RESOLVED,null,e);
  }
  return Object.freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,governancePrincipalBindingPort,principalEligibilityEvidencePort});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createMemoryRegistry,createGovernancePrincipalEligibilityEvidenceLookup});
