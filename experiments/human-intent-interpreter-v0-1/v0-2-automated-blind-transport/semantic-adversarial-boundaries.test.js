'use strict';

const assert = require('node:assert/strict');
const { deriveSemanticRoles } = require('./transport/semantic-policy');

function has(signal, role) {
  return deriveSemanticRoles(signal).includes(role);
}

const adversarial = [
  {
    id: 'evaluation-permission-does-not-authorize-implementation',
    signal: {
      humanStated: true,
      permittedProposalHandling: true,
      optionalOutcome: true,
      optionalOutcomeImplementation: true,
      implementationAuthorized: false,
      humanApprovalReserved: true
    },
    require: ['EXPLICIT', 'AUTHORIZED', 'PROPOSED', 'NOT_AUTHORIZED', 'HUMAN_GATES']
  },
  {
    id: 'unknown-does-not-create-gate-when-action-independent',
    signal: { humanStated: true, materialUnknown: true, requestedCoreAction: true, unknownBlocksThisAction: false },
    require: ['EXPLICIT', 'UNKNOWN', 'AUTHORIZED'],
    forbid: ['HUMAN_GATES', 'PROPOSED']
  },
  {
    id: 'plain-prohibition-is-not-gate',
    signal: { humanStated: true, explicitlyProhibited: true },
    require: ['EXPLICIT', 'NOT_AUTHORIZED'],
    forbid: ['HUMAN_GATES', 'PROPOSED', 'UNKNOWN']
  },
  {
    id: 'lock-is-not-unknown',
    signal: { humanStated: true, preservationInvariant: true },
    require: ['EXPLICIT', 'LOCKED'],
    forbid: ['UNKNOWN', 'PROPOSED']
  },
  {
    id: 'requested-execution-never-becomes-proposal',
    signal: { humanStated: true, requestedCoreAction: true, delegatedAction: true },
    require: ['EXPLICIT', 'AUTHORIZED'],
    forbid: ['PROPOSED']
  },
  {
    id: 'inference-cannot-become-explicit-by-itself',
    signal: { derived: true, humanStated: false },
    require: ['INFERRED'],
    forbid: ['EXPLICIT']
  },
  {
    id: 'approval-gate-does-not-authorize-current-action',
    signal: { humanStated: true, humanApprovalReserved: true, optionalOutcomeImplementation: true, implementationAuthorized: false },
    require: ['EXPLICIT', 'NOT_AUTHORIZED', 'HUMAN_GATES'],
    forbid: ['AUTHORIZED']
  }
];

for (const test of adversarial) {
  for (const role of test.require || []) assert.equal(has(test.signal, role), true, `${test.id}: missing ${role}`);
  for (const role of test.forbid || []) assert.equal(has(test.signal, role), false, `${test.id}: false ${role}`);
}

const crossDomain = [
  ['Architecture', 'museum display finish'],
  ['Software', 'cache diagnostic'],
  ['Travel', 'ferry comparison'],
  ['Knowledge', 'archive citation review']
].map(([domain, subject]) => ({
  domain,
  subject,
  roles: deriveSemanticRoles({
    humanStated: true,
    materialUnknown: true,
    requestedCoreAction: true,
    unknownBlocksThisAction: false,
    preservationInvariant: true
  })
}));

const expectedCrossDomain = ['AUTHORIZED', 'EXPLICIT', 'LOCKED', 'UNKNOWN'];
for (const result of crossDomain) assert.deepEqual(result.roles, expectedCrossDomain, result.domain);
assert.equal(new Set(crossDomain.map((item) => JSON.stringify(item.roles))).size, 1);

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  adversarialCases: adversarial.length,
  crossDomainCases: crossDomain.map(({ domain }) => domain),
  crossDomainRoles: expectedCrossDomain,
  dependentActionScoping: 'PASS',
  explicitInferredSeparation: 'PASS',
  lockedUnknownSeparation: 'PASS',
  authorizedProposedSeparation: 'PASS',
  authorizedNotAuthorizedSeparation: 'PASS'
}, null, 2)}\n`);
