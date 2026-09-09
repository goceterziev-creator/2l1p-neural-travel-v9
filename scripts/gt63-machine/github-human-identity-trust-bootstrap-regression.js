"use strict";

const assert = require("node:assert/strict");
const {
  GITHUB_DEVICE_CODE_URL,
  GITHUB_ACCESS_TOKEN_URL,
  GITHUB_USER_URL,
  createMemoryLedger,
  createGitHubHumanIdentityTrustBootstrap
} = require("./github-human-identity-trust-bootstrap");

const SESSION = Object.freeze({
  sessionRef: "gt63-runtime-session:USR-ADMIN:1",
  sessionRevision: "1",
  authenticatedAccountRef: "gt63-runtime-user:USR-ADMIN"
});

function makeClock(initial = 1000000) {
  let value = initial;
  return { now: () => value, advance: (ms) => { value += ms; } };
}

function fixedRandom() {
  return Buffer.alloc(16, 7);
}

function makeTransport(sequence) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    const next = sequence.shift();
    if (!next) throw new Error("unexpected transport call");
    return typeof next === "function" ? next(request) : next;
  };
  transport.calls = calls;
  return transport;
}

async function run() {
  const tests = [];
  const test = async (name, fn) => {
    try { await fn(); tests.push({ name, pass: true }); }
    catch (error) { tests.push({ name, pass: false, error: error.stack || String(error) }); }
  };

  await test("constructor requires configured client id", async () => {
    assert.throws(() => createGitHubHumanIdentityTrustBootstrap(), /clientId/);
  });

  await test("start requires exact authenticated session binding", async () => {
    const bootstrap = createGitHubHumanIdentityTrustBootstrap({ clientId: "Iv1.test", transport: async () => { throw new Error("must not call"); } });
    const out = await bootstrap.start({ sessionRef: SESSION.sessionRef });
    assert.equal(out.outcome, "IDENTITY_BOOTSTRAP_REJECTED");
    assert.equal(out.authority, "NONE");
  });

  await test("start returns user-facing GitHub device challenge without leaking device_code", async () => {
    const transport = makeTransport([{ status: 200, body: {
      device_code: "device-secret-40-chars",
      user_code: "ABCD-EFGH",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5
    } }]);
    const clock = makeClock();
    const bootstrap = createGitHubHumanIdentityTrustBootstrap({
      clientId: "Iv1.test", transport, now: clock.now, randomBytes: fixedRandom
    });
    const out = await bootstrap.start(SESSION);
    assert.equal(out.outcome, "EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED");
    assert.equal(out.challenge.userCode, "ABCD-EFGH");
    assert.equal(out.challenge.verificationUri, "https://github.com/login/device");
    assert.equal(Object.prototype.hasOwnProperty.call(out.challenge, "deviceCode"), false);
    assert.equal(transport.calls[0].url, GITHUB_DEVICE_CODE_URL);
    assert.equal(out.authority, "NONE");
  });

  await test("poll remains pending without manufacturing identity", async () => {
    const transport = makeTransport([
      { status: 200, body: { device_code: "d", user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 } },
      { status: 200, body: { error: "authorization_pending" } }
    ]);
    const clock = makeClock();
    const bootstrap = createGitHubHumanIdentityTrustBootstrap({
      clientId: "Iv1.test", transport, now: clock.now, randomBytes: fixedRandom
    });
    const started = await bootstrap.start(SESSION);
    const out = await bootstrap.poll({ ...SESSION, challengeRef: started.challenge.challengeRef });
    assert.equal(out.outcome, "EXTERNAL_IDENTITY_AUTHORIZATION_PENDING");
    assert.equal(bootstrap.getIdentityBySession(SESSION.sessionRef), null);
    assert.equal(transport.calls[1].url, GITHUB_ACCESS_TOKEN_URL);
  });

  await test("challenge cannot cross authenticated sessions", async () => {
    const transport = makeTransport([{ status: 200, body: { device_code: "d", user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 } }]);
    const bootstrap = createGitHubHumanIdentityTrustBootstrap({ clientId: "Iv1.test", transport, randomBytes: fixedRandom });
    const started = await bootstrap.start(SESSION);
    const out = await bootstrap.poll({
      ...SESSION,
      sessionRef: "gt63-runtime-session:OTHER:1",
      challengeRef: started.challenge.challengeRef
    });
    assert.equal(out.outcome, "IDENTITY_BOOTSTRAP_REJECTED");
    assert.match(out.reason, /not bound/);
  });

  await test("verified GitHub account becomes provider-bound principal evidence only", async () => {
    const transport = makeTransport([
      { status: 200, body: { device_code: "d", user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 } },
      { status: 200, body: { access_token: "secret-token", token_type: "bearer" } },
      (request) => {
        assert.equal(request.url, GITHUB_USER_URL);
        assert.equal(request.headers.Authorization, "Bearer secret-token");
        return { status: 200, body: { id: 239696056, login: "goceterziev-creator", name: "ignored display name" } };
      }
    ]);
    const clock = makeClock();
    const bootstrap = createGitHubHumanIdentityTrustBootstrap({
      clientId: "Iv1.test",
      expectedIdentity: { githubUserId: 239696056, githubLogin: "goceterziev-creator" },
      transport,
      now: clock.now,
      randomBytes: fixedRandom
    });
    const started = await bootstrap.start(SESSION);
    const out = await bootstrap.poll({ ...SESSION, challengeRef: started.challenge.challengeRef });
    assert.equal(out.outcome, "EXTERNAL_IDENTITY_VERIFIED");
    assert.equal(out.identity.principalRef, "gt63-machine:principal:github:239696056");
    assert.equal(out.identity.principalNamespace, "github.com");
    assert.equal(out.identity.githubLogin, "goceterziev-creator");
    assert.equal(out.identity.lifecycleState, "CURRENT");
    assert.equal(out.identity.freshnessState, "CURRENT");
    assert.equal(out.identity.contradictionState, "NONE");
    assert.match(out.identity.principalEvidenceRef, /^gt63-process-local-evidence:github-authenticated-identity:[0-9a-f]{64}$/);
    assert.equal(out.identity.authority, "NONE");
    assert.equal(Object.values(out.identity).includes("secret-token"), false);
  });

  await test("configured bootstrap anchor mismatch fails closed", async () => {
    const transport = makeTransport([
      { status: 200, body: { device_code: "d", user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 } },
      { status: 200, body: { access_token: "secret-token" } },
      { status: 200, body: { id: 999, login: "someone-else" } }
    ]);
    const bootstrap = createGitHubHumanIdentityTrustBootstrap({
      clientId: "Iv1.test",
      expectedIdentity: { githubUserId: 239696056, githubLogin: "goceterziev-creator" },
      transport,
      randomBytes: fixedRandom
    });
    const started = await bootstrap.start(SESSION);
    const out = await bootstrap.poll({ ...SESSION, challengeRef: started.challenge.challengeRef });
    assert.equal(out.outcome, "IDENTITY_BOOTSTRAP_REJECTED");
    assert.match(out.reason, /does not match/);
    assert.equal(bootstrap.getIdentityBySession(SESSION.sessionRef), null);
  });

  await test("GitHub access denial cannot become verified identity", async () => {
    const transport = makeTransport([
      { status: 200, body: { device_code: "d", user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 } },
      { status: 200, body: { error: "access_denied" } }
    ]);
    const bootstrap = createGitHubHumanIdentityTrustBootstrap({ clientId: "Iv1.test", transport, randomBytes: fixedRandom });
    const started = await bootstrap.start(SESSION);
    const out = await bootstrap.poll({ ...SESSION, challengeRef: started.challenge.challengeRef });
    assert.equal(out.outcome, "IDENTITY_BOOTSTRAP_REJECTED");
    assert.equal(bootstrap.getIdentityBySession(SESSION.sessionRef), null);
  });

  await test("identity evidence remains authority NONE and does not assert eligibility or authorization", async () => {
    const ledger = createMemoryLedger();
    const transport = makeTransport([
      { status: 200, body: { device_code: "d", user_code: "ABCD-EFGH", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 } },
      { status: 200, body: { access_token: "secret-token" } },
      { status: 200, body: { id: 239696056, login: "goceterziev-creator" } }
    ]);
    const bootstrap = createGitHubHumanIdentityTrustBootstrap({ clientId: "Iv1.test", ledger, transport, randomBytes: fixedRandom });
    const started = await bootstrap.start(SESSION);
    const out = await bootstrap.poll({ ...SESSION, challengeRef: started.challenge.challengeRef });
    const identity = out.identity;
    assert.equal(identity.authority, "NONE");
    assert.equal(Object.prototype.hasOwnProperty.call(identity, "eligibilityState"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(identity, "authorizationState"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(identity, "roleRef"), false);
  });

  const failed = tests.filter((item) => !item.pass);
  for (const item of tests) console.log(`${item.pass ? "PASS" : "FAIL"} - ${item.name}`);
  console.log(`${tests.length - failed.length}/${tests.length} PASS`);
  if (failed.length) {
    for (const item of failed) console.error(item.error);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
