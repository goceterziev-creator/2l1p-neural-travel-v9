"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");
const {createIsolatedOneShotReservationV0}=require("./isolated-one-shot-reservation-v0");
const {createIsolatedRecoveryPostconditionReviewV0}=require("./isolated-recovery-postcondition-review-v0");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"gt63-review-chain-"));
const reservations=path.join(root,"reservations"),targets=path.join(root,"targets");
fs.mkdirSync(reservations);fs.mkdirSync(targets);
const digest="e".repeat(64),payload=Buffer.from("GT63 isolated fixture\n"),hash=crypto.createHash("sha256").update(payload).digest("hex");
const req={effectDigest:digest,relativeTargetPath:"fixture.txt",expectedSha256:hash,expectedBytes:payload.length};
const reserve=createIsolatedOneShotReservationV0({directory:reservations});
const review=()=>createIsolatedRecoveryPostconditionReviewV0({reservationDirectory:reservations,rootPath:targets}).review(req);
let count=0;const test=(name,fn)=>{fn();count++};
try{
 test("unreserved cannot infer postcondition",()=>{const r=review();assert.equal(r.outcome,"UNKNOWN");assert.equal(r.postconditionOutcome,"NOT_OBSERVED")});
 test("reserve only",()=>assert.equal(reserve.reserve({effectDigest:digest}).outcome,"RESERVED"));
 test("reserved but target absent requires review",()=>{const r=review();assert.equal(r.outcome,"REVIEW_REQUIRED");assert.equal(r.postconditionOutcome,"UNKNOWN");assert.equal(r.retryAuthorized,false)});
 test("duplicate remains blocked",()=>assert.equal(reserve.reserve({effectDigest:digest}).outcome,"ALREADY_RESERVED"));
 test("separate process observes uncertain state",()=>{
  const script='const {createIsolatedRecoveryPostconditionReviewV0}=require(process.argv[1]);const r=createIsolatedRecoveryPostconditionReviewV0({reservationDirectory:process.argv[2],rootPath:process.argv[3]}).review(JSON.parse(process.argv[4]));process.stdout.write(JSON.stringify(r))';
  const child=spawnSync(process.execPath,["-e",script,require.resolve("./isolated-recovery-postcondition-review-v0"),reservations,targets,JSON.stringify(req)],{encoding:"utf8"});
  assert.equal(child.status,0,child.stderr);const r=JSON.parse(child.stdout);assert.equal(r.outcome,"REVIEW_REQUIRED");assert.equal(r.postconditionOutcome,"UNKNOWN");
 });
 // Fixture is created by the test harness, NOT by the governed writer.
 fs.writeFileSync(path.join(targets,"fixture.txt"),payload);
 test("matching fixture is not proof of execution",()=>{const r=review();assert.equal(r.postconditionOutcome,"MATCH");assert.equal(r.outcome,"REVIEW_REQUIRED");assert.equal(r.executionAuthorized,false);assert.equal(r.effectPerformed,false)});
 test("mismatching fixture requires review",()=>{fs.writeFileSync(path.join(targets,"fixture.txt"),"different");const r=review();assert.equal(r.postconditionOutcome,"MISMATCH");assert.equal(r.retryAuthorized,false)});
 test("invalid effect identity cannot observe",()=>{const r=createIsolatedRecoveryPostconditionReviewV0({reservationDirectory:reservations,rootPath:targets}).review({...req,effectDigest:"invalid"});assert.equal(r.outcome,"UNKNOWN");assert.equal(r.postconditionOutcome,"NOT_OBSERVED")});
 console.log(JSON.stringify({status:"PASS",cases:count,scope:"ISOLATED_RECOVERY_POSTCONDITION_COMPOSITION",effectPerformed:false}));
}finally{fs.rmSync(root,{recursive:true,force:true})}
