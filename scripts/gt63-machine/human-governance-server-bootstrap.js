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

const approvalSurface = approval.createHumanGovernanceApprovalSurface({
  presentationLedger: approval.createMemoryLedger(),
  sourceEventLedger: approval.createMemoryLedger()
});
const gateProvider = gateProviderModule.createExactBootstrapGateProvider();
const routes = wiring.createHumanGovernanceApprovalRoutes({ approvalSurface, gateProvider });
const basePath = "/api/gt63/governance/approval";

capturedApp.get(`${basePath}/:gateId/presentation`, routes.present);
capturedApp.post(`${basePath}/:gateId/decision`, routes.decide);

const port = process.env.PORT || 3001;
capturedApp.listen(port, () => {
  console.log(`🚀 2L1P Neural Travel running on http://localhost:${port}`);
  console.log("🔐 GT63 Human Governance Approval Surface V0 active (authority NONE)");
});
