'use strict';

const RULESET_VERSION = 'aya-principal-auth-epoch-v0.1.0';
const AUTHORITY = 'NONE';

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

function isPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function hasExplicitPrincipalAuthEpoch(user = {}) {
  return plain(user) && Object.prototype.hasOwnProperty.call(user, 'principalAuthEpoch');
}

function getPrincipalAuthEpoch(user = {}) {
  if (!plain(user)) return unknown('current db user record required');
  if (!hasExplicitPrincipalAuthEpoch(user)) return unknown('principalAuthEpoch uninitialized');
  if (!isPositiveInteger(user.principalAuthEpoch)) return rejected('principalAuthEpoch must be a positive integer');
  return accepted({ principalAuthEpoch: Number(user.principalAuthEpoch) });
}

function principalRevisionFromEpoch(epoch) {
  if (!isPositiveInteger(epoch)) return null;
  return `principalAuthEpoch:${Number(epoch)}`;
}

function initializePrincipalAuthEpochForNewUser(user = {}) {
  if (!plain(user)) return invalid('new user record required');
  if (hasExplicitPrincipalAuthEpoch(user)) {
    return isPositiveInteger(user.principalAuthEpoch)
      ? accepted({ user, principalAuthEpoch: Number(user.principalAuthEpoch), initialized: false })
      : rejected('existing new-user principalAuthEpoch is invalid');
  }
  user.principalAuthEpoch = 1;
  return accepted({ user, principalAuthEpoch: 1, initialized: true });
}

function incrementPrincipalAuthEpochForCredentialTransition(user = {}, { transition } = {}) {
  if (!plain(user)) return invalid('user record required');
  if (!transition) return invalid('credential/security transition required');
  const current = getPrincipalAuthEpoch(user);
  if (current.outcome !== OUTCOMES.ACCEPTED) return current;
  const next = current.principalAuthEpoch + 1;
  user.principalAuthEpoch = next;
  return accepted({
    user,
    principalAuthEpochBefore: current.principalAuthEpoch,
    principalAuthEpochAfter: next,
    transition
  });
}

function observePrincipalAuthEpochAtAuthentication(user = {}) {
  const current = getPrincipalAuthEpoch(user);
  if (current.outcome !== OUTCOMES.ACCEPTED) {
    return accepted({
      observedPrincipalAuthEpochState: 'UNINITIALIZED',
      observedPrincipalAuthEpoch: null,
      observedPrincipalRevision: null
    });
  }
  return accepted({
    observedPrincipalAuthEpochState: 'OBSERVED',
    observedPrincipalAuthEpoch: String(current.principalAuthEpoch),
    observedPrincipalRevision: principalRevisionFromEpoch(current.principalAuthEpoch)
  });
}

function assessPrincipalAuthEpochCurrentness(sourceMaterial = {}, currentDbUser = {}) {
  if (!plain(sourceMaterial)) return unknown('source material required');
  const current = getPrincipalAuthEpoch(currentDbUser);
  if (current.outcome !== OUTCOMES.ACCEPTED) return current;
  if (sourceMaterial.observedPrincipalAuthEpochState !== 'OBSERVED') {
    return unknown('principalAuthEpoch was not observed at authentication');
  }
  if (String(sourceMaterial.observedPrincipalAuthEpoch || '') !== String(current.principalAuthEpoch)) {
    return rejected('observed principalAuthEpoch does not match current db user principalAuthEpoch');
  }
  return accepted({
    principalAuthEpoch: current.principalAuthEpoch,
    principalRevision: principalRevisionFromEpoch(current.principalAuthEpoch),
    lifecycleState: 'CURRENT',
    freshnessState: 'CURRENT',
    contradictionState: 'NONE'
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  hasExplicitPrincipalAuthEpoch,
  getPrincipalAuthEpoch,
  principalRevisionFromEpoch,
  initializePrincipalAuthEpochForNewUser,
  incrementPrincipalAuthEpochForCredentialTransition,
  observePrincipalAuthEpochAtAuthentication,
  assessPrincipalAuthEpochCurrentness
});
