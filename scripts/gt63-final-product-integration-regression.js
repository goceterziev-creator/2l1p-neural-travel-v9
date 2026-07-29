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
const serverJs = read("server.js");

[
  "Aman Tokyo",
  "21,662.49 EUR",
  "Premium hotel preview for the proposal",
  "Destination</span><strong>Tokyo",
  "defaultPreview"
].forEach((needle) => {
  assert(!indexHtml.includes(needle), `HOME proposal preview must not contain demo-only value: ${needle}`);
  assert(!proposalFlow.includes(needle), `HOME proposal flow must not contain demo-only value: ${needle}`);
});

assert(
  !/<span class="meta-value">Market Test<\/span>/.test(indexHtml),
  "HOME proposal preview must not contain hardcoded Market Test client"
);
assert(indexHtml.includes('id="previewDestination"'), "Proposal Preview must expose destination binding");
assert(indexHtml.includes('id="previewHotel"'), "Proposal Preview must expose hotel binding");
assert(indexHtml.includes('id="previewClient"'), "Proposal Preview must expose client binding");
assert(indexHtml.includes('id="previewDates"'), "Proposal Preview must expose dates binding");
assert(indexHtml.includes('id="previewPrice"'), "Proposal Preview must expose price binding");
assert(indexHtml.includes('id="previewSummary"'), "Proposal Preview must expose summary binding");
assert(indexHtml.includes('id="previewHeroImage"'), "Proposal Preview must expose hero image binding");

assert(proposalFlow.includes("function previewModelFromOffer"), "HOME flow must derive preview data from the offer");
assert(proposalFlow.includes("updateProposalPreview(result.offer)"), "HOME flow must update preview from created offer response");
assert(proposalFlow.includes("setGeneratedLinks(result.offer?.id, result.clientLink, result.pdfLink)"), "HOME flow must use canonical offer links");
assert(!proposalFlow.includes("config.defaultPreview"), "HOME flow must not install a default demo preview");

assert(
  /normalizeProposalTemplateMetadata\(offer\.proposalTemplate \|\| proposalInput\?\.proposalTemplate\)/.test(serverJs),
  "Client HTML must accept canonical proposalInput proposal template metadata"
);
assert(serverJs.includes("res.send(await renderOfferHtml(offerForRender))"), "Client HTML route must render the canonical offer");
assert(serverJs.includes("const printUrl = new URL(`/api/offers/${encodeURIComponent(offer.id)}/print`, LIVE_BASE_URL);"), "PDF route must render from canonical print HTML");
assert(serverJs.includes("preferCSSPageSize: true"), "PDF route must preserve canonical print CSS page contract");

console.log("GT63 final product integration regression PASS");
