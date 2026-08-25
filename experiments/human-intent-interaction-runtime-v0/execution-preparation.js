'use strict';

const PREPARATION_OUTCOMES = Object.freeze({
  EXECUTION_PREPARED: 'EXECUTION_PREPARED',
  ALREADY_PREPARED: 'ALREADY_PREPARED',
  EXECUTION_PREPARATION_REJECTED: 'EXECUTION_PREPARATION_REJECTED',
  INPUT_NOT_FOUND: 'INPUT_NOT_FOUND',
  INPUT_UNAVAILABLE: 'INPUT_UNAVAILABLE',
  INPUT_DIGEST_MISMATCH: 'INPUT_DIGEST_MISMATCH',
  ACTION_REGISTRATION_STALE: 'ACTION_REGISTRATION_STALE',
  INVALID_EXECUTION_ACCEPTANCE: 'INVALID_EXECUTION_ACCEPTANCE',
  PREPARATION_UNCERTAIN: 'PREPARATION_UNCERTAIN'
});

const EFFECT_IDEMPOTENCY_CLASSES = Object.freeze([
  'NO_EXTERNAL_EFFECT',
  'IDEMPOTENT_WITH_STABLE_KEY',
  'NON_IDEMPOTENT',
  'UNKNOWN_OR_UNVERIFIED'
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function outcome(outcomeName, reason = null, preparation = null) {
  return Object.freeze({ outcome: outcomeName, reason, preparation: clone(preparation) });
}

function invalid(reason) {
  return outcome(PREPARATION_OUTCOMES.INVALID_EXECUTION_ACCEPTANCE, reason);
}

function rejected(reason) {
  return outcome(PREPARATION_OUTCOMES.EXECUTION_PREPARATION_REJECTED, reason);
}

function authoritativeAcceptance(record, expectedId) {
  const requiredStrings = [
    'executionAcceptanceId', 'dispatchId', 'idempotencyKey', 'continuationId',
    'interactionId', 'gateId', 'continuationTargetRef', 'authorityEvidenceRef',
    'governanceEvaluationRef', 'actionIdentity', 'actionRevision',
    'actionRegistrationIdentity', 'actionRegistrationRevision',
    'executionOwnerIdentity', 'effectIdempotencyCapability', 'resultEvidenceGrammarRef'
  ];
  if (!record
    || record.type !== 'EXECUTION_ACCEPTANCE'
    || record.status !== 'EXECUTION_ACCEPTED'
    || record.singleLogicalAcceptance !== true
    || record.executionAcceptanceId !== expectedId
    || requiredStrings.some((name) => !nonEmptyString(record[name]))
    || !Number.isInteger(record.acceptanceRevision)
    || !Number.isInteger(record.gateRevision)
    || !Number.isInteger(record.authorityCommittedRevision)
    || record.authorityScope === undefined
    || !record.actionInputBinding
    || !nonEmptyString(record.actionInputBinding.inputRef)
    || !nonEmptyString(record.actionInputBinding.inputDigest)
    || !nonEmptyString(record.actionInputBinding.derivationIdentity)
    || !nonEmptyString(record.actionInputBinding.derivationRevision)) return null;
  return record;
}

function coherentPreparation(record, acceptanceId, executionId) {
  const requiredStrings = [
    'executionId', 'executionAcceptanceId', 'dispatchId', 'idempotencyKey',
    'actionIdentity', 'actionRevision', 'actionRegistrationIdentity',
    'actionRegistrationRevision', 'executionOwnerIdentity', 'inputRef',
    'expectedInputDigest', 'verifiedInputDigest', 'derivationIdentity',
    'derivationRevision', 'canonicalizationIdentity', 'canonicalizationRevision',
    'digestAlgorithmIdentity', 'digestAlgorithmRevision', 'verifiedInputEvidenceRef',
    'effectContractRef', 'effectContractRevision', 'effectIdempotencyClass',
    'resultEvidenceGrammarRef', 'resultEvidenceGrammarRevision'
  ];
  return Boolean(record
    && record.type === 'EXECUTION_PREPARATION'
    && record.status === 'EXECUTION_PREPARED'
    && record.executionAcceptanceId === acceptanceId
    && record.executionId === executionId
    && record.singleLogicalExecution === true
    && record.attemptEligibility === 'ELIGIBLE_FOR_GOVERNED_ATTEMPT_CREATION'
    && Number.isInteger(record.preparationRevision)
    && requiredStrings.every((name) => nonEmptyString(record[name])));
}

function requireSingle(items, missingReason, ambiguousReason) {
  if (!Array.isArray(items) || items.length === 0) return { error: missingReason };
  if (items.length !== 1) return { error: ambiguousReason };
  return { value: items[0] };
}

function createGovernedExecutionPreparation({
  acceptanceSnapshotPort,
  actionRegistryPort,
  inputResolutionContractPort,
  effectContractRegistryPort,
  resultGrammarRegistryPort,
  executionLedger
}) {
  for (const [name, port] of Object.entries({ acceptanceSnapshotPort, actionRegistryPort,
    inputResolutionContractPort, effectContractRegistryPort, resultGrammarRegistryPort })) {
    if (typeof port !== 'function') throw new TypeError(`${name} must be a function`);
  }
  if (!executionLedger || !['findByAcceptance', 'findByExecutionId', 'commitPreparation']
    .every((name) => typeof executionLedger[name] === 'function')) {
    throw new TypeError('executionLedger must implement findByAcceptance, findByExecutionId and commitPreparation');
  }

  function findExisting(acceptanceId, executionId) {
    const byAcceptance = executionLedger.findByAcceptance(acceptanceId);
    const byExecution = executionLedger.findByExecutionId(executionId);
    if (!Array.isArray(byAcceptance) || !Array.isArray(byExecution)
      || byAcceptance.length > 1 || byExecution.length > 1) {
      return invalid('conflicting or corrupt execution preparation evidence');
    }
    if (byAcceptance.length === 1) {
      const existing = byAcceptance[0];
      if (!coherentPreparation(existing, acceptanceId, executionId)
        || byExecution.length !== 1 || !sameValue(existing, byExecution[0])) {
        return invalid('execution acceptance is bound to a conflicting execution identity');
      }
      return outcome(PREPARATION_OUTCOMES.ALREADY_PREPARED, null, existing);
    }
    if (byExecution.length === 1) {
      return invalid('execution identity is already bound to another acceptance');
    }
    return null;
  }

  function prepare({ executionAcceptanceId, executionId } = {}) {
    if (!nonEmptyString(executionAcceptanceId) || !nonEmptyString(executionId)) {
      return invalid('execution acceptance and execution identities are required');
    }
    if (executionAcceptanceId === executionId) {
      return invalid('execution identity must be distinct from acceptance identity');
    }

    let existing;
    try {
      existing = findExisting(executionAcceptanceId, executionId);
    } catch (error) {
      return outcome(PREPARATION_OUTCOMES.PREPARATION_UNCERTAIN,
        'execution ledger is unavailable');
    }
    if (existing) return existing;

    let acceptanceRecord;
    try {
      acceptanceRecord = acceptanceSnapshotPort(executionAcceptanceId);
    } catch (error) {
      return outcome(PREPARATION_OUTCOMES.PREPARATION_UNCERTAIN,
        'authoritative execution acceptance is unavailable');
    }
    const acceptance = authoritativeAcceptance(acceptanceRecord, executionAcceptanceId);
    if (!acceptance) return invalid('authoritative EXECUTION_ACCEPTED evidence is absent or invalid');
    if (executionId === acceptance.dispatchId) {
      return invalid('execution identity must be distinct from dispatch identity');
    }

    const registrationResult = requireSingle(actionRegistryPort(Object.freeze({
      actionIdentity: acceptance.actionIdentity,
      actionRevision: acceptance.actionRevision
    })), 'ACTION_REGISTRATION_NOT_FOUND', 'ACTION_REGISTRATION_AMBIGUOUS');
    if (registrationResult.error === 'ACTION_REGISTRATION_NOT_FOUND') {
      return outcome(PREPARATION_OUTCOMES.ACTION_REGISTRATION_STALE,
        'accepted action registration is no longer available');
    }
    if (registrationResult.error) return rejected(registrationResult.error);
    const registration = registrationResult.value;
    if (!registration
      || registration.actionIdentity !== acceptance.actionIdentity
      || registration.actionRevision !== acceptance.actionRevision
      || registration.registrationIdentity !== acceptance.actionRegistrationIdentity
      || registration.registrationRevision !== acceptance.actionRegistrationRevision
      || registration.executionOwnerIdentity !== acceptance.executionOwnerIdentity
      || registration.continuationTargetRef !== acceptance.continuationTargetRef
      || !sameValue(registration.acceptedAuthorityScopeContract, acceptance.authorityScope)
      || registration.effectIdempotencyCapability !== acceptance.effectIdempotencyCapability
      || registration.resultEvidenceGrammarRef !== acceptance.resultEvidenceGrammarRef) {
      return outcome(PREPARATION_OUTCOMES.ACTION_REGISTRATION_STALE,
        'accepted action registration is missing, stale or incompatible');
    }

    const binding = acceptance.actionInputBinding;
    const inputContractResult = requireSingle(inputResolutionContractPort(Object.freeze({
      derivationIdentity: binding.derivationIdentity,
      derivationRevision: binding.derivationRevision
    })), 'INPUT_RESOLUTION_CONTRACT_NOT_FOUND', 'INPUT_RESOLUTION_CONTRACT_AMBIGUOUS');
    if (inputContractResult.error) return rejected(inputContractResult.error);
    const inputContract = inputContractResult.value;
    const inputStrings = ['derivationIdentity', 'derivationRevision', 'canonicalizationIdentity',
      'canonicalizationRevision', 'digestAlgorithmIdentity', 'digestAlgorithmRevision'];
    if (!inputContract || inputStrings.some((name) => !nonEmptyString(inputContract[name]))
      || inputContract.derivationIdentity !== binding.derivationIdentity
      || inputContract.derivationRevision !== binding.derivationRevision
      || typeof inputContract.resolve !== 'function'
      || typeof inputContract.canonicalize !== 'function'
      || typeof inputContract.verifyDigest !== 'function') {
      return rejected('INPUT_RESOLUTION_CONTRACT_INVALID');
    }

    let resolution;
    let verification;
    try {
      resolution = inputContract.resolve(Object.freeze({ inputRef: binding.inputRef }));
      if (!resolution || !nonEmptyString(resolution.status)) {
        return rejected('INPUT_RESOLUTION_RESULT_INVALID');
      }
      if (resolution.status === 'NOT_FOUND') {
        return outcome(PREPARATION_OUTCOMES.INPUT_NOT_FOUND, 'accepted input was not found');
      }
      if (resolution.status === 'UNAVAILABLE') {
        return outcome(PREPARATION_OUTCOMES.INPUT_UNAVAILABLE,
          'accepted input is temporarily unavailable');
      }
      if (resolution.status === 'AMBIGUOUS') return rejected('INPUT_RESOLUTION_AMBIGUOUS');
      if (resolution.status !== 'RESOLVED' || !nonEmptyString(resolution.evidenceRef)) {
        return rejected('INPUT_RESOLUTION_RESULT_INVALID');
      }
      const canonicalBytes = inputContract.canonicalize(resolution.value);
      if (!(typeof canonicalBytes === 'string' || Buffer.isBuffer(canonicalBytes))) {
        return rejected('INPUT_CANONICALIZATION_INVALID');
      }
      verification = inputContract.verifyDigest(Object.freeze({
        canonicalBytes,
        expectedDigest: binding.inputDigest
      }));
    } catch (error) {
      return outcome(PREPARATION_OUTCOMES.INPUT_UNAVAILABLE,
        'read-only input resolution did not complete');
    }
    if (!verification || verification.matches !== true
      || !nonEmptyString(verification.verifiedDigest)) {
      return outcome(PREPARATION_OUTCOMES.INPUT_DIGEST_MISMATCH,
        'resolved input does not match the accepted digest');
    }

    const effectResult = requireSingle(effectContractRegistryPort(
      acceptance.effectIdempotencyCapability), 'EFFECT_CONTRACT_NOT_FOUND',
    'EFFECT_CONTRACT_AMBIGUOUS');
    if (effectResult.error) return rejected(effectResult.error);
    const effectContract = effectResult.value;
    if (!effectContract || effectContract.ref !== acceptance.effectIdempotencyCapability
      || !nonEmptyString(effectContract.revision)
      || !EFFECT_IDEMPOTENCY_CLASSES.includes(effectContract.idempotencyClass)) {
      return rejected('EFFECT_CONTRACT_INVALID');
    }
    if (effectContract.idempotencyClass === 'UNKNOWN_OR_UNVERIFIED') {
      return rejected('EFFECT_CONTRACT_UNVERIFIED');
    }

    const grammarResult = requireSingle(resultGrammarRegistryPort(
      acceptance.resultEvidenceGrammarRef), 'RESULT_GRAMMAR_NOT_FOUND',
    'RESULT_GRAMMAR_AMBIGUOUS');
    if (grammarResult.error) return rejected(grammarResult.error);
    const grammar = grammarResult.value;
    if (!grammar || grammar.ref !== acceptance.resultEvidenceGrammarRef
      || !nonEmptyString(grammar.revision)) return rejected('RESULT_GRAMMAR_INVALID');

    const record = Object.freeze({
      type: 'EXECUTION_PREPARATION',
      status: 'EXECUTION_PREPARED',
      executionId,
      executionAcceptanceId,
      preparationRevision: 1,
      dispatchId: acceptance.dispatchId,
      dispatchOutcomeEvidenceRef: acceptance.dispatchOutcomeEvidenceRef,
      dispatchReceiptRef: acceptance.dispatchReceiptRef || null,
      idempotencyKey: acceptance.idempotencyKey,
      continuationId: acceptance.continuationId,
      interactionId: acceptance.interactionId,
      gateId: acceptance.gateId,
      gateRevision: acceptance.gateRevision,
      authorityScope: clone(acceptance.authorityScope),
      continuationTargetRef: acceptance.continuationTargetRef,
      authorityEvidenceRef: acceptance.authorityEvidenceRef,
      governanceEvaluationRef: acceptance.governanceEvaluationRef,
      authorityCommittedRevision: acceptance.authorityCommittedRevision,
      actionIdentity: acceptance.actionIdentity,
      actionRevision: acceptance.actionRevision,
      actionRegistrationIdentity: acceptance.actionRegistrationIdentity,
      actionRegistrationRevision: acceptance.actionRegistrationRevision,
      executionOwnerIdentity: acceptance.executionOwnerIdentity,
      inputRef: binding.inputRef,
      expectedInputDigest: binding.inputDigest,
      verifiedInputDigest: verification.verifiedDigest,
      derivationIdentity: binding.derivationIdentity,
      derivationRevision: binding.derivationRevision,
      canonicalizationIdentity: inputContract.canonicalizationIdentity,
      canonicalizationRevision: inputContract.canonicalizationRevision,
      digestAlgorithmIdentity: inputContract.digestAlgorithmIdentity,
      digestAlgorithmRevision: inputContract.digestAlgorithmRevision,
      verifiedInputEvidenceRef: resolution.evidenceRef,
      effectContractRef: effectContract.ref,
      effectContractRevision: effectContract.revision,
      effectIdempotencyClass: effectContract.idempotencyClass,
      resultEvidenceGrammarRef: grammar.ref,
      resultEvidenceGrammarRevision: grammar.revision,
      singleLogicalExecution: true,
      attemptEligibility: 'ELIGIBLE_FOR_GOVERNED_ATTEMPT_CREATION'
    });

    try {
      const committed = executionLedger.commitPreparation(clone(record), Object.freeze({
        acceptanceGuard: Object.freeze({ executionAcceptanceId,
          acceptanceRevision: acceptance.acceptanceRevision }),
        actionRegistrationGuard: Object.freeze({
          registrationIdentity: acceptance.actionRegistrationIdentity,
          registrationRevision: acceptance.actionRegistrationRevision,
          effectIdempotencyCapability: acceptance.effectIdempotencyCapability,
          resultEvidenceGrammarRef: acceptance.resultEvidenceGrammarRef
        }),
        inputContractGuard: Object.freeze({
          derivationIdentity: inputContract.derivationIdentity,
          derivationRevision: inputContract.derivationRevision,
          canonicalizationRevision: inputContract.canonicalizationRevision,
          digestAlgorithmRevision: inputContract.digestAlgorithmRevision
        }),
        effectContractGuard: Object.freeze({ ref: effectContract.ref,
          revision: effectContract.revision }),
        resultGrammarGuard: Object.freeze({ ref: grammar.ref, revision: grammar.revision })
      }));
      if (!coherentPreparation(committed, executionAcceptanceId, executionId)
        || !sameValue(committed, record)) {
        return invalid('persisted execution preparation is inconsistent');
      }
      return outcome(PREPARATION_OUTCOMES.EXECUTION_PREPARED, null, committed);
    } catch (error) {
      let recovered = null;
      try { recovered = findExisting(executionAcceptanceId, executionId); } catch (_) { /* fail closed */ }
      if (recovered && [PREPARATION_OUTCOMES.ALREADY_PREPARED,
        PREPARATION_OUTCOMES.INVALID_EXECUTION_ACCEPTANCE].includes(recovered.outcome)) return recovered;
      if (error && error.code === PREPARATION_OUTCOMES.ACTION_REGISTRATION_STALE) {
        return outcome(PREPARATION_OUTCOMES.ACTION_REGISTRATION_STALE,
          'guarded contract revision changed before preparation commit');
      }
      return outcome(PREPARATION_OUTCOMES.PREPARATION_UNCERTAIN,
        'atomic execution preparation persistence is uncertain');
    }
  }

  return Object.freeze({ prepare });
}

module.exports = {
  EFFECT_IDEMPOTENCY_CLASSES,
  PREPARATION_OUTCOMES,
  createGovernedExecutionPreparation
};
