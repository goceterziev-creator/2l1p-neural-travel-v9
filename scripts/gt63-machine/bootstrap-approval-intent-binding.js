"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "bootstrap-approval-intent-binding-v0.1.0";
const GOVERNANCE_ACT = "INITIAL_GOVERNANCE_BOOTSTRAP";
const MEDIA_TYPE = "application/vnd.gt63.bootstrap-approval+json";

const OUTCOMES = Object.freeze({
  BOUND: "BOOTSTRAP_APPROVAL_INTENT_BOUND",
  ALREADY_BOUND: "BOOTSTRAP_APPROVAL_INTENT_ALREADY_BOUND",
  REJECTED: "BOOTSTRAP_APPROVAL_INTENT_REJECTED",
  STALE: "BOOTSTRAP_APPROVAL_INTENT_STALE",
  UNCERTAIN: "BOOTSTRAP_APPROVAL_INTENT_UNCERTAIN",
  CONFLICT: "BOOTSTRAP_APPROVAL_INTENT_CONFLICT"
});

const REQUEST_FIELDS = Object.freeze([
  "rulesetVersion","bindingId","sourceEventRef","bootstrapGateId","bootstrapGateRevision",
  "repositoryIdentity","targetPath","expectedBeforeStateId","expectedAfterStateId"
]);
const PAYLOAD_FIELDS = Object.freeze([
  "type","decision","governanceAct","bootstrapGateId","bootstrapGateRevision",
  "repositoryIdentity","targetPath","beforeStateId","afterStateId","oneTime"
]);

function plain(v){ return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v){ return typeof v === "string" && v.length > 0; }
function exact(v, fields){ return plain(v) && Object.keys(v).length===fields.length && Object.keys(v).every(k=>fields.includes(k)); }
function compareCodePoints(a,b){ const aa=Array.from(String(a)),bb=Array.from(String(b)); for(let i=0;i<Math.min(aa.length,bb.length);i++){const d=aa[i].codePointAt(0)-bb[i].codePointAt(0);if(d)return d;} return aa.length-bb.length; }
function canonicalize(v){ if(Array.isArray(v))return v.map(canonicalize); if(plain(v)){return Object.keys(v).sort(compareCodePoints).reduce((o,k)=>{const nk=k.normalize("NFC"); if(Object.prototype.hasOwnProperty.call(o,nk))throw new TypeError("canonical key normalization conflict"); o[nk]=canonicalize(v[k]); return o;},{});} return typeof v==="string"?v.normalize("NFC"):v; }
const canonicalStringify = v => JSON.stringify(canonicalize(v));
const sha256 = bytes => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const clone = v => v==null?v:JSON.parse(JSON.stringify(v));
function deepFreeze(v){ if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(deepFreeze);} return v; }
function result(outcome,reason,evidence=null){ return deepFreeze({outcome,reason:reason||null,evidence:clone(evidence),authority:"NONE",humanAuthorizationCreated:false,mutationAuthorized:false,mutationPerformed:false}); }
function strictBase64(value){ if(!nonEmpty(value)||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))return null; const b=Buffer.from(value,"base64"); return b.toString("base64")===value?b:null; }

function validRequest(r){
  return exact(r,REQUEST_FIELDS) && r.rulesetVersion===RULESET_VERSION
    && REQUEST_FIELDS.filter(k=>k!=="rulesetVersion").every(k=>nonEmpty(r[k]));
}
function validBinding(b){
  return plain(b) && b.type==="AUTHENTICATED_HUMAN_SOURCE_EVENT_BINDING"
    && nonEmpty(b.bindingId) && nonEmpty(b.sourceEventRef) && nonEmpty(b.principalRef)
    && nonEmpty(b.contentDigest) && /^sha256:[0-9a-f]{64}$/.test(b.contentDigest)
    && Number.isInteger(b.contentByteLength) && b.contentByteLength>=0
    && b.contentMediaType===MEDIA_TYPE
    && b.originAuthenticationState==="AUTHENTICATED"
    && b.contentIntegrityState==="EXACT_BYTES"
    && b.interactionBindingState==="BOUND"
    && b.authority==="NONE";
}
function validSource(s){
  return plain(s) && s.type==="HUMAN_SOURCE_EVENT"
    && nonEmpty(s.sourceEventRef) && nonEmpty(s.contentBytesBase64)
    && s.contentEncoding==="utf8" && s.contentMediaType===MEDIA_TYPE;
}
function parsePayload(bytes){
  const text=bytes.toString("utf8");
  if(!Buffer.from(text,"utf8").equals(bytes)) return {ok:false,reason:"approval payload is not valid UTF-8"};
  let p; try{p=JSON.parse(text);}catch(_){return {ok:false,reason:"approval payload is malformed JSON"};}
  if(!exact(p,PAYLOAD_FIELDS)) return {ok:false,reason:"approval payload schema unsupported"};
  let canonical; try{canonical=`${canonicalStringify(p)}\n`;}catch(_){return {ok:false,reason:"approval payload canonicalization conflict"};}
  if(!Buffer.from(canonical,"utf8").equals(bytes)) return {ok:false,reason:"approval payload is not exact canonical JSON"};
  if(p.type!=="GT63_BOOTSTRAP_APPROVAL" || p.decision!=="APPROVE"
    || p.governanceAct!==GOVERNANCE_ACT || p.oneTime!==true
    || !["bootstrapGateId","bootstrapGateRevision","repositoryIdentity","targetPath","beforeStateId","afterStateId"].every(k=>nonEmpty(p[k]))){
      return {ok:false,reason:"approval payload is outside frozen V0 contract"};
  }
  return {ok:true,payload:p};
}

