'use strict';

const assert = require('node:assert/strict');
const { CANDIDATE_SCHEMA } = require('./transport/contract');
const {
  structuredProvenanceSchema,
  expandStructuredProvenance
} = require('./transport/structured-provenance');

const SECTIONS = [
  'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
  'NECESSARY_COLLATERAL_CHANGES'
];

function emptyCandidate() {
  return Object.fromEntries(SECTIONS.map((section) => [section, []]));
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

function schemaAcceptsValue(schema, value) {
  if (schema.anyOf) return schema.anyOf.filter((variant) => schemaAcceptsValue(variant, value)).length === 1;
  if (schema.type === 'null') return value === null;
  if (Array.isArray(schema.type)) return schema.type.some((type) => schemaAcceptsValue({ ...schema, type }, value));
  if (schema.type === 'string') {
    if (typeof value !== 'string') return false;
    if (schema.enum && !schema.enum.includes(value)) return false;
    return true;
  }
  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) return false;
    if (schema.minimum !== undefined && value < schema.minimum) return false;
    return true;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return false;
    if (schema.minItems !== undefined && value.length < schema.minItems) return false;
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return false;
    return value.every((item) => schemaAcceptsValue(schema.items, item));
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    if ((schema.required || []).some((key) => !(key in value))) return false;
    if (schema.additionalProperties === false && keys.some((key) => !(key in schema.properties))) return false;
    return Object.entries(schema.properties || {}).every(([key, propertySchema]) =>
      !(key in value) || schemaAcceptsValue(propertySchema, value[key]));
  }
  return true;
}

const structured = structuredProvenanceSchema(CANDIDATE_SCHEMA);
const provenance = structured.properties.EXPLICIT.items.properties.provenance.items;
assert.ok(Array.isArray(provenance.anyOf));
assert.equal(provenance.anyOf.length, 3);
const byType = Object.fromEntries(provenance.anyOf.map((variant) => [
  variant.properties.source_type.enum[0], variant
]));
assert.deepEqual(Object.keys(byType).sort(), ['INFERENCE', 'RAW_TEXT', 'SUPPLIED_EVIDENCE']);

const raw = {
  source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [],
  spans: [{ start: 0, end: 5 }]
};
const rawMulti = {
  source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [],
  spans: [{ start: 0, end: 5 }, { start: 12, end: 17 }]
};
const supplied = {
  source_type: 'SUPPLIED_EVIDENCE', quote: 'Exact evidence', evidence_id: 'doc-1', supports: [], spans: []
};
const inference = {
  source_type: 'INFERENCE', quote: null, evidence_id: null,
  supports: [{ quote: 'Alpha', evidence_id: null }, { quote: null, evidence_id: 'doc-1' }], spans: []
};

assert.equal(schemaAcceptsValue(provenance, raw), true);
assert.equal(schemaAcceptsValue(provenance, rawMulti), true);
assert.equal(schemaAcceptsValue(provenance, supplied), true);
assert.equal(schemaAcceptsValue(provenance, inference), true);

assert.equal(schemaAcceptsValue(provenance, { ...raw, quote: 'Alpha' }), false,
  'RAW_TEXT + active quote must be structurally impossible');
assert.equal(schemaAcceptsValue(provenance, { ...raw, evidence_id: 'doc-1' }), false,
  'RAW_TEXT + evidence_id must be structurally impossible');
assert.equal(schemaAcceptsValue(provenance, {
  ...raw, supports: [{ quote: 'Alpha', evidence_id: null }]
}), false, 'RAW_TEXT + supports must be structurally impossible');
assert.equal(schemaAcceptsValue(provenance, { ...raw, spans: [] }), false,
  'RAW_TEXT must require at least one span');
assert.equal(schemaAcceptsValue(provenance, { ...supplied, spans: [{ start: 0, end: 5 }] }), false,
  'SUPPLIED_EVIDENCE must require empty spans');
assert.equal(schemaAcceptsValue(provenance, { ...inference, spans: [{ start: 0, end: 5 }] }), false,
  'INFERENCE must require empty spans');
assert.equal(schemaAcceptsValue(provenance, { ...inference, supports: [] }), false,
  'INFERENCE must remain supported');

assert.deepEqual(byType.RAW_TEXT.properties.quote, { type: 'null' });
assert.deepEqual(byType.RAW_TEXT.properties.evidence_id, { type: 'null' });
assert.equal(byType.RAW_TEXT.properties.supports.maxItems, 0);
assert.equal(byType.RAW_TEXT.properties.spans.minItems, 1);
assert.equal(byType.SUPPLIED_EVIDENCE.properties.spans.maxItems, 0);
assert.equal(byType.SUPPLIED_EVIDENCE.properties.supports.maxItems, 0);
assert.equal(byType.INFERENCE.properties.spans.maxItems, 0);
assert.equal(byType.INFERENCE.properties.supports.minItems, 1);

const inferredProvenance = structured.properties.INFERRED.items.properties.provenance.items;
assert.equal(inferredProvenance.anyOf.length, 1);
assert.deepEqual(inferredProvenance.anyOf[0].properties.source_type.enum, ['INFERENCE']);

const sourceText = 'Alpha gap. Omega end.';
const candidate = emptyCandidate();
candidate.LOCKED.push(entry('locked.1', 'One semantic invariant with two source spans.', [{
  source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [],
  spans: [{ start: 0, end: 5 }, { start: 11, end: 16 }]
}]));
const projected = expandStructuredProvenance(candidate, sourceText);
assert.equal(projected.LOCKED.length, 1, 'provenance cardinality must not create semantic entries');
assert.equal(projected.LOCKED[0].id, 'locked.1');
assert.equal(projected.LOCKED[0].statement, candidate.LOCKED[0].statement);
assert.deepEqual(projected.LOCKED[0].provenance.map((item) => item.quote), ['Alpha', 'Omega']);

for (const contradictory of [
  { ...raw, quote: 'Alpha' },
  { ...raw, evidence_id: 'doc-1' },
  { ...raw, supports: [{ quote: 'Alpha', evidence_id: null }] },
  { ...raw, spans: [] }
]) {
  const invalid = emptyCandidate();
  invalid.EXPLICIT.push(entry('invalid.1', 'Invalid provider state.', [contradictory]));
  assert.throws(() => expandStructuredProvenance(invalid, sourceText));
}

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  provenanceUnion: ['RAW_TEXT', 'SUPPLIED_EVIDENCE', 'INFERENCE'],
  rawTextActiveLegacyFieldsStructurallyRejected: true,
  rawTextRequiresSpans: true,
  nonRawRequiresEmptySpans: true,
  schemaRuntimeAgreement: true,
  multiSpanProjectionDeterministic: true,
  semanticCardinalityUnchanged: true
}, null, 2)}\n`);
