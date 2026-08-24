'use strict';

const assert = require('node:assert/strict');
const {
  segmentRawText, providerAddressMap, resolveAddressSelection,
  structuralAddressingSchema, projectAddressSelections
} = require('./transport/raw-text-addressing');

const source = 'Пази  ако — точно.\nNext, retry count = three!';
const map1 = segmentRawText(source);
const map2 = segmentRawText(source);
assert.deepEqual(map1, map2, 'identical source must produce deterministic identities');
assert.equal(map1.units.map((u) => u.text).join(''), source, 'segmentation must reconstruct exact source');
assert.deepEqual(providerAddressMap(source), providerAddressMap(source), 'provider map must be deterministic');

function selectText(text) {
  const start = source.indexOf(text);
  assert.notEqual(start, -1);
  const end = start + text.length;
  const units = map1.units.filter((u) => u.end > start && u.start < end);
  assert.equal(units[0].start, start, 'fixture selection must align to unit start');
  assert.equal(units.at(-1).end, end, 'fixture selection must align to unit end');
  return { source_id: map1.source_id, start_id: units[0].id, end_id: units.at(-1).id };
}

const bulgarian = selectText('ако — точно.');
const resolved = resolveAddressSelection(source, bulgarian);
assert.equal(resolved.quote, 'ако — точно.', 'capitalization/punctuation must come only from frozen source');
assert.equal(source.slice(resolved.start, resolved.end), resolved.quote);

const whitespace = selectText('  ако — точно.\n');
assert.equal(resolveAddressSelection(source, whitespace).quote, '  ако — точно.\n', 'whitespace/newline must be preserved');

assert.throws(() => resolveAddressSelection(source, { ...bulgarian, source_id: 'foreign' }), /source identity/);
assert.throws(() => resolveAddressSelection(source, { ...bulgarian, start_id: 'u99999' }), /unknown unit/);
assert.throws(() => resolveAddressSelection(source, { source_id: map1.source_id, start_id: bulgarian.end_id, end_id: bulgarian.start_id }), /reversed/);
assert.throws(() => resolveAddressSelection(source, { ...bulgarian, text: 'ако' }), /fields are invalid/, 'provider-authored text must be rejected');

const repeated = 'same same';
const repeatedMap = segmentRawText(repeated);
const secondSame = { source_id: repeatedMap.source_id, start_id: 'u00002', end_id: 'u00002' };
assert.equal(resolveAddressSelection(repeated, secondSame).quote, 'same', 'repetition must be addressable without ambiguous text matching');

const schemaFixture = {
  type: 'object', properties: { provenance: { type: 'object', anyOf: [
    { type: 'object', properties: { source_type: { type: 'string', enum: ['RAW_TEXT'] }, quote: { type: 'null' }, evidence_id: { type: 'null' }, selections: { type: 'array', minItems: 1, items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } }, spans: { type: 'array' }, supports: { type: 'array' } } },
    { type: 'object', properties: { source_type: { type: 'string', enum: ['INFERENCE'] }, supports: { type: 'array', items: { anyOf: [
      { type: 'object', properties: { quote: { type: 'null' }, evidence_id: { type: 'null' }, selections: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } }, spans: { type: 'array' } } },
      { type: 'object', properties: { quote: { type: 'string' }, evidence_id: { type: 'string' }, selections: { type: 'array', maxItems: 0, items: { type: 'object' } }, spans: { type: 'array' } } }
    ] } } } }
  ] } } };
const addressedSchema = structuralAddressingSchema(schemaFixture, source);
const raw = addressedSchema.properties.provenance.anyOf[0].properties.selections.items;
assert.deepEqual(Object.keys(raw.properties).sort(), ['end_id', 'source_id', 'start_id']);
assert.equal(raw.additionalProperties, false);
const inferenceRaw = addressedSchema.properties.provenance.anyOf[1].properties.supports.items.anyOf[0].properties.selections.items;
assert.deepEqual(Object.keys(inferenceRaw.properties).sort(), ['end_id', 'source_id', 'start_id']);
const supplied = addressedSchema.properties.provenance.anyOf[1].properties.supports.items.anyOf[1].properties.selections.items;
assert.equal(supplied.properties?.text, undefined, 'empty supplied-evidence selections must not be turned into RAW_TEXT addresses');

const candidate = { OUTCOME: [{ provenance: [{ source_type: 'RAW_TEXT', quote: null, evidence_id: null, supports: [], spans: [], selections: [bulgarian, selectText('retry count = three!')] }] }], INFERRED: [{ provenance: [{ source_type: 'INFERENCE', quote: null, evidence_id: null, spans: [], selections: [], supports: [{ quote: null, evidence_id: null, spans: [], selections: [bulgarian] }, { quote: 'external', evidence_id: 'doc-1', spans: [], selections: [] }] }] }] };
const projected = projectAddressSelections(candidate, source);
assert.deepEqual(projected.OUTCOME[0].provenance[0].selections, [{ text: 'ако — точно.' }, { text: 'retry count = three!' }]);
assert.deepEqual(projected.INFERRED[0].provenance[0].supports[0].selections, [{ text: 'ако — точно.' }]);
assert.deepEqual(projected.INFERRED[0].provenance[0].supports[1].selections, [], 'supplied evidence must remain unchanged');

console.log('PASS: deterministic structural addressing preserves exact frozen characters and rejects invalid addresses');
