'use strict';

const assert = require('node:assert/strict');
const { CANDIDATE_SCHEMA } = require('./transport/contract');
const { structuredProvenanceSchema } = require('./transport/structured-provenance');
const {
  inferenceSupportSelectionSchema,
  projectInferenceSupportSelections
} = require('./transport/inference-support-selection');

const source = 'Leave the retry count at three. Trace the duplicate webhook deliveries. We still do not know whether the sender retries.';
const schema = inferenceSupportSelectionSchema(structuredProvenanceSchema(CANDIDATE_SCHEMA, ['doc-1']));
const inference = schema.properties.INFERRED.items.properties.provenance.items.anyOf[0];
const supportSchema = inference.properties.supports.items;
assert.equal(Array.isArray(supportSchema.anyOf), true);
const raw = supportSchema.anyOf.find((branch) => branch.properties.evidence_id.type === 'null');
const supplied = supportSchema.anyOf.find((branch) => branch.properties.evidence_id.type === 'string');
assert.equal(raw.properties.quote.type, 'null');
assert.equal(raw.properties.selections.minItems, 1);
assert.equal(raw.properties.selections.maxItems, 1);
assert.equal(raw.properties.spans.maxItems, 0);
assert.deepEqual(supplied.properties.evidence_id.enum, ['doc-1']);
assert.equal(supplied.properties.selections.maxItems, 0);
assert.equal(supplied.properties.spans.maxItems, 0);

function assertEveryNestedObjectStrict(node, path = 'support') {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'object') {
    assert.equal(node.additionalProperties, false, `${path} must set additionalProperties:false`);
  }
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) value.forEach((item, index) => assertEveryNestedObjectStrict(item, `${path}.${key}[${index}]`));
    else assertEveryNestedObjectStrict(value, `${path}.${key}`);
  }
}

assertEveryNestedObjectStrict(raw, 'rawSupport');
assertEveryNestedObjectStrict(supplied, 'suppliedSupport');
assert.equal(raw.properties.spans.items.additionalProperties, false);
assert.equal(supplied.properties.spans.items.additionalProperties, false);

function candidate(supports) {
  return { INFERRED: [{ provenance: [{ source_type: 'INFERENCE', quote: null, evidence_id: null, supports, selections: [], spans: [] }] }] };
}
function rawSupport(text) { return { quote: null, evidence_id: null, selections: [{ text }], spans: [] }; }
function suppliedSupport() { return { quote: 'Document says keep it.', evidence_id: 'doc-1', selections: [], spans: [] }; }

const single = projectInferenceSupportSelections(candidate([rawSupport('Leave the retry count at three.')]), source);
assert.deepEqual(single.INFERRED[0].provenance[0].supports, [{ quote: 'Leave the retry count at three.', evidence_id: null }]);

const multiple = projectInferenceSupportSelections(candidate([
  rawSupport('Leave the retry count at three.'),
  rawSupport('We still do not know whether the sender retries.')
]), source);
assert.deepEqual(multiple.INFERRED[0].provenance[0].supports, [
  { quote: 'Leave the retry count at three.', evidence_id: null },
  { quote: 'We still do not know whether the sender retries.', evidence_id: null }
]);

const mixed = projectInferenceSupportSelections(candidate([
  rawSupport('Trace the duplicate webhook deliveries.'), suppliedSupport()
]), source);
assert.deepEqual(mixed.INFERRED[0].provenance[0].supports[1], { quote: 'Document says keep it.', evidence_id: 'doc-1' });

assert.throws(() => projectInferenceSupportSelections(candidate([rawSupport('Not present.')]), source), /0 source matches/);
assert.throws(() => projectInferenceSupportSelections(candidate([rawSupport('retry')]), 'retry then retry'), /multiple source matches/);
assert.throws(() => projectInferenceSupportSelections(candidate([rawSupport('Leave the retry count at three. We still do not know whether the sender retries.')]), source), /0 source matches/);
assert.throws(() => projectInferenceSupportSelections(candidate([{
  quote: null, evidence_id: null,
  selections: [{ text: 'Leave the retry count at three.' }, { text: 'Trace the duplicate webhook deliveries.' }],
  spans: []
}]), source), /exactly one exact selection/);

const stableA = JSON.stringify(projectInferenceSupportSelections(candidate([rawSupport('Leave the retry count at three.')]), source));
const stableB = JSON.stringify(projectInferenceSupportSelections(candidate([rawSupport('Leave the retry count at three.')]), source));
assert.equal(stableA, stableB);

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  invariant: 'one-raw-text-inference-support-one-exact-selection',
  allTransformationNestedObjectsStrict: true,
  rawSupportSpanItemsStrict: true,
  suppliedSupportSpanItemsStrict: true,
  canonicalRepresentationUnchanged: true,
  suppliedEvidenceUnchanged: true,
  zeroMatchRejected: true,
  ambiguousMatchRejected: true,
  syntheticConcatenationRejected: true,
  multipleSelectionsPerSupportRejected: true,
  deterministic: true,
  modelCalls: 0
})}\n`);
