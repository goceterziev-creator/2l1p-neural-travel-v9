"use strict";

const identityModule = require("./github-human-identity-trust-bootstrap");
const identityRoutesModule = require("./github-human-identity-trust-routes");
const captureModule = require("./human-governance-trust-decision-presentation-capture");
const decisionRoutesModule = require("./human-governance-trust-decision-routes");
const durableModule = require("./human-governance-trust-decision-durable-ledger");
const runtimeModule = require("./human-governance-trust-runtime-chain");
const runtimeRoutesModule = require("./human-governance-trust-runtime-chain-routes");
const { createExistingSessionAdapter } = require("./human-governance-approval-server-wiring");

const DEFAULT_BASE_PATH = "/api/gt63/trust";

function createProductionTrustRuntimeComposition({
  readDb,
  writeDb,
  githubClientId = "",
  identityTransport,
  sessionAdapter = createExistingSessionAdapter()
} = {}) {
  if (typeof readDb !== "function") throw new TypeError("readDb required");
  if (typeof writeDb !== "function") throw new TypeError("writeDb required");
  if (typeof sessionAdapter !== "function") throw new TypeError("sessionAdapter required");

  const decisionLedger = durableModule.createDurableTrustDecisionLedger({ readDb, writeDb });
  const presentationLedger = captureModule.createMemoryLedger();

  const identityBootstrap = githubClientId
    ? identityModule.createGitHubHumanIdentityTrustBootstrap({
        clientId: githubClientId,
        ...(typeof identityTransport === "function" ? { transport: identityTransport } : {})
      })
    : null;

  const trustDecisionSurface = captureModule.createHumanGovernanceTrustDecisionPresentationCapture({
    presentationLedger,
    decisionLedger
  });

  const identityRoutes = identityRoutesModule.createGitHubHumanIdentityTrustRoutes({
    identityBootstrap,
    sessionAdapter
  });

  const trustDecisionRoutes = identityBootstrap
    ? decisionRoutesModule.createHumanGovernanceTrustDecisionRoutes({
        trustDecisionSurface,
        identityBootstrap,
        sessionAdapter
      })
    : null;

  const runtimeChain = identityBootstrap
    ? runtimeModule.createHumanGovernanceTrustRuntimeChain({ decisionLedger, identityBootstrap })
    : null;

  const runtimeRoutes = runtimeChain
    ? runtimeRoutesModule.createHumanGovernanceTrustRuntimeChainRoutes({
        runtimeChain,
        identityBootstrap,
        sessionAdapter
      })
    : null;

  return Object.freeze({
    identityRoutes,
    trustDecisionRoutes,
    runtimeRoutes,
    decisionLedger,
    identityBootstrap,
    authority: "NONE"
  });
}

function attachProductionTrustRuntimeRoutes(app, {
  requireAuthApi,
  composition,
  basePath = DEFAULT_BASE_PATH
} = {}) {
  if (!app || typeof app.post !== "function" || typeof app.get !== "function") throw new TypeError("express app required");
  if (typeof requireAuthApi !== "function") throw new TypeError("requireAuthApi required");
  if (!composition || !composition.identityRoutes) throw new TypeError("composition required");

  app.post(`${basePath}/identity/start`, requireAuthApi, composition.identityRoutes.start);
  app.post(`${basePath}/identity/poll`, requireAuthApi, composition.identityRoutes.poll);

  if (composition.trustDecisionRoutes && composition.runtimeRoutes) {
    app.get(`${basePath}/decision/presentation`, requireAuthApi, composition.trustDecisionRoutes.present);
    app.post(`${basePath}/decision`, requireAuthApi, composition.trustDecisionRoutes.decide);
    app.post(`${basePath}/consume`, requireAuthApi, composition.runtimeRoutes.consume);
  }

  return Object.freeze({
    basePath,
    identityStartRoute: `POST ${basePath}/identity/start`,
    identityPollRoute: `POST ${basePath}/identity/poll`,
    trustRoutesConfigured: Boolean(composition.trustDecisionRoutes && composition.runtimeRoutes),
    authority: "NONE"
  });
}

module.exports = Object.freeze({
  DEFAULT_BASE_PATH,
  createProductionTrustRuntimeComposition,
  attachProductionTrustRuntimeRoutes
});
