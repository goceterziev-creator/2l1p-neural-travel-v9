'use strict';

const path = require('node:path');
const { structuredProvenanceSchema, extractionResponseFromStructured } = require('../structured-provenance');
const { inferenceSupportSelectionSchema, projectInferenceSupportSelectionsInResponse } = require('../inference-support-selection');
const { providerAddressMap, structuralAddressingSchema, projectAddressSelectionsInResponse } = require('../raw-text-addressing');

const EXPERIMENTAL_MODEL = 'gpt-4.1-mini-2025-04-14';
const FORENSIC_EVIDENCE_PERSISTENCE_FAILED = 'FORENSIC_EVIDENCE_PERSISTENCE_FAILED';
const PROVIDER_REPRESENTATION = Object.freeze({
  id: 'structured-provenance-structural-addresses-v3',
  rawTextSelection: 'deterministic-envelope-local-source-address',
  inferenceRawTextSupport: 'one-support-one-structural-address',
  machineCoordinateSystem: 'UTF-16-code-units',
  machineRangeConvention: '[start,end)',
  projection: 'provider-address-selection-to-machine-materialized-canonical-evidence'
});

const PROVIDER_PROVENANCE_INSTRUCTIONS = `Provider-facing provenance representation:
For RAW_TEXT evidence, do not copy, rewrite, normalize, quote, or calculate character offsets from the raw brief. MACHINE supplies raw_text_address_map with immutable source_id and ordered lossless units. Select evidence only by address as {"source_id":"...","start_id":"...","end_id":"..."}. start_id and end_id are inclusive unit identities and must describe a forward contiguous range in that map. Set quote=null, evidence_id=null, supports=[], spans=[]. Multiple non-contiguous source regions require multiple independent selections. MACHINE alone materializes original frozen characters and canonical UTF-16 [start,end) coordinates. Invalid, foreign, unknown or reversed addresses are rejected.
For SUPPLIED_EVIDENCE, use only an evidence_id supplied in the current envelope, use an exact quote from that evidence item, and set selections=[], spans=[].
For INFERENCE, use one or more independent supports. A RAW_TEXT support sets quote=null, evidence_id=null, spans=[] and contains exactly one structural address selection. Multiple non-contiguous raw supports require multiple support objects. A SUPPLIED_EVIDENCE support uses only a supplied evidence_id with an exact quote and selections=[], spans=[]. Never invent an evidence_id.
Selections are evidence grounding only. Their number must not create, remove, move or reclassify semantic entries.`;

function providerRepresentationFor(envelope) {
  const evidenceIds = (envelope.evidence || []).map((item) => item.evidence_id);
  const supportSchema = inferenceSupportSelectionSchema(structuredProvenanceSchema(envelope.outputSchema, evidenceIds));
  return { descriptor: PROVIDER_REPRESENTATION, instructions: PROVIDER_PROVENANCE_INSTRUCTIONS, outputSchema: structuralAddressingSchema(supportSchema, envelope.text) };
}

function emitForensicEvidence(context = {}, event) {
  if (typeof context.forensicSink !== 'function') return;
  try { context.forensicSink(Object.freeze(event)); }
  catch (error) { const failure = new Error(`forensic evidence persistence failed: ${error.message}`); failure.code = FORENSIC_EVIDENCE_PERSISTENCE_FAILED; failure.cause = error; throw failure; }
}
function outputTextForEvidence(rawResponse) {
  if (typeof rawResponse?.output_text === 'string') return rawResponse.output_text;
  for (const item of rawResponse?.output || []) for (const content of item?.content || []) if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
  return null;
}

function createOpenAiResponsesAdapter(options = {}) {
  const providerLayerPath = options.providerLayerPath || process.env.HII_PROVIDER_LAYER_PATH || path.resolve(__dirname, '..', '..', '..', '..', '..', 'provider-layer');
  const model = options.model || process.env.HII_V0_2_MODEL || EXPERIMENTAL_MODEL;
  if (model !== EXPERIMENTAL_MODEL) throw new TypeError(`V0.2 experimental adapter permits only ${EXPERIMENTAL_MODEL}`);
  const parameters = Object.freeze({ store: false, temperature: 0, max_output_tokens: 6000, structured_output: true, pricing_usd_per_million: { input: 0.4, output: 1.6 }, max_budget_usd: 5 });
  let provider = options.provider || null;
  return Object.freeze({
    id: 'openai-responses-native-fetch', model, parameters, providerRepresentation: PROVIDER_REPRESENTATION, providerRepresentationFor,
    async invoke(envelope, context = {}) {
      if (!provider) {
        if (!process.env.OPENAI_API_KEY) { const error = new Error('BLOCKED_REAL_MODEL_ACCESS: OpenAI provider is not securely configured'); error.code = 'BLOCKED_REAL_MODEL_ACCESS'; throw error; }
        const providerLayer = options.providerLayer || require(providerLayerPath); provider = providerLayer.createOpenAiProvider(providerLayer.loadProviderConfig(process.env));
      }
      const health = await provider.health();
      if (health.status !== 'ready') { const error = new Error('BLOCKED_REAL_MODEL_ACCESS: OpenAI provider is not securely configured'); error.code = 'BLOCKED_REAL_MODEL_ACCESS'; throw error; }
      const representation = providerRepresentationFor(envelope);
      const result = await provider.execute({ task: 'responses', model, body: {
        store: false, temperature: parameters.temperature, max_output_tokens: parameters.max_output_tokens,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: `${envelope.instructions}\n\n${representation.instructions}` }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ text: envelope.text, raw_text_address_map: providerAddressMap(envelope.text), language: envelope.language, evidence: envelope.evidence }) }] }
        ],
        text: { format: { type: 'json_schema', name: 'human_intent_candidate', strict: true, schema: representation.outputSchema } }
      } }, { requestId: context.requestId || envelope.caseId, forensicSink: context.forensicSink });
      if (!result.ok) { const error = new Error(result.errors?.[0]?.message || 'OpenAI provider request failed'); error.code = result.errors?.[0]?.code || 'PROVIDER_REQUEST_FAILED'; throw error; }
      emitForensicEvidence(context, { stage: 'parsed_provider_response', response: result.data });
      const outputText = outputTextForEvidence(result.data);
      if (typeof outputText === 'string') emitForensicEvidence(context, { stage: 'output_text', text: outputText, length: outputText.length });
      try {
        const addressProjected = projectAddressSelectionsInResponse(result.data, envelope.text);
        const supportProjected = projectInferenceSupportSelectionsInResponse(addressProjected, envelope.text);
        return { rawResponse: result.data, extractionResponse: extractionResponseFromStructured(supportProjected, envelope.text) };
      } catch (error) {
        emitForensicEvidence(context, { stage: 'interpretation_failure', interpretationStage: error instanceof SyntaxError ? 'candidate_json_parse' : 'structured_provenance_projection', errorName: error.name, errorMessage: error.message });
        throw error;
      }
    }
  });
}

module.exports = { EXPERIMENTAL_MODEL, PROVIDER_REPRESENTATION, PROVIDER_PROVENANCE_INSTRUCTIONS, providerRepresentationFor, createOpenAiResponsesAdapter };
