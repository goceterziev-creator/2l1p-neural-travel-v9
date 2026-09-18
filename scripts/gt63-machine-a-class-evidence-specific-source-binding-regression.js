"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const c = require("./gt63-machine/a-class-evidence-specific-source-binding");

const DEF_BLOB = "382ec5ce18858e93981e8792de8a050042252e15";
const SERVER_BLOB = "0c3f6e8a00a78bbb0414aae3d0b39b800c9a4476";

function base() {
  return {
    evidence: {
      evidenceIdentity: "gt63-evidence:a-class:85584f53706e084a91f5870b8f7c753b",
      evidenceRevision: 1,
      authenticationEventIdentity: "gt63-auth-event:85584f53706e084a91f5870b8f7c753b",
      evidenceClass: "ACCOUNT_AUTHENTICATION_EVIDENCE",
      authenticationMethod: "PASSWORD",
      authenticationResult: "SUCCESS",
      normalPathProvenance: { state: "POSITIVE", bypassExcluded: true, source: "NORMAL_PASSWORD_VERIFICATION" },
      capturePoint: "POST_PASSWORD_VERIFICATION_SUCCESS_PRE_SESSION_ISSUANCE",
      sourceContext: {
        sourceIdentity: "gt63-machine:evidence-source:aya-session-normal-auth-session",
        sourceRevision: 1,
        validatedSourceDefinitionMaterialBlob: DEF_BLOB
      }
    },
    byteIdentity: {
      byteLength: 2035,
      sha256: "700b2fb7b8b8cc38a42ca4f8a24be4b9aadb13f3bf4c1cec094fca59b62a9162"
    },
    sourceDefinitionBlob: DEF_BLOB,
    sourceDefinition: {
      materialIdentity: "gt63-machine:source-definition-material:aya-session-normal-auth-session-evidence@1",
      sourceSubject: { sourceIdentity: "gt63-machine:evidence-source:aya-session-normal-auth-session", sourceRevision: 1 },
      provenanceBoundary: {
        admittedPath: ["NORMAL_PASSWORD_AUTHENTICATION_SUCCESS","NORMAL_SESSION_ISSUANCE"],
        excludedPaths: ["BETA_AUTH_BYPASS_SYNTHESIZED_REQUEST_CONTEXT"]
      },
      evidenceClassCoverage: [{ class: "ACCOUNT_AUTHENTICATION_EVIDENCE" }]
    },
    sourceEstablishment: {
      establishmentEvidenceIdentity: "gt63-machine:source-establishment-evidence:aya-session-normal-auth-session@1",
      decision: { outcome: "SOURCE_ESTABLISHED" },
      establishmentTarget: {
        sourceIdentity: "gt63-machine:evidence-source:aya-session-normal-auth-session",
        sourceRevision: 1,
        validatedSourceDefinitionMaterialBlob: DEF_BLOB
      }
    },
    sourceCurrentness: {
      sourceCurrentnessEvidenceIdentity: "gt63-machine:source-currentness-evidence:aya-session-normal-auth-session@3",
      assessmentTarget: {
        sourceIdentity: "gt63-machine:evidence-source:aya-session-normal-auth-session",
        sourceRevision: 1,
        validatedSourceDefinitionMaterialBlob: DEF_BLOB
      },
      assessmentBoundary: {
        authoritativeRepository: "goceterziev-creator/2l1p-neural-travel-v9",
        relevantImplementationPath: "server.js",
        assessedImplementationBlob: SERVER_BLOB
      },
      outcome: { lifecycleOutcome: "CURRENT" }
    },
    producingImplementation: {
      repository: "goceterziev-creator/2l1p-neural-travel-v9",
      serverPath: "server.js",
      serverBlob: SERVER_BLOB
    }
  };
}
function copy(v) { return JSON.parse(JSON.stringify(v)); }
const cases = [];
function ok(name, fn) { fn(); cases.push(name); }
function state(input) { return c.assessAClassEvidenceSpecificSourceBinding(input); }
function noAuthority(r) {
  assert.equal(r.authorityEffect, "NONE");
  assert.equal(r.nonClaims.materialAcceptance, false);
  assert.equal(r.nonClaims.filesystemEffectAuthority, false);
  assert.equal(r.nonClaims.machineAuthority, false);
}

