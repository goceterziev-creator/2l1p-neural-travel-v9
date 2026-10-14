"use strict";
// Read-only post-interruption observation. Never infers authorization from matching bytes.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const HASH=/^[0-9a-f]{64}$/;
const result=(outcome,reason,observedDigest=null)=>Object.freeze({outcome,reason,observedDigest,authority:"NONE",executionAuthorized:false,retryAuthorized:false,effectPerformed:false});
function createIsolatedFilesystemPostconditionVerifierV0({rootPath}={}){
 if(typeof rootPath!=="string"||!path.isAbsolute(rootPath))throw new TypeError("absolute rootPath required");
 function verify({relativeTargetPath,expectedSha256,expectedBytes}={}){
  if(typeof relativeTargetPath!=="string"||!relativeTargetPath||path.isAbsolute(relativeTargetPath)||relativeTargetPath.includes("\\")||
    relativeTargetPath.split("/").some(x=>!x||x==="."||x==="..")||
    typeof expectedSha256!=="string"||!HASH.test(expectedSha256)||
    !Number.isSafeInteger(expectedBytes)||expectedBytes<0)
   return result("DENIED","invalid exact postcondition request");
  const target=path.resolve(rootPath,relativeTargetPath);
  if(!target.startsWith(rootPath+path.sep))return result("DENIED","target escapes root");
  try{
   const root=fs.lstatSync(rootPath);
   if(!root.isDirectory()||root.isSymbolicLink())return result("UNKNOWN","unsafe root");
   let cursor=rootPath;
   for(const part of relativeTargetPath.split("/").slice(0,-1)){
    cursor=path.join(cursor,part);
    const s=fs.lstatSync(cursor);
    if(!s.isDirectory()||s.isSymbolicLink())return result("UNKNOWN","unsafe parent");
   }
   const stat=fs.lstatSync(target);
   if(!stat.isFile()||stat.isSymbolicLink())return result("UNKNOWN","target not a regular file");
   // O_NOFOLLOW limits final-component symlink races; identity checked before and after reading.
   const fd=fs.openSync(target,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
   try{
    const before=fs.fstatSync(fd);
    if(!before.isFile()||before.dev!==stat.dev||before.ino!==stat.ino)return result("UNKNOWN","target changed during open");
    const hash=crypto.createHash("sha256"),buffer=Buffer.allocUnsafe(65536);
    let bytes=0,n;
    while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0){
     bytes+=n;if(bytes>expectedBytes)return result("MISMATCH","byte length differs");
     hash.update(buffer.subarray(0,n));
    }
    const after=fs.fstatSync(fd);
    if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)return result("UNKNOWN","target changed during read");
    const observedDigest=hash.digest("hex");
    return bytes===expectedBytes&&observedDigest===expectedSha256
     ?result("MATCH","observed bytes match expected postcondition; no execution provenance inferred",observedDigest)
     :result("MISMATCH","observed bytes differ",observedDigest);
   }finally{fs.closeSync(fd)}
  }catch(e){return result("UNKNOWN",e?.code==="ENOENT"?"target or parent absent":"observation unavailable")}
 }
 return Object.freeze({verify,authority:"NONE",executionAuthorized:false,retryAuthorized:false,effectPerformed:false});
}
module.exports=Object.freeze({createIsolatedFilesystemPostconditionVerifierV0});
