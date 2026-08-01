const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function extractFunctionBody(source, name) {
  const start = source.indexOf(`async function ${name}`);
  assert(start >= 0, `${name} must exist`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Could not extract ${name}`);
}

const serviceSource = read("public/canonical-offer-service.js");
const adminSource = read("public/admin.js");
const homeSource = read("public/gt63-proposal-flow.js");
const adminHtml = read("public/admin.html");
const homeHtml = read("public/index.html");

const requests = [];
const sandbox = {
  window: {},
  globalThis: {},
  fetch: async (url, options = {}) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        offer: { id: "OFF-CANONICAL" },
        clientLink: "/api/offers/view/OFF-CANONICAL",
        pdfLink: "/api/offers/OFF-CANONICAL/pdf"
      })
    };
  }
};
sandbox.window.fetch = sandbox.fetch;
sandbox.globalThis = sandbox.window;

vm.runInNewContext(serviceSource, sandbox, { filename: "canonical-offer-service.js" });

const service = sandbox.window.GT63CanonicalOfferService;
assert(service, "canonical offer service must be exposed on window");
assert.strictEqual(typeof service.buildCanonicalOfferPayload, "function", "service must expose payload builder");
assert.strictEqual(typeof service.saveCanonicalOffer, "function", "service must expose save contract");

const payload = service.buildCanonicalOfferPayload({
  clientName: " Market Test ",
  destination: " Tokyo ",
  currency: "",
  flights: [{ airline: " ANA ", route: "SOF -> HND", price: "812.40" }],
  hotels: [{ name: "Aman Tokyo", area: "Tokyo", price: "1000", images: [" /hotel.jpg ", "/hotel.jpg"] }],
  sourceEvidence: { intakeId: "SRC-1" },
  importContext: { mode: "smart-import" }
});

assert.strictEqual(payload.clientName, "Market Test", "admin/home shared fields must be trimmed");
assert.strictEqual(payload.destination, "Tokyo", "destination must be canonicalized");
assert.strictEqual(payload.currency, "EUR", "currency default must be preserved");
assert.strictEqual(payload.flights[0].price, 812.4, "flight price must be numeric");
assert.strictEqual(payload.hotels[0].selected, true, "first hotel must remain selected by default");
assert.strictEqual(payload.hotels[0].images.length, 1, "hotel images must be deduped");
assert.strictEqual(payload.hotels[0].images[0], "/hotel.jpg", "hotel image value must be preserved");
assert.strictEqual(payload.sourceEvidence.intakeId, "SRC-1", "source evidence must be preserved");
assert.strictEqual(payload.importContext.mode, "smart-import", "import context must be preserved");

service.validateCanonicalOfferPayload(payload, { requireMeaningfulContent: true });
assert.throws(
  () => service.validateCanonicalOfferPayload({ destination: "", flights: [], hotels: [] }),
  /Destination is required/,
  "missing destination must be blocked"
);

(async () => {
  await service.saveCanonicalOffer(payload);
  await service.saveCanonicalOffer(payload, { offerId: "OFF-EXISTING", method: "PUT" });

  assert.strictEqual(requests[0].url, "/api/offers", "create must post through the shared service");
  assert.strictEqual(requests[0].options.method, "POST", "create must use POST");
  assert.strictEqual(requests[1].url, "/api/offers/OFF-EXISTING", "update must target the existing offer");
  assert.strictEqual(requests[1].options.method, "PUT", "update must use PUT");

  assert(adminHtml.indexOf("/canonical-offer-service.js") < adminHtml.indexOf("/admin.js"), "Admin must load the service before admin.js");
  assert(homeHtml.indexOf("/canonical-offer-service.js") < homeHtml.indexOf("/gt63-proposal-flow.js"), "HOME must load the service before gt63-proposal-flow.js");

  const saveOfferBody = extractFunctionBody(adminSource, "saveOffer");
  assert(saveOfferBody.includes("GT63CanonicalOfferService"), "Admin saveOffer must delegate to the shared service");
  assert(!/fetchJson\(\s*wasEditing\s*\?/.test(saveOfferBody), "Admin saveOffer must not own the canonical /api/offers request");

  assert(homeSource.includes("GT63CanonicalOfferService"), "HOME generateProposal must delegate to the shared service");
  assert(!/fetchJson\(\s*["']\/api\/offers["']\s*,\s*\{[^}]*method:\s*["']POST["']/s.test(homeSource), "HOME must not directly POST /api/offers");
  assert(!homeSource.includes("function buildOfferPayloadFromFlow"), "HOME must not expose a second canonical payload builder");
  assert(homeSource.includes("function buildHomeOfferInputFromFlow"), "HOME may keep a thin input adapter");

  assert(adminSource.includes("collectForm()"), "Admin raw form collection must remain in place");
  assert(homeSource.includes("setGeneratedLinks(result.offer?.id"), "HOME response handling must keep saved offer links");

  console.log("canonical offer service regression PASS");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
