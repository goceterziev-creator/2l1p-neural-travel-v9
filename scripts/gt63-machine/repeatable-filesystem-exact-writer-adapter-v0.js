"use strict";
// Candidate only. Not wired to MACHINE, not an authority issuer.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const OUTCOMES = Object.freeze({PERFORMED:"PERFORMED",DENIED:"DENIED",UNKNOWN:"UNKNOWN",CONFLICT:"CONFLICT"});
const hex = b => crypto.createHash("sha256").update(b).digest("hex");
const nonempty = x => typeof x === "string" && x.length > 0;
function safeRelative(p) {
  return nonempty(p) && !path.isAbsolute(p) && !/^[a-z]:/i.test(p)
    && !p.startsWith("\\\\") && p.split(/[\\/]/).every(x => x !== ".." && x !== "" && x !== ".");
}
function result(outcome, reason, evidence = null) {
  return Object.freeze({outcome, reason, evidence, authority:"NONE", authorityEffect:"NONE",
    additionalEffectAuthorized:false});
}
function createExactCreateNewFileAdapterV0({currentAuthorizationPort, currentMachineStartPort, currentPreparationPort} = {}) {
  for (const [name, fn] of Object.entries({currentAuthorizationPort,currentMachineStartPort,currentPreparationPort}))
    if (typeof fn !== "function") throw new TypeError(name + " required");
  function invokeExactEffect(request) {
    if (!request || Object.keys(request).sort().join("|") !== ["authorizationId","executionPreparationId","executionStartId"].sort().join("|")
      || !Object.values(request).every(nonempty)) return result(OUTCOMES.DENIED,"exact request identity required");
    let a,s,p;
    try {
      a=currentAuthorizationPort({authorizationId:request.authorizationId});
      s=currentMachineStartPort({executionStartId:request.executionStartId});
      p=currentPreparationPort({executionPreparationId:request.executionPreparationId});
    } catch (_) { return result(OUTCOMES.UNKNOWN,"current evidence unavailable"); }
    // Positive evidence must be obtained from trusted ports, never from the caller.
    if (!a || a.authorizationId!==request.authorizationId || a.authorizationState!=="AUTHORIZED"
      || a.consumptionState!=="UNCONSUMED" || a.operation!=="CREATE_NEW_FILE"
      || a.precondition?.mustNotExist!==true || a.authorityEffect!=="NONE"
      || !s || s.executionStartId!==request.executionStartId || s.startState!=="PERMITTED"
      || s.executionStartPermitted!==true || s.executionTargetRef!==request.executionPreparationId
      || s.executionStarted!==false || s.effectPerformed!==false
      || !p || p.executionPreparationId!==request.executionPreparationId
      || p.authorizationId!==request.authorizationId || p.executionState!=="READY"
      || p.operation!=="CREATE_NEW_FILE" || p.mustNotExist!==true
      || p.effectPerformed!==false || p.authorityEffect!=="NONE"
      || !nonempty(p.rootPath) || !safeRelative(p.relativeTargetPath)
      || !p.payload || p.payload.encoding!=="UTF-8" || !nonempty(p.payload.bytesBase64)
      || !nonempty(p.payload.digest)) return result(OUTCOMES.DENIED,"exact current authorization/start/preparation mismatch");
    // This module intentionally refuses to perform effects until a durable
    // one-shot claim/consumption port and independently trusted root binding exist.
    return result(OUTCOMES.DENIED,"NOT_CONNECTED: durable one-shot claim and trusted root binding required");
  }
  return Object.freeze({invokeExactEffect, outcomes:OUTCOMES, capability:"CREATE_NEW_FILE", authority:"NONE"});
}
module.exports=Object.freeze({createExactCreateNewFileAdapterV0,OUTCOMES,safeRelative});
