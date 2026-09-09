"use strict";

const path = require("node:path");

const expressModulePath = require.resolve("express");
const originalExpress = require(expressModulePath);
let capturedApp = null;

function captureExpress(...args) {
  const app = originalExpress(...args);
  if (capturedApp) throw new Error("GT63 governance bootstrap expected exactly one Express app");
  capturedApp = app;
  return app;
}
Object.assign(captureExpress, originalExpress);
require.cache[expressModulePath].exports = captureExpress;

try {
  require(path.join(__dirname, "..", "..", "server.js"));
} finally {
  require.cache[expressModulePath].exports = originalExpress;
}

if (!capturedApp) throw new Error("GT63 governance bootstrap could not capture Express app");

const approval = require("./human-governance-approval-surface");
const wiring = require("./human-governance-approval-server-wiring");
const gateProviderModule = require("./exact-bootstrap-gate-provider");
const bindingRuntimeModule = require("./human-governance-authenticated-binding-runtime");
const boundRoutesModule = require("./human-governance-bound-decision-routes");
const identityBootstrapModule = require("./github-human-identity-trust-bootstrap");
const identityRoutesModule = require("./github-human-identity-trust-routes");

const presentationLedger = approval.createMemoryLedger();
const sourceEventLedger = approval.createMemoryLedger();
const approvalSurface = approval.createHumanGovernanceApprovalSurface({
  presentationLedger,
  sourceEventLedger
});
const gateProvider = gateProviderModule.createExactBootstrapGateProvider();
const approvalRoutes = wiring.createHumanGovernanceApprovalRoutes({ approvalSurface, gateProvider });

const githubOAuthClientId = String(process.env.GT63_GITHUB_OAUTH_CLIENT_ID || "").trim();
const identityBootstrap = githubOAuthClientId
  ? identityBootstrapModule.createGitHubHumanIdentityTrustBootstrap({
      clientId: githubOAuthClientId,
      expectedIdentity: {
        githubUserId: 239696056,
        githubLogin: "goceterziev-creator"
      }
    })
  : null;

const bindingRuntime = bindingRuntimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
  presentationLedger,
  sourceEventLedger,
  identityProvider: identityBootstrap
});
const routes = boundRoutesModule.createHumanGovernanceBoundDecisionRoutes({
  routes: approvalRoutes,
  bindingRuntime
});
const basePath = "/api/gt63/governance/approval";

capturedApp.get(`${basePath}/:gateId/presentation`, routes.present);
capturedApp.post(`${basePath}/:gateId/decision`, routes.decide);

const identityRoutes = identityRoutesModule.createGitHubHumanIdentityTrustRoutes({ identityBootstrap });
const identityBasePath = "/api/gt63/governance/identity/github";

capturedApp.post(`${identityBasePath}/start`, identityRoutes.start);
capturedApp.post(`${identityBasePath}/poll`, identityRoutes.poll);

const port = process.env.PORT || 3001;
capturedApp.listen(port, () => {
  console.log(`🚀 2L1P Neural Travel running on http://localhost:${port}`);
  console.log("🔐 GT63 Human Governance Approval Surface V0 active (authority NONE)");
  console.log("🔗 GT63 Authenticated Human Source Event Binding adapter active (principal resolution may consume same-session verified GitHub identity; trust UNKNOWN until separately proven)");
  console.log(githubOAuthClientId
    ? "🪪 GT63 GitHub Human Identity Trust Bootstrap V0 active (candidate anchor; authority NONE)"
    : "🪪 GT63 GitHub Human Identity Trust Bootstrap V0 disabled: GT63_GITHUB_OAUTH_CLIENT_ID not configured");
});