function createBootstrapApprovalIntentBinding({authenticatedBindingPort,sourceEventSnapshotPort,intentLedger}){
  for(const [n,p] of Object.entries({authenticatedBindingPort,sourceEventSnapshotPort})) if(typeof p!=="function") throw new TypeError(`${n} must be a function`);
  for(const n of ["findByBindingId","findByGateId","commit"]) if(!intentLedger||typeof intentLedger[n]!=="function") throw new TypeError(`intentLedger.${n} must be a function`);

  function bind(request){
    if(!validRequest(request)) return result(OUTCOMES.REJECTED,"unsupported request schema or ruleset");
    let b,s;
    try{
      b=authenticatedBindingPort({bindingId:request.bindingId});
      s=sourceEventSnapshotPort({sourceEventRef:request.sourceEventRef});
    }catch(_){ return result(OUTCOMES.UNCERTAIN,"authenticated binding or source event unavailable"); }
    if(!validBinding(b)) return result(OUTCOMES.UNCERTAIN,"authenticated human binding not established for structured bootstrap approval");
    if(!validSource(s)) return result(OUTCOMES.REJECTED,"source event is not structured bootstrap approval payload");
    if(b.bindingId!==request.bindingId || b.sourceEventRef!==request.sourceEventRef || s.sourceEventRef!==request.sourceEventRef)
      return result(OUTCOMES.REJECTED,"binding/source identity mismatch");

    const bytes=strictBase64(s.contentBytesBase64);
    if(!bytes) return result(OUTCOMES.REJECTED,"source event exact bytes invalid");
    if(bytes.length!==b.contentByteLength || sha256(bytes)!==b.contentDigest)
      return result(OUTCOMES.CONFLICT,"source bytes conflict with authenticated binding");

    const parsed=parsePayload(bytes);
    if(!parsed.ok) return result(OUTCOMES.REJECTED,parsed.reason);
    const p=parsed.payload;
    const expected={
      bootstrapGateId:request.bootstrapGateId,
      bootstrapGateRevision:request.bootstrapGateRevision,
      repositoryIdentity:request.repositoryIdentity,
      targetPath:request.targetPath,
      beforeStateId:request.expectedBeforeStateId,
      afterStateId:request.expectedAfterStateId
    };
    for(const [k,v] of Object.entries(expected)){
      const pk=k==="expectedBeforeStateId"?"beforeStateId":k==="expectedAfterStateId"?"afterStateId":k;
      if(p[pk]!==v) return result(OUTCOMES.STALE,`approval payload ${pk} mismatch`);
    }

    let byBinding,byGate;
    try{byBinding=intentLedger.findByBindingId(b.bindingId);byGate=intentLedger.findByGateId(p.bootstrapGateId);}
    catch(_){return result(OUTCOMES.UNCERTAIN,"intent ledger unavailable");}
    if(!Array.isArray(byBinding)||!Array.isArray(byGate))return result(OUTCOMES.UNCERTAIN,"intent ledger invalid");
    if(byBinding.length>1||byGate.length>1)return result(OUTCOMES.CONFLICT,"multiple approval intent bindings");

    const material={
      type:"BOOTSTRAP_APPROVAL_INTENT_BINDING",
      schemaVersion:"1.0",
      rulesetVersion:RULESET_VERSION,
      governanceAct:GOVERNANCE_ACT,
      decision:"APPROVE",
      bindingId:b.bindingId,
      sourceEventRef:b.sourceEventRef,
      principalRef:b.principalRef,
      contentDigest:b.contentDigest,
      bootstrapGateId:p.bootstrapGateId,
      bootstrapGateRevision:p.bootstrapGateRevision,
      repositoryIdentity:p.repositoryIdentity,
      targetPath:p.targetPath,
      beforeStateId:p.beforeStateId,
      afterStateId:p.afterStateId,
      oneTime:true,
      authority:"NONE"
    };
    const evidence={...material,approvalIntentBindingId:digestMaterial(material)};
    const prior=byBinding[0]||byGate[0]||null;
    if(prior){
      if(canonicalStringify(prior)===canonicalStringify(evidence))return result(OUTCOMES.ALREADY_BOUND,"same exact approval intent already bound",prior);
      return result(OUTCOMES.CONFLICT,"binding or gate already bound to different approval intent");
    }
    let stored;
    try{stored=intentLedger.commit(evidence);}catch(_){return result(OUTCOMES.CONFLICT,"intent ledger commit conflict");}
    if(canonicalStringify(stored)!==canonicalStringify(evidence))return result(OUTCOMES.CONFLICT,"intent ledger did not preserve exact evidence");
    return result(OUTCOMES.BOUND,null,evidence);
  }
  return Object.freeze({bind});
}
function digestMaterial(v){ return sha256(Buffer.from(canonicalStringify(v),"utf8")); }

module.exports=Object.freeze({RULESET_VERSION,GOVERNANCE_ACT,MEDIA_TYPE,OUTCOMES,canonicalStringify,digestMaterial,createBootstrapApprovalIntentBinding});
