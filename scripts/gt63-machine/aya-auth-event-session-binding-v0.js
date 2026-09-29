'use strict';

const crypto = require('node:crypto');

const RULESET_VERSION = 'aya-auth-event-session-binding-v0.1.0';
const TYPE = 'AYA_AUTH_EVENT_SESSION_BINDING';
const AUTHORITY = 'NONE';
const BINDING_REVISION = '1';

const OUTCOMES = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  UNKNOWN: 'UNKNOWN',
  INVALID: 'INVALID'
});

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0;
}

function canonicalize(value) {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plain(value)) {
    return Object.keys(value).sort().reduce((out, key) => {
      const item = value[key];
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
        throw new TypeError('unsupported auth-event/session binding value');
      }
      out[key] = canonicalize(item);
      return out;
    }, {});
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('unsupported non-finite auth-event/session binding number');
  }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    throw new TypeError('unsupported auth-event/session binding value');
  }
  return typeof value === 'string' ? value.normalize('NFC') : value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonicalStringify(value), 'utf8')).digest('hex')}`;
}

function result(outcome, reason, material = {}) {
  return Object.freeze({
    outcome,
    reason: reason || null,
    ...clone(material),
    authority: AUTHORITY,
    acceptedGt63PrincipalCreated: false,
    principalEligibilityCreated: false,
    roleCreated: false,
    humanGateCreated: false,
    governancePackageCreated: false,
    offerMutationPerformed: false
  });
}

function accepted(material) {
  return result(OUTCOMES.ACCEPTED, null, material);
}

function rejected(reason, material) {
  return result(OUTCOMES.REJECTED, reason, material);
}

function unknown(reason, material) {
  return result(OUTCOMES.UNKNOWN, reason, material);
}

function invalid(reason, material) {
  return result(OUTCOMES.INVALID, reason, material);
}

function isoFromMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return new Date(number).toISOString();
}

function sessionPayloadFromMaterial(sessionMaterial = {}) {
  return plain(sessionMaterial.payload) ? sessionMaterial.payload : sessionMaterial;
}

function sessionRefFromMaterial(sessionMaterial = {}) {
  const payload = sessionPayloadFromMaterial(sessionMaterial);
  const refMaterial = {
    userId: payload.userId,
    agencyId: payload.agencyId,
    role: payload.role,
    sessionVersion: String(payload.sessionVersion || ''),
    iat: Number(payload.iat || 0),
    exp: Number(payload.exp || 0)
  };
  return `gt63-aya-session:${digest(refMaterial).slice('sha256:'.length)}`;
}

function validAClassEvidence(evidence) {
  return plain(evidence)
    && evidence.type === 'gt63_a_class_authentication_evidence'
    && evidence.metadata
    && nonEmpty(evidence.metadata.authenticationEventIdentity)
    && nonEmpty(evidence.metadata.evidenceIdentity)
    && Number(evidence.metadata.evidenceRevision) === 1
    && evidence.metadata.evidenceClass === 'ACCOUNT_AUTHENTICATION_EVIDENCE'
    && evidence.metadata.authenticationMethod === 'PASSWORD'
    && evidence.metadata.authenticationResult === 'SUCCESS'
    && evidence.metadata.normalPathProvenance
    && evidence.metadata.normalPathProvenance.state === 'POSITIVE'
    && evidence.metadata.normalPathProvenance.bypassExcluded === true
    && evidence.metadata.authorityEffect === AUTHORITY;
}

function bindingCore({ aClassEvidence, sessionMaterial } = {}) {
  if (!validAClassEvidence(aClassEvidence)) throw new Error('valid A-class authentication evidence required');
  const payload = sessionPayloadFromMaterial(sessionMaterial);
  if (!plain(payload)) throw new Error('issued session material required');
  if (!nonEmpty(payload.userId)) throw new Error('session userId required');
  if (aClassEvidence.userId !== payload.userId) throw new Error('A-class user does not match issued session');
  const evidenceSubject = aClassEvidence.metadata.applicationAccountSubject || {};
  const agencyId = evidenceSubject.agencyId || aClassEvidence.agencyId || 'AGY-AYA';
  if ((payload.agencyId || 'AGY-AYA') !== agencyId) throw new Error('A-class agency does not match issued session');
  if (!Number.isFinite(Number(payload.iat)) || !Number.isFinite(Number(payload.exp))) {
    throw new Error('issued session timing required');
  }
  if (Number(payload.exp) <= Number(payload.iat)) throw new Error('issued session expiry must be after issuance');
  if (!nonEmpty(String(payload.sessionVersion || ''))) throw new Error('issued sessionVersion required');
  const observedPrincipalAuthEpochState = payload.principalAuthEpoch ? 'OBSERVED' : 'UNINITIALIZED';
  const observedPrincipalAuthEpoch = payload.principalAuthEpoch ? String(payload.principalAuthEpoch) : null;
  const observedPrincipalRevision = observedPrincipalAuthEpoch
    ? `principalAuthEpoch:${observedPrincipalAuthEpoch}`
    : null;

  return canonicalize({
    type: TYPE,
    schemaVersion: '1.0',
    rulesetVersion: RULESET_VERSION,
    bindingRevision: BINDING_REVISION,
    authenticationEventIdentity: aClassEvidence.metadata.authenticationEventIdentity,
    aClassEvidenceIdentity: aClassEvidence.metadata.evidenceIdentity,
    aClassEvidenceRevision: String(aClassEvidence.metadata.evidenceRevision),
    applicationUserId: payload.userId,
    agencyId,
    sessionRef: sessionRefFromMaterial(payload),
    sessionVersion: String(payload.sessionVersion),
    observedPrincipalAuthEpochState,
    observedPrincipalAuthEpoch,
    observedPrincipalRevision,
    issuedAt: isoFromMs(payload.iat),
    expiresAt: isoFromMs(payload.exp),
    sessionMaterialDigest: digest(payload),
    aClassEvidenceDigest: digest(aClassEvidence),
    lifecycleState: 'CURRENT',
    freshnessState: 'PENDING_REQUEST_REOBSERVATION',
    contradictionState: 'NONE',
    authority: AUTHORITY
  });
}

function createAuthEventSessionBinding(input = {}) {
  let core;
  try {
    core = bindingCore(input);
  } catch (error) {
    return invalid(error.message);
  }
  const exactBindingDigest = digest(core);
  const binding = canonicalize({
    bindingRef: `gt63-aya-auth-event-session-binding:${exactBindingDigest.slice('sha256:'.length)}`,
    exactBindingDigest,
    ...core
  });
  return accepted({ binding });
}

function validateBindingIntegrity(binding = {}) {
  if (!plain(binding)) return invalid('binding required');
  if (binding.type !== TYPE || binding.rulesetVersion !== RULESET_VERSION) return rejected('binding contract mismatch');
  if (binding.authority !== AUTHORITY) return rejected('binding authority mismatch');
  if (!nonEmpty(binding.bindingRef) || !nonEmpty(binding.exactBindingDigest)) return unknown('binding identity required');
  const { bindingRef, exactBindingDigest, ...core } = binding;
  let expectedDigest;
  try {
    expectedDigest = digest(core);
  } catch (error) {
    return invalid(error.message);
  }
  if (expectedDigest !== exactBindingDigest) return rejected('binding material digest mismatch');
  if (bindingRef !== `gt63-aya-auth-event-session-binding:${exactBindingDigest.slice('sha256:'.length)}`) {
    return rejected('bindingRef mismatch');
  }
  return accepted({ binding: clone(binding) });
}

function createProcessLocalAuthEventSessionBindingStore({ maxEntries = 512 } = {}) {
  const records = new Map();
  return Object.freeze({
    commit(binding) {
      const integrity = validateBindingIntegrity(binding);
      if (integrity.outcome !== OUTCOMES.ACCEPTED) return integrity;
      if (records.size >= maxEntries && !records.has(binding.sessionRef)) {
        return unknown('binding store capacity reached');
      }
      const prior = records.get(binding.sessionRef);
      if (prior) {
        return canonicalStringify(prior) === canonicalStringify(binding)
          ? accepted({ binding: prior, replayed: true })
          : rejected('sessionRef already bound to different authentication event');
      }
      records.set(binding.sessionRef, Object.freeze(clone(binding)));
      return accepted({ binding: records.get(binding.sessionRef), replayed: false });
    },
    getBySessionRef(sessionRef) {
      return records.has(sessionRef) ? clone(records.get(sessionRef)) : null;
    },
    clear() {
      records.clear();
    },
    size() {
      return records.size;
    }
  });
}

function assessCurrentRequestBinding({
  req,
  currentDbUser,
  store,
  now = Date.now()
} = {}) {
  if (!store || typeof store.getBySessionRef !== 'function') return unknown('binding store required');
  if (!plain(req) || !plain(req.user) || !plain(req.session) || !plain(req.sessionIdentity)) {
    return unknown('authenticated request/session context required');
  }
  if (!plain(currentDbUser)) return rejected('current db user record required');
  const session = req.session;
  const user = req.user;
  const identity = req.sessionIdentity;
  if (session.betaAuthBypass === true) return rejected('beta auth bypass cannot satisfy auth-event session binding');
  if (user.id !== currentDbUser.id || session.userId !== currentDbUser.id || identity.userId !== currentDbUser.id) {
    return rejected('request user/session/current db user mismatch');
  }
  const agencyId = currentDbUser.agencyId || 'AGY-AYA';
  if ((user.agencyId || 'AGY-AYA') !== agencyId || (session.agencyId || agencyId) !== agencyId || (identity.agencyId || agencyId) !== agencyId) {
    return rejected('agency mismatch');
  }
  const sessionVersion = String(currentDbUser.sessionVersion || identity.sessionVersion || session.sessionVersion || '1');
  if (String(session.sessionVersion || sessionVersion) !== sessionVersion || String(identity.sessionVersion || sessionVersion) !== sessionVersion) {
    return rejected('sessionVersion mismatch');
  }
  if (!Number.isFinite(Number(session.exp)) || Number(session.exp) <= Number(now)) return rejected('session expired');
  const sessionRef = sessionRefFromMaterial(session);
  const binding = store.getBySessionRef(sessionRef);
  if (!binding) return unknown('auth-event session binding unavailable');
  const integrity = validateBindingIntegrity(binding);
  if (integrity.outcome !== OUTCOMES.ACCEPTED) return integrity;
  if (binding.applicationUserId !== currentDbUser.id
    || binding.agencyId !== agencyId
    || binding.sessionVersion !== sessionVersion
    || binding.sessionRef !== sessionRef
    || binding.sessionMaterialDigest !== digest(session)) {
    return rejected('current request does not match auth-event session binding');
  }
  const currentPrincipalAuthEpoch = currentDbUser.principalAuthEpoch;
  if (currentPrincipalAuthEpoch === undefined || currentPrincipalAuthEpoch === null || currentPrincipalAuthEpoch === '') {
    return unknown('current principalAuthEpoch uninitialized');
  }
  if (!Number.isInteger(Number(currentPrincipalAuthEpoch)) || Number(currentPrincipalAuthEpoch) <= 0) {
    return rejected('current principalAuthEpoch invalid');
  }
  if (binding.observedPrincipalAuthEpochState !== 'OBSERVED') {
    return unknown('principalAuthEpoch was not observed at authentication');
  }
  if (String(binding.observedPrincipalAuthEpoch || '') !== String(Number(currentPrincipalAuthEpoch))) {
    return rejected('observed principalAuthEpoch does not match current db user principalAuthEpoch');
  }
  return accepted({
    sourceMaterial: {
      type: 'AYA_AUTH_EVENT_SESSION_BOUND_SOURCE_MATERIAL',
      rulesetVersion: RULESET_VERSION,
      bindingRef: binding.bindingRef,
      authenticationEventIdentity: binding.authenticationEventIdentity,
      aClassEvidenceIdentity: binding.aClassEvidenceIdentity,
      aClassEvidenceRevision: binding.aClassEvidenceRevision,
      applicationUserId: binding.applicationUserId,
      agencyId: binding.agencyId,
      sessionRef: binding.sessionRef,
      sessionVersion: binding.sessionVersion,
      observedPrincipalAuthEpochState: binding.observedPrincipalAuthEpochState,
      observedPrincipalAuthEpoch: binding.observedPrincipalAuthEpoch,
      observedPrincipalRevision: binding.observedPrincipalRevision,
      currentPrincipalAuthEpoch: String(Number(currentPrincipalAuthEpoch)),
      currentPrincipalRevision: `principalAuthEpoch:${Number(currentPrincipalAuthEpoch)}`,
      lifecycleState: 'CURRENT',
      freshnessState: 'CURRENT',
      contradictionState: 'NONE',
      authority: AUTHORITY
    }
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  TYPE,
  AUTHORITY,
  OUTCOMES,
  BINDING_REVISION,
  canonicalStringify,
  digest,
  sessionRefFromMaterial,
  createAuthEventSessionBinding,
  validateBindingIntegrity,
  createProcessLocalAuthEventSessionBindingStore,
  assessCurrentRequestBinding
});
