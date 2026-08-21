'use strict';

const CONTRACT_SECTIONS = Object.freeze([
  'OUTCOME',
  'EXPLICIT',
  'INFERRED',
  'LOCKED',
  'UNKNOWN',
  'PROPOSED',
  'AUTHORIZED',
  'NOT_AUTHORIZED',
  'HUMAN_GATES',
  'ACCEPTANCE'
]);

const COLLATERAL_SECTION = 'NECESSARY_COLLATERAL_CHANGES';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compareStable(left, right) {
  const leftKey = String(left && left.id ? left.id : JSON.stringify(left));
  const rightKey = String(right && right.id ? right.id : JSON.stringify(right));
  return leftKey.localeCompare(rightKey, 'en');
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize).sort(compareStable);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value), null, 2);
}

function assertEntry(section, entry, index) {
  if (!isPlainObject(entry)) {
    throw new TypeError(`${section}[${index}] must be an object`);
  }
  if (typeof entry.id !== 'string' || entry.id.trim() === '') {
    throw new TypeError(`${section}[${index}].id must be a non-empty string`);
  }
  if (typeof entry.statement !== 'string' || entry.statement.trim() === '') {
    throw new TypeError(`${section}[${index}].statement must be a non-empty string`);
  }
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
}

function validateInterpretation(interpretation) {
  if (!isPlainObject(interpretation)) {
    throw new TypeError('interpretation must be an object');
  }

  for (const section of [...CONTRACT_SECTIONS, COLLATERAL_SECTION]) {
    if (!Array.isArray(interpretation[section])) {
      throw new TypeError(`${section} must be an array`);
    }
    interpretation[section].forEach((entry, index) => assertEntry(section, entry, index));
  }

  const seen = new Set();
  for (const section of [...CONTRACT_SECTIONS, COLLATERAL_SECTION]) {
    for (const entry of interpretation[section]) {
      if (seen.has(entry.id)) {
        throw new TypeError(`duplicate contract id: ${entry.id}`);
      }
      seen.add(entry.id);
    }
  }

  for (const authority of interpretation.AUTHORIZED) {
    if (authority.targets !== undefined) {
      assertStringArray(authority.targets, `AUTHORIZED entry ${authority.id}.targets`);
    }
  }

  for (const gate of interpretation.HUMAN_GATES) {
    if (typeof gate.required !== 'boolean') {
      throw new TypeError(`HUMAN_GATES entry ${gate.id} must declare required`);
    }
  }

  for (const change of interpretation[COLLATERAL_SECTION]) {
    if (typeof change.required !== 'boolean') {
      throw new TypeError(`${COLLATERAL_SECTION} entry ${change.id} must declare required`);
    }
    if (change.required === true
      && (typeof change.requiredFor !== 'string' || change.requiredFor.trim() === '')) {
      throw new TypeError(`${COLLATERAL_SECTION} entry ${change.id} must declare requiredFor`);
    }
  }
}

function compileIntentContract(naturalLanguage, interpretation, options = {}) {
  if (typeof naturalLanguage !== 'string' || naturalLanguage.trim() === '') {
    throw new TypeError('naturalLanguage must be a non-empty string');
  }

  validateInterpretation(interpretation);

  return canonicalize({
    schemaVersion: '0.1.1',
    contractId: options.contractId || 'intent-contract',
    source: {
      language: options.language || 'und',
      naturalLanguage: naturalLanguage.trim()
    },
    ...interpretation
  });
}

function createIntentLayer({ interpret }) {
  if (typeof interpret !== 'function') {
    throw new TypeError('interpret must be a function');
  }

  return Object.freeze({
    compile(input, options = {}) {
      if (!isPlainObject(input) || typeof input.text !== 'string') {
        throw new TypeError('input must contain natural-language text');
      }
      const interpretation = interpret(Object.freeze({
        text: input.text,
        language: input.language || 'und',
        evidence: input.evidence || null
      }));
      return compileIntentContract(input.text, interpretation, {
        contractId: options.contractId,
        language: input.language
      });
    }
  });
}

function makeFinding(code, message, refs = []) {
  return { code, message, refs: [...refs].sort() };
}

function byRef(items, key) {
  return new Map((items || []).map((item) => [item[key], item]));
}

