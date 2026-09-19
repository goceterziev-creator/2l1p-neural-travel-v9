"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "genesis-human-source-capture-v0.1.0";
const SCHEMA_VERSION = "1.0";
const AUTHORITY = "NONE";
const AUTHORITY_EFFECT = "NONE";
const OUTCOMES = Object.freeze({
  CAPTURED: "GENESIS_SOURCE_CAPTURED",
  ALREADY_CAPTURED: "GENESIS_SOURCE_ALREADY_CAPTURED",
  REJECTED: "GENESIS_SOURCE_REJECTED",
  STALE: "GENESIS_SOURCE_STALE",
  UNCERTAIN: "GENESIS_SOURCE_UNCERTAIN",
  IDENTITY_CONFLICT: "GENESIS_SOURCE_IDENTITY_CONFLICT"
});
const REQUEST_FIELDS = new Set([
  "rulesetVersion", "sourceProviderRef", "expectedSourceProviderRevision",
  "providerEventId", "contentBytesBase64", "contentEncoding", "contentMediaType",
  "channelRef", "expectedChannelRevision"
]);

function plain(v){ return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v){ return typeof v === "string" && v.length > 0; }
function exact(v, fields){ return plain(v) && Object.keys(v).every(k => fields.has(k)) && Object.keys(v).length === fields.size; }
function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
function deepFreeze(v){ if(v && typeof v === "object" && !Object.isFrozen(v)){ Object.freeze(v); for(const x of Object.values(v)) deepFreeze(x); } return v; }
function canonicalize(v){
  if(Array.isArray(v)) return v.map(canonicalize);
  if(plain(v)) return Object.keys(v).sort().reduce((o,k)=>{o[k.normalize("NFC")]=canonicalize(v[k]); return o;},{});
  return typeof v === "string" ? v.normalize("NFC") : v;
}
function canonicalStringify(v){ return JSON.stringify(canonicalize(v)); }
function sha256(bytes){ return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function strictBase64(v){
  if(!nonEmpty(v) || v.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return null;
  const b=Buffer.from(v,"base64"); return b.toString("base64")===v ? b : null;
}
function result(outcome, reason=null, evidence=null){
  return deepFreeze({outcome, reason, evidence:clone(evidence), authority:AUTHORITY, authorityEffect:AUTHORITY_EFFECT});
}
function call(port,arg){ try { return {ok:true,value:port(arg)}; } catch(_){ return {ok:false,value:null}; } }
function validRequest(r){
  return exact(r,REQUEST_FIELDS) && [...REQUEST_FIELDS].every(k=>nonEmpty(r[k]));
}
function validSession(s){
  return plain(s) && ["sessionRef","sessionRevision","authenticatedAccountRef","authenticationProviderRef","authenticationEvidenceRef"].every(k=>nonEmpty(s[k]))
    && nonEmpty(s.authenticationState) && nonEmpty(s.freshnessState);
}
function validPrincipal(p){
  return plain(p) && ["principalRef","principalRevision","sessionRef","sessionRevision","principalEvidenceRef","resolutionState","lifecycleState","freshnessState","contradictionState"].every(k=>nonEmpty(p[k]));
}
function validRegistry(r){
  return plain(r) && ["sourceProviderRef","sourceProviderRevision","channelRef","channelRevision","trustState","registryEvidenceRef"].every(k=>nonEmpty(r[k]));
}
function validTemporal(t){
  return plain(t) && nonEmpty(t.occurredTemporalFrameRef) && nonEmpty(t.receivedTemporalFrameRef)
    && nonEmpty(t.freshnessState) && nonEmpty(t.contradictionState);
}

function createGenesisHumanSourceCapture({
  authenticatedSessionPort, authenticatedPrincipalPort, sourceRegistryPort,
  temporalEvidencePort, genesisSourceLedger
} = {}) {
  for(const [name,port] of Object.entries({authenticatedSessionPort,authenticatedPrincipalPort,sourceRegistryPort,temporalEvidencePort})){
    if(typeof port !== "function") throw new TypeError(`${name} must be a function`);
  }
  for(const name of ["findByProviderEvent","commit"]){
    if(!genesisSourceLedger || typeof genesisSourceLedger[name] !== "function") throw new TypeError(`genesisSourceLedger.${name} must be a function`);
  }

  function capture(request){
    if(!validRequest(request)) return result(OUTCOMES.REJECTED,"unsupported request schema");
    if(request.rulesetVersion !== RULESET_VERSION) return result(OUTCOMES.REJECTED,"unsupported ruleset");
    const bytes=strictBase64(request.contentBytesBase64);
    if(!bytes) return result(OUTCOMES.REJECTED,"invalid exact content bytes");
    const contentDigest=sha256(bytes);

    let historical;
    try { historical=genesisSourceLedger.findByProviderEvent(request.sourceProviderRef,request.providerEventId); }
    catch(_){ return result(OUTCOMES.UNCERTAIN,"genesis source ledger unavailable"); }
    if(!Array.isArray(historical)) return result(OUTCOMES.UNCERTAIN,"genesis source ledger evidence invalid");
    if(historical.length>1) return result(OUTCOMES.IDENTITY_CONFLICT,"multiple records for provider event");
    if(historical.length===1){
      const prior=historical[0];
      const same=prior.sourceProviderRevision===request.expectedSourceProviderRevision
        && prior.channelRef===request.channelRef && prior.channelRevision===request.expectedChannelRevision
        && prior.contentBytesBase64===request.contentBytesBase64 && prior.contentDigest===contentDigest
        && prior.contentEncoding===request.contentEncoding && prior.contentMediaType===request.contentMediaType;
      return same ? result(OUTCOMES.ALREADY_CAPTURED,"same genesis source already captured",prior)
        : result(OUTCOMES.IDENTITY_CONFLICT,"provider event identity reused with changed material");
    }

    const reg=call(sourceRegistryPort,{sourceProviderRef:request.sourceProviderRef,channelRef:request.channelRef});
    if(!reg.ok || !validRegistry(reg.value)) return result(OUTCOMES.UNCERTAIN,"source registry unavailable or invalid");
    const registry=reg.value;
    if(registry.sourceProviderRef!==request.sourceProviderRef || registry.channelRef!==request.channelRef) return result(OUTCOMES.IDENTITY_CONFLICT,"source registry subject mismatch");
    if(registry.sourceProviderRevision!==request.expectedSourceProviderRevision || registry.channelRevision!==request.expectedChannelRevision || registry.trustState!=="TRUSTED")
      return result(OUTCOMES.STALE,"source or channel evidence not current/trusted");

    const sr=call(authenticatedSessionPort,{sourceProviderRef:request.sourceProviderRef,providerEventId:request.providerEventId,channelRef:request.channelRef});
    if(!sr.ok || !validSession(sr.value)) return result(OUTCOMES.UNCERTAIN,"authenticated session unavailable or invalid");
    const session=sr.value;
    if(session.authenticationState!=="AUTHENTICATED") return result(OUTCOMES.REJECTED,"session not authenticated");
    if(session.freshnessState!=="CURRENT") return result(OUTCOMES.STALE,"session not current");

    const pr=call(authenticatedPrincipalPort,{sessionRef:session.sessionRef,sessionRevision:session.sessionRevision,authenticatedAccountRef:session.authenticatedAccountRef});
    if(!pr.ok || !validPrincipal(pr.value)) return result(OUTCOMES.UNCERTAIN,"authenticated principal unavailable or invalid");
    const principal=pr.value;
    if(principal.sessionRef!==session.sessionRef || principal.sessionRevision!==session.sessionRevision) return result(OUTCOMES.IDENTITY_CONFLICT,"principal/session mismatch");
    if(principal.resolutionState!=="RESOLVED") return result(OUTCOMES.UNCERTAIN,"principal unresolved");
    if(principal.contradictionState!=="NONE") return result(OUTCOMES.IDENTITY_CONFLICT,"principal evidence contradictory");
    if(principal.lifecycleState!=="CURRENT" || principal.freshnessState!=="CURRENT") return result(OUTCOMES.STALE,"principal not current");

    const tr=call(temporalEvidencePort,{sourceProviderRef:request.sourceProviderRef,providerEventId:request.providerEventId,channelRef:request.channelRef});
    if(!tr.ok || !validTemporal(tr.value)) return result(OUTCOMES.UNCERTAIN,"temporal evidence unavailable or invalid");
    const temporal=tr.value;
    if(temporal.contradictionState!=="NONE") return result(OUTCOMES.IDENTITY_CONFLICT,"temporal evidence contradictory");
    if(temporal.freshnessState!=="CURRENT") return result(OUTCOMES.STALE,"temporal evidence not current");

    const sourceMaterial={
      sourceProviderRef:request.sourceProviderRef, sourceProviderRevision:registry.sourceProviderRevision,
      providerEventId:request.providerEventId, channelRef:registry.channelRef, channelRevision:registry.channelRevision
    };
    const sourceEventRef=`gt63-genesis-source-event:${sha256(Buffer.from(canonicalStringify(sourceMaterial),"utf8")).slice(7)}`;
    const material={
      type:"GT63_GENESIS_HUMAN_SOURCE_EVIDENCE", schemaVersion:SCHEMA_VERSION, rulesetVersion:RULESET_VERSION,
      sourceEventRef, sourceEventRevision:"1",
      sourceProviderRef:request.sourceProviderRef, sourceProviderRevision:registry.sourceProviderRevision, providerEventId:request.providerEventId,
      contentBytesBase64:request.contentBytesBase64, contentDigest, contentEncoding:request.contentEncoding, contentMediaType:request.contentMediaType,
      channelRef:registry.channelRef, channelRevision:registry.channelRevision,
      sessionRef:session.sessionRef, sessionRevision:session.sessionRevision, authenticatedAccountRef:session.authenticatedAccountRef,
      principalRef:principal.principalRef, principalRevision:principal.principalRevision, principalEvidenceRef:principal.principalEvidenceRef,
      occurredTemporalFrameRef:temporal.occurredTemporalFrameRef, receivedTemporalFrameRef:temporal.receivedTemporalFrameRef,
      originAuthenticationState:"AUTHENTICATED", contentIntegrityState:"EXACT_BYTES",
      principalLifecycleState:principal.lifecycleState, principalFreshnessState:principal.freshnessState, contradictionState:"NONE",
      authority:AUTHORITY, authorityEffect:AUTHORITY_EFFECT
    };
    const genesisSourceEvidenceRef=`gt63-genesis-human-source:${sha256(Buffer.from(canonicalStringify(material),"utf8")).slice(7)}`;
    const evidence=deepFreeze({...material,genesisSourceEvidenceRef});
    let committed;
    try { committed=genesisSourceLedger.commit(evidence); }
    catch(_){ return result(OUTCOMES.IDENTITY_CONFLICT,"genesis source ledger commit conflict"); }
    if(!committed || committed.genesisSourceEvidenceRef!==genesisSourceEvidenceRef) return result(OUTCOMES.IDENTITY_CONFLICT,"genesis source ledger returned conflicting identity");
    return result(OUTCOMES.CAPTURED,null,committed);
  }
  return Object.freeze({capture,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT,rulesetVersion:RULESET_VERSION});
}

module.exports=Object.freeze({RULESET_VERSION,SCHEMA_VERSION,AUTHORITY,AUTHORITY_EFFECT,OUTCOMES,createGenesisHumanSourceCapture});
