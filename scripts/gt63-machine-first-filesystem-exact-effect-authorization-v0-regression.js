"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mod=require("./gt63-machine/first-filesystem-exact-effect-authorization-v0");

const ACCEPTANCE_ID="gt63-acceptance:a-class:fixture";
const HUMAN_REF="gt63-evidence:human-effect-decision:first-filesystem-v1";

function clone(v){return JSON.parse(JSON.stringify(v));}
function ledger(seed=[]){
  const rows=seed.map(clone);
  return {
    findByEffectContractRef(ref){return rows.filter(x=>x.effectContractRef===ref).map(clone);},
    commit(x){rows.push(clone(x));return clone(x);}
  };
}
function material(o={}){
  return {
    validationState:"VALID",
    materialIdentity:mod.EXPECTED.materialIdentity,
    effectContractRef:mod.EXPECTED.effectContractRef,
    effectContractRevision:1,
    effectContractDigest:mod.EXPECTED.effectContractDigest,
    operation:mod.EXPECTED.operation,
    authorizedRootIdentity:mod.EXPECTED.authorizedRootIdentity,
    targetKind:mod.EXPECTED.targetKind,
    targetPath:mod.EXPECTED.targetPath,
    payloadEncoding:mod.EXPECTED.payloadEncoding,
    payloadBase64:mod.EXPECTED.payloadBase64,
    payloadDigest:mod.EXPECTED.payloadDigest,
    mustNotExist:true,
    fileExistsPostcondition:true,
    authorityEffect:"NONE",
    ...o
  };
}
function acceptance(o={}){
  return {acceptanceId:ACCEPTANCE_ID,type:"GT63_A_CLASS_MATERIAL_ACCEPTANCE",acceptanceState:"ACCEPTED",authorityEffect:"NONE",...o};
}
function human(o={}){
  return {
    humanEffectDecisionEvidenceRef:HUMAN_REF,
    decision:"APPROVE",
    effectContractRef:mod.EXPECTED.effectContractRef,
    effectContractRevision:1,
    effectContractDigest:mod.EXPECTED.effectContractDigest,
    materialIdentity:mod.EXPECTED.materialIdentity,
    lifecycleState:"CURRENT",
    freshnessState:"CURRENT",
    contradictionState:"NONE",
    authorityEffect:"NONE",
    ...o
  };
}
function request(o={}){
  return {
    rulesetVersion:mod.RULESET_VERSION,
    effectContractRef:mod.EXPECTED.effectContractRef,
    effectContractRevision:1,
    expectedMaterialIdentity:mod.EXPECTED.materialIdentity,
    expectedEffectContractDigest:mod.EXPECTED.effectContractDigest,
    aClassAcceptanceId:ACCEPTANCE_ID,
    humanEffectDecisionEvidenceRef:HUMAN_REF,
    ...o
  };
}
function system({m=material(),a=acceptance(),h=human(),l=ledger(),fail=null}={}){
  const c=mod.createFirstFilesystemExactEffectAuthorizationV0({
    materialValidationPort(){if(fail==="material")throw new Error();return clone(m);},
    aClassMaterialAcceptancePort(){if(fail==="acceptance")throw new Error();return clone(a);},
    humanEffectDecisionPort(){if(fail==="human")throw new Error();return clone(h);},
    authorizationLedger:l
  });
  return {c,l};
}
function noFs(r){
  assert.equal(r.authorityEffect,"NONE");
  assert.equal(r.authorizedRootResolved,false);
  assert.equal(r.filesystemToolAuthority,false);
  assert.equal(r.effectPerformed,false);
  if(r.authorization){
    assert.equal(r.authorization.authorityEffect,"NONE");
    assert.equal(r.authorization.authorizedRootResolved,false);
    assert.equal(r.authorization.filesystemToolAuthority,false);
    assert.equal(r.authorization.effectPerformed,false);
  }
}
const cases=[];
function run(n,fn){fn();cases.push(n);}

