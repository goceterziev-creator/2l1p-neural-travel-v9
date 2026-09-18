"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const cap=require("./gt63-machine/a-class-material-acceptance-v0");

const EVIDENCE_ID="gt63-evidence:a-class:85584f53706e084a91f5870b8f7c753b";
const BINDING_ID="gt63-assessment:a-class-source-binding:fixture-positive";

function clone(v){return JSON.parse(JSON.stringify(v));}
function ledger(seed=[]){
  const rows=seed.map(clone);
  return {
    findByEvidenceIdentity(id){return rows.filter(x=>x.evidenceIdentity===id).map(clone);},
    commit(x){rows.push(clone(x));return clone(x);},
    rows(){return rows.map(clone);}
  };
}
function evidence(overrides={}){
  return {
    evidenceIdentity:EVIDENCE_ID,
    evidenceRevision:1,
    evidenceClass:"ACCOUNT_AUTHENTICATION_EVIDENCE",
    authenticationMethod:"PASSWORD",
    authenticationResult:"SUCCESS",
    byteIdentity:{byteLength:2035,sha256:"700b2fb7b8b8cc38a42ca4f8a24be4b9aadb13f3bf4c1cec094fca59b62a9162"},
    ...overrides
  };
}
function binding(overrides={}){
  return {
    assessmentIdentity:BINDING_ID,
    sourceBindingState:"SOURCE_BOUND",
    authorityEffect:"NONE",
    evidenceRefs:[EVIDENCE_ID],
    ...overrides
  };
}
function request(overrides={}){
  return {
    rulesetVersion:cap.RULESET_VERSION,
    evidenceIdentity:EVIDENCE_ID,
    expectedEvidenceRevision:1,
    expectedSourceBindingAssessmentIdentity:BINDING_ID,
    ...overrides
  };
}
function system({e=evidence(),b=binding(),l=ledger(),fail=null}={}){
  const c=cap.createAClassMaterialAcceptance({
    evidenceSnapshotPort(){if(fail==="evidence")throw new Error();return clone(e);},
    sourceBindingAssessmentPort(){if(fail==="binding")throw new Error();return clone(b);},
    acceptanceLedger:l
  });
  return {c,l};
}

const cases=[];
function ok(n,fn){fn();cases.push(n);}
function noAuthority(r){
  assert.equal(r.authorityEffect,"NONE");
  if(r.acceptance){
    assert.equal(r.acceptance.authorityEffect,"NONE");
    assert.equal(r.acceptance.nonClaims.filesystemEffectAuthority,false);
    assert.equal(r.acceptance.nonClaims.machineAuthority,false);
  }
}

ok("real-4-exact-material-accepted",()=>{
  const s=system();const r=s.c.accept(request());
  assert.equal(r.outcome,cap.OUTCOMES.ACCEPTED);noAuthority(r);
  assert.equal(r.acceptance.acceptanceState,"ACCEPTED");
});
ok("unsupported-schema-rejected",()=>assert.equal(system().c.accept({...request(),x:true}).outcome,cap.OUTCOMES.REJECTED));
ok("wrong-evidence-revision-rejected",()=>assert.equal(system().c.accept(request({expectedEvidenceRevision:2})).outcome,cap.OUTCOMES.REJECTED));
ok("evidence-unavailable-unknown",()=>assert.equal(system({fail:"evidence"}).c.accept(request()).outcome,cap.OUTCOMES.UNCERTAIN));
ok("wrong-byte-length-rejected",()=>assert.equal(system({e:evidence({byteIdentity:{byteLength:2034,sha256:"700b2fb7b8b8cc38a42ca4f8a24be4b9aadb13f3bf4c1cec094fca59b62a9162"}})}).c.accept(request()).outcome,cap.OUTCOMES.REJECTED));
ok("wrong-byte-digest-rejected",()=>assert.equal(system({e:evidence({byteIdentity:{byteLength:2035,sha256:"bad"}})}).c.accept(request()).outcome,cap.OUTCOMES.REJECTED));
ok("wrong-evidence-class-rejected",()=>assert.equal(system({e:evidence({evidenceClass:"APPLICATION_SESSION_EVIDENCE"})}).c.accept(request()).outcome,cap.OUTCOMES.REJECTED));
ok("binding-unavailable-unknown",()=>assert.equal(system({fail:"binding"}).c.accept(request()).outcome,cap.OUTCOMES.UNCERTAIN));
ok("not-bound-unknown",()=>assert.equal(system({b:binding({sourceBindingState:"NOT_BOUND"})}).c.accept(request()).outcome,cap.OUTCOMES.UNCERTAIN));
ok("binding-id-mismatch-unknown",()=>assert.equal(system({b:binding({assessmentIdentity:"other"})}).c.accept(request()).outcome,cap.OUTCOMES.UNCERTAIN));
ok("binding-authority-widening-unknown",()=>assert.equal(system({b:binding({authorityEffect:"WRITE"})}).c.accept(request()).outcome,cap.OUTCOMES.UNCERTAIN));
ok("binding-not-evidence-specific-conflict",()=>assert.equal(system({b:binding({evidenceRefs:["other"]})}).c.accept(request()).outcome,cap.OUTCOMES.CONFLICT));
ok("duplicate-same-material-idempotent",()=>{
  const s=system();const a=s.c.accept(request());const b=s.c.accept(request());
  assert.equal(a.outcome,cap.OUTCOMES.ACCEPTED);
  assert.equal(b.outcome,cap.OUTCOMES.ALREADY_ACCEPTED);
  assert.equal(a.acceptance.acceptanceId,b.acceptance.acceptanceId);
});
ok("same-evidence-different-material-conflict",()=>{
  const s=system();const a=s.c.accept(request());assert.equal(a.outcome,cap.OUTCOMES.ACCEPTED);
  const mutated={...a.acceptance,exactByteLength:1};
  const l=ledger([mutated]);
  const s2=system({l});
  assert.equal(s2.c.accept(request()).outcome,cap.OUTCOMES.CONFLICT);
});
ok("multiple-historical-records-conflict",()=>{
  const seed=[{evidenceIdentity:EVIDENCE_ID},{evidenceIdentity:EVIDENCE_ID}];
  assert.equal(system({l:ledger(seed)}).c.accept(request()).outcome,cap.OUTCOMES.CONFLICT);
});
ok("deterministic-acceptance-identity",()=>{
  const a=system().c.accept(request());const b=system().c.accept(request());
  assert.equal(a.acceptance.acceptanceId,b.acceptance.acceptanceId);
});
ok("authority-always-none",()=>{
  for(const s of [system(),system({fail:"evidence"}),system({b:binding({sourceBindingState:"UNKNOWN"})})]) noAuthority(s.c.accept(request()));
});
ok("acceptance-does-not-create-principal-or-effect-authority",()=>{
  const r=system().c.accept(request());
  assert.equal(r.acceptance.nonClaims.authenticatedHumanPrincipal,false);
  assert.equal(r.acceptance.nonClaims.principalEligibility,false);
  assert.equal(r.acceptance.nonClaims.capabilityAuthorization,false);
  assert.equal(r.acceptance.nonClaims.filesystemEffectAuthority,false);
});

const semantic={cases,outcomes:Object.values(cap.OUTCOMES),rulesetVersion:cap.RULESET_VERSION};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"a-class-material-acceptance-v0-regression",cases:cases.length,validationIdentity,semantic})+"\n");
