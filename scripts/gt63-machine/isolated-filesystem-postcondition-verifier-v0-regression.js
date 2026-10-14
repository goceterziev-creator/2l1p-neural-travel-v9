"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {createIsolatedFilesystemPostconditionVerifierV0}=require("./isolated-filesystem-postcondition-verifier-v0");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"gt63-postcondition-"));
let cases=0;const test=(name,fn)=>{fn();cases++};
const bytes=Buffer.from("Hello from GT63","utf8"),digest=crypto.createHash("sha256").update(bytes).digest("hex");
try{
 const v=createIsolatedFilesystemPostconditionVerifierV0({rootPath:root});
 const req={relativeTargetPath:"sample.txt",expectedSha256:digest,expectedBytes:bytes.length};
 test("absent target unknown",()=>assert.equal(v.verify(req).outcome,"UNKNOWN"));
 fs.writeFileSync(path.join(root,"sample.txt"),bytes);
 test("exact bytes match but no authority",()=>{const r=v.verify(req);assert.equal(r.outcome,"MATCH");assert.equal(r.executionAuthorized,false);assert.equal(r.effectPerformed,false)});
 test("wrong digest mismatch",()=>assert.equal(v.verify({...req,expectedSha256:"a".repeat(64)}).outcome,"MISMATCH"));
 test("wrong size mismatch",()=>assert.equal(v.verify({...req,expectedBytes:bytes.length+1}).outcome,"MISMATCH"));
 test("parent traversal denied",()=>assert.equal(v.verify({...req,relativeTargetPath:"../sample.txt"}).outcome,"DENIED"));
 test("absolute path denied",()=>assert.equal(v.verify({...req,relativeTargetPath:path.join(root,"sample.txt")}).outcome,"DENIED"));
 test("invalid hash denied",()=>assert.equal(v.verify({...req,expectedSha256:"bad"}).outcome,"DENIED"));
 test("directory not file unknown",()=>{fs.mkdirSync(path.join(root,"folder"));assert.equal(v.verify({...req,relativeTargetPath:"folder"}).outcome,"UNKNOWN")});
 test("symlink target unknown",()=>{fs.symlinkSync(path.join(root,"sample.txt"),path.join(root,"alias"));assert.equal(v.verify({...req,relativeTargetPath:"alias"}).outcome,"UNKNOWN")});
 test("missing root unknown",()=>assert.equal(createIsolatedFilesystemPostconditionVerifierV0({rootPath:path.join(root,"absent")}).verify(req).outcome,"UNKNOWN"));
 console.log(JSON.stringify({status:"PASS",cases,scope:"ISOLATED_READ_ONLY_POSTCONDITION",effectPerformed:false}));
}finally{fs.rmSync(root,{recursive:true,force:true})}
