"use strict";

const { createExistingSessionAdapter } = require("./human-governance-approval-server-wiring");

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createGitHubHumanIdentityTrustRoutes({
  identityBootstrap = null,
  sessionAdapter = createExistingSessionAdapter()
} = {}) {
  if (typeof sessionAdapter !== "function") throw new TypeError("sessionAdapter must be a function");

  async function start(req, res) {
    try {
      const session = sessionAdapter(req);
      if (!identityBootstrap) {
        return res.status(503).json({
          outcome: "IDENTITY_BOOTSTRAP_NOT_CONFIGURED",
          reason: "GT63_GITHUB_OAUTH_CLIENT_ID is required",
          authority: "NONE"
        });
      }
      const result = await identityBootstrap.start(session);
      const status = result.outcome === "EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED"
        || result.outcome === "EXTERNAL_IDENTITY_ALREADY_VERIFIED" ? 200
        : result.outcome === "IDENTITY_BOOTSTRAP_REJECTED" ? 403 : 503;
      return res.status(status).json(result);
    } catch (error) {
      return res.status(403).json({ error: error.message, authority: "NONE" });
    }
  }

  async function poll(req, res) {
    try {
      const session = sessionAdapter(req);
      if (!identityBootstrap) {
        return res.status(503).json({
          outcome: "IDENTITY_BOOTSTRAP_NOT_CONFIGURED",
          reason: "GT63_GITHUB_OAUTH_CLIENT_ID is required",
          authority: "NONE"
        });
      }
      const challengeRef = req.body && req.body.challengeRef;
      if (!nonEmpty(challengeRef)) {
        return res.status(400).json({ error: "challengeRef required", authority: "NONE" });
      }
      const result = await identityBootstrap.poll({ ...session, challengeRef });
      const status = [
        "EXTERNAL_IDENTITY_VERIFIED",
        "EXTERNAL_IDENTITY_ALREADY_VERIFIED",
        "EXTERNAL_IDENTITY_AUTHORIZATION_PENDING"
      ].includes(result.outcome) ? 200
        : ["IDENTITY_BOOTSTRAP_REJECTED", "IDENTITY_BOOTSTRAP_EXPIRED"].includes(result.outcome) ? 403
          : 503;
      return res.status(status).json(result);
    } catch (error) {
      return res.status(403).json({ error: error.message, authority: "NONE" });
    }
  }

  return Object.freeze({ start, poll, authority: "NONE" });
}

module.exports = Object.freeze({ createGitHubHumanIdentityTrustRoutes });
