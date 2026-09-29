'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('./aya-auth-event-session-binding-v0');

const ROOT = path.resolve(__dirname, '..', '..');
const serverSource = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function aClass(overrides = {}) {
  const nonce = overrides.nonce || 'a'.repeat(32);
  const userId = overrides.userId || 'USR-ADMIN';
  const agencyId = overrides.agencyId || 'AGY-AYA';
  return {
    id: `gt63-activity:a-class:${nonce}`,
    type: 'gt63_a_class_authentication_evidence',
    category: 'auth',
    userId,
    actorType: 'user',
    offerId: null,
    clientId: null,
    agencyId,
    timestamp: '2026-09-29T09:00:00.000Z',
    createdAt: '2026-09-29T09:00:00.000Z',
    metadata: {
      evidenceIdentity: `gt63-evidence:a-class:${nonce}`,
      evidenceRevision: overrides.evidenceRevision || 1,
      authenticationEventIdentity: `gt63-auth-event:${nonce}`,
      evidenceClass: 'ACCOUNT_AUTHENTICATION_EVIDENCE',
      applicationAccountSubject: { id: userId, email: 'admin@example.test', agencyId },
      authenticationMethod: 'PASSWORD',
      authenticationResult: 'SUCCESS',
      normalPathProvenance: {
        state: 'POSITIVE',
        bypassExcluded: true,
        source: 'NORMAL_PASSWORD_VERIFICATION'
      },
      authorityEffect: 'NONE',
      nonClaims: {
        acceptedByGt63: false,
        downstreamAuthority: false
      },
      ...(overrides.metadata || {})
    }
  };
}

function session(overrides = {}) {
  return {
    userId: overrides.userId || 'USR-ADMIN',
    agencyId: overrides.agencyId || 'AGY-AYA',
    role: overrides.role || 'admin',
    sessionVersion: overrides.sessionVersion || 1,
    principalAuthEpoch: Object.prototype.hasOwnProperty.call(overrides, 'principalAuthEpoch') ? overrides.principalAuthEpoch : 1,
    iat: overrides.iat || 1_797_000_000_000,
    exp: overrides.exp || 1_797_000_600_000
  };
}

function req(overrides = {}) {
  const s = session(overrides.session || {});
  const user = {
    id: overrides.userId || s.userId,
    name: 'Admin',
    agencyId: overrides.agencyId || s.agencyId,
    role: 'admin',
    sessionVersion: overrides.sessionVersion || s.sessionVersion,
    principalAuthEpoch: Object.prototype.hasOwnProperty.call(overrides, 'principalAuthEpoch') ? overrides.principalAuthEpoch : s.principalAuthEpoch
  };
  return {
    user,
    session: { ...s, ...(overrides.reqSession || {}) },
    sessionIdentity: {
      userId: user.id,
      agencyId: user.agencyId,
      role: user.role,
      sessionVersion: user.sessionVersion,
      principalAuthEpoch: user.principalAuthEpoch,
      ...(overrides.identity || {})
    }
  };
}

function dbUser(overrides = {}) {
  return {
    id: overrides.id || 'USR-ADMIN',
    name: 'Admin',
    agencyId: overrides.agencyId || 'AGY-AYA',
    role: 'admin',
    sessionVersion: overrides.sessionVersion || 1,
    principalAuthEpoch: Object.prototype.hasOwnProperty.call(overrides, 'principalAuthEpoch') ? overrides.principalAuthEpoch : 1
  };
}

function fixture(options = {}) {
  const evidence = aClass(options.aClass || {});
  const sessionMaterial = session(options.session || {});
  const bindingResult = M.createAuthEventSessionBinding({ aClassEvidence: evidence, sessionMaterial });
  assert.equal(bindingResult.outcome, M.OUTCOMES.ACCEPTED);
  const store = M.createProcessLocalAuthEventSessionBindingStore();
  const commit = store.commit(bindingResult.binding);
  assert.equal(commit.outcome, M.OUTCOMES.ACCEPTED);
  return { evidence, sessionMaterial, binding: bindingResult.binding, store };
}

