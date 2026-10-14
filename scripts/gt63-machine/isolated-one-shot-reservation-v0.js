"use strict";
// Isolated one-shot reservation prototype. Not connected to runtime or Run #2.
// Atomic directory creation arbitrates a single local filesystem reservation.
// Never retries an uncertain effect or grants execution authority.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const HEX=/^[0-9a-f]{64}$/;
function createIsolatedOneShotReservationV0({directory}={}){
 if(typeof directory!=="string"||!path.isAbsolute(directory))throw new TypeError("absolute isolated directory required");
 function reserve({effectDigest}={}){
  if(typeof effectDigest!=="string"||!HEX.test(effectDigest))return Object.freeze({outcome:"DENIED",reason:"invalid effect digest",authority:"NONE",effectPerformed:false});
  const slot=path.join(directory,"reservation-"+effectDigest);
  // Parent must be pre-created by the test harness; never create runtime roots.
  if(!fs.existsSync(directory)||!fs.statSync(directory).isDirectory())return Object.freeze({outcome:"UNKNOWN",reason:"isolated directory unavailable",authority:"NONE",effectPerformed:false});
  try{
   fs.mkdirSync(slot);
   return Object.freeze({outcome:"RESERVED",reason:"atomic local directory claim",authority:"NONE",effectPerformed:false});
  }catch(e){
   if(e?.code==="EEXIST")return Object.freeze({outcome:"ALREADY_RESERVED",reason:"fail closed; effect state uncertain",authority:"NONE",effectPerformed:false});
   return Object.freeze({outcome:"UNKNOWN",reason:"reservation storage error",authority:"NONE",effectPerformed:false});
  }
 }
 return Object.freeze({reserve,authority:"NONE",executionAuthorized:false,effectPerformed:false});
}
module.exports=Object.freeze({createIsolatedOneShotReservationV0});
