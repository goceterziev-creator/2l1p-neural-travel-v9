"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createIsolatedOneShotReservationV0}=require("./isolated-one-shot-reservation-v0");
const {createIsolatedReservationRecoveryV0}=require("./isolated-one-shot-recovery-v0");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"gt63-recovery-test-"));let cases=0;
const test=(label,fn)=>{fn();cases++};
const digest="c".repeat(64);
try{
 const reserve=createIsolatedOneShotReservationV0({directory:root});
 const recover=createIsolatedReservationRecoveryV0({directory:root});
 test("missing slot fail closed",()=>assert.equal(recover.inspect({effectDigest:digest}).outcome,"UNKNOWN"));
 test("invalid digest denied",()=>assert.equal(recover.inspect({effectDigest:"../../"}).outcome,"DENIED"));
 test("initial reservation",()=>assert.equal(reserve.reserve({effectDigest:digest}).outcome,"RESERVED"));
 test("recovery reports uncertain, not performed",()=>{const r=recover.inspect({effectDigest:digest});assert.equal(r.outcome,"EFFECT_UNCERTAIN");assert.equal(r.effectPerformed,false);assert.equal(r.retryAuthorized,false)});
 test("re-instantiated recovery remains uncertain",()=>assert.equal(createIsolatedReservationRecoveryV0({directory:root}).inspect({effectDigest:digest}).outcome,"EFFECT_UNCERTAIN"));
 test("duplicate after recovery remains blocked",()=>assert.equal(reserve.reserve({effectDigest:digest}).outcome,"ALREADY_RESERVED"));
 test("unexpected regular file fail closed",()=>{const other="d".repeat(64);fs.writeFileSync(path.join(root,"reservation-"+other),"x");assert.equal(recover.inspect({effectDigest:other}).outcome,"UNKNOWN")});
 test("missing parent fail closed",()=>assert.equal(createIsolatedReservationRecoveryV0({directory:path.join(root,"absent")}).inspect({effectDigest:digest}).outcome,"UNKNOWN"));
 console.log(JSON.stringify({status:"PASS",cases,scope:"ISOLATED_READ_ONLY_RECOVERY",effectPerformed:false}));
}finally{fs.rmSync(root,{recursive:true,force:true})}
