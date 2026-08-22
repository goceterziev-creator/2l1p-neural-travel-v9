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
Never fabricate or rewrite a quotation represented as exact. INFERRED entries
must use INFERENCE provenance. Put each exact supporting source span in its own
supports item; never concatenate text from multiple sources into one quote.
Entry IDs are opaque strings, never references. Cross-entry references are
objects with separate section and entry_id fields; entry_id must exactly equal
the provider entry ID in the named section. targets contains only reference
objects. requiredFor is a tagged NONE, TEXT, or REFERENCE object. Never encode
a provider reference as a string. Strict extraction rejects zero or multiple
targets and converts the provider representation to the accepted V0 strings.`;

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

const REFERENCE_SECTIONS = Object.freeze(Object.values(ID_NAMESPACES));

const contractReferenceSchema = Object.freeze({
  type: 'object',
  properties: {
    section: { type: 'string', enum: REFERENCE_SECTIONS },
    entry_id: { type: 'string' }
  },
  required: ['section', 'entry_id'],
  additionalProperties: false
});

const requiredForSchema = Object.freeze({
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['NONE', 'TEXT', 'REFERENCE'] },
    text: { type: 'string' },
    section: { type: 'string', enum: ['', ...REFERENCE_SECTIONS] },
    entry_id: { type: 'string' }
  },
  required: ['kind', 'text', 'section', 'entry_id'],
  additionalProperties: false
});

const entrySchema = Object.freeze({
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Opaque entry identity. This string is never parsed as a cross-entry reference.'
    },
    statement: { type: 'string' },
    provenance: { type: 'array', items: provenanceSchema },
    targets: {
      type: 'array',
      description: 'Cross-entry references as structurally distinct objects. Use an empty array when there is no cross-entry reference.',
      items: contractReferenceSchema
    },
    required: { type: 'boolean' },
    requiredFor: requiredForSchema
  },
  required: ['id', 'statement', 'provenance', 'targets', 'required', 'requiredFor'],
  additionalProperties: false
});

const inferredProvenanceSchema = Object.freeze({
  ...provenanceSchema,
  properties: {
    ...provenanceSchema.properties,
    source_type: { type: 'string', enum: ['INFERENCE'] }
  }
});

const inferredEntrySchema = Object.freeze({
  ...entrySchema,
  properties: {
    ...entrySchema.properties,
    provenance: { type: 'array', items: inferredProvenanceSchema }
  }
});

const CANDIDATE_SCHEMA = Object.freeze({
  type: 'object',
  properties: Object.fromEntries(SECTIONS.map((section) => [section, {
    type: 'array',
    items: section === 'INFERRED' ? inferredEntrySchema : entrySchema
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

  // Reserve every provider-supplied ID so a normalized ID can never silently
  // retain or collide with one of them.
  const used = new Set(counts.keys());
  const normalizedIds = new Map();
  for (const section of SECTIONS) {
    candidate[section].forEach((entry, index) => {
      if (!entry || typeof entry.id !== 'string') return;
      if (!duplicates.has(entry.id)) {
        normalizedIds.set(entry, entry.id);
        return;
      }
      const base = `${ID_NAMESPACES[section]}.${index + 1}`;
      let id = base;
      let suffix = 1;
      while (used.has(id)) {
        id = `${base}.normalized${suffix}`;
        suffix += 1;
      }
      used.add(id);
      normalizedIds.set(entry, id);
    });
  }

  const byOriginalId = new Map();
  const bySectionAndOriginalId = new Map();
  for (const section of SECTIONS) {
    for (const entry of candidate[section]) {
      if (!entry || typeof entry.id !== 'string') continue;
      const record = { entry, normalizedId: normalizedIds.get(entry), section };
      if (!byOriginalId.has(entry.id)) byOriginalId.set(entry.id, []);
      byOriginalId.get(entry.id).push(record);
      const key = `${section}\u0000${entry.id}`;
      if (!bySectionAndOriginalId.has(key)) bySectionAndOriginalId.set(key, []);
      bySectionAndOriginalId.get(key).push(record);
    }
  }

  const sectionsByQualifier = new Map(
    Object.entries(ID_NAMESPACES).map(([section, qualifier]) => [qualifier, section])
  );
  const qualifierPattern = /^([A-Za-z_]+):([^:\s]+)$/;
  const directPattern = /^([A-Za-z_]+)\.([^\s]+)$/;

  function resolveReference(reference) {
    if (reference && typeof reference === 'object' && !Array.isArray(reference)) {
      const keys = Object.keys(reference).sort();
      if (JSON.stringify(keys) !== JSON.stringify(['entry_id', 'section'])) {
        throw new TypeError('structured candidate reference fields are invalid');
      }
      const section = sectionsByQualifier.get(reference.section);
      if (!section || typeof reference.entry_id !== 'string' || !reference.entry_id) {
        throw new TypeError('structured candidate reference is invalid');
      }
      const matches = bySectionAndOriginalId.get(`${section}\u0000${reference.entry_id}`) || [];
      if (matches.length !== 1) {
        throw new TypeError(
          `${reference.section}:${reference.entry_id}: candidate reference resolved to ${matches.length} entries`
        );
      }
      return matches[0].normalizedId;
    }
    if (typeof reference !== 'string' || !reference) return reference;
    const qualified = reference.match(qualifierPattern);
    if (qualified) {
      const section = sectionsByQualifier.get(qualified[1].toLowerCase());
      if (!section) throw new TypeError(`unknown candidate reference section: ${qualified[1]}`);
      const matches = [
        ...(bySectionAndOriginalId.get(`${section}\u0000${qualified[2]}`) || []),
        ...(bySectionAndOriginalId.get(`${section}\u0000${reference}`) || [])
      ].filter((record, index, all) => all.findIndex(({ entry }) => entry === record.entry) === index);
      if (matches.length !== 1) {
        throw new TypeError(`${reference}: candidate reference resolved to ${matches.length} entries`);
      }
      return matches[0].normalizedId;
    }

    const direct = reference.match(directPattern);
    if (direct && sectionsByQualifier.has(direct[1].toLowerCase())) {
      const matches = byOriginalId.get(reference) || [];
      if (matches.length !== 1) {
        throw new TypeError(`${reference}: direct candidate reference resolved to ${matches.length} entries`);
      }
      return matches[0].normalizedId;
    }

    const matches = byOriginalId.get(reference) || [];
    if (matches.length === 1) return matches[0].normalizedId;
    if (matches.length > 1) {
      throw new TypeError(`ambiguous reference to duplicate candidate id: ${reference}`);
    }
    if (/^\d+$/.test(reference)) {
      throw new TypeError(`${reference}: bare candidate reference resolved to 0 entries`);
    }
    return reference;
  }

  function resolveRequiredFor(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return typeof value === 'string' && value ? resolveReference(value) : value;
    }
    const keys = Object.keys(value).sort();
    if (JSON.stringify(keys) !== JSON.stringify(['entry_id', 'kind', 'section', 'text'])) {
      throw new TypeError('requiredFor provider fields are invalid');
    }
    if (value.kind === 'NONE') {
      return '';
    }
    if (value.kind === 'TEXT') {
      if (typeof value.text !== 'string' || !value.text) {
        throw new TypeError('requiredFor TEXT payload is invalid');
      }
      return value.text;
    }
    if (value.kind === 'REFERENCE') {
      return resolveReference({ section: value.section, entry_id: value.entry_id });
    }
    throw new TypeError(`requiredFor kind is invalid: ${value.kind}`);
  }

  let changed = false;
  const normalized = {};
  for (const section of SECTIONS) {
    normalized[section] = candidate[section].map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const id = normalizedIds.get(entry);
      const targets = Array.isArray(entry.targets) ? entry.targets.map(resolveReference) : entry.targets;
      const requiredFor = resolveRequiredFor(entry.requiredFor);
      const entryChanged = id !== entry.id
        || (Array.isArray(targets) && targets.some((target, index) => target !== entry.targets[index]))
        || requiredFor !== entry.requiredFor;
      changed ||= entryChanged;
      return entryChanged ? { ...entry, id, targets, requiredFor } : entry;
    });
  }
  return changed ? normalized : candidate;
}

function lexicalTokens(text) {
  const tokens = [];
  const pattern = /[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu;
  for (const match of text.matchAll(pattern)) {
    tokens.push({ value: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function boundaryCapitalizationEquivalent(candidateWord, sourceWord, index) {
  if (candidateWord === sourceWord) return true;
  if (index !== 0) return false;
  const candidateChars = [...candidateWord];
  const sourceChars = [...sourceWord];
  return candidateChars.length === sourceChars.length
    && candidateChars.slice(1).join('') === sourceChars.slice(1).join('')
    && candidateChars[0].toLocaleLowerCase('und') === sourceChars[0].toLocaleLowerCase('und');
}

function canonicalRawTextSpan(sourceText, modelQuote) {
  if (typeof modelQuote !== 'string' || !modelQuote) {
    throw new TypeError('RAW_TEXT quote must be a non-empty string');
  }
  if (sourceText.includes(modelQuote)) return modelQuote;

  const quoteTokens = lexicalTokens(modelQuote);
  const sourceTokens = lexicalTokens(sourceText);
  if (!quoteTokens.length) throw new TypeError('RAW_TEXT quote has no lexical content');

  const matches = [];
  for (let startIndex = 0; startIndex <= sourceTokens.length - quoteTokens.length; startIndex += 1) {
    let valid = true;
    for (let index = 0; index < quoteTokens.length; index += 1) {
      if (!boundaryCapitalizationEquivalent(
        quoteTokens[index].value,
        sourceTokens[startIndex + index].value,
        index
      )) {
        valid = false;
        break;
      }
      if (index > 0) {
        const quoteSeparator = modelQuote.slice(quoteTokens[index - 1].end, quoteTokens[index].start);
        const sourceSeparator = sourceText.slice(
          sourceTokens[startIndex + index - 1].end,
          sourceTokens[startIndex + index].start
        );
        if (quoteSeparator !== sourceSeparator) {
          valid = false;
          break;
        }
      }
    }
    if (!valid) continue;

    let spanStart = sourceTokens[startIndex].start;
    let spanEnd = sourceTokens[startIndex + quoteTokens.length - 1].end;
    const quotePrefix = modelQuote.slice(0, quoteTokens[0].start);
    const quoteSuffix = modelQuote.slice(quoteTokens[quoteTokens.length - 1].end);
    if (quotePrefix && sourceText.slice(spanStart - quotePrefix.length, spanStart) === quotePrefix) {
      spanStart -= quotePrefix.length;
    }
    if (quoteSuffix && sourceText.slice(spanEnd, spanEnd + quoteSuffix.length) === quoteSuffix) {
      spanEnd += quoteSuffix.length;
    }
    matches.push({ start: spanStart, end: spanEnd, quote: sourceText.slice(spanStart, spanEnd) });
  }

  const unique = matches.filter((match, index) => (
    matches.findIndex((candidate) => candidate.start === match.start && candidate.end === match.end) === index
  ));
  if (unique.length !== 1) {
    throw new TypeError(`RAW_TEXT quote has ${unique.length} canonical exact source spans`);
  }
  return unique[0].quote;
}

function evidenceClauseTokenRanges(content) {
  const tokens = lexicalTokens(content);
  if (!tokens.length) return [];
  const clauseStarts = [0];
  for (let index = 1; index < tokens.length; index += 1) {
    const separator = content.slice(tokens[index - 1].end, tokens[index].start);
    if (/[.!?;]/u.test(separator)) clauseStarts.push(index);
  }
  const clauses = clauseStarts.map((start, index) => ({
    start,
    end: (clauseStarts[index + 1] || tokens.length) - 1
  }));
  const ranges = [];
  for (let start = 0; start < clauses.length; start += 1) {
    for (let end = start; end < clauses.length; end += 1) {
      ranges.push({
        start: clauses[start].start,
        end: clauses[end].end,
        length: clauses[end].end - clauses[start].start + 1,
        text: content.slice(tokens[clauses[start].start].start, tokens[clauses[end].end].end)
      });
    }
  }
  return { tokens, ranges };
}

function canonicalEvidenceComposition(source, modelQuote) {
  if (typeof modelQuote !== 'string' || !modelQuote) {
    throw new TypeError('evidence-composed quote must be a non-empty string');
  }
  const quoteTokens = lexicalTokens(modelQuote);
  if (!quoteTokens.length) throw new TypeError('evidence-composed quote has no lexical content');

  const evidenceCandidates = (source.evidence || []).map((item) => ({
    evidence_id: item.evidence_id,
    content: item.content,
    ...evidenceClauseTokenRanges(item.content)
  }));
  const paths = Array.from({ length: quoteTokens.length + 1 }, () => []);
  paths[0].push([]);

  for (let quoteIndex = 0; quoteIndex < quoteTokens.length; quoteIndex += 1) {
    if (!paths[quoteIndex].length) continue;
    for (const evidence of evidenceCandidates) {
      for (const range of evidence.ranges || []) {
        const quoteEnd = quoteIndex + range.length - 1;
        if (quoteEnd >= quoteTokens.length) continue;
        const quoteSlice = modelQuote.slice(quoteTokens[quoteIndex].start, quoteTokens[quoteEnd].end);
        let canonicalQuote;
        try {
          canonicalQuote = canonicalRawTextSpan(range.text, quoteSlice);
        } catch {
          continue;
        }
        const support = { quote: canonicalQuote, evidence_id: evidence.evidence_id };
        for (const path of paths[quoteIndex]) paths[quoteEnd + 1].push([...path, support]);
      }
    }
  }

  const completed = paths[quoteTokens.length];
  const minimumSupportCount = completed.length
    ? Math.min(...completed.map((path) => path.length))
    : 0;
  const coarsest = completed.filter((path) => path.length === minimumSupportCount);
  const unique = coarsest.filter((path, index, all) => {
    const identity = stableBytes(path);
    return all.findIndex((candidate) => stableBytes(candidate) === identity) === index;
  });
  if (unique.length !== 1) {
    throw new TypeError(`evidence-composed quote has ${unique.length} exact source decompositions`);
  }
  return unique[0];
}

function canonicalizeRawTextProvenance(candidate, source) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;
  if (SECTIONS.some((section) => !Array.isArray(candidate[section]))) return candidate;

  const evidence = new Map((source.evidence || []).map((item) => [item.evidence_id, item.content]));
  let candidateChanged = false;
  const canonical = {};
  for (const section of SECTIONS) {
    canonical[section] = candidate[section].map((entry) => {
      if (!entry || !Array.isArray(entry.provenance)) return entry;
      let entryChanged = false;
      const provenance = entry.provenance.map((item) => {
        if (!item || typeof item !== 'object') return item;
        let itemChanged = false;
        let next = item;
        if (item.source_type === 'RAW_TEXT' && item.evidence_id === null) {
          try {
            const quote = canonicalRawTextSpan(source.text, item.quote);
            if (quote !== item.quote) {
              next = { ...next, quote };
              itemChanged = true;
            }
          } catch (error) {
            if (!/RAW_TEXT quote has 0 canonical exact source spans/.test(error.message)) throw error;
            const supports = canonicalEvidenceComposition(source, item.quote);
            next = supports.length === 1
              ? { source_type: 'SUPPLIED_EVIDENCE', ...supports[0], supports: [] }
              : { source_type: 'INFERENCE', quote: null, evidence_id: null, supports };
            itemChanged = true;
          }
        }
        if (item.source_type === 'SUPPLIED_EVIDENCE'
          && typeof item.evidence_id === 'string'
          && evidence.has(item.evidence_id)
          && typeof item.quote === 'string') {
          const quote = canonicalRawTextSpan(evidence.get(item.evidence_id), item.quote);
          if (quote !== item.quote) {
            next = { ...next, quote };
            itemChanged = true;
          }
        }
        if (item.source_type === 'INFERENCE' && Array.isArray(item.supports)) {
          const supports = item.supports.map((reference) => {
            if (!reference || typeof reference.quote !== 'string') return reference;
            const supportSource = reference.evidence_id === null
              ? source.text
              : evidence.get(reference.evidence_id);
            if (typeof supportSource !== 'string') return reference;
            const quote = canonicalRawTextSpan(supportSource, reference.quote);
            if (quote === reference.quote) return reference;
            itemChanged = true;
            return { ...reference, quote };
          });
          if (itemChanged) next = { ...next, supports };
        }
        entryChanged ||= itemChanged;
        return next;
      });
      if (!entryChanged) return entry;
      candidateChanged = true;
      return { ...entry, provenance };
    });
  }
  return candidateChanged ? canonical : candidate;
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
  const normalized = normalizeDuplicateIds(JSON.parse(text));
  return validateCandidate(canonicalizeRawTextProvenance(normalized, source), source);
}

module.exports = {
  CANDIDATE_SCHEMA,
  PUBLIC_PROTOCOL,
  SECTIONS,
  buildEnvelope,
  canonicalRawTextSpan,
  canonicalEvidenceComposition,
  canonicalizeRawTextProvenance,
  canonicalJson,
  extractCandidate,
  normalizeDuplicateIds,
  sha256,
  stableBytes,
  validateCandidate
};
