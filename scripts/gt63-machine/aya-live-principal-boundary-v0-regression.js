'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const B = require('./aya-auth-event-session-binding-v0');
const P = require('./aya-live-principal-boundary-v0');

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
  const bindingResult = B.createAuthEventSessionBinding({ aClassEvidence: evidence, sessionMaterial });
  assert.equal(bindingResult.outcome, B.OUTCOMES.ACCEPTED);
  const store = B.createProcessLocalAuthEventSessionBindingStore();
  const commit = store.commit(bindingResult.binding);
  assert.equal(commit.outcome, B.OUTCOMES.ACCEPTED);
  return { evidence, sessionMaterial, binding: bindingResult.binding, store };
}

function assess(options = {}) {
  const f = options.fixture || fixture(options.fixtureOptions || {});
  return P.assessLivePrincipalBoundary({
    req: options.req || req(options.reqOptions || {}),
    currentDbUser: Object.prototype.hasOwnProperty.call(options, 'currentDbUser') ? options.currentDbUser : dbUser(options.dbUserOptions || {}),
    store: Object.prototype.hasOwnProperty.call(options, 'store') ? options.store : f.store,
    authEventSessionBinding: B,
    now: options.now || 1_797_000_001_000
  });
}

function assertNoAuthority(out) {
  assert.equal(out.authority, 'NONE');
  assert.equal(out.authorityEffect, 'NONE');
  assert.equal(out.acceptedGt63PrincipalCreated, false);
  assert.equal(out.principalEligibilityCreated, false);
  assert.equal(out.roleCreated, false);
  assert.equal(out.humanGateCreated, false);
  assert.equal(out.governancePackageCreated, false);
  assert.equal(out.effectAuthorizationCreated, false);
  assert.equal(out.offerMutationPerformed, false);
}

test('fresh correctly bound session produces authenticated-principal source material', () => {
  const out = assess();
  assert.equal(out.type, 'AYA_LIVE_GT63_PRINCIPAL_SOURCE_ASSESSMENT');
  assert.equal(out.bindingAssessment, P.OUTCOMES.ACCEPTED);
  assert.equal(out.principalAuthEpochCurrentness, P.EPOCH_CURRENTNESS.CURRENT);
  assert.equal(out.sourceMaterialProduced, true);
  assert.equal(out.authenticatedPrincipalSourceMaterial.type, 'AYA_AUTHENTICATED_PRINCIPAL_SOURCE_MATERIAL');
  assert.equal(out.authenticatedPrincipalSourceMaterial.applicationUserId, 'USR-ADMIN');
  assert.equal(out.authenticatedPrincipalSourceMaterial.agencyId, 'AGY-AYA');
  assert.equal(out.authenticatedPrincipalSourceMaterial.observedPrincipalAuthEpoch, '1');
  assert.equal(out.authenticatedPrincipalSourceMaterial.currentPrincipalAuthEpoch, '1');
  assert.equal(out.authenticatedPrincipalSourceMaterial.observedPrincipalRevision, 'principalAuthEpoch:1');
  assert.equal(out.authenticatedPrincipalSourceMaterial.currentPrincipalRevision, 'principalAuthEpoch:1');
  assertNoAuthority(out);
});

test('process-local binding loss fails closed without source material', () => {
  const store = B.createProcessLocalAuthEventSessionBindingStore();
  const out = assess({ store });
  assert.equal(out.bindingAssessment, P.OUTCOMES.UNKNOWN);
  assert.equal(out.principalAuthEpochCurrentness, P.EPOCH_CURRENTNESS.UNKNOWN);
  assert.equal(out.sourceMaterialProduced, false);
  assert.equal(out.authenticatedPrincipalSourceMaterial, null);
  assertNoAuthority(out);
});

test('beta bypass is rejected without source material', () => {
  const out = assess({ reqOptions: { reqSession: { betaAuthBypass: true } } });
  assert.equal(out.bindingAssessment, P.OUTCOMES.REJECTED);
  assert.equal(out.sourceMaterialProduced, false);
  assert.equal(out.authenticatedPrincipalSourceMaterial, null);
  assertNoAuthority(out);
});

