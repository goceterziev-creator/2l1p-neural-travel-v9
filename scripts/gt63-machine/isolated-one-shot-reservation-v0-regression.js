"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const {createIsolatedOneShotReservationV0}=require("./isolated-one-shot-reservation-v0");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"gt63-reservation-test-"));
const digest="a".repeat(64);let cases=0;
const test=(label,fn)=>{fn();cases++};
try{
 const r=createIsolatedOneShotReservationV0({directory:root});
 test("invalid digest denied",()=>assert.equal(r.reserve({effectDigest:"../escape"}).outcome,"DENIED"));
 test("first reservation succeeds",()=>assert.equal(r.reserve({effectDigest:digest}).outcome,"RESERVED"));
 test("same process duplicate blocked",()=>assert.equal(r.reserve({effectDigest:digest}).outcome,"ALREADY_RESERVED"));
 test("restart/new adapter duplicate blocked",()=>assert.equal(createIsolatedOneShotReservationV0({directory:root}).reserve({effectDigest:digest}).outcome,"ALREADY_RESERVED"));
 test("separate process duplicate blocked",()=>{
  const script='const {createIsolatedOneShotReservationV0}=require(process.argv[1]);process.stdout.write(createIsolatedOneShotReservationV0({directory:process.argv[2]}).reserve({effectDigest:process.argv[3]}).outcome)';
  const child=spawnSync(process.execPath,["-e",script,require.resolve("./isolated-one-shot-reservation-v0"),root,digest],{encoding:"utf8"});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,"ALREADY_RESERVED");
 });
 test("uncertain reservation never automatically released",()=>assert.equal(fs.existsSync(path.join(root,"reservation-"+digest)),true));
 test("different digest independent",()=>assert.equal(r.reserve({effectDigest:"b".repeat(64)}).outcome,"RESERVED"));
 console.log(JSON.stringify({status:"PASS",cases,scope:"ISOLATED_LOCAL_FILESYSTEM_RESERVATION_ONLY",effectPerformed:false}));
}finally{fs.rmSync(root,{recursive:true,force:true})}
