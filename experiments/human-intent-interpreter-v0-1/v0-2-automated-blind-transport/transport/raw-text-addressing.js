'use strict';

const crypto = require('node:crypto');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function sourceIdentity(sourceText) {
  if (typeof sourceText !== 'string') throw new TypeError('raw source text is required');
  return crypto.createHash('sha256').update(sourceText, 'utf8').digest('hex');
}

// Lossless, deterministic, non-semantic segmentation. Runs preserve every UTF-16
// code unit exactly while giving the provider stable envelope-local addresses.
function segmentRawText(sourceText) {
  if (typeof sourceText !== 'string') throw new TypeError('raw source text is required');
  const source_id = sourceIdentity(sourceText);
  const units = [];
  const re = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+/gu;
  let match;
  let offset = 0;
  while ((match = re.exec(sourceText)) !== null) {
    if (match.index !== offset) throw new TypeError('raw text segmentation is not lossless');
    const text = match[0];
    const index = units.length;
    units.push(Object.freeze({ id: `u${String(index).padStart(5, '0')}`, start: offset, end: offset + text.length, text }));
    offset += text.length;
  }
  if (offset !== sourceText.length || units.map((unit) => unit.text).join('') !== sourceText) {
    throw new TypeError('raw text segmentation is not lossless');
  }
  return Object.freeze({ source_id, units: Object.freeze(units) });
}

function providerAddressMap(sourceText) {
  const map = segmentRawText(sourceText);
  return Object.freeze({ source_id: map.source_id, units: Object.freeze(map.units.map(({ id, text }) => Object.freeze({ id, text }))) });
}

function resolveAddressSelection(sourceText, selection) {
  const map = segmentRawText(sourceText);
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) throw new TypeError('RAW_TEXT address selection is invalid');
  const keys = Object.keys(selection).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['end_id', 'source_id', 'start_id'])) throw new TypeError('RAW_TEXT address selection fields are invalid');
  if (selection.source_id !== map.source_id) throw new TypeError('RAW_TEXT address selection source identity is invalid');
  const byId = new Map(map.units.map((unit, index) => [unit.id, { unit, index }]));
  const start = byId.get(selection.start_id);
  const end = byId.get(selection.end_id);
  if (!start || !end) throw new TypeError('RAW_TEXT address selection contains an unknown unit id');
  if (start.index > end.index) throw new TypeError('RAW_TEXT address selection is reversed');
  return Object.freeze({ start: start.unit.start, end: end.unit.end, quote: sourceText.slice(start.unit.start, end.unit.end) });
}

function addressSelectionSchema(sourceText) {
  const map = segmentRawText(sourceText);
  const ids = map.units.map((unit) => unit.id);
  return { type: 'object', properties: { source_id: { type: 'string', enum: [map.source_id] }, start_id: { type: 'string', enum: ids }, end_id: { type: 'string', enum: ids } }, required: ['source_id', 'start_id', 'end_id'], additionalProperties: false };
}

// Provider-only transform. Canonical HII schemas remain unchanged.
function structuralAddressingSchema(schema, sourceText) {
  const root = clone(schema);
  const address = addressSelectionSchema(sourceText);
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object' && node.properties?.selections?.type === 'array') {
      const sourceType = node.properties?.source_type?.enum;
      const isTopRaw = Array.isArray(sourceType) && sourceType.length === 1 && sourceType[0] === 'RAW_TEXT';
      const isInferenceRawSupport = node.properties?.evidence_id?.type === 'null' && node.properties?.quote?.type === 'null'
        && node.properties.selections.minItems === 1;
      if (isTopRaw || isInferenceRawSupport) node.properties.selections.items = clone(address);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit); else visit(value);
    }
  }
  visit(root);
  return root;
}

function projectAddressSelections(candidate, sourceText) {
  const output = clone(candidate);
  function convertSelections(holder, label) {
    if (!Array.isArray(holder.selections)) return;
    holder.selections = holder.selections.map((selection, index) => {
      const resolved = resolveAddressSelection(sourceText, selection);
      return { text: resolved.quote };
    });
  }
  for (const entries of Object.values(output)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!Array.isArray(entry?.provenance)) continue;
      for (const provenance of entry.provenance) {
        if (provenance?.source_type === 'RAW_TEXT') convertSelections(provenance, 'RAW_TEXT');
        if (provenance?.source_type === 'INFERENCE' && Array.isArray(provenance.supports)) {
          provenance.supports.forEach((support) => {
            if (support?.evidence_id === null) convertSelections(support, 'INFERENCE RAW_TEXT support');
          });
        }
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
function projectAddressSelectionsInResponse(rawResponse, sourceText) {
  const candidate = JSON.parse(extractOutputText(rawResponse));
  return replaceOutputText(rawResponse, JSON.stringify(projectAddressSelections(candidate, sourceText)));
}

module.exports = { sourceIdentity, segmentRawText, providerAddressMap, resolveAddressSelection, addressSelectionSchema, structuralAddressingSchema, projectAddressSelections, projectAddressSelectionsInResponse };
