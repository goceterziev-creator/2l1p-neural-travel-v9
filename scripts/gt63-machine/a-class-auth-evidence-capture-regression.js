const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..", "..");
const SERVER = path.join(ROOT, "server.js");
const source = fs.readFileSync(SERVER, "utf8");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-a-class-"));
const dbFile = path.join(tempRoot, "database.json");
const mediaDir = path.join(tempRoot, "media");
process.env.DB_FILE = dbFile;
process.env.MEDIA_DIR = mediaDir;
process.env.BETA_AUTH_BYPASS = "true";
process.env.ADMIN_EMAIL = "synthetic@example.test";
process.env.ADMIN_PASSWORD = "synthetic-password";
process.env.AUTH_SECRET = "synthetic-regression-secret";
process.env.NODE_ENV = "test";

const {
  app,
  createAClassAuthenticationCaptureContext,
  buildAClassAuthenticationEvidence,
  persistAClassAuthenticationEvidence,
  resolveSessionContext
} = require(SERVER);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function has(text, needle) { assert.ok(text.includes(needle), `Missing expected text: ${needle}`); }
function notHas(text, needle) { assert.ok(!text.includes(needle), `Forbidden text present: ${needle}`); }

function passwordHash(password, salt = "0123456789abcdef0123456789abcdef") {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function freshSnapshot() {
  return {
    schemaVersion: "gt63-v9-staging-1",
    agencies: [{ id: "AGY-AYA", agencyId: "AGY-AYA", name: "Synthetic", status: "active", plan: "PRO" }],
    users: [{
      id: "USR-SYNTHETIC",
      name: "Synthetic User",
      email: "synthetic@example.test",
      agencyId: "AGY-AYA",
      passwordHash: passwordHash("synthetic-password"),
      role: "admin",
      sessionVersion: 1,
      createdAt: "2026-09-16T00:00:00.000Z"
    }],
    clients: [], offers: [], activities: []
  };
}

function resetDb() {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.writeFileSync(dbFile, JSON.stringify(freshSnapshot(), null, 2), "utf8");
}
function readDb() { return JSON.parse(fs.readFileSync(dbFile, "utf8")); }
function aClassItems(db = readDb()) {
  return (db.activities || []).filter((x) => x?.metadata?.evidenceClass === "ACCOUNT_AUTHENTICATION_EVIDENCE");
}
async function login(baseUrl, email, password) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

const buildStart = source.indexOf("function buildAClassAuthenticationEvidence");
const persistStart = source.indexOf("function persistAClassAuthenticationEvidence");
const loginStart = source.indexOf('app.post("/api/auth/login"');
const registerStart = source.indexOf('app.post("/api/auth/register"');
assert.ok(buildStart >= 0 && persistStart > buildStart && loginStart > persistStart && registerStart > loginStart);
const builder = source.slice(buildStart, persistStart);
const persistSource = source.slice(persistStart, loginStart);
const loginSource = source.slice(loginStart, registerStart);

let baseUrl = "";

test("success-reaches-seam", async () => {
  resetDb();
  const response = await login(baseUrl, "synthetic@example.test", "synthetic-password");
  assert.strictEqual(response.status, 200);
  assert.strictEqual(aClassItems().length, 1);
});

test("wrong-password-zero-ea", async () => {
  resetDb();
  const response = await login(baseUrl, "synthetic@example.test", "wrong-password");
  assert.strictEqual(response.status, 401);
  assert.strictEqual(aClassItems().length, 0);
});

test("unknown-account-zero", async () => {
  resetDb();
  const response = await login(baseUrl, "unknown@example.test", "synthetic-password");
  assert.strictEqual(response.status, 401);
  assert.strictEqual(aClassItems().length, 0);
});

test("beta-bypass-zero", () => {
  resetDb();
  const context = resolveSessionContext({ headers: {}, body: {} });
  assert.ok(context?.session?.betaAuthBypass === true);
  assert.strictEqual(aClassItems().length, 0);
});

test("one-success-one-ea", async () => {
  resetDb();
  const response = await login(baseUrl, "synthetic@example.test", "synthetic-password");
  assert.strictEqual(response.status, 200);
  assert.strictEqual(aClassItems().length, 1);
});

test("event-id-exact", () => {
  const capture = createAClassAuthenticationCaptureContext();
  assert.strictEqual(capture.authenticationEventIdentity, `gt63-auth-event:${capture.nonce}`);
});

test("evidence-id-exact", () => {
  const capture = createAClassAuthenticationCaptureContext();
  assert.strictEqual(capture.evidenceIdentity, `gt63-evidence:a-class:${capture.nonce}`);
});

test("ids-differ", () => {
  const capture = createAClassAuthenticationCaptureContext();
  assert.notStrictEqual(capture.activityIdentity, capture.evidenceIdentity);
  assert.notStrictEqual(capture.activityIdentity, capture.authenticationEventIdentity);
  assert.notStrictEqual(capture.evidenceIdentity, capture.authenticationEventIdentity);
});

test("rev-one", () => {
  const item = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext());
  assert.strictEqual(item.metadata.evidenceRevision, 1);
});

