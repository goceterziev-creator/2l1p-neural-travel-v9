'use strict';

const { SECTIONS, stableBytes } = require('../contract');

function entry(id, statement, quote) {
  return {
    id,
    statement,
    provenance: [{
      source_type: 'RAW_TEXT',
      quote,
      evidence_id: null,
      supports: []
    }],
    targets: [],
    required: false,
    requiredFor: {
      kind: 'NONE',
      text: '',
      section: '',
      entry_id: ''
    }
  };
}

function createFakeAdapter(options = {}) {
  return Object.freeze({
    id: 'fake',
    model: options.model || 'fake-transport-proof-v1',
    parameters: Object.freeze({
      deterministic: true,
      max_output_tokens: 0,
      pricing_usd_per_million: { input: 0, output: 0 },
      max_budget_usd: 0
    }),
    async invoke(envelope) {
      if (options.probePath) {
        require('node:fs').readFileSync(options.probePath);
      }
      const candidate = Object.fromEntries(SECTIONS.map((section) => [section, []]));
      const source = envelope.text;
      candidate.OUTCOME.push(entry('outcome.fake', 'Preserve the supplied raw intent for transport testing.', source));
      candidate.EXPLICIT.push(entry('explicit.fake', 'The supplied raw brief is the explicit transport input.', source));
      candidate.ACCEPTANCE.push(entry('acceptance.fake', 'The frozen candidate retains exact raw-text provenance.', source));
      const text = stableBytes(candidate).trim();
      return {
        rawResponse: {
          id: `fake-${envelope.caseId}`,
          model: this.model,
          output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
          usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
        }
      };
    }
  });
}

module.exports = { createFakeAdapter };
