"use strict";

const {
  RULESET_VERSION: ROLE_RULESET_VERSION,
  OUTCOMES: ROLE_OUTCOMES,
  createGovernanceRoleRequirementPrincipalRoleResolution
} = require("./governance-role-requirement-principal-role-resolution");

const RULESET_VERSION = "accepted-evidence-role-resolution-wiring-v0.1.0";
const OUTCOMES = Object.freeze({RESOLVED:"RESOLVED",NOT_RESOLVED:"NOT_RESOLVED",UNKNOWN:"UNKNOWN",INVALID:"INVALID"});

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function exact(o,fields){return plain(o)&&Object.keys(o).length===fields.length&&Object.keys(o).every(k=>fields.includes(k));}
function clone(v){return v===null||v===undefined?v:JSON.parse(JSON.stringify(v));}
function deepFreeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(deepFreeze);}return v;}
function base(outcome,reason){return {rulesetVersion:RULESET_VERSION,outcome,reason:reason||null,resolution:null,authority:"NONE",principalEligibilityCreated:false,authorizationCreated:false,humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false};}
function mapResult(r){if(!r||r.authority!=="NONE")return base(OUTCOMES.UNKNOWN,"ROLE_RESOLUTION_RESULT_INVALID");const outcome=r.outcome===ROLE_OUTCOMES.RESOLVED?OUTCOMES.RESOLVED:r.outcome===ROLE_OUTCOMES.NOT_RESOLVED?OUTCOMES.NOT_RESOLVED:r.outcome===ROLE_OUTCOMES.INVALID?OUTCOMES.INVALID:OUTCOMES.UNKNOWN;return deepFreeze({...base(outcome,r.reason),resolution:r.evidence?clone(r.evidence):null});}

function createAcceptedEvidenceRoleResolutionWiring({acceptedPolicyLedgerPort,acceptedAssignmentLedgerPort,acceptedDelegationLedgerPort}={}){
  for(const [n,p] of Object.entries({acceptedPolicyLedgerPort,acceptedAssignmentLedgerPort,acceptedDelegationLedgerPort})) if(typeof p!=="function") throw new TypeError(`${n} is required`);
  const resolver=createGovernanceRoleRequirementPrincipalRoleResolution({
    acceptedPolicyPort:(q)=>acceptedPolicyLedgerPort(deepFreeze(clone(q))),
    acceptedAssignmentsPort:(q)=>acceptedAssignmentLedgerPort(deepFreeze(clone(q))),
    acceptedDelegationsPort:(q)=>acceptedDelegationLedgerPort(deepFreeze(clone(q)))
  });
  return Object.freeze({
    resolveRequirement(request){
      if(!exact(request,["rulesetVersion","governanceAct","contextScope"])||request.rulesetVersion!==RULESET_VERSION)return base(OUTCOMES.INVALID,"INVALID_REQUEST");
      try{return mapResult(resolver.resolveRequirement({rulesetVersion:ROLE_RULESET_VERSION,governanceAct:request.governanceAct,contextScope:deepFreeze(clone(request.contextScope))}));}catch(_){return base(OUTCOMES.UNKNOWN,"ROLE_REQUIREMENT_RESOLUTION_UNAVAILABLE");}
    },
    resolvePrincipalRole(request){
      if(!exact(request,["rulesetVersion","principalRef","principalRevision","roleRef","roleRevision","contextScope"])||request.rulesetVersion!==RULESET_VERSION)return base(OUTCOMES.INVALID,"INVALID_REQUEST");
      try{return mapResult(resolver.resolvePrincipalRole({rulesetVersion:ROLE_RULESET_VERSION,principalRef:request.principalRef,principalRevision:request.principalRevision,roleRef:request.roleRef,roleRevision:request.roleRevision,contextScope:deepFreeze(clone(request.contextScope))}));}catch(_){return base(OUTCOMES.UNKNOWN,"PRINCIPAL_ROLE_RESOLUTION_UNAVAILABLE");}
    }
  });
}

module.exports={RULESET_VERSION,OUTCOMES,createAcceptedEvidenceRoleResolutionWiring};
