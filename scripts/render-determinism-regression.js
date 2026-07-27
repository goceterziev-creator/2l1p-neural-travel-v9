"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");

function functionBody(name) {
  const start = server.indexOf(`function ${name}(`) >= 0
    ? server.indexOf(`function ${name}(`)
    : server.indexOf(`async function ${name}(`);
  assert(start >= 0, `${name} must exist`);

  const braceStart = server.indexOf("{", start);
  assert(braceStart >= 0, `${name} must have a body`);

  let depth = 0;
  for (let index = braceStart; index < server.length; index += 1) {
    const char = server[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return server.slice(braceStart + 1, index);
  }
  throw new Error(`${name} body could not be parsed`);
}

function routeBody(routeNeedle) {
  const start = server.indexOf(routeNeedle);
  assert(start >= 0, `${routeNeedle} must exist`);
  const nextRoute = server.indexOf("\napp.", start + routeNeedle.length);
  return server.slice(start, nextRoute >= 0 ? nextRoute : server.length);
}

function blockBetween(startNeedle, endNeedle) {
  const start = server.indexOf(startNeedle);
  assert(start >= 0, `${startNeedle} must exist`);
  const end = server.indexOf(endNeedle, start + startNeedle.length);
  assert(end >= 0, `${endNeedle} must exist after ${startNeedle}`);
  return server.slice(start, end);
}

function assertNoProviderLookup(label, body) {
  [
    "providerRegistry.get(",
    "findHotelImagesWithSerpApi(",
    "findHotelImageWithSerpApi(",
    "findDestinationImageWithSerpApi(",
    "process.env.SERPAPI_KEY",
    "https://serpapi.com/search.json",
    "process.env.GEMINI_API_KEY",
    "process.env.OPENAI_API_KEY",
    "generativelanguage.googleapis.com",
    "api.openai.com/v1/responses"
  ].forEach((needle) => {
    assert(!body.includes(needle), `${label} must not perform provider lookup: ${needle}`);
  });
}

function main() {
  const renderOfferHtmlBlock = blockBetween("async function renderOfferHtml", 'app.get("/api/offers/view/:id"');
  assertNoProviderLookup("renderOfferHtml", renderOfferHtmlBlock);
  assertNoProviderLookup("renderGt63RegistryOfferHtml", functionBody("renderGt63RegistryOfferHtml"));
  assertNoProviderLookup("renderGt63PrintOfferHtml", functionBody("renderGt63PrintOfferHtml"));
  assertNoProviderLookup("client HTML route", routeBody('app.get("/api/offers/view/:id"'));
  assertNoProviderLookup("print route", routeBody('app.get("/api/offers/:id/print"'));

  assert(renderOfferHtmlBlock.includes("offer.destinationImage"), "renderOfferHtml must use prepared destination image data");
  assert(renderOfferHtmlBlock.includes("uniqueHotelImages(hotel.images"), "renderOfferHtml must use prepared hotel image data");

  console.log("RENDER DETERMINISM REGRESSION PASS");
}

try {
  main();
} catch (error) {
  console.error("RENDER DETERMINISM REGRESSION FAIL:", error.message);
  process.exit(1);
}