ok("real-4-exact-positive-source-bound", () => {
  const r = state(base());
  assert.equal(r.sourceBindingState, c.STATES.SOURCE_BOUND);
  noAuthority(r);
});
ok("missing-input-is-unknown", () => assert.equal(state({}).sourceBindingState, c.STATES.UNKNOWN));
ok("wrong-evidence-class-not-bound", () => {
  const x=base(); x.evidence.evidenceClass="APPLICATION_SESSION_EVIDENCE";
  assert.equal(state(x).sourceBindingState,c.STATES.NOT_BOUND);
});
ok("wrong-auth-result-not-bound", () => {
  const x=base(); x.evidence.authenticationResult="FAILURE";
  assert.equal(state(x).sourceBindingState,c.STATES.NOT_BOUND);
});
ok("absence-of-bypass-is-not-positive-proof", () => {
  const x=base(); delete x.evidence.normalPathProvenance.bypassExcluded;
  assert.equal(state(x).sourceBindingState,c.STATES.NOT_BOUND);
});
ok("beta-bypass-not-bound", () => {
  const x=base(); x.evidence.normalPathProvenance.bypassExcluded=false;
  assert.equal(state(x).sourceBindingState,c.STATES.NOT_BOUND);
});
ok("wrong-capture-point-not-bound", () => {
  const x=base(); x.evidence.capturePoint="POST_SESSION_ISSUANCE";
  assert.equal(state(x).sourceBindingState,c.STATES.NOT_BOUND);
});
ok("wrong-source-revision-not-bound", () => {
  const x=base(); x.evidence.sourceContext.sourceRevision=2;
  assert.equal(state(x).sourceBindingState,c.STATES.NOT_BOUND);
});
ok("source-not-established-unknown", () => {
  const x=base(); x.sourceEstablishment.decision.outcome="NOT_ESTABLISHED";
  assert.equal(state(x).sourceBindingState,c.STATES.UNKNOWN);
});
ok("source-not-current-unknown", () => {
  const x=base(); x.sourceCurrentness.outcome.lifecycleOutcome="UNKNOWN";
  assert.equal(state(x).sourceBindingState,c.STATES.UNKNOWN);
});
ok("implementation-blob-mismatch-unknown", () => {
  const x=base(); x.producingImplementation.serverBlob="changed";
  assert.equal(state(x).sourceBindingState,c.STATES.UNKNOWN);
});
ok("source-definition-blob-mismatch-not-bound", () => {
  const x=base(); x.evidence.sourceContext.validatedSourceDefinitionMaterialBlob="wrong";
  assert.equal(state(x).sourceBindingState,c.STATES.NOT_BOUND);
});
ok("a-class-does-not-require-post-session-semantics", () => {
  const x=base(); x.sourceDefinition.provenanceBoundary.admittedPath=["NORMAL_PASSWORD_AUTHENTICATION_SUCCESS"];
  assert.equal(state(x).sourceBindingState,c.STATES.SOURCE_BOUND);
});
ok("missing-normal-password-admission-unknown", () => {
  const x=base(); x.sourceDefinition.provenanceBoundary.admittedPath=["NORMAL_SESSION_ISSUANCE"];
  assert.equal(state(x).sourceBindingState,c.STATES.UNKNOWN);
});
ok("deterministic-replay", () => {
  assert.deepEqual(state(base()),state(base()));
});
ok("material-change-changes-assessment-identity", () => {
  const a=state(base()); const x=base(); x.evidence.authenticationResult="FAILURE"; const b=state(x);
  assert.notEqual(a.assessmentIdentity,b.assessmentIdentity);
});
ok("authority-always-none", () => {
  for (const x of [base(),{},(()=>{const y=base();y.sourceCurrentness.outcome.lifecycleOutcome="UNKNOWN";return y;})()]) noAuthority(state(x));
});

const semantic={cases,states:Object.values(c.STATES),rulesetVersion:c.RULESET_VERSION};
const hash="sha256:"+crypto.createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
process.stdout.write(JSON.stringify({status:"PASS",workflow:"a-class-evidence-specific-source-binding-v0-regression",cases:cases.length,validationIdentity:hash,semantic})+"\n");
