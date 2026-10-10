"use strict";

const crypto = require("node:crypto");
const { createIntentLayer } = require("../../experiments/human-intent-layer-v0/intent-layer");

const TASK_TEXT = "Покажи ми какви задачи може да изпълнява GT63 MACHINE.";
const AUTHORITY = "NONE";
const ACCEPTED_BINDING_OUTCOMES = new Set([
  "BINDING_EVIDENCE_ACCEPTED",
  "BINDING_EVIDENCE_ALREADY_ACCEPTED"
]);

function frozen(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) frozen(item);
  }
  return value;
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function failClosed(reason) {
  return frozen({ outcome: "FAIL_CLOSED", reason, authority: AUTHORITY, authorityEffect: AUTHORITY });
}

function exactKeys(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === expected.length
    && expected.every((key) => Object.hasOwn(value, key));
}

function validAuthenticationContext(context) {
  return exactKeys(context, [
    "principalRef", "principalRevision", "principalEvidenceRef",
    "sessionRef", "sessionRevision", "authenticationState", "freshnessState", "evidenceRef"
  ])
    && ["principalRef", "principalRevision", "principalEvidenceRef", "sessionRef", "sessionRevision", "evidenceRef"]
      .every((key) => typeof context[key] === "string" && context[key].length > 0)
    && context.authenticationState === "AUTHENTICATED"
    && context.freshnessState === "CURRENT";
}

function validBinding(binding, inputBytes, authenticationContext) {
  return binding && typeof binding.bindingId === "string" && binding.bindingId.length > 0
    && typeof binding.sourceEventRef === "string" && binding.sourceEventRef.length > 0
    && binding.authority === AUTHORITY
    && binding.originAuthenticationState === "AUTHENTICATED"
    && binding.contentIntegrityState === "EXACT_BYTES"
    && binding.interactionBindingState === "BOUND"
    && binding.contradictionState === "NONE"
    && binding.sourceTrustState === "TRUSTED"
    && binding.verificationMethodTrustState === "TRUSTED"
    && binding.verificationFreshnessState === "CURRENT"
    && binding.principalResolutionState === "RESOLVED"
    && binding.principalLifecycleState === "CURRENT"
    && binding.principalFreshnessState === "CURRENT"
    && binding.presentationClass === "DIRECT"
    && binding.attributedPrincipalRef === null
    && binding.attributionState === "NOT_APPLICABLE"
    && binding.delegationState === "NOT_CLAIMED"
    && binding.principalRef === authenticationContext.principalRef
    && binding.principalRevision === authenticationContext.principalRevision
    && binding.sessionRef === authenticationContext.sessionRef
    && binding.sessionRevision === authenticationContext.sessionRevision
    && binding.contentDigest === sha256(inputBytes)
    && binding.contentByteLength === inputBytes.length
    && Array.isArray(binding.evidenceRefs)
    && binding.evidenceRefs.includes(authenticationContext.principalEvidenceRef)
    && binding.evidenceRefs.includes(authenticationContext.evidenceRef);
}

function readOnlyInterpretation() {
  return {
    OUTCOME: [{ id: "catalog_request", statement: "Return an evidence-backed catalog of currently proven GT63 MACHINE tasks." }],
    EXPLICIT: [{ id: "exact_task", statement: TASK_TEXT }],
    INFERRED: [],
    LOCKED: [{ id: "read_only", statement: "This task may only inspect evidence and return a report." }],
    UNKNOWN: [],
    PROPOSED: [],
    AUTHORIZED: [],
    NOT_AUTHORIZED: [{ id: "execution_not_authorized", statement: "No capability execution or external effect is authorized." }],
    HUMAN_GATES: [],
    ACCEPTANCE: [{ id: "evidence_cited_result", statement: "Every reported capability must have current-main evidence." }],
    NECESSARY_COLLATERAL_CHANGES: []
  };
}

function createAuthenticatedTaskIntentIntake({ sourceBinding, currentAuthenticationContextPort } = {}) {
  if (!sourceBinding || typeof sourceBinding.accept !== "function") {
    throw new TypeError("sourceBinding.accept must be a function");
  }
  if (typeof currentAuthenticationContextPort !== "function") {
    throw new TypeError("currentAuthenticationContextPort must be a function");
  }

  const intentLayer = createIntentLayer({
    interpret({ text }) {
      if (text !== TASK_TEXT) throw new Error("unsupported exact task");
      return readOnlyInterpretation();
    }
  });

  function classify(input) {
    if (!exactKeys(input, ["inputText", "sourceBindingRequest"])) {
      return failClosed("INVALID_INPUT_SCHEMA");
    }
    if (input.inputText !== TASK_TEXT) return failClosed("TASK_NOT_ALLOWLISTED");
    if (!input.sourceBindingRequest || typeof input.sourceBindingRequest !== "object") {
      return failClosed("SOURCE_BINDING_REQUEST_REQUIRED");
    }

    let bindingResult;
    try {
      bindingResult = sourceBinding.accept(input.sourceBindingRequest);
    } catch (_) {
      return failClosed("SOURCE_BINDING_UNAVAILABLE");
    }
    if (!bindingResult || !ACCEPTED_BINDING_OUTCOMES.has(bindingResult.outcome) || !bindingResult.binding) {
      return failClosed("SOURCE_BINDING_NOT_ACCEPTED");
    }

    let authenticationContext;
    try {
      authenticationContext = currentAuthenticationContextPort({
        sourceEventRef: bindingResult.binding.sourceEventRef,
        sessionRef: bindingResult.binding.sessionRef
      });
    } catch (_) {
      return failClosed("AUTHENTICATION_CONTEXT_UNAVAILABLE");
    }
    if (!validAuthenticationContext(authenticationContext)) {
      return failClosed("AUTHENTICATION_CONTEXT_NOT_CURRENT");
    }

    const inputBytes = Buffer.from(input.inputText, "utf8");
    if (bindingResult.binding.sourceEventRef !== input.sourceBindingRequest.sourceEventRef
      || !validBinding(bindingResult.binding, inputBytes, authenticationContext)) {
      return failClosed("SOURCE_BINDING_MISMATCH");
    }

    let intentContract;
    try {
      intentContract = intentLayer.compile({ text: input.inputText, language: "bg" }, {
        contractId: "gt63-task-capability-catalog-v0"
      });
    } catch (_) {
      return failClosed("INTENT_CLASSIFICATION_FAILED");
    }

    return frozen({
      outcome: "INTENT_CLASSIFIED",
      source: {
        sourceEventRef: bindingResult.binding.sourceEventRef,
        bindingId: bindingResult.binding.bindingId,
        inputDigest: bindingResult.binding.contentDigest,
        inputByteLength: bindingResult.binding.contentByteLength,
        principalRef: bindingResult.binding.principalRef,
        principalRevision: bindingResult.binding.principalRevision,
        sessionRef: bindingResult.binding.sessionRef,
        sessionRevision: bindingResult.binding.sessionRevision,
        evidenceRefs: [...bindingResult.binding.evidenceRefs]
      },
      intentContract,
      authority: AUTHORITY,
      authorityEffect: AUTHORITY
    });
  }

  return Object.freeze({ classify });
}

module.exports = Object.freeze({
  TASK_TEXT,
  createAuthenticatedTaskIntentIntake
});
