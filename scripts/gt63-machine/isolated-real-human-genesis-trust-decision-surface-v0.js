"use strict";

const express=require("express");
const {
 AUTHORITY,AUTHORITY_EFFECT,
 createGenesisHumanTrustDecisionPresentationCapture,
 createMemoryLedger
}=require("./genesis-human-trust-decision-presentation-capture-v0");

const RULESET_VERSION="isolated-real-human-genesis-trust-decision-surface-v0.1.0";
const ROUTES=Object.freeze([
 Object.freeze({method:"POST",path:"/api/gt63/genesis-trust-decision/present"}),
 Object.freeze({method:"POST",path:"/api/gt63/genesis-trust-decision/decide"})
]);
const DECISIONS=Object.freeze(["APPROVE_TRUST_REGISTRATION","REJECT_TRUST_REGISTRATION"]);

function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function safeError(e){return String(e&&e.message||e);}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function requiredContext(v){
 if(!v||v.bindingState!=="BOUND"||!v.session||!v.principal)throw new Error("exact BOUND real human context required");
 return v;
}
function publicPresentation(p){
 return freeze({
  type:p.type,rulesetVersion:p.rulesetVersion,presentationId:p.presentationId,
  registrationRef:p.registrationRef,registrationRevision:p.registrationRevision,
  sourceProviderRef:p.sourceProviderRef,sourceProviderRevision:p.sourceProviderRevision,
  channelRef:p.channelRef,channelRevision:p.channelRevision,
  verificationMethodRef:p.verificationMethodRef,verificationMethodRevision:p.verificationMethodRevision,
  exactPayloadDigest:p.exactPayloadDigest,exactPayloadByteLength:p.exactPayloadByteLength,
  principalRef:p.principalRef,principalRevision:p.principalRevision,principalEvidenceRef:p.principalEvidenceRef,
  sessionRef:p.sessionRef,sessionRevision:p.sessionRevision,authenticatedAccountRef:p.authenticatedAccountRef,
  authenticationProviderRef:p.authenticationProviderRef,authenticationEvidenceRef:p.authenticationEvidenceRef,
  presentedAt:p.presentedAt,allowedDecisions:clone(DECISIONS),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT
 });
}
function publicDecision(d){
 return freeze({
  type:d.type,decision:d.decision,decisionEvidenceRef:d.decisionEvidenceRef,presentationId:d.presentationId,
  registrationRef:d.registrationRef,registrationRevision:d.registrationRevision,
  sourceProviderRef:d.sourceProviderRef,sourceProviderRevision:d.sourceProviderRevision,
  channelRef:d.channelRef,channelRevision:d.channelRevision,
  verificationMethodRef:d.verificationMethodRef,verificationMethodRevision:d.verificationMethodRevision,
  principalRef:d.principalRef,principalEvidenceRef:d.principalEvidenceRef,
  sessionRef:d.sessionRef,sessionRevision:d.sessionRevision,exactPayloadDigest:d.exactPayloadDigest,
  lifecycleState:d.lifecycleState,freshnessState:d.freshnessState,contradictionState:d.contradictionState,
  decidedAt:d.decidedAt,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT
 });
}

function createIsolatedRealHumanGenesisTrustDecisionSurface({
 contextProvider,presentationLedger=createMemoryLedger(),decisionLedger=createMemoryLedger(),clock
}={}){
 if(typeof contextProvider!=="function")throw new TypeError("contextProvider required");
 const capture=createGenesisHumanTrustDecisionPresentationCapture({presentationLedger,decisionLedger,...(clock?{clock}:{})});
 function present(req){
  const c=requiredContext(contextProvider(req));
  const p=capture.present({session:c.session,principal:c.principal});
  return freeze({outcome:"GENESIS_TRUST_DECISION_PRESENTED",presentation:publicPresentation(p),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
 }
 function decide(req,{presentationId,decision}={}){
  if(!DECISIONS.includes(decision))throw new Error("explicit APPROVE_TRUST_REGISTRATION or REJECT_TRUST_REGISTRATION required");
  const c=requiredContext(contextProvider(req));
  const d=capture.decide({session:c.session,principal:c.principal,presentationId,decision});
  return freeze({
   outcome:decision==="APPROVE_TRUST_REGISTRATION"?"GENESIS_TRUST_DECISION_APPROVED_CAPTURED":"GENESIS_TRUST_DECISION_REJECTED_CAPTURED",
   decision:publicDecision(d),
   downstreamTrustRegistration:"NOT_PERFORMED",
   authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT
  });
 }
 return freeze({present,decide,rulesetVersion:RULESET_VERSION,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
}

function createIsolatedDecisionApp({surface,authenticate}={}){
 if(!surface||typeof surface.present!=="function"||typeof surface.decide!=="function")throw new TypeError("surface required");
 if(typeof authenticate!=="function")throw new TypeError("authenticate required");
 const app=express();app.disable("x-powered-by");app.use(express.json({limit:"8kb"}));
 function auth(req,res,next){try{authenticate(req);next();}catch(_){res.status(401).json({error:"Authentication required",authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}}
 app.post(ROUTES[0].path,auth,(req,res)=>{try{return res.json(surface.present(req));}catch(e){return res.status(409).json({outcome:"GENESIS_TRUST_DECISION_PRESENTATION_REJECTED",reason:safeError(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}});
 app.post(ROUTES[1].path,auth,(req,res)=>{try{return res.json(surface.decide(req,{presentationId:String(req.body&&req.body.presentationId||""),decision:String(req.body&&req.body.decision||"")}));}catch(e){return res.status(409).json({outcome:"GENESIS_TRUST_DECISION_CAPTURE_REJECTED",reason:safeError(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}});
 return app;
}

module.exports=freeze({RULESET_VERSION,AUTHORITY,AUTHORITY_EFFECT,ROUTES,DECISIONS,createIsolatedRealHumanGenesisTrustDecisionSurface,createIsolatedDecisionApp});
