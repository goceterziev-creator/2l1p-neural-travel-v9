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
assert(indexHtml.includes('id="previewFrame"'), "HOME Proposal Preview must embed the canonical proposal route");
assert(indexHtml.includes('id="previewEmpty"'), "HOME Proposal Preview must keep a pre-generation empty state");

assert(!proposalFlow.includes("function previewModelFromOffer"), "HOME flow must not recreate proposal markup or preview data");
assert(proposalFlow.includes("updateProposalPreview(result.offer)"), "HOME flow must update preview from created offer response");
assert(proposalFlow.includes("setGeneratedLinks(result.offer?.id, result.clientLink, result.pdfLink)"), "HOME flow must use canonical offer links");
assert(proposalFlow.includes("?preview=1"), "HOME preview must reference the canonical Client HTML route in preview mode");
assert(proposalFlow.includes('selected: "multi-hotel"'), "HOME offers with hotel options must select the canonical multi-hotel template");
assert(!proposalFlow.includes("config.defaultPreview"), "HOME flow must not install a default demo preview");

assert(
  /normalizeProposalTemplateMetadata\(offer\.proposalTemplate \|\| proposalInput\?\.proposalTemplate\)/.test(serverJs),
  "Client HTML must accept canonical proposalInput proposal template metadata"
);
assert(serverJs.includes("res.send(await renderOfferHtml(offerForRender))"), "Client HTML route must render the canonical offer");
assert(serverJs.includes("renderGt63RegistryOfferHtml(offer, {"), "Print route must try the canonical registry renderer before legacy fallback");
assert(serverJs.includes("printMode: true"), "Canonical PDF path must render registry HTML in print mode");
assert(serverJs.includes("const printUrl = new URL(`/api/offers/${encodeURIComponent(offer.id)}/print`, LIVE_BASE_URL);"), "PDF route must render from canonical print HTML");
assert(serverJs.includes("preferCSSPageSize: true"), "PDF route must preserve canonical print CSS page contract");
assert(serverJs.includes("@page { size: A4; margin: 0; }"), "Canonical registry renderer must define the print page contract");

console.log("GT63 final product integration regression PASS");
