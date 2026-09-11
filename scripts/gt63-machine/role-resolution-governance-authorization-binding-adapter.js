"use strict";

const {
  RULESET_VERSION: ROLE_RULESET_VERSION,
  OUTCOMES: ROLE_OUTCOMES
} = require("./governance-role-requirement-principal-role-resolution");

const RULESET_VERSION = "role-resolution-governance-authorization-binding-adapter-v0.1.0";
const AUTHORITY = "NONE";

function plain(value){return Boolean(value&&typeof value==="object"&&!Array.isArray(value));}
function nonEmpty(value){return typeof value==="string"&&value.length>0;}
function exact(record,fields){return plain(record)&&Object.keys(record).length===fields.length&&Object.keys(record).every((k)=>fields.includes(k));}
function clone(value){return value===null||value===undefined?value:JSON.parse(JSON.stringify(value));}
function deepFreeze(value){if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(deepFreeze);}return value;}
function validGateScope(scope){return exact(scope,["scopeType","interactionId","fromInteractionRevision","throughInteractionRevision","gateId","gateRevision","authorityScopeDigest","continuationTargetRef"])
  &&scope.scopeType==="GATE"&&nonEmpty(scope.interactionId)&&Number.isInteger(scope.fromInteractionRevision)&&scope.fromInteractionRevision>=0
  &&(scope.throughInteractionRevision===null||(Number.isInteger(scope.throughInteractionRevision)&&scope.throughInteractionRevision>=scope.fromInteractionRevision))
  &&nonEmpty(scope.gateId)&&Number.isInteger(scope.gateRevision)&&scope.gateRevision>0&&/^sha256:[0-9a-f]{64}$/.test(scope.authorityScopeDigest)&&nonEmpty(scope.continuationTargetRef);}
function validRequirementEvidence(e){return plain(e)&&e.type==="GT63_GOVERNANCE_ROLE_REQUIREMENT_RESOLUTION"&&e.rulesetVersion===ROLE_RULESET_VERSION
  &&nonEmpty(e.requirementRef)&&nonEmpty(e.requirementRevision)&&e.governanceAct==="GATE_AUTHORIZATION"&&nonEmpty(e.requiredRoleRef)&&nonEmpty(e.requiredRoleRevision)
  &&validGateScope(e.contextScope)&&nonEmpty(e.roleRequirementEvidenceRef)&&e.authority===AUTHORITY;}
function validRoleEvidence(e){return plain(e)&&e.type==="GT63_PRINCIPAL_ROLE_RESOLUTION"&&e.rulesetVersion===ROLE_RULESET_VERSION
  &&["DIRECT_ASSIGNMENT","DELEGATION"].includes(e.roleResolutionType)&&nonEmpty(e.principalRef)&&nonEmpty(e.principalRevision)&&nonEmpty(e.roleRef)&&nonEmpty(e.roleRevision)
  &&validGateScope(e.contextScope)&&Array.isArray(e.roleEvidenceRefs)&&e.roleEvidenceRefs.length>0&&e.roleEvidenceRefs.every(nonEmpty)
  &&e.lifecycleState==="CURRENT"&&e.freshnessState==="CURRENT"&&e.contradictionState==="NONE"&&e.authority===AUTHORITY;}

function createRoleResolutionGovernanceAuthorizationBindingAdapter({roleResolutionPrimitive}){
  if(!roleResolutionPrimitive||typeof roleResolutionPrimitive.resolveRequirement!=="function"||typeof roleResolutionPrimitive.resolvePrincipalRole!=="function"){
    throw new TypeError("roleResolutionPrimitive with resolveRequirement/resolvePrincipalRole is required");
  }
  function unwrap(kind,result){
    if(!plain(result)||result.authority!==AUTHORITY||!nonEmpty(result.outcome)) throw new Error(`${kind} resolution unavailable`);
    if(result.outcome!==ROLE_OUTCOMES.RESOLVED) throw new Error(`${kind} resolution not resolved`);
    if(kind==="requirement"&&!validRequirementEvidence(result.evidence)) throw new Error("requirement resolution evidence invalid");
    if(kind==="role"&&!validRoleEvidence(result.evidence)) throw new Error("role resolution evidence invalid");
    return deepFreeze(clone(result.evidence));
  }
  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    authority:AUTHORITY,
    governanceRoleRequirementPort({governanceAct,contextScope}){
      const result=roleResolutionPrimitive.resolveRequirement(deepFreeze({rulesetVersion:ROLE_RULESET_VERSION,governanceAct,contextScope:clone(contextScope)}));
      return unwrap("requirement",result);
    },
    roleResolutionPort({principalRef,principalRevision,roleRef,roleRevision,contextScope}){
      const result=roleResolutionPrimitive.resolvePrincipalRole(deepFreeze({rulesetVersion:ROLE_RULESET_VERSION,principalRef,principalRevision,roleRef,roleRevision,contextScope:clone(contextScope)}));
      return unwrap("role",result);
    }
  });
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,createRoleResolutionGovernanceAuthorizationBindingAdapter});
