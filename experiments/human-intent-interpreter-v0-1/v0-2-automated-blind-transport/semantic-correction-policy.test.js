'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  SEMANTIC_POLICY_VERSION,
  SEMANTIC_RULES,
  deriveSemanticRoles,
  renderSemanticPolicy
} = require('./transport/semantic-policy');

function roles(signal) {
  return deriveSemanticRoles(signal);
}

const positive = [
  {
    id: 'requested-core-is-authorized-not-proposed',
    signal: { humanStated: true, requestedCoreAction: true },
    expected: ['AUTHORIZED', 'EXPLICIT']
  },
  {
    id: 'preservation-is-locked-and-violation-is-not-authorized',
    signal: { humanStated: true, preservationInvariant: true, violatesLockedInvariant: true },
    expected: ['EXPLICIT', 'LOCKED', 'NOT_AUTHORIZED']
  },
  {
    id: 'material-unknown-is-preserved-without-global-gate',
    signal: { humanStated: true, materialUnknown: true },
    expected: ['EXPLICIT', 'UNKNOWN']
  },
  {
    id: 'derived-meaning-stays-inferred',
    signal: { derived: true },
    expected: ['INFERRED']
  },
  {
    id: 'proposal-handling-authorized-outcome-still-proposed',
    signal: { humanStated: true, permittedProposalHandling: true, optionalOutcome: true },
    expected: ['AUTHORIZED', 'EXPLICIT', 'PROPOSED']
  },
  {
    id: 'optional-implementation-withheld',
    signal: { optionalOutcomeImplementation: true, implementationAuthorized: false },
    expected: ['NOT_AUTHORIZED']
  },
  {
    id: 'explicit-approval-reservation-is-targeted-gate',
    signal: { humanStated: true, humanApprovalReserved: true, explicitlyProhibited: true },
    expected: ['EXPLICIT', 'HUMAN_GATES', 'NOT_AUTHORIZED']
  },
  {
    id: 'unknown-prerequisite-gates-only-dependent-action',
    signal: { materialUnknown: true, unknownBlocksThisAction: true },
    expected: ['HUMAN_GATES', 'UNKNOWN']
  },
  {
    id: 'delegated-mechanics-are-authorized-not-proposed',
    signal: { humanStated: true, delegatedAction: true, necessaryMechanic: true },
    expected: ['AUTHORIZED', 'EXPLICIT']
  }
];

for (const test of positive) assert.deepEqual(roles(test.signal), test.expected, test.id);

const rendered = renderSemanticPolicy();
assert.equal(SEMANTIC_POLICY_VERSION, 'hii-v0.2-systemic-semantic-boundaries-v1');
assert.equal(SEMANTIC_RULES.length, 11);
for (const required of [
  'distinct semantic roles, not mutually exclusive buckets',
  'UNKNOWN does not by itself revoke unrelated authority',
  'the presentation or evaluation action is AUTHORIZED',
  'the optional outcome remains PROPOSED',
  'implementation or inclusion is NOT_AUTHORIZED unless separately authorized',
  'A gate blocks only that dependent action',
  'A plain prohibition with no approval path is NOT_AUTHORIZED, not automatically a HUMAN_GATE'
]) assert.ok(rendered.includes(required), required);

for (const forbidden of [
  'Architecture', 'Software', 'Travel', 'Knowledge',
  'Run #6', 'A13', 'S13', 'T13', 'K13',
  'facade', 'hotel', 'repository', 'webhook'
]) assert.equal(rendered.includes(forbidden), false, `provider-neutral/domain-neutral policy contains ${forbidden}`);

const first = crypto.createHash('sha256').update(rendered).digest('hex');
const second = crypto.createHash('sha256').update(renderSemanticPolicy()).digest('hex');
assert.equal(first, second);

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  semanticPolicyVersion: SEMANTIC_POLICY_VERSION,
  positiveCases: positive.length,
  providerNeutral: true,
  domainNeutral: true,
  deterministicIdentity: first
}, null, 2)}\n`);
