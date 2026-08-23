'use strict';

const assert = require('node:assert/strict');
const { CANDIDATE_SCHEMA, extractCandidate } = require('./transport/contract');
const {
  structuredProvenanceSchema,
  resolveStructuredSelections,
  expandStructuredProvenance,
  extractionResponseFromStructured
} = require('./transport/structured-provenance');

const SECTIONS = [
  'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
  'NECESSARY_COLLATERAL_CHANGES'
];
function emptyCandidate() { return Object.fromEntries(SECTIONS.map((section) => [section, []])); }
function entry(id, statement, provenance) {
  return { id, statement, provenance, targets: [], required: false, requiredFor: { kind: 'NONE', text: '', section: '', entry_id: '' } };
}
function internalRaw(spans) { return { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans }; }
function providerRaw(texts) {
  return { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], selections: texts.map((text) => ({ text })), spans: [] };
}
function response(candidate) { return { output_text: JSON.stringify(candidate), usage: { input_tokens: 1, output_tokens: 1 } }; }

const source = 'Alpha 😀 beta. Middle untouched. Gamma delta!';
const betaStart = source.indexOf('beta');
const gammaStart = source.indexOf('Gamma');
const schema = structuredProvenanceSchema(CANDIDATE_SCHEMA);
const provenanceSchema = schema.properties.EXPLICIT.items.properties.provenance.items;
const rawSchema = provenanceSchema.anyOf.find((variant) => variant.properties.source_type.enum[0] === 'RAW_TEXT');
assert.equal(rawSchema.properties.selections.type, 'array');
assert.equal(rawSchema.properties.selections.minItems, 1);
assert.equal(rawSchema.properties.spans.maxItems, 0);
assert.ok(rawSchema.required.includes('selections'));
assert.ok(rawSchema.required.includes('spans'));
assert.deepEqual(CANDIDATE_SCHEMA.properties.EXPLICIT.items.properties.provenance.items.required,
  ['source_type', 'quote', 'evidence_id', 'supports']);

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('s1', 'single', [providerRaw(['Alpha'])]));
  const resolved = resolveStructuredSelections(candidate, source);
  assert.deepEqual(resolved.EXPLICIT[0].provenance[0].spans, [{ start: 0, end: 5 }]);
  assert.equal('selections' in resolved.EXPLICIT[0].provenance[0], false);
  assert.equal(expandStructuredProvenance(resolved, source).EXPLICIT[0].provenance[0].quote, 'Alpha');
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('s2', 'multi', [providerRaw(['Gamma', 'beta'])]));
  const resolved = resolveStructuredSelections(candidate, source);
  assert.deepEqual(resolved.EXPLICIT[0].provenance[0].spans, [
    { start: betaStart, end: betaStart + 4 },
    { start: gammaStart, end: gammaStart + 5 }
  ]);
  assert.deepEqual(expandStructuredProvenance(resolved, source).EXPLICIT[0].provenance.map((p) => p.quote), ['beta', 'Gamma']);
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('s3', 'unicode', [providerRaw(['😀'])]));
  const resolved = resolveStructuredSelections(candidate, source);
  const emojiStart = source.indexOf('😀');
  assert.deepEqual(resolved.EXPLICIT[0].provenance[0].spans, [{ start: emojiStart, end: emojiStart + 2 }]);
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('s4', 'canonical', [providerRaw(['Alpha 😀 beta.'])]));
  const rawResponse = response(candidate);
  const extraction = extractionResponseFromStructured(rawResponse, source);
  assert.equal(rawResponse.output_text.includes('"selections"'), true);
  assert.equal(extraction.output_text.includes('"selections"'), false);
  assert.equal(extraction.output_text.includes('"spans"'), false);
  const accepted = extractCandidate(extraction, { id: 'X', text: source, evidence: [] });
  assert.equal(accepted.EXPLICIT[0].provenance[0].quote, 'Alpha 😀 beta.');
}

for (const [text, pattern] of [
  ['Alpha beta', /0 exact source matches/],
  ['alpha', /0 exact source matches/],
  ['Alpha requirement', /0 exact source matches/]
]) {
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('bad', 'bad selection', [providerRaw([text])]));
  assert.throws(() => resolveStructuredSelections(candidate, source), pattern);
}

{
  const repeated = 'same x same';
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('ambiguous', 'ambiguous', [providerRaw(['same'])]));
  assert.throws(() => resolveStructuredSelections(candidate, repeated), /multiple exact source matches/);
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('synthetic', 'synthetic', [providerRaw(['Alpha 😀 beta. Gamma delta!'])]));
  assert.throws(() => resolveStructuredSelections(candidate, source), /0 exact source matches/);
}

{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('provider-offset', 'offset injection', [{
    source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], selections: [{ text: 'Alpha' }], spans: [{ start: 0, end: 5 }]
  }]));
  assert.throws(() => resolveStructuredSelections(candidate, source), /provider-authored spans must be empty/);
}

// Independent second boundary remains strict for MACHINE-resolved spans.
{
  const candidate = emptyCandidate();
  candidate.EXPLICIT.push(entry('internal', 'internal span validation', [internalRaw([{ start: 0, end: 5 }])]));
  assert.equal(expandStructuredProvenance(candidate, source).EXPLICIT[0].provenance[0].quote, 'Alpha');
  candidate.EXPLICIT[0].provenance[0].spans = [{ start: 0, end: source.length + 1 }];
  assert.throws(() => expandStructuredProvenance(candidate, source), /out of range/);
}

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  providerAuthoredOffsets: 'rejected',
  exactSelectionResolution: 'unique-exact-only',
  coordinateSystem: 'MACHINE-computed UTF-16 code units, half-open [start,end)',
  zeroMatchPolicy: 'reject',
  multipleMatchPolicy: 'reject',
  fuzzyRecovery: false,
  extractorSecondBoundary: 'strict'
})}\n`);
