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

  // Positive 1: two exact non-contiguous RAW_TEXT spans support one semantic entry.
  const twoSpanStatement = 'One semantic claim uses two independent raw spans.';
  const twoSpan = candidateWith('EXPLICIT', entry('p1', twoSpanStatement, [
    raw('Alpha requirement is fixed.'),
    raw('Omega decision is reserved.')
  ]));
  const twoSpanExtracted = extractCandidate(response(twoSpan), source);
  assert.equal(twoSpanExtracted.EXPLICIT.length, 1);
  assert.equal(twoSpanExtracted.EXPLICIT[0].statement, twoSpanStatement);
  assert.equal(twoSpanExtracted.EXPLICIT[0].provenance.length, 2);

  // Positive 2: RAW_TEXT + supplied evidence.
  const mixed = candidateWith('EXPLICIT', entry('p2', 'Mixed evidence statement.', [
    raw('Alpha requirement is fixed.'),
    supplied('note-1', 'External note confirms the steel grade.')
  ]));
  const mixedExtracted = extractCandidate(response(mixed), source);
  assert.deepEqual(mixedExtracted.EXPLICIT[0].provenance.map((p) => p.source_type), ['RAW_TEXT', 'SUPPLIED_EVIDENCE']);

  // Positive 3: three independently valid provenance items.
  const three = candidateWith('EXPLICIT', entry('p3', 'Three-source statement.', [
    raw('Alpha requirement is fixed.'),
    raw('Omega decision is reserved.'),
    supplied('note-1', 'Another clause remains separate.')
  ]));
  assert.equal(extractCandidate(response(three), source).EXPLICIT[0].provenance.length, 3);

  // Positive 4: already-valid single span remains unchanged.
  const single = candidateWith('EXPLICIT', entry('p4', 'Single span statement.', [raw('Alpha requirement is fixed.')]));
  const singleExtracted = extractCandidate(response(single), source);
  assert.equal(singleExtracted.EXPLICIT[0].provenance[0].quote, 'Alpha requirement is fixed.');

  // Positive 5: increasing provenance cardinality does not change semantic payload.
  const semanticBefore = { id: twoSpan.EXPLICIT[0].id, statement: twoSpan.EXPLICIT[0].statement, section: 'EXPLICIT' };
  const semanticAfter = { id: twoSpanExtracted.EXPLICIT[0].id, statement: twoSpanExtracted.EXPLICIT[0].statement, section: 'EXPLICIT' };
  assert.deepEqual(semanticAfter, semanticBefore);

  // Provider-facing structural guidance is explicit and provider request preserves schema/model config.
  let capturedRequest = null;
  const adapter = createOpenAiResponsesAdapter({ provider: {
    async health() { return { status: 'ready' }; },
    async execute(request) {
      capturedRequest = request;
      return { ok: true, data: response(single) };
    }
  }});
  const envelope = buildEnvelope(source);
  await adapter.invoke(envelope, { requestId: 'provider-free-multi-span' });
  const systemText = capturedRequest.body.input[0].content[0].text;
  assert.ok(systemText.includes(PROVIDER_PROVENANCE_INSTRUCTIONS));
  assert.match(systemText, /two or more non-contiguous raw-text spans, emit two or more separate RAW_TEXT provenance elements/i);
  assert.match(systemText, /do not create additional semantic claims/i);
  assert.equal(capturedRequest.body.text.format.schema, envelope.outputSchema);
  assert.equal(capturedRequest.body.temperature, 0);

  // Negative 1 + 6: provider attempts one synthetic concatenated quote instead of two spans.
  expectReject(source, 'Alpha requirement is fixed. Omega decision is reserved.', /0 exact source decompositions|0 canonical exact source spans/);

  // Negative 2: omitted-word composition.
  expectReject(source, 'Alpha requirement fixed.', /0 exact source decompositions|0 canonical exact source spans/);

  // Negative 3: added-word composition.
  expectReject(source, 'Alpha requirement is permanently fixed.', /0 exact source decompositions|0 canonical exact source spans/);

  // Negative 4: reordered composition.
  expectReject(source, 'fixed is requirement Alpha.', /0 exact source decompositions|0 canonical exact source spans/);

  // Negative 5: ambiguous canonical span is rejected when canonicalization must choose an occurrence.
  assert.throws(
    () => canonicalRawTextSpan('Marker appears here. Noise. marker appears here.', 'marker appears here.'),
    /2 canonical exact source spans/
  );

  // Negative 7: provenance cardinality cannot move or duplicate the semantic classification.
  assert.equal(twoSpanExtracted.EXPLICIT.length, 1);
  for (const section of SECTIONS.filter((name) => name !== 'EXPLICIT')) assert.equal(twoSpanExtracted[section].length, 0);

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    positive: 5,
    negative: 7,
    providerFacingMultiSpanInstruction: 'PASS',
    semanticPayloadInvariant: 'PASS',
    noModelCalls: true
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
