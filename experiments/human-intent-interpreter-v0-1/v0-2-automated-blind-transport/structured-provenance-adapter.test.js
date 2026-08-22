'use strict';

const assert = require('node:assert/strict');
const { buildEnvelope } = require('./transport/contract');
const { createOpenAiResponsesAdapter } = require('./transport/adapters/openai-responses-adapter');

const source = { id: 'SPAN-ADAPTER', text: 'First clause. Gap. Last clause.', evidence: [] };
const envelope = buildEnvelope(source);
let captured;
const providerCandidate = Object.fromEntries([
  'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
  'NECESSARY_COLLATERAL_CHANGES'
].map((section) => [section, []]));
providerCandidate.EXPLICIT.push({
  id: 'explicit:1',
  statement: 'Two exact locations support one entry.',
  provenance: [{
    source_type: 'RAW_TEXT',
    quote: null,
    evidence_id: null,
    supports: [],
    spans: [
      { start: 0, end: 12 },
      { start: 18, end: 30 }
    ]
  }],
  targets: [],
  required: false,
  requiredFor: { kind: 'NONE', text: '', section: '', entry_id: '' }
});
const providerRaw = {
  output_text: JSON.stringify(providerCandidate),
  usage: { input_tokens: 10, output_tokens: 20 }
};

const provider = {
  async health() { return { status: 'ready' }; },
  async execute(request) {
    captured = request;
    return { ok: true, data: providerRaw };
  }
};

(async () => {
  const adapter = createOpenAiResponsesAdapter({ provider });
  const result = await adapter.invoke(envelope, { requestId: 'provider-free' });
  const schema = captured.body.text.format.schema;
  const p = schema.properties.EXPLICIT.items.properties.provenance.items;
  assert.equal(p.properties.spans.type, 'array');
  assert.ok(p.required.includes('spans'));
  assert.equal(captured.body.temperature, 0);
  assert.strictEqual(result.rawResponse, providerRaw);
  assert.equal(result.rawResponse.output_text.includes('"spans"'), true);
  assert.equal(result.extractionResponse.output_text.includes('"spans"'), false);
  const extracted = JSON.parse(result.extractionResponse.output_text);
  assert.deepEqual(extracted.EXPLICIT[0].provenance.map((item) => item.quote), ['First clause', 'Last clause.']);
  assert.equal(extracted.EXPLICIT[0].statement, providerCandidate.EXPLICIT[0].statement);
  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    providerRawPreserved: true,
    providerSchemaStructured: true,
    temperature: captured.body.temperature,
    semanticStatementUnchanged: true
  })}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
