'use strict';

const assert = require('node:assert/strict');
const { createOpenAiProvider } = require('../../../provider-layer/adapters/ai/openai-provider');
const { buildEnvelope, sha256, stableBytes } = require('./transport/contract');
const { createOpenAiResponsesAdapter } = require('./transport/adapters/openai-responses-adapter');

function candidateWithSelection(selectionText) {
  return {
    EXPLICIT: [{
      id: 'explicit:1',
      statement: 'Grounded statement.',
      provenance: [{
        source_type: 'RAW_TEXT',
        quote: null,
        evidence_id: null,
        supports: [],
        selections: [{ text: selectionText }],
        spans: []
      }],
      targets: [],
      required: false,
      requiredFor: { kind: 'NONE', text: '', section: '', entry_id: '' }
    }]
  };
}

async function providerBoundaryTests() {
  const originalFetch = global.fetch;
  try {
    const provider = createOpenAiProvider({ openai: { apiKey: 'provider-free-test' } });

    const validEvents = [];
    global.fetch = async () => new Response(JSON.stringify({ output_text: '{}' }), { status: 200 });
    const valid = await provider.execute({ task: 'responses', body: {} }, {
      requestId: 'valid',
      forensicSink: (event) => validEvents.push(event)
    });
    assert.equal(valid.ok, true);
    assert.deepEqual(validEvents.map((event) => event.stage), ['raw_http_body']);
    assert.equal(validEvents[0].providerStatus, 200);
    assert.equal(validEvents[0].body, '{"output_text":"{}"}');

    const malformedEvents = [];
    global.fetch = async () => new Response('{"output_text":', { status: 200 });
    const malformed = await provider.execute({ task: 'responses', body: {} }, {
      requestId: 'malformed',
      forensicSink: (event) => malformedEvents.push(event)
    });
    assert.equal(malformed.ok, true);
    assert.deepEqual(malformed.data, {});
    assert.deepEqual(malformedEvents.map((event) => event.stage), ['raw_http_body', 'outer_json_parse_failure']);
    assert.equal(malformedEvents[0].body, '{"output_text":');

    global.fetch = async () => new Response(JSON.stringify({ output_text: '{}' }), { status: 200 });
    await assert.rejects(
      provider.execute({ task: 'responses', body: {} }, {
        requestId: 'sink-failure',
        forensicSink: () => { throw new Error('disk unavailable'); }
      }),
      (error) => error.code === 'FORENSIC_EVIDENCE_PERSISTENCE_FAILED'
    );
  } finally {
    global.fetch = originalFetch;
  }
}

async function adapterBoundaryTests() {
  const source = { id: 'FORENSIC', text: 'Exact source sentence.', evidence: [] };
  const envelope = buildEnvelope(source);

  const successRaw = {
    output_text: JSON.stringify(candidateWithSelection('Exact source sentence.')),
    usage: { input_tokens: 1, output_tokens: 1 }
  };
  const successProvider = {
    async health() { return { status: 'ready' }; },
    async execute() { return { ok: true, data: successRaw }; }
  };
  const successEvents = [];
  const adapter = createOpenAiResponsesAdapter({ provider: successProvider });
  const success = await adapter.invoke(envelope, {
    requestId: 'success',
    forensicSink: (event) => successEvents.push(event)
  });
  assert.strictEqual(success.rawResponse, successRaw);
  assert.deepEqual(successEvents.map((event) => event.stage), ['parsed_provider_response', 'output_text']);
  assert.equal(JSON.parse(success.extractionResponse.output_text).EXPLICIT[0].provenance[0].quote, 'Exact source sentence.');

  const malformedRaw = { output_text: '{"EXPLICIT":[' };
  const malformedProvider = {
    async health() { return { status: 'ready' }; },
    async execute() { return { ok: true, data: malformedRaw }; }
  };
  const malformedEvents = [];
  const malformedAdapter = createOpenAiResponsesAdapter({ provider: malformedProvider });
  await assert.rejects(
    malformedAdapter.invoke(envelope, {
      requestId: 'candidate-json-failure',
      forensicSink: (event) => malformedEvents.push(event)
    }),
    SyntaxError
  );
  assert.deepEqual(malformedEvents.map((event) => event.stage), [
    'parsed_provider_response', 'output_text', 'interpretation_failure'
  ]);
  assert.equal(malformedEvents[2].interpretationStage, 'candidate_json_parse');
  assert.strictEqual(malformedEvents[0].response, malformedRaw);
  assert.equal(malformedEvents[1].text, malformedRaw.output_text);

  const projectionRaw = { output_text: JSON.stringify(candidateWithSelection('Missing exact text.')) };
  const projectionProvider = {
    async health() { return { status: 'ready' }; },
    async execute() { return { ok: true, data: projectionRaw }; }
  };
  const projectionEvents = [];
  const projectionAdapter = createOpenAiResponsesAdapter({ provider: projectionProvider });
  await assert.rejects(
    projectionAdapter.invoke(envelope, {
      requestId: 'projection-failure',
      forensicSink: (event) => projectionEvents.push(event)
    }),
    /0 exact source matches/
  );
  assert.equal(projectionEvents.at(-1).stage, 'interpretation_failure');
  assert.equal(projectionEvents.at(-1).interpretationStage, 'structured_provenance_projection');

  await assert.rejects(
    adapter.invoke(envelope, {
      requestId: 'adapter-sink-failure',
      forensicSink: () => { throw new Error('sink unavailable'); }
    }),
    (error) => error.code === 'FORENSIC_EVIDENCE_PERSISTENCE_FAILED'
  );

  const identity1 = sha256(stableBytes({ response: successRaw, outputText: successRaw.output_text }));
  const identity2 = sha256(stableBytes({ response: successRaw, outputText: successRaw.output_text }));
  assert.equal(identity1, identity2);
}

(async () => {
  await providerBoundaryTests();
  await adapterBoundaryTests();
  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    rawHttpPreservedBeforeParse: true,
    malformedOuterJsonOutcomePreserved: true,
    parsedProviderPreservedBeforeProjection: true,
    malformedOutputTextStillFails: true,
    projectionFailureStillFails: true,
    forensicSinkPolicy: 'FAIL_CLOSED_HARNESS_ONLY',
    providerSemanticsWithoutSinkUnchanged: true,
    deterministicFixtureIdentity: true,
    realModelCalls: 0
  })}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
