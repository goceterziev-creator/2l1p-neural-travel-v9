'use strict';

const ROLE_DEFINITIONS = Object.freeze({
  EXPLICIT: 'Capture every material fact, requirement, constraint, permission, prohibition, condition, and requested action that the human directly states. Do not compress away explicit content because another section also represents one of its consequences.',
  INFERRED: 'Use only for supported meaning that is not directly stated. Never demote directly stated human language into INFERRED merely because it is summarized or generalized.',
  LOCKED: 'Capture every property, behavior, fact, scope boundary, or outcome that must remain unchanged. Preservation language, negative-scope language, and do-not-change constraints create LOCKED consequences.',
  UNKNOWN: 'Capture materially relevant unresolved facts established by the brief or supplied evidence when they affect interpretation, planning, verification, or a downstream decision. Do not manufacture UNKNOWN entries from irrelevant omissions.',
  AUTHORIZED: 'Capture actions and outcomes the human currently permits, including requested execution and delegated technical freedom inside the stated boundary.',
  NOT_AUTHORIZED: 'Capture explicit prohibitions and actions outside the granted authority. A future action that is allowed only after approval is NOT_AUTHORIZED now.',
  PROPOSED: 'Capture only optional new outcomes, alternatives, extensions, or improvements outside the requested current result. Permission to present, compare, evaluate, or estimate a proposal does not authorize implementing it.',
  HUMAN_GATES: 'Capture materially relevant future decisions reserved for human approval. An UNKNOWN creates a gate only for the specific dependent action that cannot proceed without resolving it; unrelated authorized work continues.'
});

const CLASSIFICATION_ORDER = Object.freeze([
  'EXPLICIT',
  'OUTCOME',
  'LOCKED',
  'UNKNOWN',
  'AUTHORIZED',
  'NOT_AUTHORIZED',
  'HUMAN_GATES',
  'PROPOSED',
  'INFERRED'
]);

const MULTI_ROLE_RULES = Object.freeze([
  'Semantic sections are roles, not mutually exclusive buckets.',
  'The same source statement may support multiple sections when it has multiple semantic consequences.',
  'A statement such as "Do not change X unless I approve it" may legitimately support EXPLICIT, LOCKED, NOT_AUTHORIZED, and HUMAN_GATES.',
  'Requested core execution belongs in AUTHORIZED and is not PROPOSED.',
  'Authorization to present or evaluate an optional idea belongs in AUTHORIZED while the optional outcome remains PROPOSED and implementation remains NOT_AUTHORIZED until separately approved.',
  'UNKNOWN blocks only the specific action that materially depends on the missing fact; it does not block unrelated authorized work.',
  'Prefer semantic completeness over compactness. Do not omit a material role merely because the same source span already appears in another section.'
]);

const SEMANTIC_PROTOCOL = Object.freeze(
  [
    'Human Intent Interpreter V0.2 semantic classification discipline.',
    'Before assembling the contract, independently answer these questions in order:',
    '1. What did the human explicitly state?',
    '2. What outcome is requested?',
    '3. What must remain unchanged?',
    '4. What material fact remains unresolved?',
    '5. What action is authorized now?',
    '6. What action is prohibited or outside current authority?',
    '7. What future action requires human approval?',
    '8. What optional new outcome is only proposed?',
    '9. What meaning is inferred rather than directly stated?',
    '',
    ...Object.entries(ROLE_DEFINITIONS).map(([role, rule]) => `${role}: ${rule}`),
    '',
    ...MULTI_ROLE_RULES.map((rule) => `BOUNDARY: ${rule}`),
    '',
    'Apply these rules generically across domains. Do not use case IDs, domain-specific answer mappings, hidden-gold wording, or provider-specific behavior.'
  ].join('\n')
);

function applySemanticProtocol(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new TypeError('envelope must be an object');
  }
  if (typeof envelope.instructions !== 'string' || !envelope.instructions) {
    throw new TypeError('envelope requires public instructions');
  }
  return Object.freeze({
    ...envelope,
    instructions: `${envelope.instructions}\n\n${SEMANTIC_PROTOCOL}`
  });
}

module.exports = {
  CLASSIFICATION_ORDER,
  MULTI_ROLE_RULES,
  ROLE_DEFINITIONS,
  SEMANTIC_PROTOCOL,
  applySemanticProtocol
};
