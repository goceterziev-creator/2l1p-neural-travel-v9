"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const PORT = String(process.env.V9_SMART_IMPORT_REGRESSION_PORT || "3977");
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-v9-smart-import-"));

let server = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(1000);
  }
  throw new Error("V9 smart import regression server did not become healthy");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  assert.equal(response.ok, true, `${url} returned ${response.status}: ${text.slice(0, 240)}`);
  return body;
}

function startServer() {
  server = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      PORT,
      LIVE_BASE_URL: BASE_URL,
      BETA_AUTH_BYPASS: "true",
      GT63_PRODUCT_LINE: "V9",
      GT63_RUNTIME_ENV: "staging",
      GT63_REQUIRE_ISOLATED_STORAGE: "true",
      DATA_DIR: TEMP_DIR,
      MEDIA_DIR: path.join(TEMP_DIR, "storage", "media")
    }
  });
}

async function stopServer() {
  if (!server) return;
  server.kill();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (server.exitCode !== null || server.signalCode) return;
    await delay(100);
  }
}

async function main() {
  startServer();
  await waitForHealth();

  const payload = {
    clientName: "Synthetic V9 Client",
    clientPhone: "+359000000000",
    destination: "Santiago",
    travelDates: "28.03.2027 - 08.04.2027",
    guests: "2 adults",
    status: "draft",
    currency: "EUR",
    flightPrice: 812.4,
    hotelPrice: 1750,
    markupPercent: 0,
    flights: [{
      airline: "LATAM",
      route: "SOF -> SCL / SCL -> SOF",
      departure: "28.03.2027",
      arrival: "08.04.2027",
      baggage: "Included according to airline rules",
      notes: "Synthetic smart import flight evidence.",
      price: 812.4
    }],
    hotels: [
      {
        name: "Holiday Inn Santiago - Airport Terminal by IHG",
        area: "Santiago",
        room: "Standard room",
        meal: "Breakfast",
        price: 1750,
        description: "Synthetic selected hotel from smart import review.",
        images: [],
        selected: true
      },
      {
        name: "Pullman Santiago Vitacura",
        area: "Santiago",
        room: "Superior room",
        meal: "Breakfast",
        price: 1920,
        description: "Synthetic second hotel candidate.",
        images: []
      },
      {
        name: "Mandarin Oriental Santiago",
        area: "Santiago",
        room: "Deluxe room",
        meal: "Breakfast",
        price: 2380,
        description: "Synthetic third hotel candidate.",
        images: []
      }
    ],
    sourceEvidence: {
      intakeId: "SMART-REGRESSION",
      archived: true,
      root: path.join(TEMP_DIR, "source-evidence", "SMART-REGRESSION"),
      sources: [
        { sourceId: "SRC-1", sourceType: "flight", originalFilename: "flight-1.png", storedPath: path.join(TEMP_DIR, "source-evidence", "SMART-REGRESSION", "source_1.png"), mimeType: "image/png", confidence: 0.98 },
        { sourceId: "SRC-2", sourceType: "flight", originalFilename: "flight-2.png", storedPath: path.join(TEMP_DIR, "source-evidence", "SMART-REGRESSION", "source_2.png"), mimeType: "image/png", confidence: 0.97 },
        { sourceId: "SRC-3", sourceType: "hotel", originalFilename: "hotel-1.png", storedPath: path.join(TEMP_DIR, "source-evidence", "SMART-REGRESSION", "source_3.png"), mimeType: "image/png", confidence: 0.99 },
        { sourceId: "SRC-4", sourceType: "hotel", originalFilename: "hotel-2.png", storedPath: path.join(TEMP_DIR, "source-evidence", "SMART-REGRESSION", "source_4.png"), mimeType: "image/png", confidence: 0.96 },
        { sourceId: "SRC-5", sourceType: "hotel", originalFilename: "hotel-3.png", storedPath: path.join(TEMP_DIR, "source-evidence", "SMART-REGRESSION", "source_5.png"), mimeType: "image/png", confidence: 0.95 }
      ]
    },
    importContext: {
      mode: "GT63_SMART_IMPORT",
      intakeId: "SMART-REGRESSION",
      contractVersion: "1.0",
      classifications: [
        { sourceId: "SRC-1", sourceType: "flight" },
        { sourceId: "SRC-2", sourceType: "flight" },
        { sourceId: "SRC-3", sourceType: "hotel" },
        { sourceId: "SRC-4", sourceType: "hotel" },
        { sourceId: "SRC-5", sourceType: "hotel" }
      ]
    }
  };

  assert.equal(payload.proposalInput, undefined, "fixture must represent the legacy Smart Import save payload");

  const created = await fetchJson(`${BASE_URL}/api/offers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const offer = created.offer;
  assert.ok(offer.id, "new offer should be persisted");
  assert.ok(offer.proposalInput, "new Smart Import offer should receive proposalInput");
  assert.equal(offer.proposalInput.flight.price, 812.4, "flight total price should survive into proposalInput");
  assert.equal(offer.proposalInput.flight.currency, "EUR", "flight currency should survive");
  assert.equal(offer.hotels.length, 3, "hotel candidates should not silently overwrite each other");
  assert.equal(offer.proposalInput.hotel.name, "Holiday Inn Santiago - Airport Terminal by IHG", "selected hotel should survive");
  assert.equal(offer.proposalInput.hotelOptions.length, 3, "proposalInput should preserve hotel options");
  assert.equal(offer.sourceEvidence.sources.length, 5, "source evidence references should persist");

  const html = await fetch(`${BASE_URL}/api/offers/view/${encodeURIComponent(offer.id)}`);
  assert.equal(html.ok, true, `client HTML returned ${html.status}`);

  const print = await fetch(`${BASE_URL}/api/offers/${encodeURIComponent(offer.id)}/print`);
  assert.equal(print.ok, true, `print HTML returned ${print.status}: ${await print.text()}`);

  const pdf = await fetch(`${BASE_URL}/api/offers/${encodeURIComponent(offer.id)}/pdf`);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdf.ok, true, `PDF returned ${pdf.status}`);
  assert.equal(pdfBytes.slice(0, 4).toString("utf8"), "%PDF", "PDF should start with a valid PDF signature");

  console.log("V9 Smart Import proposalInput regression PASS", {
    offerId: offer.id,
    flightPrice: offer.proposalInput.flight.price,
    hotelOptions: offer.proposalInput.hotelOptions.length,
    evidenceSources: offer.sourceEvidence.sources.length,
    pdfBytes: pdfBytes.length
  });
}

main()
  .catch((error) => {
    console.error(`V9 Smart Import proposalInput regression FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopServer();
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });
