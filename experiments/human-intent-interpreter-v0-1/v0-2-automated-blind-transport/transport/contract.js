'use strict';

const crypto = require('node:crypto');

const SECTIONS = Object.freeze([
  'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
  'NECESSARY_COLLATERAL_CHANGES'
]);

const SOURCE_TYPES = new Set(['RAW_TEXT', 'SUPPLIED_EVIDENCE', 'INFERENCE']);

const PUBLIC_PROTOCOL = `Human Intent Interpreter V0.1 public protocol.
Return only the candidate intent contract described by the supplied JSON schema.
Classify requested facts and actions as EXPLICIT. Put only supported, non-literal
interpretations in INFERRED. LOCKED contains invariants that execution must
preserve. UNKNOWN contains materially relevant facts established as unresolved;
do not list arbitrary omissions and do not invent facts. AUTHORIZED contains
requested execution and delegated technical action. NOT_AUTHORIZED contains
prohibited or out-of-scope action. PROPOSED contains only optional improvements,
alternatives, extensions, or additional outcomes outside the requested result.
Requested action, delegated execution, and necessary mechanics are not PROPOSED.
HUMAN_GATES are required only when approval is explicitly reserved or an
established UNKNOWN blocks a specific authoritative action. Every entry must
carry exact RAW_TEXT, SUPPLIED_EVIDENCE, or supported INFERENCE provenance.
Never fabricate or rewrite a quotation represented as exact.`;

const referenceSchema = Object.freeze({
  type: 'object',
  properties: {
    quote: { type: ['string', 'null'] },
    evidence_id: { type: ['string', 'null'] }
  },
  required: ['quote', 'evidence_id'],
  additionalProperties: false
});

const provenanceSchema = Object.freeze({
  type: 'object',
  properties: {
    source_type: { type: 'string', enum: [...SOURCE_TYPES] },
    quote: { type: ['string', 'null'] },
    evidence_id: { type: ['string', 'null'] },
    supports: { type: 'array', items: referenceSchema }
  },
  required: ['source_type', 'quote', 'evidence_id', 'supports'],
  additionalProperties: false
});

const entrySchema = Object.freeze({
  type: 'object',
  properties: {
    id: { type: 'string' },
    statement: { type: 'string' },
    provenance: { type: 'array', items: provenanceSchema },
    targets: { type: 'array', items: { type: 'string' } },
    required: { type: 'boolean' },
    requiredFor: { type: 'string' }
  },
  required: ['id', 'statement', 'provenance', 'targets', 'required', 'requiredFor'],
  additionalProperties: false
});

const CANDIDATE_SCHEMA = Object.freeze({
  type: 'object',
  properties: Object.fromEntries(SECTIONS.map((section) => [section, {
    type: 'array',
    items: entrySchema
  }])),
  required: [...SECTIONS],
  additionalProperties: false
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalJson(value[key]);
      return out;
    }, {});
  }
  return value;
}

function stableBytes(value) {
  return `${JSON.stringify(canonicalJson(value), null, 2)}\n`;
}

function buildEnvelope(source) {
  if (!source || typeof source.id !== 'string' || typeof source.text !== 'string') {
    throw new TypeError('source requires id and raw text');
  }
  return Object.freeze({
    protocolVersion: 'hii-v0.1-accepted',
    caseId: source.id,
    language: source.language || 'und',
    text: source.text,
    evidence: Array.isArray(source.evidence) ? source.evidence : [],
    instructions: PUBLIC_PROTOCOL,
    outputSchema: CANDIDATE_SCHEMA
  });
}

function assertReference(reference, source, evidence, label) {
  if (!reference || typeof reference !== 'object') throw new TypeError(`${label}: invalid reference`);
  const quote = reference.quote;
  const evidenceId = reference.evidence_id;
  if (evidenceId !== null) {
    if (typeof evidenceId !== 'string' || !evidence.has(evidenceId)) {
      throw new TypeError(`${label}: unknown evidence reference`);
    }
    if (quote !== null && (typeof quote !== 'string' || !evidence.get(evidenceId).includes(quote))) {
      throw new TypeError(`${label}: evidence quote is not exact`);
    }
    return;
  }
  if (typeof quote !== 'string' || !source.text.includes(quote)) {
    throw new TypeError(`${label}: raw quote is not exact`);
  }
}

function validateCandidate(candidate, source) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('candidate must be an object');
  }
  const keys = Object.keys(candidate).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...SECTIONS].sort())) {
    throw new TypeError('candidate sections must match the accepted output contract exactly');
  }

  const evidence = new Map((source.evidence || []).map((item) => [item.evidence_id, item.content]));
  const ids = new Set();
  for (const section of SECTIONS) {
    if (!Array.isArray(candidate[section])) throw new TypeError(`${section} must be an array`);
    for (const entry of candidate[section]) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || typeof entry.statement !== 'string' || !entry.statement) {
        throw new TypeError(`${section}: invalid entry`);
      }
      if (ids.has(entry.id)) throw new TypeError(`duplicate candidate id: ${entry.id}`);
      ids.add(entry.id);
      if (!Array.isArray(entry.provenance) || entry.provenance.length === 0) {
        throw new TypeError(`${entry.id}: provenance is required`);
      }
      if (!Array.isArray(entry.targets) || typeof entry.required !== 'boolean' || typeof entry.requiredFor !== 'string') {
        throw new TypeError(`${entry.id}: strict transport fields are invalid`);
      }
      if (section === 'HUMAN_GATES' && typeof entry.required !== 'boolean') {
        throw new TypeError(`${entry.id}: gate required flag is missing`);
      }
      if (section === 'NECESSARY_COLLATERAL_CHANGES' && entry.required && !entry.requiredFor) {
        throw new TypeError(`${entry.id}: required collateral target is missing`);
      }
      for (const provenance of entry.provenance) {
        if (!SOURCE_TYPES.has(provenance.source_type)) throw new TypeError(`${entry.id}: source type is invalid`);
        if (!Array.isArray(provenance.supports)) throw new TypeError(`${entry.id}: supports must be an array`);
        if (provenance.source_type === 'INFERENCE') {
          if (!provenance.supports.length) throw new TypeError(`${entry.id}: inference support is required`);
          provenance.supports.forEach((reference, index) => assertReference(reference, source, evidence, `${entry.id}.supports[${index}]`));
        } else {
          assertReference(provenance, source, evidence, `${entry.id}.provenance`);
        }
      }
    }
  }
  return candidate;
}

function extractCandidateText(rawResponse) {
  if (typeof rawResponse?.output_text === 'string') return rawResponse.output_text;
  for (const item of rawResponse?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new TypeError('provider response contains no output_text');
}

function extractCandidate(rawResponse, source) {
  const text = extractCandidateText(rawResponse);
  if (!text.trim().startsWith('{') || !text.trim().endsWith('}')) {
    throw new TypeError('candidate response must be one strict JSON object without commentary or fences');
  }
  return validateCandidate(JSON.parse(text), source);
}

module.exports = {
  CANDIDATE_SCHEMA,
  PUBLIC_PROTOCOL,
  SECTIONS,
  buildEnvelope,
  canonicalJson,
  extractCandidate,
  sha256,
  stableBytes,
  validateCandidate
};
