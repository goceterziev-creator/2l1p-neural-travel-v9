"use strict";

const path=require("node:path");
const crypto=require("node:crypto");
const {createGt63GovernancePersistencePort}=require("../../server");
const {createGenesisTrustPersistentDbBinding}=require("./genesis-trust-persistent-db-binding-v0");
const {createGenesisTrustAsyncLedgerDbComposition}=require("./genesis-trust-async-ledger-db-composition-v0");
const {createGenesisTrustEstablishmentCompositionRunner}=require("./genesis-trust-establishment-composition-runner-v0");

const AUTHORITY="NONE",AUTHORITY_EFFECT="NONE";
const PRINCIPAL_REF="gt63-machine:principal:github:239696056";
const REGISTRATION_REF="gt63-machine:trust-registration:genesis-human-source-ingress-v0";

function fail(m){throw new Error(m);}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function canon(v){if(Array.isArray(v))return v.map(canon);if(v&&typeof v==="object")return Object.keys(v).sort().reduce((o,k)=>(o[k]=canon(v[k]),o),{});return v;}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");}
function assertIsolation(){
 if(process.env.GT63_REQUIRE_ISOLATED_STORAGE!=="true")fail("GT63_REQUIRE_ISOLATED_STORAGE=true required");
 const db=process.env.DB_FILE,root=process.env.RAILWAY_VOLUME_MOUNT_PATH;
 if(!db||!root)fail("explicit DB_FILE and RAILWAY_VOLUME_MOUNT_PATH required");
 const d=path.resolve(db),r=path.resolve(root),rel=path.relative(r,d);
 if(!rel||rel.startsWith("..")||path.isAbsolute(rel))fail("DB_FILE must be strict descendant of isolated mount");
}
function session(){return {sessionRef:"gt63-synthetic-session:genesis-real-db-proof-v0",sessionRevision:"1",authenticatedAccountRef:"gt63-synthetic-account:genesis-real-db-proof-v0",authenticationProviderRef:"gt63-synthetic-auth-provider",authenticationEvidenceRef:"gt63-synthetic-auth-evidence",authenticationState:"AUTHENTICATED",freshnessState:"CURRENT"};}
function principal(){const s=session();return {principalRef:PRINCIPAL_REF,principalRevision:"1",sessionRef:s.sessionRef,sessionRevision:s.sessionRevision,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",principalEvidenceRef:"gt63-synthetic-principal-evidence:genesis-real-db-proof-v0",authority:AUTHORITY};}
function principalPort({principalRef,sessionRef,sessionRevision}){const p=principal();if(principalRef!==p.principalRef||sessionRef!==p.sessionRef||sessionRevision!==p.sessionRevision)fail("synthetic principal request mismatch");return clone(p);}
function memoryPresentationLedger(){const m=new Map();return {get:k=>m.has(k)?clone(m.get(k)):null,commit:(k,v)=>{if(m.has(k))fail("presentation conflict");m.set(k,clone(v));return clone(v);}};}
async function build(){
 const real=createGt63GovernancePersistencePort();
 const storage=createGenesisTrustPersistentDbBinding({readDb:real.read,mutateDb:real.mutate});
 const ledgers=createGenesisTrustAsyncLedgerDbComposition({storagePort:storage});
 return {storage,ledgers};
}
async function write(){
 assertIsolation();
 const {ledgers}=await build();
 const runner=createGenesisTrustEstablishmentCompositionRunner({presentationLedger:memoryPresentationLedger(),...ledgers,principalIdentityPort:principalPort,clock:()=>"2026-09-19T00:00:00.000Z"});
 const result=await runner.establish({session:session(),principal:principal()});
 const decision=await ledgers.decisionLedger.get(result.decisionEvidenceRef);
 const prov=(await ledgers.provenanceLedger.findByEvidenceRef(result.decisionEvidenceRef))[0];
 const reg=(await ledgers.registrationLedger.findByRegistrationRef(REGISTRATION_REF))[0];
 if(!decision||!prov||!reg)fail("exact three-record read-back required");
 const proof={decisionEvidenceRef:result.decisionEvidenceRef,provenanceEvidenceRef:result.provenanceEvidenceRef,acceptanceId:result.acceptanceId,registrationRef:result.registrationRef,decisionDigest:digest(decision),provenanceDigest:digest(prov),registrationDigest:digest(reg)};
 console.log(JSON.stringify({status:"PASS",phase:"SYNTHETIC_ESTABLISHMENT_REAL_DB_WRITE",proof,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT}));
}
async function verify(){
 assertIsolation();
 const {storage,ledgers}=await build();
 const db=await storage.read(),g=db&&db.gt63GovernanceEvidence;
 if(!g||!Array.isArray(g.genesisTrustDecisions)||!Array.isArray(g.genesisTrustDecisionProvenances)||!Array.isArray(g.genesisSourceChannelTrustRegistrations))fail("governance evidence namespace missing");
 const regs=g.genesisSourceChannelTrustRegistrations.filter(x=>x&&x.registrationRef===REGISTRATION_REF);
 if(regs.length!==1)fail("exactly one synthetic registration required");
 const reg=regs[0],decisions=g.genesisTrustDecisions.filter(x=>x&&x.decisionEvidenceRef===reg.decisionEvidenceRef),provs=g.genesisTrustDecisionProvenances.filter(x=>x&&x.evidenceRef===reg.decisionEvidenceRef);
 if(decisions.length!==1||provs.length!==1)fail("exact linked decision/provenance required");
 const decision=await ledgers.decisionLedger.get(reg.decisionEvidenceRef);
 const prov=(await ledgers.provenanceLedger.findByEvidenceRef(reg.decisionEvidenceRef))[0];
 const resolved=(await ledgers.registrationLedger.findByRegistrationRef(REGISTRATION_REF))[0];
 if(!decision||!prov||!resolved||resolved.acceptanceId!==reg.acceptanceId)fail("restart retrieval mismatch");
 const proof={decisionEvidenceRef:decision.decisionEvidenceRef,provenanceEvidenceRef:prov.provenanceEvidenceRef,acceptanceId:resolved.acceptanceId,registrationRef:resolved.registrationRef,decisionDigest:digest(decision),provenanceDigest:digest(prov),registrationDigest:digest(resolved)};
 console.log(JSON.stringify({status:"PASS",phase:"VERIFY_AFTER_RESTART",proof,authority:AUTHORITY,authorityEffect:AUTHORITY_EFFECT}));
}
(async()=>{const mode=process.argv[2];if(mode==="--write")await write();else if(mode==="--verify-after-restart")await verify();else fail("use --write or --verify-after-restart");})().catch(e=>{console.error("FAIL - "+e.message);process.exitCode=1;});
