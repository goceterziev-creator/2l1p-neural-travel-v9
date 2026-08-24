'use strict';

const assert = require('node:assert/strict');
const { CANDIDATE_SCHEMA } = require('./transport/contract');
const { structuredProvenanceSchema, expandStructuredProvenance } = require('./transport/structured-provenance');
const { inferenceSupportSelectionSchema } = require('./transport/inference-support-selection');

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
    for (const [key, child] of Object.entries(schema.properties || {})) if (key in value && !valid(child, value[key])) return false;
  }
  if (schema.type === 'integer' && schema.minimum !== undefined && value < schema.minimum) return false;
  return true;
}

const schema = inferenceSupportSelectionSchema(structuredProvenanceSchema(CANDIDATE_SCHEMA, ['survey-7', 'gallery-survey-N2', 'courtyard-record-6']));
const provenance = schema.properties.EXPLICIT.items.properties.provenance.items;
assert.deepEqual(provenance.anyOf.map((variant) => variant.properties.source_type.enum[0]), ['RAW_TEXT', 'SUPPLIED_EVIDENCE', 'INFERENCE']);
const rawVariant = provenance.anyOf.find((variant) => variant.properties.source_type.enum[0] === 'RAW_TEXT');
const suppliedVariant = provenance.anyOf.find((variant) => variant.properties.source_type.enum[0] === 'SUPPLIED_EVIDENCE');
const inferenceVariant = provenance.anyOf.find((variant) => variant.properties.source_type.enum[0] === 'INFERENCE');
assert.equal(rawVariant.properties.selections.minItems, 1);
assert.equal(rawVariant.properties.spans.maxItems, 0);
assert.equal(suppliedVariant.properties.selections.maxItems, 0);
assert.equal(suppliedVariant.properties.spans.maxItems, 0);
assert.equal(inferenceVariant.properties.selections.maxItems, 0);
assert.equal(inferenceVariant.properties.spans.maxItems, 0);

const raw1 = { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], selections: [{ text: 'Alpha' }], spans: [] };
const raw2 = { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], selections: [{ text: 'Alpha' }, { text: 'Omega' }], spans: [] };
const supplied = { source_type: 'SUPPLIED_EVIDENCE', quote: 'Survey confirms datum.', evidence_id: 'survey-7', supports: [], selections: [], spans: [] };
const inference = { source_type: 'INFERENCE', quote: null, evidence_id: null, supports: [{ quote: null, evidence_id: null, selections: [{ text: 'Keep the wall.' }], spans: [] }], selections: [], spans: [] };
for (const item of [raw1, raw2, supplied, inference]) assert.equal(valid(provenance, item), true, JSON.stringify(item));

const invalid = [
  { ...raw1, quote: 'Alpha' },
  { ...raw1, evidence_id: 'doc-1' },
  { ...raw1, supports: [{ quote: 'Alpha', evidence_id: null }] },
  { ...raw1, selections: [] },
  { ...raw1, spans: [{ start: 0, end: 5 }] },
  { ...supplied, selections: [{ text: 'x' }] },
  { ...supplied, spans: [{ start: 0, end: 1 }] },
  { ...inference, selections: [{ text: 'x' }] },
  { ...inference, spans: [{ start: 0, end: 1 }] },
  { ...inference, quote: 'authored' },
  { ...inference, evidence_id: 'doc' },
  { ...inference, supports: [{ quote: null, evidence_id: null, selections: [{ text: 'A' }, { text: 'B' }], spans: [] }] },
  { ...raw1, source_type: 'UNKNOWN_SOURCE' },
  { ...raw1, unexpected: true }
];
for (const item of invalid) assert.equal(valid(provenance, item), false, JSON.stringify(item));

const inferred = schema.properties.INFERRED.items.properties.provenance.items;
assert.equal(inferred.anyOf.length, 1);
assert.equal(inferred.anyOf[0].properties.source_type.enum[0], 'INFERENCE');
assert.equal(valid(inferred, inference), true);
assert.equal(valid(inferred, raw1), false);

const internalRaw = { source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans: [{ start: 0, end: 5 }] };
assert.equal(expandStructuredProvenance({ EXPLICIT: [{ provenance: [internalRaw] }] }, 'Alpha beta').EXPLICIT[0].provenance[0].quote, 'Alpha');
assert.throws(() => expandStructuredProvenance({ EXPLICIT: [{ provenance: [{ ...internalRaw, quote: 'Alpha' }] }] }, 'Alpha beta'), /spans only/);

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  discriminator: 'anyOf-source_type',
  rawTextProviderSurface: 'exact-selections-only',
  inferenceRawTextSupportSurface: 'one-exact-selection-per-support',
  providerAuthoredSpans: 'schema-invalid',
  suppliedEvidenceIdsBound: true,
  extractorStillStrict: true,
  adversarialCases: invalid.length
})}\n`);
