"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="repeatable-filesystem-effect-material-v0.1.0";
const AUTHORITY="NONE";
function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(plain(v))return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});return v;}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(JSON.stringify(canonical(v)),"utf8")).digest("hex");}
function strictBase64(s){if(!nonEmpty(s)||s.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))return null;const b=Buffer.from(s,"base64");return b.toString("base64")===s?b:null;}
function safeRelative(p){return nonEmpty(p)&&!/^([A-Za-z]:[\\/]|[\\/])/.test(p)&&!p.split(/[\\/]+/).some(x=>x==="..");}
function result(state,reason=null,material=null){return Object.freeze({state,reason,material,authority:AUTHORITY,authorityEffect:"NONE",effectAuthorized:false,effectPerformed:false});}
function validateRepeatableFilesystemEffectMaterialV0(input){
 if(!plain(input)||Object.keys(input).sort().join("|")!==["authorizedRootIdentity","operation","payload","target"].sort().join("|"))return result("INVALID","unsupported material schema");
 if(input.operation!=="CREATE_NEW_FILE"||!nonEmpty(input.authorizedRootIdentity)||!plain(input.target)||input.target.kind!=="RELATIVE_FILE"||!safeRelative(input.target.path)||!plain(input.payload)||input.payload.encoding!=="UTF-8")return result("INVALID","unsupported or widened effect semantics");
 const bytes=strictBase64(input.payload.bytesBase64);if(!bytes)return result("INVALID","payload bytes invalid");
 const semantics={operation:"CREATE_NEW_FILE",authorizedRootIdentity:input.authorizedRootIdentity,target:{kind:"RELATIVE_FILE",path:input.target.path},payload:{encoding:"UTF-8",bytesBase64:input.payload.bytesBase64},precondition:{mustNotExist:true},expectedPostcondition:{fileExists:true,contentDigest:"sha256:"+crypto.createHash("sha256").update(bytes).digest("hex")}};
 const effectContractDigest=digest(semantics);
 const effectContractId="gt63-effect:repeatable-filesystem:"+effectContractDigest.slice(7);
 const material=Object.freeze({type:"GT63_REPEATABLE_FILESYSTEM_EFFECT_MATERIAL",schemaVersion:"1.0",rulesetVersion:RULESET_VERSION,effectContractId,effectContractDigest,...semantics,materialState:"VALIDATED_NOT_AUTHORIZED",authority:AUTHORITY,authorityEffect:"NONE",effectAuthorized:false,effectPerformed:false});
 return result("VALID",null,material);
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,validateRepeatableFilesystemEffectMaterialV0});