test('stale principalAuthEpoch reports mismatch and no source material', () => {
  const out = assess({ dbUserOptions: { principalAuthEpoch: 2 } });
  assert.equal(out.bindingAssessment, P.OUTCOMES.REJECTED);
  assert.equal(out.principalAuthEpochCurrentness, P.EPOCH_CURRENTNESS.MISMATCH);
  assert.equal(out.sourceMaterialProduced, false);
  assert.equal(out.authenticatedPrincipalSourceMaterial, null);
  assertNoAuthority(out);
});

test('missing principalAuthEpoch stays unknown and fails closed', () => {
  const out = assess({ currentDbUser: dbUser({ principalAuthEpoch: undefined }) });
  assert.equal(out.bindingAssessment, P.OUTCOMES.UNKNOWN);
  assert.equal(out.principalAuthEpochCurrentness, P.EPOCH_CURRENTNESS.UNKNOWN);
  assert.equal(out.sourceMaterialProduced, false);
  assert.equal(out.authenticatedPrincipalSourceMaterial, null);
  assertNoAuthority(out);
});

test('session account mismatch is rejected without source material', () => {
  const out = assess({
    reqOptions: {
      session: { userId: 'USR-OTHER' },
      userId: 'USR-OTHER',
      identity: { userId: 'USR-OTHER' }
    }
  });
  assert.equal(out.bindingAssessment, P.OUTCOMES.REJECTED);
  assert.equal(out.sourceMaterialProduced, false);
  assert.equal(out.authenticatedPrincipalSourceMaterial, null);
  assertNoAuthority(out);
});

test('successful source assessment does not create downstream authority', () => {
  const out = assess();
  assert.equal(out.sourceMaterialProduced, true);
  assertNoAuthority(out);
});

test('incomplete accepted binding material is not upgraded into source material', () => {
  const out = P.assessLivePrincipalBoundary({
    bindingAssessment: {
      outcome: B.OUTCOMES.ACCEPTED,
      sourceMaterial: {
        applicationUserId: 'USR-ADMIN',
        agencyId: 'AGY-AYA',
        observedPrincipalAuthEpoch: '1',
        currentPrincipalAuthEpoch: '1'
      }
    }
  });
  assert.equal(out.bindingAssessment, P.OUTCOMES.UNKNOWN);
  assert.equal(out.principalAuthEpochCurrentness, P.EPOCH_CURRENTNESS.UNKNOWN);
  assert.equal(out.sourceMaterialProduced, false);
  assertNoAuthority(out);
});

test('server wires live principal boundary through requireAuthApi', () => {
  const requireStart = serverSource.indexOf('function requireAuthApi');
  const requireEnd = serverSource.indexOf('function isPublicApiRequest', requireStart);
  const source = serverSource.slice(requireStart, requireEnd);
  assert.ok(source.includes('req.gt63PrincipalAssessment = assessGt63LivePrincipalForRequest(req);'));
  assert.ok(source.indexOf('req.sessionIdentity = context.identity;') < source.indexOf('req.gt63PrincipalAssessment = assessGt63LivePrincipalForRequest(req);'));
  assert.ok(source.indexOf('req.gt63PrincipalAssessment = assessGt63LivePrincipalForRequest(req);') < source.indexOf('next();'));
});

test('auth me exposes assessment through existing authenticated endpoint', () => {
  const routeStart = serverSource.indexOf('app.get("/api/auth/me"');
  const routeEnd = serverSource.indexOf('function createAClassAuthenticationCaptureContext', routeStart);
  const source = serverSource.slice(routeStart, routeEnd);
  assert.ok(source.includes('gt63PrincipalAssessment: req.gt63PrincipalAssessment || null'));
});

test('live principal boundary does not add maintenance or offer execution endpoints', () => {
  assert.equal(serverSource.includes('app.post("/api/gt63/principal'), false);
  assert.equal(serverSource.includes('app.get("/api/gt63/principal'), false);
  const offerCreateStart = serverSource.indexOf('app.post("/api/offers"');
  const offerCreateEnd = serverSource.indexOf('app.put("/api/offers/:id"', offerCreateStart);
  const offerCreate = serverSource.slice(offerCreateStart, offerCreateEnd);
  assert.equal(offerCreate.includes('gt63PrincipalAssessment'), false);
  assert.equal(offerCreate.includes('assessGt63LivePrincipalForRequest'), false);
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
