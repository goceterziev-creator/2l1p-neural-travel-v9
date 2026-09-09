"use strict";

const { createExistingSessionAdapter } = require("./human-governance-approval-server-wiring");

function createHumanGovernanceTrustDecisionRoutes({
  trustDecisionSurface,
  identityBootstrap,
  sessionAdapter = createExistingSessionAdapter()
} = {}) {
  if (!trustDecisionSurface || typeof trustDecisionSurface.present !== "function" || typeof trustDecisionSurface.decide !== "function") {
    throw new TypeError("trustDecisionSurface must expose present() and decide()");
  }
  if (!identityBootstrap || typeof identityBootstrap.getIdentityBySession !== "function") {
    throw new TypeError("identityBootstrap with getIdentityBySession() required");
  }
  if (typeof sessionAdapter !== "function") throw new TypeError("sessionAdapter must be a function");

  function resolveContext(req) {
    const session = sessionAdapter(req);
    const principal = identityBootstrap.getIdentityBySession(session.sessionRef);
    if (!principal) {
      const error = new Error("verified GitHub principal required for trust decision");
      error.statusCode = 403;
      throw error;
    }
    return { session, principal };
  }

  function present(req, res) {
    try {
      const { session, principal } = resolveContext(req);
      const presentation = trustDecisionSurface.present({ session, principal });
      return res.status(200).json({ outcome: "TRUST_DECISION_PRESENTED", presentation, authority: "NONE" });
    } catch (error) {
      return res.status(error.statusCode || 403).json({ error: error.message, authority: "NONE" });
    }
  }

  function decide(req, res) {
    try {
      const { session, principal } = resolveContext(req);
      const presentationId = req.body && req.body.presentationId;
      const decision = req.body && req.body.decision;
      const trustDecision = trustDecisionSurface.decide({ session, principal, presentationId, decision });
      return res.status(200).json({ outcome: "TRUST_DECISION_CAPTURED", trustDecision, authority: "NONE" });
    } catch (error) {
      return res.status(error.statusCode || 403).json({ error: error.message, authority: "NONE" });
    }
  }

  return Object.freeze({ present, decide, authority: "NONE" });
}

module.exports = Object.freeze({ createHumanGovernanceTrustDecisionRoutes });
