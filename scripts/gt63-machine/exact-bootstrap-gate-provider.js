"use strict";

const crypto = require("node:crypto");

const AUTHORITY = "NONE";
const GATE_ID = "gt63-machine:bootstrap-gate:lifecycle-issuer-policy-v0";
const GATE_REVISION = "1";
const REPOSITORY_IDENTITY = "goceterziev-creator/2l1p-neural-travel-v9";
const TARGET_PATH = "config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json";
const BEFORE_STATE_ID = "sha256:7eccc408e7de1087acce9e6c94f848adc9cb9bc07cb78659508005c61f1367ad";
const AFTER_STATE_ID = "sha256:5d5cfe1817d51aac1de08ca1889c5d274c39422b9a534cd2beca263829523093";
const APPROVAL_PAYLOAD_TEXT = '{"afterStateId":"sha256:5d5cfe1817d51aac1de08ca1889c5d274c39422b9a534cd2beca263829523093","beforeStateId":"sha256:7eccc408e7de1087acce9e6c94f848adc9cb9bc07cb78659508005c61f1367ad","bootstrapGateId":"gt63-machine:bootstrap-gate:lifecycle-issuer-policy-v0","bootstrapGateRevision":"1","decision":"APPROVE","governanceAct":"INITIAL_GOVERNANCE_BOOTSTRAP","oneTime":true,"repositoryIdentity":"goceterziev-creator/2l1p-neural-travel-v9","targetPath":"config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json","type":"GT63_BOOTSTRAP_APPROVAL"}';
const APPROVAL_PAYLOAD_SHA256 = "sha256:0bba51ea1427c2e5a3542c9a46de7b4de7e44861ebdf82f14469d2f8777899aa";
const APPROVAL_PAYLOAD_LENGTH = 548;

function sha256(text) {
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")}`;
}

function buildExactBootstrapGate() {
  if (Buffer.byteLength(APPROVAL_PAYLOAD_TEXT, "utf8") !== APPROVAL_PAYLOAD_LENGTH) {
    throw new Error("bootstrap approval payload length mismatch");
  }
  if (sha256(APPROVAL_PAYLOAD_TEXT) !== APPROVAL_PAYLOAD_SHA256) {
    throw new Error("bootstrap approval payload digest mismatch");
  }
  const parsed = JSON.parse(APPROVAL_PAYLOAD_TEXT);
  if (parsed.bootstrapGateId !== GATE_ID || parsed.bootstrapGateRevision !== GATE_REVISION) {
    throw new Error("bootstrap approval payload gate binding mismatch");
  }
  if (parsed.repositoryIdentity !== REPOSITORY_IDENTITY || parsed.targetPath !== TARGET_PATH) {
    throw new Error("bootstrap approval payload target binding mismatch");
  }
  if (parsed.beforeStateId !== BEFORE_STATE_ID || parsed.afterStateId !== AFTER_STATE_ID) {
    throw new Error("bootstrap approval payload state binding mismatch");
  }
  if (parsed.decision !== "APPROVE" || parsed.governanceAct !== "INITIAL_GOVERNANCE_BOOTSTRAP" || parsed.oneTime !== true) {
    throw new Error("bootstrap approval payload semantic binding mismatch");
  }

  return Object.freeze({
    gateId: GATE_ID,
    gateRevision: GATE_REVISION,
    repositoryIdentity: REPOSITORY_IDENTITY,
    targetPath: TARGET_PATH,
    beforeStateId: BEFORE_STATE_ID,
    afterStateId: AFTER_STATE_ID,
    approvalPayloadText: APPROVAL_PAYLOAD_TEXT,
    approvalPayloadSha256: APPROVAL_PAYLOAD_SHA256,
    approvalPayloadLength: APPROVAL_PAYLOAD_LENGTH,
    oneTime: true,
    governanceAct: "INITIAL_GOVERNANCE_BOOTSTRAP",
    authority: AUTHORITY
  });
}

function createExactBootstrapGateProvider() {
  const gate = buildExactBootstrapGate();
  return Object.freeze({
    async getGate(gateId) {
      if (gateId !== GATE_ID) return null;
      return gate;
    }
  });
}

module.exports = {
  AUTHORITY,
  GATE_ID,
  GATE_REVISION,
  REPOSITORY_IDENTITY,
  TARGET_PATH,
  BEFORE_STATE_ID,
  AFTER_STATE_ID,
  APPROVAL_PAYLOAD_TEXT,
  APPROVAL_PAYLOAD_SHA256,
  APPROVAL_PAYLOAD_LENGTH,
  buildExactBootstrapGate,
  createExactBootstrapGateProvider
};
