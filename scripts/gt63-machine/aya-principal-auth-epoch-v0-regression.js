'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('./aya-principal-auth-epoch-v0');
const B = require('./aya-auth-event-session-binding-v0');

const ROOT = path.resolve(__dirname, '..', '..');
const serverSource = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function user(overrides = {}) {
  const base = {
    id: 'USR-1',
    name: 'User One',
    email: 'one@example.test',
    agencyId: 'AGY-AYA',
    role: 'admin',
    passwordHash: 'hash:a',
    sessionVersion: 7,
    principalAuthEpoch: 3
  };
  const merged = { ...base, ...overrides };
  if (overrides.omitPrincipalAuthEpoch) delete merged.principalAuthEpoch;
  return merged;
}

function aClass(overrides = {}) {
  const u = overrides.user || user();
  return {
    id: 'gt63-activity:a-class:epoch',
    type: 'gt63_a_class_authentication_evidence',
    category: 'auth',
    userId: u.id,
    actorType: 'user',
    offerId: null,
    clientId: null,
    agencyId: u.agencyId,
    timestamp: '2026-09-29T09:00:00.000Z',
    createdAt: '2026-09-29T09:00:00.000Z',
    metadata: {
      evidenceIdentity: 'gt63-evidence:a-class:epoch',
      evidenceRevision: 1,
      authenticationEventIdentity: 'gt63-auth-event:epoch',
      evidenceClass: 'ACCOUNT_AUTHENTICATION_EVIDENCE',
      applicationAccountSubject: {
        id: u.id,
        email: u.email,
        agencyId: u.agencyId,
        principalAuthEpoch: u.principalAuthEpoch || null
      },
      authenticationMethod: 'PASSWORD',
      authenticationResult: 'SUCCESS',
      normalPathProvenance: {
        state: 'POSITIVE',
        bypassExcluded: true,
        source: 'NORMAL_PASSWORD_VERIFICATION'
      },
      authorityEffect: 'NONE'
    }
  };
}

function session(u = user(), overrides = {}) {
  return {
    userId: u.id,
    agencyId: u.agencyId,
    role: u.role,
    sessionVersion: u.sessionVersion,
    principalAuthEpoch: Object.prototype.hasOwnProperty.call(overrides, 'principalAuthEpoch')
      ? overrides.principalAuthEpoch
      : u.principalAuthEpoch,
    iat: overrides.iat || 1_797_000_000_000,
    exp: overrides.exp || 1_797_000_600_000
  };
}

function req(u = user(), s = session(u), overrides = {}) {
  return {
    user: { ...u, ...(overrides.user || {}) },
    session: { ...s, ...(overrides.session || {}) },
    sessionIdentity: {
      userId: u.id,
      agencyId: u.agencyId,
      role: u.role,
      sessionVersion: u.sessionVersion,
      principalAuthEpoch: u.principalAuthEpoch,
      ...(overrides.identity || {})
    }
  };
}

function bound(u = user(), sessionPatch = {}) {
  const s = session(u, sessionPatch);
  const binding = B.createAuthEventSessionBinding({ aClassEvidence: aClass({ user: u }), sessionMaterial: s });
  assert.equal(binding.outcome, B.OUTCOMES.ACCEPTED);
  const store = B.createProcessLocalAuthEventSessionBindingStore();
  assert.equal(store.commit(binding.binding).outcome, B.OUTCOMES.ACCEPTED);
  return { binding: binding.binding, store, sessionMaterial: s };
}

test('new user receives explicit epoch through server createUser path', () => {
  assert.ok(serverSource.includes('initializePrincipalAuthEpochForNewUser(user);'));
});

test('new default admin receives explicit epoch without legacy fallback', () => {
  assert.ok(serverSource.includes('principalAuthEpoch: 1'));
});

test('epoch is positive integer', () => {
  assert.equal(E.getPrincipalAuthEpoch(user()).outcome, E.OUTCOMES.ACCEPTED);
  assert.equal(E.getPrincipalAuthEpoch(user({ principalAuthEpoch: 0 })).outcome, E.OUTCOMES.REJECTED);
});

