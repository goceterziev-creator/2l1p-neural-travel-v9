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

const selectionSchema = Object.freeze({
  type: 'object',
  properties: {
    text: { type: 'string', minLength: 1 }
  },
  required: ['text'],
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
  return {
    type: 'array',
    items: clone(items),
    maxItems: 0
  };
}

function inferenceSupportSchema(original, evidenceIds) {
  const base = clone(original.properties.supports.items);
  const rawTextSupport = {
    type: 'object',
    properties: {
      quote: { type: 'string', minLength: 1 },
      evidence_id: { type: 'null' }
    },
    required: ['quote', 'evidence_id'],
    additionalProperties: false
  };
  if (!evidenceIds.length) return rawTextSupport;
  const suppliedEvidenceSupport = {
    type: 'object',
    properties: {
      quote: { type: 'string', minLength: 1 },
      evidence_id: { type: 'string', enum: [...evidenceIds] }
    },
    required: ['quote', 'evidence_id'],
    additionalProperties: false
  };
  return { anyOf: [rawTextSupport, suppliedEvidenceSupport], description: base.description };
}

function provenanceVariant(sourceType, original, evidenceIds) {
  const supportItems = original.properties.supports.items;
  const properties = {
    source_type: { type: 'string', enum: [sourceType] },
    quote: { type: 'null' },
    evidence_id: { type: 'null' },
    supports: emptyArraySchema(supportItems),
    selections: emptyArraySchema(selectionSchema),
    spans: emptyArraySchema(spanSchema)
  };

  if (sourceType === RAW_TEXT) {
    properties.selections = {
      type: 'array',
      description: 'RAW_TEXT only: one or more exact, contiguous, verbatim substrings copied from the raw brief. MACHINE resolves each unique exact match to UTF-16 [start,end) coordinates.',
      minItems: 1,
      items: clone(selectionSchema)
    };
  } else if (sourceType === SUPPLIED_EVIDENCE) {
    properties.quote = { type: 'string', minLength: 1 };
    properties.evidence_id = evidenceIds.length
      ? { type: 'string', enum: [...evidenceIds] }
      : { type: 'string', enum: [] };
  } else if (sourceType === INFERENCE) {
    properties.supports = {
      type: 'array',
      minItems: 1,
      items: inferenceSupportSchema(original, evidenceIds)
    };
  } else {
    throw new TypeError(`unsupported provenance source_type in provider schema: ${sourceType}`);
  }

  return {
    type: 'object',
    properties,
    required: ['source_type', 'quote', 'evidence_id', 'supports', 'selections', 'spans'],
    additionalProperties: false
  };
}

function structuredProvenanceSchema(schema, evidenceIds = []) {
  const root = clone(schema);
  const allowedEvidenceIds = [...new Set(evidenceIds.filter((id) => typeof id === 'string' && id.length > 0))];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (isProvenanceSchema(node)) {
      const allowed = [...node.properties.source_type.enum];
      const original = clone(node);
      node.properties.selections = {
        type: 'array',
        description: 'Provider-authored exact RAW_TEXT selections. Variant constraints are enforced by anyOf.',
        items: clone(selectionSchema)
      };
      node.properties.spans = {
        type: 'array',
        description: 'MACHINE-resolved UTF-16 spans. Provider must leave this empty.',
        items: clone(spanSchema)
      };
      if (!node.required.includes('selections')) node.required.push('selections');
      if (!node.required.includes('spans')) node.required.push('spans');
      node.anyOf = allowed.map((sourceType) => provenanceVariant(sourceType, original, allowedEvidenceIds));
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

function resolveExactSelection(sourceText, selection, index) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    throw new TypeError(`RAW_TEXT selections[${index}] is invalid`);
  }
  const keys = Object.keys(selection).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['text'])) {
    throw new TypeError(`RAW_TEXT selections[${index}] fields are invalid`);
  }
  if (typeof selection.text !== 'string' || selection.text.length === 0) {
    throw new TypeError(`RAW_TEXT selections[${index}] text must be non-empty`);
  }
  const first = sourceText.indexOf(selection.text);
  if (first === -1) {
    throw new TypeError(`RAW_TEXT selections[${index}] has 0 exact source matches`);
  }
  const second = sourceText.indexOf(selection.text, first + 1);
  if (second !== -1) {
    throw new TypeError(`RAW_TEXT selections[${index}] has multiple exact source matches`);
  }
  return { start: first, end: first + selection.text.length };
}

function resolveStructuredSelections(candidate, sourceText) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('structured candidate must be an object');
  }
  if (typeof sourceText !== 'string') throw new TypeError('raw source text is required');

  const output = clone(candidate);
  for (const entries of Object.values(output)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.provenance)) continue;
      entry.provenance = entry.provenance.map((item) => {
        if (!item || typeof item !== 'object') return item;
        if (!Array.isArray(item.selections)) throw new TypeError('provider provenance selections must be an array');
        if (!Array.isArray(item.spans)) throw new TypeError('provider provenance spans must be an array');

        if (item.source_type !== RAW_TEXT) {
          if (item.selections.length !== 0) throw new TypeError(`${item.source_type}: selections must be empty`);
          if (item.spans.length !== 0) throw new TypeError(`${item.source_type}: provider-authored spans must be empty`);
          const { selections: ignoredSelections, ...rest } = item;
          return rest;
        }

        if (item.quote !== null || item.evidence_id !== null || item.supports?.length !== 0) {
          throw new TypeError('RAW_TEXT structured provenance must use exact selections only');
        }
        if (item.spans.length !== 0) throw new TypeError('RAW_TEXT provider-authored spans must be empty');
        if (item.selections.length === 0) throw new TypeError('RAW_TEXT structured provenance requires at least one exact selection');

        const spans = item.selections.map((selection, index) => resolveExactSelection(sourceText, selection, index));
        spans.sort((a, b) => a.start - b.start || a.end - b.end);
        const seen = new Set();
        let previousEnd = -1;
        spans.forEach((span, index) => {
          const identity = `${span.start}:${span.end}`;
          if (seen.has(identity)) throw new TypeError(`RAW_TEXT resolved spans[${index}] duplicates an earlier selection`);
          seen.add(identity);
          if (span.start < previousEnd) throw new TypeError(`RAW_TEXT resolved spans[${index}] overlaps an earlier selection`);
          previousEnd = span.end;
        });
        const { selections: ignoredSelections, ...rest } = item;
        return { ...rest, spans };
      });
    }
  }
  return output;
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
  const resolved = resolveStructuredSelections(candidate, sourceText);
  const expanded = expandStructuredProvenance(resolved, sourceText);
  return replaceOutputText(rawResponse, JSON.stringify(expanded));
}

module.exports = {
  spanSchema,
  selectionSchema,
  structuredProvenanceSchema,
  resolveStructuredSelections,
  expandStructuredProvenance,
  extractionResponseFromStructured
};