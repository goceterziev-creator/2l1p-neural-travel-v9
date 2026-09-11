"use strict";

const {
  RULESET_VERSION: ROLE_RULESET_VERSION,
  OUTCOMES: ROLE_OUTCOMES
} = require("./governance-role-requirement-principal-role-resolution");
const {
  RULESET_VERSION: WIRING_RULESET_VERSION,
  OUTCOMES: WIRING_OUTCOMES
} = require("./accepted-evidence-role-resolution-wiring");

const RULESET_VERSION = "accepted-evidence-role-resolution-authorization-adapter-bridge-v0.1.0";
const AUTHORITY = "NONE";

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function exact(v,fields){return plain(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k));}
function clone(v){return v===null||v===undefined?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function base(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false});}
function mapOutcome(outcome){
  if(outcome===WIRING_OUTCOMES.RESOLVED)return ROLE_OUTCOMES.RESOLVED;
  if(outcome===WIRING_OUTCOMES.NOT_RESOLVED)return ROLE_OUTCOMES.NOT_RESOLVED;
  if(outcome===WIRING_OUTCOMES.INVALID)return ROLE_OUTCOMES.INVALID;
  return ROLE_OUTCOMES.UNKNOWN;
}
function mapWiringResult(result){
  if(!plain(result)||result.authority!==AUTHORITY)return base(ROLE_OUTCOMES.UNKNOWN,"ROLE_RESOLUTION_WIRING_RESULT_INVALID");
  const outcome=mapOutcome(result.outcome);
  if(outcome===ROLE_OUTCOMES.RESOLVED){
    if(!plain(result.resolution))return base(ROLE_OUTCOMES.UNKNOWN,"ROLE_RESOLUTION_WIRING_RESOLUTION_MISSING");
    return base(outcome,result.reason,result.resolution);
  }
  return base(outcome,result.reason,null);
}

function createAcceptedEvidenceRoleResolutionAuthorizationAdapterBridge({acceptedEvidenceRoleResolutionWiring}={}){
  if(!acceptedEvidenceRoleResolutionWiring||typeof acceptedEvidenceRoleResolutionWiring.resolveRequirement!=="function"||typeof acceptedEvidenceRoleResolutionWiring.resolvePrincipalRole!=="function"){
    throw new TypeError("acceptedEvidenceRoleResolutionWiring with resolveRequirement/resolvePrincipalRole is required");
  }
  function resolveRequirement(request){
    if(!exact(request,["rulesetVersion","governanceAct","contextScope"])||request.rulesetVersion!==ROLE_RULESET_VERSION){
      return base(ROLE_OUTCOMES.INVALID,"INVALID_REQUIREMENT_REQUEST");
    }
    let result;
    try{
      result=acceptedEvidenceRoleResolutionWiring.resolveRequirement(freeze({rulesetVersion:WIRING_RULESET_VERSION,governanceAct:request.governanceAct,contextScope:clone(request.contextScope)}));
    }catch(_){return base(ROLE_OUTCOMES.UNKNOWN,"ROLE_REQUIREMENT_WIRING_UNAVAILABLE");}
    return mapWiringResult(result);
  }
  function resolvePrincipalRole(request){
    if(!exact(request,["rulesetVersion","principalRef","principalRevision","roleRef","roleRevision","contextScope"])||request.rulesetVersion!==ROLE_RULESET_VERSION){
      return base(ROLE_OUTCOMES.INVALID,"INVALID_ROLE_REQUEST");
    }
    let result;
    try{
      result=acceptedEvidenceRoleResolutionWiring.resolvePrincipalRole(freeze({rulesetVersion:WIRING_RULESET_VERSION,principalRef:request.principalRef,principalRevision:request.principalRevision,roleRef:request.roleRef,roleRevision:request.roleRevision,contextScope:clone(request.contextScope)}));
    }catch(_){return base(ROLE_OUTCOMES.UNKNOWN,"PRINCIPAL_ROLE_WIRING_UNAVAILABLE");}
    return mapWiringResult(result);
  }
  return Object.freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,resolveRequirement,resolvePrincipalRole});
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,createAcceptedEvidenceRoleResolutionAuthorizationAdapterBridge});
