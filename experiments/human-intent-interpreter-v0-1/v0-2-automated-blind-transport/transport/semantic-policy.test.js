'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  CLASSIFICATION_ORDER,
  MULTI_ROLE_RULES,
  ROLE_DEFINITIONS,
  SEMANTIC_PROTOCOL,
  applySemanticProtocol
} = require('./semantic-policy');

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const REQUIRED_ROLES = [
  'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'PROPOSED', 'HUMAN_GATES'
];

for (const role of REQUIRED_ROLES) {
  assert.equal(typeof ROLE_DEFINITIONS[role], 'string', `${role} rule missing`);
  assert.ok(ROLE_DEFINITIONS[role].length > 40, `${role} rule is not substantive`);
  assert.ok(SEMANTIC_PROTOCOL.includes(`${role}:`), `${role} is absent from protocol`);
}

assert.deepEqual(CLASSIFICATION_ORDER, [
  'EXPLICIT', 'OUTCOME', 'LOCKED', 'UNKNOWN', 'AUTHORIZED',
  'NOT_AUTHORIZED', 'HUMAN_GATES', 'PROPOSED', 'INFERRED'
]);

const forbiddenProviderOrCaseTokens = [
  'gpt-4.1', 'OpenAI', 'Gemini', 'Claude',
  'A13', 'A14', 'S13', 'S14', 'T13', 'T14', 'K13', 'K14',
  'hidden-gold.json'
];
for (const token of forbiddenProviderOrCaseTokens) {
  assert.equal(SEMANTIC_PROTOCOL.includes(token), false, `protocol leaks provider/case token ${token}`);
}

const multiRole = MULTI_ROLE_RULES.find((item) => item.includes('Do not change X unless I approve it'));
assert.ok(multiRole);
for (const role of ['EXPLICIT', 'LOCKED', 'NOT_AUTHORIZED', 'HUMAN_GATES']) {
  assert.ok(multiRole.includes(role), `multi-role preservation rule misses ${role}`);
}

const requested = MULTI_ROLE_RULES.find((item) => item.includes('Requested core execution'));
assert.ok(requested && requested.includes('AUTHORIZED') && requested.includes('not PROPOSED'));

const proposal = MULTI_ROLE_RULES.find((item) => item.includes('Authorization to present or evaluate'));
for (const role of ['AUTHORIZED', 'PROPOSED', 'NOT_AUTHORIZED']) {
  assert.ok(proposal && proposal.includes(role), `proposal boundary misses ${role}`);
}

const blockingUnknown = MULTI_ROLE_RULES.find((item) => item.includes('UNKNOWN blocks only'));
assert.ok(blockingUnknown && blockingUnknown.includes('specific action'));
assert.ok(blockingUnknown && blockingUnknown.includes('unrelated authorized work'));

const baseEnvelope = Object.freeze({
  protocolVersion: 'hii-v0.1-accepted',
  caseId: 'synthetic',
  language: 'en',
  text: 'Change the finish. Keep the door unchanged.',
  evidence: [],
  instructions: 'BASE',
  outputSchema: Object.freeze({ type: 'object' })
});

const first = applySemanticProtocol(baseEnvelope);
const second = applySemanticProtocol(baseEnvelope);

assert.equal(first.text, baseEnvelope.text);
assert.equal(first.outputSchema, baseEnvelope.outputSchema);
assert.equal(first.instructions.startsWith('BASE\n\n'), true);
assert.equal(first.instructions.endsWith(SEMANTIC_PROTOCOL), true);
assert.equal(sha(first), sha(second), 'semantic protocol application is not deterministic');
assert.equal(baseEnvelope.instructions, 'BASE', 'base envelope was mutated');

assert.ok(SEMANTIC_PROTOCOL.includes('Semantic sections are roles, not mutually exclusive buckets.'));
assert.ok(SEMANTIC_PROTOCOL.includes('Prefer semantic completeness over compactness.'));
assert.ok(SEMANTIC_PROTOCOL.includes('Do not manufacture UNKNOWN entries from irrelevant omissions.'));
assert.ok(SEMANTIC_PROTOCOL.includes('A future action that is allowed only after approval is NOT_AUTHORIZED now.'));
assert.ok(SEMANTIC_PROTOCOL.includes('it does not block unrelated authorized work'));

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  providerNeutral: true,
  requiredRoles: REQUIRED_ROLES.length,
  multiRoleRules: MULTI_ROLE_RULES.length,
  deterministicIdentity: sha(first)
})}\n`);
