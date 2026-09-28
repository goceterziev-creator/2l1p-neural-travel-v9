"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "github-git-object-evidence-adapter-v0.1.0";
const AUTHORITY = "NONE";
const REPOSITORY_IDENTITY = "goceterziev-creator/2l1p-neural-travel-v9";
const AUTHORITATIVE_REF = "refs/heads/main";

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function sha1(v){return typeof v==="string"&&/^[0-9a-f]{40}$/.test(v);}
function exact(v,fields){return plain(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every(k=>fields.includes(k));}
function digest(v){return "sha256:"+crypto.createHash("sha256").update(Buffer.from(JSON.stringify(v),"utf8")).digest("hex");}
function evidence(kind,material){return `gt63-github-git-object:${kind}:${digest(material).slice(7)}`;}
function requireRepository(repositoryIdentity){
  if(repositoryIdentity!==REPOSITORY_IDENTITY) throw new Error("cross-repository request rejected");
}
function requireTransport(transport){
  for(const name of ["resolveRef","readCommit","readTreeEntry","readBlob","listPathHistory"]){
    if(!transport||typeof transport[name]!=="function") throw new TypeError(`transport.${name} required`);
  }
}
function createGitHubGitObjectEvidenceAdapter({transport}={}){
  requireTransport(transport);

  function resolveRef(request){
    if(!exact(request,["repositoryIdentity","authoritativeRef"])) throw new Error("unsupported ref request");
    requireRepository(request.repositoryIdentity);
    if(request.authoritativeRef!==AUTHORITATIVE_REF) throw new Error("non-authoritative ref rejected");
    const raw=transport.resolveRef({repositoryIdentity:REPOSITORY_IDENTITY,authoritativeRef:AUTHORITATIVE_REF});
    if(!plain(raw)||!sha1(raw.commitSha)) throw new Error("invalid GitHub ref observation");
    return Object.freeze({repositoryIdentity:REPOSITORY_IDENTITY,authoritativeRef:AUTHORITATIVE_REF,
      commitSha:raw.commitSha,evidenceRef:evidence("ref",{ref:AUTHORITATIVE_REF,commitSha:raw.commitSha})});
  }

  function readCommit(request){
    if(!exact(request,["repositoryIdentity","commitSha"])) throw new Error("unsupported commit request");
    requireRepository(request.repositoryIdentity); if(!sha1(request.commitSha)) throw new Error("invalid commit sha");
    const raw=transport.readCommit({repositoryIdentity:REPOSITORY_IDENTITY,commitSha:request.commitSha});
    if(!plain(raw)||raw.commitSha!==request.commitSha||!sha1(raw.treeSha)) throw new Error("invalid GitHub commit observation");
    return Object.freeze({commitSha:request.commitSha,treeSha:raw.treeSha,
      evidenceRef:evidence("commit",{commitSha:request.commitSha,treeSha:raw.treeSha})});
  }

  function readTreeEntry(request){
    if(!exact(request,["repositoryIdentity","treeSha","path"])) throw new Error("unsupported tree request");
    requireRepository(request.repositoryIdentity); if(!sha1(request.treeSha)||!nonEmpty(request.path)) throw new Error("invalid tree request");
    const raw=transport.readTreeEntry({repositoryIdentity:REPOSITORY_IDENTITY,treeSha:request.treeSha,path:request.path});
    if(raw===null) return null;
    if(!plain(raw)||raw.treeSha!==request.treeSha||raw.path!==request.path||raw.mode!=="100644"
      ||raw.objectType!=="blob"||!sha1(raw.blobSha)) throw new Error("invalid GitHub tree observation");
    return Object.freeze({treeSha:raw.treeSha,path:raw.path,mode:raw.mode,objectType:raw.objectType,blobSha:raw.blobSha,
      evidenceRef:evidence("tree-entry",{treeSha:raw.treeSha,path:raw.path,mode:raw.mode,objectType:raw.objectType,blobSha:raw.blobSha})});
  }

  function readBlob(request){
    if(!exact(request,["repositoryIdentity","blobSha"])) throw new Error("unsupported blob request");
    requireRepository(request.repositoryIdentity); if(!sha1(request.blobSha)) throw new Error("invalid blob sha");
    const raw=transport.readBlob({repositoryIdentity:REPOSITORY_IDENTITY,blobSha:request.blobSha});
    if(!plain(raw)||raw.blobSha!==request.blobSha||!nonEmpty(raw.bytesBase64)) throw new Error("invalid GitHub blob observation");
    return Object.freeze({blobSha:raw.blobSha,bytesBase64:raw.bytesBase64,
      evidenceRef:evidence("blob",{blobSha:raw.blobSha,bytesBase64:raw.bytesBase64})});
  }

  function listPathHistory(request){
    if(!exact(request,["repositoryIdentity","authoritativeRef","currentCommitSha","path"])) throw new Error("unsupported history request");
    requireRepository(request.repositoryIdentity);
    if(request.authoritativeRef!==AUTHORITATIVE_REF||!sha1(request.currentCommitSha)||!nonEmpty(request.path)) throw new Error("invalid history request");
    const raw=transport.listPathHistory({repositoryIdentity:REPOSITORY_IDENTITY,authoritativeRef:AUTHORITATIVE_REF,
      currentCommitSha:request.currentCommitSha,path:request.path});
    if(!plain(raw)||!Array.isArray(raw.entries)) throw new Error("invalid GitHub history observation");
    const entries=raw.entries.map((x)=>{
      if(!plain(x)||!sha1(x.commitSha)||!sha1(x.treeSha)||!sha1(x.blobSha)) throw new Error("invalid GitHub history entry");
      return Object.freeze({commitSha:x.commitSha,treeSha:x.treeSha,blobSha:x.blobSha,
        evidenceRef:evidence("history-entry",{path:request.path,commitSha:x.commitSha,treeSha:x.treeSha,blobSha:x.blobSha})});
    });
    return Object.freeze({entries:Object.freeze(entries),
      evidenceRef:evidence("history",{ref:AUTHORITATIVE_REF,currentCommitSha:request.currentCommitSha,path:request.path,
        entries:entries.map(x=>({commitSha:x.commitSha,treeSha:x.treeSha,blobSha:x.blobSha}))})});
  }

  return Object.freeze({resolveRef,readCommit,readTreeEntry,readBlob,listPathHistory,
    rulesetVersion:RULESET_VERSION,authority:AUTHORITY});
}

module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,REPOSITORY_IDENTITY,AUTHORITATIVE_REF,
  createGitHubGitObjectEvidenceAdapter});
