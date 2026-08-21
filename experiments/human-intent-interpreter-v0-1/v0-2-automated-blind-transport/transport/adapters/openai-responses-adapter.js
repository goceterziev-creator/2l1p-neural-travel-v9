'use strict';

const path = require('node:path');

const EXPERIMENTAL_MODEL = 'gpt-4.1-mini-2025-04-14';

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
            { role: 'system', content: [{ type: 'input_text', text: envelope.instructions }] },
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

module.exports = { EXPERIMENTAL_MODEL, createOpenAiResponsesAdapter };