test('live insertion order is after A-class persistence and before cookie issuance', () => {
  const loginStart = serverSource.indexOf('app.post("/api/auth/login"');
  const loginEnd = serverSource.indexOf('app.post("/api/auth/register"', loginStart);
  const login = serverSource.slice(loginStart, loginEnd);
  const persist = login.indexOf('aClassEvidence = persistAClassAuthenticationEvidence');
  const bind = login.indexOf('createAuthEventSessionBinding');
  const commit = login.indexOf('gt63AyaAuthEventSessionBindingStore.commit');
  const cookie = login.indexOf('setSessionCookie(res, signSessionMaterial(sessionMaterial))');
  assert.ok(persist > 0);
  assert.ok(bind > persist);
  assert.ok(commit > bind);
  assert.ok(cookie > commit);
});

test('server constructs exact session material once for login binding and cookie', () => {
  const login = serverSource.slice(serverSource.indexOf('app.post("/api/auth/login"'), serverSource.indexOf('app.post("/api/auth/register"'));
  assert.ok(login.includes('const sessionMaterial = createSessionMaterial(user);'));
  assert.ok(login.includes('sessionMaterial'));
  assert.ok(!login.includes('setSessionCookie(res, signSession(user))'));
});

test('successful normal login material can create exact binding', () => {
  const f = fixture();
  assert.equal(f.binding.authenticationEventIdentity, f.evidence.metadata.authenticationEventIdentity);
  assert.equal(f.binding.aClassEvidenceIdentity, f.evidence.metadata.evidenceIdentity);
  assert.equal(f.binding.aClassEvidenceRevision, '1');
  assert.equal(f.binding.observedPrincipalAuthEpoch, '1');
  assert.equal(f.binding.observedPrincipalRevision, 'principalAuthEpoch:1');
});

test('binding references exact issued session', () => {
  const f = fixture();
  assert.equal(f.binding.sessionRef, M.sessionRefFromMaterial(f.sessionMaterial));
  assert.equal(f.binding.sessionMaterialDigest, M.digest(f.sessionMaterial));
});

test('later same-session lookup succeeds', () => {
  const f = fixture();
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: f.store, now: 1_797_000_001_000 });
  assert.equal(out.outcome, M.OUTCOMES.ACCEPTED);
  assert.equal(out.sourceMaterial.bindingRef, f.binding.bindingRef);
});

test('different session rejects', () => {
  const f = fixture();
  const out = M.assessCurrentRequestBinding({
    req: req({ session: { iat: 1_797_000_010_000, exp: 1_797_000_610_000 } }),
    currentDbUser: dbUser(),
    store: f.store,
    now: 1_797_000_011_000
  });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
});

test('login B cannot use binding A', () => {
  const a = fixture();
  const b = fixture({ aClass: { nonce: 'b'.repeat(32) }, session: { iat: 1_797_000_020_000, exp: 1_797_000_620_000 } });
  assert.notEqual(a.binding.bindingRef, b.binding.bindingRef);
  const out = M.assessCurrentRequestBinding({
    req: req({ session: { iat: 1_797_000_020_000, exp: 1_797_000_620_000 } }),
    currentDbUser: dbUser(),
    store: a.store,
    now: 1_797_000_021_000
  });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
});

test('different user rejects at binding creation', () => {
  assert.equal(M.createAuthEventSessionBinding({
    aClassEvidence: aClass({ userId: 'USR-A' }),
    sessionMaterial: session({ userId: 'USR-B' })
  }).outcome, M.OUTCOMES.INVALID);
});

test('different agency rejects at binding creation', () => {
  assert.equal(M.createAuthEventSessionBinding({
    aClassEvidence: aClass({ agencyId: 'AGY-A' }),
    sessionMaterial: session({ agencyId: 'AGY-B' })
  }).outcome, M.OUTCOMES.INVALID);
});

test('sessionVersion mismatch rejects current request', () => {
  const f = fixture();
  const out = M.assessCurrentRequestBinding({
    req: req({ reqSession: { sessionVersion: 1 }, identity: { sessionVersion: 1 } }),
    currentDbUser: dbUser({ sessionVersion: 2 }),
    store: f.store,
    now: 1_797_000_001_000
  });
  assert.equal(out.outcome, M.OUTCOMES.REJECTED);
});

