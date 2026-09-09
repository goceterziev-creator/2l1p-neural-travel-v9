"use strict";

const crypto = require("node:crypto");

const RULESET_VERSION = "github-human-identity-trust-bootstrap-v0.1.0";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function processLocalEvidenceRef(kind, material) {
  return `gt63-process-local-evidence:${kind}:${sha256(material)}`;
}

function result(outcome, reason = null, extra = {}) {
  return deepFreeze({ outcome, reason, ...clone(extra), authority: "NONE" });
}

function createMemoryLedger() {
  const challenges = new Map();
  const identitiesBySession = new Map();
  return deepFreeze({
    getChallenge(challengeRef) {
      return clone(challenges.get(challengeRef) || null);
    },
    commitChallenge(challenge) {
      if (challenges.has(challenge.challengeRef)) throw new Error("challenge already exists");
      challenges.set(challenge.challengeRef, clone(challenge));
      return clone(challenge);
    },
    replaceChallenge(challenge) {
      if (!challenges.has(challenge.challengeRef)) throw new Error("challenge unavailable");
      challenges.set(challenge.challengeRef, clone(challenge));
      return clone(challenge);
    },
    getIdentityBySession(sessionRef) {
      return clone(identitiesBySession.get(sessionRef) || null);
    },
    commitIdentity(identity) {
      const existing = identitiesBySession.get(identity.sessionRef);
      if (existing && JSON.stringify(existing) !== JSON.stringify(identity)) {
        throw new Error("session already bound to a different external identity");
      }
      identitiesBySession.set(identity.sessionRef, clone(identity));
      return clone(identity);
    }
  });
}

async function defaultTransport(request) {
  const response = await fetch(request.url, {
    method: request.method || "GET",
    headers: request.headers || {},
    body: request.body || undefined,
    redirect: "error"
  });
  let body = null;
  const text = await response.text();
  try { body = text ? JSON.parse(text) : null; }
  catch (_) { body = text; }
  return { status: response.status, body };
}

function validExpectedIdentity(expectedIdentity) {
  if (expectedIdentity === null || expectedIdentity === undefined) return true;
  return expectedIdentity
    && Number.isInteger(expectedIdentity.githubUserId)
    && expectedIdentity.githubUserId > 0
    && nonEmpty(expectedIdentity.githubLogin);
}

