"use strict";

const {createExistingSessionAdapter}=require("./human-governance-approval-server-wiring");

const RULESET_VERSION="genesis-trust-real-context-binding-v0.1.0";
const AUTHORITY="NONE";
const AUTHORITY_EFFECT="NONE";
const EXPECTED_PRINCIPAL_REF="gt63-machine:principal:github:239696056";
const SUBJECT=Object.freeze({
 registrationRef:"gt63-machine:trust-registration:genesis-human-source-ingress-v0",
 registrationRevision:"1",
 sourceProviderRef:"gt63-machine:genesis-human-source-ingress-v0",
 sourceProviderRevision:"1",
 channelRef:"gt63-machine:channel:authenticated-genesis-http-ingress-v0",
 channelRevision:"1",
 verificationMethodRef:"gt63-machine:verification-method:authenticated-genesis-session-continuity-v0",
 verificationMethodRevision:"1"
});

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}

function createGenesisTrustRealContextBinding({
 sessionAdapter=createExistingSessionAdapter(),
 identityProvider
}={}){
 if(typeof sessionAdapter!=="function")throw new TypeError("sessionAdapter must be a function");
 if(!identityProvider||typeof identityProvider.getIdentityBySession!=="function")throw new TypeError("identityProvider.getIdentityBySession required");

 function bind(req){
  const session=sessionAdapter(req);
  const principal=identityProvider.getIdentityBySession(session.sessionRef);
  if(!principal||typeof principal!=="object")throw new Error("verified same-session principal required");
  if(principal.principalRef!==EXPECTED_PRINCIPAL_REF||principal.principalRevision!=="1")throw new Error("exact Genesis principal required");
  if(principal.sessionRef!==session.sessionRef||principal.sessionRevision!==session.sessionRevision)throw new Error("principal/session binding mismatch");
  if(principal.authenticatedAccountRef&&principal.authenticatedAccountRef!==session.authenticatedAccountRef)throw new Error("principal/account binding mismatch");
  if(principal.lifecycleState!=="CURRENT"||principal.freshnessState!=="CURRENT"||principal.contradictionState!=="NONE")throw new Error("current non-contradictory principal required");
  if(!nonEmpty(principal.principalEvidenceRef)||principal.authority!=="NONE")throw new Error("principal evidence invalid");

  return freeze({
   type:"GT63_GENESIS_TRUST_REAL_CONTEXT_BINDING",
   rulesetVersion:RULESET_VERSION,
   session:clone(session),
   principal:clone(principal),
   subject:clone(SUBJECT),
   bindingState:"BOUND",
   authority:AUTHORITY,
   authorityEffect:AUTHORITY_EFFECT
  });
 }
 return freeze({bind,rulesetVersion:RULESET_VERSION,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,AUTHORITY_EFFECT,EXPECTED_PRINCIPAL_REF,SUBJECT,createGenesisTrustRealContextBinding});
