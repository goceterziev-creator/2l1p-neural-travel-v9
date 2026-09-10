"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createGithubBackedHumanPrincipalBinding } = require("./github-backed-human-principal-binding");

const definition = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../config/gt63-machine/human-principal-github-binding-v0.json"), "utf8"));
const binding = createGithubBackedHumanPrincipalBinding({ bindingDefinition: definition });

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function verifiedIdentity(overrides = {}) {
  return {
    providerRef: "github",
    accountId: "239696056",
    login: "goceterziev-creator",
    authenticationState: "AUTHENTICATED",
    verificationState: "VERIFIED",
    providerEvidenceRef: "github:authenticated-profile:239696056",
    ...overrides
  };
}

test("exact immutable GitHub account id resolves the approved principal", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity() });
  assert.equal(result.outcome, "BOUND_PRINCIPAL_IDENTITY_MATCH");
  assert.equal(result.principalRef, "gt63-machine:human-principal:goce-v0");
  assert.equal(result.identityMatchState, "MATCHED");
  assert.equal(result.authority, "NONE");
});

test("login is observational and may change without changing immutable account binding", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity({ login: "renamed-login" }) });
  assert.equal(result.outcome, "BOUND_PRINCIPAL_IDENTITY_MATCH");
  assert.equal(result.observedLogin, "renamed-login");
});

test("wrong provider fails closed", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity({ providerRef: "other" }) });
  assert.equal(result.outcome, "PROVIDER_MISMATCH");
  assert.equal(result.principalRef, null);
});

test("unauthenticated identity does not resolve principal", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity({ authenticationState: "UNKNOWN" }) });
  assert.equal(result.outcome, "IDENTITY_NOT_AUTHENTICATED");
  assert.equal(result.principalRef, null);
});

test("unverified identity does not resolve principal", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity({ verificationState: "UNKNOWN" }) });
  assert.equal(result.outcome, "IDENTITY_NOT_VERIFIED");
  assert.equal(result.principalRef, null);
});

test("missing provider evidence does not resolve principal", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity({ providerEvidenceRef: null }) });
  assert.equal(result.outcome, "IDENTITY_EVIDENCE_MISSING");
  assert.equal(result.principalRef, null);
});

test("different immutable GitHub account id does not resolve principal", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity({ accountId: "999" }) });
  assert.equal(result.outcome, "ACCOUNT_ID_MISMATCH");
  assert.equal(result.principalRef, null);
  assert.equal(result.identityMatchState, "NOT_MATCHED");
});

test("identity match does not establish principal eligibility", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity() });
  assert.equal(result.principalEligibilityEstablished, false);
});

test("identity match does not establish governance authorization", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity() });
  assert.equal(result.governanceAuthorizationEstablished, false);
});

test("identity match does not establish execution authority", () => {
  const result = binding.resolveVerifiedIdentity({ verifiedIdentity: verifiedIdentity() });
  assert.equal(result.executionAuthorityEstablished, false);
  assert.equal(result.authority, "NONE");
});

(async () => {
  let passed = 0;
  for (const { name, fn } of tests) {
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
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