run("exact-first-filesystem-effect-authorized",()=>{
  const r=system().c.authorize(request());
  assert.equal(r.outcome,mod.OUTCOMES.AUTHORIZED);noFs(r);
  assert.equal(r.authorization.authorizationState,"AUTHORIZED");
});
run("unsupported-schema-invalid",()=>assert.equal(system().c.authorize({...request(),x:true}).outcome,mod.OUTCOMES.INVALID));
run("wrong-effect-contract-ref-invalid",()=>assert.equal(system().c.authorize(request({effectContractRef:"other"})).outcome,mod.OUTCOMES.INVALID));
run("wrong-effect-digest-invalid",()=>assert.equal(system().c.authorize(request({expectedEffectContractDigest:"sha256:"+"0".repeat(64)})).outcome,mod.OUTCOMES.INVALID));
run("material-unavailable-unknown",()=>assert.equal(system({fail:"material"}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("material-not-valid-unknown",()=>assert.equal(system({m:material({validationState:"INVALID"})}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("operation-mismatch-unknown",()=>assert.equal(system({m:material({operation:"OVERWRITE_FILE"})}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("root-mismatch-unknown",()=>assert.equal(system({m:material({authorizedRootIdentity:"OTHER/"})}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("target-mismatch-unknown",()=>assert.equal(system({m:material({targetPath:"other.txt"})}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("payload-mismatch-unknown",()=>assert.equal(system({m:material({payloadBase64:"SGVsbG8="})}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("acceptance-unavailable-unknown",()=>assert.equal(system({fail:"acceptance"}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("acceptance-not-accepted-unknown",()=>assert.equal(system({a:acceptance({acceptanceState:"REJECTED"})}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("human-decision-unavailable-unknown",()=>assert.equal(system({fail:"human"}).c.authorize(request()).outcome,mod.OUTCOMES.UNKNOWN));
run("human-deny-not-authorized",()=>assert.equal(system({h:human({decision:"DENY"})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("human-subject-mismatch-not-authorized",()=>assert.equal(system({h:human({effectContractDigest:"sha256:"+"0".repeat(64)})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("human-stale-not-authorized",()=>assert.equal(system({h:human({freshnessState:"STALE"})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("human-contradiction-not-authorized",()=>assert.equal(system({h:human({contradictionState:"CONFLICT"})}).c.authorize(request()).outcome,mod.OUTCOMES.NOT_AUTHORIZED));
run("duplicate-same-authorization-idempotent",()=>{
  const s=system();const a=s.c.authorize(request());const b=s.c.authorize(request());
  assert.equal(a.outcome,mod.OUTCOMES.AUTHORIZED);
  assert.equal(b.outcome,mod.OUTCOMES.ALREADY_AUTHORIZED);
  assert.equal(a.authorization.authorizationId,b.authorization.authorizationId);
});
run("different-existing-authorization-conflict",()=>{
  const first=system().c.authorize(request());
  const changed={...first.authorization,target:{kind:"RELATIVE_FILE",path:"changed.txt"}};
  assert.equal(system({l:ledger([changed])}).c.authorize(request()).outcome,mod.OUTCOMES.CONFLICT);
});
run("multiple-existing-authorizations-conflict",()=>{
  const x={effectContractRef:mod.EXPECTED.effectContractRef};
  assert.equal(system({l:ledger([x,x])}).c.authorize(request()).outcome,mod.OUTCOMES.CONFLICT);
});
run("deterministic-authorization-identity",()=>{
  const a=system().c.authorize(request());
  const b=system().c.authorize(request());
  assert.equal(a.authorization.authorizationId,b.authorization.authorizationId);
});
run("authorization-does-not-resolve-root",()=>assert.equal(system().c.authorize(request()).authorization.authorizedRootResolved,false));
run("authorization-does-not-create-filesystem-tool-authority",()=>assert.equal(system().c.authorize(request()).authorization.filesystemToolAuthority,false));
run("authorization-does-not-perform-effect",()=>assert.equal(system().c.authorize(request()).authorization.effectPerformed,false));
run("authority-always-none",()=>{
  for(const r of [
    system().c.authorize(request()),
    system({fail:"material"}).c.authorize(request()),
    system({h:human({decision:"DENY"})}).c.authorize(request())
  ]) noFs(r);
});

const semantic={cases,rulesetVersion:mod.RULESET_VERSION,outcomes:Object.values(mod.OUTCOMES)};
const validationIdentity="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"first-filesystem-exact-effect-authorization-v0-regression",cases:cases.length,validationIdentity,semantic})+"\n");
