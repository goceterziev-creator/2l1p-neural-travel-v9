'use strict';

const assert = require('node:assert/strict');
const {
  SECTIONS,
  buildEnvelope,
  canonicalRawTextSpan,
  extractCandidate
} = require('./transport/contract');
const {
  PROVIDER_PROVENANCE_INSTRUCTIONS,
  createOpenAiResponsesAdapter
} = require('./transport/adapters/openai-responses-adapter');

function raw(quote) {
  return { source_type: 'RAW_TEXT', quote, evidence_id: null, supports: [] };
}

function supplied(evidence_id, quote) {
  return { source_type: 'SUPPLIED_EVIDENCE', quote, evidence_id, supports: [] };
}

function entry(id, statement, provenance, section = 'EXPLICIT') {
  return {
    id,
    statement,
    provenance,
    targets: [],
    required: false,
    requiredFor: { kind: 'TEXT', text: statement, section: section.toLowerCase(), entry_id: id }
  };
}

function candidateWith(section, item) {
  const candidate = Object.fromEntries(SECTIONS.map((name) => [name, []]));
  candidate[section].push(item);
  return candidate;
}

function response(candidate) {
  return { output_text: JSON.stringify(candidate) };
}

function expectReject(source, quote, pattern) {
  const c = candidateWith('EXPLICIT', entry('n1', 'Statement stays unchanged.', [raw(quote)]));
  assert.throws(() => extractCandidate(response(c), source), pattern);
}

async function main() {
  const source = {
    id: 'MS1', language: 'en',
    text: 'Alpha requirement is fixed. A separate sentence sits here. Omega decision is reserved.',
    evidence: [{ evidence_id: 'note-1', content: 'External note confirms the steel grade. Another clause remains separate.' }]
  };

  const twoSpanStatement = 'One semantic claim uses two independent raw spans.';
  const twoSpan = candidateWith('EXPLICIT', entry('p1', twoSpanStatement, [
    raw('Alpha requirement is fixed.'),
    raw('Omega decision is reserved.')
  ]));
  const twoSpanExtracted = extractCandidate(response(twoSpan), source);
  assert.equal(twoSpanExtracted.EXPLICIT.length, 1);
  assert.equal(twoSpanExtracted.EXPLICIT[0].statement, twoSpanStatement);
  assert.equal(twoSpanExtracted.EXPLICIT[0].provenance.length, 2);

  const mixed = candidateWith('EXPLICIT', entry('p2', 'Mixed evidence statement.', [
    raw('Alpha requirement is fixed.'),
    supplied('note-1', 'External note confirms the steel grade.')
  ]));
  const mixedExtracted = extractCandidate(response(mixed), source);
  assert.deepEqual(mixedExtracted.EXPLICIT[0].provenance.map((p) => p.source_type), ['RAW_TEXT', 'SUPPLIED_EVIDENCE']);

  const three = candidateWith('EXPLICIT', entry('p3', 'Three-source statement.', [
    raw('Alpha requirement is fixed.'),
    raw('Omega decision is reserved.'),
    supplied('note-1', 'Another clause remains separate.')
  ]));
  assert.equal(extractCandidate(response(three), source).EXPLICIT[0].provenance.length, 3);

  const single = candidateWith('EXPLICIT', entry('p4', 'Single span statement.', [raw('Alpha requirement is fixed.')]));
  const singleExtracted = extractCandidate(response(single), source);
  assert.equal(singleExtracted.EXPLICIT[0].provenance[0].quote, 'Alpha requirement is fixed.');

  const semanticBefore = { id: twoSpan.EXPLICIT[0].id, statement: twoSpan.EXPLICIT[0].statement, section: 'EXPLICIT' };
  const semanticAfter = { id: twoSpanExtracted.EXPLICIT[0].id, statement: twoSpanExtracted.EXPLICIT[0].statement, section: 'EXPLICIT' };
  assert.deepEqual(semanticAfter, semanticBefore);

  let capturedRequest = null;
  const structuredSingle = candidateWith('EXPLICIT', entry('p4', 'Single span statement.', [{
    source_type: 'RAW_TEXT',
    quote: null,
    evidence_id: null,
    supports: [],
    spans: [{ start: 0, end: 'Alpha requirement is fixed.'.length }]
  }]));
  // Structured provider schema requires spans on every provenance discriminator.
  for (const provenance of structuredSingle.EXPLICIT[0].provenance) {
    if (!Object.hasOwn(provenance, 'spans')) provenance.spans = [];
  }
  const adapter = createOpenAiResponsesAdapter({ provider: {
    async health() { return { status: 'ready' }; },
    async execute(request) {
      capturedRequest = request;
      return { ok: true, data: response(structuredSingle) };
    }
  }});
  const envelope = buildEnvelope(source);
  const adapterResult = await adapter.invoke(envelope, { requestId: 'provider-free-multi-span' });
  const systemText = capturedRequest.body.input[0].content[0].text;
  assert.ok(systemText.includes(PROVIDER_PROVENANCE_INSTRUCTIONS));
  assert.match(systemText, /UTF-16 code-unit/i);
  assert.match(systemText, /non-contiguous raw locations/i);
  const providerProvenanceSchema = capturedRequest.body.text.format.schema.properties.EXPLICIT.items.properties.provenance.items;
  assert.equal(providerProvenanceSchema.properties.spans.type, 'array');
  assert.ok(providerProvenanceSchema.required.includes('spans'));
  assert.equal(capturedRequest.body.temperature, 0);
  assert.ok(adapterResult.rawResponse.output_text.includes('"spans"'));
  assert.ok(!adapterResult.extractionResponse.output_text.includes('"spans"'));
  const adapterExtracted = extractCandidate(adapterResult.extractionResponse, source);
  assert.equal(adapterExtracted.EXPLICIT[0].provenance[0].quote, 'Alpha requirement is fixed.');

  expectReject(source, 'Alpha requirement is fixed. Omega decision is reserved.', /0 exact source decompositions|0 canonical exact source spans/);
  expectReject(source, 'Alpha requirement fixed.', /0 exact source decompositions|0 canonical exact source spans/);
  expectReject(source, 'Alpha requirement is permanently fixed.', /0 exact source decompositions|0 canonical exact source spans/);
  expectReject(source, 'fixed is requirement Alpha.', /0 exact source decompositions|0 canonical exact source spans/);

  assert.throws(
    () => canonicalRawTextSpan('Marker appears here. Noise. Marker appears here.', 'marker appears here.'),
    /2 canonical exact source spans/
  );

  assert.equal(twoSpanExtracted.EXPLICIT.length, 1);
  for (const section of SECTIONS.filter((name) => name !== 'EXPLICIT')) assert.equal(twoSpanExtracted[section].length, 0);

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    positive: 5,
    negative: 7,
    providerFacingStructuredSpans: 'PASS',
    semanticPayloadInvariant: 'PASS',
    noModelCalls: true
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