function authorityCovers(contract, authorityIds, targetId) {
  const authorityMap = new Map(contract.AUTHORIZED.map((item) => [item.id, item]));
  return authorityIds.some((authorityId) => {
    const authority = authorityMap.get(authorityId);
    return authority && Array.isArray(authority.targets) && authority.targets.includes(targetId);
  });
}

function evaluateIntentRegression(contract, execution) {
  if (!isPlainObject(contract) || contract.schemaVersion !== '0.1.1') {
    throw new TypeError('contract must be a compiled Human Intent Layer V0 contract');
  }
  if (!isPlainObject(execution)) {
    throw new TypeError('execution must be an object');
  }

  const findings = [];
  const requirementResults = byRef(execution.requirementResults, 'ref');
  const invariantResults = byRef(execution.invariantResults, 'ref');
  const collateralResults = byRef(execution.collateralChanges, 'ref');
  const gateEvents = byRef(execution.humanGateEvents, 'gateRef');
  const notAuthorizedIds = new Set(contract.NOT_AUTHORIZED.map((item) => item.id));
  const inferredIds = new Set(contract.INFERRED.map((item) => item.id));
  const unknownIds = new Set(contract.UNKNOWN.map((item) => item.id));
  const claimSourceIds = new Set([...inferredIds, ...unknownIds]);
  const declaredGateIds = new Set(contract.HUMAN_GATES.map((item) => item.id));

  for (const requirement of [...contract.EXPLICIT, ...contract.ACCEPTANCE]) {
    const result = requirementResults.get(requirement.id);
    if (!result || result.satisfied !== true) {
      findings.push(makeFinding(
        'EXPLICIT_REQUIREMENT_UNSATISFIED',
        `Required intent ${requirement.id} was not proven satisfied.`,
        [requirement.id]
      ));
    }
  }

  for (const invariant of contract.LOCKED) {
    const result = invariantResults.get(invariant.id);
    if (!result || result.preserved !== true) {
      findings.push(makeFinding(
        'LOCKED_INVARIANT_VIOLATED',
        `Locked invariant ${invariant.id} was not proven preserved.`,
        [invariant.id]
      ));
    }
  }

  for (const delta of execution.semanticDeltas || []) {
    const authorities = Array.isArray(delta.authorizedBy) ? delta.authorizedBy : [];
    const prohibitions = Array.isArray(delta.prohibitedBy) ? delta.prohibitedBy : [];
    if (!authorityCovers(contract, authorities, delta.id)
      || prohibitions.some((id) => notAuthorizedIds.has(id))) {
      findings.push(makeFinding(
        'UNAUTHORIZED_SEMANTIC_DELTA',
        `Semantic or user-facing delta ${delta.id} is outside the exact scope of its cited authority.`,
        [delta.id, ...authorities]
      ));
    }
    if (delta.requiresHumanGate === true && delta.gateSatisfied !== true) {
      findings.push(makeFinding(
        'HUMAN_GATE_BYPASSED',
        `Delta ${delta.id} required a satisfied Human Gate.`,
        [delta.id]
      ));
    }
  }

  for (const claim of execution.claims || []) {
    if (!claimSourceIds.has(claim.sourceRef)) {
      findings.push(makeFinding(
        'UNDECLARED_CLAIM_SOURCE',
        `Claim ${claim.id} references source ${claim.sourceRef} that is not declared as INFERRED or UNKNOWN.`,
        [claim.id, claim.sourceRef]
      ));
      continue;
    }
    if (inferredIds.has(claim.sourceRef) && claim.certainty === 'FACT') {
      findings.push(makeFinding(
        'INFERENCE_PROMOTED_TO_FACT',
        `Claim ${claim.id} promoted inferred intent to fact.`,
        [claim.id]
      ));
    }
    if (unknownIds.has(claim.sourceRef) && claim.certainty === 'FACT') {
      findings.push(makeFinding(
        'UNKNOWN_CONVERTED_TO_CERTAINTY',
        `Claim ${claim.id} converted an UNKNOWN into certainty.`,
        [claim.id]
      ));
    }
  }

  for (const implementation of execution.implementedProposals || []) {
    const authorities = Array.isArray(implementation.authorizedBy)
      ? implementation.authorizedBy
      : [];
    if (!authorityCovers(contract, authorities, implementation.proposalRef)) {
      findings.push(makeFinding(
        'UNAUTHORIZED_PROPOSAL_IMPLEMENTED',
        `Proposal ${implementation.proposalRef} was implemented outside the exact scope of its cited authority.`,
        [implementation.proposalRef, ...authorities]
      ));
    }
  }

  for (const collateral of contract[COLLATERAL_SECTION]) {
    if (collateral.required !== true) continue;
    const result = collateralResults.get(collateral.id);
    if (!result || result.performed !== true) {
      findings.push(makeFinding(
        'REQUIRED_COLLATERAL_CHANGE_OMITTED',
        `Necessary collateral change ${collateral.id} was omitted.`,
        [collateral.id]
      ));
    }
  }

  const contractCollateralIds = new Set(contract[COLLATERAL_SECTION].map((item) => item.id));
  for (const change of execution.collateralChanges || []) {
    if (!contractCollateralIds.has(change.ref)) {
      findings.push(makeFinding(
        'UNDECLARED_COLLATERAL_CHANGE',
        `Collateral change ${change.ref} is not declared in the contract.`,
        [change.ref]
      ));
      continue;
    }

    const bounded = change.necessary === true
      && change.minimal === true
      && change.withinAuthority === true
      && change.preservesExplicit === true
      && change.preservesLocked === true
      && change.violatesExplicitProhibition !== true;

    if (!bounded) {
      findings.push(makeFinding(
        'COLLATERAL_CHANGE_BOUNDARY_VIOLATED',
        `Collateral change ${change.ref} is not proven necessary, minimal, authorized, and invariant-preserving.`,
        [change.ref]
      ));
    }

    if ((change.userFacing === true || change.scopeExpanding === true)
      && change.gateSatisfied !== true) {
      findings.push(makeFinding(
        'COLLATERAL_CHANGE_REQUIRES_HUMAN_GATE',
        `Collateral change ${change.ref} crosses a boundary without a satisfied Human Gate.`,
        [change.ref]
      ));
    }
  }

  for (const gate of contract.HUMAN_GATES) {
    const event = gateEvents.get(gate.id);
    if (gate.required === true && (!event || !['REQUESTED', 'SATISFIED'].includes(event.action))) {
      findings.push(makeFinding(
        'REQUIRED_HUMAN_GATE_MISSING',
        `Required Human Gate ${gate.id} was neither requested nor satisfied.`,
        [gate.id]
      ));
    }
  }

  for (const event of execution.humanGateEvents || []) {
    if (!declaredGateIds.has(event.gateRef)) {
      findings.push(makeFinding(
        'UNDECLARED_HUMAN_GATE',
        `Human Gate event ${event.gateRef} is not declared in the contract.`,
        [event.gateRef]
      ));
      continue;
    }
    if (event.necessary !== true) {
      findings.push(makeFinding(
        'UNNECESSARY_HUMAN_GATE',
        `Human Gate ${event.gateRef} was raised for delegated work.`,
        [event.gateRef]
      ));
    }
  }

  if (!execution.finalIntent || execution.finalIntent.preserved !== true) {
    findings.push(makeFinding(
      'FINAL_INTENT_NOT_PRESERVED',
      'The final result was not proven to preserve the original human intent.'
    ));
  }

  findings.sort((left, right) => {
    const codeOrder = left.code.localeCompare(right.code, 'en');
    return codeOrder || left.refs.join('|').localeCompare(right.refs.join('|'), 'en');
  });

  const pendingGate = (execution.humanGateEvents || [])
    .some((event) => declaredGateIds.has(event.gateRef)
      && event.necessary === true
      && event.action === 'REQUESTED');

  return canonicalize({
    contractId: contract.contractId,
    evaluatorVersion: '0.1.1',
    status: findings.length > 0 ? 'FAIL' : pendingGate ? 'HUMAN_GATE_REQUIRED' : 'PASS',
    findings,
    checks: {
      acceptance: contract.ACCEPTANCE.length,
      explicit: contract.EXPLICIT.length,
      humanGates: contract.HUMAN_GATES.length,
      locked: contract.LOCKED.length
    }
  });
}

module.exports = {
  COLLATERAL_SECTION,
  CONTRACT_SECTIONS,
  canonicalStringify,
  compileIntentContract,
  createIntentLayer,
  evaluateIntentRegression
};
