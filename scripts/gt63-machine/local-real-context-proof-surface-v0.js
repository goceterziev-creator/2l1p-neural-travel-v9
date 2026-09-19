"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RULESET_VERSION = "local-real-context-proof-surface-v0.1.0";
const AUTHORITY = "NONE";
const AUTHORITY_EFFECT = "NONE";
const EXPECTED_GITHUB_IDENTITY = Object.freeze({
  githubUserId: 239696056,
  githubLogin: "goceterziev-creator"
});

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function resolveDbFile() {
  return process.env.DB_FILE
    ? path.resolve(process.env.DB_FILE)
    : path.resolve(__dirname, "..", "..", "DATABASE", "database.json");
}

function establishReadOnlyDbGuard() {
  const dbFile = resolveDbFile();
  if (!fs.existsSync(dbFile)) throw new Error("local proof requires an existing DB_FILE; creation is forbidden");
  const parsed = JSON.parse(fs.readFileSync(dbFile, "utf8"));
  if (parsed.schemaVersion !== "gt63-v9-staging-1") {
    throw new Error("local proof requires current DB schema; migration/write is forbidden");
  }
  const digest = sha256File(dbFile);
  return Object.freeze({
    dbFile,
    digest,
    assertUnchanged() {
      if (sha256File(dbFile) !== digest) throw new Error("DB mutation detected; local proof stopped");
    }
  });
}

function safeError(error) {
  return String(error && error.message || error);
}

