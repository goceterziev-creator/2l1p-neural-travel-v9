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
const adminHtml = read("public/admin.html");
const adminJs = read("public/admin.js");
const offerService = read("public/canonical-offer-service.js");
const serverJs = read("server.js");
const printRenderer = read("gt63-core/renderers/print-presentation.js");

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
assert(proposalFlow.includes('source: "home_signature_renderer"'), "HOME offers must use the canonical GT63 Signature Proposal renderer");
assert(proposalFlow.includes('selected: "multi-hotel"'), "HOME offers with hotel options must select the canonical multi-hotel template");
assert(!proposalFlow.includes("const proposalTemplate = hotels.length > 1"), "HOME renderer selection must not fall back to cathedral for single-hotel offers");
assert(!proposalFlow.includes("config.defaultPreview"), "HOME flow must not install a default demo preview");

assert(
  /normalizeProposalTemplateMetadata\(offer\.proposalTemplate \|\| proposalInput\?\.proposalTemplate\)/.test(serverJs),
  "Client HTML must accept canonical proposalInput proposal template metadata"
);
assert(serverJs.includes("res.send(await renderOfferHtml(offerForRender))"), "Client HTML route must render the canonical offer");
assert(serverJs.includes("gt63PrintPresentationRenderer.renderPrintProposal(input, {"), "Print route must use the dedicated premium print presentation renderer");
assert(serverJs.includes("const printUrl = new URL(`/api/offers/${encodeURIComponent(offer.id)}/print`, LIVE_BASE_URL);"), "PDF route must render from canonical print HTML");
assert(serverJs.includes("preferCSSPageSize: true"), "PDF route must preserve canonical print CSS page contract");
assert(printRenderer.includes("function renderPrintProposal"), "Premium PDF must be generated from the dedicated print presentation renderer");
assert(serverJs.includes("@page { size: A4; margin: 0; }") || printRenderer.includes("@page { size: A4; margin: 0; }"), "Canonical print presentation must define the print page contract");
assert(serverJs.includes('/api/source-evidence/offers/:intakeId/original/:filename'), "Uploaded source evidence images must have a safe public route");
assert(serverJs.includes("function sourceEvidenceImageUrls"), "Server must expose uploaded evidence image URLs for canonical offer data");
assert(serverJs.includes("uploadedImageUrls"), "Hotel import must bind uploaded hotel screenshots before provider images");
assert(serverJs.includes("const mergedImages = uniqueHotelImages([...existingImages, ...imageUrls], 3);"), "Uploaded hotel images must win over provider fallback images");
assert(serverJs.includes("hotelOptions,"), "Hotel import endpoint must return canonical hotel options");
assert(serverJs.includes("evidence,"), "Hotel import endpoint must return source evidence for HOME offer persistence");
assert(serverJs.includes("intakeId,"), "Hotel import evidence must include the intake id for stable source-image references");
assert(serverJs.includes("const hotelOptions = safeArray(result.hotelOptions).map"), "Hotel import must preserve uploaded evidence images on every hotel option");
assert(proposalFlow.includes("state.hotelImportData?.hotelOptions"), "HOME payload must use hotel import options when Smart Import options are absent");
assert(proposalFlow.includes("state.hotelImportData?.evidence"), "HOME payload must persist hotel import evidence when Smart Import evidence is absent");
assert(proposalFlow.includes("function destinationFromFlightRoute"), "HOME flow must infer destination from the flight route instead of hotel address");
assert(proposalFlow.includes("destinationFromHotelLocation(hotel.location || hotel.area)"), "HOME flow must extract a city label from hotel location fallback");
assert(!proposalFlow.includes("hotel.city,\n      hotel.area"), "HOME flow must not use raw hotel area/address as proposal destination");

assert(adminHtml.indexOf("/canonical-offer-service.js") < adminHtml.indexOf("/admin.js"), "Admin must load the canonical offer service before admin.js");
assert(indexHtml.indexOf("/canonical-offer-service.js") < indexHtml.indexOf("/gt63-proposal-flow.js"), "HOME must load the canonical offer service before gt63-proposal-flow.js");
assert(offerService.includes("saveCanonicalOffer"), "One canonical browser offer save service must exist");
assert(adminJs.includes("GT63CanonicalOfferService"), "Admin save must delegate to the canonical offer service");
assert(proposalFlow.includes("GT63CanonicalOfferService"), "HOME save must delegate to the canonical offer service");
assert(!/fetchJson\(\s*["']\/api\/offers["']\s*,\s*\{[^}]*method:\s*["']POST["']/s.test(proposalFlow), "HOME must not own a direct /api/offers save path");

console.log("GT63 final product integration regression PASS");