test("account-exact", () => {
  const user = freshSnapshot().users[0];
  const item = buildAClassAuthenticationEvidence(user, createAClassAuthenticationCaptureContext());
  assert.deepStrictEqual(item.metadata.applicationAccountSubject, { id: user.id, email: user.email, agencyId: user.agencyId });
});

test("method-password", () => {
  const item = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext());
  assert.strictEqual(item.metadata.authenticationMethod, "PASSWORD");
});

test("result-success", () => {
  const item = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext());
  assert.strictEqual(item.metadata.authenticationResult, "SUCCESS");
});

test("provenance-positive", () => {
  const p = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext()).metadata.normalPathProvenance;
  assert.deepStrictEqual(p, { state: "POSITIVE", bypassExcluded: true, source: "NORMAL_PASSWORD_VERIFICATION" });
});

test("capture-point-exact", () => {
  const item = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext());
  assert.strictEqual(item.metadata.capturePoint, "POST_PASSWORD_VERIFICATION_SUCCESS_PRE_SESSION_ISSUANCE");
});

test("no-forbidden-secrets-session", () => {
  ["passwordHash", "AUTH_SECRET", "SESSION_COOKIE", "signSession(", "Set-Cookie"].forEach((x) => notHas(builder, x));
});

test("no-b-c-d-leakage", () => {
  ["B_CLASS", "C_CLASS", "D_CLASS", 'sourceBindingState: "SOURCE_BOUND"', 'materialAcceptance: true'].forEach((x) => notHas(builder, x));
});

test("source-context-exact", () => {
  const item = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext());
  const c = item.metadata.sourceContext;
  assert.strictEqual(c.sourceIdentity, "gt63-machine:evidence-source:aya-session-normal-auth-session");
  assert.strictEqual(c.sourceRevision, 1);
  assert.strictEqual(c.validatedSourceDefinitionMaterialIdentity, "gt63-machine:source-definition-material:aya-session-normal-auth-session-evidence@1");
  assert.strictEqual(c.validatedSourceDefinitionMaterialBlob, "382ec5ce18858e93981e8792de8a050042252e15");
  assert.deepStrictEqual(c.sourceEstablishmentEvidence, {
    path: "config/gt63-machine/aya-session-source-establishment-evidence-v0.json",
    commit: "79cb2005dcf9e286b8289c0c4a037740626f9234",
    blob: "6a07b191731f06a553c403087384202e6c2cbc75"
  });
  assert.strictEqual(c.priorSourceCurrentnessEvidence.commit, "71fda9fe0f109fa9b1714a4b644ebb84fae53ff0");
  assert.strictEqual(c.priorSourceCurrentnessEvidence.assessedRelevantImplementationBlob, "e17a162457a426b67f2402b53f07791dc67e09b3");
  assert.strictEqual(c.priorSourceCurrentnessEvidence.finalCorrectedImplementationCurrentnessAssessed, false);
});

test("source-binding-not-assessed", () => {
  const item = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext());
  assert.strictEqual(item.metadata.sourceBindingState, "NOT_ASSESSED");
});

test("authority-none", () => {
  const item = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext());
  assert.strictEqual(item.metadata.authorityEffect, "NONE");
});

