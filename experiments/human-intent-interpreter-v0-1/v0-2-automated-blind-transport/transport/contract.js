'use strict';

const crypto = require('node:crypto');

const SECTIONS = Object.freeze([
  'OUTCOME', 'EXPLICIT', 'INFERRED', 'LOCKED', 'UNKNOWN', 'PROPOSED',
  'AUTHORIZED', 'NOT_AUTHORIZED', 'HUMAN_GATES', 'ACCEPTANCE',
  'NECESSARY_COLLATERAL_CHANGES'
]);

const SOURCE_TYPES = new Set(['RAW_TEXT', 'SUPPLIED_EVIDENCE', 'INFERENCE']);

const ID_NAMESPACES = Object.freeze({
  OUTCOME: 'outcome',
  EXPLICIT: 'explicit',
  INFERRED: 'inferred',
  LOCKED: 'locked',
  UNKNOWN: 'unknown',
  PROPOSED: 'proposed',
  AUTHORIZED: 'authorized',
  NOT_AUTHORIZED: 'not_authorized',
  HUMAN_GATES: 'gate',
  ACCEPTANCE: 'acceptance',
  NECESSARY_COLLATERAL_CHANGES: 'collateral'
});

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

function normalizeDuplicateIds(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;
  if (SECTIONS.some((section) => !Array.isArray(candidate[section]))) return candidate;

  const counts = new Map();
  for (const section of SECTIONS) {
    for (const entry of candidate[section]) {
      if (entry && typeof entry.id === 'string') {
        counts.set(entry.id, (counts.get(entry.id) || 0) + 1);
      }
    }
  }
  const duplicates = new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
  if (!duplicates.size) return candidate;

  // targets and requiredFor may contain contract-entry references. A repeated raw
  // ID cannot be resolved safely without semantic judgement, so reject instead
  // of guessing. Non-ID target labels and prose remain byte-for-byte unchanged.
  for (const section of SECTIONS) {
    for (const entry of candidate[section]) {
      const references = [
        ...(Array.isArray(entry?.targets) ? entry.targets : []),
        ...(typeof entry?.requiredFor === 'string' && entry.requiredFor ? [entry.requiredFor] : [])
      ];
      const ambiguous = references.find((reference) => duplicates.has(reference));
      if (ambiguous !== undefined) {
        throw new TypeError(`ambiguous reference to duplicate candidate id: ${ambiguous}`);
      }
    }
  }

  // Reserve every provider-supplied ID so a normalized ID can never silently
  // retain or collide with one of them.
  const used = new Set(counts.keys());
  const normalized = {};
  for (const section of SECTIONS) {
    normalized[section] = candidate[section].map((entry, index) => {
      if (!entry || !duplicates.has(entry.id)) return entry;
      const base = `${ID_NAMESPACES[section]}.${index + 1}`;
      let id = base;
      let suffix = 1;
      while (used.has(id)) {
        id = `${base}.normalized${suffix}`;
        suffix += 1;
      }
      used.add(id);
      return { ...entry, id };
    });
  }
  return normalized;
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
  return validateCandidate(normalizeDuplicateIds(JSON.parse(text)), source);
}

module.exports = {
  CANDIDATE_SCHEMA,
  PUBLIC_PROTOCOL,
  SECTIONS,
  buildEnvelope,
  canonicalJson,
  extractCandidate,
  normalizeDuplicateIds,
  sha256,
  stableBytes,
  validateCandidate
};