function html() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>GT63 Local Real-Context Proof</title></head>
<body>
<h1>GT63 Local Real-Context Proof Surface</h1>
<p>Authority: NONE. This surface performs only authenticated-session → GitHub Device Flow → exact BOUND/REJECTED proof.</p>
<button id="start">Start GitHub identity proof</button>
<pre id="out">Ready.</pre>
<script>
const out=document.getElementById("out");
let challengeRef=null;
document.getElementById("start").onclick=async()=>{
  const r=await fetch("/api/gt63/local-real-context-proof/start",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  const j=await r.json(); out.textContent=JSON.stringify(j,null,2);
  if(j.challenge){challengeRef=j.challenge.challengeRef;
    const p=document.createElement("p");
    p.innerHTML="Open <a target='_blank' rel='noopener noreferrer' href='"+j.challenge.verificationUri+"'>GitHub device authorization</a> and enter code <strong>"+j.challenge.userCode+"</strong>.";
    document.body.appendChild(p);
    const b=document.createElement("button"); b.textContent="Poll / prove BOUND or REJECTED";
    b.onclick=async()=>{const q=await fetch("/api/gt63/local-real-context-proof/poll",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeRef})});out.textContent=JSON.stringify(await q.json(),null,2);}; document.body.appendChild(b);
  }
};
</script></body></html>`;
}

async function main() {
  if (!process.env.GITHUB_CLIENT_ID) throw new Error("GITHUB_CLIENT_ID is required");
  if (process.env.BETA_AUTH_BYPASS === "true") throw new Error("BETA_AUTH_BYPASS must be disabled");

  const dbGuard = establishReadOnlyDbGuard();

  const { app } = require("../../server");
  dbGuard.assertUnchanged();

  const { createExistingSessionAdapter } = require("./human-governance-approval-server-wiring");
  const { createGenesisPrincipalBootstrapRuntimeBridge } = require("./genesis-principal-bootstrap-runtime-bridge-v0");
  const { createGenesisTrustRealHumanContextBindingProof } = require("./genesis-trust-real-human-context-binding-proof-v0");

  const sessionAdapter = createExistingSessionAdapter();
  const bridge = createGenesisPrincipalBootstrapRuntimeBridge({
    clientId: process.env.GITHUB_CLIENT_ID,
    expectedIdentity: EXPECTED_GITHUB_IDENTITY
  });
  const proof = createGenesisTrustRealHumanContextBindingProof({
    sessionAdapter,
    identityProvider: bridge
  });

  app.get("/gt63-local-real-context-proof", (_req, res) => {
    dbGuard.assertUnchanged();
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(html());
  });

  app.post("/api/gt63/local-real-context-proof/start", async (req, res) => {
    try {
      dbGuard.assertUnchanged();
      const session = sessionAdapter(req);
      const result = await bridge.start(session);
      dbGuard.assertUnchanged();
      if (result.outcome !== "EXTERNAL_IDENTITY_AUTHORIZATION_REQUIRED" && result.outcome !== "EXTERNAL_IDENTITY_ALREADY_VERIFIED") {
        return res.status(409).json({ outcome: result.outcome, reason: result.reason || null, authority: AUTHORITY, authorityEffect: AUTHORITY_EFFECT });
      }
      if (result.outcome === "EXTERNAL_IDENTITY_ALREADY_VERIFIED") {
        return res.json({ outcome: result.outcome, proof: proof.prove(req), authority: AUTHORITY, authorityEffect: AUTHORITY_EFFECT });
      }
      return res.json({ outcome: result.outcome, challenge: result.challenge, authority: AUTHORITY, authorityEffect: AUTHORITY_EFFECT });
    } catch (error) {
      return res.status(409).json({ outcome: "LOCAL_REAL_CONTEXT_PROOF_REJECTED", reason: safeError(error), authority: AUTHORITY, authorityEffect: AUTHORITY_EFFECT });
    }
  });

  app.post("/api/gt63/local-real-context-proof/poll", async (req, res) => {
    try {
      dbGuard.assertUnchanged();
      const session = sessionAdapter(req);
      const challengeRef = String(req.body && req.body.challengeRef || "");
      const identityResult = await bridge.poll(session, challengeRef);
      dbGuard.assertUnchanged();
      if (identityResult.outcome === "EXTERNAL_IDENTITY_VERIFIED" || identityResult.outcome === "EXTERNAL_IDENTITY_ALREADY_VERIFIED") {
        const bindingProof = proof.prove(req);
        dbGuard.assertUnchanged();
        return res.json({
          outcome: identityResult.outcome,
          principalRef: identityResult.identity && identityResult.identity.principalRef || null,
          principalEvidenceRef: identityResult.identity && identityResult.identity.principalEvidenceRef || null,
          proof: bindingProof,
          authority: AUTHORITY,
          authorityEffect: AUTHORITY_EFFECT
        });
      }
      return res.status(identityResult.outcome === "EXTERNAL_IDENTITY_AUTHORIZATION_PENDING" ? 202 : 409).json({
        outcome: identityResult.outcome,
        reason: identityResult.reason || null,
        retryAfterSeconds: identityResult.retryAfterSeconds || null,
        authority: AUTHORITY,
        authorityEffect: AUTHORITY_EFFECT
      });
    } catch (error) {
      return res.status(409).json({ outcome: "LOCAL_REAL_CONTEXT_PROOF_REJECTED", reason: safeError(error), authority: AUTHORITY, authorityEffect: AUTHORITY_EFFECT });
    }
  });

  const port = Number(process.env.GT63_LOCAL_PROOF_PORT || process.env.PORT || 3001);
  app.listen(port, "127.0.0.1", () => {
    dbGuard.assertUnchanged();
    console.log(JSON.stringify({
      status: "READY",
      workflow: RULESET_VERSION,
      url: `http://127.0.0.1:${port}/gt63-local-real-context-proof`,
      dbMutation: "FORBIDDEN_AND_GUARDED",
      authority: AUTHORITY,
      authorityEffect: AUTHORITY_EFFECT
    }));
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "STOP", workflow: RULESET_VERSION, reason: safeError(error), authority: AUTHORITY, authorityEffect: AUTHORITY_EFFECT }));
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({ RULESET_VERSION, AUTHORITY, AUTHORITY_EFFECT, EXPECTED_GITHUB_IDENTITY, establishReadOnlyDbGuard });