function createGitHubHumanIdentityTrustBootstrap({
  clientId,
  expectedIdentity = null,
  ledger = createMemoryLedger(),
  transport = defaultTransport,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes
} = {}) {
  if (!nonEmpty(clientId)) throw new TypeError("clientId must be configured");
  if (!validExpectedIdentity(expectedIdentity)) throw new TypeError("expectedIdentity is invalid");
  if (!ledger || typeof ledger.getChallenge !== "function"
    || typeof ledger.commitChallenge !== "function"
    || typeof ledger.replaceChallenge !== "function"
    || typeof ledger.getIdentityBySession !== "function"
    || typeof ledger.commitIdentity !== "function") {
    throw new TypeError("ledger does not implement the required identity bootstrap contract");
  }
  if (typeof transport !== "function") throw new TypeError("transport must be a function");

  function exactSession(input) {
    return input
      && nonEmpty(input.sessionRef)
      && nonEmpty(input.sessionRevision)
      && nonEmpty(input.authenticatedAccountRef);
  }

  async function start(input) {
    if (!exactSession(input)) return result("IDENTITY_BOOTSTRAP_REJECTED", "authenticated session binding is required");
    if (ledger.getIdentityBySession(input.sessionRef)) {
      return result("EXTERNAL_IDENTITY_ALREADY_VERIFIED", null, {
        identity: ledger.getIdentityBySession(input.sessionRef)
      });
    }

    let response;
    try {
      response = await transport({
        url: GITHUB_DEVICE_CODE_URL,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "GT63-MACHINE-HUMAN-IDENTITY-BOOTSTRAP-V0"
        },
        body: new URLSearchParams({ client_id: clientId }).toString()
      });
    } catch (_) {
      return result("IDENTITY_BOOTSTRAP_UNAVAILABLE", "GitHub device authorization endpoint unavailable");
    }

    const body = response && response.body;
    if (!response || response.status < 200 || response.status >= 300
      || !body || !nonEmpty(body.device_code) || !nonEmpty(body.user_code)
      || !nonEmpty(body.verification_uri) || !Number.isInteger(Number(body.expires_in))
      || !Number.isInteger(Number(body.interval))) {
      return result("IDENTITY_BOOTSTRAP_UNAVAILABLE", "GitHub device authorization response invalid");
    }

    const challengeRef = `gt63-github-device-challenge:${randomBytes(16).toString("hex")}`;
    const issuedAt = now();
    const challenge = {
      type: "GT63_GITHUB_DEVICE_IDENTITY_CHALLENGE",
      rulesetVersion: RULESET_VERSION,
      challengeRef,
      sessionRef: input.sessionRef,
      sessionRevision: input.sessionRevision,
      authenticatedAccountRef: input.authenticatedAccountRef,
      deviceCode: body.device_code,
      userCode: body.user_code,
      verificationUri: body.verification_uri,
      issuedAt,
      expiresAt: issuedAt + Number(body.expires_in) * 1000,
      intervalSeconds: Number(body.interval),
      nextPollAt: issuedAt,
      state: "PENDING",
      authority: "NONE"
    };
    ledger.commitChallenge(challenge);

    return result("EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED", null, {
      challenge: {
        challengeRef,
        userCode: challenge.userCode,
        verificationUri: challenge.verificationUri,
        expiresAt: new Date(challenge.expiresAt).toISOString(),
        intervalSeconds: challenge.intervalSeconds
      }
    });
  }

  async function poll(input) {
    if (!exactSession(input) || !nonEmpty(input.challengeRef)) {
      return result("IDENTITY_BOOTSTRAP_REJECTED", "challenge and authenticated session binding are required");
    }
    const challenge = ledger.getChallenge(input.challengeRef);
    if (!challenge) return result("IDENTITY_BOOTSTRAP_REJECTED", "challenge unavailable");
    if (challenge.sessionRef !== input.sessionRef
      || challenge.sessionRevision !== input.sessionRevision
      || challenge.authenticatedAccountRef !== input.authenticatedAccountRef) {
      return result("IDENTITY_BOOTSTRAP_REJECTED", "challenge is not bound to this authenticated session");
    }
    if (challenge.state === "VERIFIED") {
      return result("EXTERNAL_IDENTITY_ALREADY_VERIFIED", null, {
        identity: ledger.getIdentityBySession(input.sessionRef)
      });
    }
    if (now() >= challenge.expiresAt) {
      challenge.state = "EXPIRED";
      ledger.replaceChallenge(challenge);
      return result("IDENTITY_BOOTSTRAP_EXPIRED", "GitHub device authorization challenge expired");
    }
    if (now() < challenge.nextPollAt) {
      return result("EXTERNAL_IDENTITY_AUTHORIZATION_PENDING", "poll interval has not elapsed", {
        retryAfterSeconds: Math.max(1, Math.ceil((challenge.nextPollAt - now()) / 1000))
      });
    }

    let tokenResponse;
    try {
      tokenResponse = await transport({
        url: GITHUB_ACCESS_TOKEN_URL,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "GT63-MACHINE-HUMAN-IDENTITY-BOOTSTRAP-V0"
        },
        body: new URLSearchParams({
          client_id: clientId,
          device_code: challenge.deviceCode,
          grant_type: DEVICE_GRANT_TYPE
        }).toString()
      });
    } catch (_) {
      return result("IDENTITY_BOOTSTRAP_UNAVAILABLE", "GitHub token endpoint unavailable");
    }

    const tokenBody = tokenResponse && tokenResponse.body;
    if (tokenBody && tokenBody.error === "authorization_pending") {
      challenge.nextPollAt = now() + challenge.intervalSeconds * 1000;
      ledger.replaceChallenge(challenge);
      return result("EXTERNAL_IDENTITY_AUTHORIZATION_PENDING", null, {
        retryAfterSeconds: challenge.intervalSeconds
      });
    }
    if (tokenBody && tokenBody.error === "slow_down") {
      challenge.intervalSeconds += 5;
      challenge.nextPollAt = now() + challenge.intervalSeconds * 1000;
      ledger.replaceChallenge(challenge);
      return result("EXTERNAL_IDENTITY_AUTHORIZATION_PENDING", "GitHub requested slower polling", {
        retryAfterSeconds: challenge.intervalSeconds
      });
    }
    if (tokenBody && ["access_denied", "expired_token", "incorrect_device_code", "incorrect_client_credentials", "device_flow_disabled"].includes(tokenBody.error)) {
      challenge.state = tokenBody.error === "expired_token" ? "EXPIRED" : "FAILED";
      ledger.replaceChallenge(challenge);
      return result("IDENTITY_BOOTSTRAP_REJECTED", `GitHub device authorization failed: ${tokenBody.error}`);
    }
    if (!tokenResponse || tokenResponse.status < 200 || tokenResponse.status >= 300
      || !tokenBody || !nonEmpty(tokenBody.access_token)) {
      return result("IDENTITY_BOOTSTRAP_UNAVAILABLE", "GitHub token response invalid");
    }

    let userResponse;
    try {
      userResponse = await transport({
        url: GITHUB_USER_URL,
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${tokenBody.access_token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "GT63-MACHINE-HUMAN-IDENTITY-BOOTSTRAP-V0"
        }
      });
    } catch (_) {
      return result("IDENTITY_BOOTSTRAP_UNAVAILABLE", "GitHub authenticated user endpoint unavailable");
    }

    const user = userResponse && userResponse.body;
    if (!userResponse || userResponse.status !== 200 || !user
      || !Number.isInteger(Number(user.id)) || Number(user.id) <= 0 || !nonEmpty(user.login)) {
      return result("IDENTITY_BOOTSTRAP_REJECTED", "authenticated GitHub identity response invalid");
    }

    const githubUserId = Number(user.id);
    const githubLogin = String(user.login);
    if (expectedIdentity
      && (githubUserId !== expectedIdentity.githubUserId || githubLogin !== expectedIdentity.githubLogin)) {
      challenge.state = "FAILED";
      ledger.replaceChallenge(challenge);
      return result("IDENTITY_BOOTSTRAP_REJECTED", "authenticated GitHub identity does not match the configured bootstrap anchor");
    }

    const principalRef = `gt63-machine:principal:github:${githubUserId}`;
    const evidenceMaterial = [
      RULESET_VERSION,
      challenge.challengeRef,
      challenge.sessionRef,
      challenge.sessionRevision,
      challenge.authenticatedAccountRef,
      githubUserId,
      githubLogin
    ].join("\u0000");
    const identity = {
      type: "GT63_EXTERNAL_AUTHENTICATED_IDENTITY_BINDING",
      rulesetVersion: RULESET_VERSION,
      principalRef,
      principalNamespace: "github.com",
      principalRevision: "1",
      githubUserId,
      githubLogin,
      sessionRef: challenge.sessionRef,
      sessionRevision: challenge.sessionRevision,
      authenticatedAccountRef: challenge.authenticatedAccountRef,
      lifecycleState: "CURRENT",
      freshnessState: "CURRENT",
      contradictionState: "NONE",
      principalEvidenceRef: processLocalEvidenceRef("github-authenticated-identity", evidenceMaterial),
      verificationMethodRef: "gt63-machine:verification-method:github-oauth-device-flow-v0",
      verificationMethodRevision: "1",
      verifiedAt: new Date(now()).toISOString(),
      authority: "NONE"
    };
    ledger.commitIdentity(identity);
    challenge.state = "VERIFIED";
    challenge.deviceCode = null;
    challenge.nextPollAt = null;
    ledger.replaceChallenge(challenge);

    return result("EXTERNAL_IDENTITY_VERIFIED", null, { identity });
  }

  return deepFreeze({
    authority: "NONE",
    rulesetVersion: RULESET_VERSION,
    start,
    poll,
    getIdentityBySession(sessionRef) {
      return deepFreeze(ledger.getIdentityBySession(sessionRef));
    }
  });
}

module.exports = Object.freeze({
  RULESET_VERSION,
  GITHUB_DEVICE_CODE_URL,
  GITHUB_ACCESS_TOKEN_URL,
  GITHUB_USER_URL,
  DEVICE_GRANT_TYPE,
  createMemoryLedger,
  createGitHubHumanIdentityTrustBootstrap
});
