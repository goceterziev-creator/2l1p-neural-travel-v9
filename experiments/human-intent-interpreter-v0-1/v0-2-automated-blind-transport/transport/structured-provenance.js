'use strict';

const RAW_TEXT = 'RAW_TEXT';
const SUPPLIED_EVIDENCE = 'SUPPLIED_EVIDENCE';
const INFERENCE = 'INFERENCE';

const spanSchema = Object.freeze({
  type: 'object',
  properties: {
    start: { type: 'integer', minimum: 0 },
    end: { type: 'integer', minimum: 1 }
  },
  required: ['start', 'end'],
  additionalProperties: false
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isProvenanceSchema(node) {
  const properties = node?.properties;
  return node?.type === 'object'
    && Array.isArray(properties?.source_type?.enum)
    && properties.quote
    && properties.evidence_id
    && properties.supports;
}

function emptyArraySchema(items) {
  return { type: 'array', items: clone(items), maxItems: 0 };
}

function provenanceVariant(base, sourceType) {
  const referenceItems = base.properties.supports.items;
  const common = {
    source_type: { type: 'string', enum: [sourceType] },
    quote: clone(base.properties.quote),
    evidence_id: clone(base.properties.evidence_id),
    supports: clone(base.properties.supports),
    spans: {
      type: 'array',
      description: 'UTF-16 code-unit [start,end) ranges into the exact raw brief.',
      items: clone(spanSchema)
    }
  };

  if (sourceType === RAW_TEXT) {
    common.quote = { type: 'null' };
    common.evidence_id = { type: 'null' };
    common.supports = emptyArraySchema(referenceItems);
    common.spans.minItems = 1;
  } else if (sourceType === SUPPLIED_EVIDENCE) {
    common.evidence_id = { type: 'string' };
    common.supports = emptyArraySchema(referenceItems);
    common.spans.maxItems = 0;
  } else if (sourceType === INFERENCE) {
    common.quote = { type: 'null' };
    common.evidence_id = { type: 'null' };
    common.supports.minItems = 1;
    common.spans.maxItems = 0;
  } else {
    throw new TypeError(`unsupported provenance source type: ${sourceType}`);
  }

  return {
    type: 'object',
    properties: common,
    required: ['source_type', 'quote', 'evidence_id', 'supports', 'spans'],
    additionalProperties: false
  };
}

function structuredProvenanceSchema(schema) {
  const root = clone(schema);
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (isProvenanceSchema(node)) {
      const allowed = node.properties.source_type.enum;
      const variants = [RAW_TEXT, SUPPLIED_EVIDENCE, INFERENCE]
        .filter((sourceType) => allowed.includes(sourceType))
        .map((sourceType) => provenanceVariant(node, sourceType));
      if (!variants.length) throw new TypeError('provider provenance schema has no supported source type');
      for (const key of Object.keys(node)) delete node[key];
      node.anyOf = variants;
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

function assertSpan(span, sourceLength, index) {
  if (!span || typeof span !== 'object' || Array.isArray(span)) {
    throw new TypeError(`RAW_TEXT spans[${index}] is invalid`);
  }
  const keys = Object.keys(span).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['end', 'start'])) {
    throw new TypeError(`RAW_TEXT spans[${index}] fields are invalid`);
  }
  if (!Number.isInteger(span.start) || !Number.isInteger(span.end)) {
    throw new TypeError(`RAW_TEXT spans[${index}] offsets must be integers`);
  }
  if (span.start < 0 || span.end > sourceLength) {
    throw new TypeError(`RAW_TEXT spans[${index}] is out of range`);
  }
  if (span.start >= span.end) {
    throw new TypeError(`RAW_TEXT spans[${index}] must be non-empty and forward`);
  }
}

function expandStructuredProvenance(candidate, sourceText) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('structured candidate must be an object');
  }
  if (typeof sourceText !== 'string') throw new TypeError('raw source text is required');

  const output = clone(candidate);
  for (const entries of Object.values(output)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.provenance)) continue;
      const expanded = [];
      for (const item of entry.provenance) {
        if (!item || typeof item !== 'object') {
          expanded.push(item);
          continue;
        }
        const spans = item.spans;
        if (!Array.isArray(spans)) throw new TypeError('provider provenance spans must be an array');

        if (item.source_type !== RAW_TEXT) {
          if (spans.length !== 0) throw new TypeError(`${item.source_type}: spans must be empty`);
          const { spans: ignored, ...legacy } = item;
          expanded.push(legacy);
          continue;
        }

        if (item.quote !== null || item.evidence_id !== null || item.supports?.length !== 0) {
          throw new TypeError('RAW_TEXT structured provenance must use spans only');
        }
        if (spans.length === 0) throw new TypeError('RAW_TEXT structured provenance requires at least one span');

        let previousEnd = -1;
        const seen = new Set();
        spans.forEach((span, index) => {
          assertSpan(span, sourceText.length, index);
          const identity = `${span.start}:${span.end}`;
          if (seen.has(identity)) throw new TypeError(`RAW_TEXT spans[${index}] duplicates an earlier span`);
          seen.add(identity);
          if (span.start < previousEnd) {
            throw new TypeError(`RAW_TEXT spans[${index}] overlaps or is out of order`);
          }
          previousEnd = span.end;
          expanded.push({
            source_type: RAW_TEXT,
            quote: sourceText.slice(span.start, span.end),
            evidence_id: null,
            supports: []
          });
        });
      }
      entry.provenance = expanded;
    }
  }
  return output;
}

function extractOutputText(rawResponse) {
  if (typeof rawResponse?.output_text === 'string') return rawResponse.output_text;
  for (const item of rawResponse?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new TypeError('provider response contains no output_text');
}

function replaceOutputText(rawResponse, text) {
  const copy = clone(rawResponse);
  if (typeof copy.output_text === 'string') {
    copy.output_text = text;
    return copy;
  }
  for (const item of copy.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        content.text = text;
        return copy;
      }
    }
  }
  throw new TypeError('provider response contains no replaceable output_text');
}

function extractionResponseFromStructured(rawResponse, sourceText) {
  const text = extractOutputText(rawResponse);
  const candidate = JSON.parse(text);
  const expanded = expandStructuredProvenance(candidate, sourceText);
  return replaceOutputText(rawResponse, JSON.stringify(expanded));
}

module.exports = {
  spanSchema,
  structuredProvenanceSchema,
  expandStructuredProvenance,
  extractionResponseFromStructured
};
