"use strict";

const crypto = require("node:crypto");
const RULESET_VERSION = "governance-principal-identity-binding-v0.1.0";
const AUTHORITY = "NONE";
const GOVERNANCE_PRINCIPAL_REF = "gt63-machine:human-principal:goce-v0";
const GOVERNANCE_PRINCIPAL_REVISION = "1";
const OUTCOMES = Object.freeze({ BOUND:"GOVERNANCE_PRINCIPAL_IDENTITY_BOUND", NOT_BOUND:"GOVERNANCE_PRINCIPAL_IDENTITY_NOT_BOUND", UNKNOWN:"GOVERNANCE_PRINCIPAL_IDENTITY_UNKNOWN", INVALID:"GOVERNANCE_PRINCIPAL_IDENTITY_INVALID" });
function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function digest(v){return crypto.createHash("sha256").update(Buffer.from(JSON.stringify(v),"utf8")).digest("hex");}
function result(outcome,reason,evidence=null){return freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,eligibilityCreated:false,roleAuthorityCreated:false,humanGateSatisfied:false,continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false});}
function createGovernancePrincipalIdentityBinding({identityAnchorPort}={}){
 if(typeof identityAnchorPort!=="function")throw new TypeError("identityAnchorPort must be a function");
 function assess(externalIdentity){
  if(!plain(externalIdentity)||externalIdentity.type!=="GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING"||!nonEmpty(externalIdentity.principalRef)||externalIdentity.principalNamespace!=="github.com"||!nonEmpty(externalIdentity.principalRevision)||!Number.isInteger(externalIdentity.githubUserId)||!nonEmpty(externalIdentity.githubLogin)||!nonEmpty(externalIdentity.principalEvidenceRef)||externalIdentity.authority!==AUTHORITY)return result(OUTCOMES.INVALID,"unsupported external identity evidence");
  if(externalIdentity.principalRef!==`gt63-machine:principal:github:${externalIdentity.githubUserId}`)return result(OUTCOMES.NOT_BOUND,"external principal reference does not match authenticated GitHub numeric identity");
  if(externalIdentity.lifecycleState!=="CURRENT"||externalIdentity.freshnessState!=="CURRENT"||externalIdentity.contradictionState!=="NONE")return result(OUTCOMES.UNKNOWN,"external identity evidence non-current or contradictory");
  let anchor;try{anchor=identityAnchorPort();}catch(_){return result(OUTCOMES.UNKNOWN,"identity anchor unavailable");}
  if(!plain(anchor)||anchor.type!=="GT63_GOVERNANCE_PRINCIPAL_IDENTITY_ANCHOR"||anchor.schemaVersion!=="1.0"||anchor.rulesetVersion!=="governance-principal-identity-anchor-v0.1.0"||anchor.governancePrincipalRef!==GOVERNANCE_PRINCIPAL_REF||anchor.governancePrincipalRevision!==GOVERNANCE_PRINCIPAL_REVISION||anchor.identityProvider!=="github.com"||!Number.isInteger(anchor.githubUserId)||!nonEmpty(anchor.githubLogin)||anchor.lifecycleState!=="CURRENT"||anchor.freshnessState!=="CURRENT"||anchor.contradictionState!=="NONE"||anchor.acceptanceState!=="ACCEPTED"||anchor.authority!==AUTHORITY)return result(OUTCOMES.UNKNOWN,"identity anchor invalid, non-current, contradictory, or unaccepted");
  if(externalIdentity.githubUserId!==anchor.githubUserId||externalIdentity.githubLogin!==anchor.githubLogin)return result(OUTCOMES.NOT_BOUND,"authenticated GitHub identity does not match approved anchor");
  const material={type:"GT63_GOVERNANCE_PRINCIPAL_IDENTITY_BINDING_EVIDENCE",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,governancePrincipalRef:GOVERNANCE_PRINCIPAL_REF,governancePrincipalRevision:GOVERNANCE_PRINCIPAL_REVISION,externalPrincipalRef:externalIdentity.principalRef,externalPrincipalRevision:externalIdentity.principalRevision,externalPrincipalEvidenceRef:externalIdentity.principalEvidenceRef,identityProvider:"github.com",githubUserId:anchor.githubUserId,githubLogin:anchor.githubLogin,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY};
  return result(OUTCOMES.BOUND,null,{principalRef:GOVERNANCE_PRINCIPAL_REF,principalRevision:GOVERNANCE_PRINCIPAL_REVISION,principalEvidenceRef:`gt63-evidence:governance-principal-identity-binding:${digest(material)}`,...material});
 }
 return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,GOVERNANCE_PRINCIPAL_REF,GOVERNANCE_PRINCIPAL_REVISION,OUTCOMES,createGovernancePrincipalIdentityBinding});
