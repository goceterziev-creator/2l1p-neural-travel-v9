"use strict";

const { createExistingSessionAdapter } = require("./human-governance-approval-server-wiring");

function createHumanGovernanceTrustRuntimeChainRoutes({ runtimeChain, identityBootstrap, sessionAdapter = createExistingSessionAdapter() } = {}) {
  if (!runtimeChain || typeof runtimeChain.authorizeTrustDecision !== "function") throw new TypeError("runtimeChain.authorizeTrustDecision required");
  if (!identityBootstrap || typeof identityBootstrap.getIdentityBySession !== "function") throw new TypeError("identityBootstrap.getIdentityBySession required");
  if (typeof sessionAdapter !== "function") throw new TypeError("sessionAdapter must be a function");

  function consume(req, res) {
    try {
      const session = sessionAdapter(req);
      const principal = identityBootstrap.getIdentityBySession(session.sessionRef);
      if (!principal) return res.status(403).json({ error: "verified GitHub principal required", authority: "NONE" });
      const decisionEvidenceRef = req.body && req.body.decisionEvidenceRef;
      if (typeof decisionEvidenceRef !== "string" || decisionEvidenceRef.length === 0) {
        return res.status(400).json({ error: "decisionEvidenceRef required", authority: "NONE" });
      }
      const result = runtimeChain.authorizeTrustDecision(decisionEvidenceRef);
      const status = result.outcome === "TRUST_RUNTIME_CHAIN_RESOLVED" ? 200 : 409;
      return res.status(status).json(result);
    } catch (error) {
      return res.status(403).json({ error: error.message, authority: "NONE" });
    }
  }

  return Object.freeze({ consume, authority: "NONE" });
}

module.exports = Object.freeze({ createHumanGovernanceTrustRuntimeChainRoutes });
