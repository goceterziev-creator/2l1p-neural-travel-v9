"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const indexHtml = read("public/index.html");
const proposalFlow = read("public/gt63-proposal-flow.js");

[
  "Ready to Send",
  "Needs Review",
  "Waiting for Client",
  "Drafts in Progress",
  "Blocked"
].forEach((stateLabel) => {
  assert(indexHtml.includes(stateLabel) || proposalFlow.includes(stateLabel), `HOME must present canonical state: ${stateLabel}`);
});

[
  "Agency Overview",
  "Revenue",
  "Analytics",
  "Activity Feed",
  "Provider Health",
  "Architecture Health",
  "System Metrics",
  "showcaseProposals",
  "See What Your Clients Will Receive"
].forEach((forbidden) => {
  assert(!indexHtml.includes(forbidden), `HOME v1 must not contain dashboard/showcase item: ${forbidden}`);
});

assert(indexHtml.includes("What deserves your attention today."), "HOME must answer what needs attention");
assert(indexHtml.includes("Next best action"), "HOME must expose next best action");
assert(indexHtml.includes("Proposal readiness"), "HOME must expose proposal readiness summary");
assert(indexHtml.includes("Continue work"), "HOME must expose continuation entry points");
assert(indexHtml.includes('id="workspace"'), "Workspace must remain the execution center");
assert(indexHtml.includes('id="createProposalTop"'), "New Proposal action must remain available");
assert(indexHtml.includes('id="generateProposal"'), "Existing proposal generation control must remain available");
assert(indexHtml.includes('id="previewFrame"'), "Existing canonical proposal preview must remain available after generation");

assert(proposalFlow.includes('fetchJson("/api/offers")'), "HOME must read existing proposal work from the existing /api/offers route");
assert(proposalFlow.includes("classifyHomeProposalState"), "HOME must map offers to canonical HOME proposal states");
assert(proposalFlow.includes("HOME_VISIBLE_STATES"), "HOME must use a bounded visible state set");
assert(proposalFlow.includes("loadProposalWork();"), "HOME must refresh proposal work after generation");
assert(!proposalFlow.includes("showcaseProposals"), "HOME flow must not keep market-test showcase logic");
assert(!proposalFlow.includes("Agency Overview"), "HOME flow must not introduce agency dashboard language");
assert(!proposalFlow.includes('fetchJson("/api/offers",'), "HOME must not reintroduce a direct save path");

console.log("GT63 HOME v1 contract regression PASS");
