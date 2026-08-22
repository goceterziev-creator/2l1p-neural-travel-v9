'use strict';

const path = require('node:path');

const EXPERIMENTAL_MODEL = 'gpt-4.1-mini-2025-04-14';

const PROVIDER_PROVENANCE_INSTRUCTIONS = `Provider-facing provenance representation:
Each provenance array element represents exactly one independently valid source span or one supplied-evidence reference.
For RAW_TEXT, quote exactly one contiguous span copied from the raw text. If one semantic statement depends on two or more non-contiguous raw-text spans, emit two or more separate RAW_TEXT provenance elements in the same entry.provenance array. Never concatenate, summarize, bridge, omit words from, add words to, or reorder disjoint spans inside one quote field.
For SUPPLIED_EVIDENCE, one provenance element identifies exactly one evidence_id and, when quote is present, one exact contiguous span from that evidence item.
For INFERENCE, use INFERENCE provenance with supports as defined by the accepted contract; each support reference remains independently exact.
Multiple provenance elements support one semantic entry only; they do not create additional semantic claims or change the entry's section, statement, authority meaning, or Human Gate meaning.`;

function createOpenAiResponsesAdapter(options = {}) {
  const providerLayerPath = options.providerLayerPath || process.env.HII_PROVIDER_LAYER_PATH
    || path.resolve(__dirname, '..', '..', '..', '..', '..', 'provider-layer');
  const model = options.model || process.env.HII_V0_2_MODEL || EXPERIMENTAL_MODEL;
  if (model !== EXPERIMENTAL_MODEL) {
    throw new TypeError(`V0.2 experimental adapter permits only ${EXPERIMENTAL_MODEL}`);
  }
  const parameters = Object.freeze({
    store: false,
    temperature: 0,
    max_output_tokens: 6000,
    structured_output: true,
    pricing_usd_per_million: { input: 0.4, output: 1.6 },
    max_budget_usd: 5
  });
  let provider = options.provider || null;

  return Object.freeze({
    id: 'openai-responses-native-fetch',
    model,
    parameters,
    async invoke(envelope, context = {}) {
      if (!provider) {
        if (!process.env.OPENAI_API_KEY) {
          const error = new Error('BLOCKED_REAL_MODEL_ACCESS: OpenAI provider is not securely configured');
          error.code = 'BLOCKED_REAL_MODEL_ACCESS';
          throw error;
        }
        const providerLayer = options.providerLayer || require(providerLayerPath);
        provider = providerLayer.createOpenAiProvider(providerLayer.loadProviderConfig(process.env));
      }
      const health = await provider.health();
      if (health.status !== 'ready') {
        const error = new Error('BLOCKED_REAL_MODEL_ACCESS: OpenAI provider is not securely configured');
        error.code = 'BLOCKED_REAL_MODEL_ACCESS';
        throw error;
      }
      const result = await provider.execute({
        task: 'responses',
        model,
        body: {
          store: false,
          temperature: parameters.temperature,
          max_output_tokens: parameters.max_output_tokens,
          input: [
            { role: 'system', content: [{ type: 'input_text', text: `${envelope.instructions}\n\n${PROVIDER_PROVENANCE_INSTRUCTIONS}` }] },
            { role: 'user', content: [{ type: 'input_text', text: JSON.stringify({
              text: envelope.text,
              language: envelope.language,
              evidence: envelope.evidence
            }) }] }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'human_intent_candidate',
              strict: true,
              schema: envelope.outputSchema
            }
          }
        }
      }, { requestId: context.requestId || envelope.caseId });

      if (!result.ok) {
        const error = new Error(result.errors?.[0]?.message || 'OpenAI provider request failed');
        error.code = result.errors?.[0]?.code || 'PROVIDER_REQUEST_FAILED';
        throw error;
      }
      return { rawResponse: result.data };
    }
  });
}

module.exports = { EXPERIMENTAL_MODEL, PROVIDER_PROVENANCE_INSTRUCTIONS, createOpenAiResponsesAdapter };