test('expired session rejects', () => {
  const f = fixture({ session: { exp: 1_797_000_000_500 } });
  const out = M.assessCurrentRequestBinding({ req: req({ session: { exp: 1_797_000_000_500 } }), currentDbUser: dbUser(), store: f.store, now: 1_797_000_001_000 });
  assert.equal(out.outcome, M.OUTCOMES.REJECTED);
});

test('beta bypass cannot create qualifying current binding', () => {
  const f = fixture();
  const out = M.assessCurrentRequestBinding({ req: req({ reqSession: { betaAuthBypass: true } }), currentDbUser: dbUser(), store: f.store, now: 1_797_000_001_000 });
  assert.equal(out.outcome, M.OUTCOMES.REJECTED);
});

test('missing binding rejects lookup', () => {
  const store = M.createProcessLocalAuthEventSessionBindingStore();
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store, now: 1_797_000_001_000 });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
});

test('missing A-class source rejects binding', () => {
  assert.equal(M.createAuthEventSessionBinding({ aClassEvidence: null, sessionMaterial: session() }).outcome, M.OUTCOMES.INVALID);
});

test('contradictory binding rejects integrity', () => {
  const f = fixture();
  const altered = { ...f.binding, applicationUserId: 'USR-OTHER' };
  assert.equal(M.validateBindingIntegrity(altered).outcome, M.OUTCOMES.REJECTED);
});

test('process loss fails closed', () => {
  const f = fixture();
  f.store.clear();
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: f.store, now: 1_797_000_001_000 });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
});

test('binding creation failure prevents cookie issuance path', () => {
  const login = serverSource.slice(serverSource.indexOf('app.post("/api/auth/login"'), serverSource.indexOf('app.post("/api/auth/register"'));
  assert.ok(login.includes('sessionIssued: false'));
  assert.ok(login.indexOf('if (authEventSessionBinding.outcome') < login.indexOf('setSessionCookie(res, signSessionMaterial(sessionMaterial))'));
  assert.ok(login.indexOf('if (bindingCommit.outcome') < login.indexOf('setSessionCookie(res, signSessionMaterial(sessionMaterial))'));
});

test('orphan binding cannot bind unrelated session', () => {
  const f = fixture();
  const out = M.assessCurrentRequestBinding({
    req: req({ session: { iat: 1_797_000_090_000, exp: 1_797_000_690_000 } }),
    currentDbUser: dbUser(),
    store: f.store,
    now: 1_797_000_091_000
  });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
});

test('binding authority remains none', () => {
  const f = fixture();
  assert.equal(f.binding.authority, 'NONE');
});

test('binding creates no accepted principal', () => {
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: fixture().store, now: 1_797_000_001_000 });
  assert.equal(out.acceptedGt63PrincipalCreated, false);
});

test('binding creates no eligibility', () => {
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: fixture().store, now: 1_797_000_001_000 });
  assert.equal(out.principalEligibilityCreated, false);
});

test('binding creates no role', () => {
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: fixture().store, now: 1_797_000_001_000 });
  assert.equal(out.roleCreated, false);
});

test('binding creates no human gate or governance package', () => {
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: fixture().store, now: 1_797_000_001_000 });
  assert.equal(out.humanGateCreated, false);
  assert.equal(out.governancePackageCreated, false);
});

test('binding creates no offer mutation', () => {
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: fixture().store, now: 1_797_000_001_000 });
  assert.equal(out.offerMutationPerformed, false);
});

test('historical A-class evidence alone rejects', () => {
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: M.createProcessLocalAuthEventSessionBindingStore(), now: 1_797_000_001_000 });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
});

test('current session alone does not prove auth-event binding', () => {
  const out = M.assessCurrentRequestBinding({ req: req(), currentDbUser: dbUser(), store: M.createProcessLocalAuthEventSessionBindingStore(), now: 1_797_000_001_000 });
  assert.equal(out.outcome, M.OUTCOMES.UNKNOWN);
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
