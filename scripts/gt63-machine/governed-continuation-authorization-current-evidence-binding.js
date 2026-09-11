'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'governed-continuation-authorization-current-evidence-binding-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ AUTHORIZED:'AUTHORIZED', NOT_AUTHORIZED:'NOT_AUTHORIZED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });
const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const canonical = v => Array.isArray(v) ? v.map(canonical) : (plain(v) ? Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}) : v);
const stringify = v => JSON.stringify(canonical(v));
const digest = v => `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(v),'utf8')).digest('hex')}`;

function result(outcome, reason, authorization=null) {
  return Object.freeze({ rulesetVersion:RULESET_VERSION, outcome, reason:reason||null, authorization:clone(authorization), authority:AUTHORITY, continuationAuthorized:outcome===OUTCOMES.AUTHORIZED, continuationExecuted:false, executionAuthorityCreated:false, effectAuthorized:false, effectPerformed:false });
}

function validScope(s) {
  return Boolean(plain(s) && s.scopeType==='GATE' && nonEmpty(s.interactionId) && Number.isInteger(s.fromInteractionRevision) && s.fromInteractionRevision>=0 && (s.throughInteractionRevision===null || (Number.isInteger(s.throughInteractionRevision) && s.throughInteractionRevision>=s.fromInteractionRevision)) && nonEmpty(s.gateId) && Number.isInteger(s.gateRevision) && s.gateRevision>0 && /^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest) && nonEmpty(s.continuationTargetRef));
}

function validCurrentSatisfactionWrapper(w) {
  if (!plain(w) || w.outcome!=='RESOLVED' || w.authority!==AUTHORITY || w.humanGateSatisfied!==true || w.continuationAuthorized!==false || w.continuationExecuted!==false || w.executionAuthorityCreated!==false || w.effectAuthorized!==false || w.effectPerformed!==false) return false;
  const e=w.evidence;
  return Boolean(plain(e) && nonEmpty(e.currentSatisfactionEvidenceRef) && e.type==='GT63_CURRENT_HUMAN_GATE_SATISFACTION_EVIDENCE' && nonEmpty(e.satisfactionId) && /^sha256:[0-9a-f]{64}$/.test(e.satisfactionDigest) && nonEmpty(e.principalRef) && nonEmpty(e.principalRevision) && validScope(e.contextScope) && e.lifecycleState==='CURRENT' && e.freshnessState==='CURRENT' && e.contradictionState==='NONE' && e.authority===AUTHORITY && e.humanGateSatisfied===true && e.continuationAuthorized===false && e.continuationExecuted===false && e.executionAuthorityCreated===false && e.effectAuthorized===false && e.effectPerformed===false);
}

function validRequirementWrapper(w) {
  if (!plain(w) || w.outcome!=='RESOLVED' || w.authority!==AUTHORITY || w.humanGateSatisfied!==false || w.continuationAuthorized!==false || w.continuationExecuted!==false || w.executionAuthorityCreated!==false || w.effectAuthorized!==false || w.effectPerformed!==false) return false;
  const e=w.evidence;
  return Boolean(plain(e) && nonEmpty(e.continuationRequirementEvidenceRef) && e.type==='GT63_CONTINUATION_REQUIREMENT_EVIDENCE' && nonEmpty(e.continuationTargetRef) && nonEmpty(e.interactionId) && Number.isInteger(e.fromInteractionRevision) && e.fromInteractionRevision>=0 && (e.throughInteractionRevision===null || (Number.isInteger(e.throughInteractionRevision) && e.throughInteractionRevision>=e.fromInteractionRevision)) && nonEmpty(e.gateId) && Number.isInteger(e.gateRevision) && e.gateRevision>0 && /^sha256:[0-9a-f]{64}$/.test(e.authorityScopeDigest) && nonEmpty(e.requiredPrincipalRef) && nonEmpty(e.requiredPrincipalRevision) && e.lifecycleState==='CURRENT' && e.freshnessState==='CURRENT' && e.contradictionState==='NONE' && e.authority===AUTHORITY && e.humanGateSatisfied===false && e.continuationAuthorized===false && e.continuationExecuted===false && e.executionAuthorityCreated===false && e.effectAuthorized===false && e.effectPerformed===false);
}

