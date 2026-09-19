"use strict";
const fs=require("node:fs"),path=require("node:path");
const RULESET_VERSION="repeatable-filesystem-readonly-evidence-provider-v0.1.0",AUTHORITY="NONE";
const plain=v=>Boolean(v&&typeof v==="object"&&!Array.isArray(v)),nonEmpty=v=>typeof v==="string"&&v.length>0;
function isAbsoluteLike(p){return /^[A-Za-z]:[\\/]/.test(p)||p.startsWith("/")||p.startsWith("\\");}
function hasTraversal(p){return p.split(/[\\/]+/).some(x=>x==="..");}
function strictDescendant(root,target){if(!nonEmpty(root)||!nonEmpty(target)||isAbsoluteLike(target)||hasTraversal(target))return false;const rel=path.relative(path.resolve(root),path.resolve(root,target));return Boolean(rel)&&!path.isAbsolute(rel)&&rel!==".."&&!rel.startsWith(".."+path.sep);}
function freeze(v){if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function createRepeatableFilesystemReadonlyEvidenceProviderV0({rootBindings}={}){
 if(!plain(rootBindings))throw new TypeError("rootBindings required");
 const bindings=Object.freeze({...rootBindings});
 function rootRegistryPort({authorizedRootIdentity}={}){
  const rootPath=bindings[authorizedRootIdentity];
  if(!nonEmpty(authorizedRootIdentity)||!nonEmpty(rootPath))throw new Error("authorized root identity unavailable");
  return freeze({authorizedRootIdentity,rootPath:path.resolve(rootPath),lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY,authorityEffect:"NONE"});
 }
 function filesystemObservationPort({rootPath,targetPath}={}){
  if(!nonEmpty(rootPath)||!nonEmpty(targetPath)||!strictDescendant(rootPath,targetPath))throw new Error("invalid root/target observation request");
  const resolvedRoot=path.resolve(rootPath),targetAbs=path.resolve(resolvedRoot,targetPath);
  let rootExists=false,rootIsDirectory=false,targetExists=false;
  try{const s=fs.statSync(resolvedRoot);rootExists=true;rootIsDirectory=s.isDirectory();}catch(e){if(e.code!=="ENOENT")throw e;}
  try{fs.lstatSync(targetAbs);targetExists=true;}catch(e){if(e.code!=="ENOENT")throw e;}
  return freeze({rootPath:resolvedRoot,rootExists,rootIsDirectory,targetPath,targetExists,observationState:"CURRENT",contradictionState:"NONE",authority:AUTHORITY,authorityEffect:"NONE"});
 }
 return freeze({rootRegistryPort,filesystemObservationPort,rulesetVersion:RULESET_VERSION,authority:AUTHORITY,capability:"READ_ONLY_FILESYSTEM_EVIDENCE"});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,strictDescendant,createRepeatableFilesystemReadonlyEvidenceProviderV0});
