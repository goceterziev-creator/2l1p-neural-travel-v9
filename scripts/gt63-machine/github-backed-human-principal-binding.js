"use strict";

const AUTHORITY = "NONE";
const RULESET_VERSION = "github-backed-human-principal-binding-v0.1.0";

function requireObject(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function requireString(name, value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function createGithubBackedHumanPrincipalBinding({ bindingDefinition }) {
  const definition = requireObject("bindingDefinition", bindingDefinition);
  if (definition.type !== "GT63_HUMAN_PRINCIPAL_GITHUB_IDENTITY_BINDING") {
    throw new TypeError("bindingDefinition.type is invalid");
  }
  if (definition.bindingSemantics !== "EXACT_IMMUTABLE_GITHUB_ACCOUNT_ID") {
    throw new TypeError("bindingDefinition.bindingSemantics is invalid");
  }
  if (definition.authority !== AUTHORITY) {
    throw new TypeError("bindingDefinition.authority must be NONE");
  }

  const principalRef = requireString("bindingDefinition.principalRef", definition.principalRef);
  const providerRef = requireString("bindingDefinition.identityProviderRef", definition.identityProviderRef);
  const githubAccountId = requireString("bindingDefinition.githubAccountId", definition.githubAccountId);

  function resolveVerifiedIdentity({ verifiedIdentity }) {
    const identity = requireObject("verifiedIdentity", verifiedIdentity);

    if (identity.providerRef !== providerRef) {
      return Object.freeze({
        outcome: "PROVIDER_MISMATCH",
        principalRef: null,
        identityMatchState: "NOT_MATCHED",
        authority: AUTHORITY
      });
    }

    if (identity.authenticationState !== "AUTHENTICATED") {
      return Object.freeze({
        outcome: "IDENTITY_NOT_AUTHENTICATED",
        principalRef: null,
        identityMatchState: "UNKNOWN",
        authority: AUTHORITY
      });
    }

    if (identity.verificationState !== "VERIFIED") {
      return Object.freeze({
        outcome: "IDENTITY_NOT_VERIFIED",
        principalRef: null,
        identityMatchState: "UNKNOWN",
        authority: AUTHORITY
      });
    }

    if (typeof identity.providerEvidenceRef !== "string" || identity.providerEvidenceRef.length === 0) {
      return Object.freeze({
        outcome: "IDENTITY_EVIDENCE_MISSING",
        principalRef: null,
        identityMatchState: "UNKNOWN",
        authority: AUTHORITY
      });
    }

    if (String(identity.accountId) !== githubAccountId) {
      return Object.freeze({
        outcome: "ACCOUNT_ID_MISMATCH",
        principalRef: null,
        identityMatchState: "NOT_MATCHED",
        authority: AUTHORITY
      });
    }

    return Object.freeze({
      outcome: "BOUND_PRINCIPAL_IDENTITY_MATCH",
      principalRef,
      identityMatchState: "MATCHED",
      matchedProviderRef: providerRef,
      matchedAccountId: githubAccountId,
      observedLogin: typeof identity.login === "string" ? identity.login : null,
      providerEvidenceRef: identity.providerEvidenceRef,
      principalEligibilityEstablished: false,
      governanceAuthorizationEstablished: false,
      executionAuthorityEstablished: false,
      authority: AUTHORITY
    });
  }

  return Object.freeze({
    resolveVerifiedIdentity,
    principalRef,
    providerRef,
    githubAccountId,
    authority: AUTHORITY,
    rulesetVersion: RULESET_VERSION
  });
}

module.exports = Object.freeze({
  AUTHORITY,
  RULESET_VERSION,
  createGithubBackedHumanPrincipalBinding
});
