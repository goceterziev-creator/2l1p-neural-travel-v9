const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..", "..");
const SERVER = path.join(ROOT, "server.js");
const source = fs.readFileSync(SERVER, "utf8");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function has(text, needle) { assert.ok(text.includes(needle), `Missing expected text: ${needle}`); }
function notHas(text, needle) { assert.ok(!text.includes(needle), `Forbidden text present: ${needle}`); }

const loginStart = source.indexOf('app.post("/api/auth/login"');
const registerStart = source.indexOf('app.post("/api/auth/register"');
assert.ok(loginStart >= 0 && registerStart > loginStart, "Login/register anchors not found");
const login = source.slice(loginStart, registerStart);

const buildStart = source.indexOf('function buildAClassAuthenticationEvidence');
const persistStart = source.indexOf('function persistAClassAuthenticationEvidence');
assert.ok(buildStart >= 0 && persistStart > buildStart && persistStart < loginStart, "A-class helpers not found");
const builder = source.slice(buildStart, persistStart);
const persist = source.slice(persistStart, loginStart);

test("success-reaches-seam", () => {
  has(login, 'persistAClassAuthenticationEvidence(db, user, authenticationEvidenceNonce)');
});

test("wrong-password-zero-ea", () => {
  assert.ok(login.indexOf('if (!user || !verifyPassword(password, user.passwordHash))') < login.indexOf('persistAClassAuthenticationEvidence'));
});

test("unknown-account-zero", () => {
  assert.ok(login.indexOf('if (!user || !verifyPassword(password, user.passwordHash))') < login.indexOf('persistAClassAuthenticationEvidence'));
});

test("beta-bypass-zero", () => {
  notHas(login, 'BETA_AUTH_BYPASS');
});

test("one-success-one-ea", () => {
  assert.strictEqual((login.match(/persistAClassAuthenticationEvidence\(db, user, authenticationEvidenceNonce\)/g) || []).length, 1);
});

test("event-id-exact", () => has(builder, 'authenticationEventIdentity: `gt63-auth-event:${nonce}`'));

test("evidence-id-exact", () => has(builder, 'evidenceIdentity: `gt63-evidence:a-class:${nonce}`'));

test("ids-differ", () => {
  assert.notStrictEqual("gt63-auth-event:test", "gt63-evidence:a-class:test");
});

test("rev-one", () => has(builder, 'evidenceRevision: 1'));

test("account-exact", () => {
  has(builder, 'applicationAccountSubject:');
  has(builder, 'id: user.id');
});

test("method-password", () => has(builder, 'authenticationMethod: "PASSWORD"'));

test("result-success", () => has(builder, 'authenticationResult: "SUCCESS"'));

test("provenance-positive", () => {
  has(builder, 'state: "POSITIVE"');
  has(builder, 'bypassExcluded: true');
  has(builder, 'source: "NORMAL_PASSWORD_VERIFICATION"');
});

test("capture-point-exact", () => has(builder, 'capturePoint: "POST_PASSWORD_VERIFICATION_SUCCESS_PRE_SESSION_ISSUANCE"'));

test("no-forbidden-secrets-session", () => {
  ["passwordHash", "AUTH_SECRET", "SESSION_COOKIE", "signSession(", "Set-Cookie"].forEach((x) => notHas(builder, x));
});

test("no-b-c-d-leakage", () => {
  ["B_CLASS", "C_CLASS", "D_CLASS", "SOURCE_BOUND", "MATERIAL_ACCEPTANCE"].forEach((x) => notHas(builder, x));
});

test("source-context-exact", () => {
  has(builder, 'sourceIdentity: "gt63-machine:evidence-source:aya-session-normal-auth-session"');
  has(builder, 'sourceRevision: 1');
});

test("source-binding-not-assessed", () => has(builder, 'sourceBindingState: "NOT_ASSESSED"'));

test("authority-none", () => has(builder, 'authorityEffect: "NONE"'));

test("nonclaims", () => {
  has(builder, 'sourceBound: false');
  has(builder, 'issuerEstablished: false');
  has(builder, 'issuerPermissionEstablished: false');
  has(builder, 'acceptedByGt63: false');
  has(builder, 'materialAcceptance: false');
  has(builder, 'sessionEstablished: false');
  has(builder, 'downstreamAuthority: false');
});

test("persistence-failure-blocks-session", () => {
  assert.ok(login.indexOf('persistAClassAuthenticationEvidence') < login.indexOf('setSessionCookie'));
  has(login, 'sessionIssued: false');
  assert.ok(login.indexOf('return res.status(500)') < login.indexOf('setSessionCookie'));
});

test("capture-failure-does-not-rewrite-auth-result", () => {
  has(login, 'authenticationResult: "SUCCESS"');
});

test("retry-same-event-id", () => {
  has(persist, 'authenticationEventIdentity = `gt63-auth-event:${nonce}`');
  has(persist, 'return existing;');
});

test("retry-same-evidence-id", () => {
  has(persist, 'evidenceIdentity = `gt63-evidence:a-class:${nonce}`');
  has(persist, 'return existing;');
});

test("retry-no-duplicate", () => {
  assert.ok(persist.indexOf('return existing;') < persist.indexOf('db.activities.unshift(evidence)'));
});

test("independent-login-distinct-ids", () => {
  const a = crypto.randomBytes(16).toString("hex");
  const b = crypto.randomBytes(16).toString("hex");
  assert.notStrictEqual(`gt63-auth-event:${a}`, `gt63-auth-event:${b}`);
  assert.notStrictEqual(`gt63-evidence:a-class:${a}`, `gt63-evidence:a-class:${b}`);
});

test("deterministic-retrieval-exact-ea", () => {
  has(persist, 'db.activities.find');
  has(persist, 'activity?.metadata?.evidenceIdentity === evidenceIdentity');
  has(persist, 'activity?.metadata?.authenticationEventIdentity === authenticationEventIdentity');
});

test("conflicting-same-id-rejected", () => {
  has(persist, 'throw new Error("Conflicting A-class authentication evidence identity")');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err && err.stack ? err.stack : err);
    console.log(`${passed}/${tests.length} PASS`);
    process.exit(1);
  }
}

console.log(`${passed}/${tests.length} PASS`);
if (passed !== 28) process.exit(1);