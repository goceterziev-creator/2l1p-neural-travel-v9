"use strict";

const {createGenesisHumanTrustDecisionPresentationCapture}=require("./genesis-human-trust-decision-presentation-capture-v0");
const {createGenesisTrustDecisionProvenanceAcceptance}=require("./genesis-trust-decision-provenance-acceptance-v0");
const {createGenesisSourceChannelTrustRegistration}=require("./genesis-source-channel-trust-registration-v0");

const RULESET_VERSION="genesis-trust-establishment-composition-runner-v0.1.0";
const AUTHORITY="NONE";
const AUTHORITY_EFFECT="NONE";

function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function requiredFn(v,n){if(typeof v!=="function")throw new TypeError(n+" must be a function");return v;}
function requiredLedger(v,n,methods){if(!v)throw new TypeError(n+" required");for(const m of methods)requiredFn(v[m],n+"."+m);return v;}

function createGenesisTrustEstablishmentCompositionRunner({
 presentationLedger,decisionLedger,provenanceLedger,registrationLedger,
 principalIdentityPort,clock=()=>new Date().toISOString()
}={}){
 requiredLedger(presentationLedger,"presentationLedger",["get","commit"]);
 requiredLedger(decisionLedger,"decisionLedger",["get","commit"]);
 requiredLedger(provenanceLedger,"provenanceLedger",["findByEvidenceRef","commit"]);
 requiredLedger(registrationLedger,"registrationLedger",["findByRegistrationRef","commit"]);
 requiredFn(principalIdentityPort,"principalIdentityPort");

 async function establish({session,principal}={}){
  const asyncDecisionLedger={
   get:id=>decisionLedger.get(id),
   commit:async(id,record)=>decisionLedger.commit(id,record)
  };
  const surface=createGenesisHumanTrustDecisionPresentationCapture({clock,presentationLedger,decisionLedger:asyncDecisionLedger});
  const presentation=surface.present({session,principal});
  // The existing decision component is synchronous. Capture its exact decision material
  // into a bounded temporary sink, then persist it through the proven async ledger.
  let capturedDecision=null;
  const captureSurface=createGenesisHumanTrustDecisionPresentationCapture({
   clock,presentationLedger,
   decisionLedger:{get:()=>null,commit:(_id,record)=>{capturedDecision=clone(record);return clone(record);}}
  });
  const decision=captureSurface.decide({session,principal,presentationId:presentation.presentationId,decision:"APPROVE_TRUST_REGISTRATION"});
  if(!capturedDecision||capturedDecision.decisionEvidenceRef!==decision.decisionEvidenceRef)throw new Error("decision capture mismatch");
  await decisionLedger.commit(decision.decisionEvidenceRef,capturedDecision);

  let capturedProvenance=null;
  const provenance=createGenesisTrustDecisionProvenanceAcceptance({
   decisionPort:({decisionEvidenceRef})=>decisionEvidenceRef===decision.decisionEvidenceRef?clone(decision):null,
   principalIdentityPort,
   provenanceLedger:{
    findByEvidenceRef:()=>[],
    commit:record=>{capturedProvenance=clone(record);return clone(record);}
   }
  }).accept({
   decisionEvidenceRef:decision.decisionEvidenceRef,
   registrationRef:"gt63-machine:trust-registration:genesis-human-source-ingress-v0",
   registrationRevision:"1",
   rulesetVersion:"genesis-trust-decision-provenance-acceptance-v0.1.0"
  });
  if(provenance.outcome!=="GENESIS_TRUST_DECISION_PROVENANCE_ACCEPTED"||!capturedProvenance)throw new Error("provenance acceptance failed");
  await provenanceLedger.commit(capturedProvenance);

  const registration=createGenesisSourceChannelTrustRegistration({
   trustDecisionPort:()=>clone(decision),
   provenancePort:({evidenceRef})=>evidenceRef===capturedProvenance.evidenceRef?clone(capturedProvenance):null,
   ledger:{
    findByRegistrationRef:()=>[],
    commit:record=>clone(record)
   }
  });
  const authorization=registration.authorize({
   registrationRef:"gt63-machine:trust-registration:genesis-human-source-ingress-v0",
   registrationRevision:"1",
   rulesetVersion:"genesis-source-channel-trust-registration-v0.1.0"
  });
  if(authorization.outcome!=="GENESIS_TRUST_DECLARATION_AUTHORIZED")throw new Error("trust declaration authorization failed");
  const accepted=registration.accept(authorization);
  if(accepted.outcome!=="GENESIS_TRUST_REGISTRATION_EVIDENCE_ACCEPTED")throw new Error("trust registration acceptance failed");
  await registrationLedger.commit(accepted.evidence);
  const persisted=(await registrationLedger.findByRegistrationRef(accepted.evidence.registrationRef));
  if(!Array.isArray(persisted)||persisted.length!==1||persisted[0].acceptanceId!==accepted.evidence.acceptanceId)throw new Error("persisted registration verification failed");

  return freeze({
   status:"GENESIS_TRUST_ESTABLISHMENT_COMPOSED",
   presentationId:presentation.presentationId,
   decisionEvidenceRef:decision.decisionEvidenceRef,
   provenanceEvidenceRef:capturedProvenance.provenanceEvidenceRef,
   authorizationId:authorization.evidence.authorizationId,
   acceptanceId:accepted.evidence.acceptanceId,
   registrationRef:accepted.evidence.registrationRef,
   authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT
  });
 }
 return freeze({establish,rulesetVersion:RULESET_VERSION,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,AUTHORITY_EFFECT,createGenesisTrustEstablishmentCompositionRunner});
