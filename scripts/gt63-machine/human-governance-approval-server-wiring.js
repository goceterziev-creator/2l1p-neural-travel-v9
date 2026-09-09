"use strict";

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function createExistingSessionAdapter({ authenticationProviderRef = "gt63-existing-signed-session-v0" } = {}) {
  return function adaptExistingSession(req) {
    const user = req && req.user;
    const session = req && req.session;
    const identity = req && req.sessionIdentity;
    if (!user || !session || !identity) throw new Error("authenticated runtime session context required");
    if (!nonEmpty(user.id) || !nonEmpty(identity.userId)) throw new Error("runtime user identity required");
    if (user.id !== identity.userId || session.userId !== identity.userId) throw new Error("runtime session identity mismatch");
    if (session.betaAuthBypass === true) throw new Error("beta auth bypass cannot authenticate governance approval");
    if (!Number.isFinite(Number(session.exp)) || Number(session.exp) <= Date.now()) throw new Error("runtime session expired");
    return Object.freeze({
      sessionRef: `gt63-runtime-session:${identity.userId}:${Number(session.iat || 0)}`,
      sessionRevision: String(identity.sessionVersion || session.sessionVersion || 1),
      authenticatedAccountRef: `gt63-runtime-user:${identity.userId}`,
      authenticationProviderRef,
      authenticationEvidenceRef: `gt63-runtime-session-evidence:${identity.userId}:${Number(session.iat || 0)}`,
      authenticationState: "AUTHENTICATED",
      freshnessState: "CURRENT"
    });
  };
}

function createHumanGovernanceApprovalRoutes({
  approvalSurface,
  gateProvider,
  sessionAdapter = createExistingSessionAdapter()
}) {
  if (!approvalSurface || typeof approvalSurface.present !== "function" || typeof approvalSurface.decide !== "function") {
    throw new Error("approvalSurface required");
  }
  if (!gateProvider || typeof gateProvider.getGate !== "function") throw new Error("gateProvider.getGate required");

  async function present(req, res) {
    try {
      const session = sessionAdapter(req);
      const gate = await gateProvider.getGate(req.params.gateId);
      if (!gate) return res.status(404).json({ error: "Governance gate not found" });
      if (gate.gateId !== req.params.gateId) throw new Error("gate identity mismatch");
      const presentation = approvalSurface.present({ session, gate });
      return res.status(200).json({ presentation, authority: "NONE" });
    } catch (error) {
      return res.status(403).json({ error: error.message, authority: "NONE" });
    }
  }

  async function decide(req, res) {
    try {
      const session = sessionAdapter(req);
      const presentationId = req.body && req.body.presentationId;
      const decision = req.body && req.body.decision;
      if (!nonEmpty(presentationId)) return res.status(400).json({ error: "presentationId required", authority: "NONE" });
      if (!nonEmpty(decision)) return res.status(400).json({ error: "decision required", authority: "NONE" });
      const sourceEvent = approvalSurface.decide({ session, presentationId, decision });
      return res.status(200).json({
        outcome: "HUMAN_SOURCE_EVENT_CREATED",
        sourceEvent,
        authority: "NONE"
      });
    } catch (error) {
      return res.status(403).json({ error: error.message, authority: "NONE" });
    }
  }

  return Object.freeze({ present, decide });
}

function attachHumanGovernanceApprovalRoutes(app, {
  requireAuthApi,
  routes,
  basePath = "/api/gt63/governance/approval"
}) {
  if (!app || typeof app.get !== "function" || typeof app.post !== "function") throw new Error("express app required");
  if (typeof requireAuthApi !== "function") throw new Error("requireAuthApi required");
  if (!routes || typeof routes.present !== "function" || typeof routes.decide !== "function") throw new Error("routes required");
  app.get(`${basePath}/:gateId/presentation`, requireAuthApi, routes.present);
  app.post(`${basePath}/:gateId/decision`, requireAuthApi, routes.decide);
  return Object.freeze({
    presentationRoute: `GET ${basePath}/:gateId/presentation`,
    decisionRoute: `POST ${basePath}/:gateId/decision`,
    authority: "NONE"
  });
}

module.exports = {
  createExistingSessionAdapter,
  createHumanGovernanceApprovalRoutes,
  attachHumanGovernanceApprovalRoutes
};
