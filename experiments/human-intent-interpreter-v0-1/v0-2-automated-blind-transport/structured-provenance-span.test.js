'use strict';

const assert = require('node:assert/strict');
const {
  CANDIDATE_SCHEMA,
  extractCandidate
} = require('./transport/contract');
const {
  structuredProvenanceSchema,
  expandStructuredProvenance,
  extractionResponseFromStructured
} = require('./transport/structured-provenance');

function emptyCandidate() {
  return Object.fromEntries([
    'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
    'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
    'NECESSARY_COLLATERAL_CHANGES'
  ].map((section) => [section, []]));
}

function entry(id, statement, provenance) {
  return {
    id,
    statement,
    provenance,
    targets: [],
    required: false,
    requiredFor: { kind: 'NONE', text: '', section: '', entry_id: '' }
  };
}

function raw(spans) {
  return { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans };
}

function supplied(id, quote) {
  return { source_type: 'SUPPLIED_EVIDENCE', quote, evidence_id: id, supports: [], spans: [] };
}

function response(candidate) {
  return { output_text: JSON.stringify(candidate), usage: { input_tokens: 1, output_tokens: 1 } };
}

const source = 'Alpha 😀 beta. Middle untouched. Gamma delta!';
const betaStart = source.indexOf('beta');
const gammaStart = source.indexOf('Gamma');
const schema = structuredProvenanceSchema(CANDIDATE_SCHEMA);
const provenanceSchema = schema.properties.EXPLICIT.items.properties.provenance.items;
assert.equal(provenanceSchema.properties.spans.type, 'array');
assert.ok(provenanceSchema.required.includes('spans'));
assert.deepEqual(CANDIDATE_SCHEMA.properties.EXPLICIT.items.properties.provenance.items.required,
  ['source_type', 'quote', 'evidence_id', 'supports']);

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('e1', 'single', [raw([{ start: 0, end: 5 }])]));
  const expanded = expandStructuredProvenance(candidate, source);
  assert.equal(expanded.EXPLICIT[0].provenance[0].quote, 'Alpha');
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('e2', 'multi', [raw([
    { start: betaStart, end: betaStart + 4 },
    { start: gammaStart, end: gammaStart + 5 }
  ])]));
  const expanded = expandStructuredProvenance(candidate, source);
  assert.deepEqual(expanded.EXPLICIT[0].provenance.map((p) => p.quote), ['beta', 'Gamma']);
  assert.equal(expanded.EXPLICIT.length, 1);
  assert.equal(expanded.EXPLICIT[0].statement, 'multi');
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('e3', 'three', [raw([
    { start: 0, end: 5 },
    { start: betaStart, end: betaStart + 4 },
    { start: gammaStart, end: gammaStart + 5 }
  ])]));
  assert.equal(expandStructuredProvenance(candidate, source).EXPLICIT[0].provenance.length, 3);
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('e4', 'mixed', [
    raw([{ start: 0, end: 5 }]),
    supplied('doc-1', 'evidence')
  ]));
  const expanded = expandStructuredProvenance(candidate, source);
  assert.equal(expanded.EXPLICIT[0].provenance[1].evidence_id, 'doc-1');
  assert.equal('spans' in expanded.EXPLICIT[0].provenance[1], false);
}

{
  const emojiStart = source.indexOf('😀');
  assert.equal(source.slice(emojiStart, emojiStart + 2), '😀');
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('e5', 'unicode', [raw([{ start: emojiStart, end: emojiStart + 2 }])]));
  assert.equal(expandStructuredProvenance(candidate, source).EXPLICIT[0].provenance[0].quote, '😀');
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('e6', 'punctuation', [raw([{ start: 0, end: source.indexOf('.') + 1 }])]));
  assert.equal(expandStructuredProvenance(candidate, source).EXPLICIT[0].provenance[0].quote, 'Alpha 😀 beta.');
}

{
  const repeated = 'same x same';
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('e7', 'second same', [raw([{ start: 7, end: 11 }])]));
  assert.equal(expandStructuredProvenance(candidate, repeated).EXPLICIT[0].provenance[0].quote, 'same');
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('e8', 'canonical', [raw([{ start: 0, end: 5 }])]));
  const rawResponse = response(candidate);
  const extraction = extractionResponseFromStructured(rawResponse, source);
  assert.equal(rawResponse.output_text.includes('"spans"'), true);
  assert.equal(extraction.output_text.includes('"spans"'), false);
  const accepted = extractCandidate(extraction, { id: 'X', text: source, evidence: [] });
  assert.equal(accepted.EXPLICIT[0].provenance[0].quote, 'Alpha');
}

const invalid = [
  [{ start: -1, end: 2 }],
  [{ start: 0, end: source.length + 1 }],
  [{ start: 4, end: 3 }],
  [{ start: 2, end: 2 }],
  [{ start: 0.5, end: 2 }],
  [{ start: '0', end: 2 }],
  [{ start: 0, end: 2, extra: true }],
  [{ start: 0, end: 5 }, { start: 0, end: 5 }],
  [{ start: 0, end: 5 }, { start: 4, end: 8 }],
  [{ start: 7, end: 11 }, { start: 0, end: 5 }]
];
for (const spans of invalid) {
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('bad', 'bad span', [raw(spans)]));
  assert.throws(() => expandStructuredProvenance(candidate, source));
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('bad-quote', 'provider quote injection', [{
    source_type: 'RAW_TEXT', quote: 'Alpha', evidence_id: null, supports: [], spans: [{ start: 0, end: 5 }]
  }]));
  assert.throws(() => expandStructuredProvenance(candidate, source), /spans only/);
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('bad-evidence', 'masquerade', [{
    source_type: 'SUPPLIED_EVIDENCE', quote: 'x', evidence_id: 'doc', supports: [], spans: [{ start: 0, end: 1 }]
  }]));
  assert.throws(() => expandStructuredProvenance(candidate, source), /spans must be empty/);
}

{
  const original = 'Immutable source';
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('mutation', 'source identity matters', [raw([{ start: 0, end: 9 }])]));
  assert.equal(expandStructuredProvenance(candidate, original).EXPLICIT[0].provenance[0].quote, 'Immutable');
  assert.notEqual(expandStructuredProvenance(candidate, 'Mutated!! source').EXPLICIT[0].provenance[0].quote, 'Immutable');
}

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  coordinateSystem: 'UTF-16 code units, half-open [start,end)',
  overlapPolicy: 'reject',
  duplicatePolicy: 'reject',
  providerAuthoredRawQuote: 'rejected'
})}\n`);
