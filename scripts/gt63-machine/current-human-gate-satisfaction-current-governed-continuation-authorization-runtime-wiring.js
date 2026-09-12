'use strict';

const { RULESET_VERSION: BINDING_RULESET_VERSION, createGovernedContinuationAuthorizationCurrentEvidenceBinding } = require('./governed-continuation-authorization-current-evidence-binding');
const { RULESET_VERSION: CURRENT_RULESET_VERSION, createCurrentGovernedContinuationAuthorizationEvidence } = require('./current-governed-continuation-authorization-evidence');

const RULESET_VERSION='current-human-gate-satisfaction-current-governed-continuation-authorization-runtime-wiring-v0.1.0';
const AUTHORITY='NONE';
const GOVERNANCE_PRINCIPAL_REF='gt63-machine:human-principal:goce-v0';
const GOVERNANCE_PRINCIPAL_REVISION='1';
const OUTCOMES=Object.freeze({RESOLVED:'RESOLVED',NOT_AUTHORIZED:'NOT_AUTHORIZED',NOT_RESOLVED:'NOT_RESOLVED',UNKNOWN:'UNKNOWN',INVALID:'INVALID'});
const plain=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
const nonEmpty=v=>typeof v==='string'&&v.length>0;
const exact=(o,fields)=>plain(o)&&Object.keys(o).length===fields.length&&Object.keys(o).every(k=>fields.includes(k));
function result(outcome,reason,evidence=null){return freeze({rulesetVersion:RULESET_VERSION,outcome,reason:reason||null,evidence:clone(evidence),authority:AUTHORITY,continuationAuthorized:outcome===OUTCOMES.RESOLVED,continuationExecuted:false,executionAuthorityCreated:false,executionStartPermitted:false,executionStarted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false});}
function call(port,arg){try{return port(freeze(clone(arg)));}catch(_){return null;}}

function createCurrentHumanGateSatisfactionCurrentGovernedContinuationAuthorizationRuntimeWiring({currentSatisfactionResultPort,continuationRequirementResultPort,authorizationStatePort,authorizationLedger}={}){
  for(const [name,port] of Object.entries({currentSatisfactionResultPort,continuationRequirementResultPort,authorizationStatePort})) if(typeof port!=='function') throw new TypeError(`${name} must be a function`);
  if(!authorizationLedger||typeof authorizationLedger.get!=='function'||typeof authorizationLedger.commit!=='function') throw new TypeError('authorizationLedger get/commit required');
  let lastAuthorization=null;
  const binder=createGovernedContinuationAuthorizationCurrentEvidenceBinding({
    currentSatisfactionResultPort:q=>call(currentSatisfactionResultPort,q),
    continuationRequirementResultPort:q=>call(continuationRequirementResultPort,q),
    authorizationLedger
  });
  const currentEvidence=createCurrentGovernedContinuationAuthorizationEvidence({
    authorizationPort:q=>lastAuthorization&&lastAuthorization.continuationAuthorizationId===q.continuationAuthorizationId?lastAuthorization:null,
    authorizationStatePort:q=>call(authorizationStatePort,q)
  });

  function resolve(request){
    const fields=['rulesetVersion','currentSatisfactionEvidenceRef','continuationRequirementEvidenceRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','expectedPrincipalRef','expectedPrincipalRevision'];
    if(!exact(request,fields)||request.rulesetVersion!==RULESET_VERSION||!nonEmpty(request.currentSatisfactionEvidenceRef)||!nonEmpty(request.continuationRequirementEvidenceRef)||!nonEmpty(request.interactionId)||!Number.isInteger(request.interactionRevision)||request.interactionRevision<0||!nonEmpty(request.gateId)||!Number.isInteger(request.gateRevision)||request.gateRevision<1||!/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest)||!nonEmpty(request.continuationTargetRef)||request.expectedPrincipalRef!==GOVERNANCE_PRINCIPAL_REF||request.expectedPrincipalRevision!==GOVERNANCE_PRINCIPAL_REVISION) return result(OUTCOMES.INVALID,'INVALID_REQUEST');
    lastAuthorization=null;
    const bound=binder.assess({...clone(request),rulesetVersion:BINDING_RULESET_VERSION});
    if(!plain(bound)||bound.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'CONTINUATION_AUTHORIZATION_BINDING_RESULT_INVALID');
    if(bound.outcome==='NOT_AUTHORIZED') return result(OUTCOMES.NOT_AUTHORIZED,bound.reason);
    if(bound.outcome==='INVALID') return result(OUTCOMES.INVALID,bound.reason);
    if(bound.outcome!=='AUTHORIZED'||!plain(bound.authorization)) return result(OUTCOMES.UNKNOWN,bound.reason||'CONTINUATION_AUTHORIZATION_UNRESOLVED');
    lastAuthorization=bound.authorization;
    const a=bound.authorization;
    const current=currentEvidence.assess({rulesetVersion:CURRENT_RULESET_VERSION,continuationAuthorizationId:a.continuationAuthorizationId,expectedPrincipalRef:request.expectedPrincipalRef,expectedPrincipalRevision:request.expectedPrincipalRevision,interactionId:request.interactionId,interactionRevision:request.interactionRevision,gateId:request.gateId,gateRevision:request.gateRevision,authorityScopeDigest:request.authorityScopeDigest,continuationTargetRef:request.continuationTargetRef,currentSatisfactionEvidenceRef:request.currentSatisfactionEvidenceRef,continuationRequirementEvidenceRef:request.continuationRequirementEvidenceRef});
    if(!plain(current)||current.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'CURRENT_CONTINUATION_AUTHORIZATION_RESULT_INVALID');
    if(current.outcome==='NOT_RESOLVED') return result(OUTCOMES.NOT_RESOLVED,current.reason);
    if(current.outcome==='INVALID') return result(OUTCOMES.INVALID,current.reason);
    if(current.outcome!=='RESOLVED'||!plain(current.evidence)) return result(OUTCOMES.UNKNOWN,current.reason||'CURRENT_CONTINUATION_AUTHORIZATION_UNRESOLVED');
    return result(OUTCOMES.RESOLVED,null,current.evidence);
  }
  return Object.freeze({resolve,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,GOVERNANCE_PRINCIPAL_REF,GOVERNANCE_PRINCIPAL_REVISION,OUTCOMES,createCurrentHumanGateSatisfactionCurrentGovernedContinuationAuthorizationRuntimeWiring});