test("nonclaims", () => {
  const n = buildAClassAuthenticationEvidence(freshSnapshot().users[0], createAClassAuthenticationCaptureContext()).metadata.nonClaims;
  assert.deepStrictEqual(n, {
    sourceBound: false, issuerEstablished: false, issuerPermissionEstablished: false,
    acceptedByGt63: false, materialAcceptance: false, sessionEstablished: false, downstreamAuthority: false
  });
});

test("persistence-failure-blocks-session", async () => {
  resetDb();
  const originalRename = fs.renameSync;
  fs.renameSync = function injectedAClassWriteFailure() { throw new Error("synthetic A-class persistence failure"); };
  try {
    const response = await login(baseUrl, "synthetic@example.test", "synthetic-password");
    const body = await response.json();
    assert.strictEqual(response.status, 500);
    assert.strictEqual(body.authenticationResult, "SUCCESS");
    assert.strictEqual(body.sessionIssued, false);
    assert.strictEqual(response.headers.get("set-cookie"), null);
  } finally {
    fs.renameSync = originalRename;
  }
});

test("capture-failure-does-not-rewrite-auth-result", () => {
  has(loginSource, 'authenticationResult: "SUCCESS"');
  has(loginSource, "sessionIssued: false");
});

test("retry-same-event-id", () => {
  const db = freshSnapshot(); const user = db.users[0]; const capture = createAClassAuthenticationCaptureContext();
  const first = persistAClassAuthenticationEvidence(db, user, capture, () => {});
  const second = persistAClassAuthenticationEvidence(db, user, capture, () => { throw new Error("must not rewrite exact replay"); });
  assert.strictEqual(second.metadata.authenticationEventIdentity, first.metadata.authenticationEventIdentity);
});

test("retry-same-evidence-id", () => {
  const db = freshSnapshot(); const user = db.users[0]; const capture = createAClassAuthenticationCaptureContext();
  const first = persistAClassAuthenticationEvidence(db, user, capture, () => {});
  const second = persistAClassAuthenticationEvidence(db, user, capture, () => {});
  assert.strictEqual(second.metadata.evidenceIdentity, first.metadata.evidenceIdentity);
  assert.strictEqual(second.id, first.id);
});

test("retry-no-duplicate", () => {
  const db = freshSnapshot(); const user = db.users[0]; const capture = createAClassAuthenticationCaptureContext();
  persistAClassAuthenticationEvidence(db, user, capture, () => {});
  persistAClassAuthenticationEvidence(db, user, capture, () => {});
  assert.strictEqual(aClassItems(db).length, 1);
});

test("independent-login-distinct-ids", () => {
  const a = createAClassAuthenticationCaptureContext();
  const b = createAClassAuthenticationCaptureContext();
  assert.notStrictEqual(a.authenticationEventIdentity, b.authenticationEventIdentity);
  assert.notStrictEqual(a.evidenceIdentity, b.evidenceIdentity);
  assert.notStrictEqual(a.activityIdentity, b.activityIdentity);
});

test("deterministic-retrieval-exact-ea", () => {
  const db = freshSnapshot(); const user = db.users[0]; const capture = createAClassAuthenticationCaptureContext();
  const first = persistAClassAuthenticationEvidence(db, user, capture, () => {});
  const retrieved = db.activities.find((x) => x.metadata?.evidenceIdentity === capture.evidenceIdentity);
  assert.deepStrictEqual(retrieved, first);
});

test("conflicting-same-id-rejected", () => {
  const db = freshSnapshot(); const user = db.users[0]; const capture = createAClassAuthenticationCaptureContext();
  persistAClassAuthenticationEvidence(db, user, capture, () => {});
  db.activities[0].metadata.normalPathProvenance.source = "CONFLICTING_SOURCE";
  assert.throws(
    () => persistAClassAuthenticationEvidence(db, user, capture, () => {}),
    /Conflicting A-class authentication evidence identity/
  );
});

(async () => {
  resetDb();
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    let passed = 0;
    for (const { name, fn } of tests) {
      try {
        await fn();
        passed += 1;
        console.log(`PASS - ${name}`);
      } catch (err) {
        console.error(`FAIL - ${name}`);
        console.error(err && err.stack ? err.stack : err);
        console.log(`${passed}/${tests.length} PASS`);
        process.exitCode = 1;
        return;
      }
    }
    console.log(`${passed}/${tests.length} PASS`);
    if (tests.length !== 28 || passed !== 28) process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();
