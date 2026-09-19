"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

const SYNTHETIC_RECORD = Object.freeze({
  type: "GT63_SYNTHETIC_GENESIS_TRUST_PERSISTENCE_PROOF",
  proofRef: "gt63-proof:genesis-trust-persistent-db-binding-v0:synthetic-001",
  synthetic: true,
  authority: "NONE",
  authorityEffect: "NONE"
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonical(value[key]);
      return out;
    }, {});
  }
  return value;
}
function exact(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }

async function main() {
  if (process.env.GT63_REQUIRE_ISOLATED_STORAGE !== "true") throw new Error("GT63_REQUIRE_ISOLATED_STORAGE=true required");
  if (!process.env.DB_FILE) throw new Error("explicit DB_FILE required");
  if (!process.env.RAILWAY_VOLUME_MOUNT_PATH) throw new Error("RAILWAY_VOLUME_MOUNT_PATH required");

  const dbFile = path.resolve(process.env.DB_FILE);
  const mount = path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH);
  const rel = path.relative(mount, dbFile);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("DB_FILE must be strict descendant of isolated mount");

  const { createGt63GovernancePersistencePort } = require("../../server.js");
  const port = createGt63GovernancePersistencePort();

  if (process.argv.includes("--write")) {
    const result = await port.mutate((db) => {
      if (!db.gt63GovernanceEvidence) {
        db.gt63GovernanceEvidence = {
          schemaVersion: "gt63-governance-evidence-v0",
          genesisTrustDecisions: [],
          genesisTrustDecisionProvenances: [],
          genesisSourceChannelTrustRegistrations: [],
          syntheticPersistenceProofs: []
        };
      }
      const area = db.gt63GovernanceEvidence;
      if (area.schemaVersion !== "gt63-governance-evidence-v0") throw new Error("governance schema mismatch");
      if (!Array.isArray(area.syntheticPersistenceProofs)) area.syntheticPersistenceProofs = [];
      const matches = area.syntheticPersistenceProofs.filter(x => x && x.proofRef === SYNTHETIC_RECORD.proofRef);
      if (matches.length > 1) throw new Error("duplicate synthetic proof corruption");
      if (matches.length === 1 && !exact(matches[0], SYNTHETIC_RECORD)) throw new Error("synthetic proof conflict");
      if (matches.length === 0) area.syntheticPersistenceProofs.push(JSON.parse(JSON.stringify(SYNTHETIC_RECORD)));
      return db;
    });
    const stored = result.gt63GovernanceEvidence.syntheticPersistenceProofs.find(x => x.proofRef === SYNTHETIC_RECORD.proofRef);
    if (!exact(stored, SYNTHETIC_RECORD)) throw new Error("write/read-back mismatch");
    console.log(JSON.stringify({status:"PASS",phase:"WRITE_AND_READ_BACK",proofRef:SYNTHETIC_RECORD.proofRef,digest:"sha256:"+crypto.createHash("sha256").update(JSON.stringify(canonical(stored))).digest("hex"),authority:"NONE"}));
    return;
  }

  if (process.argv.includes("--verify-after-restart")) {
    const db = await port.read();
    const records = db.gt63GovernanceEvidence?.syntheticPersistenceProofs || [];
    const matches = records.filter(x => x && x.proofRef === SYNTHETIC_RECORD.proofRef);
    if (matches.length !== 1 || !exact(matches[0], SYNTHETIC_RECORD)) throw new Error("durable retrieval mismatch");
    console.log(JSON.stringify({status:"PASS",phase:"VERIFY_AFTER_RESTART",proofRef:SYNTHETIC_RECORD.proofRef,digest:"sha256:"+crypto.createHash("sha256").update(JSON.stringify(canonical(matches[0]))).digest("hex"),authority:"NONE"}));
    return;
  }

  throw new Error("use --write or --verify-after-restart");
}

main().catch(err => { console.error("FAIL - "+err.message); process.exitCode=1; });
