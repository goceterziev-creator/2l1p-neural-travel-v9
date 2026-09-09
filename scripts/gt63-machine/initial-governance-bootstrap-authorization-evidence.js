"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "initial-governance-bootstrap-authorization-evidence-v0.1.0";
const GOVERNANCE_ACT = "INITIAL_GOVERNANCE_BOOTSTRAP";
const OUTCOMES = Object.freeze({
  ACCEPTED: "INITIAL_GOVERNANCE_BOOTSTRAP_AUTHORIZATION_EVIDENCE_ACCEPTED",
  ALREADY_ACCEPTED: "INITIAL_GOVERNANCE_BOOTSTRAP_AUTHORIZATION_EVIDENCE_ALREADY_ACCEPTED",
  REJECTED: "INITIAL_GOVERNANCE_BOOTSTRAP_AUTHORIZATION_EVIDENCE_REJECTED",
  STALE: "INITIAL_GOVERNANCE_BOOTSTRAP_AUTHORIZATION_EVIDENCE_STALE",
  UNCERTAIN: "INITIAL_GOVERNANCE_BOOTSTRAP_AUTHORIZATION_EVIDENCE_UNCERTAIN",
  CONFLICT: "INITIAL_GOVERNANCE_BOOTSTRAP_AUTHORIZATION_EVIDENCE_CONFLICT"
});
const REQUEST_FIELDS = new Set([
  "rulesetVersion","bindingId","bootstrapGateId","bootstrapGateRevision",
  "repositoryIdentity","targetPath","expectedBeforeStateId","expectedAfterStateId"
]);
const nonEmpty=v=>typeof v==="string"&&v.length>0;
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v));
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonicalize(v[k]),o),{});return v;}
const canonicalStringify=v=>JSON.stringify(canonicalize(v));
const digest=v=>`sha256:${crypto.createHash("sha256").update(canonicalStringify(v)).digest("hex")}`;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function result(outcome,reason,evidence=null){return Object.freeze({outcome,reason:reason||null,evidence:clone(evidence),authority:"NONE",mutationAuthorized:false,mutationPerformed:false});}
function exact(v,fields){return plain(v)&&Object.keys(v).every(k=>fields.has(k));}
function validRequest(r){return exact(r,REQUEST_FIELDS)&&[...REQUEST_FIELDS].every(k=>nonEmpty(r[k]));}
function validBinding(b){
  return plain(b)&&b.type==="AUTHENTICATED_HUMAN_SOURCE_EVENT_BINDING"
    && nonEmpty(b.bindingId)&&nonEmpty(b.sourceEventRef)&&nonEmpty(b.principalRef)
    && b.originAuthenticationState==="AUTHENTICATED"&&b.contentIntegrityState==="EXACT_BYTES"
    && b.interactionBindingState==="BOUND"&&b.authority==="NONE";
}
function validGate(g){
  return plain(g)&&g.type==="INITIAL_GOVERNANCE_BOOTSTRAP_GATE"
    && nonEmpty(g.gateId)&&nonEmpty(g.gateRevision)&&g.governanceAct===GOVERNANCE_ACT
    && nonEmpty(g.repositoryIdentity)&&nonEmpty(g.targetPath)
    && nonEmpty(g.beforeStateId)&&nonEmpty(g.afterStateId)
    && g.oneTime===true&&g.status==="PENDING"&&nonEmpty(g.gateEvidenceRef)&&g.authority==="NONE";
}
function validApproval(a){
  return plain(a)&&a.type==="EXPLICIT_HUMAN_GATE_APPROVAL"
    && nonEmpty(a.bindingId)&&nonEmpty(a.gateId)&&nonEmpty(a.gateRevision)
    && a.governanceAct===GOVERNANCE_ACT&&nonEmpty(a.repositoryIdentity)&&nonEmpty(a.targetPath)
    && nonEmpty(a.beforeStateId)&&nonEmpty(a.afterStateId)
    && a.approvalState==="APPROVED"&&a.oneTime===true&&nonEmpty(a.approvalEvidenceRef)&&a.authority==="NONE";
}
function createInitialGovernanceBootstrapAuthorizationEvidence({
  authenticatedBindingPort, bootstrapGatePort, explicitApprovalPort, bootstrapAuthorizationLedger
}){
  for(const [n,p] of Object.entries({authenticatedBindingPort,bootstrapGatePort,explicitApprovalPort}))
    if(typeof p!=="function")throw new TypeError(`${n} must be a function`);
  for(const n of ["findByGateId","findByBindingId","commit"])
    if(!bootstrapAuthorizationLedger||typeof bootstrapAuthorizationLedger[n]!=="function")throw new TypeError(`bootstrapAuthorizationLedger.${n} must be a function`);
  function accept(request){
    if(!validRequest(request)||request.rulesetVersion!==RULESET_VERSION)return result(OUTCOMES.REJECTED,"unsupported request schema or ruleset");
    let binding,gate,approval;
    try{
      binding=authenticatedBindingPort({bindingId:request.bindingId});
      gate=bootstrapGatePort({gateId:request.bootstrapGateId});
      approval=explicitApprovalPort({bindingId:request.bindingId,gateId:request.bootstrapGateId});
    }catch(_){return result(OUTCOMES.UNCERTAIN,"bootstrap prerequisite unavailable");}
    if(!validBinding(binding))return result(OUTCOMES.UNCERTAIN,"authenticated human binding not established");
    if(binding.bindingId!==request.bindingId)return result(OUTCOMES.REJECTED,"binding identity mismatch");
    if(!validGate(gate))return result(OUTCOMES.UNCERTAIN,"bootstrap gate not established");
    if(!validApproval(approval))return result(OUTCOMES.UNCERTAIN,"explicit bootstrap approval not established");
    const expected={gateId:request.bootstrapGateId,gateRevision:request.bootstrapGateRevision,repositoryIdentity:request.repositoryIdentity,targetPath:request.targetPath,beforeStateId:request.expectedBeforeStateId,afterStateId:request.expectedAfterStateId};
    for(const [k,v] of Object.entries(expected)){
      const gk=k==="gateId"?"gateId":k==="gateRevision"?"gateRevision":k==="beforeStateId"?"beforeStateId":k==="afterStateId"?"afterStateId":k;
      if(gate[gk]!==v)return result(OUTCOMES.STALE,`gate ${k} mismatch`);
      if(approval[gk]!==v)return result(OUTCOMES.STALE,`approval ${k} mismatch`);
    }
    if(approval.bindingId!==binding.bindingId)return result(OUTCOMES.REJECTED,"approval is not bound to authenticated event");
    let byGate,byBinding;
    try{byGate=bootstrapAuthorizationLedger.findByGateId(gate.gateId);byBinding=bootstrapAuthorizationLedger.findByBindingId(binding.bindingId);}
    catch(_){return result(OUTCOMES.UNCERTAIN,"bootstrap authorization ledger unavailable");}
    if(!Array.isArray(byGate)||!Array.isArray(byBinding))return result(OUTCOMES.UNCERTAIN,"bootstrap authorization ledger invalid");
    if(byGate.length>1||byBinding.length>1)return result(OUTCOMES.CONFLICT,"multiple bootstrap authorization records");
    const material={
      type:"INITIAL_GOVERNANCE_BOOTSTRAP_AUTHORIZATION_EVIDENCE",schemaVersion:"1.0",
      governanceAct:GOVERNANCE_ACT,bindingId:binding.bindingId,sourceEventRef:binding.sourceEventRef,
      principalRef:binding.principalRef,bootstrapGateId:gate.gateId,bootstrapGateRevision:gate.gateRevision,
      repositoryIdentity:gate.repositoryIdentity,targetPath:gate.targetPath,
      beforeStateId:gate.beforeStateId,afterStateId:gate.afterStateId,
      gateEvidenceRef:gate.gateEvidenceRef,approvalEvidenceRef:approval.approvalEvidenceRef,
      oneTime:true,consumed:false,authority:"NONE"
    };
    const evidence={...material,bootstrapAuthorizationId:digest(material)};
    const prior=byGate[0]||byBinding[0]||null;
    if(prior){
      if(canonicalStringify(prior)===canonicalStringify(evidence))return result(OUTCOMES.ALREADY_ACCEPTED,"same exact bootstrap authorization already accepted",prior);
      return result(OUTCOMES.CONFLICT,"bootstrap gate or binding already used by different authorization");
    }
    let stored;
    try{stored=bootstrapAuthorizationLedger.commit(evidence);}catch(_){return result(OUTCOMES.CONFLICT,"bootstrap authorization ledger commit conflict");}
    if(canonicalStringify(stored)!==canonicalStringify(evidence))return result(OUTCOMES.CONFLICT,"bootstrap authorization ledger did not preserve exact evidence");
    return result(OUTCOMES.ACCEPTED,null,evidence);
  }
  return Object.freeze({accept});
}
module.exports={RULESET_VERSION,GOVERNANCE_ACT,OUTCOMES,canonicalStringify,createInitialGovernanceBootstrapAuthorizationEvidence};
