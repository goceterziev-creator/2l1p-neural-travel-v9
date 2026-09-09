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

const presentationLedger = approval.createMemoryLedger();
const sourceEventLedger = approval.createMemoryLedger();
const approvalSurface = approval.createHumanGovernanceApprovalSurface({
  presentationLedger,
  sourceEventLedger
});
const gateProvider = gateProviderModule.createExactBootstrapGateProvider();
const approvalRoutes = wiring.createHumanGovernanceApprovalRoutes({ approvalSurface, gateProvider });
const bindingRuntime = bindingRuntimeModule.createHumanGovernanceAuthenticatedBindingRuntime({
  presentationLedger,
  sourceEventLedger
});
const routes = boundRoutesModule.createHumanGovernanceBoundDecisionRoutes({
  routes: approvalRoutes,
  bindingRuntime
});
const basePath = "/api/gt63/governance/approval";

capturedApp.get(`${basePath}/:gateId/presentation`, routes.present);
capturedApp.post(`${basePath}/:gateId/decision`, routes.decide);

const port = process.env.PORT || 3001;
capturedApp.listen(port, () => {
  console.log(`🚀 2L1P Neural Travel running on http://localhost:${port}`);
  console.log("🔐 GT63 Human Governance Approval Surface V0 active (authority NONE)");
  console.log("🔗 GT63 Authenticated Human Source Event Binding adapter active (trust UNKNOWN until proven)");
});
