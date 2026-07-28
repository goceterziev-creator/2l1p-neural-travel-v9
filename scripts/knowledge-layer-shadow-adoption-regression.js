"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const { adaptSmartImportForProduct } = require("../gt63-core/smart-import-consumer-adapter");
const { buildProposalInputFromProductModel } = require("../gt63-core/proposal-input-adapter");
const {
  evaluateProposalInputKnowledgeShadow
} = require("../knowledge-layer");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function proposalFixture() {
  const productModel = adaptSmartImportForProduct(readJson("test/fixtures/smart-import/flight-hotel-mixed.json"));
  return {
    productModel,
    context: {
      clientName: "G. Terziev",
      destination: "Maldives",
      travelDates: "31 August - 15 September",
      travelers: "2"
    }
  };
}

function assertShadowMatchesProposalInput() {
  const { productModel, context } = proposalFixture();
  const proposalInput = buildProposalInputFromProductModel(productModel, context);
  const shadow = evaluateProposalInputKnowledgeShadow(proposalInput);
  assert.equal(shadow.mode, "KNOWLEDGE_SHADOW", "shadow result should identify shadow mode");
  assert.equal(shadow.ok, true, `shadow should match legacy proposalInput: ${JSON.stringify(shadow.diagnostics)}`);
  assert.equal(shadow.summary.destinations, 1, "shadow should map destination");
  assert.equal(shadow.summary.hotels, proposalInput.hotelOptions.length, "shadow hotel count should match proposalInput hotel options");
  assert.equal(shadow.summary.flights, proposalInput.flight ? 1 : 0, "shadow flight count should match proposalInput");
  assert.ok(shadow.summary.prices >= 2, "shadow should map flight and hotel prices");
}

function assertRuntimeOutputIdentical() {
  const { productModel, context } = proposalFixture();
  const before = buildProposalInputFromProductModel(productModel, context);
  const after = buildProposalInputFromProductModel(productModel, context);
  assert.deepStrictEqual(after, before, "shadow adoption must not change proposalInput output");
}

function assertMismatchDiagnosticsAreNonBlocking() {
  const { productModel, context } = proposalFixture();
  const proposalInput = buildProposalInputFromProductModel(productModel, context);
  const changed = clone(proposalInput);
  changed.flight.price = 9999;
  const logged = [];
  const shadow = evaluateProposalInputKnowledgeShadow(changed, {
    logger: (message, details) => logged.push({ message, details })
  });
  assert.equal(shadow.ok, true, "self-consistent proposalInput should still map");

  const mismatched = clone(proposalInput);
  mismatched.hotelOptions = [];
  const mismatch = evaluateProposalInputKnowledgeShadow(mismatched, {
    logger: (message, details) => logged.push({ message, details })
  });
  assert.equal(mismatch.ok, false, "shadow should detect mismatches");
  assert.ok(mismatch.diagnostics.some((item) => item.field === "hotelOptions.length"), "shadow should report mismatch field");
  assert.equal(logged.length, 1, "shadow mismatch should emit diagnostics through logger");
}

function assertBoundary() {
  const files = [
    "knowledge-layer/shadow/proposal-input-shadow.js",
    "gt63-core/proposal-input-adapter.js"
  ];
  files.forEach((file) => {
    const text = readText(file);
    assert(!/fetch\(|SERPAPI|GEMINI|OPENAI|database\.json|writeFile|readFile/.test(text), `${file} must not add provider or persistence behavior`);
  });
  const server = readText("server.js");
  assert(!server.includes("evaluateProposalInputKnowledgeShadow"), "shadow adoption must not alter server routes");
}

function main() {
  assertShadowMatchesProposalInput();
  assertRuntimeOutputIdentical();
  assertMismatchDiagnosticsAreNonBlocking();
  assertBoundary();
  console.log("KNOWLEDGE LAYER SHADOW ADOPTION REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("KNOWLEDGE LAYER SHADOW ADOPTION REGRESSION FAIL:", error.message);
  process.exit(1);
}