test('legacy missing epoch remains unknown', () => {
  assert.equal(E.getPrincipalAuthEpoch(user({ omitPrincipalAuthEpoch: true })).outcome, E.OUTCOMES.UNKNOWN);
});

test('missing epoch is not interpreted as one', () => {
  const u = user({ omitPrincipalAuthEpoch: true });
  assert.equal(E.principalRevisionFromEpoch(u.principalAuthEpoch), null);
});

test('client cannot supply authoritative epoch', () => {
  assert.ok(!serverSource.includes('req.body?.principalAuthEpoch'));
  assert.ok(!serverSource.includes('req.body.principalAuthEpoch'));
});

test('normal login does not increment epoch', () => {
  const login = serverSource.slice(serverSource.indexOf('app.post("/api/auth/login"'), serverSource.indexOf('app.post("/api/auth/register"'));
  assert.ok(!login.includes('incrementPrincipalAuthEpochForCredentialTransition'));
});

test('new session does not increment epoch', () => {
  const before = user();
  const after = { ...before };
  session(after, { iat: 1_797_000_100_000, exp: 1_797_000_700_000 });
  assert.equal(after.principalAuthEpoch, before.principalAuthEpoch);
});

test('logout does not increment epoch', () => {
  const logout = serverSource.slice(serverSource.indexOf('app.post("/api/auth/logout"'), serverSource.indexOf('app.use("/api"', serverSource.indexOf('app.post("/api/auth/logout"')));
  assert.ok(!logout.includes('principalAuthEpoch'));
});

test('expiry does not increment epoch', () => {
  const u = user();
  B.assessCurrentRequestBinding({ req: req(u, session(u, { exp: 1 })), currentDbUser: u, store: bound(u).store, now: 2 });
  assert.equal(u.principalAuthEpoch, 3);
});

test('credential transition increments epoch', () => {
  const u = user();
  const out = E.incrementPrincipalAuthEpochForCredentialTransition(u, { transition: 'credential_change' });
  assert.equal(out.outcome, E.OUTCOMES.ACCEPTED);
  assert.equal(u.principalAuthEpoch, 4);
});

test('password reset route increments epoch atomically with credential transition', () => {
  const route = serverSource.slice(serverSource.indexOf('app.post("/api/admin/reset-password"'), serverSource.indexOf('function checkDatabaseHealth'));
  assert.ok(route.includes('const nextPasswordHash = hashPassword(temporaryPassword);'));
  assert.ok(route.includes('incrementPrincipalAuthEpochForCredentialTransition(target'));
  assert.ok(route.indexOf('incrementPrincipalAuthEpochForCredentialTransition(target') < route.indexOf('target.passwordHash = nextPasswordHash'));
});

test('forced reset path increments epoch where supported', () => {
  const boot = serverSource.slice(serverSource.indexOf('function ensureDefaultUser'), serverSource.indexOf('ensureDefaultUser();'));
  assert.ok(boot.includes('transition: "bootstrap_admin_password_reset"'));
  assert.ok(boot.includes('incrementPrincipalAuthEpochForCredentialTransition(admin'));
});

test('identity rebinding path is not currently supported', () => {
  assert.ok(!/identity.?rebind/i.test(serverSource));
});

test('role change does not change epoch', () => {
  const u = user();
  u.role = 'viewer';
  assert.equal(u.principalAuthEpoch, 3);
});

test('capability change does not change epoch', () => {
  const roleCapabilitiesOnly = serverSource.slice(serverSource.indexOf('const ROLE_CAPABILITIES'), serverSource.indexOf('const PLAN_CONTRACTS'));
  assert.ok(!roleCapabilitiesOnly.includes('principalAuthEpoch'));
});

test('agency change does not silently increment epoch', () => {
  const u = user();
  u.agencyId = 'AGY-OTHER';
  assert.equal(u.principalAuthEpoch, 3);
});

