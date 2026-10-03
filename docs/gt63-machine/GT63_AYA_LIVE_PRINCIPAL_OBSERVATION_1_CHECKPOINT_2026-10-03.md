# GT63 × AYA — LIVE AUTHENTICATED-PRINCIPAL OBSERVATION #1 — 2026-10-03

## Evidence status and provenance

User-supplied Goshko execution report preserved on explicit human request at 2026-10-03 21:51:14 Europe/Sofia.
This checkpoint preserves the exact supplied response JSON values. Live requests and provider logs were not independently re-executed/read by the preserving assistant.
Classification within the reported single isolated-staging pass: ADMITTED HISTORICAL OBSERVATION WITNESS.
Observed at: 2026-10-03T18:27:43.558Z = 2026-10-03 21:27:43.558 Europe/Sofia.

## Design, implementation and deployment anchors

Accepted design checkpoint: GT63_AYA_OBSERVATION_V0_ACCEPTED_CHECKPOINT_2026-10-03.md.
Design SHA-256: 5ac5fd1b34c5a1c8ab5262d1e1ef744a20b362dcb7cd58169092c525f48413fa.
45/45 decisions accepted 2026-10-03 10:02:48 Europe/Sofia.
Separate authorized transport-failure addition: REQUEST_STREAM_FAILED pre-evaluation envelope.
Reported exact promotion chain:
cb614c0272895f7efc3d5aab0e5b0ca03cab9850
→ 7dc0f309acce4ee686f92b0693aca21810134abc
→ 173633cd2a2e802d5d2a8e145c30c98091e7d5ae.
Promoted tree: c7f5072e651f2f46b0612a4644b624eb51c60a4d.
Staging deployment: 3f62d0da-ff0e-4e24-abee-4d828dffda73, reported SUCCESS.
Service: 2l1p-neural-travel-v9; project luminous-education; runtime staging.
DB path: /data/gt63/database.json.
Reported health: HTTP 200, DB/media healthy.
Earlier source review independently identified IncomingMessage prototype rejection; correction source was independently inspected.
Executor verification: 156/156 provider-free PASS; 15/15 minimal actual Express/HTTP PASS.
Bodyless pre-end socket abort: NOT REPRODUCIBLE; no defect established from that timing limitation.
Full startup/real authentication were not established by the minimal harness; the reported live chain now exercises normal login and the observation route on deployed staging.

## Request history and execution corrections

Earlier authorized post-deployment login succeeded once, but session cookie was discarded when its PowerShell process exited. No observation request was sent in that pass.
Subsequent preparation failed before requests: login count 0, observation count 0.
Local preparation root cause: npm Railway wrappers were not directly spawnable from Node (ENOENT / EINVAL). Corrected by invoking installed Railway JS entrypoint using current Node executable; no provider/repository/environment configuration change.
Final combined pass: exactly one new normal login plus exactly one observation POST in the same process with in-memory cookie jar.
Final pass HTTP retries: 0; redirect replay: 0.
Login HTTP 200, success true; USR-ADMIN / AGY-AYA; sessionVersion 1, principalAuthEpoch 1.
Existing normal login authentication/A-class/audit writes were authorized.
Cookie usable, not displayed or persisted outside process, jar cleared after completion.
Provider logs reportedly corroborate one request of each type on the same deployment.
Final observation HTTP 200; Cache-Control: no-store; portInvocationCount 1.
No credential, password, cookie or token is preserved here.

## Exact supplied historical witness

```json
{
  "type": "GT63_AYA_AUTHENTICATED_PRINCIPAL_OBSERVATION_WITNESS",
  "schemaVersion": "1.0",
  "observationRef": "5d301638-8501-49b1-b14f-292487c07a6b",
  "observationRevision": 1,
  "observationState": "ADMITTED",
  "observedAt": "2026-10-03T18:27:43.558Z",
  "observedPrincipal": {
    "principalRef": "gt63-principal:aya-account:AGY-AYA:USR-ADMIN",
    "principalRevision": "aya-principal-binding-revision:1",
    "principalEvidenceRef": "gt63-evidence:aya-authenticated-principal:5d7a6cd6217ea029f4e94f73a67e9268d86f4f4c853aae195e2bab0988ef489a",
    "observedLifecycleState": "CURRENT",
    "observedFreshnessState": "CURRENT",
    "observedContradictionState": "NONE"
  },
  "provenance": {
    "principalBindingEvidenceRef": "gt63-principal-binding-evidence:aya-account:73ccf85e7f4c1bd6e86ceea024dc338f62b66b3e64a85898d0a8cab915d423f1",
    "authEventSessionBindingRef": "gt63-aya-auth-event-session-binding:060d1f467e4ba85fb7b3a142e7e803130b3f7d004bb94d6f33f02c2c68357ecb",
    "authenticationEventIdentity": "gt63-auth-event:6bad7083e0867abfb5feffb519dfcfd7",
    "aClassEvidenceIdentity": "gt63-evidence:a-class:6bad7083e0867abfb5feffb519dfcfd7",
    "aClassEvidenceRevision": "1",
    "sessionRef": "gt63-aya-session:21be73b77529d17c26230c3528a1e7ef463c413eca6eb85ec0f8e6da8c5e8c7f",
    "sessionVersion": "1",
    "observedPrincipalAuthEpoch": "1",
    "currentPrincipalAuthEpoch": "1"
  },
  "evidenceCurrentness": "ENDED_WITH_SYNCHRONOUS_OBSERVATION_EVALUATION",
  "portInvocationCount": 1,
  "reusablePrincipalProof": false,
  "authority": "NONE",
  "authorityEffect": "NONE",
  "nonClaims": {
    "principalEligibilityCreated": false,
    "roleCreated": false,
    "delegationCreated": false,
    "humanGateCreated": false,
    "governancePackageCreated": false,
    "effectAuthorizationCreated": false,
    "offerMutationPerformed": false
  }
}
```

## Validation and limitations

Reported exact schema validation: PASS.
14 top-level witness keys; six principal fields; nine provenance fields; seven nonClaims all false.
Exact Binding #1 reference preserved; authenticated-principal evidence reference is distinct.
Observed lifecycle/freshness/contradiction: CURRENT / CURRENT / NONE at evaluation.
Observed/current auth epochs match (1); login/witness sessionVersion matches (1).

Evidence lifetime ended with synchronous evaluation. This archived witness is NOT current or reusable principal evidence.
Observation DB non-mutation: NOT MEASURED.
Runtime DB-read count: NOT CLAIMED from portInvocationCount; source/regression orchestration is separate proof.
Startup DB byte mutation: UNKNOWN.
Direct deployed container filesystem hashes: NOT VERIFIED.
No downstream eligibility, role, delegation, gate, governance package, effect authorization or offer mutation is established.
Binding #1: PROVEN / CLOSED / UNCHANGED per supplied evidence.
MACHINE AUTHORITY: NONE.
authorityEffect: NONE.

## Continuation

Single staging admission observation milestone complete within the reported bounded pass.
The authorized final login and observation attempts are consumed; no further login, POST or retry is authorized by this checkpoint.
Next proposed work: read-only discovery of the first remaining principal-eligibility prerequisite. No eligibility execution or implementation authorization is created by preservation.
Documentation preservation only. MACHINE copies remain on a separate documentation branch; no deployment from this save.
