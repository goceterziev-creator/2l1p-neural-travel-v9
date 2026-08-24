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
    units.push(Object.freeze({
      id: `u${String(index).padStart(5, '0')}`,
      start: offset,
      end: offset + text.length,
      text
    }));
    offset += text.length;
  }
  if (offset !== sourceText.length || units.map((unit) => unit.text).join('') !== sourceText) {
    throw new TypeError('raw text segmentation is not lossless');
  }
  return Object.freeze({ source_id, units: Object.freeze(units) });
}

function providerAddressMap(sourceText) {
  const map = segmentRawText(sourceText);
  return Object.freeze({
    source_id: map.source_id,
    units: Object.freeze(map.units.map(({ id, text }) => Object.freeze({ id, text })))
  });
}

function resolveAddressSelection(sourceText, selection) {
  const map = segmentRawText(sourceText);
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    throw new TypeError('RAW_TEXT address selection is invalid');
  }
  const keys = Object.keys(selection).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['end_id', 'source_id', 'start_id'])) {
    throw new TypeError('RAW_TEXT address selection fields are invalid');
  }
  if (selection.source_id !== map.source_id) throw new TypeError('RAW_TEXT address selection source identity is invalid');
  const byId = new Map(map.units.map((unit, index) => [unit.id, { unit, index }]));
  const start = byId.get(selection.start_id);
  const end = byId.get(selection.end_id);
  if (!start || !end) throw new TypeError('RAW_TEXT address selection contains an unknown unit id');
  if (start.index > end.index) throw new TypeError('RAW_TEXT address selection is reversed');
  return Object.freeze({
    start: start.unit.start,
    end: end.unit.end,
    quote: sourceText.slice(start.unit.start, end.unit.end)
  });
}

function addressSelectionSchema(sourceText) {
  const map = segmentRawText(sourceText);
  const ids = map.units.map((unit) => unit.id);
  return {
    type: 'object',
    properties: {
      source_id: { type: 'string', enum: [map.source_id] },
      start_id: { type: 'string', enum: ids },
      end_id: { type: 'string', enum: ids }
    },
    required: ['source_id', 'start_id', 'end_id'],
    additionalProperties: false
  };
}

module.exports = {
  sourceIdentity,
  segmentRawText,
  providerAddressMap,
  resolveAddressSelection,
  addressSelectionSchema
};
