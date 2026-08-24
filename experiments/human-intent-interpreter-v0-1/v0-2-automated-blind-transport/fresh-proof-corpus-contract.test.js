'use strict';

const assert = require('node:assert/strict');
const { validateFreshProofCorpusEvidence } = require('./transport/fresh-proof-corpus-contract');

function corpus(evidence) {
  return { version: 'test', cases: [{ id: 'X1', text: 'ordinary human request', evidence }] };
}

assert.equal(validateFreshProofCorpusEvidence(corpus([])), true);
assert.equal(validateFreshProofCorpusEvidence(corpus([
  { evidence_id: 'doc-1', content: 'Exact supplied evidence.' }
])), true);
assert.equal(validateFreshProofCorpusEvidence(corpus([
  { evidence_id: 'doc-1', content: 'One.' },
  { evidence_id: 'doc-2', content: 'Two.' }
])), true);

for (const [name, evidence] of [
  ['missing evidence_id', [{ content: 'One.' }]],
  ['missing content', [{ evidence_id: 'doc-1' }]],
  ['text substituted for content', [{ evidence_id: 'doc-1', text: 'One.' }]],
  ['wrong evidence_id type', [{ evidence_id: 1, content: 'One.' }]],
  ['wrong content type', [{ evidence_id: 'doc-1', content: 1 }]],
  ['empty evidence_id', [{ evidence_id: '   ', content: 'One.' }]],
  ['empty content', [{ evidence_id: 'doc-1', content: '   ' }]],
  ['additional representation field', [{ evidence_id: 'doc-1', content: 'One.', text: 'One.' }]],
  ['non-object evidence', ['One.']]
]) {
  assert.throws(() => validateFreshProofCorpusEvidence(corpus(evidence)), TypeError, name);
}

const proof8 = require('./fresh-proof-8/blind-corpus.json');
assert.throws(
  () => validateFreshProofCorpusEvidence(proof8),
  /supplied evidence fields must be exactly evidence_id, content/,
  'historical Proof 8 malformed evidence must be rejected before provider eligibility'
);

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  canonicalField: 'content',
  validAcceptedShape: 'PASS',
  multiEvidenceAccepted: 'PASS',
  malformedEvidenceRejected: 'PASS',
  textAliasRejected: 'PASS',
  additionalFieldsRejected: 'PASS',
  historicalProof8RejectedPreGeneration: 'PASS',
  modelCalls: 0
}, null, 2)}\n`);
