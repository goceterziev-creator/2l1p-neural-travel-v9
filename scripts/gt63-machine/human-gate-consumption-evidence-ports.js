'use strict';

const RULESET_VERSION='human-gate-consumption-evidence-ports-v0.1.0';
const AUTHORITY='NONE';
function plain(v){return !!(v&&typeof v==='object'&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==='string'&&v.length>0;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function exact(o,f){return plain(o)&&Object.keys(o).length===f.length&&Object.keys(o).every(k=>f.includes(k));}
function validScope(s){return plain(s)&&s.scopeType==='GATE'&&nonEmpty(s.interactionId)&&Number.isInteger(s.fromInteractionRevision)&&s.fromInteractionRevision>=0&&(s.throughInteractionRevision===null||(Number.isInteger(s.throughInteractionRevision)&&s.throughInteractionRevision>=s.fromInteractionRevision))&&nonEmpty(s.gateId)&&Number.isInteger(s.gateRevision)&&s.gateRevision>0&&/^sha256:[0-9a-f]{64}$/.test(s.authorityScopeDigest)&&nonEmpty(s.continuationTargetRef);}
function validBinding(b){return plain(b)&&nonEmpty(b.bindingId)&&b.type==='GT63_AUTHENTICATED_GOVERNANCE_AUTHORIZATION_BINDING'&&b.authorizationState==='BOUND'&&b.governanceAct==='GATE_AUTHORIZATION'&&nonEmpty(b.principalRef)&&nonEmpty(b.principalRevision)&&validScope(b.contextScope)&&b.lifecycleState==='CURRENT'&&b.freshnessState==='CURRENT'&&b.contradictionState==='NONE'&&b.authority===AUTHORITY&&b.humanGateSatisfied===false&&b.executionAuthorityCreated===false&&b.effectAuthorized===false;}
function validGate(g){return plain(g)&&nonEmpty(g.gateRequirementEvidenceRef)&&nonEmpty(g.gateId)&&Number.isInteger(g.gateRevision)&&g.gateRevision>0&&nonEmpty(g.interactionId)&&Number.isInteger(g.fromInteractionRevision)&&g.fromInteractionRevision>=0&&(g.throughInteractionRevision===null||(Number.isInteger(g.throughInteractionRevision)&&g.throughInteractionRevision>=g.fromInteractionRevision))&&/^sha256:[0-9a-f]{64}$/.test(g.authorityScopeDigest)&&nonEmpty(g.continuationTargetRef)&&nonEmpty(g.requiredPrincipalRef)&&nonEmpty(g.requiredPrincipalRevision)&&g.temporalState==='CURRENT'&&g.contradictionState==='NONE'&&g.authority===AUTHORITY;}
function gateKey(r){return `${r.gateId}\u0000${r.gateRevision}\u0000${r.interactionId}\u0000${r.interactionRevision}`;}
function createMemoryRegistry({authorizationBindings=[],gateRequirements=[]}={}){
  const bindings=new Map(),gates=[];
  for(const b of authorizationBindings){if(!validBinding(b))throw new TypeError('invalid authorization binding');if(bindings.has(b.bindingId))throw new TypeError('duplicate authorization binding id');bindings.set(b.bindingId,freeze(clone(b)));}
  for(const g of gateRequirements){if(!validGate(g))throw new TypeError('invalid gate requirement');gates.push(freeze(clone(g)));}
  return Object.freeze({
    getBinding(id){return bindings.has(id)?bindings.get(id):null;},
    getGateRequirement(q){const matches=gates.filter(g=>g.gateId===q.gateId&&g.gateRevision===q.gateRevision&&g.interactionId===q.interactionId&&q.interactionRevision>=g.fromInteractionRevision&&(g.throughInteractionRevision===null||q.interactionRevision<=g.throughInteractionRevision));return matches.length===1?matches[0]:matches;}
  });
}
function createHumanGateConsumptionEvidencePorts({registry}={}){
  if(!registry||typeof registry.getBinding!=='function'||typeof registry.getGateRequirement!=='function')throw new TypeError('registry lookup functions required');
  function authorizationBindingPort(request){if(!exact(request,['bindingId'])||!nonEmpty(request.bindingId))throw new Error('invalid authorization binding lookup');let r;try{r=registry.getBinding(request.bindingId);}catch(_){throw new Error('authorization binding registry unavailable');}if(r==null)throw new Error('authorization binding not found');const list=Array.isArray(r)?r:[r];if(list.length!==1)throw new Error('authorization binding identity conflict');const b=list[0];if(!validBinding(b)||b.bindingId!==request.bindingId)throw new Error('authorization binding invalid or mismatched');return freeze(clone(b));}
  function gateRequirementPort(request){const f=['gateId','gateRevision','interactionId','interactionRevision'];if(!exact(request,f)||!nonEmpty(request.gateId)||!Number.isInteger(request.gateRevision)||request.gateRevision<1||!nonEmpty(request.interactionId)||!Number.isInteger(request.interactionRevision)||request.interactionRevision<0)throw new Error('invalid gate requirement lookup');let r;try{r=registry.getGateRequirement(freeze(clone(request)));}catch(_){throw new Error('gate requirement registry unavailable');}if(r==null)throw new Error('gate requirement not found');const list=Array.isArray(r)?r:[r];if(list.length!==1)throw new Error('gate requirement identity conflict');const g=list[0];if(!validGate(g)||g.gateId!==request.gateId||g.gateRevision!==request.gateRevision||g.interactionId!==request.interactionId||request.interactionRevision<g.fromInteractionRevision||(g.throughInteractionRevision!==null&&request.interactionRevision>g.throughInteractionRevision))throw new Error('gate requirement invalid or mismatched');return freeze(clone(g));}
  return Object.freeze({rulesetVersion:RULESET_VERSION,authority:AUTHORITY,authorizationBindingPort,gateRequirementPort});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,createMemoryRegistry,createHumanGateConsumptionEvidencePorts});
