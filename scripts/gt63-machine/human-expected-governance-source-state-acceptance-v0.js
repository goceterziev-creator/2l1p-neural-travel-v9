"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "human-expected-governance-source-state-acceptance-v0.1.0";
const AUTHORITY = "NONE";
const DECISION = "ACCEPT_EXPECTED_GOVERNANCE_SOURCE_STATE";
const REPOSITORY_IDENTITY = "goceterziev-creator/2l1p-neural-travel-v9";
const AUTHORITATIVE_REF = "refs/heads/main";
const ROOT_PATH = "config/gt63-machine/governance-trust-root-v0.json";

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function sha1(v){return typeof v==="string"&&/^[0-9a-f]{40}$/.test(v);}
function sha256(v){return typeof v==="string"&&/^sha256:[0-9a-f]{64}$/.test(v);}
function exact(v,fields){return plain(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k));}
function compare(a,b){return String(a)<String(b)?-1:String(a)>String(b)?1:0;}
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(plain(v))return Object.keys(v).sort(compare).reduce((o,k)=>(o[k]=canonicalize(v[k]),o),{});return v;}
function stringify(v){return JSON.stringify(canonicalize(v));}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(stringify(v),"utf8")).digest("hex");}
function clone(v){return v===null||v===undefined?v:JSON.parse(JSON.stringify(v));}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function same(a,b){return stringify(a)===stringify(b);}

function validSession(s){
  return exact(s,["sessionRef","sessionRevision","authenticatedAccountRef","authenticationProviderRef","authenticationEvidenceRef","authenticationState","freshnessState"])
    && ["sessionRef","sessionRevision","authenticatedAccountRef","authenticationProviderRef","authenticationEvidenceRef"].every(k=>nonEmpty(s[k]))
    && s.authenticationState==="AUTHENTICATED"&&s.freshnessState==="CURRENT";
}
function validPrincipal(p,s){
  return plain(p)&&nonEmpty(p.principalRef)&&nonEmpty(p.principalRevision)&&nonEmpty(p.principalEvidenceRef)
    &&p.sessionRef===s.sessionRef&&p.sessionRevision===s.sessionRevision
    &&p.lifecycleState==="CURRENT"&&p.freshnessState==="CURRENT"&&p.contradictionState==="NONE"&&p.authority===AUTHORITY;
}
const SNAPSHOT_FIELDS=["type","repositoryIdentity","authoritativeRef","commitSha","treeSha","rootPath","rootBlobSha","rootAnchorId","observationEvidenceRefs","authority"];
function validSnapshot(v){
  return exact(v,SNAPSHOT_FIELDS)&&v.type==="GT63_CANDIDATE_GOVERNANCE_SOURCE_STATE_OBSERVATION"
    &&v.repositoryIdentity===REPOSITORY_IDENTITY&&v.authoritativeRef===AUTHORITATIVE_REF
    &&sha1(v.commitSha)&&sha1(v.treeSha)&&v.rootPath===ROOT_PATH&&sha1(v.rootBlobSha)&&sha256(v.rootAnchorId)
    &&Array.isArray(v.observationEvidenceRefs)&&v.observationEvidenceRefs.length>0
    &&v.observationEvidenceRefs.every(nonEmpty)&&new Set(v.observationEvidenceRefs).size===v.observationEvidenceRefs.length
    &&v.authority===AUTHORITY;
}
function payload(snapshot){
  return freeze({decision:DECISION,repositoryIdentity:snapshot.repositoryIdentity,authoritativeRef:snapshot.authoritativeRef,
    expectedCommitSha:snapshot.commitSha,expectedTreeSha:snapshot.treeSha,expectedRootPath:snapshot.rootPath,
    expectedRootBlobSha:snapshot.rootBlobSha,expectedRootAnchorId:snapshot.rootAnchorId,machineAuthority:AUTHORITY});
}
function createMemoryLedger(){const m=new Map();return Object.freeze({get:k=>m.has(k)?m.get(k):null,commit(k,v){if(m.has(k))throw new Error("immutable-ledger-conflict");m.set(k,freeze(clone(v)));return m.get(k);}});}

