'use strict';

const assert = require('node:assert/strict');
const { extractCandidate, sha256, stableBytes } = require('./transport/contract');
const { createFakeAdapter } = require('./transport/adapters/fake-adapter');

const SECTIONS = [
  'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
  'NECESSARY_COLLATERAL_CHANGES'
];

function source(text) {
  return { id: 'provenance-test', language: 'en', text, evidence: [] };
}

function entry(quote) {
  return {
    id: 'outcome.test',
    statement: 'Preserve the requested outcome.',
    provenance: [{ source_type: 'RAW_TEXT', quote, evidence_id: null, supports: [] }],
    targets: ['requested outcome'],
    required: false,
    requiredFor: ''
  };
}

function candidate(quote) {
  const value = Object.fromEntries(SECTIONS.map((section) => [section, []]));
  value.OUTCOME.push(entry(quote));
  return value;
}

function extract(text, quote) {
  return extractCandidate({ output_text: stableBytes(candidate(quote)).trim() }, source(text));
}

function canonicalQuote(value) {
  return value.OUTCOME[0].provenance[0].quote;
}

function withoutRawQuotes(value) {
  const clone = JSON.parse(JSON.stringify(value));
  for (const section of SECTIONS) {
    for (const item of clone[section]) {
      for (const provenance of item.provenance) {
        if (provenance.source_type === 'RAW_TEXT') provenance.quote = '<RAW_TEXT_SPAN>';
      }
    }
  }
  return clone;
}

async function main() {
  const capitalizationSource = 'Do this and show the recorded height relationship accurately.';
  const capitalization = extract(capitalizationSource, 'Show the recorded height relationship accurately.');
  assert.equal(canonicalQuote(capitalization), 'show the recorded height relationship accurately.');

  const punctuationSource = 'Change just the three riser faces to dark granite and leave the treads untouched.';
  const punctuation = extract(punctuationSource, 'Change just the three riser faces to dark granite.');
  assert.equal(canonicalQuote(punctuation), 'Change just the three riser faces to dark granite');

  const segmentationSource = 'Keep the landing; change just the three riser faces to dark granite, then inspect it.';
  const segmentation = extract(segmentationSource, 'change just the three riser faces to dark granite');
  assert.equal(canonicalQuote(segmentation), 'change just the three riser faces to dark granite');

  for (const [text, quote] of [
    ['Change the three riser faces to dark granite.', 'Change the three riser faces to dark marble.'],
    ['Change the three riser faces to dark granite.', 'Change the riser faces to dark granite.'],
    ['Change the three riser faces to dark granite.', 'Change the three polished riser faces to dark granite.'],
    ['Change the three riser faces to dark granite.', 'Change the riser three faces to dark granite.'],
    ['marker alpha beta; marker alpha beta.', 'Marker alpha beta.']
  ]) {
    assert.throws(() => extract(text, quote), /canonical exact source spans|raw quote is not exact/);
  }

  const exactSource = 'Keep this exact RAW_TEXT span.';
  const exactCandidate = candidate(exactSource);
  const exact = extractCandidate({ output_text: stableBytes(exactCandidate).trim() }, source(exactSource));
  assert.deepEqual(exact, exactCandidate, 'already-exact provenance must pass unchanged');

  const originalSurfaceCandidate = candidate('Change just the three riser faces to dark granite.');
  assert.deepEqual(
    withoutRawQuotes(punctuation),
    withoutRawQuotes(originalSurfaceCandidate),
    'only RAW_TEXT provenance representation may change'
  );
  assert.ok(punctuationSource.includes(canonicalQuote(punctuation)), 'stored quote must equal source text exactly');
  assert.ok(capitalizationSource.includes(canonicalQuote(capitalization)), 'capitalization correction must copy source text');
  assert.ok(segmentationSource.includes(canonicalQuote(segmentation)), 'segmentation correction must copy source text');

  const first = extract(punctuationSource, 'Change just the three riser faces to dark granite.');
  const second = extract(punctuationSource, 'Change just the three riser faces to dark granite.');
  const deterministicIdentity = sha256(stableBytes(first));
  assert.equal(deterministicIdentity, sha256(stableBytes(second)));

  const fake = createFakeAdapter();
  const fakeEnvelope = {
    caseId: 'fake-provenance',
    text: exactSource
  };
  const fakeResult = await fake.invoke(fakeEnvelope);
  const fakeCandidate = extractCandidate(fakeResult.rawResponse, source(exactSource));
  assert.equal(fakeCandidate.OUTCOME[0].provenance[0].quote, exactSource);

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    proofs: {
      capitalizationBoundary: 'PASS',
      terminalPunctuationBoundary: 'PASS',
      clauseBoundarySegmentation: 'PASS',
      canonicalQuoteCopiedFromSource: 'PASS',
      changedWordRejected: 'PASS',
      omittedWordRejected: 'PASS',
      addedWordRejected: 'PASS',
      reorderedWordsRejected: 'PASS',
      ambiguousMatchRejected: 'PASS',
      alreadyExactUnchanged: 'PASS',
      semanticFieldsUnchanged: 'PASS',
      fakeAdapterPath: 'PASS',
      deterministicIdentity
    }
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
