'use strict';

function validateFreshProofCorpusEvidence(corpus) {
  if (!corpus || typeof corpus !== 'object' || !Array.isArray(corpus.cases)) {
    throw new TypeError('fresh proof corpus requires cases array');
  }

  for (const source of corpus.cases) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new TypeError('fresh proof case must be an object');
    }
    if (!Array.isArray(source.evidence)) continue;

    for (const item of source.evidence) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError(`${source.id || '<unknown>'}: supplied evidence must be an object`);
      }
      const keys = Object.keys(item).sort();
      if (JSON.stringify(keys) !== JSON.stringify(['content', 'evidence_id'])) {
        throw new TypeError(`${source.id || '<unknown>'}: supplied evidence fields must be exactly evidence_id, content`);
      }
      if (typeof item.evidence_id !== 'string' || !item.evidence_id.trim()) {
        throw new TypeError(`${source.id || '<unknown>'}: supplied evidence evidence_id must be a non-empty string`);
      }
      if (typeof item.content !== 'string' || !item.content.trim()) {
        throw new TypeError(`${source.id || '<unknown>'}: supplied evidence content must be a non-empty string`);
      }
    }
  }

  return true;
}

module.exports = { validateFreshProofCorpusEvidence };
