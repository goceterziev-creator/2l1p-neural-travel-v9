"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const provider = require("./exact-bootstrap-gate-provider");

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test("exact gate identity is frozen", () => {
  const gate = provider.buildExactBootstrapGate();
  assert.equal(gate.gateId, provider.GATE_ID);
  assert.equal(gate.gateRevision, "1");
  assert.equal(gate.authority, "NONE");
  assert.equal(Object.isFrozen(gate), true);
});

test("exact payload is 548 bytes with no trailing newline", () => {
  assert.equal(Buffer.byteLength(provider.APPROVAL_PAYLOAD_TEXT, "utf8"), 548);
  assert.equal(provider.APPROVAL_PAYLOAD_TEXT.endsWith("\n"), false);
});

test("exact payload digest is frozen", () => {
  const digest = `sha256:${crypto.createHash("sha256").update(Buffer.from(provider.APPROVAL_PAYLOAD_TEXT, "utf8")).digest("hex")}`;
  assert.equal(digest, provider.APPROVAL_PAYLOAD_SHA256);
  assert.equal(digest, "sha256:0bba51ea1427c2e5a3542c9a46de7b4de7e44861ebdf82f14469d2f8777899aa");
});

test("payload binds exact repository target and before after states", () => {
  const parsed = JSON.parse(provider.APPROVAL_PAYLOAD_TEXT);
  assert.equal(parsed.repositoryIdentity, provider.REPOSITORY_IDENTITY);
  assert.equal(parsed.targetPath, provider.TARGET_PATH);
  assert.equal(parsed.beforeStateId, provider.BEFORE_STATE_ID);
  assert.equal(parsed.afterStateId, provider.AFTER_STATE_ID);
});

test("payload binds exact bootstrap gate and approval semantics", () => {
  const parsed = JSON.parse(provider.APPROVAL_PAYLOAD_TEXT);
  assert.equal(parsed.bootstrapGateId, provider.GATE_ID);
  assert.equal(parsed.bootstrapGateRevision, provider.GATE_REVISION);
  assert.equal(parsed.decision, "APPROVE");
  assert.equal(parsed.governanceAct, "INITIAL_GOVERNANCE_BOOTSTRAP");
  assert.equal(parsed.oneTime, true);
  assert.equal(parsed.type, "GT63_BOOTSTRAP_APPROVAL");
});

test("provider returns only the exact gate", async () => {
  const p = provider.createExactBootstrapGateProvider();
  assert.equal((await p.getGate(provider.GATE_ID)).gateId, provider.GATE_ID);
  assert.equal(await p.getGate("other-gate"), null);
});

test("provider does not create authorization or execution authority", async () => {
  const gate = await provider.createExactBootstrapGateProvider().getGate(provider.GATE_ID);
  assert.equal(gate.authority, "NONE");
  assert.equal(Object.prototype.hasOwnProperty.call(gate, "authorized"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(gate, "executionAuthority"), false);
});

(async () => {
  let passed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(`${passed}/${tests.length} PASS`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
