"use strict";

const {createGitHubHumanIdentityTrustBootstrap}=require("./github-human-identity-trust-bootstrap");

const RULESET_VERSION="genesis-principal-bootstrap-runtime-bridge-v0.1.0";
const AUTHORITY="NONE";
const AUTHORITY_EFFECT="NONE";

function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function exactSession(s){return s&&typeof s.sessionRef==="string"&&s.sessionRef.length>0&&typeof s.sessionRevision==="string"&&s.sessionRevision.length>0&&typeof s.authenticatedAccountRef==="string"&&s.authenticatedAccountRef.length>0;}

function createGenesisPrincipalBootstrapRuntimeBridge({
 clientId,
 expectedIdentity,
 ledger,
 transport,
 now,
 randomBytes,
 bootstrapFactory=createGitHubHumanIdentityTrustBootstrap
}={}){
 if(typeof bootstrapFactory!=="function")throw new TypeError("bootstrapFactory must be a function");
 const bootstrap=bootstrapFactory({clientId,expectedIdentity,ledger,transport,now,randomBytes});
 if(!bootstrap||typeof bootstrap.start!=="function"||typeof bootstrap.poll!=="function"||typeof bootstrap.getIdentityBySession!=="function")throw new TypeError("bootstrap runtime contract invalid");

 async function start(session){
  if(!exactSession(session))return freeze({outcome:"PRINCIPAL_BOOTSTRAP_REJECTED",reason:"exact authenticated session required",authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
  return bootstrap.start(session);
 }
 async function poll(session,challengeRef){
  if(!exactSession(session)||typeof challengeRef!=="string"||!challengeRef.length)return freeze({outcome:"PRINCIPAL_BOOTSTRAP_REJECTED",reason:"exact authenticated session and challenge required",authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
  return bootstrap.poll({...session,challengeRef});
 }
 function getIdentityBySession(sessionRef){
  if(typeof sessionRef!=="string"||!sessionRef.length)return null;
  return bootstrap.getIdentityBySession(sessionRef);
 }

 return freeze({
  rulesetVersion:RULESET_VERSION,
  authority:AUTHORITY,
  authorityEffect:AUTHORITY_EFFECT,
  start,
  poll,
  getIdentityBySession
 });
}
module.exports=freeze({RULESET_VERSION,AUTHORITY,AUTHORITY_EFFECT,createGenesisPrincipalBootstrapRuntimeBridge});