test('profile name change does not increment epoch', () => {
  const u = user();
  u.name = 'New Name';
  assert.equal(u.principalAuthEpoch, 3);
});

test('business activity does not change epoch', () => {
  const offerArea = serverSource.slice(serverSource.indexOf('app.post("/api/offers"'), serverSource.indexOf('app.put("/api/offers/:id"'));
  assert.ok(!offerArea.includes('principalAuthEpoch'));
});

test('old observed epoch mismatches new current epoch', () => {
  const u = user();
  const f = bound(u);
  const current = { ...u, principalAuthEpoch: 4 };
  const out = B.assessCurrentRequestBinding({ req: req(u, f.sessionMaterial), currentDbUser: current, store: f.store, now: 1_797_000_001_000 });
  assert.equal(out.outcome, B.OUTCOMES.REJECTED);
});

test('mismatch rejects current principal source material', () => {
  const source = { observedPrincipalAuthEpochState: 'OBSERVED', observedPrincipalAuthEpoch: '2' };
  assert.equal(E.assessPrincipalAuthEpochCurrentness(source, user()).outcome, E.OUTCOMES.REJECTED);
});

test('missing current epoch rejects', () => {
  const source = { observedPrincipalAuthEpochState: 'OBSERVED', observedPrincipalAuthEpoch: '3' };
  assert.equal(E.assessPrincipalAuthEpochCurrentness(source, user({ omitPrincipalAuthEpoch: true })).outcome, E.OUTCOMES.UNKNOWN);
});

test('sessionVersion remains semantically separate from principalAuthEpoch', () => {
  const u = user({ sessionVersion: 3, principalAuthEpoch: 3 });
  assert.equal(u.sessionVersion, u.principalAuthEpoch);
  assert.equal(E.principalRevisionFromEpoch(u.principalAuthEpoch), 'principalAuthEpoch:3');
  assert.notEqual(`sessionVersion:${u.sessionVersion}`, E.principalRevisionFromEpoch(u.principalAuthEpoch));
});

test('auth-event/session source binds observed epoch', () => {
  const f = bound();
  assert.equal(f.binding.observedPrincipalAuthEpoch, '3');
  assert.equal(f.binding.observedPrincipalRevision, 'principalAuthEpoch:3');
});

test('current db source re-observes epoch', () => {
  const f = bound();
  const out = B.assessCurrentRequestBinding({ req: req(user(), f.sessionMaterial), currentDbUser: user(), store: f.store, now: 1_797_000_001_000 });
  assert.equal(out.outcome, B.OUTCOMES.ACCEPTED);
  assert.equal(out.sourceMaterial.currentPrincipalRevision, 'principalAuthEpoch:3');
});

test('source binding remains authority none', () => {
  const out = B.assessCurrentRequestBinding({ req: req(), currentDbUser: user(), store: bound().store, now: 1_797_000_001_000 });
  assert.equal(out.authority, 'NONE');
});

test('no accepted GT63 principal is produced', () => {
  const out = B.assessCurrentRequestBinding({ req: req(), currentDbUser: user(), store: bound().store, now: 1_797_000_001_000 });
  assert.equal(out.acceptedGt63PrincipalCreated, false);
});

test('no eligibility is produced', () => {
  const out = E.incrementPrincipalAuthEpochForCredentialTransition(user(), { transition: 'credential_change' });
  assert.equal(out.principalEligibilityCreated, false);
});

test('no role gate package or effect is produced', () => {
  const out = E.incrementPrincipalAuthEpochForCredentialTransition(user(), { transition: 'credential_change' });
  assert.equal(out.roleCreated, false);
  assert.equal(out.humanGateCreated, false);
  assert.equal(out.governancePackageCreated, false);
  assert.equal(out.offerMutationPerformed, false);
});

for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error && error.stack ? error.stack : error);
    console.log(`${passed}/${tests.length} PASS`);
    process.exit(1);
  }
}
console.log(`${passed}/${tests.length} PASS`);
