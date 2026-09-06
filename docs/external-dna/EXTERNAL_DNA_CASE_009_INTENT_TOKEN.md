# GT63 MACHINE — EXTERNAL DNA CASE #009

## INTENT TOKEN / CRYPTOGRAPHIC BEFORE-ACTION HUMAN AUTHORITY

> Status: EXTERNAL CONVERGENT EVIDENCE / CANDIDATE DNA
>
> Source class: IETF Internet-Draft / work in progress
>
> This record preserves an external architectural convergence relevant to GT63 MACHINE. It is not an accepted MACHINE primitive, not evidence of standards adoption, and not implementation authority.

> **EXTERNAL EVIDENCE ≠ CANONICAL MACHINE TRUTH**  
> **INTERNET-DRAFT ≠ ADOPTED STANDARD**  
> **RESEARCH / STANDARDS SIGNAL ≠ IMPLEMENTATION DECISION**

## 1. Primary source

- IETF Internet-Draft: `draft-williams-intent-token-02`
- Title: *Intent Token*
- Source: https://www.ietf.org/ietf-ftp/internet-drafts/draft-williams-intent-token-02.html

The draft proposes a signed, time-bounded authorization envelope issued before an agent action. The authorization object binds declared authority to a principal, an agent/session context, an action class, scope/bounds, and action-specific constraints. Enforcement occurs before effect.

## 2. Material mechanism

The material architectural signal is not merely per-action policy evaluation. It is the appearance of a portable cryptographic evidence object representing human/organizationally declared authority for a bounded action.

```text
HUMAN DECLARED INTENT
        ↓ signed
INTENT AUTHORIZATION OBJECT
        ↓ bound to
PRINCIPAL + AGENT/SESSION + ACTION + PARAMETERS/BOUNDS + TIME
        ↓
PRE-EFFECT VALIDATION / ENFORCEMENT
        ↓
ACTION
```

Validation includes the authorization object's integrity and lifetime plus whether the attempted action and relevant parameters remain within the bound authority. Invalid authorization must not be silently converted into effect authority.

## 3. Candidate genes

> **IDENTITY ≠ ACCESS ≠ ACTION AUTHORITY**
>
> **HUMAN INTENT SHOULD BE BOUND BEFORE EFFECT**
>
> **AUTHORIZATION EVIDENCE SHOULD SURVIVE AGENT / MODEL SUBSTITUTION**
>
> **FAILED AUTHORITY VALIDATION → NO PARTIAL EFFECT**
>
> **CAPABILITY / ORCHESTRATION ≠ ACTION AUTHORIZATION**

## 4. MACHINE relation

This case independently converges toward an architectural boundary already visible in MACHINE governance work:

```text
intent
  ≠ authenticated principal
  ≠ capability
  ≠ principal eligibility
  ≠ exact action authorization
  ≠ execution
```

The strongest relation is to the discovered semantic frontier `Authenticated Governance Authorization Binding V0`: an eligible principal and an authenticated approval-like event are not yet the same thing as a valid authorization bound to the exact governed action/Gate/context.

This external case does not prove that MACHINE should implement JWT, the Intent Token draft, or any particular cryptographic envelope. The convergence is at the level of **authorization as a first-class, independently verifiable, pre-effect evidence object**.

## 5. Orchestration / substitution boundary

A material additional signal is the separation between orchestration and authority. Agent/model substitution may be an orchestration decision, but it should not silently manufacture or broaden authorization.

Candidate preservation rule:

> **PLAN / AGENT SUBSTITUTION MUST NOT SILENTLY MANUFACTURE NEW AUTHORITY**

The audit/evidence chain for authorization should remain interpretable across substitution events.

## 6. Comparison to earlier external convergence

Relative to governed-capability/orchestration evidence such as platform permissions, this case goes deeper into the Authority boundary by representing action authority as a bounded object rather than only a platform configuration or permission state.

Relative to human-review closed-loop evidence, the important difference is that the human authorization can become an independently verifiable artifact rather than remaining only an implicit workflow state.

This comparison is architectural interpretation only; it does not establish comparative adoption or maturity.

## 7. Supporting convergence — Agent-to-Agent Trust, Identity, and Verifiable Provenance

Supporting source:

- IETF Internet-Draft: `draft-tonyai-a2a-trust-03`
- Source: https://www.ietf.org/ietf-ftp/internet-drafts/draft-tonyai-a2a-trust-03.html

Supporting signal: static/verifiable agent identity and provenance are separated from dynamic policy and from other enforcement/orchestration layers such as agent-to-resource access and human-in-the-loop control.

This reinforces layered governance but is **not** promoted to a separate External DNA case by this record.

## 8. Strength / limitations

Strength:

- concrete mechanism rather than terminology-only similarity;
- explicit pre-effect binding;
- independently verifiable authorization evidence;
- separation of identity/access from exact action authority;
- separation of orchestration from authorization.

Limitations:

- Internet-Draft / work in progress;
- not an adopted IETF standard;
- not evidence of broad implementation or deployment;
- draft claims do not by themselves establish production safety or efficacy;
- no MACHINE implementation decision follows from this record.

## 9. Candidate lifecycle relation

Observed external convergence supports watching the following lifecycle without canonizing it:

```text
HUMAN INTENT
    ↓
VERIFIABLE AUTHORIZATION OBJECT
    ↓
PRE-EFFECT ENFORCEMENT
    ↓
EFFECT / EXECUTION
```

Whether this eventually joins a verifiable effect-receipt layer is an open research/architecture question, not an accepted MACHINE architecture change.

## 10. Authority boundary

This file creates no authority to:

- modify `docs/MACHINE_CANONICAL_STATE.md`;
- promote candidate genes to canonical invariants;
- implement an Intent Token mechanism;
- change Human Gate semantics;
- alter accepted, implementation, or semantic frontiers;
- merge this candidate into `main`;
- deploy or execute effectful operations.

> **DNA RECORDING ≠ ARCHITECTURAL ACCEPTANCE**  
> **ARCHITECTURAL ACCEPTANCE ≠ IMPLEMENTATION AUTHORITY**
