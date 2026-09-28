"use strict";

const REPOSITORY_IDENTITY="goceterziev-creator/2l1p-neural-travel-v9";
const AUTHORITATIVE_REF="refs/heads/main";
const API_VERSION="2026-03-10";
const AUTHORITY="NONE";

function plain(v){return Boolean(v&&typeof v==="object"&&!Array.isArray(v));}
function nonEmpty(v){return typeof v==="string"&&v.length>0;}
function sha1(v){return typeof v==="string"&&/^[0-9a-f]{40}$/.test(v);}
function exactRepo(v){if(v!==REPOSITORY_IDENTITY)throw new Error("cross-repository request rejected");}
function enc(v){return encodeURIComponent(v);}
function createGitHubRestGitObjectTransport({request,token=""}={}){
 if(typeof request!=="function")throw new TypeError("request required");
 const headers=()=>Object.freeze({
  Accept:"application/vnd.github+json",
  "X-GitHub-Api-Version":API_VERSION,
  ...(nonEmpty(token)?{Authorization:`Bearer ${token}`}:{})
 });
 function get(path,query={}){
  const r=request(Object.freeze({method:"GET",path,query:Object.freeze({...query}),headers:headers()}));
  if(!plain(r)||r.status!==200)throw new Error("GitHub read unavailable");
  return r.body;
 }
 function resolveRef({repositoryIdentity,authoritativeRef}){
  exactRepo(repositoryIdentity);
  if(authoritativeRef!==AUTHORITATIVE_REF)throw new Error("non-authoritative ref rejected");
  const b=get("/repos/goceterziev-creator/2l1p-neural-travel-v9/git/ref/heads/main");
  if(!plain(b)||b.ref!==AUTHORITATIVE_REF||!plain(b.object)||b.object.type!=="commit"||!sha1(b.object.sha))throw new Error("invalid GitHub ref response");
  return {commitSha:b.object.sha};
 }
 function readCommit({repositoryIdentity,commitSha}){
  exactRepo(repositoryIdentity);if(!sha1(commitSha))throw new Error("invalid commit sha");
  const b=get(`/repos/goceterziev-creator/2l1p-neural-travel-v9/git/commits/${commitSha}`);
  if(!plain(b)||b.sha!==commitSha||!plain(b.tree)||!sha1(b.tree.sha))throw new Error("invalid GitHub commit response");
  return {commitSha,treeSha:b.tree.sha};
 }
 function tree(treeSha){
  const b=get(`/repos/goceterziev-creator/2l1p-neural-travel-v9/git/trees/${treeSha}`,{recursive:"1"});
  if(!plain(b)||b.sha!==treeSha||b.truncated===true||!Array.isArray(b.tree))throw new Error("invalid or truncated GitHub tree response");
  return b.tree;
 }
 function readTreeEntry({repositoryIdentity,treeSha,path}){
  exactRepo(repositoryIdentity);if(!sha1(treeSha)||!nonEmpty(path))throw new Error("invalid tree request");
  const matches=tree(treeSha).filter(x=>plain(x)&&x.path===path);
  if(matches.length===0)return null;
  if(matches.length!==1)throw new Error("ambiguous GitHub tree response");
  const x=matches[0];
  if(x.mode!=="100644"||x.type!=="blob"||!sha1(x.sha))throw new Error("unsupported GitHub tree entry");
  return {treeSha,path,mode:x.mode,objectType:x.type,blobSha:x.sha};
 }
 function readBlob({repositoryIdentity,blobSha}){
  exactRepo(repositoryIdentity);if(!sha1(blobSha))throw new Error("invalid blob sha");
  const b=get(`/repos/goceterziev-creator/2l1p-neural-travel-v9/git/blobs/${blobSha}`);
  if(!plain(b)||b.sha!==blobSha||b.encoding!=="base64"||!nonEmpty(b.content))throw new Error("invalid GitHub blob response");
  return {blobSha,bytesBase64:b.content.replace(/\n/g,"")};
 }
 function listPathHistory({repositoryIdentity,authoritativeRef,currentCommitSha,path}){
  exactRepo(repositoryIdentity);
  if(authoritativeRef!==AUTHORITATIVE_REF||!sha1(currentCommitSha)||!nonEmpty(path))throw new Error("invalid history request");
  const all=[];let page=1;
  while(true){
   const b=get("/repos/goceterziev-creator/2l1p-neural-travel-v9/commits",{sha:currentCommitSha,path,per_page:100,page});
   if(!Array.isArray(b))throw new Error("invalid GitHub history response");
   all.push(...b);if(b.length<100)break;
   page+=1;if(page>100)throw new Error("GitHub history pagination bound exceeded");
  }
  const entries=[];
  for(const c of all){
   if(!plain(c)||!sha1(c.sha)||!plain(c.commit)||!plain(c.commit.tree)||!sha1(c.commit.tree.sha))throw new Error("invalid GitHub history commit");
   const e=readTreeEntry({repositoryIdentity,treeSha:c.commit.tree.sha,path});
   if(e)entries.push({commitSha:c.sha,treeSha:c.commit.tree.sha,blobSha:e.blobSha});
  }
  return {entries};
 }
 return Object.freeze({resolveRef,readCommit,readTreeEntry,readBlob,listPathHistory,authority:AUTHORITY});
}
module.exports=Object.freeze({REPOSITORY_IDENTITY,AUTHORITATIVE_REF,API_VERSION,AUTHORITY,createGitHubRestGitObjectTransport});
