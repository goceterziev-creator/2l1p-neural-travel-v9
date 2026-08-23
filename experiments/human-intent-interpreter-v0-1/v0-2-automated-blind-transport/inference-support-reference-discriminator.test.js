'use strict';

const assert = require('node:assert/strict');
const { buildEnvelope } = require('./transport/contract');
const { providerRepresentationFor } = require('./transport/adapters/openai-responses-adapter');

function findVariant(schema, section, sourceType) {
  const provenance = schema.properties[section].items.properties.provenance.items;
  return provenance.anyOf.find((variant) => variant.properties.source_type.enum[0] === sourceType);
}

{
  const envelope = buildEnvelope({ id: 'NO-EVIDENCE', text: 'Alpha.', evidence: [] });
  const schema = providerRepresentationFor(envelope).outputSchema;
  const inference = findVariant(schema, 'EXPLICIT', 'INFERENCE');
  assert.equal(inference.properties.supports.minItems, 1);
  const support = inference.properties.supports.items;
  assert.equal(support.properties.evidence_id.type, 'null');
  assert.equal(support.properties.quote.type, 'string');
  const supplied = findVariant(schema, 'EXPLICIT', 'SUPPLIED_EVIDENCE');
  assert.deepEqual(supplied.properties.evidence_id.enum, []);
}

{
  const envelope = buildEnvelope({
    id: 'WITH-EVIDENCE',
    text: 'Alpha.',
    evidence: [
      { evidence_id: 'doc-1', content: 'One.' },
      { evidence_id: 'doc-2', content: 'Two.' }
    ]
  });
  const schema = providerRepresentationFor(envelope).outputSchema;
  const inference = findVariant(schema, 'EXPLICIT', 'INFERENCE');
  assert.equal(inference.properties.supports.items.anyOf.length, 2);
  const evidenceSupport = inference.properties.supports.items.anyOf.find((variant) => variant.properties.evidence_id.type === 'string');
  assert.deepEqual(evidenceSupport.properties.evidence_id.enum, ['doc-1', 'doc-2']);
  const supplied = findVariant(schema, 'EXPLICIT', 'SUPPLIED_EVIDENCE');
  assert.deepEqual(supplied.properties.evidence_id.enum, ['doc-1', 'doc-2']);
}

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  noEvidenceInferenceSupport: 'raw-text-only',
  suppliedEvidenceIdsBoundToEnvelope: true,
  fabricatedEvidenceIdSchemaValid: false,
  modelCalls: 0
})}\n`);
