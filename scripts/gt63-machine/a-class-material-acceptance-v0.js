"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "a-class-material-acceptance-v0.1.0";
const OUTCOMES = Object.freeze({
  ACCEPTED: "A_CLASS_MATERIAL_ACCEPTED",
  ALREADY_ACCEPTED: "A_CLASS_MATERIAL_ALREADY_ACCEPTED",
  REJECTED: "A_CLASS_MATERIAL_REJECTED",
  STALE: "A_CLASS_MATERIAL_STALE",
  UNCERTAIN: "A_CLASS_MATERIAL_UNCERTAIN",
  CONFLICT: "A_CLASS_MATERIAL_CONFLICT"
});

function plain(v) { return Boolean(v && typeof v === "object" && !Array.isArray(v)); }
function nonEmpty(v) { return typeof v === "string" && v.length > 0; }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function freeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) freeze(x);
  }
  return v;
}
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (plain(v)) return Object.keys(v).sort().reduce((o,k)=>{ o[k]=canonical(v[k]); return o; },{});
  return v;
}
function canonicalStringify(v) { return JSON.stringify(canonical(v)); }
function sha256(s) { return "sha256:"+crypto.createHash("sha256").update(s).digest("hex"); }
function result(outcome, reason=null, acceptance=null) {
  return freeze({ outcome, reason, acceptance: clone(acceptance), authorityEffect:"NONE" });
}

function createAClassMaterialAcceptance({ evidenceSnapshotPort, sourceBindingAssessmentPort, acceptanceLedger } = {}) {
  if (typeof evidenceSnapshotPort !== "function") throw new TypeError("evidenceSnapshotPort must be a function");
  if (typeof sourceBindingAssessmentPort !== "function") throw new TypeError("sourceBindingAssessmentPort must be a function");
  for (const name of ["findByEvidenceIdentity","commit"]) {
    if (!acceptanceLedger || typeof acceptanceLedger[name] !== "function") throw new TypeError("acceptanceLedger."+name+" must be a function");
  }

  function accept(request) {
    const fields=["rulesetVersion","evidenceIdentity","expectedEvidenceRevision","expectedSourceBindingAssessmentIdentity"];
    if (!plain(request) || Object.keys(request).sort().join("|") !== fields.sort().join("|")
      || request.rulesetVersion !== RULESET_VERSION
      || !nonEmpty(request.evidenceIdentity)
      || request.expectedEvidenceRevision !== 1
      || !nonEmpty(request.expectedSourceBindingAssessmentIdentity)) {
      return result(OUTCOMES.REJECTED,"unsupported request schema");
    }

    let evidence;
    try { evidence=evidenceSnapshotPort({evidenceIdentity:request.evidenceIdentity}); }
    catch (_) { return result(OUTCOMES.UNCERTAIN,"evidence snapshot unavailable"); }

    if (!plain(evidence)
      || evidence.evidenceIdentity !== request.evidenceIdentity
      || evidence.evidenceRevision !== 1
      || evidence.evidenceClass !== "ACCOUNT_AUTHENTICATION_EVIDENCE"
      || evidence.authenticationMethod !== "PASSWORD"
      || evidence.authenticationResult !== "SUCCESS"
      || !plain(evidence.byteIdentity)
      || evidence.byteIdentity.byteLength !== 2035
      || evidence.byteIdentity.sha256 !== "700b2fb7b8b8cc38a42ca4f8a24be4b9aadb13f3bf4c1cec094fca59b62a9162") {
      return result(OUTCOMES.REJECTED,"exact A-class material does not match accepted subject contract");
    }

    let binding;
    try { binding=sourceBindingAssessmentPort({evidenceIdentity:evidence.evidenceIdentity}); }
    catch (_) { return result(OUTCOMES.UNCERTAIN,"source binding assessment unavailable"); }

    if (!plain(binding)
      || binding.assessmentIdentity !== request.expectedSourceBindingAssessmentIdentity
      || binding.sourceBindingState !== "SOURCE_BOUND"
      || binding.authorityEffect !== "NONE") {
      return result(OUTCOMES.UNCERTAIN,"exact positive source binding not established");
    }

    if (binding.evidenceRefs && Array.isArray(binding.evidenceRefs)
      && !binding.evidenceRefs.includes(evidence.evidenceIdentity)) {
      return result(OUTCOMES.CONFLICT,"source binding assessment is not evidence-specific");
    }

    let historical;
    try { historical=acceptanceLedger.findByEvidenceIdentity(evidence.evidenceIdentity); }
    catch (_) { return result(OUTCOMES.UNCERTAIN,"acceptance ledger unavailable"); }
    if (!Array.isArray(historical)) return result(OUTCOMES.UNCERTAIN,"acceptance ledger invalid");
    if (historical.length > 1) return result(OUTCOMES.CONFLICT,"multiple acceptance records for evidence identity");

    const material={
      type:"GT63_A_CLASS_MATERIAL_ACCEPTANCE",
      rulesetVersion:RULESET_VERSION,
      evidenceIdentity:evidence.evidenceIdentity,
      evidenceRevision:evidence.evidenceRevision,
      evidenceClass:evidence.evidenceClass,
      exactByteLength:evidence.byteIdentity.byteLength,
      exactByteDigest:evidence.byteIdentity.sha256,
      sourceBindingAssessmentIdentity:binding.assessmentIdentity,
      sourceBindingState:binding.sourceBindingState,
      acceptanceState:"ACCEPTED",
      authorityEffect:"NONE",
      nonClaims:{
        authenticatedHumanPrincipal:false,
        principalEligibility:false,
        roleAssignment:false,
        delegation:false,
        capabilityAuthorization:false,
        filesystemEffectAuthority:false,
        machineAuthority:false
      }
    };
    const acceptanceId="gt63-acceptance:a-class:"+sha256(canonicalStringify(material)).slice(7);
    const acceptance=freeze({acceptanceId,...material});

    if (historical.length===1) {
      return canonicalStringify(historical[0])===canonicalStringify(acceptance)
        ? result(OUTCOMES.ALREADY_ACCEPTED,"same exact material already accepted",historical[0])
        : result(OUTCOMES.CONFLICT,"evidence identity already accepted with different material");
    }

    let committed;
    try { committed=acceptanceLedger.commit(acceptance); }
    catch (_) { return result(OUTCOMES.CONFLICT,"acceptance ledger commit conflict"); }
    if (!committed || canonicalStringify(committed)!==canonicalStringify(acceptance)) {
      return result(OUTCOMES.CONFLICT,"acceptance ledger returned conflicting material");
    }
    return result(OUTCOMES.ACCEPTED,null,committed);
  }

  return freeze({accept,rulesetVersion:RULESET_VERSION,authorityEffect:"NONE"});
}

module.exports=Object.freeze({RULESET_VERSION,OUTCOMES,createAClassMaterialAcceptance});
