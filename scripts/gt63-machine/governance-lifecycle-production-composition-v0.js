"use strict";
const composerModule=require("./governance-source-state-observation-composer-v0");
const expectedModule=require("./human-expected-governance-source-state-acceptance-v0");
const expectedDurableModule=require("./expected-governance-source-state-durable-evidence-v0");

const AUTHORITY="NONE";

function createGovernanceLifecycleProductionComposition({
  readDb,writeDb,gitObjectPort,identityBootstrap
}={}){
  if(typeof readDb!=="function")throw new TypeError("readDb required");
  if(typeof writeDb!=="function")throw new TypeError("writeDb required");
  if(!gitObjectPort)throw new TypeError("explicit gitObjectPort required");
  for(const n of ["resolveRef","readCommit","readTreeEntry","readBlob","listPathHistory"])
    if(typeof gitObjectPort[n]!=="function")throw new TypeError(`gitObjectPort.${n} required`);
  if(!identityBootstrap||typeof identityBootstrap.getIdentityBySession!=="function")
    throw new TypeError("identityBootstrap.getIdentityBySession required");

  const sourceStateComposer=composerModule.createGovernanceSourceStateObservationComposer({gitObjectPort});
  const expectedStateDecisionLedger=expectedDurableModule.createDurableExpectedGovernanceSourceStateDecisionLedger({readDb,writeDb});
  const expectedStatePresentationLedger=expectedModule.createMemoryLedger();
  const expectedStateAcceptance=expectedModule.createHumanExpectedGovernanceSourceStateAcceptance({
    presentationLedger:expectedStatePresentationLedger,decisionLedger:expectedStateDecisionLedger
  });

  function currentPrincipal(session){
    if(!session||typeof session.sessionRef!=="string")throw new Error("current session required");
    const identity=identityBootstrap.getIdentityBySession(session.sessionRef);
    if(!identity||identity.sessionRef!==session.sessionRef||identity.sessionRevision!==session.sessionRevision
      ||identity.authenticatedAccountRef!==session.authenticatedAccountRef
      ||identity.lifecycleState!=="CURRENT"||identity.freshnessState!=="CURRENT"
      ||identity.contradictionState!=="NONE"||identity.authority!==AUTHORITY)
      throw new Error("current exact session-bound human principal unavailable");
    return identity;
  }
  function presentExpectedSourceState({session}={}){
    const principal=currentPrincipal(session);
    const candidateSnapshot=sourceStateComposer.observe();
    return expectedStateAcceptance.present({session,principal,candidateSnapshot});
  }
  function acceptExpectedSourceState({session,presentationId,decision,candidateSnapshot}={}){
    const principal=currentPrincipal(session);
    if(!candidateSnapshot)throw new Error("exact presented candidate snapshot required");
    return expectedStateAcceptance.decide({session,principal,candidateSnapshot,presentationId,decision});
  }
  return Object.freeze({
    presentExpectedSourceState,acceptExpectedSourceState,expectedStateDecisionLedger,
    sourceStateComposer,authority:AUTHORITY,networkProviderConfigured:false,
    serverRoutesAttached:false,productionDeploymentPerformed:false
  });
}
module.exports=Object.freeze({AUTHORITY,createGovernanceLifecycleProductionComposition});
