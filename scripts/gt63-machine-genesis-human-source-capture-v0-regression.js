"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const cap=require("./gt63-machine/genesis-human-source-capture-v0");
const R=cap.RULESET_VERSION, O=cap.OUTCOMES;
const clone=v=>JSON.parse(JSON.stringify(v));
function ledger(){
 const rows=[];
 return {findByProviderEvent(p,e){return rows.filter(x=>x.sourceProviderRef===p&&x.providerEventId===e);},
 commit(v){if(rows.some(x=>x.genesisSourceEvidenceRef===v.genesisSourceEvidenceRef||x.sourceEventRef===v.sourceEventRef)) throw new Error("immutable-ledger-conflict"); const z=Object.freeze(clone(v));rows.push(z);return z;},records(){return rows.slice();}};
}
function req(o={}){return {rulesetVersion:R,sourceProviderRef:"source:test",expectedSourceProviderRevision:"7",providerEventId:"evt:1",contentBytesBase64:Buffer.from("Run two human intent","utf8").toString("base64"),contentEncoding:"utf8",contentMediaType:"text/plain",channelRef:"channel:test",expectedChannelRevision:"3",...o};}
function env(o={}){
 const l=o.ledger||ledger();
 const session={sessionRef:"session:1",sessionRevision:"4",authenticatedAccountRef:"account:1",authenticationProviderRef:"auth:signed",authenticationEvidenceRef:"evidence:session",authenticationState:"AUTHENTICATED",freshnessState:"CURRENT",...(o.session||{})};
 const principal={principalRef:"principal:1",principalRevision:"11",sessionRef:"session:1",sessionRevision:"4",principalEvidenceRef:"evidence:principal",resolutionState:"RESOLVED",lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",...(o.principal||{})};
 const registry={sourceProviderRef:"source:test",sourceProviderRevision:"7",channelRef:"channel:test",channelRevision:"3",trustState:"TRUSTED",registryEvidenceRef:"evidence:registry",...(o.registry||{})};
 const temporal={occurredTemporalFrameRef:"time:occurred:1",receivedTemporalFrameRef:"time:received:1",freshnessState:"CURRENT",contradictionState:"NONE",...(o.temporal||{})};
 const fail=o.fail;
 const c=cap.createGenesisHumanSourceCapture({
  authenticatedSessionPort(){if(fail==="session")throw Error();return clone(session);},
  authenticatedPrincipalPort(){if(fail==="principal")throw Error();return clone(principal);},
  sourceRegistryPort(){if(fail==="registry")throw Error();return clone(registry);},
  temporalEvidencePort(){if(fail==="temporal")throw Error();return clone(temporal);},
  genesisSourceLedger:l
 }); return {c,l};
}
function noAuthority(x){assert.equal(x.authority,"NONE");assert.equal(x.authorityEffect,"NONE");if(x.evidence){assert.equal(x.evidence.authority,"NONE");assert.equal(x.evidence.authorityEffect,"NONE");}}
function run(){
 const cases=[]; const ok=(n,f)=>{f();cases.push(n);};
 ok("exact-valid-genesis-capture",()=>{const x=env().c.capture(req());assert.equal(x.outcome,O.CAPTURED);assert.equal(x.evidence.originAuthenticationState,"AUTHENTICATED");assert.equal(x.evidence.contentIntegrityState,"EXACT_BYTES");});
 ok("deterministic-exact-replay",()=>{const e=env();const a=e.c.capture(req()),b=e.c.capture(req());assert.equal(b.outcome,O.ALREADY_CAPTURED);assert.equal(a.evidence.genesisSourceEvidenceRef,b.evidence.genesisSourceEvidenceRef);});
 ok("same-provider-event-changed-bytes-conflict",()=>{const e=env();e.c.capture(req());assert.equal(e.c.capture(req({contentBytesBase64:Buffer.from("changed").toString("base64")})).outcome,O.IDENTITY_CONFLICT);});
 ok("same-bytes-distinct-provider-event-distinct",()=>{const e=env();const a=e.c.capture(req());const b=e.c.capture(req({providerEventId:"evt:2"}));assert.equal(b.outcome,O.CAPTURED);assert.notEqual(a.evidence.sourceEventRef,b.evidence.sourceEventRef);});
 ok("invalid-base64-rejected",()=>assert.equal(env().c.capture(req({contentBytesBase64:"bad"})).outcome,O.REJECTED));
 ok("unicode-byte-distinction",()=>{const a=env().c.capture(req({providerEventId:"evt:a",contentBytesBase64:Buffer.from("café").toString("base64")}));const b=env().c.capture(req({providerEventId:"evt:b",contentBytesBase64:Buffer.from("cafe\u0301").toString("base64")}));assert.notEqual(a.evidence.contentDigest,b.evidence.contentDigest);});
 ok("unsupported-ruleset-rejected",()=>assert.equal(env().c.capture(req({rulesetVersion:"wrong"})).outcome,O.REJECTED));
 ok("extra-request-field-rejected",()=>assert.equal(env().c.capture({...req(),extra:true}).outcome,O.REJECTED));
 ok("caller-authenticated-flag-rejected",()=>assert.equal(env().c.capture({...req(),authenticated:true}).outcome,O.REJECTED));
 ok("caller-principal-ref-rejected",()=>assert.equal(env().c.capture({...req(),principalRef:"principal:1"}).outcome,O.REJECTED));
 ok("caller-interaction-context-rejected",()=>assert.equal(env().c.capture({...req(),interactionId:"i",contextRevision:"1"}).outcome,O.REJECTED));
 ok("caller-intent-authority-rejected",()=>assert.equal(env().c.capture({...req(),intentAccepted:true,authorized:true}).outcome,O.REJECTED));
 ok("stale-session-stale",()=>assert.equal(env({session:{freshnessState:"STALE"}}).c.capture(req()).outcome,O.STALE));
 ok("unauthenticated-session-rejected",()=>assert.equal(env({session:{authenticationState:"NOT_AUTHENTICATED"}}).c.capture(req()).outcome,O.REJECTED));
 ok("session-principal-mismatch-conflict",()=>assert.equal(env({principal:{sessionRef:"session:other"}}).c.capture(req()).outcome,O.IDENTITY_CONFLICT));
 ok("principal-unresolved-uncertain",()=>assert.equal(env({principal:{resolutionState:"MISSING"}}).c.capture(req()).outcome,O.UNCERTAIN));
 ok("principal-session-revision-mismatch-conflict",()=>assert.equal(env({principal:{sessionRevision:"5"}}).c.capture(req()).outcome,O.IDENTITY_CONFLICT));
 ok("stale-principal-stale",()=>assert.equal(env({principal:{freshnessState:"STALE"}}).c.capture(req()).outcome,O.STALE));
 ok("revoked-principal-stale",()=>assert.equal(env({principal:{lifecycleState:"REVOKED"}}).c.capture(req()).outcome,O.STALE));
 ok("contradictory-principal-conflict",()=>assert.equal(env({principal:{contradictionState:"CONTRADICTORY_EVIDENCE"}}).c.capture(req()).outcome,O.IDENTITY_CONFLICT));
 ok("stale-source-revision-stale",()=>assert.equal(env({registry:{sourceProviderRevision:"8"}}).c.capture(req()).outcome,O.STALE));
 ok("temporal-unavailable-uncertain",()=>assert.equal(env({fail:"temporal"}).c.capture(req()).outcome,O.UNCERTAIN));
 ok("immutable-ledger-conflict",()=>{const l=ledger();const original=l.commit.bind(l);let n=0;l.commit=v=>{n++;if(n===1)throw Error("conflict");return original(v);};assert.equal(env({ledger:l}).c.capture(req()).outcome,O.IDENTITY_CONFLICT);});
 ok("all-outcomes-no-authority-no-interaction-intent-effect",()=>{
  const xs=[env().c.capture(req()),env({session:{freshnessState:"STALE"}}).c.capture(req()),env({fail:"temporal"}).c.capture(req()),env().c.capture({...req(),authority:true})];
  for(const x of xs){noAuthority(x);const s=JSON.stringify(x);for(const bad of ["interactionId","contextRevision","intentContractRef","INTENT_ACCEPTED","EFFECT_AUTHORIZED"])assert(!s.includes(bad));}
 });
 assert.equal(cases.length,24);
 return {status:"PASS",workflow:"genesis-human-source-capture-v0-regression",cases:cases.length,names:cases};
}
const a=run(),b=run();assert.deepEqual(a,b);
process.stdout.write(JSON.stringify({...a,deterministicRuns:2,outputHash:crypto.createHash("sha256").update(JSON.stringify(a)).digest("hex")})+"\n");
