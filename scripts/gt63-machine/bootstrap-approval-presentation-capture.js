"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "bootstrap-approval-presentation-capture-v0.1.0";
const MEDIA_TYPE = "application/vnd.gt63.bootstrap-approval+json";
const OUTCOMES = Object.freeze({
  PRESENTED: "BOOTSTRAP_APPROVAL_PRESENTED",
  ALREADY_PRESENTED: "BOOTSTRAP_APPROVAL_ALREADY_PRESENTED",
  CAPTURED: "BOOTSTRAP_APPROVAL_CAPTURED",
  ALREADY_CAPTURED: "BOOTSTRAP_APPROVAL_ALREADY_CAPTURED",
  REJECTED: "BOOTSTRAP_APPROVAL_PRESENTATION_CAPTURE_REJECTED",
  STALE: "BOOTSTRAP_APPROVAL_PRESENTATION_CAPTURE_STALE",
  UNCERTAIN: "BOOTSTRAP_APPROVAL_PRESENTATION_CAPTURE_UNCERTAIN",
  CONFLICT: "BOOTSTRAP_APPROVAL_PRESENTATION_CAPTURE_CONFLICT"
});
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v));
const nonEmpty=v=>typeof v==="string"&&v.length>0;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function compareCodePoints(a,b){const aa=Array.from(String(a)),bb=Array.from(String(b));for(let i=0;i<Math.min(aa.length,bb.length);i++){const d=aa[i].codePointAt(0)-bb[i].codePointAt(0);if(d)return d;}return aa.length-bb.length;}
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(plain(v))return Object.keys(v).sort(compareCodePoints).reduce((o,k)=>{const nk=k.normalize("NFC");if(Object.hasOwn(o,nk))throw new TypeError("canonical key normalization conflict");o[nk]=canonicalize(v[k]);return o;},{});return typeof v==="string"?v.normalize("NFC"):v;}
const canonicalStringify=v=>JSON.stringify(canonicalize(v));
const sha256=b=>`sha256:${crypto.createHash("sha256").update(b).digest("hex")}`;
function deepFreeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(deepFreeze);}return v;}
function result(outcome,reason,evidence=null){return deepFreeze({outcome,reason:reason||null,evidence:clone(evidence),authority:"NONE",humanAuthorizationCreated:false,mutationAuthorized:false,mutationPerformed:false});}
function strictBase64(value){if(!nonEmpty(value)||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))return null;const b=Buffer.from(value,"base64");return b.toString("base64")===value?b:null;}
function validPresentationRequest(r){const f=["rulesetVersion","presentationId","interactionId","payloadBytesBase64","payloadMediaType"];return plain(r)&&Object.keys(r).length===f.length&&f.every(k=>nonEmpty(r[k]))&&r.rulesetVersion===RULESET_VERSION&&r.payloadMediaType===MEDIA_TYPE;}
function validCaptureRequest(r){const f=["rulesetVersion","presentationId","bindingId","sourceEventRef"];return plain(r)&&Object.keys(r).length===f.length&&f.every(k=>nonEmpty(r[k]))&&r.rulesetVersion===RULESET_VERSION;}
function validBinding(b){return plain(b)&&b.type==="AUTHENTICATED_HUMAN_SOURCE_EVENT_BINDING"&&nonEmpty(b.bindingId)&&nonEmpty(b.sourceEventRef)&&nonEmpty(b.principalRef)&&/^sha256:[0-9a-f]{64}$/.test(b.contentDigest)&&Number.isInteger(b.contentByteLength)&&b.contentByteLength>=0&&b.contentMediaType===MEDIA_TYPE&&b.originAuthenticationState==="AUTHENTICATED"&&b.contentIntegrityState==="EXACT_BYTES"&&b.interactionBindingState==="BOUND"&&b.authority==="NONE";}
function validSource(s){return plain(s)&&s.type==="HUMAN_SOURCE_EVENT"&&nonEmpty(s.sourceEventRef)&&nonEmpty(s.interactionId)&&nonEmpty(s.contentBytesBase64)&&s.contentEncoding==="utf8"&&s.contentMediaType===MEDIA_TYPE;}
function createBootstrapApprovalPresentationCapture({authenticatedBindingPort,sourceEventSnapshotPort,presentationLedger,captureLedger}){
  for(const [n,p] of Object.entries({authenticatedBindingPort,sourceEventSnapshotPort}))if(typeof p!=="function")throw new TypeError(`${n} must be a function`);
  for(const [name,ledger,methods] of [["presentationLedger",presentationLedger,["findByPresentationId","commit"]],["captureLedger",captureLedger,["findByPresentationId","findByBindingId","commit"]]])for(const m of methods)if(!ledger||typeof ledger[m]!=="function")throw new TypeError(`${name}.${m} must be a function`);
  function present(request){
    if(!validPresentationRequest(request))return result(OUTCOMES.REJECTED,"unsupported presentation request");
    const bytes=strictBase64(request.payloadBytesBase64);if(!bytes)return result(OUTCOMES.REJECTED,"invalid payload bytes");
    let text;try{text=bytes.toString("utf8");if(!Buffer.from(text,"utf8").equals(bytes))throw new Error();JSON.parse(text);}catch(_){return result(OUTCOMES.REJECTED,"payload is not valid UTF-8 JSON");}
    const material={type:"BOOTSTRAP_APPROVAL_PRESENTATION_EVIDENCE",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,presentationId:request.presentationId,interactionId:request.interactionId,payloadDigest:sha256(bytes),payloadByteLength:bytes.length,payloadMediaType:MEDIA_TYPE,authority:"NONE"};
    const evidence={...material,presentationEvidenceId:sha256(Buffer.from(canonicalStringify(material),"utf8"))};
    let existing;try{existing=presentationLedger.findByPresentationId(request.presentationId);}catch(_){return result(OUTCOMES.UNCERTAIN,"presentation ledger unavailable");}
    if(!Array.isArray(existing))return result(OUTCOMES.UNCERTAIN,"presentation ledger invalid");
    if(existing.length>1)return result(OUTCOMES.CONFLICT,"multiple presentations with same identity");
    if(existing.length===1)return canonicalStringify(existing[0])===canonicalStringify(evidence)?result(OUTCOMES.ALREADY_PRESENTED,null,existing[0]):result(OUTCOMES.CONFLICT,"presentation identity reused with different material");
    let stored;try{stored=presentationLedger.commit(evidence);}catch(_){return result(OUTCOMES.CONFLICT,"presentation ledger commit conflict");}
    if(canonicalStringify(stored)!==canonicalStringify(evidence))return result(OUTCOMES.CONFLICT,"presentation ledger did not preserve exact evidence");
    return result(OUTCOMES.PRESENTED,null,evidence);
  }
  function capture(request){
    if(!validCaptureRequest(request))return result(OUTCOMES.REJECTED,"unsupported capture request");
    let presentations;try{presentations=presentationLedger.findByPresentationId(request.presentationId);}catch(_){return result(OUTCOMES.UNCERTAIN,"presentation evidence unavailable");}
    if(!Array.isArray(presentations)||presentations.length!==1)return result(OUTCOMES.UNCERTAIN,"exact presentation evidence not established");
    const p=presentations[0];
    let b,s;try{b=authenticatedBindingPort({bindingId:request.bindingId});s=sourceEventSnapshotPort({sourceEventRef:request.sourceEventRef});}catch(_){return result(OUTCOMES.UNCERTAIN,"authenticated capture prerequisites unavailable");}
    if(!validBinding(b))return result(OUTCOMES.UNCERTAIN,"authenticated human binding not established");
    if(!validSource(s))return result(OUTCOMES.REJECTED,"captured source event invalid");
    if(b.bindingId!==request.bindingId||b.sourceEventRef!==request.sourceEventRef||s.sourceEventRef!==request.sourceEventRef)return result(OUTCOMES.REJECTED,"capture identity mismatch");
    if(s.interactionId!==p.interactionId)return result(OUTCOMES.STALE,"capture interaction differs from presentation interaction");
    const bytes=strictBase64(s.contentBytesBase64);if(!bytes)return result(OUTCOMES.REJECTED,"captured source bytes invalid");
    if(sha256(bytes)!==b.contentDigest||bytes.length!==b.contentByteLength)return result(OUTCOMES.CONFLICT,"captured bytes conflict with authenticated binding");
    if(b.contentDigest!==p.payloadDigest||b.contentByteLength!==p.payloadByteLength)return result(OUTCOMES.CONFLICT,"authenticated response bytes differ from presented payload");
    let byP,byB;try{byP=captureLedger.findByPresentationId(p.presentationId);byB=captureLedger.findByBindingId(b.bindingId);}catch(_){return result(OUTCOMES.UNCERTAIN,"capture ledger unavailable");}
    if(!Array.isArray(byP)||!Array.isArray(byB))return result(OUTCOMES.UNCERTAIN,"capture ledger invalid");
    if(byP.length>1||byB.length>1)return result(OUTCOMES.CONFLICT,"multiple capture evidence records");
    const material={type:"BOOTSTRAP_APPROVAL_CAPTURE_EVIDENCE",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,presentationId:p.presentationId,presentationEvidenceId:p.presentationEvidenceId,interactionId:p.interactionId,bindingId:b.bindingId,sourceEventRef:b.sourceEventRef,principalRef:b.principalRef,payloadDigest:p.payloadDigest,payloadByteLength:p.payloadByteLength,payloadMediaType:MEDIA_TYPE,authority:"NONE"};
    const evidence={...material,captureEvidenceId:sha256(Buffer.from(canonicalStringify(material),"utf8"))};
    const prior=byP[0]||byB[0]||null;
    if(prior)return canonicalStringify(prior)===canonicalStringify(evidence)?result(OUTCOMES.ALREADY_CAPTURED,null,prior):result(OUTCOMES.CONFLICT,"presentation or binding already captured differently");
    let stored;try{stored=captureLedger.commit(evidence);}catch(_){return result(OUTCOMES.CONFLICT,"capture ledger commit conflict");}
    if(canonicalStringify(stored)!==canonicalStringify(evidence))return result(OUTCOMES.CONFLICT,"capture ledger did not preserve exact evidence");
    return result(OUTCOMES.CAPTURED,null,evidence);
  }
  return Object.freeze({present,capture});
}
module.exports=Object.freeze({RULESET_VERSION,MEDIA_TYPE,OUTCOMES,canonicalStringify,createBootstrapApprovalPresentationCapture});
