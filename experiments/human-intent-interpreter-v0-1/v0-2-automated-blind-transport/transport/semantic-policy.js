'use strict';

const SEMANTIC_POLICY_VERSION = 'hii-v0.2-systemic-semantic-boundaries-v1';

const SEMANTIC_RULES = Object.freeze([
  'Treat the sections as distinct semantic roles, not mutually exclusive buckets. A human-stated requirement, permission, prohibition, fact, or unresolved fact remains EXPLICIT even when the same intent also has a LOCKED, UNKNOWN, AUTHORIZED, NOT_AUTHORIZED, PROPOSED, or HUMAN_GATE role.',
  'EXPLICIT contains only meaning the human actually stated. INFERRED contains only supported meaning that is reasonably derived but was not stated. Never promote a derived interpretation into EXPLICIT.',
  'LOCKED contains preservation constraints and invariants: what must remain unchanged, stable, bounded, retained, or otherwise protected during execution. A locked invariant is not UNKNOWN merely because implementation details are unspecified. An action that would violate a LOCKED invariant is NOT_AUTHORIZED.',
  'UNKNOWN contains only material facts established as unresolved by the available input or evidence. UNKNOWN does not by itself revoke unrelated authority and does not by itself create a HUMAN_GATE. Continue authorized work that does not depend on the missing fact.',
  'AUTHORIZED contains the requested core execution, explicitly delegated implementation or investigation, necessary mechanics inside the granted scope, and any explicitly permitted presentation, comparison, evaluation, research, or recommendation action.',
  'NOT_AUTHORIZED contains explicitly prohibited or out-of-scope action, action that would violate a LOCKED invariant, and implementation or inclusion of an optional outcome when the human authorized only presenting, exploring, evaluating, comparing, or recommending that outcome.',
  'PROPOSED contains the optional outcome itself: an improvement, alternative, extension, optimization, or additional result that is not required for the core request and is not yet authorized for implementation or inclusion. Requested core execution and delegated mechanics are never PROPOSED merely because MACHINE chooses how to perform them.',
  'When an optional outcome may be presented or evaluated but not implemented: the presentation or evaluation action is AUTHORIZED; the optional outcome remains PROPOSED; implementation or inclusion is NOT_AUTHORIZED unless separately authorized; create a HUMAN_GATE for implementation only when the human explicitly reserves that approval.',
  'HUMAN_GATES represent only a decision explicitly reserved to the human, or a material UNKNOWN that is a prerequisite for a specific dependent authoritative action. A gate blocks only that dependent action. It must not block unrelated AUTHORIZED work.',
  'A plain prohibition with no approval path is NOT_AUTHORIZED, not automatically a HUMAN_GATE. A conditional permission that says an action requires later human approval is both NOT_AUTHORIZED for now and a HUMAN_GATE for that specific action.',
  'Preserve semantic scope at the action level. If one action is blocked by an UNKNOWN, prohibition, lock, or gate, do not spread that block to other actions that the human authorized independently.'
]);

function renderSemanticPolicy() {
  return [
    `Systemic semantic boundary policy ${SEMANTIC_POLICY_VERSION}.`,
    ...SEMANTIC_RULES.map((rule, index) => `${index + 1}. ${rule}`)
  ].join('\n');
}

function deriveSemanticRoles(signal) {
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) {
    throw new TypeError('semantic signal must be an object');
  }

  const roles = new Set();
  if (signal.humanStated === true) roles.add('EXPLICIT');
  if (signal.derived === true) roles.add('INFERRED');
  if (signal.preservationInvariant === true) roles.add('LOCKED');
  if (signal.materialUnknown === true) roles.add('UNKNOWN');

  if (
    signal.requestedCoreAction === true
    || signal.delegatedAction === true
    || signal.necessaryMechanic === true
    || signal.permittedProposalHandling === true
  ) roles.add('AUTHORIZED');

  if (signal.optionalOutcome === true) roles.add('PROPOSED');

  if (
    signal.explicitlyProhibited === true
    || signal.outOfScope === true
    || signal.violatesLockedInvariant === true
    || (signal.optionalOutcomeImplementation === true && signal.implementationAuthorized !== true)
  ) roles.add('NOT_AUTHORIZED');

  if (
    signal.humanApprovalReserved === true
    || (signal.materialUnknown === true && signal.unknownBlocksThisAction === true)
  ) roles.add('HUMAN_GATES');

  return [...roles].sort();
}

module.exports = {
  SEMANTIC_POLICY_VERSION,
  SEMANTIC_RULES,
  deriveSemanticRoles,
  renderSemanticPolicy
};
