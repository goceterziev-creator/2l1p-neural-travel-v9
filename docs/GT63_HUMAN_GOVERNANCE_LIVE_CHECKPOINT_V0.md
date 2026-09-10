# GT63 HUMAN GOVERNANCE — LIVE CHECKPOINT V0

Status: NON-CANONICAL CHECKPOINT / NAVIGATION AID ONLY
Authority: NONE
Repository: goceterziev-creator/2l1p-neural-travel-v9

## Established live runtime path

The following path was exercised on 2026-09-10 against the isolated Human Governance Approval Surface candidate runtime:

1. `npm start` launched `scripts/gt63-machine/human-governance-server-bootstrap.js`.
2. Unauthenticated GET to the bootstrap-gate presentation route returned HTTP 401 with `{"error":"Authentication required"}`.
3. Authenticated browser session returned a governance presentation bound to:
   - gate: `gt63-machine:bootstrap-gate:lifecycle-issuer-policy-v0`
   - repository: `goceterziev-creator/2l1p-neural-travel-v9`
   - target: `config/gt63-machine/governance-lifecycle-issuer-scope-policy-v0.json`
   - before: `sha256:7eccc408e7de1087acce9e6c94f848adc9cb9bc07cb78659508005c61f1367ad`
   - after: `sha256:5d5cfe1817d51aac1de08ca1889c5d274c39422b9a534cd2beca263829523093`
   - exact payload length: `548`
   - exact payload digest: `sha256:0bba51ea1427c2e5a3542c9a46de7b4de7e44861ebdf82f14469d2f8777899aa`
4. Human explicitly approved the exact 548 bytes.
5. POST decision returned HTTP 200 with `outcome: HUMAN_SOURCE_EVENT_CREATED`.
6. Observed source event identifiers:
   - `sourceEventRef`: `gt63-human-source-event:b3be7af0c695c0d338b67900a20ca2cb`
   - `providerEventId`: `gt63-provider-event:f78ab1662fb2512e8f659af5c6397323`
   - `interactionId`: `gt63-presentation:ea81ab567101858171d0c9aefe72877c`
   - `claimedActorRef`: `gt63-runtime-user:USR-ADMIN`
   - `attributedPrincipalRef`: `null`
   - `authority`: `NONE`

This checkpoint records the supplied runtime observations. It does not upgrade chat transcript data into accepted durable evidence by itself.

## Closed checkpoint boundary

`REAL RUNTIME -> AUTHENTICATION BOUNDARY -> EXACT PRESENTATION -> EXPLICIT HUMAN DECISION -> HUMAN_SOURCE_EVENT_CREATED` is established within the observed isolated runtime scope.

Do not repeat this discovery merely because chat, runtime, or working context changes.

Reopen only for contradictory primary evidence, failed exact identity verification, or a materially changed baseline.

## Production binding adapter candidate

Branch predecessor:
`experiment/human-source-event-production-binding-adapter-v0`

Known candidate HEAD before principal-binding work:
`97ffa1be8317bf4d52e94211276e4bb3ef23f6bd`

The adapter preserves fail-closed identity/trust semantics:
- presentation/source-event routing may be bound;
- principal resolution remains missing without authoritative identity evidence;
- source trust remains UNKNOWN where not established;
- authority remains NONE.

## Human-approved principal / trust model

Human-approved principal identity:
`gt63-machine:human-principal:goce-v0`

Human-approved V0 trust direction:
- GitHub-backed identity is the identity provider direction.
- Immutable GitHub numeric account ID is the binding key.
- GitHub login is observational/mutable and not authority-bearing.
- Application account `USR-ADMIN` is not automatically a governance principal.
- Local development signed session / fallback secret is not elevated into a governance trust root.
- Authenticated GitHub identity does not establish principal eligibility, governance authorization, or execution authority.

Authenticated GitHub connector profile observed during this bounded work:
- GitHub account ID: `239696056`
- GitHub login: `goceterziev-creator`

The numeric account ID is used in the current candidate binding definition. The login is observation-only.

## Current candidate

Branch:
`experiment/github-backed-human-principal-binding-v0`

Base:
`97ffa1be8317bf4d52e94211276e4bb3ef23f6bd`

Files added:
- `config/gt63-machine/human-principal-github-binding-v0.json`
- `scripts/gt63-machine/github-backed-human-principal-binding.js`
- `scripts/gt63-machine/github-backed-human-principal-binding-regression.js`

Latest known HEAD after regression materialization:
`0ecb824f9e11f5470622236e9348d25632585c9b`

Regression tests are materialized but were not executed by GitHub/runtime at checkpoint creation. Do not claim PASS until executed.

## Frozen invariants

- `ARTIFACT NAME / CHAT PRESENCE != LOCAL MATERIALIZATION != EXECUTED RUNTIME`
- `PRESENTATION TO AUTHENTICATED HUMAN != HUMAN APPROVAL`
- `HUMAN_SOURCE_EVENT_CREATED != AUTHENTICATED HUMAN SOURCE EVENT BINDING ACCEPTED`
- `APPLICATION ACCOUNT != GOVERNANCE PRINCIPAL`
- `AUTHENTICATED GITHUB IDENTITY != PRINCIPAL ELIGIBILITY`
- `AUTHENTICATED GITHUB IDENTITY != GOVERNANCE AUTHORIZATION`
- `GOVERNANCE AUTHORIZATION != EXECUTION AUTHORITY`
- `LOGIN NAME != IMMUTABLE ACCOUNT ID`
- `TEST STUBS != PRODUCTION PROVENANCE`
- `AUTHORITY = NONE` unless a downstream accepted governance mechanism establishes otherwise.

## Current open boundary

The next unresolved production boundary is not principal naming. It is trustworthy provider-to-runtime identity evidence and its binding into the existing Human Source Event authentication path.

A future production GitHub identity adapter must establish provider-authenticated identity evidence for exact GitHub account ID `239696056` and expose it without converting identity into eligibility or authorization.

No main merge, deploy, governance-policy mutation, or evidence-store mutation is authorized or implied by this checkpoint.
