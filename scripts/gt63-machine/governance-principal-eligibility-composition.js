"use strict";
const E=require("./governance-principal-eligibility-assessment");
const R=require("./governance-role-resolution");
function createGovernancePrincipalEligibilityComposition({authenticatedPrincipalPort,governanceRoleRequirementPort,acceptedAssignmentPort,acceptedDelegationPort,assignmentCurrentStatePort,delegationCurrentStatePort}){
 const resolver=R.createGovernanceRoleResolution({acceptedAssignmentPort,acceptedDelegationPort,assignmentCurrentStatePort,delegationCurrentStatePort});
 const assessment=E.createGovernancePrincipalEligibilityAssessment({
  authenticatedPrincipalPort,
  governanceRoleRequirementPort,
  roleResolutionPort(query){
   const out=resolver.resolve({rulesetVersion:R.RULESET_VERSION,...query});
   return out.outcome===R.OUTCOMES.MATCH?out.resolution:null;
  }
 });
 function principalEligibilityPort(query){
  const out=assessment.assess({rulesetVersion:E.RULESET_VERSION,...query});
  return out.evidence;
 }
 return Object.freeze({principalEligibilityPort,assessment,resolver,authority:"NONE"});
}
module.exports=Object.freeze({createGovernancePrincipalEligibilityComposition});
