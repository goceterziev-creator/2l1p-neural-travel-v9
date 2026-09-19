"use strict";

const {createGenesisTrustRealContextBinding}=require("./genesis-trust-real-context-binding-v0");

const RULESET_VERSION="genesis-trust-real-human-context-binding-proof-v0.1.0";
const AUTHORITY="NONE";
const AUTHORITY_EFFECT="NONE";

function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}

function createGenesisTrustRealHumanContextBindingProof({
  sessionAdapter,
  identityProvider
}={}){
  const binding=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider});

  function prove(req){
    try{
      const result=binding.bind(req);
      return freeze({
        status:"BOUND",
        rulesetVersion:RULESET_VERSION,
        bindingState:result.bindingState,
        sessionRef:result.session.sessionRef,
        sessionRevision:result.session.sessionRevision,
        authenticatedAccountRef:result.session.authenticatedAccountRef,
        principalRef:result.principal.principalRef,
        principalRevision:result.principal.principalRevision,
        principalEvidenceRef:result.principal.principalEvidenceRef,
        registrationRef:result.subject.registrationRef,
        sourceProviderRef:result.subject.sourceProviderRef,
        channelRef:result.subject.channelRef,
        verificationMethodRef:result.subject.verificationMethodRef,
        authority:AUTHORITY,
        authorityEffect:AUTHORITY_EFFECT
      });
    }catch(error){
      return freeze({
        status:"REJECTED",
        rulesetVersion:RULESET_VERSION,
        reason:String(error&&error.message||error),
        authority:AUTHORITY,
        authorityEffect:AUTHORITY_EFFECT
      });
    }
  }

  return freeze({
    prove,
    rulesetVersion:RULESET_VERSION,
    authority:AUTHORITY,
    authorityEffect:AUTHORITY_EFFECT
  });
}

module.exports=Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  AUTHORITY_EFFECT,
  createGenesisTrustRealHumanContextBindingProof
});
