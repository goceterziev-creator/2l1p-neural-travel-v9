'use strict';

const crypto = require('node:crypto');
const RULESET_VERSION = 'human-gate-authorization-consumption-v0.1.0';
const AUTHORITY = 'NONE';
const OUTCOMES = Object.freeze({ SATISFIED:'SATISFIED', NOT_SATISFIED:'NOT_SATISFIED', UNKNOWN:'UNKNOWN', INVALID:'INVALID' });
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const nonEmpty = v => typeof v === 'string' && v.length > 0;
const canonical = v => Array.isArray(v) ? v.map(canonical) : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}) : v);
const stringify = v => JSON.stringify(canonical(v));
const digest = v => `sha256:${crypto.createHash('sha256').update(Buffer.from(stringify(v),'utf8')).digest('hex')}`;
function result(outcome, reason, satisfaction=null){ return Object.freeze({ outcome, reason:reason||null, satisfaction:clone(satisfaction), authority:AUTHORITY, humanGateSatisfied:outcome===OUTCOMES.SATISFIED, continuationExecuted:false, executionAuthorityCreated:false, effectPerformed:false }); }
function validScope(s){ return !!(s && s.scopeType==='GATE' && nonEmpty(s.interactionId) && Number.isInteger(s.fromInteractionRevision) && s.fromInteractionRevision>=0 && (s.throughInteractionRevision===null || (Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision)) && nonEmpty(s.gateId) && Number.isInteger(s.gateRevision) && s.gateRevision>0 && /^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest) && nonEmpty(s.continuationTargetRef)); }
function covers(parent, child){ return validScope(parent)&&validScope(child)&&parent.interactionId===child.interactionId&&parent.gateId===child.gateId&&parent.gateRevision===child.gateRevision&&parent.authorityScopeDigest===child.authorityScopeDigest&&parent.continuationTargetRef===child.continuationTargetRef&&child.fromInteractionRevision>=parent.fromInteractionRevision&&(parent.throughInteractionRevision===null || (child.throughInteractionRevision!==null&&child.throughInteractionRevision<=parent.throughInteractionRevision)); }
function createHumanGateAuthorizationConsumption({authorizationBindingPort,gateRequirementPort,satisfactionLedger}){
  if(typeof authorizationBindingPort!=='function'||typeof gateRequirementPort!=='function') throw new TypeError('ports required');
  if(!satisfactionLedger||typeof satisfactionLedger.get!=='function'||typeof satisfactionLedger.commit!=='function') throw new TypeError('satisfactionLedger required');
  function assess(req){
    const fields=['rulesetVersion','authorizationBindingId','gateId','gateRevision','authorityScopeDigest','continuationTargetRef','interactionId','interactionRevision','expectedPrincipalRef','expectedPrincipalRevision'];
    if(!req||Object.keys(req).length!==fields.length||Object.keys(req).some(k=>!fields.includes(k))||req.rulesetVersion!==RULESET_VERSION||!nonEmpty(req.authorizationBindingId)||!nonEmpty(req.gateId)||!Number.isInteger(req.gateRevision)||req.gateRevision<1||!/^sha256:[0-9a-f]{64}$/.test(req.authorityScopeDigest)||!nonEmpty(req.continuationTargetRef)||!nonEmpty(req.interactionId)||!Number.isInteger(req.interactionRevision)||req.interactionRevision<0||!nonEmpty(req.expectedPrincipalRef)||!nonEmpty(req.expectedPrincipalRevision)) return result(OUTCOMES.INVALID,'unsupported request schema or ruleset');
    let b; try{b=authorizationBindingPort({bindingId:req.authorizationBindingId});}catch(_){return result(OUTCOMES.UNKNOWN,'authorization binding unavailable');}
    if(!b||b.bindingId!==req.authorizationBindingId||b.type!=='GT63_AUTHENTICATED_GOVERNANCE_AUTHORIZATION_BINDING'||b.authorizationState!=='BOUND'||b.governanceAct!=='GATE_AUTHORIZATION'||b.lifecycleState!=='CURRENT'||b.freshnessState!=='CURRENT'||b.contradictionState!=='NONE'||b.authority!=='NONE'||b.humanGateSatisfied!==false||b.executionAuthorityCreated!==false||b.effectAuthorized!==false||!validScope(b.contextScope)) return result(OUTCOMES.UNKNOWN,'authorization binding invalid or non-current');
    let g; try{g=gateRequirementPort({gateId:req.gateId,gateRevision:req.gateRevision,interactionId:req.interactionId,interactionRevision:req.interactionRevision});}catch(_){return result(OUTCOMES.UNKNOWN,'gate requirement unavailable');}
    if(!g||!nonEmpty(g.gateRequirementEvidenceRef)||g.temporalState!=='CURRENT'||g.contradictionState!=='NONE'||g.authority!=='NONE') return result(OUTCOMES.UNKNOWN,'gate requirement invalid or non-current');
    if(g.gateId!==req.gateId||g.gateRevision!==req.gateRevision||g.authorityScopeDigest!==req.authorityScopeDigest||g.continuationTargetRef!==req.continuationTargetRef||g.interactionId!==req.interactionId||req.interactionRevision<g.fromInteractionRevision||(g.throughInteractionRevision!==null&&req.interactionRevision>g.throughInteractionRevision)) return result(OUTCOMES.NOT_SATISFIED,'gate requirement mismatch');
    if(b.principalRef!==req.expectedPrincipalRef||b.principalRevision!==req.expectedPrincipalRevision||g.requiredPrincipalRef!==req.expectedPrincipalRef||g.requiredPrincipalRevision!==req.expectedPrincipalRevision) return result(OUTCOMES.NOT_SATISFIED,'principal mismatch');
    const scope={scopeType:'GATE',interactionId:req.interactionId,fromInteractionRevision:req.interactionRevision,throughInteractionRevision:req.interactionRevision,gateId:req.gateId,gateRevision:req.gateRevision,authorityScopeDigest:req.authorityScopeDigest,continuationTargetRef:req.continuationTargetRef};
    if(!covers(b.contextScope,scope)) return result(OUTCOMES.NOT_SATISFIED,'authorization binding does not cover exact current gate scope');
    const material={type:'GT63_HUMAN_GATE_AUTHORIZATION_CONSUMPTION',schemaVersion:'1.0',rulesetVersion:RULESET_VERSION,authorizationBindingId:b.bindingId,gateRequirementEvidenceRef:g.gateRequirementEvidenceRef,principalRef:req.expectedPrincipalRef,principalRevision:req.expectedPrincipalRevision,contextScope:scope,satisfactionState:'SATISFIED',authority:AUTHORITY,humanGateSatisfied:true,continuationExecuted:false,executionAuthorityCreated:false,effectPerformed:false};
    const satisfaction={satisfactionId:`human-gate-satisfaction:${digest(material).slice(7)}`,...material};
    let prior; try{prior=satisfactionLedger.get(satisfaction.satisfactionId);}catch(_){return result(OUTCOMES.UNKNOWN,'gate satisfaction ledger unavailable');}
    if(prior) return stringify(prior)===stringify(satisfaction)?result(OUTCOMES.SATISFIED,'same gate satisfaction already accepted',prior):result(OUTCOMES.UNKNOWN,'gate satisfaction identity conflict');
    try{const committed=satisfactionLedger.commit(satisfaction.satisfactionId,Object.freeze(clone(satisfaction))); if(!committed||stringify(committed)!==stringify(satisfaction)) return result(OUTCOMES.UNKNOWN,'gate satisfaction ledger commit conflict');}catch(_){return result(OUTCOMES.UNKNOWN,'gate satisfaction ledger commit conflict');}
    return result(OUTCOMES.SATISFIED,null,satisfaction);
  }
  return Object.freeze({assess,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
function createMemoryLedger(){ const m=new Map(); return Object.freeze({get:k=>m.has(k)?m.get(k):null,commit(k,v){if(m.has(k)) throw new Error('immutable-ledger-conflict');m.set(k,Object.freeze(clone(v)));return m.get(k);}}); }
module.exports={RULESET_VERSION,AUTHORITY,OUTCOMES,createHumanGateAuthorizationConsumption,createMemoryLedger};