function createGovernedContinuationAuthorizationCurrentEvidenceBinding({ currentSatisfactionResultPort, continuationRequirementResultPort, authorizationLedger } = {}) {
  if (typeof currentSatisfactionResultPort!=='function') throw new TypeError('currentSatisfactionResultPort must be a function');
  if (typeof continuationRequirementResultPort!=='function') throw new TypeError('continuationRequirementResultPort must be a function');
  if (!authorizationLedger || typeof authorizationLedger.get!=='function' || typeof authorizationLedger.commit!=='function') throw new TypeError('authorizationLedger get/commit required');

  function assess(request) {
    const fields=['rulesetVersion','currentSatisfactionEvidenceRef','continuationRequirementEvidenceRef','interactionId','interactionRevision','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','expectedPrincipalRef','expectedPrincipalRevision'];
    if (!plain(request) || Object.keys(request).length!==fields.length || Object.keys(request).some(k=>!fields.includes(k)) || request.rulesetVersion!==RULESET_VERSION || !nonEmpty(request.currentSatisfactionEvidenceRef) || !nonEmpty(request.continuationRequirementEvidenceRef) || !nonEmpty(request.interactionId) || !Number.isInteger(request.interactionRevision) || request.interactionRevision<0 || !nonEmpty(request.gateId) || !Number.isInteger(request.gateRevision) || request.gateRevision<1 || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest) || !nonEmpty(request.continuationTargetRef) || !nonEmpty(request.expectedPrincipalRef) || !nonEmpty(request.expectedPrincipalRevision)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let sw; try { sw=currentSatisfactionResultPort({currentSatisfactionEvidenceRef:request.currentSatisfactionEvidenceRef}); } catch (_) { return result(OUTCOMES.UNKNOWN,'current satisfaction evidence unavailable'); }
    if (!validCurrentSatisfactionWrapper(sw)) return result(OUTCOMES.UNKNOWN,'current satisfaction evidence invalid or unresolved');
    const s=sw.evidence;
    if (s.currentSatisfactionEvidenceRef!==request.currentSatisfactionEvidenceRef) return result(OUTCOMES.NOT_AUTHORIZED,'current satisfaction evidence ref mismatch');

    let rw; try { rw=continuationRequirementResultPort({continuationRequirementEvidenceRef:request.continuationRequirementEvidenceRef}); } catch (_) { return result(OUTCOMES.UNKNOWN,'continuation requirement evidence unavailable'); }
    if (!validRequirementWrapper(rw)) return result(OUTCOMES.UNKNOWN,'continuation requirement evidence invalid or unresolved');
    const r=rw.evidence;
    if (r.continuationRequirementEvidenceRef!==request.continuationRequirementEvidenceRef) return result(OUTCOMES.NOT_AUTHORIZED,'continuation requirement evidence ref mismatch');

    const scope=s.contextScope;
    const mismatch = s.principalRef!==request.expectedPrincipalRef || s.principalRevision!==request.expectedPrincipalRevision || r.requiredPrincipalRef!==request.expectedPrincipalRef || r.requiredPrincipalRevision!==request.expectedPrincipalRevision || scope.interactionId!==request.interactionId || r.interactionId!==request.interactionId || scope.gateId!==request.gateId || r.gateId!==request.gateId || scope.gateRevision!==request.gateRevision || r.gateRevision!==request.gateRevision || scope.authorityScopeDigest!==request.authorityScopeDigest || r.authorityScopeDigest!==request.authorityScopeDigest || scope.continuationTargetRef!==request.continuationTargetRef || r.continuationTargetRef!==request.continuationTargetRef || request.interactionRevision<scope.fromInteractionRevision || (scope.throughInteractionRevision!==null && request.interactionRevision>scope.throughInteractionRevision) || request.interactionRevision<r.fromInteractionRevision || (r.throughInteractionRevision!==null && request.interactionRevision>r.throughInteractionRevision);
    if (mismatch) return result(OUTCOMES.NOT_AUTHORIZED,'current evidence mismatch');

    const contextScope={scopeType:'GATE',interactionId:request.interactionId,fromInteractionRevision:request.interactionRevision,throughInteractionRevision:request.interactionRevision,gateId:request.gateId,gateRevision:request.gateRevision,authorityScopeDigest:request.authorityScopeDigest,continuationTargetRef:request.continuationTargetRef};
    const material={type:'GT63_GOVERNED_CONTINUATION_AUTHORIZATION',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,currentSatisfactionEvidenceRef:s.currentSatisfactionEvidenceRef,continuationRequirementEvidenceRef:r.continuationRequirementEvidenceRef,satisfactionId:s.satisfactionId,satisfactionDigest:s.satisfactionDigest,principalRef:request.expectedPrincipalRef,principalRevision:request.expectedPrincipalRevision,contextScope,authorizationState:'AUTHORIZED',authority:AUTHORITY,continuationAuthorized:true,continuationExecuted:false,executionAuthorityCreated:false,effectAuthorized:false,effectPerformed:false};
    const authorization=Object.freeze({continuationAuthorizationId:`continuation-authorization:${digest(material).slice(7)}`,...material});

    let prior; try { prior=authorizationLedger.get(authorization.continuationAuthorizationId); } catch (_) { return result(OUTCOMES.UNKNOWN,'continuation authorization ledger unavailable'); }
    if (prior) return stringify(prior)===stringify(authorization) ? result(OUTCOMES.AUTHORIZED,'same continuation authorization already accepted',prior) : result(OUTCOMES.UNKNOWN,'continuation authorization identity conflict');
    try { const committed=authorizationLedger.commit(authorization.continuationAuthorizationId,Object.freeze(clone(authorization))); if (!committed || stringify(committed)!==stringify(authorization)) return result(OUTCOMES.UNKNOWN,'continuation authorization ledger commit conflict'); } catch (_) { return result(OUTCOMES.UNKNOWN,'continuation authorization ledger commit conflict'); }
    return result(OUTCOMES.AUTHORIZED,null,authorization);
  }

  return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}

function createMemoryLedger(){const records=new Map();return Object.freeze({get:k=>records.has(k)?records.get(k):null,commit(k,v){if(records.has(k))throw new Error('immutable-ledger-conflict');records.set(k,Object.freeze(clone(v)));return records.get(k);}});}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,OUTCOMES,createGovernedContinuationAuthorizationCurrentEvidenceBinding,createMemoryLedger});
