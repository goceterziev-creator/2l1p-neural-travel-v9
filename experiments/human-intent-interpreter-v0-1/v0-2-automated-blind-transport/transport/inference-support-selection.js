'use strict';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const selectionSchema = Object.freeze({
  type: 'object',
  properties: { text: { type: 'string', minLength: 1 } },
  required: ['text'],
  additionalProperties: false
});

function rawSupportProviderSchema() {
  return {
    type: 'object',
    properties: {
      quote: { type: 'null' },
      evidence_id: { type: 'null' },
      selections: { type: 'array', minItems: 1, maxItems: 1, items: clone(selectionSchema) },
      spans: { type: 'array', maxItems: 0, items: { type: 'object' } }
    },
    required: ['quote', 'evidence_id', 'selections', 'spans'],
    additionalProperties: false
  };
}

function suppliedSupportProviderSchema(branch) {
  const copy = clone(branch);
  copy.properties.selections = { type: 'array', maxItems: 0, items: clone(selectionSchema) };
  copy.properties.spans = { type: 'array', maxItems: 0, items: { type: 'object' } };
  if (!copy.required.includes('selections')) copy.required.push('selections');
  if (!copy.required.includes('spans')) copy.required.push('spans');
  return copy;
}

function inferenceSupportSelectionSchema(schema) {
  const root = clone(schema);
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object' && node.properties?.source_type?.enum?.length === 1
      && node.properties.source_type.enum[0] === 'INFERENCE'
      && node.properties.supports?.items) {
      const current = node.properties.supports.items;
      const branches = Array.isArray(current.anyOf) ? current.anyOf : [current];
      const supplied = branches.find((branch) => branch?.properties?.evidence_id?.type === 'string');
      node.properties.supports.items = supplied
        ? { anyOf: [rawSupportProviderSchema(), suppliedSupportProviderSchema(supplied)] }
        : rawSupportProviderSchema();
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  }
  visit(root);
  return root;
}

function resolveUniqueExact(sourceText, selection, label) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)
    || Object.keys(selection).length !== 1 || typeof selection.text !== 'string' || selection.text.length === 0) {
    throw new TypeError(`${label} exact selection is invalid`);
  }
  const first = sourceText.indexOf(selection.text);
  if (first === -1) throw new TypeError(`${label} exact selection has 0 source matches`);
  if (sourceText.indexOf(selection.text, first + 1) !== -1) {
    throw new TypeError(`${label} exact selection has multiple source matches`);
  }
  return selection.text;
}

function projectInferenceSupportSelections(candidate, sourceText) {
  const output = clone(candidate);
  for (const entries of Object.values(output)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.provenance)) continue;
      for (const provenance of entry.provenance) {
        if (!provenance || provenance.source_type !== 'INFERENCE' || !Array.isArray(provenance.supports)) continue;
        provenance.supports = provenance.supports.map((support, index) => {
          if (!support || typeof support !== 'object' || Array.isArray(support)) return support;
          if (support.evidence_id !== null) {
            if (!Array.isArray(support.selections) || support.selections.length !== 0) {
              throw new TypeError(`INFERENCE supplied support[${index}] selections must be empty`);
            }
            if (!Array.isArray(support.spans) || support.spans.length !== 0) {
              throw new TypeError(`INFERENCE supplied support[${index}] spans must be empty`);
            }
            const { selections, spans, ...canonical } = support;
            return canonical;
          }
          if (support.quote !== null) throw new TypeError(`INFERENCE RAW_TEXT support[${index}] quote must be null`);
          if (!Array.isArray(support.spans) || support.spans.length !== 0) {
            throw new TypeError(`INFERENCE RAW_TEXT support[${index}] spans must be empty`);
          }
          if (!Array.isArray(support.selections) || support.selections.length !== 1) {
            throw new TypeError(`INFERENCE RAW_TEXT support[${index}] requires exactly one exact selection`);
          }
          const quote = resolveUniqueExact(sourceText, support.selections[0], `INFERENCE RAW_TEXT support[${index}]`);
          return { quote, evidence_id: null };
        });
      }
    }
  }
  return output;
}

function extractOutputText(rawResponse) {
  if (typeof rawResponse?.output_text === 'string') return rawResponse.output_text;
  for (const item of rawResponse?.output || []) for (const content of item?.content || []) {
    if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
  }
  throw new TypeError('provider response contains no output_text');
}

function replaceOutputText(rawResponse, text) {
  const copy = clone(rawResponse);
  if (typeof copy.output_text === 'string') { copy.output_text = text; return copy; }
  for (const item of copy.output || []) for (const content of item?.content || []) {
    if (content?.type === 'output_text' && typeof content.text === 'string') { content.text = text; return copy; }
  }
  throw new TypeError('provider response contains no replaceable output_text');
}

function projectInferenceSupportSelectionsInResponse(rawResponse, sourceText) {
  const candidate = JSON.parse(extractOutputText(rawResponse));
  return replaceOutputText(rawResponse, JSON.stringify(projectInferenceSupportSelections(candidate, sourceText)));
}

module.exports = {
  inferenceSupportSelectionSchema,
  projectInferenceSupportSelections,
  projectInferenceSupportSelectionsInResponse
};
