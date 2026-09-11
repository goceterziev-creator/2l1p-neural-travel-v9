'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'current-governed-continuation-authorization-evidence-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ RESOLVED:'RESOLVED', NOT_RESOLVED:'NOT_RESOLVED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });
const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const canonical = v => Array.isArray(v) ? v.map(canonical) : (plain(v) ? Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}) : v);
const stringify = v => JSON.stringify(canonical(v));
const digest = v => `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(v),'utf8')).digest('hex')}`;

function validScope(s){
  return Boolean(plain(s) && s.scopeType==='GATE' && nonEmpty(s.interactionId) && Number.isInteger(s.fromInteractionRevision) && s.fromInteractionRevision>=0 && (s.throughInteractionRevision===null || (Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision)) && nonEmpty(s.gateId) && Number.isInteger(s.gateRevision) && s.gateRevision>0 && /^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest) && nonEmpty(s.continuationTargetRef));
}

function result(outcome, reason, evidence=null){
  return Object.freeze({ rulesetVersion:RULESET_VERSION, outcome, reason:reason||null, evidence:clone(evidence), authority:AUTHORITY, continuationAuthorized:false, continuationExecuted:false, executionAuthorityCreated:false, executionStartPermitted:false, executionStarted:false, effectAuthorized:false, effectPerformed:false, effectVerified:false });
}

function validAuthorization(a){
  return Boolean(plain(a)
    && nonEmpty(a.continuationAuthorizationId)
    && a.type==='GT63_GOVERNED_CONTINUATION_AUTHORIZATION'
    && a.authorizationState==='AUTHORIZED'
    && a.continuationAuthorized===true
    && a.continuationExecuted===false
    && a.executionAuthorityCreated===false
    && a.effectAuthorized===false
    && a.effectPerformed===false
    && a.authority===AUTHORITY
    && nonEmpty(a.currentSatisfactionEvidenceRef)
    && nonEmpty(a.continuationRequirementEvidenceRef)
    && nonEmpty(a.satisfactionId)
    && /^sha256:[0-9a-f]{64}$/.test(a.satisfactionDigest)
    && nonEmpty(a.principalRef)
    && nonEmpty(a.principalRevision)
    && validScope(a.contextScope));
}

function createCurrentGovernedContinuationAuthorizationEvidence({ authorizationPort, authorizationStatePort } = {}){
  if(typeof authorizationPort!=='function') throw new TypeError('authorizationPort must be a function');
  if(typeof authorizationStatePort!=='function') throw new TypeError('authorizationStatePort must be a function');

  function assess(request){
    const fields=['rulesetVersion','continuationAuthorizationId','expectedPrincipalRef','expectedPrincipalRevision','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','currentSatisfactionEvidenceRef','continuationRequirementEvidenceRef'];
    if(!plain(request) || Object.keys(request).length!==fields.length || Object.keys(request).some(k=>!fields.includes(k)) || request.rulesetVersion!==RULESET_VERSION || !nonEmpty(request.continuationAuthorizationId) || !nonEmpty(request.expectedPrincipalRef) || !nonEmpty(request.expectedPrincipalRevision) || !nonEmpty(request.interactionId) || !Number.isInteger(request.interactionRevision) || request.interactionRevision<0 || !nonEmpty(request.gateId) || !Number.isInteger(request.gateRevision) || request.gateRevision<1 || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest) || !nonEmpty(request.continuationTargetRef) || !nonEmpty(request.currentSatisfactionEvidenceRef) || !nonEmpty(request.continuationRequirementEvidenceRef)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let a; try { a=authorizationPort({continuationAuthorizationId:request.continuationAuthorizationId}); } catch(_) { return result(OUTCOMES.UNKNOWN,'continuation authorization unavailable'); }
    if(a==null) return result(OUTCOMES.NOT_RESOLVED,'continuation authorization not found');
    if(!validAuthorization(a)) return result(OUTCOMES.UNKNOWN,'continuation authorization invalid');
    if(a.continuationAuthorizationId!==request.continuationAuthorizationId) return result(OUTCOMES.NOT_RESOLVED,'continuation authorization id mismatch');

    const s=a.contextScope;
    if(a.principalRef!==request.expectedPrincipalRef || a.principalRevision!==request.expectedPrincipalRevision || s.interactionId!==request.interactionId || s.gateId!==request.gateId || s.gateRevision!==request.gateRevision || s.authorityScopeDigest!==request.authorityScopeDigest || s.continuationTargetRef!==request.continuationTargetRef || request.interactionRevision<s.fromInteractionRevision || (s.throughInteractionRevision!==null && request.interactionRevision>s.throughInteractionRevision) || a.currentSatisfactionEvidenceRef!==request.currentSatisfactionEvidenceRef || a.continuationRequirementEvidenceRef!==request.continuationRequirementEvidenceRef) return result(OUTCOMES.NOT_RESOLVED,'continuation authorization does not match requested current scope');

    const authorizationDigest=digest(a);
    let state; try { state=authorizationStatePort({continuationAuthorizationId:a.continuationAuthorizationId,authorizationDigest}); } catch(_) { return result(OUTCOMES.UNKNOWN,'authorization state unavailable'); }
    if(!plain(state)) return result(OUTCOMES.UNKNOWN,'authorization state missing');
    const stateFields=['continuationAuthorizationId','authorizationDigest','lifecycleState','freshnessState','contradictionState','authority'];
    if(Object.keys(state).length!==stateFields.length || Object.keys(state).some(k=>!stateFields.includes(k))) return result(OUTCOMES.UNKNOWN,'authorization state schema invalid');
    if(state.continuationAuthorizationId!==a.continuationAuthorizationId || state.authorizationDigest!==authorizationDigest || state.lifecycleState!=='CURRENT' || state.freshnessState!=='CURRENT' || state.contradictionState!=='NONE' || state.authority!==AUTHORITY) return result(OUTCOMES.UNKNOWN,'authorization state not current, exact or non-contradictory');

    const material={
      type:'GT63_CURRENT_GOVERNED_CONTINUATION_AUTHORIZATION_EVIDENCE',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,
      continuationAuthorizationId:a.continuationAuthorizationId,authorizationDigest,
      currentSatisfactionEvidenceRef:a.currentSatisfactionEvidenceRef,
      continuationRequirementEvidenceRef:a.continuationRequirementEvidenceRef,
      principalRef:a.principalRef,principalRevision:a.principalRevision,
      contextScope:clone(a.contextScope),lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:AUTHORITY,
      continuationAuthorized:true,continuationExecuted:false,executionAuthorityCreated:false,executionStartPermitted:false,executionStarted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
    };
    const evidence=Object.freeze({ currentContinuationAuthorizationEvidenceRef:`gt63-evidence:current-governed-continuation-authorization:${digest(material).slice(7)}`,...material });
    return result(OUTCOMES.RESOLVED,null,evidence);
  }

  return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createCurrentGovernedContinuationAuthorizationEvidence});