function createHumanExpectedGovernanceSourceStateAcceptance({clock=()=>new Date().toISOString(),randomBytes=crypto.randomBytes,presentationLedger,decisionLedger}={}){
  for(const [n,l] of Object.entries({presentationLedger,decisionLedger}))if(!l||typeof l.get!=="function"||typeof l.commit!=="function")throw new TypeError(`${n} must expose get() and commit()`);
  function present({session,principal,candidateSnapshot}){
    if(!validSession(session))throw new Error("current authenticated session required");
    if(!validPrincipal(principal,session))throw new Error("current exact session-bound human principal required");
    if(!validSnapshot(candidateSnapshot))throw new Error("exact candidate governance source state observation required");
    const exactPayload=payload(candidateSnapshot), exactPayloadDigest=digest(exactPayload);
    const presentationId=`gt63-expected-source-state-presentation:${randomBytes(16).toString("hex")}`;
    const record=freeze({type:"GT63_EXPECTED_GOVERNANCE_SOURCE_STATE_ACCEPTANCE_PRESENTATION",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,presentationId,
      principalRef:principal.principalRef,principalRevision:principal.principalRevision,principalEvidenceRef:principal.principalEvidenceRef,
      sessionRef:session.sessionRef,sessionRevision:session.sessionRevision,authenticatedAccountRef:session.authenticatedAccountRef,
      authenticationProviderRef:session.authenticationProviderRef,authenticationEvidenceRef:session.authenticationEvidenceRef,
      candidateSnapshot:clone(candidateSnapshot),exactPayloadDigest,exactPayload,presentedAt:clock(),authority:AUTHORITY});
    presentationLedger.commit(presentationId,record);return record;
  }
  function decide({session,principal,candidateSnapshot,presentationId,decision}){
    if(!validSession(session))throw new Error("current authenticated session required");
    if(!validPrincipal(principal,session))throw new Error("current exact session-bound human principal required");
    if(!validSnapshot(candidateSnapshot))throw new Error("exact candidate governance source state observation required");
    if(!nonEmpty(presentationId))throw new Error("presentationId required");
    if(decision!==DECISION)throw new Error("unsupported expected source state decision");
    const p=presentationLedger.get(presentationId);if(!p)throw new Error("presentation unavailable");
    const exactPayload=payload(candidateSnapshot), exactPayloadDigest=digest(exactPayload);
    if(p.principalRef!==principal.principalRef||p.principalRevision!==principal.principalRevision||p.principalEvidenceRef!==principal.principalEvidenceRef
      ||p.sessionRef!==session.sessionRef||p.sessionRevision!==session.sessionRevision||p.authenticatedAccountRef!==session.authenticatedAccountRef
      ||p.authenticationProviderRef!==session.authenticationProviderRef||p.authenticationEvidenceRef!==session.authenticationEvidenceRef
      ||p.exactPayloadDigest!==exactPayloadDigest||!same(p.exactPayload,exactPayload)||!same(p.candidateSnapshot,candidateSnapshot))
      throw new Error("decision context does not match exact presentation");
    const identity={presentationId,exactPayloadDigest,principalEvidenceRef:principal.principalEvidenceRef};
    const expectedStateDecisionEvidenceRef=`gt63-evidence:expected-governance-source-state-decision:${digest(identity).slice(7)}`;
    const record=freeze({type:"GT63_EXPECTED_GOVERNANCE_SOURCE_STATE_ACCEPTANCE_DECISION",expectedStateDecisionEvidenceRef,decision:DECISION,
      repositoryIdentity:candidateSnapshot.repositoryIdentity,authoritativeRef:candidateSnapshot.authoritativeRef,
      expectedCommitSha:candidateSnapshot.commitSha,expectedTreeSha:candidateSnapshot.treeSha,expectedRootPath:candidateSnapshot.rootPath,
      expectedRootBlobSha:candidateSnapshot.rootBlobSha,expectedRootAnchorId:candidateSnapshot.rootAnchorId,
      principalRef:principal.principalRef,principalRevision:principal.principalRevision,principalEvidenceRef:principal.principalEvidenceRef,
      observationEvidenceRefs:clone(candidateSnapshot.observationEvidenceRefs),lifecycleState:"CURRENT",freshnessState:"CURRENT",
      contradictionState:"NONE",authority:AUTHORITY,roleAssigned:false,principalEligible:false,humanGateSatisfied:false,
      continuationAuthorityCreated:false,executionAuthorityCreated:false,effectAuthorized:false});
    const prior=decisionLedger.get(expectedStateDecisionEvidenceRef);
    if(prior!==null&&prior!==undefined){if(!same(prior,record))throw new Error("expected source state decision evidence conflict");return prior;}
    const committed=decisionLedger.commit(expectedStateDecisionEvidenceRef,record);
    if(!committed||!same(committed,record))throw new Error("expected source state decision ledger conflict");
    return committed;
  }
  return Object.freeze({present,decide,authority:AUTHORITY,rulesetVersion:RULESET_VERSION});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,DECISION,REPOSITORY_IDENTITY,AUTHORITATIVE_REF,ROOT_PATH,
  createHumanExpectedGovernanceSourceStateAcceptance,createMemoryLedger});
