'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'current-human-gate-satisfaction-evidence-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ RESOLVED:'RESOLVED', NOT_RESOLVED:'NOT_RESOLVED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });
const plain = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const canonical = v => Array.isArray(v) ? v.map(canonical) : (plain(v) ? Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}) : v);
const stringify = v => JSON.stringify(canonical(v));
const digest = v => `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(v),'utf8')).digest('hex')}`;
const validScope = s => Boolean(s && s.scopeType==='GATE' && nonEmpty(s.interactionId) && Number.isInteger(s.fromInteractionRevision) && s.fromInteractionRevision>=0 && (s.throughInteractionRevision===null || (Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision)) && nonEmpty(s.gateId) && Number.isInteger(s.gateRevision) && s.gateRevision>0 && /^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest) && nonEmpty(s.continuationTargetRef));

function result(outcome, reason, evidence=null) {
  return Object.freeze({ rulesetVersion:RULESET_VERSION, outcome, reason:reason||null, evidence:clone(evidence), authority:AUTHORITY, humanGateSatisfied:outcome===OUTCOMES.RESOLVED, continuationAuthorized:false, continuationExecuted:false, executionAuthorityCreated:false, effectAuthorized:false, effectPerformed:false });
}

function validSatisfiedWrapper(wrapper) {
  if (!plain(wrapper) || wrapper.outcome!=='SATISFIED' || wrapper.authority!==AUTHORITY || wrapper.humanGateSatisfied!==true || wrapper.continuationAuthorized!==false || wrapper.continuationExecuted!==false || wrapper.executionAuthorityCreated!==false || wrapper.effectAuthorized!==false || wrapper.effectPerformed!==false) return false;
  const s = wrapper.satisfaction;
  return Boolean(plain(s)
    && nonEmpty(s.satisfactionId)
    && s.type==='GT63_HUMAN_GATE_AUTHORIZATION_CONSUMPTION'
    && s.satisfactionState==='SATISFIED'
    && s.humanGateSatisfied===true
    && s.authority===AUTHORITY
    && s.continuationExecuted===false
    && s.executionAuthorityCreated===false
    && s.effectPerformed===false
    && nonEmpty(s.principalRef)
    && nonEmpty(s.principalRevision)
    && validScope(s.contextScope));
}

function validStateAttestation(a, satisfaction) {
  const fields=['satisfactionId','satisfactionDigest','lifecycleState','freshnessState','contradictionState','authority'];
  return plain(a)
    && Object.keys(a).length===fields.length
    && Object.keys(a).every(k=>fields.includes(k))
    && a.satisfactionId===satisfaction.satisfactionId
    && a.satisfactionDigest===digest(satisfaction)
    && a.lifecycleState==='CURRENT'
    && a.freshnessState==='CURRENT'
    && a.contradictionState==='NONE'
    && a.authority===AUTHORITY;
}

function createCurrentHumanGateSatisfactionEvidence({ satisfactionResultPort, satisfactionStatePort } = {}) {
  if (typeof satisfactionResultPort!=='function') throw new TypeError('satisfactionResultPort must be a function');
  if (typeof satisfactionStatePort!=='function') throw new TypeError('satisfactionStatePort must be a function');

  function resolve(request) {
    const fields=['rulesetVersion','satisfactionId','expectedPrincipalRef','expectedPrincipalRevision','gateId','gateRevision','interactionId','interactionRevision','authorityScopeDigest','continuationTargetRef'];
    if (!plain(request) || Object.keys(request).length!==fields.length || Object.keys(request).some(k=>!fields.includes(k)) || request.rulesetVersion!==RULESET_VERSION || !nonEmpty(request.satisfactionId) || !nonEmpty(request.expectedPrincipalRef) || !nonEmpty(request.expectedPrincipalRevision) || !nonEmpty(request.gateId) || !Number.isInteger(request.gateRevision) || request.gateRevision<1 || !nonEmpty(request.interactionId) || !Number.isInteger(request.interactionRevision) || request.interactionRevision<0 || !/^sha256:[0-9a-f]{64}$/.test(request.authorityScopeDigest) || !nonEmpty(request.continuationTargetRef)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');

    let wrapper; try { wrapper=satisfactionResultPort({satisfactionId:request.satisfactionId}); } catch (_) { return result(OUTCOMES.UNKNOWN,'gate satisfaction result unavailable'); }
    if (wrapper==null) return result(OUTCOMES.NOT_RESOLVED,'gate satisfaction not found');
    if (!validSatisfiedWrapper(wrapper)) return result(OUTCOMES.UNKNOWN,'gate satisfaction result invalid');
    const s=wrapper.satisfaction;
    if (s.satisfactionId!==request.satisfactionId || s.principalRef!==request.expectedPrincipalRef || s.principalRevision!==request.expectedPrincipalRevision) return result(OUTCOMES.NOT_RESOLVED,'gate satisfaction identity or principal mismatch');
    const scope=s.contextScope;
    if (scope.gateId!==request.gateId || scope.gateRevision!==request.gateRevision || scope.interactionId!==request.interactionId || scope.authorityScopeDigest!==request.authorityScopeDigest || scope.continuationTargetRef!==request.continuationTargetRef || request.interactionRevision<scope.fromInteractionRevision || (scope.throughInteractionRevision!==null && request.interactionRevision>scope.throughInteractionRevision)) return result(OUTCOMES.NOT_RESOLVED,'gate satisfaction does not cover requested scope');

    let state; try { state=satisfactionStatePort({satisfactionId:s.satisfactionId,satisfactionDigest:digest(s)}); } catch (_) { return result(OUTCOMES.UNKNOWN,'gate satisfaction state unavailable'); }
    if (!validStateAttestation(state,s)) return result(OUTCOMES.UNKNOWN,'gate satisfaction non-current, stale, contradictory, or unbound');

    const material={
      type:'GT63_CURRENT_HUMAN_GATE_SATISFACTION_EVIDENCE', schemaVersion:'1.0', rulesetVersion:RULESET_VERSION,
      satisfactionId:s.satisfactionId, satisfactionDigest:digest(s), principalRef:s.principalRef, principalRevision:s.principalRevision,
      contextScope:clone(s.contextScope), lifecycleState:'CURRENT', freshnessState:'CURRENT', contradictionState:'NONE', authority:AUTHORITY,
      humanGateSatisfied:true, continuationAuthorized:false, continuationExecuted:false, executionAuthorityCreated:false, effectAuthorized:false, effectPerformed:false
    };
    const evidence=Object.freeze({ currentSatisfactionEvidenceRef:`gt63-evidence:current-human-gate-satisfaction:${digest(material).slice(7)}`,...material });
    return result(OUTCOMES.RESOLVED,null,evidence);
  }

  return Object.freeze({ resolve, rulesetVersion:RULESET_VERSION, authority:AUTHORITY });
}

module.exports=Object.freeze({ RULESET_VERSION, AUTHORITY, OUTCOMES, createCurrentHumanGateSatisfactionEvidence });
