'use strict';

const assert = require('node:assert/strict');
const { CANDIDATE_SCHEMA } = require('./transport/contract');
const { structuredProvenanceSchema, expandStructuredProvenance } = require('./transport/structured-provenance');

function typeMatches(type, value) {
  if (Array.isArray(type)) return type.some((item) => typeMatches(item, value));
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}

function valid(schema, value) {
  if (!schema || typeof schema !== 'object') return true;
  if (schema.anyOf && !schema.anyOf.some((branch) => valid(branch, value))) return false;
  if (schema.type && !typeMatches(schema.type, value)) return false;
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) return false;
  if (typeof value === 'string' && schema.minLength !== undefined && value.length < schema.minLength) return false;
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) return false;
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return false;
    if (schema.items && !value.every((item) => valid(schema.items, item))) return false;
  }
  if (schema.type === 'object') {
    const keys = Object.keys(value);
    for (const required of schema.required || []) if (!(required in value)) return false;
    if (schema.additionalProperties === false && keys.some((key) => !(key in (schema.properties || {})))) return false;
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value && !valid(child, value[key])) return false;
    }
  }
  if (schema.type === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) return false;
  }
  return true;
}

const schema = structuredProvenanceSchema(CANDIDATE_SCHEMA, [
  'survey-7',
  'gallery-survey-N2',
  'courtyard-record-6'
]);
const provenance = schema.properties.EXPLICIT.items.properties.provenance.items;
assert.equal(provenance.anyOf.length, 3);
assert.deepEqual(provenance.anyOf.map((variant) => variant.properties.source_type.enum[0]), [
  'RAW_TEXT', 'SUPPLIED_EVIDENCE', 'INFERENCE'
]);
for (const variant of provenance.anyOf) {
  assert.equal(variant.properties.spans.type, 'array');
  assert.ok(variant.required.includes('spans'));
}
const rawVariant = provenance.anyOf.find((variant) => variant.properties.source_type.enum[0] === 'RAW_TEXT');
assert.equal(rawVariant.properties.spans.minItems, 1);
const suppliedVariant = provenance.anyOf.find((variant) => variant.properties.source_type.enum[0] === 'SUPPLIED_EVIDENCE');
const inferenceVariant = provenance.anyOf.find((variant) => variant.properties.source_type.enum[0] === 'INFERENCE');
assert.equal(suppliedVariant.properties.spans.maxItems, 0);
assert.equal(inferenceVariant.properties.spans.maxItems, 0);

const raw1 = { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans: [{ start: 0, end: 5 }] };
const raw2 = { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans: [{ start: 0, end: 5 }, { start: 8, end: 12 }] };
const supplied = { source_type: 'SUPPLIED_EVIDENCE', quote: 'Survey confirms datum.', evidence_id: 'survey-7', supports: [], spans: [] };
const inference = { source_type: 'INFERENCE', quote: null, evidence_id: null, supports: [{ quote: 'Keep the wall.', evidence_id: null }], spans: [] };

for (const item of [raw1, raw2, supplied, inference]) assert.equal(valid(provenance, item), true);

// Historical A41/A42 valid representation classes remain accepted when the matching supplied evidence IDs are present in the envelope schema.
const a41Style = [
  { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans: [{ start: 0, end: 88 }] },
  { source_type: 'SUPPLIED_EVIDENCE', quote: 'The measured survey shows the north gallery wall is 8.4 m long.', evidence_id: 'gallery-survey-N2', supports: [], spans: [] },
  { source_type: 'INFERENCE', quote: null, evidence_id: null, supports: [{ quote: 'Do not cut the panelling.', evidence_id: null }], spans: [] }
];
const a42Style = [
  { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans: [{ start: 57, end: 102 }] },
  { source_type: 'SUPPLIED_EVIDENCE', quote: 'The landscape schedule identifies the three courtyard magnolias as retained trees.', evidence_id: 'courtyard-record-6', supports: [], spans: [] }
];
for (const item of [...a41Style, ...a42Style]) assert.equal(valid(provenance, item), true);

const invalid = [
  { ...raw1, quote: 'Alpha' },
  { ...raw1, evidence_id: 'doc-1' },
  { ...raw1, supports: [{ quote: 'Alpha', evidence_id: null }] },
  { ...raw1, spans: [] },
  { ...supplied, spans: [{ start: 0, end: 1 }] },
  { ...supplied, supports: [{ quote: 'x', evidence_id: null }] },
  { ...inference, spans: [{ start: 0, end: 1 }] },
  { ...inference, quote: 'authored' },
  { ...inference, evidence_id: 'doc' },
  { ...raw1, source_type: 'UNKNOWN_SOURCE' },
  { source_type: 'RAW_TEXT', quote: 'mixed', evidence_id: 'doc', supports: [], spans: [] },
  { ...raw1, unexpected: true }
];
for (const item of invalid) assert.equal(valid(provenance, item), false, JSON.stringify(item));

// The INFERRED section remains mechanically restricted to INFERENCE provenance.
const inferred = schema.properties.INFERRED.items.properties.provenance.items;
assert.equal(inferred.anyOf.length, 1);
assert.equal(inferred.anyOf[0].properties.source_type.enum[0], 'INFERENCE');
assert.equal(valid(inferred, inference), true);
assert.equal(valid(inferred, raw1), false);

// Extractor remains an independent second integrity boundary.
assert.throws(() => expandStructuredProvenance({ EXPLICIT: [{ provenance: [{ ...raw1, quote: 'Alpha' }] }] }, 'Alpha beta'), /spans only/);

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  discriminator: 'anyOf-source_type',
  positiveCases: 9,
  adversarialCases: invalid.length,
  a41Compatible: true,
  a42Compatible: true,
  extractorStillStrict: true
})}\n`);
