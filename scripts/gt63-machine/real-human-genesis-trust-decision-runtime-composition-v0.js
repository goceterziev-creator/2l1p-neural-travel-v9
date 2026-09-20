"use strict";

const express=require("express");
const {
 AUTHORITY,AUTHORITY_EFFECT,
 createGenesisPrincipalBootstrapRuntimeBridge
}=require("./genesis-principal-bootstrap-runtime-bridge-v0");
const {
 createReadOnlySessionValidationPort,
 attachValidatedContext,
 establishReadOnlyDbGuard,
 EXPECTED_GITHUB_IDENTITY
}=require("./isolated-local-real-context-proof-surface-v0");
const {createExistingSessionAdapter}=require("./human-governance-approval-server-wiring");
const {createGenesisTrustRealContextBinding}=require("./genesis-trust-real-context-binding-v0");
const {createIsolatedRealHumanGenesisTrustDecisionSurface}=require("./isolated-real-human-genesis-trust-decision-surface-v0");

const RULESET_VERSION="real-human-genesis-trust-decision-runtime-composition-v0.1.0";
const ROUTES=Object.freeze([
 Object.freeze({method:"POST",path:"/api/gt63/genesis-trust-runtime/identity/start"}),
 Object.freeze({method:"POST",path:"/api/gt63/genesis-trust-runtime/identity/poll"}),
 Object.freeze({method:"POST",path:"/api/gt63/genesis-trust-runtime/decision/present"}),
 Object.freeze({method:"POST",path:"/api/gt63/genesis-trust-runtime/decision/decide"})
]);
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function safe(e){return String(e&&e.message||e);}

function createRealHumanGenesisTrustDecisionRuntime({validateSession,bridge,dbGuard,clock}={}){
 if(typeof validateSession!=="function")throw new TypeError("validateSession required");
 if(!bridge||typeof bridge.start!=="function"||typeof bridge.poll!=="function"||typeof bridge.getIdentityBySession!=="function")throw new TypeError("bridge required");
 if(!dbGuard||typeof dbGuard.assertUnchanged!=="function")throw new TypeError("dbGuard required");
 const sessionAdapter=createExistingSessionAdapter();
 const binding=createGenesisTrustRealContextBinding({sessionAdapter,identityProvider:bridge});
 const decisionSurface=createIsolatedRealHumanGenesisTrustDecisionSurface({
  contextProvider:req=>binding.bind(req),...(clock?{clock}:{})
 });
 const app=express();app.disable("x-powered-by");app.use(express.json({limit:"8kb"}));
 const auth=attachValidatedContext(validateSession);
 app.post(ROUTES[0].path,auth,async(req,res)=>{try{dbGuard.assertUnchanged();const s=sessionAdapter(req);const x=await bridge.start(s);dbGuard.assertUnchanged();return res.json({outcome:x.outcome,challenge:x.challenge||null,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}catch(e){return res.status(409).json({outcome:"IDENTITY_START_REJECTED",reason:safe(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}});
 app.post(ROUTES[1].path,auth,async(req,res)=>{try{dbGuard.assertUnchanged();const s=sessionAdapter(req);const x=await bridge.poll(s,String(req.body&&req.body.challengeRef||""));dbGuard.assertUnchanged();return res.status(x.outcome==="EXTERNAL_IDENTITY_AUTHORIZATION_PENDING"?202:200).json({outcome:x.outcome,principalRef:x.identity&&x.identity.principalRef||null,principalEvidenceRef:x.identity&&x.identity.principalEvidenceRef||null,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}catch(e){return res.status(409).json({outcome:"IDENTITY_POLL_REJECTED",reason:safe(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}});
 app.post(ROUTES[2].path,auth,(req,res)=>{try{dbGuard.assertUnchanged();const x=decisionSurface.present(req);dbGuard.assertUnchanged();return res.json(x);}catch(e){return res.status(409).json({outcome:"GENESIS_TRUST_DECISION_PRESENTATION_REJECTED",reason:safe(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}});
 app.post(ROUTES[3].path,auth,(req,res)=>{try{dbGuard.assertUnchanged();const x=decisionSurface.decide(req,{presentationId:String(req.body&&req.body.presentationId||""),decision:String(req.body&&req.body.decision||"")});dbGuard.assertUnchanged();return res.json(x);}catch(e){return res.status(409).json({outcome:"GENESIS_TRUST_DECISION_CAPTURE_REJECTED",reason:safe(e),authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});}});
 return freeze({app,routes:ROUTES,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT});
}

function createDefaultRuntime({clientId,authSecret,readDb,dbGuard,clock}={}){
 if(!clientId)throw new TypeError("clientId required");
 const validateSession=createReadOnlySessionValidationPort({authSecret,readDb});
 const bridge=createGenesisPrincipalBootstrapRuntimeBridge({clientId,expectedIdentity:EXPECTED_GITHUB_IDENTITY});
 return createRealHumanGenesisTrustDecisionRuntime({validateSession,bridge,dbGuard,clock});
}
module.exports=freeze({RULESET_VERSION,AUTHORITY,AUTHORITY_EFFECT,ROUTES,createRealHumanGenesisTrustDecisionRuntime,createDefaultRuntime});
