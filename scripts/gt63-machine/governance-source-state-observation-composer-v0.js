"use strict";
const crypto=require("node:crypto");
const RULESET_VERSION="governance-source-state-observation-composer-v0.1.0";
const AUTHORITY="NONE";
const REPOSITORY_IDENTITY="goceterziev-creator/2l1p-neural-travel-v9";
const AUTHORITATIVE_REF="refs/heads/main";
const ROOT_PATH="config/gt63-machine/governance-trust-root-v0.json";
function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function exact(v,f){return plain(v)&&Object.keys(v).length===f.length&&Object.keys(v).every(k=>f.includes(k));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function sha1(v){return typeof v==="string"&&/^[0-9a-f]{40}$/.test(v);}
function compare(a,b){const x=Array.from(String(a)),y=Array.from(String(b));for(let i=0;i<Math.min(x.length,y.length);i++){const d=x[i].codePointAt(0)-y[i].codePointAt(0);if(d)return d;}return x.length-y.length;}
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(plain(v))return Object.keys(v).sort(compare).reduce((o,raw)=>{const k=raw.normalize("NFC");if(Object.hasOwn(o,k))throw new TypeError("canonical key conflict");o[k]=canonicalize(v[raw]);return o;},{});return typeof v==="string"?v.normalize("NFC"):v;}
const canonicalStringify=v=>JSON.stringify(canonicalize(v));
const sha256=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
function strictBase64(v){if(!nonEmpty(v)||v.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(v))return null;const b=Buffer.from(v,"base64");return b.toString("base64")===v?b:null;}
function gitBlobSha(bytes){const h=Buffer.from(`blob ${bytes.length}\0`,"utf8");return crypto.createHash("sha1").update(h).update(bytes).digest("hex");}
function parseCanonicalRoot(bytes){if(!Buffer.isBuffer(bytes))throw new Error("root bytes unavailable");const text=bytes.toString("utf8");if(!Buffer.from(text,"utf8").equals(bytes))throw new Error("root bytes invalid UTF-8");let m;try{m=JSON.parse(text);}catch(_){throw new Error("root JSON malformed");}const canonical=canonicalStringify(m)+"\n";if(!Buffer.from(canonical,"utf8").equals(bytes))throw new Error("root JSON noncanonical");return m;}
function createGovernanceSourceStateObservationComposer({gitObjectPort}={}){
 for(const n of ["resolveRef","readCommit","readTreeEntry","readBlob"])if(!gitObjectPort||typeof gitObjectPort[n]!=="function")throw new TypeError(`gitObjectPort.${n} required`);
 function observe(){
  const ref=gitObjectPort.resolveRef({repositoryIdentity:REPOSITORY_IDENTITY,authoritativeRef:AUTHORITATIVE_REF});
  if(!exact(ref,["repositoryIdentity","authoritativeRef","commitSha","evidenceRef"])||ref.repositoryIdentity!==REPOSITORY_IDENTITY||ref.authoritativeRef!==AUTHORITATIVE_REF||!sha1(ref.commitSha)||!nonEmpty(ref.evidenceRef))throw new Error("invalid ref observation");
  const commit=gitObjectPort.readCommit({repositoryIdentity:REPOSITORY_IDENTITY,commitSha:ref.commitSha});
  if(!exact(commit,["commitSha","treeSha","evidenceRef"])||commit.commitSha!==ref.commitSha||!sha1(commit.treeSha)||!nonEmpty(commit.evidenceRef))throw new Error("invalid commit observation");
  const entry=gitObjectPort.readTreeEntry({repositoryIdentity:REPOSITORY_IDENTITY,treeSha:commit.treeSha,path:ROOT_PATH});
  if(!exact(entry,["treeSha","path","mode","objectType","blobSha","evidenceRef"])||entry.treeSha!==commit.treeSha||entry.path!==ROOT_PATH||entry.mode!=="100644"||entry.objectType!=="blob"||!sha1(entry.blobSha)||!nonEmpty(entry.evidenceRef))throw new Error("invalid root tree observation");
  const blob=gitObjectPort.readBlob({repositoryIdentity:REPOSITORY_IDENTITY,blobSha:entry.blobSha});
  if(!exact(blob,["blobSha","bytesBase64","evidenceRef"])||blob.blobSha!==entry.blobSha||!nonEmpty(blob.evidenceRef))throw new Error("invalid root blob observation");
  const bytes=strictBase64(blob.bytesBase64);if(!bytes||gitBlobSha(bytes)!==entry.blobSha)throw new Error("root blob identity mismatch");
  const manifest=parseCanonicalRoot(bytes);
  if(!plain(manifest)||manifest.type!=="REPOSITORY_FROZEN_GOVERNANCE_TRUST_ROOT"||manifest.repositoryIdentity!==REPOSITORY_IDENTITY||manifest.authoritativeRef!==AUTHORITATIVE_REF||manifest.authority!==AUTHORITY)throw new Error("root material outside bounded observation contract");
  const rootAnchorId=sha256(Buffer.from(canonicalStringify(manifest),"utf8"));
  const evidenceRefs=[ref.evidenceRef,commit.evidenceRef,entry.evidenceRef,blob.evidenceRef];
  if(new Set(evidenceRefs).size!==evidenceRefs.length)throw new Error("observation evidence identity conflict");
  return Object.freeze({type:"GT63_CANDIDATE_GOVERNANCE_SOURCE_STATE_OBSERVATION",repositoryIdentity:REPOSITORY_IDENTITY,authoritativeRef:AUTHORITATIVE_REF,commitSha:ref.commitSha,treeSha:commit.treeSha,rootPath:ROOT_PATH,rootBlobSha:entry.blobSha,rootAnchorId,observationEvidenceRefs:Object.freeze(evidenceRefs.slice().sort(compare)),authority:AUTHORITY});
 }
 return Object.freeze({observe,rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,REPOSITORY_IDENTITY,AUTHORITATIVE_REF,ROOT_PATH,createGovernanceSourceStateObservationComposer});
