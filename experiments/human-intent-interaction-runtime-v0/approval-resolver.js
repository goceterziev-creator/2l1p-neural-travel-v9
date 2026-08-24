'use strict';

const APPROVAL_CLASSES = Object.freeze({
  EXPLICIT_APPROVAL: 'EXPLICIT_APPROVAL',
  EXPLICIT_REJECTION: 'EXPLICIT_REJECTION',
  AMBIGUOUS: 'AMBIGUOUS',
  NO_AUTHORIZATION: 'NO_AUTHORIZATION'
});

const OUTCOMES = Object.freeze({
  SATISFIED: 'SATISFIED',
  NOT_AUTHORIZATION: 'NOT_AUTHORIZATION',
  AMBIGUOUS_REFERENT: 'AMBIGUOUS_REFERENT',
  NO_PENDING_GATE: 'NO_PENDING_GATE'
});

function normalize(text) {
  return text.normalize('NFKC').toLocaleLowerCase('bg-BG')
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text) {
  return normalize(text).match(/[\p{L}\p{N}]+(?:[.#_-][\p{L}\p{N}]+)*/gu) || [];
}

function flattenStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [key, ...flattenStrings(item)]);
  }
  return value === null || value === undefined ? [] : [String(value)];
}

function hasQuotedSpeechAct(text) {
  return /["']\s*(?:да\s*,?\s*)?(?:одобр|approve|approved|go ahead|действай)/iu.test(text);
}

function isPastedOrReported(text) {
  const tokens = new Set(words(text));
  return ([['той', 'каза'], ['тя', 'каза'], ['те', 'каза'], ['he', 'said'], ['she', 'said'],
    ['they', 'said']].some((pair) => pair.every((token) => tokens.has(token))))
    || ['поставен', 'копиран', 'пейстнат', 'pasted', 'copied'].some((token) => tokens.has(token))
    || /(?:human gate\s*[—:-]\s*approved|machine authority\s*:|authorized\s*:|not authorized\s*:)/iu.test(text);
}

function isHypotheticalConditionalOrFuture(text) {
  const tokens = new Set(words(text));
  return text.endsWith('?')
    || ['ако', 'дали', 'if', 'whether', 'ще', 'бих', 'later', 'would', 'will', 'might', 'maybe']
    .some((token) => tokens.has(token))
    || /(?:може би|по-късно|след теста|after the test|what if|готово за одобрение|ready for approval|чака одобрение|awaiting approval)/iu.test(text);
}

function isExplicitRejection(text) {
  const tokens = words(text);
  const scopedNegation = tokens.some((token, index) => (token === 'не' || token === 'not')
    && tokens.slice(index + 1, index + 7).some((later) => later.startsWith('одобр') || later === 'approve'));
  return scopedNegation
    || /(?:^|\s)(?:отказвам|не\s+разрешавам|don't(?:\s+\p{L}+){0,4}\s+approve|reject|refuse|not\s+authorized)(?:\s|[.!?,]|$)/iu.test(text);
}

function hasApprovalSpeechAct(text) {
  const tokens = new Set(words(text));
  return ['одобрявам', 'одобрено', 'разрешавам', 'потвърждавам', 'approve', 'approved',
    'authorize', 'authorized', 'confirmed'].some((token) => tokens.has(token))
    || ['действай', 'действайте', 'продължи', 'продължавай', 'давай', 'proceed', 'continue']
      .some((token) => tokens.has(token))
    || /(?:^|[.!?]\s*)(?:да\s*,?\s*)?go ahead(?:[.!?]|$)/iu.test(text);
}

function hasMaterialReferent(text) {
  const nonReferential = new Set([
    'аз', 'i', 'да', 'yes', 'please', 'моля', 'го', 'това', 'this',
    'одобрявам', 'одобрено', 'разрешавам', 'потвърждавам', 'approve', 'approved',
    'authorize', 'authorized', 'confirmed', 'действай', 'действайте', 'продължи',
    'продължавай', 'давай', 'go', 'ahead', 'proceed', 'continue'
  ]);
  return words(text).some((token) => !nonReferential.has(token));
}

function gateTerms(gate) {
  const raw = [gate.gateId, gate.requiredDecision, gate.continuationTargetRef,
    ...flattenStrings(gate.authorityScope)];
  const stop = new Set([
    'gate', 'target', 'action', 'boundary', 'scope', 'required', 'decision',
    'approve', 'approved', 'approval', 'одобрявам', 'одобрение', 'the', 'for',
    'this', 'that', 'human', 'runtime', 'only', 'exact', 'current'
  ]);
  return new Set(raw.flatMap(words).filter((word) => word.length > 1 && !stop.has(word)));
}

function mentionedGateIds(text, gates) {
  const normalized = normalize(text);
  return gates.filter((gate) => [gate.gateId, gate.continuationTargetRef]
    .filter(Boolean).map(normalize).some((variant) => normalized.includes(variant)));
}

function referentCandidates(text, gates) {
  const exact = mentionedGateIds(text, gates);
  if (exact.length > 0) return exact;
  const explicitNumbers = [...normalize(text).matchAll(/#(\d+)/g)].map((match) => match[1]);
  const explicitPaths = normalize(text).match(/[\p{L}\p{N}_.-]+\/[\p{L}\p{N}_.-]+/gu) || [];
  const governanceActions = new Set([
    'analysis', 'test', 'correction', 'implementation', 'commit', 'push', 'merge', 'deploy',
    'анализ', 'тест', 'корекция', 'имплементация', 'комит', 'пуш', 'мърдж', 'деплой'
  ]);
  const explicitActions = words(text).filter((term) => governanceActions.has(term));
  if (explicitNumbers.length > 0 || explicitPaths.length > 0 || explicitActions.length > 0) {
    return gates.filter((gate) => {
      const context = [gate.gateId, gate.requiredDecision, gate.continuationTargetRef,
        ...flattenStrings(gate.authorityScope)].join(' ').toLocaleLowerCase('bg-BG');
      const contextNumbers = new Set(words(context).filter((term) => /^\d+$/.test(term)));
      const contextTerms = new Set(words(context));
      return explicitNumbers.every((number) => contextNumbers.has(number))
        && explicitPaths.every((path) => context.includes(path))
        && explicitActions.every((action) => contextTerms.has(action));
    });
  }
  const inputTerms = new Set(words(text));
  const scored = gates.map((gate) => ({
    gate,
    score: [...gateTerms(gate)].filter((term) => inputTerms.has(term)).length
  }));
  const best = Math.max(0, ...scored.map((item) => item.score));
  return best === 0 ? [] : scored.filter((item) => item.score === best).map((item) => item.gate);
}

function result(request, outcome, classification, gate, reason) {
  const base = {
    resolutionId: `resolution.${request.interaction.interactionId}.${request.input.inputId}`,
    outcome,
    classification,
    interactionId: request.interaction.interactionId,
    inputId: request.input.inputId,
    reason
  };
  if (!gate) return base;
  return {
    ...base,
    gateId: gate.gateId,
    gateRevision: gate.gateRevision,
    authorityScope: JSON.parse(JSON.stringify(gate.authorityScope)),
    continuationTargetRef: gate.continuationTargetRef
  };
}

function resolveHumanAuthorization(request) {
  if (!request || !request.input || !request.interaction || !Array.isArray(request.pendingGates)) {
    throw new TypeError('resolver request requires input, interaction and pendingGates');
  }
  const gates = request.pendingGates.filter((gate) => gate.status === 'PENDING');
  if (gates.length === 0) {
    return result(request, OUTCOMES.NO_PENDING_GATE, APPROVAL_CLASSES.NO_AUTHORIZATION, null, 'NO_PENDING_GATE');
  }
  const text = normalize(request.input.content);
  if (isExplicitRejection(text)) {
    return result(request, OUTCOMES.NOT_AUTHORIZATION, APPROVAL_CLASSES.EXPLICIT_REJECTION, null, 'EXPLICIT_REJECTION');
  }
  if (hasQuotedSpeechAct(text) || isPastedOrReported(text)
    || isHypotheticalConditionalOrFuture(text)) {
    return result(request, OUTCOMES.NOT_AUTHORIZATION, APPROVAL_CLASSES.NO_AUTHORIZATION, null, 'NON_ASSERTED_SPEECH_ACT');
  }
  if (!hasApprovalSpeechAct(text)) {
    return result(request, OUTCOMES.NOT_AUTHORIZATION, APPROVAL_CLASSES.NO_AUTHORIZATION, null, 'NO_APPROVAL_SPEECH_ACT');
  }

  const candidates = referentCandidates(text, gates);
  const selected = candidates.length === 1
    ? candidates[0]
    : candidates.length === 0 && gates.length === 1 && !hasMaterialReferent(text) ? gates[0] : null;
  if (!selected) {
    return result(request, OUTCOMES.AMBIGUOUS_REFERENT, APPROVAL_CLASSES.AMBIGUOUS, null, 'AMBIGUOUS_GATE_REFERENT');
  }
  if (!Number.isInteger(selected.registeredRevision)
    || !Number.isInteger(request.input.contextRevision)
    || request.input.contextRevision < selected.registeredRevision) {
    return result(request, OUTCOMES.NOT_AUTHORIZATION, APPROVAL_CLASSES.NO_AUTHORIZATION, null, 'INPUT_PREDATES_GATE');
  }
  return result(request, OUTCOMES.SATISFIED, APPROVAL_CLASSES.EXPLICIT_APPROVAL, selected, 'EXACT_PENDING_GATE_AUTHORIZED');
}

function createContextBoundApprovalResolver() {
  return Object.freeze(resolveHumanAuthorization);
}

module.exports = {
  APPROVAL_CLASSES,
  OUTCOMES,
  createContextBoundApprovalResolver,
  resolveHumanAuthorization
};
