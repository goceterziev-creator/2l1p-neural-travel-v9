"use strict";
// Recovery is observation only. Never release a reservation, retry or perform an effect.
const fs=require("node:fs"),path=require("node:path");
const HEX=/^[0-9a-f]{64}$/;
const result=(outcome,reason)=>Object.freeze({outcome,reason,authority:"NONE",executionAuthorized:false,retryAuthorized:false,effectPerformed:false});
function createIsolatedReservationRecoveryV0({directory}={}){
 if(typeof directory!=="string"||!path.isAbsolute(directory))throw new TypeError("absolute isolated directory required");
 function inspect({effectDigest}={}){
  if(typeof effectDigest!=="string"||!HEX.test(effectDigest))return result("DENIED","invalid effect digest");
  const slot=path.join(directory,"reservation-"+effectDigest);
  try{
   const parent=fs.lstatSync(directory);
   if(!parent.isDirectory()||parent.isSymbolicLink())return result("UNKNOWN","unsafe reservation parent");
   const entry=fs.lstatSync(slot);
   if(!entry.isDirectory()||entry.isSymbolicLink())return result("UNKNOWN","reservation slot not a plain directory");
   return result("EFFECT_UNCERTAIN","reservation exists; external effect not inferred");
  }catch(e){
   if(e?.code==="ENOENT")return result("UNKNOWN","reservation not observable; no retry authority");
   return result("UNKNOWN","reservation observation failed");
  }
 }
 return Object.freeze({inspect,authority:"NONE",executionAuthorized:false,retryAuthorized:false,effectPerformed:false});
}
module.exports=Object.freeze({createIsolatedReservationRecoveryV0});
